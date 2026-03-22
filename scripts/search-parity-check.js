const fs = require("fs");
const path = require("path");

const NODE_BASE_URL =
  process.env.MAGNETO_NODE_BASE_URL || "http://127.0.0.1:3000";
const DJANGO_BASE_URL =
  process.env.MAGNETO_DJANGO_BASE_URL || "http://127.0.0.1:8000";

const DEFAULT_REPORT_PATH = path.join(
  process.cwd(),
  "data",
  "backups",
  "parity",
  "latest-parity-report.json",
);
const PARITY_REPORT_PATH =
  String(process.env.PARITY_REPORT_PATH || "").trim() || DEFAULT_REPORT_PATH;
const PARITY_WRITE_REPORT =
  String(process.env.PARITY_WRITE_REPORT || "true")
    .trim()
    .toLowerCase() !== "false";

const PARITY_MODE =
  String(process.env.PARITY_MODE || "strict")
    .trim()
    .toLowerCase() === "compat"
    ? "compat"
    : "strict";

const PARITY_COMPAT_ALERT_MIN_SCORE_RAW = Number.parseInt(
  String(process.env.PARITY_COMPAT_ALERT_MIN_SCORE || "8"),
  10,
);
const PARITY_COMPAT_ALERT_MIN_SCORE =
  Number.isFinite(PARITY_COMPAT_ALERT_MIN_SCORE_RAW) &&
  PARITY_COMPAT_ALERT_MIN_SCORE_RAW >= 0
    ? PARITY_COMPAT_ALERT_MIN_SCORE_RAW
    : 8;
const PARITY_COMPAT_ALERT_MAX_ITEMS_RAW = Number.parseInt(
  String(process.env.PARITY_COMPAT_ALERT_MAX_ITEMS || "3"),
  10,
);
const PARITY_COMPAT_ALERT_MAX_ITEMS =
  Number.isFinite(PARITY_COMPAT_ALERT_MAX_ITEMS_RAW) &&
  PARITY_COMPAT_ALERT_MAX_ITEMS_RAW >= 1
    ? PARITY_COMPAT_ALERT_MAX_ITEMS_RAW
    : 3;

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
    name: "search-operator-intitle",
    path: "/api/search?q=intitle:documentation%20api&limit=5&page=1&sort=relevance",
    type: "search",
  },
  {
    name: "search-operator-inurl",
    path: "/api/search?q=inurl:api%20documentation&limit=5&page=1&sort=relevance",
    type: "search",
  },
  {
    name: "search-operator-site",
    path: "/api/search?q=site:docs.python.org%20python&limit=5&page=1&sort=relevance",
    type: "search-observe",
    modes: ["compat"],
  },
  {
    name: "search-operator-excluded-site",
    path: "/api/search?q=-site:docs.python.org%20python&limit=5&page=1&sort=relevance",
    type: "search-observe",
    modes: ["compat"],
  },
  {
    name: "search-operator-filetype",
    path: "/api/search?q=filetype:pdf%20ai&limit=5&page=1&sort=relevance",
    type: "search-observe",
    modes: ["compat"],
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
    name: "search-source-filter",
    path: "/api/search?q=python&limit=10&page=1&sort=relevance&source=docs.python.org",
    type: "search-filtered",
    filterField: "sourceName",
    filterValue: "docs.python.org",
  },
  {
    name: "search-sort-newest",
    path: "/api/search?q=python&limit=5&page=1&sort=newest",
    type: "search-sorted",
    expectedSort: "newest",
  },
  {
    name: "search-sort-quality",
    path: "/api/search?q=news&limit=10&page=1&sort=quality",
    type: "search-sorted",
    expectedSort: "quality",
  },
  {
    name: "search-page2-quality",
    path: "/api/search?q=api%20documentation&limit=5&page=2&sort=quality",
    type: "search-paginated",
    expectedPage: 2,
  },
  {
    name: "search-combined-filter-quality",
    path: "/api/search?q=python&limit=10&page=1&sort=quality&category=Development&source=docs.python.org",
    type: "search-combined-filter",
    filterField: "category",
    filterValue: "Development",
    sourceField: "sourceName",
    sourceValue: "docs.python.org",
    expectedSort: "quality",
    expectedPage: 1,
  },
  {
    name: "search-combined-filter-quality-language",
    path: "/api/search?q=python&limit=10&page=1&sort=quality&language=en&category=Development&source=docs.python.org",
    type: "search-combined-filter",
    filterField: "category",
    filterValue: "Development",
    languageField: "language",
    languageValue: "en",
    sourceField: "sourceName",
    sourceValue: "docs.python.org",
    expectedSort: "quality",
    expectedPage: 1,
  },
  {
    name: "sources",
    path: "/api/search/sources",
    type: "sources",
  },
];

