const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");

const dataFiles = [
  "data/analytics.json",
  "data/assistant-memory.json",
  "data/index-sync-state.json",
  "data/routing-state.json",
  "data/search-index.json",
  "data/search-ranking-config.json",
];

function runCommand(command, args, envOverrides = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  if (typeof result.status === "number") {
    return result.status;
  }

  return 1;
}

function validateJsonFiles() {
  let ok = true;

  console.log("[verify] Checking JSON data files...");
  for (const relativePath of dataFiles) {
    const absolutePath = path.join(rootDir, relativePath);
    try {
      const raw = fs.readFileSync(absolutePath, "utf8");
      JSON.parse(raw);
      console.log(`[verify] OK ${relativePath}`);
    } catch (error) {
      ok = false;
      console.error(
        `[verify] FAIL ${relativePath}: ${String(error && error.message ? error.message : error)}`,
      );
    }
  }

  return ok;
}

function main() {
  const latencyGateMs = String(
    process.env.MAGNETO_VERIFY_MAX_LATENCY_MS || "",
  ).trim();

  if (!validateJsonFiles()) {
    console.error("[verify] JSON integrity check failed.");
    process.exit(1);
  }

  const healthArgs = ["scripts/health-check.js", "--json", "--require-admin"];

  if (latencyGateMs) {
    healthArgs.push(`--max-latency-ms=${latencyGateMs}`);
    console.log(
      `[verify] Running health gate (max latency ${latencyGateMs}ms)...`,
    );
  } else {
    console.log(
      "[verify] Running health gate (latency gate disabled by default)...",
    );
  }

  let code = runCommand("node", healthArgs);
  if (code !== 0) {
    process.exit(code);
  }

  console.log("[verify] Running strict Node vs Django parity check...");
  code = runCommand("node", ["scripts/search-parity-check.js"], {
    PARITY_MODE: "strict",
  });
  if (code !== 0) {
    process.exit(code);
  }

  console.log("[verify] Post-update verification passed.");
}

main();
