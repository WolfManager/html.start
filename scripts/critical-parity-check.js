const fs = require("fs");
const path = require("path");

const isJsonOutput = process.argv.includes("--json");
const withAdminChecks = process.argv.includes("--with-admin");
const requireAdminChecks = process.argv.includes("--require-admin");
const saveReport = process.argv.includes("--save-report");
const outArg = process.argv.find((arg) => String(arg).startsWith("--out="));
const labelArg = process.argv.find((arg) => String(arg).startsWith("--label="));
const maxNodeLatencyArg = process.argv.find((arg) =>
  String(arg).startsWith("--max-node-latency-ms="),
);
const maxDjangoLatencyArg = process.argv.find((arg) =>
  String(arg).startsWith("--max-django-latency-ms="),
);

const reportLabel = labelArg
  ? String(labelArg).slice("--label=".length).trim()
  : "";

const maxNodeLatencyMs = maxNodeLatencyArg
  ? Number(String(maxNodeLatencyArg).split("=")[1])
  : null;
const maxDjangoLatencyMs = maxDjangoLatencyArg
  ? Number(String(maxDjangoLatencyArg).split("=")[1])
  : null;

const nodeBase = String(
  process.env.MAGNETO_NODE_BASE_URL || "http://127.0.0.1:3000",
)
  .trim()
  .replace(/\/+$/, "");
const djangoBase = String(
  process.env.MAGNETO_DJANGO_BASE_URL || "http://127.0.0.1:8000",
)
  .trim()
  .replace(/\/+$/, "");

const adminUser = String(
  process.env.MAGNETO_ADMIN_USER || process.env.ADMIN_USER || "",
).trim();
const adminPassword = String(
  process.env.MAGNETO_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "",
).trim();
const hasAdminCredentials = Boolean(adminUser && adminPassword);
const shouldRunAdminChecks = Boolean(
  requireAdminChecks || (withAdminChecks && hasAdminCredentials),
);

const REQUEST_TIMEOUT_MS = 12000;

function log(message) {
  if (!isJsonOutput) {
    console.log(message);
  }
}

function logError(message) {
  if (!isJsonOutput) {
    console.error(message);
  }
}

