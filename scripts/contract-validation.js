/**
 * Contract Validation Script
 *
 * Validates that live Node and/or Django API responses conform to the
 * shared JSON Schema contracts defined in domains/ and shared/schemas/.
 *
 * Usage:
 *   node scripts/contract-validation.js [options]
 *
 * Options:
 *   --api-target=node|django|both   Which backend(s) to test (default: both)
 *   --with-admin                    Validate admin endpoints when credentials exist
 *   --require-admin                 Require admin validation and credentials
 *   --json                          Output raw JSON
 *   --save-report                   Save JSON report to data/backups/contract/
 *   --out=<path>                    Override output file path
 *   --label=<name>                  Label for saved report
 *   --node-port=<n>                 Node port (default: 3000)
 *   --django-port=<n>               Django port (default: 8000)
 *   --timeout-ms=<n>                HTTP timeout per request (default: 8000)
 */

"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : defaultValue;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const apiTarget = getArg("api-target", "both");
const withAdmin = hasFlag("with-admin");
const requireAdmin = hasFlag("require-admin");
const jsonMode = hasFlag("json");
const saveReport = hasFlag("save-report");
const outPath = getArg("out", null);
const label = getArg("label", "contract-validation");
const nodePort = parseInt(getArg("node-port", "3000"), 10);
const djangoPort = parseInt(getArg("django-port", "8000"), 10);
const timeoutMs = parseInt(getArg("timeout-ms", "8000"), 10);

const includeNode = apiTarget === "node" || apiTarget === "both";
const includeDjango = apiTarget === "django" || apiTarget === "both";

const adminUser = String(
  process.env.MAGNETO_ADMIN_USER || process.env.ADMIN_USER || "",
).trim();
const adminPassword = String(
  process.env.MAGNETO_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "",
).trim();
const hasAdminCredentials = Boolean(adminUser && adminPassword);
const shouldRunAdminChecks = Boolean(
  requireAdmin || (withAdmin && hasAdminCredentials),
);

// ---------------------------------------------------------------------------
// Schema loader — reads JSON Schema files as structural contracts
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");

function loadSchema(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return null;
  }
}

const SCHEMAS = {
  "search-request": loadSchema(
    "domains/search/contracts/search-request.schema.json",
  ),
  "search-response": loadSchema(
    "domains/search/contracts/search-response.schema.json",
  ),
  "assistant-request": loadSchema(
    "domains/assistant/contracts/assistant-request.schema.json",
  ),
  "assistant-response": loadSchema(
    "domains/assistant/contracts/assistant-response.schema.json",
  ),
  "admin-metrics-response": loadSchema(
    "domains/admin/contracts/admin-metrics-response.schema.json",
  ),
  "error-response": loadSchema("shared/schemas/error-response.schema.json"),
};

// ---------------------------------------------------------------------------
// Lightweight structural validator (subset of JSON Schema)
// Validates: required fields, top-level types, array item required fields
// ---------------------------------------------------------------------------

function schemaTypeMatches(value, typeSpec) {
  const types = Array.isArray(typeSpec) ? typeSpec : [typeSpec];
  for (const t of types) {
    if (t === "null" && value === null) return true;
    if (t === "string" && typeof value === "string") return true;
    if (t === "boolean" && typeof value === "boolean") return true;
    if (t === "integer" && Number.isInteger(value)) return true;
    if (t === "number" && typeof value === "number") return true;
    if (t === "array" && Array.isArray(value)) return true;
    if (
      t === "object" &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    )
      return true;
  }
  return false;
}

/**
 * Validate a single value against a schema node.
 * Returns an array of violation strings (empty = valid).
 */
