console.log("\n" + "=".repeat(70));
console.log("MAGNETO SYSTEM VALIDATION - All Benchmarks");
console.log("=".repeat(70));

async function runTests() {
  const { spawn } = require("child_process");
  const DEFAULT_TIMEOUT_MS = 90000;

  function runScript(
    script,
    label,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    envOverrides = {},
  ) {
    return new Promise((resolve) => {
      const proc = spawn("node", [script], {
        env: {
          ...process.env,
          ...envOverrides,
        },
      });
      let output = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill();
        } catch {
          // Ignore process kill errors.
        }
      }, timeoutMs);

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        // Extract summary line
        const lines = output.split("\n");
        const summaryLine = lines.find(
          (line) =>
            line.includes("finished successfully") || line.includes("failure"),
        );

        console.log(`\n${label}:`);
        if (timedOut) {
          console.log(`  Timed out after ${timeoutMs}ms`);
        }
        if (summaryLine) {
          console.log(`  ${summaryLine.trim()}`);
        }
        console.log(`  Exit code: ${code}`);
        if (code !== 0 && stderr.trim()) {
          console.log(`  Error: ${stderr.trim().split("\n").slice(-1)[0]}`);
        }

        let passCount = 0;
        for (const line of lines) {
          if (line.trim().startsWith("OK ")) passCount += 1;
        }
        if (passCount > 0) {
          const totalMatches = lines.filter((l) =>
            l.trim().match(/^(OK|FAIL) /),
          ).length;
          console.log(`  Passed: ${passCount}/${totalMatches}`);
        }
        resolve(!timedOut && code === 0);
      });
    });
  }

  const results = [];
  results.push(
    await runScript("scripts/search-benchmark.js", "English Search"),
  );
  results.push(
    await runScript("scripts/search-benchmark-romanian.js", "Romanian Search"),
  );
  results.push(
    await runScript(
      "scripts/assistant-benchmark.js",
      "Assistant Routing",
      120000,
    ),
  );
  results.push(
    await runScript(
      "scripts/search-parity-check.js",
      "Search Parity (strict)",
      60000,
      {
        PARITY_MODE: "strict",
      },
    ),
  );

  console.log("\n" + "=".repeat(70));
  const allPass = results.every((r) => r);
  if (allPass) {
    console.log("✅ ALL BENCHMARKS PASSED");
  } else {
    console.log("❌ SOME BENCHMARKS FAILED");
  }
  console.log("=".repeat(70) + "\n");

  process.exit(allPass ? 0 : 1);
}

runTests();