function buildReportPath() {
  if (outArg) {
    const raw = String(outArg).slice("--out=".length).trim();
    if (raw) {
      return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
    }
  }

  if (!saveReport) {
    return "";
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(
    process.cwd(),
    "data",
    "backups",
    "parity",
    `critical-parity-${stamp}.json`,
  );
}

function writeReport(report) {
  const outputPath = buildReportPath();
  if (!outputPath) {
    return "";
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outputPath;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function uniqueNormalized(values) {
  const set = new Set();
  for (const value of values || []) {
    const normalized = normalizeText(value);
    if (normalized) {
      set.add(normalized);
    }
  }
  return set;
}

function overlapCount(leftSet, rightSet) {
  let count = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      count += 1;
    }
  }
  return count;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);

    return {
      ok: response.ok,
      status: response.status,
      ms: Date.now() - startedAt,
      body,
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - startedAt,
      body: null,
      error: String(error?.message || error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function validateHealth(body) {
  return Boolean(body && (body.ok === true || body.status === "ok"));
}

function validateSearch(body) {
  return Boolean(
    body &&
    typeof body.query === "string" &&
    Number.isFinite(Number(body.total)) &&
    Array.isArray(body.results) &&
    body.pagination &&
    typeof body.pagination === "object",
  );
}

function validateAssistant(body) {
  return Boolean(
    body &&
    typeof body.reply === "string" &&
    body.reply.trim().length > 0 &&
    typeof body.helper === "string" &&
    body.helper.trim().length > 0,
  );
}

function validateEvent(body) {
  return Boolean(body && body.ok === true);
}

function validateLogin(body) {
  return Boolean(body && typeof body.token === "string" && body.token.trim());
}

function validateOverview(body) {
  return Boolean(
    body &&
    ((body.totals && Array.isArray(body.topQueries)) ||
      (body.kpis && Array.isArray(body.topQueries))),
  );
}

function validateRuntimeMetrics(body) {
  return Boolean(body && body.runtime && typeof body.runtime === "object");
}

function validateRouting(body) {
  return Boolean(
    body &&
    body.ok === true &&
    body.routing &&
    typeof body.routing.activeBackend === "string" &&
    Number.isFinite(Number(body.routing.canaryPercent)),
  );
}

function validateAssistantStatus(body) {
  return Boolean(
    body &&
    body.assistant &&
    typeof body.assistant === "object" &&
    typeof body.assistant.configured === "boolean" &&
    body.assistant.providers &&
    typeof body.assistant.providers === "object",
  );
}

function validateSearchStatus(body) {
  return Boolean(
    body &&
    body.ok === true &&
    body.search &&
    body.search.sources &&
    body.search.documents,
  );
}

function validateRewriteRules(body) {
  return Boolean(body && body.ok === true && Array.isArray(body.rewriteRules));
}

function validateRankingConfig(body) {
  return Boolean(
    body &&
      body.ok === true &&
      body.rankingConfig &&
      typeof body.rankingConfig === "object" &&
      body.rankingConfig.coverageThresholdByIntent &&
      typeof body.rankingConfig.coverageThresholdByIntent === "object" &&
      body.rankingConfig.sourceAuthorityBoosts &&
      typeof body.rankingConfig.sourceAuthorityBoosts === "object" &&
      Array.isArray(body.rankingConfig.optionalQueryTokens),
  );
}

function buildParityDiffForSearch(nodeBody, djangoBody) {
  const nodeTop = uniqueNormalized(
    (nodeBody?.results || []).slice(0, 5).map((i) => i?.url),
  );
  const djangoTop = uniqueNormalized(
    (djangoBody?.results || []).slice(0, 5).map((i) => i?.url),
  );
  return {
    queryMatches:
      normalizeText(nodeBody?.queryUsed || nodeBody?.query) ===
      normalizeText(djangoBody?.queryUsed || djangoBody?.query),
    totalNode: Number(nodeBody?.total || 0),
    totalDjango: Number(djangoBody?.total || 0),
    topUrlOverlap: overlapCount(nodeTop, djangoTop),
  };
}

function evaluateLatencyFindings(checks) {
  const findings = [];

  if (Number.isFinite(maxNodeLatencyMs) && maxNodeLatencyMs > 0) {
    const slowNode = checks.filter((item) => item.node.ms > maxNodeLatencyMs);
    if (slowNode.length > 0) {
      findings.push(
        `Node latency gate failed: ${slowNode.length} check(s) above ${maxNodeLatencyMs}ms.`,
      );
    }
  }

  if (Number.isFinite(maxDjangoLatencyMs) && maxDjangoLatencyMs > 0) {
    const slowDjango = checks.filter(
      (item) => item.django.ms > maxDjangoLatencyMs,
    );
    if (slowDjango.length > 0) {
      findings.push(
        `Django latency gate failed: ${slowDjango.length} check(s) above ${maxDjangoLatencyMs}ms.`,
      );
    }
  }

  return findings;
}

async function runPublicChecks() {
  const checks = [];

  const healthNode = await fetchJson(`${nodeBase}/api/health`);
  const healthDjango = await fetchJson(`${djangoBase}/api/health`);
  checks.push({
    name: "health",
    node: healthNode,
    django: healthDjango,
    parityOk:
      healthNode.ok &&
      healthDjango.ok &&
      validateHealth(healthNode.body) &&
      validateHealth(healthDjango.body),
  });

  const searchNode = await fetchJson(
    `${nodeBase}/api/search?q=api%20documentation&limit=5&page=1&sort=relevance`,
  );
  const searchDjango = await fetchJson(
    `${djangoBase}/api/search?q=api%20documentation&limit=5&page=1&sort=relevance`,
  );
  const searchDiff = buildParityDiffForSearch(
    searchNode.body,
    searchDjango.body,
  );
  checks.push({
    name: "search",
    node: searchNode,
    django: searchDjango,
    parityOk:
      searchNode.ok &&
      searchDjango.ok &&
      validateSearch(searchNode.body) &&
      validateSearch(searchDjango.body),
    parityDetails: searchDiff,
  });

  const eventBody = JSON.stringify({ page: "critical-parity-check" });
  const eventNode = await fetchJson(`${nodeBase}/api/events/page-view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: eventBody,
  });
  const eventDjango = await fetchJson(`${djangoBase}/api/events/page-view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: eventBody,
  });
  checks.push({
    name: "events:page-view",
    node: eventNode,
    django: eventDjango,
    parityOk:
      eventNode.ok &&
      eventDjango.ok &&
      validateEvent(eventNode.body) &&
      validateEvent(eventDjango.body),
  });

  const assistantPayload = JSON.stringify({ message: "health check" });
  const assistantNode = await fetchJson(`${nodeBase}/api/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: assistantPayload,
  });
  const assistantDjango = await fetchJson(`${djangoBase}/api/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: assistantPayload,
  });
  checks.push({
    name: "assistant:chat",
    node: assistantNode,
    django: assistantDjango,
    parityOk:
      assistantNode.ok &&
      assistantDjango.ok &&
      validateAssistant(assistantNode.body) &&
      validateAssistant(assistantDjango.body),
  });

  return checks;
}

async function runAdminChecks() {
  const loginBody = JSON.stringify({
    username: adminUser,
    password: adminPassword,
  });

  const nodeLogin = await fetchJson(`${nodeBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: loginBody,
  });
  const djangoLogin = await fetchJson(`${djangoBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: loginBody,
  });

  const checks = [
    {
      name: "admin:login",
      node: nodeLogin,
      django: djangoLogin,
      parityOk:
        nodeLogin.ok &&
        djangoLogin.ok &&
        validateLogin(nodeLogin.body) &&
        validateLogin(djangoLogin.body),
    },
  ];

  const nodeToken = String(nodeLogin.body?.token || "").trim();
  const djangoToken = String(djangoLogin.body?.token || "").trim();

  const nodeOverview = nodeToken
    ? await fetchJson(`${nodeBase}/api/admin/overview?range=24h`, {
        headers: {
          Authorization: `Bearer ${nodeToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Node admin token.",
      };

  const djangoOverview = djangoToken
    ? await fetchJson(`${djangoBase}/api/admin/overview?range=24h`, {
        headers: {
          Authorization: `Bearer ${djangoToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Django admin token.",
      };

  checks.push({
    name: "admin:overview",
    node: nodeOverview,
    django: djangoOverview,
    parityOk:
      nodeOverview.ok &&
      djangoOverview.ok &&
      validateOverview(nodeOverview.body) &&
      validateOverview(djangoOverview.body),
  });

  const nodeRuntimeMetrics = nodeToken
    ? await fetchJson(`${nodeBase}/api/admin/runtime-metrics`, {
        headers: {
          Authorization: `Bearer ${nodeToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Node admin token.",
      };

  const djangoRuntimeMetrics = djangoToken
    ? await fetchJson(`${djangoBase}/api/admin/runtime-metrics`, {
        headers: {
          Authorization: `Bearer ${djangoToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Django admin token.",
      };

  checks.push({
    name: "admin:runtime-metrics",
    node: nodeRuntimeMetrics,
    django: djangoRuntimeMetrics,
    parityOk:
      nodeRuntimeMetrics.ok &&
      djangoRuntimeMetrics.ok &&
      validateRuntimeMetrics(nodeRuntimeMetrics.body) &&
      validateRuntimeMetrics(djangoRuntimeMetrics.body),
  });

  const nodeRouting = nodeToken
    ? await fetchJson(`${nodeBase}/api/admin/routing`, {
        headers: {
          Authorization: `Bearer ${nodeToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Node admin token.",
      };

  const djangoRouting = djangoToken
    ? await fetchJson(`${djangoBase}/api/admin/routing`, {
        headers: {
          Authorization: `Bearer ${djangoToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Django admin token.",
      };

  checks.push({
    name: "admin:routing",
    node: nodeRouting,
    django: djangoRouting,
    parityOk:
      nodeRouting.ok &&
      djangoRouting.ok &&
      validateRouting(nodeRouting.body) &&
      validateRouting(djangoRouting.body),
    parityDetails: {
      activeBackendMatches:
        String(nodeRouting.body?.routing?.activeBackend || "") ===
        String(djangoRouting.body?.routing?.activeBackend || ""),
      canaryPercentMatches:
        Number(nodeRouting.body?.routing?.canaryPercent) ===
        Number(djangoRouting.body?.routing?.canaryPercent),
    },
  });

  const nodeAssistantStatus = nodeToken
    ? await fetchJson(`${nodeBase}/api/admin/assistant-status`, {
        headers: {
          Authorization: `Bearer ${nodeToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Node admin token.",
      };

  const djangoAssistantStatus = djangoToken
    ? await fetchJson(`${djangoBase}/api/admin/assistant-status`, {
        headers: {
          Authorization: `Bearer ${djangoToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Django admin token.",
      };

  checks.push({
    name: "admin:assistant-status",
    node: nodeAssistantStatus,
    django: djangoAssistantStatus,
    parityOk:
      nodeAssistantStatus.ok &&
      djangoAssistantStatus.ok &&
      validateAssistantStatus(nodeAssistantStatus.body) &&
      validateAssistantStatus(djangoAssistantStatus.body),
  });

  const nodeSearchStatus = nodeToken
    ? await fetchJson(`${nodeBase}/api/admin/search/status`, {
        headers: {
          Authorization: `Bearer ${nodeToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Node admin token.",
      };

  const djangoSearchStatus = djangoToken
    ? await fetchJson(`${djangoBase}/api/admin/search/status`, {
        headers: {
          Authorization: `Bearer ${djangoToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Django admin token.",
      };

  checks.push({
    name: "admin:search-status",
    node: nodeSearchStatus,
    django: djangoSearchStatus,
    parityOk:
      nodeSearchStatus.ok &&
      djangoSearchStatus.ok &&
      validateSearchStatus(nodeSearchStatus.body) &&
      validateSearchStatus(djangoSearchStatus.body),
  });

  const nodeRewriteRules = nodeToken
    ? await fetchJson(`${nodeBase}/api/admin/search/rewrite-rules`, {
        headers: {
          Authorization: `Bearer ${nodeToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Node admin token.",
      };

  const djangoRewriteRules = djangoToken
    ? await fetchJson(`${djangoBase}/api/admin/search/rewrite-rules`, {
        headers: {
          Authorization: `Bearer ${djangoToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Django admin token.",
      };

  checks.push({
    name: "admin:search:rewrite-rules",
    node: nodeRewriteRules,
    django: djangoRewriteRules,
    parityOk:
      nodeRewriteRules.ok &&
      djangoRewriteRules.ok &&
      validateRewriteRules(nodeRewriteRules.body) &&
      validateRewriteRules(djangoRewriteRules.body),
    parityDetails: {
      nodeRuleCount: Array.isArray(nodeRewriteRules.body?.rewriteRules)
        ? nodeRewriteRules.body.rewriteRules.length
        : 0,
      djangoRuleCount: Array.isArray(djangoRewriteRules.body?.rewriteRules)
        ? djangoRewriteRules.body.rewriteRules.length
        : 0,
    },
  });

  const nodeRankingConfig = nodeToken
    ? await fetchJson(`${nodeBase}/api/admin/search/ranking-config`, {
        headers: {
          Authorization: `Bearer ${nodeToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Node admin token.",
      };

  const djangoRankingConfig = djangoToken
    ? await fetchJson(`${djangoBase}/api/admin/search/ranking-config`, {
        headers: {
          Authorization: `Bearer ${djangoToken}`,
        },
      })
    : {
        ok: false,
        status: 0,
        ms: 0,
        body: null,
        error: "Missing Django admin token.",
      };

  checks.push({
    name: "admin:search:ranking-config",
    node: nodeRankingConfig,
    django: djangoRankingConfig,
    parityOk:
      nodeRankingConfig.ok &&
      djangoRankingConfig.ok &&
      validateRankingConfig(nodeRankingConfig.body) &&
      validateRankingConfig(djangoRankingConfig.body),
    parityDetails: {
      coverageIntentCountNode: Object.keys(
        nodeRankingConfig.body?.rankingConfig?.coverageThresholdByIntent || {},
      ).length,
      coverageIntentCountDjango: Object.keys(
        djangoRankingConfig.body?.rankingConfig?.coverageThresholdByIntent || {},
      ).length,
      optionalTokenCountNode: Array.isArray(
        nodeRankingConfig.body?.rankingConfig?.optionalQueryTokens,
      )
        ? nodeRankingConfig.body.rankingConfig.optionalQueryTokens.length
        : 0,
      optionalTokenCountDjango: Array.isArray(
        djangoRankingConfig.body?.rankingConfig?.optionalQueryTokens,
      )
        ? djangoRankingConfig.body.rankingConfig.optionalQueryTokens.length
        : 0,
    },
  });

  return checks;
}

function compactResult(result) {
  return {
    ok: result.ok,
    status: result.status,
    ms: result.ms,
    error: result.error || "",
  };
}

async function main() {
  log("Running critical Node vs Django parity checks...");
  log(`Node base: ${nodeBase}`);
  log(`Django base: ${djangoBase}`);

  const checks = [...(await runPublicChecks())];

  if (shouldRunAdminChecks) {
    checks.push(...(await runAdminChecks()));
  } else {
    log("Admin parity checks skipped (use --with-admin or --require-admin).");
  }

  const failures = [];
  for (const check of checks) {
    const nodeOk = check.node.ok;
    const djangoOk = check.django.ok;
    const parityOk = Boolean(check.parityOk);

    if (nodeOk && djangoOk && parityOk) {
      log(
        `PASS ${check.name} (node=${check.node.status}/${check.node.ms}ms, django=${check.django.status}/${check.django.ms}ms)`,
      );
      continue;
    }

    const reasonParts = [];
    if (!nodeOk) {
      reasonParts.push(
        `node failed (${check.node.status}${check.node.error ? `: ${check.node.error}` : ""})`,
      );
    }
    if (!djangoOk) {
      reasonParts.push(
        `django failed (${check.django.status}${check.django.error ? `: ${check.django.error}` : ""})`,
      );
    }
    if (nodeOk && djangoOk && !parityOk) {
      reasonParts.push("contract parity failed");
    }

    const reason = reasonParts.join("; ");
    logError(`FAIL ${check.name}: ${reason}`);
    failures.push({
      name: check.name,
      reason,
      node: compactResult(check.node),
      django: compactResult(check.django),
      parityDetails: check.parityDetails || null,
    });
  }

  const gateFindings = [];
  if (requireAdminChecks && !hasAdminCredentials) {
    gateFindings.push(
      "Admin credentials missing while --require-admin is enabled.",
    );
  }

  gateFindings.push(...evaluateLatencyFindings(checks));

  const report = {
    generatedAt: new Date().toISOString(),
    label: reportLabel || null,
    nodeBase,
    djangoBase,
    options: {
      withAdminChecks,
      requireAdminChecks,
      maxNodeLatencyMs: Number.isFinite(maxNodeLatencyMs)
        ? maxNodeLatencyMs
        : null,
      maxDjangoLatencyMs: Number.isFinite(maxDjangoLatencyMs)
        ? maxDjangoLatencyMs
        : null,
    },
    checks,
    failures,
    gateFindings,
    parityPassed: failures.length === 0,
    gatePassed: gateFindings.length === 0,
    passed: failures.length === 0 && gateFindings.length === 0,
  };

  report.goNoGo = report.passed ? "GO" : "NO-GO";
  report.summary = {
    checksTotal: checks.length,
    checksPassed: checks.length - failures.length,
    checksFailed: failures.length,
    maxNodeLatencyMs: checks.reduce(
      (maxValue, item) => Math.max(maxValue, Number(item.node.ms) || 0),
      0,
    ),
    maxDjangoLatencyMs: checks.reduce(
      (maxValue, item) => Math.max(maxValue, Number(item.django.ms) || 0),
      0,
    ),
  };

  const savedReportPath = writeReport(report);
  if (savedReportPath) {
    report.savedReportPath = savedReportPath;
  }

  if (isJsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (savedReportPath) {
      log(`Saved report: ${savedReportPath}`);
    }
    log(`GO/NO-GO: ${report.goNoGo}`);
  }

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const crashReport = {
    generatedAt: new Date().toISOString(),
    passed: false,
    goNoGo: "NO-GO",
    crash: String(error?.message || error),
  };
  if (isJsonOutput) {
    console.log(JSON.stringify(crashReport, null, 2));
  } else {
    console.error("Critical parity check crashed:", error);
  }
  process.exitCode = 1;
});