function validateNode(value, schema, path) {
  const violations = [];
  if (!schema || typeof schema !== "object") return violations;

  if (schema.type !== undefined) {
    if (!schemaTypeMatches(value, schema.type)) {
      violations.push(
        `${path}: expected type ${JSON.stringify(schema.type)}, got ${Array.isArray(value) ? "array" : value === null ? "null" : typeof value}`,
      );
      return violations; // no point checking deeper if wrong type
    }
  }

  if (
    schema.required &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    for (const req of schema.required) {
      if (!(req in value)) {
        violations.push(`${path}: missing required field "${req}"`);
      }
    }
  }

  if (
    schema.properties &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
          violations.push(`${path}: unexpected field "${key}"`);
        }
      }
    }

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in value) {
        violations.push(
          ...validateNode(value[key], propSchema, `${path}.${key}`),
        );
      }
    }
  }

  // Validate first 3 array items against items schema
  if (schema.items && Array.isArray(value)) {
    const sample = value.slice(0, 3);
    sample.forEach((item, i) => {
      violations.push(...validateNode(item, schema.items, `${path}[${i}]`));
    });
  }

  if (schema.enum && !schema.enum.includes(value)) {
    violations.push(
      `${path}: expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`,
    );
  }

  if (typeof value === "string") {
    if (Number.isFinite(schema.minLength) && value.length < schema.minLength) {
      violations.push(
        `${path}: expected minLength ${schema.minLength}, got ${value.length}`,
      );
    }
    if (Number.isFinite(schema.maxLength) && value.length > schema.maxLength) {
      violations.push(
        `${path}: expected maxLength ${schema.maxLength}, got ${value.length}`,
      );
    }
  }

  if (typeof value === "number") {
    if (Number.isFinite(schema.minimum) && value < schema.minimum) {
      violations.push(`${path}: expected minimum ${schema.minimum}, got ${value}`);
    }
    if (Number.isFinite(schema.maximum) && value > schema.maximum) {
      violations.push(`${path}: expected maximum ${schema.maximum}, got ${value}`);
    }
  }

  return violations;
}

function validate(body, schemaName, context) {
  const schema = SCHEMAS[schemaName];
  if (!schema) {
    return { ok: false, violations: [`Schema "${schemaName}" not found`] };
  }
  let parsed;
  try {
    parsed = typeof body === "string" ? JSON.parse(body) : body;
  } catch {
    return {
      ok: false,
      violations: [`${context}: response body is not valid JSON`],
    };
  }
  const violations = validateNode(parsed, schema, context);
  return { ok: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// HTTP request helper
// ---------------------------------------------------------------------------

function request(options, body = null) {
  return new Promise((resolve) => {
    const lib = options.protocol === "https:" ? https : http;
    const startMs = Date.now();

    const req = lib.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        const latencyMs = Date.now() - startMs;
        resolve({ status: res.statusCode, body: raw, latencyMs, error: null });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({
        status: 0,
        body: "",
        latencyMs: timeoutMs,
        error: `Timeout after ${timeoutMs}ms`,
      });
    });

    req.on("error", (err) => {
      resolve({
        status: 0,
        body: "",
        latencyMs: Date.now() - startMs,
        error: err.message,
      });
    });

    if (body) req.write(body);
    req.end();
  });
}

function makeOptions(port, method, urlPath, extraHeaders = {}) {
  return {
    hostname: "127.0.0.1",
    port,
    method,
    path: urlPath,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extraHeaders,
    },
  };
}

// ---------------------------------------------------------------------------
// Admin token helper (mirrors critical-parity-check.js)
// ---------------------------------------------------------------------------