function getActiveCases(cases, mode) {
  return (cases || []).filter((testCase) => {
    if (!Array.isArray(testCase?.modes) || testCase.modes.length === 0) {
      return true;
    }
    return testCase.modes.includes(mode);
  });
}

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
  if (caseType === "search-observe") {
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
    const nodeTopUrls = uniqueNormalized(
      (nodePayload?.results || []).slice(0, 5).map((entry) => entry?.url),
    );
    const djangoTopUrls = uniqueNormalized(
      (djangoPayload?.results || []).slice(0, 5).map((entry) => entry?.url),
    );
    const urlsOverlap = overlapCount(nodeTopUrls, djangoTopUrls);
    const nodeResultsCount = Number((nodePayload?.results || []).length);
    const djangoResultsCount = Number((djangoPayload?.results || []).length);
    const overlapDenominator = Math.min(nodeTopUrls.size, djangoTopUrls.size);
    const queryUsedExact = nodeQueryUsed === djangoQueryUsed;

    return {
      ok: true,
      notes: [
        `observe-only case '${caseOptions?.name || "unnamed"}'`,
        `queryUsed node='${nodeQueryUsed}' django='${djangoQueryUsed}'`,
        `results node=${nodeResultsCount} django=${djangoResultsCount}`,
        `topUrlOverlap=${urlsOverlap}/${overlapDenominator}`,
      ],
      observation: {
        caseName: String(caseOptions?.name || ""),
        casePath: String(caseOptions?.path || ""),
        nodeQueryUsed,
        djangoQueryUsed,
        queryUsedExact,
        nodeResultsCount,
        djangoResultsCount,
        resultCountDelta: Math.abs(nodeResultsCount - djangoResultsCount),
        topUrlOverlap: urlsOverlap,
        topUrlOverlapDenominator: overlapDenominator,
      },
    };
  }

  if (caseType === "search-combined-filter") {
    const nodeErr = validateSearchShape(nodePayload);
    if (nodeErr) {
      return { ok: false, reason: `Node shape invalid: ${nodeErr}` };
    }
    const djangoErr = validateSearchShape(djangoPayload);
    if (djangoErr) {
      return { ok: false, reason: `Django shape invalid: ${djangoErr}` };
    }

    const validateResults = (payload, label) => {
      const field = caseOptions?.filterField;
      const expected = normalizeText(caseOptions?.filterValue);
      const sourceField = caseOptions?.sourceField;
      const sourceExpected = normalizeText(caseOptions?.sourceValue);
      const languageField = caseOptions?.languageField;
      const languageExpected = normalizeText(caseOptions?.languageValue);
      const expectedPage = Number(caseOptions?.expectedPage || 1);
      const appliedFilters = payload?.appliedFilters || {};
      const pagination = payload?.pagination || {};

      if (normalizeText(appliedFilters.category) !== expected) {
        return `${label} appliedFilters.category='${normalizeText(appliedFilters.category)}' expected '${expected}'`;
      }
      if (normalizeText(appliedFilters.source) !== sourceExpected) {
        return `${label} appliedFilters.source='${normalizeText(appliedFilters.source)}' expected '${sourceExpected}'`;
      }
      if (languageExpected) {
        if (normalizeText(appliedFilters.language) !== languageExpected) {
          return `${label} appliedFilters.language='${normalizeText(appliedFilters.language)}' expected '${languageExpected}'`;
        }
      }
      if (
        normalizeText(appliedFilters.sort) !==
        normalizeText(caseOptions?.expectedSort)
      ) {
        return `${label} appliedFilters.sort='${normalizeText(appliedFilters.sort)}' expected '${normalizeText(caseOptions?.expectedSort)}'`;
      }
      if (Number(pagination.page || 0) !== expectedPage) {
        return `${label} pagination.page=${Number(pagination.page || 0)} expected ${expectedPage}`;
      }

      for (const result of payload.results || []) {
        const actual = normalizeText(result?.[field]);
        const actualSource = normalizeText(result?.[sourceField]);
        if (actual && actual !== expected) {
          return `${label} result ${field}='${actual}' expected '${expected}'`;
        }
        if (actualSource && actualSource !== sourceExpected) {
          return `${label} result ${sourceField}='${actualSource}' expected '${sourceExpected}'`;
        }
        if (languageExpected && languageField) {
          const actualLanguage = normalizeText(result?.[languageField]);
          if (actualLanguage && actualLanguage !== languageExpected) {
            return `${label} result ${languageField}='${actualLanguage}' expected '${languageExpected}'`;
          }
        }
      }

      for (let i = 1; i < (payload.results || []).length; i++) {
        const prevQuality = Number(payload.results[i - 1]?.qualityScore || 0);
        const currQuality = Number(payload.results[i]?.qualityScore || 0);
        if (currQuality > prevQuality) {
          return `${label} result[${i}] qualityScore=${currQuality} is higher than result[${i - 1}] qualityScore=${prevQuality}`;
        }
      }

      return "";
    };

    const nodeValidationErr = validateResults(nodePayload, "Node");
    if (nodeValidationErr) {
      return { ok: false, reason: nodeValidationErr };
    }
    const djangoValidationErr = validateResults(djangoPayload, "Django");
    if (djangoValidationErr) {
      return { ok: false, reason: djangoValidationErr };
    }

    return {
      ok: true,
      notes: [
        `combined filter category='${normalizeText(caseOptions?.filterValue)}' source='${normalizeText(caseOptions?.sourceValue)}' language='${normalizeText(caseOptions?.languageValue || "") || "-"}' sort='${normalizeText(caseOptions?.expectedSort)}'`,
        `page node=${nodePayload.pagination?.page} django=${djangoPayload.pagination?.page}`,
        `results node=${nodePayload.results.length} django=${djangoPayload.results.length}`,
      ],
    };
  }

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
    } else if (expectedSort === "quality") {
      const checkQualityOrder = (results, label) => {
        for (let i = 1; i < results.length; i++) {
          const prevQuality = Number(results[i - 1]?.qualityScore || 0);
          const currQuality = Number(results[i]?.qualityScore || 0);
          if (currQuality > prevQuality) {
            return `${label} result[${i}] qualityScore=${currQuality} is higher than result[${i - 1}] qualityScore=${prevQuality}`;
          }
        }
        return "";
      };
      const nodeOrderErr = checkQualityOrder(nodePayload.results || [], "Node");
      if (nodeOrderErr) {
        return { ok: false, reason: nodeOrderErr };
      }
      const djangoOrderErr = checkQualityOrder(
        djangoPayload.results || [],
        "Django",
      );
      if (djangoOrderErr) {
        return { ok: false, reason: djangoOrderErr };
      }
    }
    return {
      ok: true,
      notes:
        expectedSort === "quality"
          ? [
              `sort=${expectedSort}`,
              `node[0].qualityScore=${nodePayload.results?.[0]?.qualityScore || "-"}`,
              `django[0].qualityScore=${djangoPayload.results?.[0]?.qualityScore || "-"}`,
            ]
          : [
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
  const startedAt = Date.now();
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
      durationMs: Date.now() - startedAt,
    };
  }

  if (!djangoRes.response.ok) {
    return {
      ok: false,
      reason: `Django HTTP ${djangoRes.response.status}`,
      durationMs: Date.now() - startedAt,
    };
  }

  const comparison = compareCasePayload(
    testCase.type,
    nodeRes.payload,
    djangoRes.payload,
    testCase,
  );
  return {
    ...comparison,
    durationMs: Date.now() - startedAt,
  };
}

