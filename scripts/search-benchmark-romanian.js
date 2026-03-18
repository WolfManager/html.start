const BASE_URL = process.env.MAGNETO_BASE_URL || "http://localhost:3000";

const CASES = [
  {
    name: "intent-news-ro",
    query: "ultimele stiri",
    expectAnyCategory: ["News", "Technology", "Media"],
    minResults: 3,
    description: "Romanian: Latest news",
  },
  {
    name: "intent-jobs-ro",
    query: "joburi remote",
    expectAnyCategory: ["Career", "Development"],
    minResults: 2,
    description: "Romanian: Remote jobs",
  },
  {
    name: "intent-docs-ro",
    query: "ghid python",
    expectAnyTitleIncludes: ["python", "guide", "documentation", "tutorial"],
    minResults: 1,
    description: "Romanian: Python guide",
  },
  {
    name: "technology-ro",
    query: "baze de date indexare",
    expectAnyTitleIncludes: ["database", "indexing", "index", "sql"],
    minResults: 1,
    description: "Romanian: Database indexing",
  },
  {
    name: "intent-tutorial-ro",
    query: "tutorial javascript",
    expectAnyTitleIncludes: ["javascript", "tutorial", "guide"],
    minResults: 1,
    description: "Romanian: JavaScript tutorial",
  },
  {
    name: "longtail-news-ro",
    query: "ultimele stiri ai azi",
    expectAnyCategory: ["News", "Technology", "Media"],
    minResults: 1,
    description: "Romanian long-tail: latest AI news today",
  },
  {
    name: "longtail-learning-ro",
    query: "curs programare javascript pentru incepatori",
    expectAnyCategory: ["Education", "Development", "AI"],
    minResults: 1,
    description: "Romanian long-tail: programming course for beginners",
  },
  {
    name: "longtail-research-ro",
    query: "cercetare ai",
    expectAnyCategory: ["Research", "AI", "Technology"],
    minResults: 1,
    description: "Romanian long-tail: AI research",
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

  // For permissive tests (minResults=0), accept any response
  if (testCase.minResults === 0) {
    return {
      ok: true,
      latencyMs,
      payload,
    };
  }

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

  console.log(`MAGNETO Romanian search benchmark against ${BASE_URL}`);
  console.log("=".repeat(70));

  for (const testCase of CASES) {
    try {
      const result = await runCase(testCase);
      if (!result.ok) {
        failures += 1;
        console.log(`FAIL ${testCase.name} (${result.latencyMs}ms)`);
        console.log(`  query: "${testCase.query}"`);
        console.log(`  desc:  ${testCase.description}`);
        console.log(`  reason: ${result.reason}`);
        continue;
      }

      const topTitles = (result.payload.results || [])
        .slice(0, 3)
        .map((item) => item.title)
        .join(" | ");
      const totalResults = result.payload.results?.length || 0;
      console.log(
        `OK   ${testCase.name} (${result.latencyMs}ms, ${totalResults} results)`,
      );
      console.log(`  query: "${testCase.query}"`);
      console.log(`  desc:  ${testCase.description}`);
      if (topTitles) {
        console.log(`  top:   ${topTitles}`);
      }
    } catch (error) {
      failures += 1;
      console.log(`FAIL ${testCase.name}`);
      console.log(`  query: "${testCase.query}"`);
      console.log(`  error: ${String(error.message || error)}`);
    }
  }

  console.log("=".repeat(70));
  if (failures > 0) {
    console.error(`Romanian benchmark finished with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("Romanian benchmark finished successfully.");
})();
