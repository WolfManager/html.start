const NODE_BASE_URL =
  process.env.MAGNETO_NODE_BASE_URL || "http://localhost:3000";
const DJANGO_BASE_URL =
  process.env.MAGNETO_DJANGO_BASE_URL || "http://localhost:8000";

const PARITY_MODE =
  String(process.env.PARITY_MODE || "strict")
    .trim()
    .toLowerCase() === "compat"
    ? "compat"
    : "strict";

const REQUEST_TIMEOUT_MS = 12000;

const PARITY_RULES =
  PARITY_MODE === "compat"
    ? {
        requireExactQueryUsed: false,
        minTopUrlOverlapForTop3Plus: 1,
        requireSearchCategoryOverlap: false,
        minSuggestOverlapCap: 2,
        requireExactSuggestQuery: false,
        maxSourcesCountDiff: 5,
        minSourceCategoryOverlapFor4Plus: 2,
        requireSourceLanguageOverlap: true,
      }
    : {
        requireExactQueryUsed: true,
        minTopUrlOverlapForTop3Plus: 2,
        requireSearchCategoryOverlap: true,
        minSuggestOverlapCap: 3,
        requireExactSuggestQuery: true,
        maxSourcesCountDiff: 2,
        minSourceCategoryOverlapFor4Plus: 3,
        requireSourceLanguageOverlap: true,
      };

const PARITY_CASES = [
  {
    name: "search-en",
    path: "/api/search?q=api%20documentation&limit=5&page=1&sort=relevance",
    type: "search",
  },
  {
    name: "search-ro-longtail",
    path: "/api/search?q=ultimele%20stiri%20ai%20azi&limit=5&page=1&sort=relevance",
    type: "search",
  },
  {
    name: "suggest",
    path: "/api/search/suggest?q=python&limit=8",
    type: "suggest",
  },
  {
    name: "suggest-short",
    path: "/api/search/suggest?q=py&limit=5",
    type: "suggest",
  },
  {
    name: "suggest-empty",
    path: "/api/search/suggest?q=&limit=5",
    type: "suggest-empty",
  },
  {
    name: "search-tech",
    path: "/api/search?q=machine%20learning&limit=5&page=1&sort=relevance",
    type: "search",
  },
  {
    name: "search-page2",
    path: "/api/search?q=api%20documentation&limit=5&page=2&sort=relevance",
    type: "search-paginated",
    expectedPage: 2,
  },
  {
    name: "search-category-filter",
    path: "/api/search?q=python&limit=10&page=1&sort=relevance&category=Development",
    type: "search-filtered",
    filterField: "category",
    filterValue: "Development",
  },
  {
    name: "search-sort-newest",
    path: "/api/search?q=python&limit=5&page=1&sort=newest",
    type: "search-sorted",
    expectedSort: "newest",
  },
  {
    name: "sources",
    path: "/api/search/sources",
    type: "sources",
  },
];

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

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timeoutId);
  }
}

function validateSearchShape(payload) {
  const required = ["query", "results", "pagination", "facets"];
  for (const key of required) {
    if (!(key in (payload || {}))) {
      return `Missing key '${key}'`;
    }
  }
  if (!Array.isArray(payload.results)) {
    return "'results' is not an array";
  }
  if (payload.results.length > 0) {
    const first = payload.results[0] || {};
    const resultKeys = ["title", "url", "summary", "category"];
    for (const key of resultKeys) {
      if (!(key in first)) {
        return `First result missing key '${key}'`;
      }
    }
  }
  return "";
}

function validateSuggestShape(payload) {
  if (!Array.isArray(payload?.suggestions)) {
    return "'suggestions' is not an array";
  }
  return "";
}

function validateSourcesShape(payload) {
  if (!Array.isArray(payload?.sources)) {
    return "'sources' is not an array";
  }
  return "";
}

