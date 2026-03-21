const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const isJsonOutput = process.argv.includes("--json");
const requireAdminChecks = process.argv.includes("--require-admin");
const withAdminChecks = process.argv.includes("--with-admin");
const maxLatencyArg = process.argv.find((arg) =>
  String(arg).startsWith("--max-latency-ms="),
);
const apiTargetArg = process.argv.find((arg) =>
  String(arg).startsWith("--api-target="),
);
const apiBaseArg = process.argv.find((arg) =>
  String(arg).startsWith("--api-base="),
);
const maxLatencyMs = maxLatencyArg
  ? Number(String(maxLatencyArg).split("=")[1])
  : null;
const saveReport = process.argv.includes("--save-report");
const outArg = process.argv.find((arg) => String(arg).startsWith("--out="));
const labelArg = process.argv.find((arg) => String(arg).startsWith("--label="));
const gateNameArg = process.argv.find((arg) =>
  String(arg).startsWith("--gate-name="),
);
const reportLabel = labelArg
  ? String(labelArg).slice("--label=".length).trim()
  : "";
const gateName = gateNameArg
  ? String(gateNameArg).slice("--gate-name=".length).trim()
  : "";

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

const rootDir = path.resolve(__dirname, "..");
const djangoDir = path.join(rootDir, "backend-django");

function buildReportPath() {
  if (outArg) {
    const raw = String(outArg).slice("--out=".length).trim();
    if (raw) {
      return path.isAbsolute(raw) ? raw : path.resolve(rootDir, raw);
    }
  }

  if (!saveReport) {
    return "";
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(
    rootDir,
    "data",
    "backups",
    "health-check",
    `health-check-${stamp}.json`,
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

dotenv.config({ path: path.join(rootDir, ".env"), override: false });
dotenv.config({ path: path.join(djangoDir, ".env"), override: false });

const nodePort = String(
  process.env.MAGNETO_NODE_PORT || process.env.PORT || "3000",
).trim();
const djangoPort = String(process.env.MAGNETO_DJANGO_PORT || "8000").trim();
const apiTargetRaw = apiTargetArg
  ? String(apiTargetArg).slice("--api-target=".length).trim().toLowerCase()
  : String(process.env.MAGNETO_HEALTH_API_TARGET || "node")
      .trim()
      .toLowerCase();

const apiTarget =
  apiTargetRaw === "django" || apiTargetRaw === "node" ? apiTargetRaw : "node";

const DEFAULT_WEB_BASE =
  process.env.MAGNETO_WEB_BASE || `http://localhost:${nodePort}`;
const explicitApiBase = apiBaseArg
  ? String(apiBaseArg).slice("--api-base=".length).trim()
  : String(process.env.MAGNETO_API_BASE || "").trim();
const DEFAULT_API_BASE = explicitApiBase
  ? explicitApiBase
  : apiTarget === "django"
    ? `http://127.0.0.1:${djangoPort}`
    : `http://127.0.0.1:${nodePort}`;

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

const webBase = trimSlash(DEFAULT_WEB_BASE);
const apiBase = trimSlash(DEFAULT_API_BASE);

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

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

async function runCheck(name, requestBuilder, validator) {
  const startedAt = Date.now();
  try {
    const response = await requestBuilder();
    const payload = await parseJsonSafe(response);
    const ok = validator(response, payload);
    const ms = Date.now() - startedAt;

    if (ok) {
      return { name, ok: true, ms, status: response.status };
    }

    return {
      name,
      ok: false,
      ms,
      status: response.status,
      detail: payload
        ? JSON.stringify(payload).slice(0, 300)
        : "Validation failed",
    };
  } catch (error) {
    const ms = Date.now() - startedAt;
    return {
      name,
      ok: false,
      ms,
      status: 0,
      detail: String(error && error.message ? error.message : error),
    };
  }
}

async function runAssistantChatCheck(apiBaseUrl) {
  const endpoint = `${apiBaseUrl}/api/assistant/chat`;
  const headers = { "Content-Type": "application/json" };

  // Warm-up call to avoid measuring one-time cold path costs in gate latency.
  try {
    await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "health check" }),
    });
  } catch (_error) {
    // Ignore warm-up failures; the measured check below remains authoritative.
  }

  return runCheck(
    "api:assistant:chat",
    () =>
      fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "health check" }),
      }),
    (res, body) =>
      res.ok &&
      body &&
      typeof body.reply === "string" &&
      body.reply.trim().length > 0,
  );
}