function writeParityReport(report) {
  if (!PARITY_WRITE_REPORT) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(PARITY_REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      PARITY_REPORT_PATH,
      JSON.stringify(report, null, 2),
      "utf8",
    );
  } catch (error) {
    console.warn(
      `Could not write parity report at ${PARITY_REPORT_PATH}: ${String(error?.message || error)}`,
    );
  }
}

function summarizeObserveCases(caseResults) {
  const observeCases = (caseResults || []).filter(
    (entry) => entry?.type === "search-observe",
  );

  const computeSeverity = (observation) => {
    const queryMismatch = observation.queryUsedExact === false;
    const resultCountDelta = Number(observation.resultCountDelta || 0);
    const overlap = Number(observation.topUrlOverlap || 0);
    const overlapDenominator = Number(
      observation.topUrlOverlapDenominator || 0,
    );
    const hasZeroOverlapWhenComparable =
      overlapDenominator > 0 && overlap === 0;
    const nodeResultsCount = Number(observation.nodeResultsCount || 0);
    const djangoResultsCount = Number(observation.djangoResultsCount || 0);
    const hasResultSetAsymmetry =
      (nodeResultsCount === 0 && djangoResultsCount > 0) ||
      (djangoResultsCount === 0 && nodeResultsCount > 0);

    let score = 0;
    if (queryMismatch) {
      score += 5;
    }
    score += Math.min(resultCountDelta, 5);
    if (hasZeroOverlapWhenComparable) {
      score += 6;
    }
    if (hasResultSetAsymmetry) {
      score += 4;
    }

    let level = "low";
    if (score >= 8) {
      level = "high";
    } else if (score >= 4) {
      level = "medium";
    }

    return {
      score,
      level,
      flags: {
        queryMismatch,
        hasZeroOverlapWhenComparable,
        hasResultSetAsymmetry,
      },
    };
  };

  const divergences = [];
  for (const entry of observeCases) {
    const observation = entry?.observation || {};
    const hasDivergence =
      observation.queryUsedExact === false ||
      Number(observation.resultCountDelta || 0) > 0 ||
      (Number(observation.topUrlOverlapDenominator || 0) > 0 &&
        Number(observation.topUrlOverlap || 0) === 0);

    if (hasDivergence) {
      const severity = computeSeverity(observation);
      divergences.push({
        name: String(entry?.name || ""),
        path: String(entry?.path || ""),
        queryUsedExact: Boolean(observation.queryUsedExact),
        resultCountDelta: Number(observation.resultCountDelta || 0),
        topUrlOverlap: Number(observation.topUrlOverlap || 0),
        topUrlOverlapDenominator: Number(
          observation.topUrlOverlapDenominator || 0,
        ),
        nodeResultsCount: Number(observation.nodeResultsCount || 0),
        djangoResultsCount: Number(observation.djangoResultsCount || 0),
        severity,
      });
    }
  }

  divergences.sort((left, right) => {
    const scoreDiff =
      Number(right?.severity?.score || 0) - Number(left?.severity?.score || 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });

  const severityTotals = {
    high: divergences.filter((entry) => entry?.severity?.level === "high")
      .length,
    medium: divergences.filter((entry) => entry?.severity?.level === "medium")
      .length,
    low: divergences.filter((entry) => entry?.severity?.level === "low").length,
  };

  return {
    totalObserveCases: observeCases.length,
    divergentObserveCases: divergences.length,
    severityTotals,
    divergences,
  };
}

(async () => {
  const startedAt = new Date();
  const startedAtMs = Date.now();
  let failures = 0;
  const caseResults = [];
  const activeCases = getActiveCases(PARITY_CASES, PARITY_MODE);

  console.log(
    `Search parity check | mode=${PARITY_MODE} | node=${NODE_BASE_URL} | django=${DJANGO_BASE_URL}`,
  );
  console.log("=".repeat(70));

  for (const testCase of activeCases) {
    try {
      const result = await runCase(testCase);
      if (!result.ok) {
        failures += 1;
        console.log(`FAIL ${testCase.name}`);
        console.log(`  reason: ${result.reason}`);
        caseResults.push({
          name: testCase.name,
          type: testCase.type,
          path: testCase.path,
          ok: false,
          reason: String(result.reason || "Unknown parity failure"),
          durationMs: Number(result.durationMs || 0),
          notes: [],
        });
        continue;
      }

      console.log(`OK   ${testCase.name}`);
      for (const note of result.notes || []) {
        console.log(`  ${note}`);
      }
      caseResults.push({
        name: testCase.name,
        type: testCase.type,
        path: testCase.path,
        ok: true,
        reason: "",
        durationMs: Number(result.durationMs || 0),
        notes: Array.isArray(result.notes) ? result.notes : [],
        observation: result.observation || null,
      });
    } catch (error) {
      failures += 1;
      console.log(`FAIL ${testCase.name}`);
      console.log(`  error: ${String(error?.message || error)}`);
      caseResults.push({
        name: testCase.name,
        type: testCase.type,
        path: testCase.path,
        ok: false,
        reason: String(error?.message || error),
        durationMs: 0,
        notes: [],
      });
    }
  }

  const durationMs = Date.now() - startedAtMs;
  const report = {
    generatedAt: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    durationMs,
    mode: PARITY_MODE,
    nodeBaseUrl: NODE_BASE_URL,
    djangoBaseUrl: DJANGO_BASE_URL,
    totalCases: activeCases.length,
    passedCases: activeCases.length - failures,
    failedCases: failures,
    allPassed: failures === 0,
    rules: PARITY_RULES,
    reportPath: PARITY_REPORT_PATH,
    caseResults,
    observeSummary: summarizeObserveCases(caseResults),
    compatAlert: {
      enabled: PARITY_MODE === "compat",
      minScore: PARITY_COMPAT_ALERT_MIN_SCORE,
      maxItems: PARITY_COMPAT_ALERT_MAX_ITEMS,
      alertingCount: 0,
      emittedCount: 0,
      suppressedCount: 0,
      alertingCases: [],
      emittedCases: [],
      summaryLine: "",
      summaryObject: {
        enabled: false,
        minScore: 0,
        maxItems: 0,
        alertingCount: 0,
        emittedCount: 0,
        suppressedCount: 0,
        hasAlerts: false,
      },
    },
  };

  const alertingDivergences =
    PARITY_MODE === "compat"
      ? (report?.observeSummary?.divergences || []).filter(
          (entry) =>
            Number(entry?.severity?.score || 0) >=
            PARITY_COMPAT_ALERT_MIN_SCORE,
        )
      : [];

  if (PARITY_MODE === "compat") {
    const emittedAlertingCases = alertingDivergences.slice(
      0,
      PARITY_COMPAT_ALERT_MAX_ITEMS,
    );
    report.compatAlert.alertingCount = alertingDivergences.length;
    report.compatAlert.emittedCount = emittedAlertingCases.length;
    report.compatAlert.suppressedCount = Math.max(
      0,
      alertingDivergences.length - emittedAlertingCases.length,
    );
    report.compatAlert.alertingCases = alertingDivergences.map((entry) => ({
      name: String(entry?.name || ""),
      score: Number(entry?.severity?.score || 0),
      level: String(entry?.severity?.level || ""),
    }));
    report.compatAlert.emittedCases = emittedAlertingCases.map((entry) => ({
      name: String(entry?.name || ""),
      score: Number(entry?.severity?.score || 0),
      level: String(entry?.severity?.level || ""),
    }));
    report.compatAlert.summaryLine = `mode=compat minScore=${report.compatAlert.minScore} alerting=${report.compatAlert.alertingCount} emitted=${report.compatAlert.emittedCount} suppressed=${report.compatAlert.suppressedCount}`;
    report.compatAlert.summaryObject = {
      enabled: true,
      minScore: report.compatAlert.minScore,
      maxItems: report.compatAlert.maxItems,
      alertingCount: report.compatAlert.alertingCount,
      emittedCount: report.compatAlert.emittedCount,
      suppressedCount: report.compatAlert.suppressedCount,
      hasAlerts: report.compatAlert.alertingCount > 0,
    };
  }

  writeParityReport(report);

  console.log("=".repeat(70));
  if (failures > 0) {
    console.error(`Parity check finished with ${failures} failure(s).`);
    if (PARITY_WRITE_REPORT) {
      console.error(`Parity JSON report: ${PARITY_REPORT_PATH}`);
    }
    process.exit(1);
  }

  if (PARITY_MODE === "compat") {
    if (alertingDivergences.length > 0) {
      console.warn(
        `COMPAT ALERT: ${alertingDivergences.length} observe divergence(s) with score >= ${PARITY_COMPAT_ALERT_MIN_SCORE}.`,
      );
      for (const entry of alertingDivergences.slice(
        0,
        PARITY_COMPAT_ALERT_MAX_ITEMS,
      )) {
        console.warn(
          `  - ${entry.name} | level=${entry?.severity?.level} | score=${entry?.severity?.score} | delta=${entry.resultCountDelta} | overlap=${entry.topUrlOverlap}/${entry.topUrlOverlapDenominator}`,
        );
      }
    }
  }

  console.log("Parity check finished successfully.");
  if (PARITY_WRITE_REPORT) {
    console.log(`Parity JSON report: ${PARITY_REPORT_PATH}`);
  }
})();
