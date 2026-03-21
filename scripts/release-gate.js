const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const isJsonOutput = process.argv.includes("--json");
const withAdminChecks = process.argv.includes("--with-admin");
const saveReport = process.argv.includes("--save-report");
const outArg = process.argv.find((arg) => String(arg).startsWith("--out="));
const labelArg = process.argv.find((arg) => String(arg).startsWith("--label="));
const reportLabel = labelArg
  ? String(labelArg).slice("--label=".length).trim()
  : "";

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
    "release-gate",
    `release-gate-${stamp}.json`,
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

function log(message) {
  if (!isJsonOutput) {
    console.log(message);
  }
}

function runNpmScript(scriptName) {
  return new Promise((resolve) => {
    const command = `npm run ${scriptName}`;
    const startedAt = Date.now();

    const child = spawn(command, [], {
      cwd: process.cwd(),
      env: process.env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk || "");
      stdout += text;
      if (!isJsonOutput) {
        process.stdout.write(text);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk || "");
      stderr += text;
      if (!isJsonOutput) {
        process.stderr.write(text);
      }
    });

    child.on("error", (error) => {
      resolve({
        scriptName,
        ok: false,
        exitCode: 1,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}\n${String(error?.message || error)}`,
      });
    });

    child.on("close", (code) => {
      resolve({
        scriptName,
        ok: code === 0,
        exitCode: Number(code || 0),
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
  });
}

function buildPlan() {
  if (withAdminChecks) {
    return [
      "health:check:gate:all",
      "health:check:gate:all:admin",
      "parity:critical:gate",
      "parity:critical:gate:admin",
    ];
  }

  return ["health:check:gate:all", "parity:critical:gate"];
}

async function main() {
  const plan = buildPlan();
  log("Running release gate workflow...");
  log(`Mode: ${withAdminChecks ? "public+admin" : "public"}`);

  const results = [];
  for (const scriptName of plan) {
    log(`\n--- Running ${scriptName} ---`);
    const result = await runNpmScript(scriptName);
    results.push(result);

    if (!result.ok) {
      log(`\nGate step failed: ${scriptName} (exit=${result.exitCode})`);
      break;
    }
  }

  const passedSteps = results.filter((item) => item.ok).length;
  const failedStep = results.find((item) => !item.ok) || null;
  const report = {
    generatedAt: new Date().toISOString(),
    label: reportLabel || null,
    mode: withAdminChecks ? "public+admin" : "public",
    stepsTotal: plan.length,
    stepsExecuted: results.length,
    stepsPassed: passedSteps,
    stepsFailed: results.length - passedSteps,
    failedStep: failedStep
      ? {
          script: failedStep.scriptName,
          exitCode: failedStep.exitCode,
          durationMs: failedStep.durationMs,
        }
      : null,
    goNoGo: failedStep ? "NO-GO" : "GO",
    passed: !failedStep,
    results: results.map((item) => ({
      script: item.scriptName,
      ok: item.ok,
      exitCode: item.exitCode,
      durationMs: item.durationMs,
    })),
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
    log("\n====================");
    log(`Release Gate: ${report.goNoGo}`);
    log(
      `Steps passed: ${report.stepsPassed}/${report.stepsTotal} (executed ${report.stepsExecuted})`,
    );
    if (report.failedStep) {
      log(
        `Failed step: ${report.failedStep.script} (exit=${report.failedStep.exitCode})`,
      );
    }
  }

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = String(error?.message || error);
  if (isJsonOutput) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          goNoGo: "NO-GO",
          passed: false,
          crash: message,
        },
        null,
        2,
      ),
    );
  } else {
    console.error("Release gate crashed:", message);
  }
  process.exitCode = 1;
});
