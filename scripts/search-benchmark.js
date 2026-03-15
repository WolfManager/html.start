const BASE_URL = process.env.MAGNETO_BASE_URL || "http://localhost:3000";

const CASES = [
  {
    name: "typo-python",
    query: "pythn",
    expectAnyTitleIncludes: ["python"],
    minResults: 3,
  },
  {
    name: "intent-news",
    query: "news",
    expectAnyCategory: ["News", "Technology", "Media"],
    minResults: 5,
  },
  {
    name: "intent-jobs",
    query: "remote jobs",
    expectAnyCategory: ["Career"],
    minResults: 2,
  },
  {
    name: "intent-docs",
    query: "api documentation",
    expectAnyTitleIncludes: ["documentation", "docs", "api"],
    minResults: 3,
  },
  {
    name: "domain-data",
    query: "database indexing",
    expectAnyCategory: ["Database", "Development"],
    minResults: 3,
  },
];

function normalize(value) {
  return String(value || "").toLowerCase();
}

function includesAny(haystack, needles) {
  const text = normalize(haystack);
  return needles.some((needle) => text.includes(normalize(needle)));
}

async function runCase(testCase) {
  const url = `${BASE_URL}/api/search?q=${encodeURIComponent(testCase.query)}&limit=10&page=1&sort=relevance`;
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  const latencyMs = Date.now() - startedAt;
  const payload = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      reason: `HTTP ${response.status}: ${payload.error || "unknown error"}`,
      latencyMs,
      payload,
    };
  }

  const results = Array.isArray(payload.results) ? payload.results : [];
  if (results.length < (testCase.minResults || 1)) {
    return {
      ok: false,
      reason: `Expected at least ${testCase.minResults} results, got ${results.length}`,
      latencyMs,
      payload,
    };
  }

  if (Array.isArray(testCase.expectAnyTitleIncludes)) {
    const titleOk = results.some((item) =>
      includesAny(item.title, testCase.expectAnyTitleIncludes),
    );
    if (!titleOk) {
      return {
        ok: false,
        reason: `No title matched expected keywords: ${testCase.expectAnyTitleIncludes.join(", ")}`,
        latencyMs,
        payload,
      };
    }
  }

  if (Array.isArray(testCase.expectAnyCategory)) {
    const categoryOk = results.some((item) =>
      testCase.expectAnyCategory.includes(String(item.category || "")),
    );
    if (!categoryOk) {
      return {
        ok: false,
        reason: `No result category matched expected set: ${testCase.expectAnyCategory.join(", ")}`,
        latencyMs,
        payload,
      };
    }
  }

  return {
    ok: true,
    latencyMs,
    payload,
  };
}

(async () => {
  let failures = 0;

  console.log(`MAGNETO search benchmark against ${BASE_URL}`);
  console.log("=".repeat(60));

  for (const testCase of CASES) {
    try {
      const result = await runCase(testCase);
      if (!result.ok) {
        failures += 1;
        console.log(`FAIL ${testCase.name} (${result.latencyMs}ms)`);
        console.log(`  query: ${testCase.query}`);
        console.log(`  reason: ${result.reason}`);
        continue;
      }

      const topTitles = (result.payload.results || [])
        .slice(0, 3)
        .map((item) => item.title)
        .join(" | ");
      console.log(`OK   ${testCase.name} (${result.latencyMs}ms)`);
      console.log(`  query: ${testCase.query}`);
      console.log(`  top:   ${topTitles}`);
    } catch (error) {
      failures += 1;
      console.log(`FAIL ${testCase.name}`);
      console.log(`  query: ${testCase.query}`);
      console.log(`  error: ${String(error.message || error)}`);
    }
  }

  console.log("=".repeat(60));
  if (failures > 0) {
    console.error(`Benchmark finished with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("Benchmark finished successfully.");
})();
