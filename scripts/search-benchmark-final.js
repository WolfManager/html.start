const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.MAGNETO_BASE_URL || "http://localhost:3000";
const DEFAULT_OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "data",
  "backups",
  "benchmarks",
  "latest-search-final-benchmark.json",
);

const CASES = [
  {
    name: "intent-docs-en",
    category: "intent",
    query: "api documentation",
    description:
      "Documentation intent should surface docs/API-oriented results.",
    minResults: 3,
    expectAnyTitleIncludes: ["documentation", "docs", "api"],
  },
  {
    name: "intent-jobs-en",
    category: "intent",
    query: "remote jobs",
    description: "Career intent should produce job-oriented results.",
    minResults: 2,
    expectAnyCategory: ["Career"],
  },
  {
    name: "typo-openai-en",
    category: "typo",
    query: "opnai",
    description: "Common typo should still recover OpenAI-related results.",
    minResults: 1,
    expectAnyTitleIncludes: ["openai"],
    expectTopSourceCoverage: {
      topN: 3,
      sources: ["openai.com", "chat.openai.com", "platform.openai.com"],
      minCount: 3,
    },
  },
  {
    name: "operator-intitle-en",
    category: "operator",
    query: "intitle:documentation api",
    description: "Operator parsing should still surface documentation results.",
    minResults: 1,
    expectAnyTitleIncludes: ["documentation", "docs", "api"],
  },
  {
    name: "operator-site-en",
    category: "operator",
    query: "ai site:openai.com",
    description:
      "Site operator should preserve intent toward OpenAI documents.",
    minResults: 3,
    expectAnyTitleIncludes: ["openai"],
    expectTopSourceCoverage: {
      topN: 3,
      sources: ["openai.com", "chat.openai.com", "platform.openai.com"],
      minCount: 3,
    },
  },
  {
    name: "ambiguous-news-en",
    category: "ambiguous",
    query: "news",
    description:
      "Ambiguous generic query should still surface acceptable news/media results.",
    minResults: 5,
    expectAnyCategory: ["News", "Technology", "Media"],
  },
  {
    name: "domain-data-en",
    category: "domain",
    query: "database indexing",
    description:
      "Technical domain query should surface development or database content.",
    minResults: 3,
    expectAnyCategory: ["Database", "Development"],
  },
  {
    name: "intent-news-ro",
    category: "romanian-intent",
    query: "ultimele stiri",
    description:
      "Romanian news query should map to relevant news/media results.",
    minResults: 3,
    expectAnyCategory: ["News", "Technology", "Media"],
  },
  {
    name: "intent-jobs-ro",
    category: "romanian-intent",
    query: "joburi remote",
    description: "Romanian jobs query should surface career-oriented results.",
    minResults: 2,
    expectAnyCategory: ["Career", "Development"],
  },
  {
    name: "longtail-news-ro",
    category: "long-tail",
    query: "ultimele stiri ai azi",
    description:
      "Romanian long-tail news query should still produce relevant non-zero results.",
    minResults: 1,
    expectAnyCategory: ["News", "Technology", "Media"],
    expectTopCategoryCoverage: {
      topN: 3,
      categories: ["News", "Technology", "Media"],
      minCount: 3,
    },
    expectTopSourceCoverage: {
      topN: 3,
      sources: ["bbc.com", "reuters.com", "theguardian.com", "techcrunch.com"],
      minCount: 2,
    },
  },
  {
    name: "longtail-learning-ro",
    category: "long-tail",
    query: "curs programare javascript pentru incepatori",
    description:
      "Romanian long-tail learning query should surface educational/development results.",
    minResults: 8,
    expectAnyCategory: ["Education", "Development", "AI"],
    expectTopCategoryCoverage: {
      topN: 6,
      categories: ["Education", "Development"],
      minCount: 4,
    },
  },
  {
    name: "longtail-search-quality-ro",
    category: "long-tail",
    query:
      "cum optimizez cautarea full text intr-un site cu ranking personalizat",
    description:
      "Previously problematic long-tail technical query must no longer return zero results.",
    minResults: 1,
    expectQueryUsedIncludes: ["search", "full", "text", "custom"],
    expectCorrectionReason: "zero-results-refinement",
  },
  {
    name: "ambiguous-research-ro",
    category: "ambiguous",
    query: "cercetare ai",
    description:
      "Short Romanian research query should remain coherent and non-empty.",
    minResults: 1,
    expectAnyCategory: ["Research", "AI", "Technology"],
    expectTopCategoryCoverage: {
      topN: 3,
      categories: ["Research", "Science"],
      minCount: 2,
    },
    expectTopSourceCoverage: {
      topN: 5,
      sources: [
        "arxiv.org",
        "semanticscholar.org",
        "scholar.google.com",
        "pubmed.ncbi.nlm.nih.gov",
        "nature.com",
        "sciencedirect.com",
      ],
      minCount: 3,
    },
  },
];