async function getAdminToken(port) {
  const body = JSON.stringify({
    username: adminUser,
    password: adminPassword,
  });
  const opts = makeOptions(port, "POST", "/api/auth/login");
  opts.headers["Content-Length"] = Buffer.byteLength(body);
  const res = await request(opts, body);
  if (res.error || res.status !== 200) return null;
  try {
    const parsed = JSON.parse(res.body);
    return parsed.token || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Contract check definitions
// ---------------------------------------------------------------------------

/**
 * Each check:
 *   name        — display name
 *   method      — HTTP method
 *   path        — URL path (function receives port, returns path string)
 *   body        — optional POST body string
 *   schema      — schema key from SCHEMAS map
 *   adminOnly   — if true, skipped when withAdmin is false; requires auth header
 *   expectStatus— expected HTTP status code (default 200)
 */

const PUBLIC_CHECKS = [
  {
    name: "GET /api/search?q=test → search-response",
    method: "GET",
    path: "/api/search?q=contract-test",
    schema: "search-response",
  },
  {
    name: "POST /api/assistant/chat → assistant-response",
    method: "POST",
    path: "/api/assistant/chat",
    body: JSON.stringify({ message: "contract-test" }),
    schema: "assistant-response",
  },
  {
    name: "POST /api/assistant/chat with empty message → error-response",
    method: "POST",
    path: "/api/assistant/chat",
    body: JSON.stringify({ message: "" }),
    schema: "error-response",
    expectStatus: 400,
  },
  {
    name: "GET /api/search without q → error-response",
    method: "GET",
    path: "/api/search",
    schema: "error-response",
    expectStatus: 400,
  },
  {
    name: "GET /api/admin/overview without token → error-response",
    method: "GET",
    path: "/api/admin/overview",
    schema: "error-response",
    expectStatus: 401,
  },
];

const ADMIN_CHECKS = [
  {
    name: "GET /api/admin/overview → admin-metrics-response",
    method: "GET",
    path: "/api/admin/overview",
    schema: "admin-metrics-response",
    adminOnly: true,
  },
];

const REQUEST_SCHEMA_CHECKS = [
  {
    name: "search-request valid fixture",
    schema: "search-request",
    payload: { q: "contract-test", page: 1, limit: 5 },
    expectValid: true,
  },
  {
    name: "search-request missing q",
    schema: "search-request",
    payload: { page: 1 },
    expectValid: false,
  },
  {
    name: "assistant-request valid fixture",
    schema: "assistant-request",
    payload: { message: "contract-test" },
    expectValid: true,
  },
  {
    name: "assistant-request empty message",
    schema: "assistant-request",
    payload: { message: "" },
    expectValid: false,
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function targetLabel(port) {
  if (port === nodePort) return "node";
  if (port === djangoPort) return "django";
  return `port:${port}`;
}

function runRequestSchemaChecks() {
  return REQUEST_SCHEMA_CHECKS.map((check) => {
    const { ok, violations } = validate(
      check.payload,
      check.schema,
      `request:${check.name}`,
    );
    const contractPassed = check.expectValid ? ok : !ok;

    return {
      name: check.name,
      backend: "local",
      status: contractPassed ? "pass" : "fail",
      contractPassed,
      violations,
      latencyMs: 0,
      httpStatus: null,
      schema: check.schema,
      expectation: check.expectValid ? "valid" : "invalid",
    };
  });
}

async function runChecksForTarget(port, authToken) {
  const checks = [
    ...PUBLIC_CHECKS,
    ...(shouldRunAdminChecks ? ADMIN_CHECKS : []),
  ];
  const results = [];

  for (const check of checks) {
    if (check.adminOnly && !authToken) {
      results.push({
        name: check.name,
        backend: targetLabel(port),
        status: "error",
        reason: "Admin login failed",
        contractPassed: false,
        violations: [],
        latencyMs: 0,
      });
      continue;
    }

    const headers = {};
    if (check.adminOnly && authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    if (check.body) {
      headers["Content-Length"] = Buffer.byteLength(check.body);
    }

    const opts = makeOptions(port, check.method, check.path, headers);
    const res = await request(opts, check.body || null);

    if (res.error) {
      results.push({
        name: check.name,
        backend: targetLabel(port),
        status: "error",
        reason: res.error,
        contractPassed: false,
        violations: [],
        latencyMs: res.latencyMs,
      });
      continue;
    }

    const expectedStatus = check.expectStatus || 200;
    if (res.status !== expectedStatus) {
      results.push({
        name: check.name,
        backend: targetLabel(port),
        status: "wrong-status",
        reason: `Expected HTTP ${expectedStatus}, got ${res.status}`,
        contractPassed: false,
        violations: [],
        latencyMs: res.latencyMs,
        httpStatus: res.status,
      });
      continue;
    }

    const ctx = `${targetLabel(port)}:${check.path}`;
    const { ok, violations } = validate(res.body, check.schema, ctx);

    results.push({
      name: check.name,
      backend: targetLabel(port),
      status: ok ? "pass" : "fail",
      contractPassed: ok,
      violations,
      latencyMs: res.latencyMs,
      httpStatus: res.status,
      schema: check.schema,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const targets = [];
  if (includeNode) targets.push({ port: nodePort, label: "node" });
  if (includeDjango) targets.push({ port: djangoPort, label: "django" });

  const allResults = [];
  const gateFindings = [];
  const schemaLoadErrors = Object.entries(SCHEMAS)
    .filter(([, s]) => s === null)
    .map(([k]) => `Schema "${k}" failed to load`);

  if (requireAdmin && !hasAdminCredentials) {
    gateFindings.push(
      "Admin credentials missing while --require-admin is enabled.",
    );
  }

  allResults.push(...runRequestSchemaChecks());

  for (const target of targets) {
    let authToken = null;
    if (shouldRunAdminChecks) {
      authToken = await getAdminToken(target.port);
      if (!authToken && !jsonMode) {
        process.stderr.write(
          `[contract-validation] Warning: could not get admin token for ${target.label} (port ${target.port})\n`,
        );
      }
    }
    const results = await runChecksForTarget(target.port, authToken);
    allResults.push(...results);
  }

  // Aggregate
  const total = allResults.length;
  const passed = allResults.filter((r) => r.contractPassed).length;
  const failed = allResults.filter((r) => !r.contractPassed).length;
  const failures = allResults.filter((r) => !r.contractPassed);
  const contractsPassed =
    failed === 0 && schemaLoadErrors.length === 0 && gateFindings.length === 0;
  const goNoGo = contractsPassed ? "GO" : "NO-GO";

  const report = {
    label,
    generatedAt: new Date().toISOString(),
    apiTarget,
    withAdmin,
    requireAdmin,
    adminChecksEnabled: shouldRunAdminChecks,
    goNoGo,
    contractsPassed,
    summary: {
      total,
      passed,
      failed,
      schemaLoadErrors: schemaLoadErrors.length,
      gateFindings: gateFindings.length,
    },
    schemaLoadErrors,
    gateFindings,
    failures: failures.map((f) => ({
      name: f.name,
      backend: f.backend,
      status: f.status,
      reason: f.reason || null,
      violations: f.violations,
      httpStatus: f.httpStatus || null,
    })),
    results: allResults,
  };

  // Output
  if (jsonMode) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const line = (s) => process.stdout.write(s + "\n");
    line("");
    line("╔══════════════════════════════════════════╗");
    line("║       CONTRACT VALIDATION REPORT         ║");
    line("╚══════════════════════════════════════════╝");
    line("");
    line(`  Target:     ${apiTarget.toUpperCase()}`);
    line(`  Admin:      ${withAdmin ? "yes" : "no"}`);
    line(`  Generated:  ${report.generatedAt}`);
    line("");
    line(`  Total checks:  ${total}`);
    line(`  Passed:        ${passed}`);
    line(`  Failed:        ${failed}`);
    if (schemaLoadErrors.length > 0) {
      line(`  Schema errors: ${schemaLoadErrors.length}`);
      schemaLoadErrors.forEach((e) => line(`    - ${e}`));
    }
    line("");

    for (const r of allResults) {
      const icon = r.contractPassed
        ? "✅"
        : r.status === "skipped"
          ? "⏭ "
          : "❌";
      const latency = r.latencyMs ? ` (${r.latencyMs}ms)` : "";
      line(`  ${icon}  [${r.backend}] ${r.name}${latency}`);
      if (!r.contractPassed && r.reason) {
        line(`       Reason: ${r.reason}`);
      }
      if (r.violations && r.violations.length > 0) {
        r.violations.forEach((v) => line(`       Violation: ${v}`));
      }
    }

    line("");
    line(`  ══════════════════════════════════════════`);
    line(`  GO / NO-GO:  ${goNoGo}`);
    line(`  ══════════════════════════════════════════`);
    line("");
  }

  // Save report
  const shouldSave = saveReport || outPath;
  if (shouldSave) {
    const savePath = outPath
      ? path.resolve(ROOT, outPath)
      : path.join(
          ROOT,
          "data",
          "backups",
          "contract",
          `${label}-${Date.now()}.json`,
        );
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(savePath, JSON.stringify(report, null, 2), "utf8");
    if (!jsonMode) {
      process.stdout.write(`  Report saved to: ${savePath}\n\n`);
    }
  }

  process.exit(contractsPassed ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`[contract-validation] Fatal: ${err.message}\n`);
  process.exit(2);
});