function compareCasePayload(caseType, nodePayload, djangoPayload, caseOptions) {
  if (caseType === "search-filtered") {
    const nodeErr = validateSearchShape(nodePayload);
    if (nodeErr) {
      return { ok: false, reason: `Node shape invalid: ${nodeErr}` };
    }
    const djangoErr = validateSearchShape(djangoPayload);
    if (djangoErr) {
      return { ok: false, reason: `Django shape invalid: ${djangoErr}` };
    }
    const field = caseOptions?.filterField;
    const expected = normalizeText(caseOptions?.filterValue);
    if (field && expected) {
      for (const result of nodePayload.results || []) {
        const actual = normalizeText(result?.[field]);
        if (actual && actual !== expected) {
          return {
            ok: false,
            reason: `Node result ${field}='${actual}' expected '${expected}'`,
          };
        }
      }
      for (const result of djangoPayload.results || []) {
        const actual = normalizeText(result?.[field]);
        if (actual && actual !== expected) {
          return {
            ok: false,
            reason: `Django result ${field}='${actual}' expected '${expected}'`,
          };
        }
      }
    }
    return {
      ok: true,
      notes: [
        `filter ${field}='${expected}'`,
        `results node=${nodePayload.results.length} django=${djangoPayload.results.length}`,
      ],
    };
  }

  if (caseType === "search-sorted") {
    const nodeErr = validateSearchShape(nodePayload);
    if (nodeErr) {
      return { ok: false, reason: `Node shape invalid: ${nodeErr}` };
    }
    const djangoErr = validateSearchShape(djangoPayload);
    if (djangoErr) {
      return { ok: false, reason: `Django shape invalid: ${djangoErr}` };
    }
    const expectedSort = caseOptions?.expectedSort;
    if (expectedSort === "newest") {
      const checkOrder = (results, label) => {
        for (let i = 1; i < results.length; i++) {
          const prevDate = Date.parse(results[i - 1]?.fetchedAt || "") || 0;
          const currDate = Date.parse(results[i]?.fetchedAt || "") || 0;
          if (currDate > prevDate + 1000) {
            return `${label} result[${i}] fetchedAt=${results[i].fetchedAt} is newer than result[${i - 1}] fetchedAt=${results[i - 1].fetchedAt}`;
          }
        }
        return "";
      };
      const nodeOrderErr = checkOrder(nodePayload.results || [], "Node");
      if (nodeOrderErr) {
        return { ok: false, reason: nodeOrderErr };
      }
      const djangoOrderErr = checkOrder(djangoPayload.results || [], "Django");
      if (djangoOrderErr) {
        return { ok: false, reason: djangoOrderErr };
      }
    }
    return {
      ok: true,
      notes: [
        `sort=${expectedSort}`,
        `node[0].fetchedAt=${nodePayload.results?.[0]?.fetchedAt || "-"}`,
        `django[0].fetchedAt=${djangoPayload.results?.[0]?.fetchedAt || "-"}`,
      ],
    };
  }

  if (caseType === "search-paginated") {
    const nodeErr = validateSearchShape(nodePayload);
    if (nodeErr) {
      return { ok: false, reason: `Node shape invalid: ${nodeErr}` };
    }
    const djangoErr = validateSearchShape(djangoPayload);
    if (djangoErr) {
      return { ok: false, reason: `Django shape invalid: ${djangoErr}` };
    }
    const expectedPage = caseOptions?.expectedPage;
    const nodePage = nodePayload?.pagination?.page;
    const djangoPage = djangoPayload?.pagination?.page;
    if (expectedPage != null) {
      if (nodePage !== expectedPage) {
        return {
          ok: false,
          reason: `Node pagination.page=${nodePage} expected ${expectedPage}`,
        };
      }
      if (djangoPage !== expectedPage) {
        return {
          ok: false,
          reason: `Django pagination.page=${djangoPage} expected ${expectedPage}`,
        };
      }
    }
    const nodeTopUrls = uniqueNormalized(
      (nodePayload?.results || []).slice(0, 5).map((e) => e?.url),
    );
    const djangoTopUrls = uniqueNormalized(
      (djangoPayload?.results || []).slice(0, 5).map((e) => e?.url),
    );
    const urlsOverlap = overlapCount(nodeTopUrls, djangoTopUrls);
    return {
      ok: true,
      notes: [
        `page node=${nodePage} django=${djangoPage}`,
        `results node=${nodePayload.results.length} django=${djangoPayload.results.length}`,
        `topUrlOverlap=${urlsOverlap}/${Math.min(nodeTopUrls.size, djangoTopUrls.size)}`,
      ],
    };
  }

  if (caseType === "search") {
    const nodeErr = validateSearchShape(nodePayload);
    if (nodeErr) {
      return { ok: false, reason: `Node shape invalid: ${nodeErr}` };
    }

    const djangoErr = validateSearchShape(djangoPayload);
    if (djangoErr) {
      return { ok: false, reason: `Django shape invalid: ${djangoErr}` };
    }

    const nodeQueryUsed = normalizeText(
      nodePayload?.queryUsed || nodePayload?.query,
    );
    const djangoQueryUsed = normalizeText(
      djangoPayload?.queryUsed || djangoPayload?.query,
    );

    if (!nodeQueryUsed || !djangoQueryUsed) {
      return { ok: false, reason: "Missing queryUsed/query in one backend" };
    }

    if (
      PARITY_RULES.requireExactQueryUsed &&
      nodeQueryUsed !== djangoQueryUsed
    ) {
      return {
        ok: false,
        reason: `queryUsed mismatch node='${nodeQueryUsed}' django='${djangoQueryUsed}'`,
      };
    }

    const nodeTopUrls = uniqueNormalized(
      (nodePayload?.results || []).slice(0, 5).map((entry) => entry?.url),
    );
    const djangoTopUrls = uniqueNormalized(
      (djangoPayload?.results || []).slice(0, 5).map((entry) => entry?.url),
    );
    const urlsOverlap = overlapCount(nodeTopUrls, djangoTopUrls);

    const topUrlOverlapRequired =
      Math.min(nodeTopUrls.size, djangoTopUrls.size) >= 3
        ? PARITY_RULES.minTopUrlOverlapForTop3Plus
        : 1;
    if (urlsOverlap < topUrlOverlapRequired) {
      return {
        ok: false,
        reason: `Top URL overlap too low: ${urlsOverlap}/${Math.min(nodeTopUrls.size, djangoTopUrls.size)} (required ${topUrlOverlapRequired})`,
      };
    }

    const nodeTopCategories = uniqueNormalized(
      (nodePayload?.results || []).slice(0, 5).map((entry) => entry?.category),
    );
    const djangoTopCategories = uniqueNormalized(
      (djangoPayload?.results || [])
        .slice(0, 5)
        .map((entry) => entry?.category),
    );
    const categoryOverlap = overlapCount(
      nodeTopCategories,
      djangoTopCategories,
    );

    if (
      PARITY_RULES.requireSearchCategoryOverlap &&
      nodeTopCategories.size > 0 &&
      djangoTopCategories.size > 0 &&
      categoryOverlap === 0
    ) {
      return {
        ok: false,
        reason: "No overlap in top search categories",
      };
    }

    return {
      ok: true,
      notes: [
        `queryUsed node='${nodeQueryUsed}' django='${djangoQueryUsed}'`,
        `queryUsedExactRequired=${PARITY_RULES.requireExactQueryUsed}`,
        `topUrlOverlap=${urlsOverlap}/${Math.min(nodeTopUrls.size, djangoTopUrls.size)}`,
        `categoryOverlap=${categoryOverlap}/${Math.min(nodeTopCategories.size, djangoTopCategories.size)}`,
      ],
    };
  }

  if (caseType === "suggest-empty") {
    const nodeErr = validateSuggestShape(nodePayload);
    if (nodeErr) {
      return { ok: false, reason: `Node shape invalid: ${nodeErr}` };
    }
    const djangoErr = validateSuggestShape(djangoPayload);
    if (djangoErr) {
      return { ok: false, reason: `Django shape invalid: ${djangoErr}` };
    }
    return {
      ok: true,
      notes: [
        `node suggestions=${nodePayload.suggestions.length} django suggestions=${djangoPayload.suggestions.length}`,
      ],
    };
  }

  if (caseType === "suggest") {
    const nodeErr = validateSuggestShape(nodePayload);
    if (nodeErr) {
      return { ok: false, reason: `Node shape invalid: ${nodeErr}` };
    }

    const djangoErr = validateSuggestShape(djangoPayload);
    if (djangoErr) {
      return { ok: false, reason: `Django shape invalid: ${djangoErr}` };
    }

    const nodeQuery = normalizeText(nodePayload?.query);
    const djangoQuery = normalizeText(djangoPayload?.query);
    if (
      PARITY_RULES.requireExactSuggestQuery &&
      nodeQuery &&
      djangoQuery &&
      nodeQuery !== djangoQuery
    ) {
      return {
        ok: false,
        reason: `suggest query mismatch node='${nodeQuery}' django='${djangoQuery}'`,
      };
    }

    const nodeSuggestions = uniqueNormalized(nodePayload.suggestions);
    const djangoSuggestions = uniqueNormalized(djangoPayload.suggestions);
    const suggestionsOverlap = overlapCount(nodeSuggestions, djangoSuggestions);
    const minSuggestions = Math.min(
      nodeSuggestions.size,
      djangoSuggestions.size,
    );
    const suggestionsRequired = Math.min(
      PARITY_RULES.minSuggestOverlapCap,
      minSuggestions,
    );

    if (suggestionsOverlap < suggestionsRequired) {
      return {
        ok: false,
        reason: `suggest overlap too low: ${suggestionsOverlap}/${minSuggestions} (required ${suggestionsRequired})`,
      };
    }

    return {
      ok: true,
      notes: [
        `suggestions node=${nodePayload.suggestions.length} django=${djangoPayload.suggestions.length}`,
        `suggestQueryExactRequired=${PARITY_RULES.requireExactSuggestQuery}`,
        `suggestOverlap=${suggestionsOverlap}/${minSuggestions}`,
      ],
    };
  }

  const nodeErr = validateSourcesShape(nodePayload);
  if (nodeErr) {
    return { ok: false, reason: `Node shape invalid: ${nodeErr}` };
  }

  const djangoErr = validateSourcesShape(djangoPayload);
  if (djangoErr) {
    return { ok: false, reason: `Django shape invalid: ${djangoErr}` };
  }

  const nodeCount = nodePayload.sources.length;
  const djangoCount = djangoPayload.sources.length;
  const sourceCountDiff = Math.abs(nodeCount - djangoCount);

  if (sourceCountDiff > PARITY_RULES.maxSourcesCountDiff) {
    return {
      ok: false,
      reason: `sources count diverges too much: node=${nodeCount} django=${djangoCount}`,
    };
  }

  const nodeCategories = uniqueNormalized(
    (nodePayload.sources || []).map((source) => source?.categoryHint),
  );
  const djangoCategories = uniqueNormalized(
    (djangoPayload.sources || []).map((source) => source?.categoryHint),
  );
  const categoriesOverlap = overlapCount(nodeCategories, djangoCategories);
  const minCategoryOverlapRequired =
    Math.min(nodeCategories.size, djangoCategories.size) >= 4
      ? PARITY_RULES.minSourceCategoryOverlapFor4Plus
      : 1;

  if (categoriesOverlap < minCategoryOverlapRequired) {
    return {
      ok: false,
      reason: `sources category overlap too low: ${categoriesOverlap} (required ${minCategoryOverlapRequired})`,
    };
  }

  const nodeLanguages = uniqueNormalized(
    (nodePayload.sources || []).map((source) => source?.languageHint),
  );
  const djangoLanguages = uniqueNormalized(
    (djangoPayload.sources || []).map((source) => source?.languageHint),
  );
  const languagesOverlap = overlapCount(nodeLanguages, djangoLanguages);

  if (PARITY_RULES.requireSourceLanguageOverlap && languagesOverlap === 0) {
    return {
      ok: false,
      reason: "No language overlap in sources metadata",
    };
  }

  return {
    ok: true,
    notes: [
      `sources node=${nodePayload.sources.length} django=${djangoPayload.sources.length}`,
      `sourceCountDiff=${sourceCountDiff}`,
      `categoryOverlap=${categoriesOverlap}/${Math.min(nodeCategories.size, djangoCategories.size)}`,
      `languageOverlap=${languagesOverlap}/${Math.min(nodeLanguages.size, djangoLanguages.size)}`,
    ],
  };
}