async function main() {
  log(`Running MAGNETO health-check...`);
  log(`Web base: ${webBase}`);
  log(`API target: ${apiTarget}`);
  log(`API base: ${apiBase}`);
  if (shouldRunAdminChecks) {
    log("Admin checks: enabled (credentials detected)");
  } else {
    log("Admin checks: disabled (use --with-admin or --require-admin)");
  }

  const checks = [
    runCheck(
      "web:index",
      () => fetch(`${webBase}/index.html`),
      (res) => res.ok,
    ),
    runCheck(
      "api:health",
      () => fetch(`${apiBase}/api/health`),
      (res, body) =>
        res.ok && body && (body.status === "ok" || body.ok === true),
    ),
    runCheck(
      "api:search",
      () => fetch(`${apiBase}/api/search?q=test`),
      (res, body) => res.ok && body && Array.isArray(body.results),
    ),
    runCheck(
      "api:events:page-view",
      () =>
        fetch(`${apiBase}/api/events/page-view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: "health-check" }),
        }),
      (res, body) => res.ok && body && body.ok === true,
    ),
    runAssistantChatCheck(apiBase),
  ];

  const results = await Promise.all(checks);

  let adminToken = "";
  if (shouldRunAdminChecks) {
    const loginResult = await runCheck(
      "api:admin:login",
      () =>
        fetch(`${apiBase}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: adminUser,
            password: adminPassword,
          }),
        }),
      (res, body) => {
        if (!res.ok || !body || typeof body.token !== "string") {
          return false;
        }
        adminToken = body.token;
        return true;
      },
    );

    results.push(loginResult);

    if (adminToken) {
      results.push(
        await runCheck(
          "api:admin:overview",
          () =>
            fetch(`${apiBase}/api/admin/overview?range=24h`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            }),
          (res, body) => {
            if (!res.ok || !body) {
              return false;
            }

            // Support both legacy (kpis) and current (totals) schemas.
            return Boolean(
              (body.kpis && body.topQueries) ||
              (body.totals && Array.isArray(body.topQueries)),
            );
          },
        ),
      );

      results.push(
        await runCheck(
          "api:admin:runtime-metrics",
          () =>
            fetch(`${apiBase}/api/admin/runtime-metrics`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            }),
          (res, body) => res.ok && body && body.runtime,
        ),
      );

      results.push(
        await runCheck(
          "api:admin:routing",
          () =>
            fetch(`${apiBase}/api/admin/routing`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            }),
          (res, body) =>
            res.ok &&
            body &&
            body.ok === true &&
            body.routing &&
            typeof body.routing.activeBackend === "string" &&
            typeof body.routing.canaryPercent === "number",
        ),
      );
    }
  } else {
    log("Skipping admin checks.");
  }

  let failures = 0;
  for (const result of results) {
    const statusLabel = result.ok ? "PASS" : "FAIL";
    const base = `${statusLabel} ${result.name} (${result.ms}ms, status=${result.status})`;
    if (result.ok) {
      log(base);
      continue;
    }

    failures += 1;
    logError(`${base}${result.detail ? ` -> ${result.detail}` : ""}`);
  }

  const gateFindings = [];
  if (requireAdminChecks && !hasAdminCredentials) {
    gateFindings.push(
      "Admin credentials missing while --require-admin is enabled.",
    );
  }

  if (Number.isFinite(maxLatencyMs) && maxLatencyMs > 0) {
    const slowChecks = results.filter((item) => Number(item.ms) > maxLatencyMs);
    if (slowChecks.length > 0) {
      gateFindings.push(
        `Latency gate failed: ${slowChecks.length} check(s) above ${maxLatencyMs}ms.`,
      );
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    label: reportLabel || null,
    gateName: gateName || null,
    apiTarget,
    webBase,
    apiBase,
    adminChecksEnabled: shouldRunAdminChecks,
    options: {
      withAdminChecks,
      requireAdminChecks,
      maxLatencyMs: Number.isFinite(maxLatencyMs) ? maxLatencyMs : null,
    },
    checks: results,
    failures,
    gateFailures: gateFindings.length,
    gateFindings,
    passed: failures === 0 && gateFindings.length === 0,
  };
  report.goNoGo = report.passed ? "GO" : "NO-GO";
  report.summary = {
    checksTotal: results.length,
    checksPassed: results.filter((item) => item.ok).length,
    checksFailed: failures,
    maxLatencyMs: results.reduce(
      (maxValue, item) => Math.max(maxValue, Number(item.ms) || 0),
      0,
    ),
    latencyGateMs: Number.isFinite(maxLatencyMs) ? maxLatencyMs : null,
  };

  const savedReportPath = writeReport(report);
  if (savedReportPath) {
    report.savedReportPath = savedReportPath;
  }

  if (isJsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (savedReportPath) {
    log(`Saved report: ${savedReportPath}`);
  }

  const verdictPrefix = gateName ? ` (${gateName})` : "";
  log(
    `GO/NO-GO${verdictPrefix}: ${report.goNoGo} [target=${apiTarget}, apiBase=${apiBase}]`,
  );

  if (failures > 0 || gateFindings.length > 0) {
    if (failures > 0) {
      logError(`Health-check completed with ${failures} failure(s).`);
    }
    for (const finding of gateFindings) {
      logError(`GATE FAIL: ${finding}`);
    }
    process.exitCode = 1;
    return;
  }

  log("Health-check passed.");
}

main().catch((error) => {
  if (isJsonOutput) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          passed: false,
          failures: 1,
          crash: String(error && error.message ? error.message : error),
        },
        null,
        2,
      ),
    );
  } else {
    console.error("Health-check crashed:", error);
  }
  process.exitCode = 1;
});
