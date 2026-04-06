const BASE_URL = process.env.MAGNETO_BASE_URL || "http://localhost:3000";

const CASES = [
  {
    name: "local-trivial",
    message: "health check",
    acceptedProviders: ["local-hybrid", "ollama", "cache", "fallback"],
    maxLatencyMs: 12000,
  },
  {
    name: "weather-live",
    message: "weather now in Bucharest",
    acceptedProviders: ["weather-live", "cache", "fallback"],
    maxLatencyMs: 5000,
  },
  {
    name: "writing-ai",
    message: "write a short follow-up email after a project meeting",
    acceptedProviders: [
      "openai",
      "anthropic",
      "gemini",
      "ollama",
      "cache",
      "fallback",
    ],
    maxLatencyMs: 12000,
  },
  {
    name: "general-ai",
    message:
      "Explain quantum computing simply and compare it with classical computing in 3 short bullets.",
    acceptedProviders: [
      "local-hybrid",
      "openai",
      "anthropic",
      "gemini",
      "ollama",
      "cache",
      "fallback",
    ],
    maxLatencyMs: 12000,
  },
];

async function runCase(testCase) {
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}/api/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      message: testCase.message,
      history: [],
    }),
  });
  const latencyMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      latencyMs,
      reason: `HTTP ${response.status}: ${payload.error || "unknown error"}`,
      payload,
    };
  }

  const provider = String(payload.provider || "unknown")
    .trim()
    .toLowerCase();
  const reply = String(payload.reply || "").trim();
  const acceptedProviders = Array.isArray(testCase.acceptedProviders)
    ? testCase.acceptedProviders.map((item) =>
        String(item).trim().toLowerCase(),
      )
    : [];

  if (!reply) {
    return {
      ok: false,
      latencyMs,
      reason: "Assistant returned an empty reply.",
      payload,
    };
  }

  if (acceptedProviders.length > 0 && !acceptedProviders.includes(provider)) {
    return {
      ok: false,
      latencyMs,
      reason: `Unexpected provider: ${provider}. Expected one of ${acceptedProviders.join(", ")}`,
      payload,
    };
  }

  if (
    Number.isFinite(Number(testCase.maxLatencyMs)) &&
    latencyMs > Number(testCase.maxLatencyMs)
  ) {
    return {
      ok: false,
      latencyMs,
      reason: `Latency ${latencyMs}ms exceeded limit ${testCase.maxLatencyMs}ms.`,
      payload,
    };
  }

  return {
    ok: true,
    latencyMs,
    payload,
  };
}

(async () => {
  let failures = 0;

  console.log(`MAGNETO assistant benchmark against ${BASE_URL}`);
  console.log("=".repeat(60));

  for (const testCase of CASES) {
    try {
      const result = await runCase(testCase);
      if (!result.ok) {
        failures += 1;
        console.log(`FAIL ${testCase.name} (${result.latencyMs}ms)`);
        console.log(`  message: ${testCase.message}`);
        console.log(`  reason: ${result.reason}`);
        continue;
      }

      const provider = String(result.payload.provider || "unknown");
      const model = String(result.payload.model || "unknown");
      const preview = String(result.payload.reply || "")
        .replace(/\s+/g, " ")
        .slice(0, 80);
      console.log(`OK   ${testCase.name} (${result.latencyMs}ms)`);
      console.log(`  provider: ${provider}`);
      console.log(`  model:    ${model}`);
      console.log(`  reply:    ${preview}`);
    } catch (error) {
      failures += 1;
      console.log(`FAIL ${testCase.name}`);
      console.log(`  message: ${testCase.message}`);
      console.log(`  error: ${String(error.message || error)}`);
    }
  }

  console.log("=".repeat(60));
  if (failures > 0) {
    console.error(`Assistant benchmark finished with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("Assistant benchmark finished successfully.");
})();