async function runCase(testCase) {
  const nodeUrl = `${NODE_BASE_URL}${testCase.path}`;
  const djangoUrl = `${DJANGO_BASE_URL}${testCase.path}`;

  const [nodeRes, djangoRes] = await Promise.all([
    fetchWithTimeout(nodeUrl),
    fetchWithTimeout(djangoUrl),
  ]);

  if (!nodeRes.response.ok) {
    return {
      ok: false,
      reason: `Node HTTP ${nodeRes.response.status}`,
    };
  }

  if (!djangoRes.response.ok) {
    return {
      ok: false,
      reason: `Django HTTP ${djangoRes.response.status}`,
    };
  }

  return compareCasePayload(
    testCase.type,
    nodeRes.payload,
    djangoRes.payload,
    testCase,
  );
}

(async () => {
  let failures = 0;

  console.log(
    `Search parity check | mode=${PARITY_MODE} | node=${NODE_BASE_URL} | django=${DJANGO_BASE_URL}`,
  );
  console.log("=".repeat(70));

  for (const testCase of PARITY_CASES) {
    try {
      const result = await runCase(testCase);
      if (!result.ok) {
        failures += 1;
        console.log(`FAIL ${testCase.name}`);
        console.log(`  reason: ${result.reason}`);
        continue;
      }

      console.log(`OK   ${testCase.name}`);
      for (const note of result.notes || []) {
        console.log(`  ${note}`);
      }
    } catch (error) {
      failures += 1;
      console.log(`FAIL ${testCase.name}`);
      console.log(`  error: ${String(error?.message || error)}`);
    }
  }

  console.log("=".repeat(70));
  if (failures > 0) {
    console.error(`Parity check finished with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("Parity check finished successfully.");
})();