function parseArgs(argv) {
  const options = {
    saveReport: false,
    outPath: "",
    label: "",
    json: false,
  };

  argv.forEach((arg) => {
    if (arg === "--save-report") {
      options.saveReport = true;
      return;
    }
    if (arg === "--json") {
      options.json = true;
      return;
    }
    if (arg.startsWith("--out=")) {
      options.outPath = arg.slice("--out=".length).trim();
      return;
    }
    if (arg.startsWith("--label=")) {
      options.label = arg.slice("--label=".length).trim();
    }
  });

  return options;
}

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
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      latencyMs,
      reason: `HTTP ${response.status}: ${payload.error || "unknown error"}`,
      queryUsed: String(payload.queryUsed || "").trim(),
      correctionReason: String(payload.queryCorrection?.reason || "").trim(),
      topTitles: [],
      resultCount: 0,
    };
  }

  const results = Array.isArray(payload.results) ? payload.results : [];
  const queryUsed = String(payload.queryUsed || "").trim();
  const correctionReason = String(payload.queryCorrection?.reason || "").trim();
  const topTitles = results
    .slice(0, 3)
    .map((item) => String(item.title || "").trim())
    .filter(Boolean);

  if (results.length < (testCase.minResults || 1)) {
    return {
      ok: false,
      latencyMs,
      reason: `Expected at least ${testCase.minResults} results, got ${results.length}`,
      queryUsed,
      correctionReason,
      topTitles,
      resultCount: results.length,
    };
  }

  if (Array.isArray(testCase.expectAnyTitleIncludes)) {
    const titleOk = results.some((item) =>
      includesAny(item.title, testCase.expectAnyTitleIncludes),
    );
    if (!titleOk) {
      return {
        ok: false,
        latencyMs,
        reason: `No title matched expected keywords: ${testCase.expectAnyTitleIncludes.join(", ")}`,
        queryUsed,
        correctionReason,
        topTitles,
        resultCount: results.length,
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
        latencyMs,
        reason: `No result category matched expected set: ${testCase.expectAnyCategory.join(", ")}`,
        queryUsed,
        correctionReason,
        topTitles,
        resultCount: results.length,
      };
    }
  }

  if (testCase.expectTopCategoryCoverage) {
    const topN = Math.max(
      1,
      Number.parseInt(String(testCase.expectTopCategoryCoverage.topN || 3), 10),
    );
    const allowedCategories = Array.isArray(
      testCase.expectTopCategoryCoverage.categories,
    )
      ? testCase.expectTopCategoryCoverage.categories
      : [];
    const minCount = Math.max(
      1,
      Number.parseInt(
        String(testCase.expectTopCategoryCoverage.minCount || 1),
        10,
      ),
    );

    const topSlice = results.slice(0, topN);
    const matchingCount = topSlice.filter((item) =>
      allowedCategories.includes(String(item.category || "")),
    ).length;

    if (matchingCount < minCount) {
      return {
        ok: false,
        latencyMs,
        reason: `Top-${topN} category coverage check failed: expected at least ${minCount} in [${allowedCategories.join(", ")}], got ${matchingCount}`,
        queryUsed,
        correctionReason,
        topTitles,
        resultCount: results.length,
      };
    }
  }

  if (testCase.expectTopSourceCoverage) {
    const topN = Math.max(
      1,
      Number.parseInt(String(testCase.expectTopSourceCoverage.topN || 3), 10),
    );
    const allowedSources = Array.isArray(
      testCase.expectTopSourceCoverage.sources,
    )
      ? testCase.expectTopSourceCoverage.sources.map((item) => normalize(item))
      : [];
    const minCount = Math.max(
      1,
      Number.parseInt(
        String(testCase.expectTopSourceCoverage.minCount || 1),
        10,
      ),
    );

    const topSlice = results.slice(0, topN);
    const matchingCount = topSlice.filter((item) => {
      const sourceName = normalize(item.sourceName || item.sourceSlug || "");
      return allowedSources.some(
        (source) => sourceName === source || sourceName.endsWith(`.${source}`),
      );
    }).length;

    if (matchingCount < minCount) {
      return {
        ok: false,
        latencyMs,
        reason: `Top-${topN} source coverage check failed: expected at least ${minCount} in [${allowedSources.join(", ")}], got ${matchingCount}`,
        queryUsed,
        correctionReason,
        topTitles,
        resultCount: results.length,
      };
    }
  }

  if (Array.isArray(testCase.expectQueryUsedIncludes)) {
    const queryUsedOk = includesAny(
      queryUsed,
      testCase.expectQueryUsedIncludes,
    );
    if (!queryUsedOk) {
      return {
        ok: false,
        latencyMs,
        reason: `queryUsed did not include expected tokens: ${testCase.expectQueryUsedIncludes.join(", ")}`,
        queryUsed,
        correctionReason,
        topTitles,
        resultCount: results.length,
      };
    }
  }

  if (testCase.expectCorrectionReason) {
    if (correctionReason !== testCase.expectCorrectionReason) {
      return {
        ok: false,
        latencyMs,
        reason: `Expected correction reason ${testCase.expectCorrectionReason}, got ${correctionReason || "none"}`,
        queryUsed,
        correctionReason,
        topTitles,
        resultCount: results.length,
      };
    }
  }

  return {
    ok: true,
    latencyMs,
    queryUsed,
    correctionReason,
    topTitles,
    resultCount: results.length,
  };
}

function summarizeByCategory(results) {
  const summary = {};

  for (const result of results) {
    const key = result.category;
    if (!summary[key]) {
      summary[key] = {
        total: 0,
        passed: 0,
        failed: 0,
      };
    }

    summary[key].total += 1;
    if (result.ok) {
      summary[key].passed += 1;
    } else {
      summary[key].failed += 1;
    }
  }

  return summary;
}

function ensureParentDir(filePath) {
  const dirPath = path.dirname(filePath);
  fs.mkdirSync(dirPath, { recursive: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = [];

  for (const testCase of CASES) {
    try {
      const outcome = await runCase(testCase);
      results.push({
        ...testCase,
        ...outcome,
      });
    } catch (error) {
      results.push({
        ...testCase,
        ok: false,
        latencyMs: 0,
        reason: String(error.message || error),
        queryUsed: "",
        correctionReason: "",
        topTitles: [],
        resultCount: 0,
      });
    }
  }

  const failures = results.filter((item) => !item.ok);
  const latencies = results
    .map((item) => item.latencyMs)
    .filter((value) => Number.isFinite(value));
  const report = {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    label: options.label || null,
    baseUrl: BASE_URL,
    baselineCommit: "c8ef790",
    summary: {
      total: results.length,
      passed: results.length - failures.length,
      failed: failures.length,
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
      averageLatencyMs:
        latencies.length > 0
          ? Math.round(
              latencies.reduce((sum, value) => sum + value, 0) /
                latencies.length,
            )
          : 0,
    },
    byCategory: summarizeByCategory(results),
    results,
  };

  if (options.saveReport || options.outPath) {
    const targetPath = options.outPath || DEFAULT_OUTPUT_PATH;
    ensureParentDir(targetPath);
    fs.writeFileSync(
      targetPath,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    report.savedTo = targetPath;
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`MAGNETO final search benchmark against ${BASE_URL}`);
    console.log("=".repeat(72));
    for (const result of report.results) {
      const status = result.ok ? "OK  " : "FAIL";
      console.log(
        `${status} ${result.name} [${result.category}] (${result.latencyMs}ms)`,
      );
      console.log(`  query: ${result.query}`);
      if (result.ok) {
        console.log(
          `  top:   ${result.topTitles.join(" | ") || "(no titles)"}`,
        );
      } else {
        console.log(`  reason: ${result.reason}`);
      }
    }
    console.log("=".repeat(72));
    console.log(
      `Summary: ${report.summary.passed}/${report.summary.total} passed, max ${report.summary.maxLatencyMs}ms, avg ${report.summary.averageLatencyMs}ms`,
    );
    if (report.savedTo) {
      console.log(`Saved report to ${report.savedTo}`);
    }
  }

  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(String(error.message || error));
  process.exit(1);
});
