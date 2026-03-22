const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const { env } = require("./apps/api-node/src/config/env");
const {
  analyticsPath,
  assistantMemoryPath,
  backupDir,
  dataDir,
  indexSyncStatePath,
  queryRewriteRulesPath,
  rankingConfigPath,
  routingStatePath,
  searchIndexPath,
} = require("./apps/api-node/src/config/paths");
const {
  createLoginController,
} = require("./apps/api-node/src/controllers/auth.controller");
const {
  createHealthController,
} = require("./apps/api-node/src/controllers/health.controller");
const {
  createPageViewController,
  createResultClickController,
} = require("./apps/api-node/src/controllers/events.controller");
const {
  createSearchRelatedController,
} = require("./apps/api-node/src/controllers/search-related.controller");
const {
  createPopularSearchesController,
} = require("./apps/api-node/src/controllers/analytics.controller");
const {
  createSearchSourcesController,
  createSearchSuggestController,
  createSearchTrendingController,
} = require("./apps/api-node/src/controllers/search-public.controller");
const {
  createAssistantChatController,
} = require("./apps/api-node/src/controllers/assistant.controller");
const {
  createSearchController,
} = require("./apps/api-node/src/controllers/search.controller");
const {
  createLocationAutoController,
} = require("./apps/api-node/src/controllers/location.controller");
const {
  createAssistantStatusController,
  createRuntimeMetricsController,
  createSearchStatusController,
} = require("./apps/api-node/src/controllers/admin-status.controller");
const {
  createRankingConfigGetController,
  createRankingConfigPostController,
  createRewriteRulesGetController,
  createRewriteRulesPostController,
  createRewriteRuleSuggestionsController,
  createSearchSeedController,
  createSearchCrawlController,
} = require("./apps/api-node/src/controllers/admin-search-management.controller");
const {
  createIndexStatusController,
  createIndexRefreshController,
  createIndexBackupsController,
  createIndexRestoreController,
} = require("./apps/api-node/src/controllers/admin-index-management.controller");
const {
  createIndexSyncController,
  createIndexSyncResetWatermarkController,
  createIndexSyncStatusController,
} = require("./apps/api-node/src/controllers/admin-index-sync.controller");
const {
  createAdminOverviewController,
  createClickSignalResetController,
  createClickSignalSnapshotResetController,
} = require("./apps/api-node/src/controllers/admin-overview.controller");
const {
  createAdminBackupsListController,
  createAdminBackupsDownloadController,
  createAdminBackupsCreateController,
  createAdminBackupsRestoreController,
} = require("./apps/api-node/src/controllers/admin-backups.controller");
const {
  createRoutingGetController,
  createRoutingUpdateController,
  createRoutingVerifyController,
} = require("./apps/api-node/src/controllers/admin-routing.controller");
const {
  createAdminExportCsvController,
} = require("./apps/api-node/src/controllers/admin-export.controller");
const {
  createAdminAuthMiddleware,
} = require("./apps/api-node/src/middleware/admin-auth");
const {
  createAdminRateLimitMiddleware,
} = require("./apps/api-node/src/middleware/admin-rate-limit");
const {
  createRequestObservabilityMiddleware,
} = require("./apps/api-node/src/middleware/request-observability");
const { createAuthRoutes } = require("./apps/api-node/src/routes/auth.routes");
const {
  createHealthRoutes,
} = require("./apps/api-node/src/routes/health.routes");
const {
  createEventsRoutes,
} = require("./apps/api-node/src/routes/events.routes");
const {
  createSearchRelatedRoutes,
} = require("./apps/api-node/src/routes/search-related.routes");
const {
  createAnalyticsRoutes,
} = require("./apps/api-node/src/routes/analytics.routes");
const {
  createSearchPublicRoutes,
} = require("./apps/api-node/src/routes/search-public.routes");
const {
  createSearchRoutes,
} = require("./apps/api-node/src/routes/search.routes");
const {
  createAssistantRoutes,
} = require("./apps/api-node/src/routes/assistant.routes");
const {
  createLocationRoutes,
} = require("./apps/api-node/src/routes/location.routes");
const {
  createAdminStatusRoutes,
} = require("./apps/api-node/src/routes/admin-status.routes");
const {
  createAdminSearchManagementRoutes,
} = require("./apps/api-node/src/routes/admin-search-management.routes");
const {
  createAdminIndexManagementRoutes,
} = require("./apps/api-node/src/routes/admin-index-management.routes");
const {
  createAdminIndexSyncRoutes,
} = require("./apps/api-node/src/routes/admin-index-sync.routes");
const {
  createAdminOverviewRoutes,
} = require("./apps/api-node/src/routes/admin-overview.routes");
const {
  createAdminBackupsRoutes,
} = require("./apps/api-node/src/routes/admin-backups.routes");
const {
  createAdminRoutingRoutes,
} = require("./apps/api-node/src/routes/admin-routing.routes");
const {
  createAdminExportRoutes,
} = require("./apps/api-node/src/routes/admin-export.routes");
const { getClientIp } = require("./apps/api-node/src/utils/request");

require("dotenv").config();

const app = express();

const {
  ADMIN_PASSWORD,
  ADMIN_USER,
  AI_FALLBACK_PROVIDER,
  AI_PRIMARY_PROVIDER,
  AI_PROVIDER_ORDER,
  AI_ROUTING_MODE,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  ANTHROPIC_MODEL_CANDIDATES,
  DJANGO_ADMIN_TOKEN,
  DJANGO_API_URL,
  DJANGO_INDEX_SYNC_ENABLED,
  DJANGO_INDEX_SYNC_STARTUP,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_MODEL_CANDIDATES,
  JWT_SECRET,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_MODEL_CANDIDATES,
  PORT,
} = env;

// --- Smart Search Result Cache ---
const SEARCH_CACHE_TTL_MS =
  envNumber("SEARCH_CACHE_TTL_SECONDS", 300, { min: 30, max: 3600 }) * 1000;
const SEARCH_CACHE_MAX_ENTRIES = envNumber("SEARCH_CACHE_MAX_ENTRIES", 500, {
  min: 50,
  max: 5000,
});
const searchResultCache = new Map(); // cacheKey -> { payload, expiresAt }

function makeSearchCacheKey(query, opts) {
  return [
    String(query || "")
      .trim()
      .toLowerCase(),
    String(opts.sort || "relevance"),
    String(opts.language || ""),
    String(opts.category || ""),
    String(opts.source || ""),
    String(opts.page || 1),
    String(opts.limit || 20),
  ].join("|");
}

function getFromSearchCache(key) {
  const entry = searchResultCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchResultCache.delete(key);
    return null;
  }
  return entry.payload;
}

function setInSearchCache(key, payload) {
  if (searchResultCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldest = searchResultCache.keys().next().value;
    searchResultCache.delete(oldest);
  }
  searchResultCache.set(key, {
    payload,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });
}

function invalidateSearchCache() {
  searchResultCache.clear();
}

// --- Related Queries Co-occurrence Tracking ---
const QUERY_SEQUENCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RELATED_QUERIES_MAX_PER_QUERY = 20;
const RELATED_QUERIES_MAX_DISTINCT = 1000;
const recentSearchByIp = new Map(); // ip -> { query, at }
const relatedQueriesMap = new Map(); // normalizedQuery -> Map<related -> count>

function recordRelatedQueryPair(a, b) {
  if (!relatedQueriesMap.has(a)) {
    if (relatedQueriesMap.size >= RELATED_QUERIES_MAX_DISTINCT) {
      const oldest = relatedQueriesMap.keys().next().value;
      relatedQueriesMap.delete(oldest);
    }
    relatedQueriesMap.set(a, new Map());
  }
  const inner = relatedQueriesMap.get(a);
  inner.set(b, (inner.get(b) || 0) + 1);
  if (inner.size > RELATED_QUERIES_MAX_PER_QUERY) {
    let minCount = Infinity;
    let minKey = null;
    for (const [k, v] of inner) {
      if (v < minCount) {
        minCount = v;
        minKey = k;
      }
    }
    if (minKey !== null) inner.delete(minKey);
  }
}

function trackQuerySequence(query, ip) {
  const normalizedIp = String(ip || "unknown");
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery || normalizedQuery.length < 2) return;

  const recent = recentSearchByIp.get(normalizedIp);
  if (
    recent &&
    recent.query &&
    recent.query !== normalizedQuery &&
    Date.now() - recent.at < QUERY_SEQUENCE_WINDOW_MS
  ) {
    recordRelatedQueryPair(recent.query, normalizedQuery);
    recordRelatedQueryPair(normalizedQuery, recent.query);
  }

  recentSearchByIp.set(normalizedIp, {
    query: normalizedQuery,
    at: Date.now(),
  });
  if (recentSearchByIp.size > 10000) {
    const oldest = recentSearchByIp.keys().next().value;
    recentSearchByIp.delete(oldest);
  }
}

function getRelatedQueries(query, limit = 6) {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  const inner = relatedQueriesMap.get(normalizedQuery);
  if (!inner || inner.size === 0) return [];
  return Array.from(inner.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.min(limit, 10))
    .map(([q]) => q);
}

const SEARCH_PROXY_TIMEOUT_MS = envNumber("SEARCH_PROXY_TIMEOUT_MS", 5000, {
  min: 500,
  max: 30000,
});

function envNumber(
  name,
  fallback,
  { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {},
) {
  const raw = process.env[name];
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

const LOGIN_WINDOW_MS =
  envNumber("LOGIN_WINDOW_MINUTES", 15, { min: 1, max: 120 }) * 60 * 1000;
const LOGIN_RATE_LIMIT_COUNT = envNumber("LOGIN_RATE_LIMIT_COUNT", 20, {
  min: 1,
  max: 500,
});
const LOCKOUT_THRESHOLD = envNumber("LOCKOUT_THRESHOLD", 5, {
  min: 1,
  max: 20,
});
const LOCKOUT_MS =
  envNumber("LOCKOUT_MINUTES", 15, { min: 1, max: 180 }) * 60 * 1000;
const ADMIN_WINDOW_MS =
  envNumber("ADMIN_WINDOW_SECONDS", 60, { min: 5, max: 600 }) * 1000;
const ADMIN_RATE_LIMIT_COUNT = envNumber("ADMIN_RATE_LIMIT_COUNT", 120, {
  min: 5,
  max: 2000,
});
const BACKUP_MIN_INTERVAL_MS =
  envNumber("BACKUP_MIN_INTERVAL_MINUTES", 15, { min: 1, max: 240 }) *
  60 *
  1000;
const BACKUP_SCHEDULE_MS =
  envNumber("BACKUP_SCHEDULE_MINUTES", 60, { min: 1, max: 1440 }) * 60 * 1000;
const DJANGO_INDEX_SYNC_INTERVAL_MS =
  envNumber("DJANGO_INDEX_SYNC_INTERVAL_MINUTES", 15, { min: 1, max: 1440 }) *
  60 *
  1000;
const DJANGO_INDEX_SYNC_MAX_PAGES = envNumber(
  "DJANGO_INDEX_SYNC_MAX_PAGES",
  50,
  {
    min: 1,
    max: 300,
  },
);
const DJANGO_INDEX_SYNC_PAGE_SIZE = envNumber(
  "DJANGO_INDEX_SYNC_PAGE_SIZE",
  200,
  {
    min: 1,
    max: 500,
  },
);
const MAX_BACKUP_FILES = envNumber("MAX_BACKUP_FILES", 120, {
  min: 5,
  max: 10000,
});
const TREND_DAILY_POINTS = envNumber("TREND_DAILY_POINTS", 14, {
  min: 7,
  max: 90,
});
const TREND_WEEKLY_POINTS = envNumber("TREND_WEEKLY_POINTS", 8, {
  min: 4,
  max: 104,
});
const ASSISTANT_WINDOW_MS =
  envNumber("ASSISTANT_WINDOW_SECONDS", 60, { min: 5, max: 600 }) * 1000;
const ASSISTANT_RATE_LIMIT_COUNT = envNumber(
  "ASSISTANT_RATE_LIMIT_COUNT",
  240,
  {
    min: 10,
    max: 5000,
  },
);
const ASSISTANT_MAX_CHARS = envNumber("ASSISTANT_MAX_CHARS", 4000, {
  min: 200,
  max: 12000,
});
const ASSISTANT_HISTORY_MESSAGES = envNumber("ASSISTANT_HISTORY_MESSAGES", 14, {
  min: 4,
  max: 40,
});
const ASSISTANT_HISTORY_CHARS = envNumber("ASSISTANT_HISTORY_CHARS", 1200, {
  min: 200,
  max: 6000,
});
const ASSISTANT_REPLY_MAX_CHARS = envNumber("ASSISTANT_REPLY_MAX_CHARS", 1200, {
  min: 280,
  max: 4000,
});
const ASSISTANT_MODEL_TEMPERATURE = envNumber(
  "ASSISTANT_MODEL_TEMPERATURE",
  0.5,
  {
    min: 0,
    max: 1,
  },
);
const ASSISTANT_OPENAI_MAX_TOKENS = envNumber(
  "ASSISTANT_OPENAI_MAX_TOKENS",
  900,
  {
    min: 120,
    max: 4000,
  },
);
const ASSISTANT_ANTHROPIC_MAX_TOKENS = envNumber(
  "ASSISTANT_ANTHROPIC_MAX_TOKENS",
  900,
  {
    min: 120,
    max: 4000,
  },
);
const ASSISTANT_GEMINI_MAX_TOKENS = envNumber(
  "ASSISTANT_GEMINI_MAX_TOKENS",
  900,
  {
    min: 120,
    max: 4000,
  },
);
const ASSISTANT_CACHE_TTL_MS =
  envNumber("ASSISTANT_CACHE_TTL_SECONDS", 900, { min: 30, max: 86400 }) * 1000;
const ASSISTANT_CACHE_MAX_ENTRIES = envNumber(
  "ASSISTANT_CACHE_MAX_ENTRIES",
  500,
  {
    min: 50,
    max: 20000,
  },
);
const ASSISTANT_MEMORY_MAX_ITEMS = envNumber(
  "ASSISTANT_MEMORY_MAX_ITEMS",
  2000,
  {
    min: 100,
    max: 100000,
  },
);
const ASSISTANT_SIMPLE_QUERY_WORDS = envNumber(
  "ASSISTANT_SIMPLE_QUERY_WORDS",
  5,
  {
    min: 2,
    max: 20,
  },
);
const CLICK_SIGNAL_WINDOW_DAYS = envNumber("CLICK_SIGNAL_WINDOW_DAYS", 30, {
  min: 1,
  max: 180,
});
const CLICK_SIGNAL_CACHE_TTL_MS =
  envNumber("CLICK_SIGNAL_CACHE_TTL_SECONDS", 30, { min: 5, max: 300 }) * 1000;
const CLICK_SIGNAL_MAX_BOOST = envNumber("CLICK_SIGNAL_MAX_BOOST", 10, {
  min: 1,
  max: 50,
});
const CLICK_SIGNAL_CTR_MAX_BOOST = envNumber("CLICK_SIGNAL_CTR_MAX_BOOST", 3, {
  min: 0,
  max: 20,
});
const CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE = envNumber(
  "CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE",
  4,
  { min: 0, max: 30 },
);
const CLICK_SIGNAL_GUARDRAIL_MAX_SHARE = envNumber(
  "CLICK_SIGNAL_GUARDRAIL_MAX_SHARE",
  0.8,
  { min: 0, max: 2 },
);
const CLICK_SIGNAL_DECAY_HALFLIFE_DAYS = envNumber(
  "CLICK_SIGNAL_DECAY_HALFLIFE_DAYS",
  7,
  { min: 1, max: 120 },
);
const CLICK_SIGNAL_DECAY_MIN_WEIGHT = envNumber(
  "CLICK_SIGNAL_DECAY_MIN_WEIGHT",
  0.05,
  { min: 0, max: 1 },
);
const CLICK_SIGNAL_DEDUP_WINDOW_MS =
  envNumber("CLICK_SIGNAL_DEDUP_SECONDS", 20, { min: 1, max: 300 }) * 1000;

const loginAttemptMap = new Map();
const adminRateMap = new Map();
const assistantRateMap = new Map();
const assistantCacheMap = new Map();
const assistantContextMap = new Map();
const assistantProviderHealthMap = new Map();
const assistantProviderModelStateMap = new Map();
const assistantMetrics = {
  requestsTotal: 0,
  cacheHits: 0,
  localHybridResponses: 0,
  openaiResponses: 0,
  anthropicResponses: 0,
  geminiResponses: 0,
  fallbackResponses: 0,
  lastProviderError: "",
  lastProviderErrorAt: "",
  providerCounts: {},
  helperCounts: {},
};
let lastBackupAt = 0;
let djangoSyncInFlight = false;
let djangoSyncRuntime = {
  lastRunAt: "",
  lastSuccessAt: "",
  lastError: "",
  lastSummary: null,
};
function createClickSignalTelemetryState() {
  return {
    searchesEvaluated: 0,
    docsEvaluated: 0,
    boostApplied: 0,
    suppressedMinBase: 0,
    suppressedNoSignal: 0,
    cappedByGuardrail: 0,
    totalBoost: 0,
    lastUpdatedAt: "",
    lastRun: null,
  };
}

let clickSignalTelemetry = createClickSignalTelemetryState();

const adminAuth = createAdminAuthMiddleware({
  jwt,
  jwtSecret: JWT_SECRET,
});
const checkAdminRateLimit = createAdminRateLimitMiddleware({
  adminRateMap,
  adminWindowMs: ADMIN_WINDOW_MS,
  adminRateLimitCount: ADMIN_RATE_LIMIT_COUNT,
  getClientIp,
});
const loginController = createLoginController({
  jwt,
  adminUser: ADMIN_USER,
  adminPassword: ADMIN_PASSWORD,
  jwtSecret: JWT_SECRET,
  loginRateLimitCount: LOGIN_RATE_LIMIT_COUNT,
  loginWindowMs: LOGIN_WINDOW_MS,
  lockoutThreshold: LOCKOUT_THRESHOLD,
  lockoutMs: LOCKOUT_MS,
  loginAttemptMap,
  getClientIp,
});
const healthController = createHealthController({
  port: PORT,
  loginWindowMs: LOGIN_WINDOW_MS,
  loginRateLimitCount: LOGIN_RATE_LIMIT_COUNT,
  lockoutThreshold: LOCKOUT_THRESHOLD,
  lockoutMs: LOCKOUT_MS,
  adminWindowMs: ADMIN_WINDOW_MS,
  adminRateLimitCount: ADMIN_RATE_LIMIT_COUNT,
  backupMinIntervalMs: BACKUP_MIN_INTERVAL_MS,
  backupScheduleMs: BACKUP_SCHEDULE_MS,
  maxBackupFiles: MAX_BACKUP_FILES,
  trendDailyPoints: TREND_DAILY_POINTS,
  trendWeeklyPoints: TREND_WEEKLY_POINTS,
});
const pageViewController = createPageViewController({
  logPageView,
});
const resultClickController = createResultClickController({
  logResultClick,
});
const searchRelatedController = createSearchRelatedController({
  getRelatedQueries,
});
const searchSourcesController = createSearchSourcesController({
  pickSearchBackend,
  proxyDjangoSearch,
  getSearchSources,
});
const searchSuggestController = createSearchSuggestController({
  pickSearchBackend,
  proxyDjangoSearch,
  getSearchSuggestions,
});
const searchTrendingController = createSearchTrendingController({
  pickSearchBackend,
  proxyDjangoSearch,
  getTrendingSearches,
});
const searchController = createSearchController({
  pickSearchBackend,
  makeSearchCacheKey,
  getFromSearchCache,
  proxyDjangoSearch,
  runSearchPage,
  logSearch,
  getAppliedSearchOperators,
  getSearchSuggestions,
  getRelatedQueries,
  setInSearchCache,
});
const assistantChatController = createAssistantChatController({
  checkAssistantRateLimit,
  assistantMetrics,
  getClientIp,
  classifyAssistantHelper,
  assistantMaxChars: ASSISTANT_MAX_CHARS,
  normalizeAssistantQueryKey,
  isWeatherAssistantQuery,
  isDateOrNewsAssistantQuery,
  buildWeatherAssistantResponse,
  markIpWeatherContext,
  setAssistantCacheEntry,
  storeAssistantMemory,
  incrementMetricCounter,
  buildDateNewsAssistantResponse,
  getAssistantCacheEntry,
  isSimpleAssistantQuery,
  buildRuleBasedAssistantResponse,
  generateAssistantResponse,
});
const popularSearchesController = createPopularSearchesController({
  fs,
  analyticsPath,
});
const locationAutoController = createLocationAutoController({
  getClientIp,
  resolveApproxLocationByIp,
  sanitizeIpForLookup,
});
const assistantStatusController = createAssistantStatusController({
  getAssistantMemorySummary,
  aiRoutingMode: AI_ROUTING_MODE,
  aiPrimaryProvider: AI_PRIMARY_PROVIDER,
  aiFallbackProvider: AI_FALLBACK_PROVIDER,
  openaiApiKey: OPENAI_API_KEY,
  anthropicApiKey: ANTHROPIC_API_KEY,
  geminiApiKey: GEMINI_API_KEY,
  openaiModel: OPENAI_MODEL,
  anthropicModel: ANTHROPIC_MODEL,
  geminiModel: GEMINI_MODEL,
  getActiveProviderModel,
  openaiModelCandidates: OPENAI_MODEL_CANDIDATES,
  anthropicModelCandidates: ANTHROPIC_MODEL_CANDIDATES,
  geminiModelCandidates: GEMINI_MODEL_CANDIDATES,
  assistantProviderHealthMap,
  assistantWindowMs: ASSISTANT_WINDOW_MS,
  assistantRateLimitCount: ASSISTANT_RATE_LIMIT_COUNT,
  assistantMaxChars: ASSISTANT_MAX_CHARS,
  assistantHistoryMessages: ASSISTANT_HISTORY_MESSAGES,
  assistantHistoryChars: ASSISTANT_HISTORY_CHARS,
  assistantReplyMaxChars: ASSISTANT_REPLY_MAX_CHARS,
  assistantModelTemperature: ASSISTANT_MODEL_TEMPERATURE,
  assistantOpenaiMaxTokens: ASSISTANT_OPENAI_MAX_TOKENS,
  assistantAnthropicMaxTokens: ASSISTANT_ANTHROPIC_MAX_TOKENS,
  assistantGeminiMaxTokens: ASSISTANT_GEMINI_MAX_TOKENS,
  assistantSimpleQueryWords: ASSISTANT_SIMPLE_QUERY_WORDS,
  assistantCacheTtlMs: ASSISTANT_CACHE_TTL_MS,
  assistantCacheMaxEntries: ASSISTANT_CACHE_MAX_ENTRIES,
  assistantCacheMap,
  assistantMemoryMaxItems: ASSISTANT_MEMORY_MAX_ITEMS,
  assistantMetrics,
});
const runtimeMetricsController = createRuntimeMetricsController({
  assistantCacheMap,
  assistantContextMap,
  assistantProviderHealthMap,
  assistantProviderModelStateMap,
  assistantMetrics,
  loginAttemptMap,
  adminRateMap,
  assistantRateMap,
});
const searchStatusController = createSearchStatusController({
  getSearchIndexStats,
  buildAdminSearchLatestRunSummary,
  getSearchRankingConfig,
  getQueryRewriteRules,
});
const rankingConfigGetController = createRankingConfigGetController({
  getSearchRankingConfig,
});
const rankingConfigPostController = createRankingConfigPostController({
  resetSearchRankingConfig,
  writeSearchRankingConfig,
});
const rewriteRulesGetController = createRewriteRulesGetController({
  getQueryRewriteRules,
});
const rewriteRulesPostController = createRewriteRulesPostController({
  resetQueryRewriteRules,
  writeQueryRewriteRules,
});
const rewriteRuleSuggestionsController = createRewriteRuleSuggestionsController(
  {
    buildRewriteRuleSuggestions,
  },
);
const searchSeedController = createSearchSeedController({
  djangoAdminToken: DJANGO_ADMIN_TOKEN,
  toBearerToken,
  executeDjangoIndexSync,
  djangoIndexSyncPageSize: DJANGO_INDEX_SYNC_PAGE_SIZE,
  djangoIndexSyncMaxPages: DJANGO_INDEX_SYNC_MAX_PAGES,
});
const searchCrawlController = createSearchCrawlController({
  djangoAdminToken: DJANGO_ADMIN_TOKEN,
  toBearerToken,
  executeDjangoIndexSync,
  djangoIndexSyncPageSize: DJANGO_INDEX_SYNC_PAGE_SIZE,
  djangoIndexSyncMaxPages: DJANGO_INDEX_SYNC_MAX_PAGES,
});
const indexStatusController = createIndexStatusController({
  getSearchIndexStats,
});
const indexRefreshController = createIndexRefreshController({
  rebuildLocalSearchIndex,
  getSearchIndexStats,
});
const indexBackupsController = createIndexBackupsController({
  listSearchIndexBackups,
});
const indexRestoreController = createIndexRestoreController({
  sanitizeSearchIndexBackupFileName,
  restoreSearchIndexFromBackup,
  getSearchIndexStats,
});
const indexSyncController = createIndexSyncController({
  parseOptionalIsoDate,
  readDjangoIndexSyncState,
  writeDjangoIndexSyncState,
  toBearerToken,
  djangoAdminToken: DJANGO_ADMIN_TOKEN,
  executeDjangoIndexSync,
});
const indexSyncResetWatermarkController =
  createIndexSyncResetWatermarkController({
    parseOptionalIsoDate,
    readDjangoIndexSyncState,
    writeDjangoIndexSyncState,
  });
const indexSyncStatusController = createIndexSyncStatusController({
  djangoSyncInFlight,
  djangoIndexSyncEnabled: DJANGO_INDEX_SYNC_ENABLED,
  djangoIndexSyncIntervalMs: DJANGO_INDEX_SYNC_INTERVAL_MS,
  djangoIndexSyncStartup: DJANGO_INDEX_SYNC_STARTUP,
  djangoIndexSyncMaxPages: DJANGO_INDEX_SYNC_MAX_PAGES,
  djangoIndexSyncPageSize: DJANGO_INDEX_SYNC_PAGE_SIZE,
  djangoAdminToken: DJANGO_ADMIN_TOKEN,
  djangoSyncRuntime,
  readDjangoIndexSyncState,
});
const adminOverviewController = createAdminOverviewController({
  readJson,
  analyticsPath,
  parseRangeToSince,
  filterByDateRange,
  buildOverview,
  getPeriodComparison,
  clickSignalWindowDays: CLICK_SIGNAL_WINDOW_DAYS,
  clickSignalDecayHalfLifeDays: CLICK_SIGNAL_DECAY_HALFLIFE_DAYS,
  clickSignalDecayMinWeight: CLICK_SIGNAL_DECAY_MIN_WEIGHT,
  clickSignalMaxBoost: CLICK_SIGNAL_MAX_BOOST,
  clickSignalCtrMaxBoost: CLICK_SIGNAL_CTR_MAX_BOOST,
  clickSignalGuardrailMinBaseScore: CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE,
  clickSignalGuardrailMaxShare: CLICK_SIGNAL_GUARDRAIL_MAX_SHARE,
  clickSignalDedupWindowMs: CLICK_SIGNAL_DEDUP_WINDOW_MS,
  getClickSignalTelemetry: () => clickSignalTelemetry,
});
const clickSignalResetController = createClickSignalResetController({
  createClickSignalTelemetryState,
  setClickSignalTelemetry: (nextTelemetry) => {
    clickSignalTelemetry = nextTelemetry;
  },
});
const clickSignalSnapshotResetController =
  createClickSignalSnapshotResetController({
    createClickSignalTelemetryState,
    getClickSignalTelemetry: () => clickSignalTelemetry,
    setClickSignalTelemetry: (nextTelemetry) => {
      clickSignalTelemetry = nextTelemetry;
    },
    clickSignalWindowDays: CLICK_SIGNAL_WINDOW_DAYS,
    clickSignalDecayHalfLifeDays: CLICK_SIGNAL_DECAY_HALFLIFE_DAYS,
    clickSignalDecayMinWeight: CLICK_SIGNAL_DECAY_MIN_WEIGHT,
    clickSignalMaxBoost: CLICK_SIGNAL_MAX_BOOST,
    clickSignalCtrMaxBoost: CLICK_SIGNAL_CTR_MAX_BOOST,
    clickSignalGuardrailMinBaseScore: CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE,
    clickSignalGuardrailMaxShare: CLICK_SIGNAL_GUARDRAIL_MAX_SHARE,
    clickSignalDedupWindowMs: CLICK_SIGNAL_DEDUP_WINDOW_MS,
  });
const adminBackupsListController = createAdminBackupsListController({
  isAllowedBackupReason,
  listBackups,
});
const adminBackupsDownloadController = createAdminBackupsDownloadController({
  backupDir,
  sanitizeBackupFileName,
});
const adminBackupsCreateController = createAdminBackupsCreateController({
  backupAnalytics,
  listBackups,
});
const adminBackupsRestoreController = createAdminBackupsRestoreController({
  backupDir,
  sanitizeBackupFileName,
  analyticsPath,
  backupAnalytics,
});
const routingGetController = createRoutingGetController({
  getRoutingState: () => routingState,
});
const routingUpdateController = createRoutingUpdateController({
  validRoutingBackends: ["node", "django"],
  validCanaryPercentages: [0, 10, 50, 100],
  getRoutingState: () => routingState,
  saveRoutingState: _saveRoutingState,
});
const routingVerifyController = createRoutingVerifyController({
  getRoutingState: () => routingState,
  port: PORT,
});
const adminExportCsvController = createAdminExportCsvController({
  readJson,
  analyticsPath,
  parseRangeToSince,
  filterByDateRange,
  buildOverview,
  escapeCsv,
});

app.use(express.json({ limit: "250kb" }));
app.use(createRequestObservabilityMiddleware({ randomUUID }));
app.use(express.static(__dirname));
app.use(createAuthRoutes({ loginController }));
app.use(createHealthRoutes({ healthController }));
app.use(
  createEventsRoutes({
    pageViewController,
    resultClickController,
  }),
);
app.use(
  createSearchRelatedRoutes({
    searchRelatedController,
  }),
);
app.use(
  createAnalyticsRoutes({
    popularSearchesController,
  }),
);
app.use(
  createSearchPublicRoutes({
    searchSourcesController,
    searchSuggestController,
    searchTrendingController,
  }),
);
app.use(
  createSearchRoutes({
    searchController,
  }),
);
app.use(
  createAssistantRoutes({
    assistantChatController,
  }),
);
app.use(
  createLocationRoutes({
    locationAutoController,
  }),
);
app.use(
  createAdminStatusRoutes({
    adminAuth,
    assistantStatusController,
    runtimeMetricsController,
    searchStatusController,
  }),
);
app.use(
  createAdminSearchManagementRoutes({
    adminAuth,
    rankingConfigGetController,
    rankingConfigPostController,
    rewriteRulesGetController,
    rewriteRulesPostController,
    rewriteRuleSuggestionsController,
    searchSeedController,
    searchCrawlController,
  }),
);
app.use(
  createAdminIndexManagementRoutes({
    adminAuth,
    indexStatusController,
    indexRefreshController,
    indexBackupsController,
    indexRestoreController,
  }),
);
app.use(
  createAdminIndexSyncRoutes({
    adminAuth,
    indexSyncController,
    indexSyncResetWatermarkController,
    indexSyncStatusController,
  }),
);
app.use(
  createAdminOverviewRoutes({
    adminAuth,
    adminOverviewController,
    clickSignalResetController,
    clickSignalSnapshotResetController,
  }),
);
app.use(
  createAdminBackupsRoutes({
    adminAuth,
    adminBackupsListController,
    adminBackupsDownloadController,
    adminBackupsCreateController,
    adminBackupsRestoreController,
  }),
);
app.use(
  createAdminRoutingRoutes({
    adminAuth,
    routingGetController,
    routingUpdateController,
    routingVerifyController,
  }),
);
app.use(
  createAdminExportRoutes({
    adminAuth,
    adminExportCsvController,
  }),
);

function ensureAnalyticsFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  if (!fs.existsSync(analyticsPath)) {
    fs.writeFileSync(
      analyticsPath,
      JSON.stringify({ searches: [], pageViews: [] }, null, 2),
      "utf8",
    );
  }

  if (!fs.existsSync(assistantMemoryPath)) {
    fs.writeFileSync(
      assistantMemoryPath,
      JSON.stringify({ chats: [] }, null, 2),
      "utf8",
    );
  }

  if (!fs.existsSync(searchIndexPath)) {
    fs.writeFileSync(searchIndexPath, JSON.stringify([], null, 2), "utf8");
  }

  if (!fs.existsSync(indexSyncStatePath)) {
    fs.writeFileSync(
      indexSyncStatePath,
      JSON.stringify(
        {
          updatedSince: "",
          lastRunAt: "",
          lastSuccessAt: "",
          lastError: "",
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  if (!fs.existsSync(rankingConfigPath)) {
    fs.writeFileSync(
      rankingConfigPath,
      JSON.stringify(
        {
          coverageThresholdByIntent: COVERAGE_THRESHOLD_BY_INTENT,
          sourceAuthorityBoosts: SOURCE_AUTHORITY_BOOSTS,
          optionalQueryTokens: [...OPTIONAL_QUERY_TOKENS],
        },
        null,
        2,
      ),
      "utf8",
    );
  }
}

function getIsoWeekData(date) {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
  return { year: utcDate.getUTCFullYear(), week };
}

function toUtcDay(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function toUtcWeekStart(date) {
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function buildTrendSeries(searches, pageViews, mode, count) {
  const now = new Date();
  const buckets = [];
  const bucketMap = new Map();

  for (let i = count - 1; i >= 0; i -= 1) {
    if (mode === "daily") {
      const date = toUtcDay(now);
      date.setUTCDate(date.getUTCDate() - i);
      const key = date.toISOString().slice(0, 10);
      const label = key.slice(5);
      const bucket = { key, label, searchCount: 0, pageViewCount: 0 };
      buckets.push(bucket);
      bucketMap.set(key, bucket);
      continue;
    }

    const weekStart = toUtcWeekStart(toUtcDay(now));
    weekStart.setUTCDate(weekStart.getUTCDate() - i * 7);
    const iso = getIsoWeekData(weekStart);
    const key = `${iso.year}-W${String(iso.week).padStart(2, "0")}`;
    const label = `W${String(iso.week).padStart(2, "0")}`;
    const bucket = { key, label, searchCount: 0, pageViewCount: 0 };
    buckets.push(bucket);
    bucketMap.set(key, bucket);
  }

  for (const item of searches) {
    const at = new Date(String(item.at || ""));
    if (Number.isNaN(at.getTime())) {
      continue;
    }

    const key =
      mode === "daily"
        ? toUtcDay(at).toISOString().slice(0, 10)
        : (() => {
            const iso = getIsoWeekData(at);
            return `${iso.year}-W${String(iso.week).padStart(2, "0")}`;
          })();

    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.searchCount += 1;
    }
  }

  for (const item of pageViews) {
    const at = new Date(String(item.at || ""));
    if (Number.isNaN(at.getTime())) {
      continue;
    }

    const key =
      mode === "daily"
        ? toUtcDay(at).toISOString().slice(0, 10)
        : (() => {
            const iso = getIsoWeekData(at);
            return `${iso.year}-W${String(iso.week).padStart(2, "0")}`;
          })();

    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.pageViewCount += 1;
    }
  }

  return buckets;
}

function pruneBackups() {
  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.startsWith("analytics-") && name.endsWith(".json"))
    .map((name) => ({
      name,
      fullPath: path.join(backupDir, name),
      mtimeMs: fs.statSync(path.join(backupDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const stale = files.slice(MAX_BACKUP_FILES);
  for (const item of stale) {
    fs.unlinkSync(item.fullPath);
  }
}

function backupAnalytics(reason = "auto", options = {}) {
  const force = Boolean(options.force);
  if (!fs.existsSync(analyticsPath)) {
    return;
  }

  const now = Date.now();
  const isScheduled = reason === "scheduled";
  if (!force && !isScheduled && now - lastBackupAt < BACKUP_MIN_INTERVAL_MS) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupDir, `analytics-${stamp}-${reason}.json`);
  fs.copyFileSync(analyticsPath, target);
  lastBackupAt = now;
  pruneBackups();
}

function getRangeMs(range) {
  if (range === "24h") {
    return 24 * 60 * 60 * 1000;
  }

  if (range === "7d") {
    return 7 * 24 * 60 * 60 * 1000;
  }

  if (range === "30d") {
    return 30 * 24 * 60 * 60 * 1000;
  }

  return null;
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

const QUERY_REWRITE_MATCH_TYPES = new Set(["exact", "contains"]);
const DEFAULT_QUERY_REWRITE_RULES = [
  {
    enabled: true,
    matchType: "exact",
    from: "pythn",
    to: "python",
    reason: "common-typo",
  },
  {
    enabled: true,
    matchType: "exact",
    from: "opnai",
    to: "openai",
    reason: "common-typo",
  },
];

function copyQueryRewriteRules(rules) {
  return Array.isArray(rules) ? rules.map((rule) => ({ ...rule })) : [];
}

function normalizeQueryRewriteRules(value) {
  const rules =
    value && typeof value === "object" && !Array.isArray(value)
      ? value.rules
      : value;
  if (!Array.isArray(rules)) {
    throw new Error(
      "Rewrite rules payload must be a list or an object with a rules list.",
    );
  }

  return rules.map((item, index) => {
    const ruleNumber = index + 1;
    if (!item || typeof item !== "object") {
      throw new Error(`Rule ${ruleNumber} must be an object.`);
    }

    const matchType =
      normalizeSearchText(String(item.matchType || "exact")) || "exact";
    if (!QUERY_REWRITE_MATCH_TYPES.has(matchType)) {
      throw new Error(
        `Rule ${ruleNumber} has invalid matchType. Use exact or contains.`,
      );
    }

    const source = String(item.from || "").trim();
    const target = String(item.to || "").trim();
    const reason =
      String(item.reason || "configured-rewrite").trim() ||
      "configured-rewrite";

    if (!source) {
      throw new Error(`Rule ${ruleNumber} is missing a from value.`);
    }
    if (!target) {
      throw new Error(`Rule ${ruleNumber} is missing a to value.`);
    }
    if (source.length > 160 || target.length > 160) {
      throw new Error(
        `Rule ${ruleNumber} from/to values must be 160 characters or fewer.`,
      );
    }
    if (reason.length > 120) {
      throw new Error(
        `Rule ${ruleNumber} reason must be 120 characters or fewer.`,
      );
    }
    if (normalizeSearchText(source) === normalizeSearchText(target)) {
      throw new Error(`Rule ${ruleNumber} must change the query.`);
    }

    return {
      enabled: item.enabled == null ? true : Boolean(item.enabled),
      matchType,
      from: source,
      to: target,
      reason,
    };
  });
}

function getDefaultQueryRewriteRules() {
  return copyQueryRewriteRules(DEFAULT_QUERY_REWRITE_RULES);
}

function getQueryRewriteRules() {
  try {
    const parsed = readJson(queryRewriteRulesPath, { rules: [] });
    return normalizeQueryRewriteRules(parsed);
  } catch {
    return [];
  }
}

function writeQueryRewriteRules(value) {
  const normalizedRules = normalizeQueryRewriteRules(value);
  writeJson(queryRewriteRulesPath, { rules: normalizedRules });
  return copyQueryRewriteRules(normalizedRules);
}

function resetQueryRewriteRules() {
  return writeQueryRewriteRules(getDefaultQueryRewriteRules());
}

function looksLikeOperatorQuery(query) {
  return /(^|\s)(site:|-site:|filetype:|inurl:|intitle:)/i.test(
    String(query || ""),
  );
}

function buildRewriteRuleSuggestions({ limit = 10, minConfidence = 0 } = {}) {
  const analytics = readJson(analyticsPath, { searches: [] });
  const searches = Array.isArray(analytics.searches) ? analytics.searches : [];
  const searchesById = new Map(
    searches
      .filter((item) => String(item?.id || "").trim())
      .map((item) => [String(item.id).trim(), item]),
  );

  const existingKeys = new Set(
    getQueryRewriteRules().map((rule) =>
      [
        normalizeSearchText(rule.from || ""),
        normalizeSearchText(rule.to || ""),
        normalizeSearchText(rule.matchType || "exact") || "exact",
      ].join("||"),
    ),
  );

  const candidateStats = new Map();
  for (const current of searches) {
    const previousId = String(current?.reformulatesSearchId || "").trim();
    if (!previousId) {
      continue;
    }

    const previous = searchesById.get(previousId);
    if (!previous) {
      continue;
    }

    const previousQuery = String(previous.query || "").trim();
    const currentQuery = String(current.query || "").trim();
    const previousNorm = normalizeSearchText(previousQuery);
    const currentNorm = normalizeSearchText(currentQuery);

    if (!previousNorm || !currentNorm || previousNorm === currentNorm) {
      continue;
    }
    if (previousNorm.length < 3 || currentNorm.length < 3) {
      continue;
    }
    if (
      looksLikeOperatorQuery(previousNorm) ||
      looksLikeOperatorQuery(currentNorm)
    ) {
      continue;
    }

    const previousCount = Number(previous.resultCount || 0);
    const currentCount = Number(current.resultCount || 0);
    const reformulationType = String(current.reformulationType || "")
      .trim()
      .toLowerCase();

    if (
      reformulationType !== "zero-results-refinement" &&
      reformulationType !== "low-results-refinement"
    ) {
      continue;
    }
    if (currentCount <= previousCount) {
      continue;
    }

    const key = `${previousNorm}||${currentNorm}`;
    if (!candidateStats.has(key)) {
      candidateStats.set(key, {
        from: previousQuery,
        to: currentQuery,
        count: 0,
        maxImprovement: 0,
        types: new Set(),
      });
    }

    const entry = candidateStats.get(key);
    entry.count += 1;
    entry.maxImprovement = Math.max(
      Number(entry.maxImprovement || 0),
      currentCount - previousCount,
    );
    entry.types.add(reformulationType);
  }

  const threshold = Math.max(0, Math.min(0.99, Number(minConfidence) || 0));
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

  return [...candidateStats.entries()]
    .map(([key, entry]) => {
      if (existingKeys.has(`${key}||exact`)) {
        return null;
      }

      const count = Number(entry.count || 0);
      const maxImprovement = Number(entry.maxImprovement || 0);
      const confidence = Math.min(
        0.99,
        0.45 + 0.12 * Math.min(count, 4) + 0.02 * Math.min(maxImprovement, 10),
      );

      return {
        enabled: true,
        matchType: "exact",
        from: String(entry.from || "").trim(),
        to: String(entry.to || "").trim(),
        reason: "telemetry-suggested",
        signals: {
          reformulations: count,
          maxImprovement,
          types: [...entry.types].sort(),
          confidence: Number(confidence.toFixed(2)),
        },
      };
    })
    .filter(
      (item) =>
        item &&
        Number(item.signals?.confidence || 0) >= threshold &&
        item.from &&
        item.to,
    )
    .sort((left, right) => {
      const reformulationsDiff =
        Number(right.signals?.reformulations || 0) -
        Number(left.signals?.reformulations || 0);
      if (reformulationsDiff !== 0) {
        return reformulationsDiff;
      }

      return (
        Number(right.signals?.maxImprovement || 0) -
        Number(left.signals?.maxImprovement || 0)
      );
    })
    .slice(0, safeLimit);
}

function toSafeFileStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function normalizeIndexUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    ) {
      parsed.port = "";
    }

    let pathname = parsed.pathname || "/";
    pathname = pathname.replace(/\/+$/g, "");
    parsed.pathname = pathname || "/";
    return parsed.toString();
  } catch {
    return raw;
  }
}

function backupSearchIndex(reason = "manual") {
  if (!fs.existsSync(searchIndexPath)) {
    return null;
  }

  const safeReason =
    String(reason || "manual")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "manual";
  const targetName = `search-index-${toSafeFileStamp()}-${safeReason}.json`;
  const targetPath = path.join(backupDir, targetName);
  fs.copyFileSync(searchIndexPath, targetPath);
  return targetName;
}

function resetLocalSearchArtifactsCache() {
  localSearchArtifactsCache = {
    mtimeMs: -1,
    size: -1,
    docs: [],
    tokenDfMap: new Map(),
    vocabulary: [],
    docCount: 0,
  };
}

function rebuildLocalSearchIndex({ mergeDocs = [], createBackup = true } = {}) {
  const existing = readJson(searchIndexPath, []);
  const incoming = Array.isArray(mergeDocs) ? mergeDocs : [];
  const rawDocs = [...(Array.isArray(existing) ? existing : []), ...incoming];

  const beforeCount = rawDocs.length;
  const byUrl = new Map();
  let removedInvalid = 0;

  for (const rawDoc of rawDocs) {
    if (!rawDoc || typeof rawDoc !== "object") {
      removedInvalid += 1;
      continue;
    }

    const normalizedUrl = normalizeIndexUrl(rawDoc.url);
    const title = String(rawDoc.title || "").trim();
    const summary = String(rawDoc.summary || "").trim();

    if (!normalizedUrl || (!title && !summary)) {
      removedInvalid += 1;
      continue;
    }

    const normalizedDoc = normalizeIndexedDoc({
      ...rawDoc,
      url: normalizedUrl,
      id:
        String(rawDoc.id || "").trim() ||
        `doc-${stableHashString(normalizedUrl)}`,
      title: title || normalizedUrl,
      summary,
    });

    byUrl.set(normalizedUrl.toLowerCase(), normalizedDoc);
  }

  const rebuilt = [...byUrl.values()].sort((left, right) => {
    const leftQuality = Number(left.qualityScore || 0);
    const rightQuality = Number(right.qualityScore || 0);
    if (rightQuality !== leftQuality) {
      return rightQuality - leftQuality;
    }
    return String(left.title || "").localeCompare(String(right.title || ""));
  });

  let backupFile = null;
  if (createBackup) {
    backupFile = backupSearchIndex("index-refresh");
  }

  writeJson(searchIndexPath, rebuilt);
  resetLocalSearchArtifactsCache();
  invalidateSearchCache();
  const artifacts = getLocalSearchArtifacts();

  return {
    beforeCount,
    afterCount: rebuilt.length,
    removedInvalid,
    deduplicated: Math.max(0, beforeCount - rebuilt.length - removedInvalid),
    backupFile,
    artifacts: {
      docCount: artifacts.docCount,
      vocabularySize: artifacts.vocabulary.length,
      tokenDfSize: artifacts.tokenDfMap.size,
    },
  };
}

function getSearchIndexStats() {
  const docs = getLocalSearchArtifacts().docs || [];
  const languageMap = new Map();
  const categoryMap = new Map();
  const sourceMap = new Map();

  for (const doc of docs) {
    const language = String(doc.language || "").trim() || "unknown";
    const category = String(doc.category || "").trim() || "unknown";
    const source =
      String(doc.sourceName || doc.sourceSlug || "").trim() || "unknown";
    languageMap.set(language, (languageMap.get(language) || 0) + 1);
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  }

  const toTopEntries = (map, limit = 10) =>
    [...map.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));

  const fileStats = fs.existsSync(searchIndexPath)
    ? fs.statSync(searchIndexPath)
    : null;

  return {
    totalDocs: docs.length,
    file: {
      path: searchIndexPath,
      sizeBytes: Number(fileStats?.size || 0),
      mtime: fileStats?.mtime ? fileStats.mtime.toISOString() : "",
    },
    topLanguages: toTopEntries(languageMap, 8),
    topCategories: toTopEntries(categoryMap, 8),
    topSources: toTopEntries(sourceMap, 12),
  };
}

function parseRangeToSince(range) {
  const rangeMs = getRangeMs(range);
  if (rangeMs != null) {
    return new Date(Date.now() - rangeMs);
  }

  return null;
}

function filterByDateRange(items, sinceDate) {
  if (!sinceDate) {
    return items;
  }

  const sinceMs = sinceDate.getTime();
  return items.filter((item) => {
    const ms = Date.parse(String(item.at || ""));
    if (Number.isNaN(ms)) {
      return false;
    }

    return ms >= sinceMs;
  });
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (!text.includes(",") && !text.includes("\n") && !text.includes('"')) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function buildOverview(searches, pageViews, resultClicks = []) {
  const queryCounts = {};
  for (const item of searches) {
    const key = String(item.query || "")
      .trim()
      .toLowerCase();
    if (!key) {
      continue;
    }
    queryCounts[key] = (queryCounts[key] || 0) + 1;
  }

  const totalSearches = searches.length;
  const topQueries = Object.entries(queryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({
      query,
      count,
      percent:
        totalSearches > 0
          ? Number(((count / totalSearches) * 100).toFixed(2))
          : 0,
    }));

  const pageCounts = {};
  for (const view of pageViews) {
    const page = String(view.page || "unknown");
    pageCounts[page] = (pageCounts[page] || 0) + 1;
  }

  const totalViews = pageViews.length;
  const trafficByPage = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([page, count]) => ({
      page,
      count,
      percent:
        totalViews > 0 ? Number(((count / totalViews) * 100).toFixed(2)) : 0,
    }));

  const clicks = Array.isArray(resultClicks) ? resultClicks : [];
  const totalResultClicks = clicks.length;
  const clickedUrlSet = new Set();
  for (const item of clicks) {
    const normalizedUrl = normalizeIndexUrl(item?.url || "");
    if (normalizedUrl) {
      clickedUrlSet.add(normalizedUrl);
    }
  }

  const clickThroughRate =
    totalSearches > 0
      ? Number(((totalResultClicks / totalSearches) * 100).toFixed(2))
      : 0;

  const clickUrlMap = new Map();
  const clickQueryUrlMap = new Map();
  const queryClickTotals = new Map();
  for (const item of clicks) {
    const normalizedUrl = normalizeIndexUrl(item?.url || "");
    const normalizedQuery = normalizeSearchText(item?.query || "");
    if (!normalizedUrl) {
      continue;
    }

    if (!clickUrlMap.has(normalizedUrl)) {
      clickUrlMap.set(normalizedUrl, {
        url: normalizedUrl,
        title: String(item?.title || "").trim(),
        lastQuery: String(item?.query || "").trim(),
        count: 0,
        lastAt: String(item?.at || ""),
      });
    }

    const current = clickUrlMap.get(normalizedUrl);
    current.count += 1;
    if (String(item?.title || "").trim()) {
      current.title = String(item.title).trim();
    }
    if (String(item?.query || "").trim()) {
      current.lastQuery = String(item.query).trim();
    }

    const currentAtMs = Date.parse(String(current.lastAt || ""));
    const nextAtMs = Date.parse(String(item?.at || ""));
    if (
      Number.isFinite(nextAtMs) &&
      (!Number.isFinite(currentAtMs) || nextAtMs > currentAtMs)
    ) {
      current.lastAt = String(item.at || "");
    }

    if (normalizedQuery) {
      queryClickTotals.set(
        normalizedQuery,
        (queryClickTotals.get(normalizedQuery) || 0) + 1,
      );

      const pairKey = `${normalizedQuery}||${normalizedUrl}`;
      if (!clickQueryUrlMap.has(pairKey)) {
        clickQueryUrlMap.set(pairKey, {
          query: String(item?.query || "").trim(),
          url: normalizedUrl,
          title: String(item?.title || "").trim(),
          count: 0,
          lastAt: String(item?.at || ""),
        });
      }

      const pair = clickQueryUrlMap.get(pairKey);
      pair.count += 1;
      if (String(item?.title || "").trim()) {
        pair.title = String(item.title).trim();
      }

      const pairCurrentAtMs = Date.parse(String(pair.lastAt || ""));
      const pairNextAtMs = Date.parse(String(item?.at || ""));
      if (
        Number.isFinite(pairNextAtMs) &&
        (!Number.isFinite(pairCurrentAtMs) || pairNextAtMs > pairCurrentAtMs)
      ) {
        pair.lastAt = String(item.at || "");
      }
    }
  }

  const topClickedResults = [...clickUrlMap.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      const leftAt = Date.parse(String(left.lastAt || "")) || 0;
      const rightAt = Date.parse(String(right.lastAt || "")) || 0;
      return rightAt - leftAt;
    })
    .slice(0, 12)
    .map((item) => ({
      ...item,
      percent:
        totalResultClicks > 0
          ? Number(((item.count / totalResultClicks) * 100).toFixed(2))
          : 0,
    }));

  const topClickPairs = [...clickQueryUrlMap.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      const leftAt = Date.parse(String(left.lastAt || "")) || 0;
      const rightAt = Date.parse(String(right.lastAt || "")) || 0;
      return rightAt - leftAt;
    })
    .slice(0, 12)
    .map((item) => {
      const normalizedQuery = normalizeSearchText(item.query || "");
      const queryTotalClicks = Number(
        queryClickTotals.get(normalizedQuery) || 0,
      );
      const ctrPercent =
        queryTotalClicks > 0
          ? Number(((item.count / queryTotalClicks) * 100).toFixed(2))
          : 0;

      return {
        ...item,
        percent:
          totalResultClicks > 0
            ? Number(((item.count / totalResultClicks) * 100).toFixed(2))
            : 0,
        queryTotalClicks,
        ctrPercent,
      };
    });

  return {
    totals: {
      totalSearches,
      totalPageViews: totalViews,
      uniqueQueries: Object.keys(queryCounts).length,
      totalResultClicks,
      uniqueClickedUrls: clickedUrlSet.size,
      clickThroughRate,
    },
    topQueries,
    topClickedResults,
    topClickPairs,
    trafficByPage,
    latestSearches: searches.slice(-20).reverse(),
    trends: {
      daily: buildTrendSeries(searches, pageViews, "daily", TREND_DAILY_POINTS),
      weekly: buildTrendSeries(
        searches,
        pageViews,
        "weekly",
        TREND_WEEKLY_POINTS,
      ),
    },
  };
}

function getTotalsForItems(searches, pageViews, resultClicks = []) {
  const uniqueQuerySet = new Set(
    searches
      .map((item) =>
        String(item.query || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );

  return {
    totalSearches: searches.length,
    totalPageViews: pageViews.length,
    uniqueQueries: uniqueQuerySet.size,
    totalResultClicks: Array.isArray(resultClicks) ? resultClicks.length : 0,
  };
}

function getPeriodComparison(
  allSearches,
  allPageViews,
  allResultClicks,
  range,
) {
  const rangeMs = getRangeMs(range);
  if (!rangeMs) {
    return null;
  }

  const now = Date.now();
  const currentStart = now - rangeMs;
  const previousStart = now - rangeMs * 2;
  const previousEnd = currentStart;

  const currentSearches = allSearches.filter((item) => {
    const at = Date.parse(String(item.at || ""));
    return !Number.isNaN(at) && at >= currentStart;
  });

  const currentPageViews = allPageViews.filter((item) => {
    const at = Date.parse(String(item.at || ""));
    return !Number.isNaN(at) && at >= currentStart;
  });

  const currentResultClicks = allResultClicks.filter((item) => {
    const at = Date.parse(String(item.at || ""));
    return !Number.isNaN(at) && at >= currentStart;
  });

  const previousSearches = allSearches.filter((item) => {
    const at = Date.parse(String(item.at || ""));
    return !Number.isNaN(at) && at >= previousStart && at < previousEnd;
  });

  const previousPageViews = allPageViews.filter((item) => {
    const at = Date.parse(String(item.at || ""));
    return !Number.isNaN(at) && at >= previousStart && at < previousEnd;
  });

  const previousResultClicks = allResultClicks.filter((item) => {
    const at = Date.parse(String(item.at || ""));
    return !Number.isNaN(at) && at >= previousStart && at < previousEnd;
  });
  const currentTotals = getTotalsForItems(
    currentSearches,
    currentPageViews,
    currentResultClicks,
  );
  const previousTotals = getTotalsForItems(
    previousSearches,
    previousPageViews,
    previousResultClicks,
  );

  function pctDelta(current, previous) {
    if (previous === 0) {
      if (current === 0) {
        return 0;
      }
      return null;
    }

    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  return {
    previousTotals,
    deltaPercent: {
      totalSearches: pctDelta(
        currentTotals.totalSearches,
        previousTotals.totalSearches,
      ),
      totalPageViews: pctDelta(
        currentTotals.totalPageViews,
        previousTotals.totalPageViews,
      ),
      uniqueQueries: pctDelta(
        currentTotals.uniqueQueries,
        previousTotals.uniqueQueries,
      ),
      totalResultClicks: pctDelta(
        currentTotals.totalResultClicks,
        previousTotals.totalResultClicks,
      ),
    },
  };
}

function listBackups() {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir)
    .filter((name) => name.startsWith("analytics-") && name.endsWith(".json"))
    .map((name) => {
      const fullPath = path.join(backupDir, name);
      const stat = fs.statSync(fullPath);
      const reasonMatch = name.match(
        /-(startup|scheduled|write|manual|pre-restore|restored)\.json$/,
      );

      return {
        fileName: name,
        sizeBytes: stat.size,
        createdAt: new Date(stat.mtimeMs).toISOString(),
        reason: reasonMatch ? reasonMatch[1] : "unknown",
      };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function isAllowedBackupReason(reason) {
  return [
    "startup",
    "scheduled",
    "write",
    "manual",
    "pre-restore",
    "restored",
    "unknown",
  ].includes(reason);
}

function sanitizeBackupFileName(input) {
  const fileName = path.basename(String(input || "").trim());
  if (
    !fileName ||
    !fileName.startsWith("analytics-") ||
    !fileName.endsWith(".json")
  ) {
    return "";
  }

  return fileName;
}

function listSearchIndexBackups() {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir)
    .filter(
      (name) =>
        name.startsWith("search-index-") &&
        name.toLowerCase().endsWith(".json"),
    )
    .map((name) => {
      const fullPath = path.join(backupDir, name);
      const stat = fs.statSync(fullPath);
      const reasonMatch = name.match(
        /^search-index-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(.+)\.json$/i,
      );

      return {
        fileName: name,
        sizeBytes: stat.size,
        createdAt: new Date(stat.mtimeMs).toISOString(),
        reason: reasonMatch ? reasonMatch[1] : "unknown",
      };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function sanitizeSearchIndexBackupFileName(input) {
  const fileName = path.basename(String(input || "").trim());
  if (
    !fileName ||
    !fileName.startsWith("search-index-") ||
    !fileName.toLowerCase().endsWith(".json")
  ) {
    return "";
  }

  return fileName;
}

function restoreSearchIndexFromBackup(fileName, { createBackup = true } = {}) {
  const sanitized = sanitizeSearchIndexBackupFileName(fileName);
  if (!sanitized) {
    throw new Error("Invalid search-index backup file name.");
  }

  const sourcePath = path.join(backupDir, sanitized);
  if (!fs.existsSync(sourcePath)) {
    throw new Error("Search-index backup file not found.");
  }

  let backupFile = null;
  if (createBackup) {
    backupFile = backupSearchIndex("pre-restore");
  }

  fs.copyFileSync(sourcePath, searchIndexPath);
  resetLocalSearchArtifactsCache();
  getLocalSearchArtifacts();

  return {
    restoredFrom: sanitized,
    preRestoreBackup: backupFile,
  };
}

function getAssistantRateState(ip) {
  const now = Date.now();
  const state = assistantRateMap.get(ip) || { hits: [] };
  state.hits = state.hits.filter((ts) => now - ts <= ASSISTANT_WINDOW_MS);
  assistantRateMap.set(ip, state);
  return state;
}

function checkAssistantRateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const state = getAssistantRateState(ip);
  if (state.hits.length >= ASSISTANT_RATE_LIMIT_COUNT) {
    const retryAfter = Math.max(
      1,
      Math.ceil((ASSISTANT_WINDOW_MS - (now - state.hits[0])) / 1000),
    );
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: `Too many assistant requests. Retry in ${retryAfter} seconds.`,
    });
    return false;
  }

  state.hits.push(now);
  assistantRateMap.set(ip, state);
  return true;
}

function incrementMetricCounter(counter, key) {
  const normalized =
    String(key || "unknown")
      .trim()
      .toLowerCase() || "unknown";
  counter[normalized] = (counter[normalized] || 0) + 1;
}

function classifyAssistantHelper(message) {
  const normalized = normalizeAssistantQueryKey(message);
  if (
    /\b(weather|forecast|temperature|temp|meteo|vreme|temperatura|ploaie|rain|snow|wind|vant)\b/.test(
      normalized,
    )
  ) {
    return "weather";
  }

  if (
    /\b(write|rewrite|summarize|summary|email|message|copy|draft|resume|cover letter|scrie|rescrie|rezuma|rezum|mesaj|mail|cv|text)\b/.test(
      normalized,
    )
  ) {
    return "writing";
  }

  return "general";
}

function getAssistantCacheEntry(key) {
  const entry = assistantCacheMap.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    assistantCacheMap.delete(key);
    return null;
  }

  return entry.value;
}

function setAssistantCacheEntry(key, value) {
  assistantCacheMap.set(key, {
    value,
    expiresAt: Date.now() + ASSISTANT_CACHE_TTL_MS,
  });

  if (assistantCacheMap.size <= ASSISTANT_CACHE_MAX_ENTRIES) {
    return;
  }

  const overflow = assistantCacheMap.size - ASSISTANT_CACHE_MAX_ENTRIES;
  const keys = assistantCacheMap.keys();
  for (let i = 0; i < overflow; i += 1) {
    const next = keys.next();
    if (next.done) {
      break;
    }
    assistantCacheMap.delete(next.value);
  }
}

function normalizeAssistantQueryKey(message) {
  return String(message || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeAssistantSuggestions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function isSimpleAssistantQuery(message) {
  const normalized = normalizeAssistantQueryKey(message);
  if (!normalized) {
    return true;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const knownSimpleIntent =
    /^(help|ajutor|hello|hi|salut|buna|weather|news|jobs?|career|cv|time|date)\b/.test(
      normalized,
    );

  // Keep very short prompts local for speed, but avoid routing every
  // short question to the generic rule-based fallback.
  if (wordCount <= 2) {
    return true;
  }

  if (wordCount <= ASSISTANT_SIMPLE_QUERY_WORDS && knownSimpleIntent) {
    return true;
  }

  return knownSimpleIntent;
}

function buildRuleBasedAssistantResponse(message) {
  const raw = String(message || "").trim() || "your topic";
  const q = normalizeAssistantQueryKey(message);

  if (/^(hi|hello|hey|salut|buna|bună)\b/.test(q)) {
    return {
      reply: "Ask a concrete question and I can narrow it down quickly.",
      suggestions: [
        "latest tech news",
        "weather this weekend",
        "improve my CV summary",
      ],
    };
  }

  if (/^(ce faci|ce mai faci|esti acolo|ești acolo|nu spui nimic)\b/.test(q)) {
    return {
      reply:
        "Sunt aici. Spune-mi exact ce vrei sa rezolvi si iti raspund direct, in pasi clari.",
      suggestions: [
        "explica pe scurt subiectul",
        "fa-mi un plan in 3 pasi",
        "compara doua optiuni",
      ],
    };
  }

  if (/\b(time|date|today|azi|acum)\b/.test(q)) {
    return {
      reply:
        "Add your city or timezone if you want a precise current-time answer.",
      suggestions: [
        "current time in Bucharest",
        "today date in Romania",
        "weather and date today",
      ],
    };
  }

  if (/weather|rain|sun|forecast|meteo|vreme/.test(q)) {
    return {
      reply: "Add city and timeframe for more precise weather results.",
      suggestions: [
        `${raw} in my city`,
        `${raw} this weekend`,
        "hourly weather forecast",
      ],
    };
  }

  if (/news|politics|economy|stiri|știri/.test(q)) {
    return {
      reply: "Try trusted sources and a specific timeframe.",
      suggestions: [
        `${raw} last 24 hours`,
        `${raw} trusted sources`,
        `${raw} analysis`,
      ],
    };
  }

  if (/job|career|cv|hiring|angajare|joburi/.test(q)) {
    return {
      reply: "Include location and seniority to narrow job results.",
      suggestions: [`${raw} remote`, `${raw} entry level`, `${raw} salary`],
    };
  }

  return {
    reply:
      "Pot sa te ajut mai bine daca imi spui rezultatul dorit: explicatie, pasi practici, comparatie sau rezumat.",
    suggestions: [`${raw} guide`, `${raw} 2026`, `${raw} explained`],
  };
}

function detectAssistantLanguage(message) {
  const normalized = normalizeAssistantQueryKey(message);
  if (
    /\b(ce|vreme|acum|azi|maine|salut|buna|romanian|romana|schimba limba|in bucuresti|in romania)\b/.test(
      normalized,
    )
  ) {
    return "ro";
  }

  return "en";
}

function hasRecentWeatherContext(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return false;
  }

  const recentText = history
    .slice(-6)
    .map((item) => String(item?.content || ""))
    .join(" ")
    .toLowerCase();

  return /\b(weather|forecast|temperature|temp|meteo|vreme|temperatura|wind|vant|km\/h)\b/.test(
    recentText,
  );
}

function isLikelyCityFollowUp(message) {
  const normalized = normalizeAssistantQueryKey(message);
  return /^(si\s+)?(dar\s+)?(in|la|for|din)\s+[a-z\s\-']{2,50}\??$/.test(
    normalized,
  );
}

function hasIpWeatherContext(ip) {
  const key = String(ip || "unknown");
  const context = assistantContextMap.get(key);
  if (!context || !context.lastWeatherAt) {
    return false;
  }

  return Date.now() - context.lastWeatherAt <= 10 * 60 * 1000;
}

function markIpWeatherContext(ip) {
  const key = String(ip || "unknown");
  assistantContextMap.set(key, { lastWeatherAt: Date.now() });
}

function isWeatherAssistantQuery(message, history, ip) {
  const normalized = normalizeAssistantQueryKey(message);
  if (
    /\b(weather|forecast|temperature|temp|meteo|vreme|temperatura)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  return (
    isLikelyCityFollowUp(message) &&
    (hasRecentWeatherContext(history) || hasIpWeatherContext(ip))
  );
}

function extractCityFromWeatherQuery(message) {
  const raw = String(message || "").trim();
  if (!raw) {
    return "";
  }

  const patterns = [
    /\b(?:in|for|la)\s+([a-zA-Z\s\-']{2,50})/i,
    /\b(?:din)\s+([a-zA-Z\s\-']{2,50})/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match || !match[1]) {
      continue;
    }

    let city = String(match[1]).trim();
    city = city
      .replace(
        /\b(now|right now|currently|today|tomorrow|acum|azi|maine)\b/gi,
        "",
      )
      .trim();
    city = city.replace(/[?.!,;:]+$/g, "").trim();
    if (city) {
      return city;
    }
  }

  return "";
}

function getWeatherCodeDescription(code, language) {
  const map = {
    0: { en: "clear sky", ro: "cer senin" },
    1: { en: "mostly clear", ro: "mai mult senin" },
    2: { en: "partly cloudy", ro: "partial noros" },
    3: { en: "overcast", ro: "noros" },
    45: { en: "fog", ro: "ceata" },
    48: { en: "fog", ro: "ceata" },
    51: { en: "light drizzle", ro: "burnita usoara" },
    53: { en: "drizzle", ro: "burnita" },
    55: { en: "dense drizzle", ro: "burnita intensa" },
    61: { en: "light rain", ro: "ploaie usoara" },
    63: { en: "rain", ro: "ploaie" },
    65: { en: "heavy rain", ro: "ploaie puternica" },
    71: { en: "light snow", ro: "ninsoare usoara" },
    73: { en: "snow", ro: "ninsoare" },
    75: { en: "heavy snow", ro: "ninsoare abundenta" },
    80: { en: "rain showers", ro: "averse" },
    81: { en: "rain showers", ro: "averse" },
    82: { en: "strong rain showers", ro: "averse puternice" },
    95: { en: "thunderstorm", ro: "furtuna" },
  };

  const entry = map[Number(code)] || {
    en: "variable conditions",
    ro: "conditii variabile",
  };
  return language === "ro" ? entry.ro : entry.en;
}

async function geocodeCityByName(city, language) {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${language}&format=json`,
  );
  if (!response.ok) {
    throw new Error("Could not resolve city coordinates.");
  }

  const data = await response.json();
  const result = Array.isArray(data?.results) ? data.results[0] : null;
  if (!result) {
    throw new Error("City not found.");
  }

  return {
    city: String(result.name || city),
    country: String(result.country || ""),
    latitude: Number(result.latitude),
    longitude: Number(result.longitude),
  };
}

async function fetchCurrentWeatherForCoords(latitude, longitude) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`,
  );
  if (!response.ok) {
    throw new Error("Could not load current weather.");
  }

  const data = await response.json();
  const current = data?.current;
  if (!current || !Number.isFinite(Number(current.temperature_2m))) {
    throw new Error("Incomplete weather data.");
  }

  return {
    temperature: Number(current.temperature_2m),
    weatherCode: Number(current.weather_code),
    windSpeed: Number(current.wind_speed_10m),
  };
}

async function buildWeatherAssistantResponse(message, ip) {
  const language = detectAssistantLanguage(message);
  const requestedCity = extractCityFromWeatherQuery(message);

  let place = null;
  if (requestedCity) {
    place = await geocodeCityByName(requestedCity, language);
  } else {
    const approx = await resolveApproxLocationByIp(ip);
    place = {
      city: approx.city || (language === "ro" ? "locatia ta" : "your location"),
      country: approx.country || "",
      latitude: approx.latitude,
      longitude: approx.longitude,
    };
  }

  const weather = await fetchCurrentWeatherForCoords(
    place.latitude,
    place.longitude,
  );
  const summary = getWeatherCodeDescription(weather.weatherCode, language);
  const cityLabel = place.country
    ? `${place.city}, ${place.country}`
    : String(place.city || "");

  if (language === "ro") {
    return {
      reply: `Acum in ${cityLabel}: ${weather.temperature.toFixed(1)}C, ${summary}, vant ${weather.windSpeed.toFixed(0)} km/h.`,
      suggestions: [
        `prognoza meteo azi in ${place.city}`,
        `vreme maine in ${place.city}`,
        `temperatura saptamana aceasta in ${place.city}`,
      ],
    };
  }

  return {
    reply: `Current weather in ${cityLabel}: ${weather.temperature.toFixed(1)}C, ${summary}, wind ${weather.windSpeed.toFixed(0)} km/h.`,
    suggestions: [
      `today weather in ${place.city}`,
      `tomorrow forecast in ${place.city}`,
      `weekly temperature in ${place.city}`,
    ],
  };
}

function isDateOrNewsAssistantQuery(message) {
  const normalized = normalizeAssistantQueryKey(message);
  const asksDate =
    /\b(ce zi|ce zii|ce data|ce dat[ae] e azi|azi ce zi|today|what day|what date|current date|current day)\b/.test(
      normalized,
    );
  const asksNews =
    /\b(stiri|stire|noutati|news|headlines|breaking|ce mai e nou)\b/.test(
      normalized,
    );

  return { asksDate, asksNews, enabled: asksDate || asksNews };
}

function formatCurrentDateLabel(language) {
  const now = new Date();
  const locale = language === "ro" ? "ro-RO" : "en-US";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
    now,
  );
  const dateLabel = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return { weekday, dateLabel };
}

function extractHeadlinesFromRss(xmlText, limit = 3) {
  const titles = [];
  const regex = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
  let match = regex.exec(String(xmlText || ""));
  while (match) {
    const raw = String(match[1] || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    if (
      raw &&
      !/google news|stiri google|știri google|cele mai populare subiecte/i.test(
        raw,
      ) &&
      !titles.includes(raw)
    ) {
      titles.push(raw);
    }

    if (titles.length >= limit + 1) {
      break;
    }
    match = regex.exec(String(xmlText || ""));
  }

  return titles.slice(0, limit);
}

async function fetchTopNewsHeadlines(language) {
  const isRo = language === "ro";
  const url = isRo
    ? "https://news.google.com/rss?hl=ro&gl=RO&ceid=RO:ro"
    : "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`News feed unavailable (${response.status}).`);
  }

  const xmlText = await response.text();
  return extractHeadlinesFromRss(xmlText, 3);
}

async function buildDateNewsAssistantResponse(message) {
  const language = detectAssistantLanguage(message);
  const intent = isDateOrNewsAssistantQuery(message);
  const dateNow = formatCurrentDateLabel(language);
  let headlines = [];

  if (intent.asksNews) {
    try {
      headlines = await fetchTopNewsHeadlines(language);
    } catch {
      headlines = [];
    }
  }

  if (language === "ro") {
    if (intent.asksDate && intent.asksNews) {
      const newsLine =
        headlines.length > 0
          ? `Top stiri acum: ${headlines.join(" | ")}.`
          : "Nu am putut incarca fluxul live de stiri chiar acum.";
      return {
        reply: `Astazi este ${dateNow.weekday}, ${dateNow.dateLabel}. ${newsLine}`,
        suggestions: [
          "rezuma prima stire",
          "stiri business azi",
          "stiri tech azi",
        ],
      };
    }

    if (intent.asksDate) {
      return {
        reply: `Astazi este ${dateNow.weekday}, ${dateNow.dateLabel}.`,
        suggestions: ["ce ora este acum", "vremea de azi", "agenda pentru azi"],
      };
    }

    return {
      reply:
        headlines.length > 0
          ? `Top stiri acum: ${headlines.join(" | ")}.`
          : "Nu am putut incarca fluxul live de stiri chiar acum.",
      suggestions: [
        "rezuma prima stire",
        "stiri economice azi",
        "stiri internationale azi",
      ],
    };
  }

  if (intent.asksDate && intent.asksNews) {
    const newsLine =
      headlines.length > 0
        ? `Top news now: ${headlines.join(" | ")}.`
        : "I could not load the live news feed right now.";
    return {
      reply: `Today is ${dateNow.weekday}, ${dateNow.dateLabel}. ${newsLine}`,
      suggestions: [
        "summarize headline 1",
        "business news today",
        "tech news today",
      ],
    };
  }

  if (intent.asksDate) {
    return {
      reply: `Today is ${dateNow.weekday}, ${dateNow.dateLabel}.`,
      suggestions: ["current time", "today weather", "plan my day"],
    };
  }

  return {
    reply:
      headlines.length > 0
        ? `Top news now: ${headlines.join(" | ")}.`
        : "I could not load the live news feed right now.",
    suggestions: [
      "summarize headline 1",
      "economic news today",
      "international news today",
    ],
  };
}

function storeAssistantMemory({ ip, message, reply, provider, helper, model }) {
  const db = readJson(assistantMemoryPath, { chats: [] });
  const chats = Array.isArray(db.chats) ? db.chats : [];
  chats.push({
    id: `a-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    ip: String(ip || "unknown"),
    message: String(message || "").slice(0, ASSISTANT_MAX_CHARS),
    reply: String(reply || "").slice(0, 600),
    provider: String(provider || "unknown"),
    helper: String(helper || "general"),
    model: String(model || "unknown"),
    at: new Date().toISOString(),
  });

  db.chats = chats.slice(-ASSISTANT_MEMORY_MAX_ITEMS);
  writeJson(assistantMemoryPath, db);
}

function getAssistantMemorySummary() {
  const db = readJson(assistantMemoryPath, { chats: [] });
  const chats = Array.isArray(db.chats) ? db.chats : [];
  const last = chats[chats.length - 1] || null;
  return {
    totalChats: chats.length,
    lastChatAt: last ? String(last.at || "") : "",
  };
}

function extractJsonPayload(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    // Continue with best-effort extraction.
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = raw.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }

  return null;
}

function buildAssistantSystemPrompt(helper) {
  const helperPrompt =
    helper === "writing"
      ? "Focus on writing help: drafting, rewriting, polishing tone, and concise copy improvements."
      : "Focus on broad practical help, explanation, planning, and actionable guidance.";

  return (
    "You are MAGNETO Assistant, a universal assistant for general conversation and practical help. " +
    `${helperPrompt} ` +
    "Weather-specific live data is handled separately by system tools. " +
    'Respond naturally in plain text. JSON format is optional: {"reply": string, "suggestions": string[]}. ' +
    "Provide complete, useful answers with clear structure when needed. Match the user's language by default. " +
    "If user asks to change language, switch immediately and continue in that language. " +
    "Suggestions, if included, should be concise and useful next prompts in the same language as your reply unless the user requests another language."
  );
}

function buildSafeAssistantHistory(history) {
  return Array.isArray(history)
    ? history
        .filter(
          (item) =>
            item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string",
        )
        .slice(-ASSISTANT_HISTORY_MESSAGES)
        .map((item) => ({
          role: item.role,
          content: String(item.content || "").slice(0, ASSISTANT_HISTORY_CHARS),
        }))
    : [];
}

function parseAssistantModelOutput(content) {
  const parsed = extractJsonPayload(content);
  if (parsed && typeof parsed.reply === "string") {
    return {
      reply:
        parsed.reply.trim().slice(0, ASSISTANT_REPLY_MAX_CHARS) ||
        "Try a narrower follow-up prompt.",
      suggestions: normalizeAssistantSuggestions(parsed.suggestions),
    };
  }

  return {
    reply:
      String(content || "").slice(0, ASSISTANT_REPLY_MAX_CHARS) ||
      "Try a narrower follow-up prompt.",
    suggestions: [],
  };
}

async function generateAssistantResponseOpenAI({ message, history, helper }) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured.");
  }

  const model = getActiveProviderModel("openai") || OPENAI_MODEL;
  const safeHistory = buildSafeAssistantHistory(history);
  const payload = {
    model,
    temperature: ASSISTANT_MODEL_TEMPERATURE,
    max_tokens: ASSISTANT_OPENAI_MAX_TOKENS,
    messages: [
      { role: "system", content: buildAssistantSystemPrompt(helper) },
      ...safeHistory,
      { role: "user", content: String(message || "") },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerError =
      data?.error?.message || `OpenAI provider error (${response.status}).`;
    throw new Error(providerError);
  }

  const content = String(data?.choices?.[0]?.message?.content || "").trim();
  const parsed = parseAssistantModelOutput(content);
  return {
    provider: "openai",
    model,
    ...parsed,
  };
}

async function generateAssistantResponseAnthropic({
  message,
  history,
  helper,
}) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Anthropic is not configured.");
  }

  const model = getActiveProviderModel("anthropic") || ANTHROPIC_MODEL;

  const safeHistory = buildSafeAssistantHistory(history).map((item) => ({
    role: item.role,
    content: item.content,
  }));

  const payload = {
    model,
    max_tokens: ASSISTANT_ANTHROPIC_MAX_TOKENS,
    temperature: ASSISTANT_MODEL_TEMPERATURE,
    system: buildAssistantSystemPrompt(helper),
    messages: [
      ...safeHistory,
      { role: "user", content: String(message || "") },
    ],
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerError =
      data?.error?.message || `Anthropic provider error (${response.status}).`;
    throw new Error(providerError);
  }

  const content = Array.isArray(data?.content)
    ? data.content
        .filter((item) => item && item.type === "text")
        .map((item) => String(item.text || ""))
        .join("\n")
    : "";
  const parsed = parseAssistantModelOutput(content);
  return {
    provider: "anthropic",
    model,
    ...parsed,
  };
}

async function generateAssistantResponseGemini({ message, history, helper }) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini is not configured.");
  }

  const model = getActiveProviderModel("gemini") || GEMINI_MODEL;

  const safeHistory = buildSafeAssistantHistory(history);
  const conversation = [
    ...safeHistory.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    })),
    { role: "user", parts: [{ text: String(message || "") }] },
  ];

  const payload = {
    systemInstruction: {
      parts: [{ text: buildAssistantSystemPrompt(helper) }],
    },
    contents: conversation,
    generationConfig: {
      temperature: ASSISTANT_MODEL_TEMPERATURE,
      maxOutputTokens: ASSISTANT_GEMINI_MAX_TOKENS,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerError =
      data?.error?.message || `Gemini provider error (${response.status}).`;
    throw new Error(providerError);
  }

  const text = Array.isArray(data?.candidates)
    ? data.candidates
        .flatMap((candidate) => candidate?.content?.parts || [])
        .map((part) => String(part?.text || ""))
        .join("\n")
    : "";

  const parsed = parseAssistantModelOutput(text);
  return {
    provider: "gemini",
    model,
    ...parsed,
  };
}

function isProviderConfigured(provider) {
  if (provider === "openai") {
    return Boolean(OPENAI_API_KEY);
  }

  if (provider === "anthropic") {
    return Boolean(ANTHROPIC_API_KEY);
  }

  if (provider === "gemini") {
    return Boolean(GEMINI_API_KEY);
  }

  return false;
}

function getAssistantProviderOrder() {
  const ordered = [
    ...AI_PROVIDER_ORDER,
    AI_PRIMARY_PROVIDER,
    AI_FALLBACK_PROVIDER,
    "openai",
    "anthropic",
    "gemini",
  ];
  const unique = [];
  for (const provider of ordered) {
    if (!unique.includes(provider)) {
      unique.push(provider);
    }
  }

  return unique;
}

function getHelperPreferredProviders(helper) {
  if (helper === "writing") {
    return ["anthropic", "openai", "gemini"];
  }

  return ["openai", "gemini", "anthropic"];
}

function getProviderHealth(provider) {
  return (
    assistantProviderHealthMap.get(provider) || {
      failures: 0,
      cooldownUntil: 0,
      lastError: "",
      lastErrorAt: "",
    }
  );
}

function getProviderModelCandidates(provider) {
  if (provider === "openai") {
    return OPENAI_MODEL_CANDIDATES;
  }

  if (provider === "anthropic") {
    return ANTHROPIC_MODEL_CANDIDATES;
  }

  if (provider === "gemini") {
    return GEMINI_MODEL_CANDIDATES;
  }

  return [];
}

function getActiveProviderModel(provider) {
  const candidates = getProviderModelCandidates(provider);
  if (candidates.length === 0) {
    return "";
  }

  const state = assistantProviderModelStateMap.get(provider) || { index: 0 };
  const safeIndex = Math.max(
    0,
    Math.min(state.index || 0, candidates.length - 1),
  );
  state.index = safeIndex;
  assistantProviderModelStateMap.set(provider, state);
  return candidates[safeIndex];
}

function advanceProviderModelCandidate(provider) {
  const candidates = getProviderModelCandidates(provider);
  if (candidates.length <= 1) {
    return false;
  }

  const state = assistantProviderModelStateMap.get(provider) || { index: 0 };
  if (state.index >= candidates.length - 1) {
    return false;
  }

  state.index += 1;
  assistantProviderModelStateMap.set(provider, state);
  return true;
}

function shouldRotateModelOnError(error) {
  const text = String(error?.message || "").toLowerCase();
  return /(model|not found|unknown model|does not exist|deprecated|unsupported)/.test(
    text,
  );
}

function markProviderSuccess(provider) {
  const state = getProviderHealth(provider);
  state.failures = 0;
  state.cooldownUntil = 0;
  state.lastError = "";
  state.lastErrorAt = "";
  assistantProviderHealthMap.set(provider, state);
}

function markProviderFailure(provider, error) {
  const state = getProviderHealth(provider);
  state.failures += 1;
  const cooldownSeconds = Math.min(120, 8 * state.failures);
  state.cooldownUntil = Date.now() + cooldownSeconds * 1000;
  state.lastError = String(error?.message || "Provider unavailable");
  state.lastErrorAt = new Date().toISOString();
  assistantProviderHealthMap.set(provider, state);
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function rankProvidersSmart(availableProviders, helper) {
  const preferred = getHelperPreferredProviders(helper);
  const now = Date.now();

  return [...availableProviders]
    .map((provider) => {
      const prefIndex = preferred.indexOf(provider);
      const prefScore = prefIndex === -1 ? 0 : preferred.length - prefIndex;
      const health = getProviderHealth(provider);
      const inCooldown = health.cooldownUntil > now ? 1 : 0;
      const failurePenalty = Math.min(3, Number(health.failures || 0));
      const jitter = Math.random() * 0.35;
      const score = prefScore + jitter - failurePenalty - inCooldown * 10;
      return { provider, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.provider);
}

function selectProvidersForRequest(helper) {
  const configured = getAssistantProviderOrder().filter((provider) =>
    isProviderConfigured(provider),
  );

  if (AI_ROUTING_MODE === "random") {
    return shuffleArray(configured);
  }

  if (AI_ROUTING_MODE === "priority") {
    return configured;
  }

  return rankProvidersSmart(configured, helper);
}

async function generateAssistantResponse({ message, history, helper }) {
  const providers = selectProvidersForRequest(helper);
  if (providers.length === 0) {
    throw new Error("No AI provider is configured.");
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      if (provider === "openai") {
        const result = await generateAssistantResponseOpenAI({
          message,
          history,
          helper,
        });
        markProviderSuccess(provider);
        return result;
      }

      if (provider === "anthropic") {
        const result = await generateAssistantResponseAnthropic({
          message,
          history,
          helper,
        });
        markProviderSuccess(provider);
        return result;
      }

      if (provider === "gemini") {
        const result = await generateAssistantResponseGemini({
          message,
          history,
          helper,
        });
        markProviderSuccess(provider);
        return result;
      }
    } catch (error) {
      if (shouldRotateModelOnError(error)) {
        const rotated = advanceProviderModelCandidate(provider);
        if (rotated) {
          try {
            if (provider === "openai") {
              const retryOpenAi = await generateAssistantResponseOpenAI({
                message,
                history,
                helper,
              });
              markProviderSuccess(provider);
              return retryOpenAi;
            }

            if (provider === "anthropic") {
              const retryAnthropic = await generateAssistantResponseAnthropic({
                message,
                history,
                helper,
              });
              markProviderSuccess(provider);
              return retryAnthropic;
            }

            if (provider === "gemini") {
              const retryGemini = await generateAssistantResponseGemini({
                message,
                history,
                helper,
              });
              markProviderSuccess(provider);
              return retryGemini;
            }
          } catch (retryError) {
            markProviderFailure(provider, retryError);
            lastError = retryError;
            continue;
          }
        }
      }

      markProviderFailure(provider, error);
      lastError = error;
    }
  }

  throw lastError || new Error("All AI providers failed.");
}

function sanitizeIpForLookup(ip) {
  const value = String(ip || "").trim();
  if (!value || value === "unknown") {
    return "";
  }

  if (
    value === "::1" ||
    value === "127.0.0.1" ||
    value === "::ffff:127.0.0.1"
  ) {
    return "";
  }

  if (value.startsWith("::ffff:")) {
    return value.slice(7);
  }

  return value;
}

async function fetchLocationFromProvider(url, parser) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Provider failed with status ${response.status}`);
  }

  const data = await response.json();
  const parsed = parser(data);
  if (
    !parsed ||
    !Number.isFinite(parsed.latitude) ||
    !Number.isFinite(parsed.longitude)
  ) {
    throw new Error("Provider returned invalid coordinates.");
  }

  return parsed;
}

async function resolveApproxLocationByIp(ip) {
  const cleanIp = sanitizeIpForLookup(ip);
  const providers = [
    {
      url: cleanIp
        ? `https://ipwho.is/${encodeURIComponent(cleanIp)}`
        : "https://ipwho.is/",
      parser: (data) => {
        if (!data || data.success === false) {
          return null;
        }

        return {
          source: "ipwho.is",
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          city: String(data.city || ""),
          country: String(data.country || ""),
        };
      },
    },
    {
      url: cleanIp
        ? `https://ipapi.co/${encodeURIComponent(cleanIp)}/json/`
        : "https://ipapi.co/json/",
      parser: (data) => {
        if (!data || data.error) {
          return null;
        }

        return {
          source: "ipapi.co",
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          city: String(data.city || ""),
          country: String(data.country_name || ""),
        };
      },
    },
  ];

  for (const provider of providers) {
    try {
      return await fetchLocationFromProvider(provider.url, provider.parser);
    } catch {
      // Try next provider.
    }
  }

  throw new Error("All IP location providers failed.");
}

function tokenize(query) {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "au",
    "cu",
    "da",
    "de",
    "din",
    "do",
    "for",
    "from",
    "in",
    "la",
    "of",
    "on",
    "or",
    "pe",
    "si",
    "sunt",
    "the",
    "to",
    "un",
    "una",
  ]);

  return String(query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(
      (token) => Boolean(token) && token.length >= 2 && !stopwords.has(token),
    );
}

const QUERY_SYNONYMS = {
  ai: ["artificial", "intelligence", "machine", "learning", "llm"],
  ml: ["machine", "learning"],
  js: ["javascript"],
  ux: ["design", "experience"],
  ui: ["interface", "design"],
  go: ["golang"],
  db: ["database"],
  // Romanian technical term translations
  baze: ["database"],
  indexare: ["indexing", "index"],
  ghid: ["guide", "tutorial"],
  joburi: ["jobs"],
  stiri: ["news"],
  documentatie: ["documentation", "docs", "reference", "manual"],
  programare: ["programming", "coding", "code"],
  curs: ["course", "tutorial", "guide"],
  incepatori: ["beginner", "beginners", "basics", "starter"],
  cercetare: ["research", "paper", "study", "academic"],
  imagini: ["images", "photos", "pictures", "media"],
};

const OPTIONAL_QUERY_TOKENS = new Set([
  // English query modifiers
  "best",
  "explained",
  "guide",
  "guides",
  "latest",
  "new",
  "now",
  "recent",
  "recently",
  "simple",
  "today",
  "tutorial",
  "tutorials",
  // Romanian prepositions and articles (shouldn't count toward coverage)
  "de", // of
  "din", // from
  "la", // to/at
  "cu", // with
  "si", // and
  "in", // in
  "pe", // on
  "pentru", // for
  "sau", // or
  // Romanian temporal modifiers
  "ultimele",
  "ultima",
  "ultimul",
  "azi",
  "acum",
  "nou",
  "noua",
  "noi",
  "recent",
  "recente",
]);

const COVERAGE_THRESHOLD_BY_INTENT = {
  code: 0.65,
  docs: 0.65,
  images: 0.45,
  jobs: 0.55,
  news: 0.45,
  research: 0.75,
};

const SOURCE_AUTHORITY_BOOSTS = {
  "arxiv.org": 6,
  "bbc.com": 4,
  "developer.mozilla.org": 6,
  "docs.python.org": 6,
  "github.com": 4,
  "kaggle.com": 3,
  "learn.microsoft.com": 6,
  "medium.com": 1,
  "mongodb.com": 4,
  "nature.com": 6,
  "nodejs.org": 5,
  "openai.com": 4,
  "postgresql.org": 5,
  "pubmed.ncbi.nlm.nih.gov": 7,
  "pytorch.org": 5,
  "python.org": 5,
  "react.dev": 5,
  "reuters.com": 5,
  "sciencedirect.com": 5,
  "semanticscholar.org": 5,
  "stackoverflow.com": 4,
  "theguardian.com": 3,
  "wikipedia.org": 4,
};

const SEARCH_RANKING_CONFIG_LIMITS = {
  coverageMax: 0.95,
  coverageMin: 0.35,
  sourceBoostMax: 20,
  sourceBoostMin: 0,
};

let rankingConfigCache = null;

function normalizeRankingCoverageConfig(input) {
  const merged = {
    ...COVERAGE_THRESHOLD_BY_INTENT,
    ...(input && typeof input === "object" ? input : {}),
  };

  const normalized = {};
  for (const [intent, value] of Object.entries(merged)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      continue;
    }
    normalized[intent] = Math.min(
      SEARCH_RANKING_CONFIG_LIMITS.coverageMax,
      Math.max(SEARCH_RANKING_CONFIG_LIMITS.coverageMin, numeric),
    );
  }

  return normalized;
}

function normalizeRankingSourceBoostConfig(input) {
  const merged = {
    ...SOURCE_AUTHORITY_BOOSTS,
    ...(input && typeof input === "object" ? input : {}),
  };

  const normalized = {};
  for (const [host, value] of Object.entries(merged)) {
    const key = String(host || "")
      .trim()
      .toLowerCase();
    if (!key) {
      continue;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      continue;
    }

    normalized[key] = Math.round(
      Math.min(
        SEARCH_RANKING_CONFIG_LIMITS.sourceBoostMax,
        Math.max(SEARCH_RANKING_CONFIG_LIMITS.sourceBoostMin, numeric),
      ),
    );
  }

  return normalized;
}

function normalizeRankingOptionalTokens(input) {
  const tokens = Array.isArray(input) ? input : [...OPTIONAL_QUERY_TOKENS];
  const normalized = [];
  const seen = new Set();

  for (const tokenRaw of tokens) {
    const token = String(tokenRaw || "")
      .trim()
      .toLowerCase();
    if (!token || token.length < 2 || token.length > 40) {
      continue;
    }
    if (!/^[\p{L}\p{N}]+$/u.test(token)) {
      continue;
    }
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    normalized.push(token);
  }

  return normalized.length > 0
    ? normalized
    : [...OPTIONAL_QUERY_TOKENS].map((token) => token.toLowerCase());
}

function normalizeSearchRankingConfig(input) {
  const payload = input && typeof input === "object" ? input : {};
  return {
    coverageThresholdByIntent: normalizeRankingCoverageConfig(
      payload.coverageThresholdByIntent,
    ),
    sourceAuthorityBoosts: normalizeRankingSourceBoostConfig(
      payload.sourceAuthorityBoosts,
    ),
    optionalQueryTokens: normalizeRankingOptionalTokens(
      payload.optionalQueryTokens,
    ),
  };
}

function readSearchRankingConfig() {
  const raw = readJson(rankingConfigPath, {});
  return normalizeSearchRankingConfig(raw);
}

function writeSearchRankingConfig(config) {
  const normalized = normalizeSearchRankingConfig(config);
  writeJson(rankingConfigPath, normalized);
  rankingConfigCache = normalized;
  return normalized;
}

function getSearchRankingConfig() {
  if (!rankingConfigCache) {
    rankingConfigCache = readSearchRankingConfig();
  }
  return rankingConfigCache;
}

function resetSearchRankingConfig() {
  rankingConfigCache = null;
  return writeSearchRankingConfig({
    coverageThresholdByIntent: COVERAGE_THRESHOLD_BY_INTENT,
    sourceAuthorityBoosts: SOURCE_AUTHORITY_BOOSTS,
    optionalQueryTokens: [...OPTIONAL_QUERY_TOKENS],
  });
}

const CATEGORY_FRESHNESS_BASE_DAYS = {
  news: 1,
  media: 3,
  technology: 5,
  ai: 7,
  cloud: 12,
  development: 18,
  "data science": 18,
  finance: 12,
  science: 20,
  education: 24,
  career: 20,
  research: 28,
  knowledge: 45,
};

let localSearchArtifactsCache = {
  mtimeMs: -1,
  size: -1,
  docs: [],
  tokenDfMap: new Map(),
  vocabulary: [],
  docCount: 0,
};
let clickSignalCache = {
  expiresAt: 0,
  queryUrlCounts: new Map(),
  queryCounts: new Map(),
  urlCounts: new Map(),
};

function getSearchIndexFileFingerprint() {
  try {
    const stats = fs.statSync(searchIndexPath);
    return {
      mtimeMs: Number(stats.mtimeMs || 0),
      size: Number(stats.size || 0),
    };
  } catch {
    return {
      mtimeMs: 0,
      size: 0,
    };
  }
}

function buildLocalSearchArtifacts() {
  const index = readJson(searchIndexPath, []);
  const docs = index.map((doc) => normalizeIndexedDoc(doc));
  const tokenDfMap = new Map();
  const vocabulary = new Set();

  for (const doc of docs) {
    const uniqueDocTokens = new Set();
    const tokenBuckets = [
      tokenize(doc.title || ""),
      tokenize(doc.summary || ""),
      tokenize(doc.category || ""),
      tokenize(doc.url || ""),
      ...(Array.isArray(doc.tags)
        ? doc.tags.map((tag) => tokenize(String(tag || "")))
        : []),
    ];

    for (const bucket of tokenBuckets) {
      for (const token of bucket) {
        uniqueDocTokens.add(token);
        if (token.length >= 3) {
          vocabulary.add(token);
        }
      }
    }

    for (const token of uniqueDocTokens) {
      tokenDfMap.set(token, (tokenDfMap.get(token) || 0) + 1);
    }
  }

  return {
    docs,
    tokenDfMap,
    vocabulary: [...vocabulary],
    docCount: docs.length,
  };
}

function getLocalSearchArtifacts() {
  const fingerprint = getSearchIndexFileFingerprint();
  const cache = localSearchArtifactsCache;
  const unchanged =
    cache.mtimeMs === fingerprint.mtimeMs && cache.size === fingerprint.size;
  if (unchanged && Array.isArray(cache.docs) && cache.docs.length > 0) {
    return cache;
  }

  const built = buildLocalSearchArtifacts();
  localSearchArtifactsCache = {
    ...built,
    mtimeMs: fingerprint.mtimeMs,
    size: fingerprint.size,
  };
  return localSearchArtifactsCache;
}

function buildClickSignalArtifacts() {
  const analytics = readJson(analyticsPath, {
    searches: [],
    pageViews: [],
    resultClicks: [],
  });
  const resultClicks = Array.isArray(analytics.resultClicks)
    ? analytics.resultClicks
    : [];
  const now = Date.now();
  const oldestMs = now - CLICK_SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const halfLifeMs = CLICK_SIGNAL_DECAY_HALFLIFE_DAYS * 24 * 60 * 60 * 1000;
  const queryUrlCounts = new Map();
  const queryCounts = new Map();
  const urlCounts = new Map();

  for (const item of resultClicks) {
    const clickedAt = Date.parse(String(item?.at || ""));
    if (!Number.isFinite(clickedAt) || clickedAt < oldestMs) {
      continue;
    }

    const normalizedUrl = normalizeIndexUrl(item?.url || "");
    const normalizedQuery = normalizeSearchText(item?.query || "");
    if (!normalizedUrl || !normalizedQuery) {
      continue;
    }

    const ageMs = Math.max(0, now - clickedAt);
    const decayWeight = Math.max(
      CLICK_SIGNAL_DECAY_MIN_WEIGHT,
      Math.pow(0.5, ageMs / Math.max(1, halfLifeMs)),
    );

    const queryUrlKey = `${normalizedQuery}||${normalizedUrl}`;
    queryUrlCounts.set(
      queryUrlKey,
      (queryUrlCounts.get(queryUrlKey) || 0) + decayWeight,
    );
    queryCounts.set(
      normalizedQuery,
      (queryCounts.get(normalizedQuery) || 0) + decayWeight,
    );
    urlCounts.set(
      normalizedUrl,
      (urlCounts.get(normalizedUrl) || 0) + decayWeight,
    );
  }

  return {
    queryUrlCounts,
    queryCounts,
    urlCounts,
  };
}

function getClickSignalArtifacts() {
  if (Date.now() < clickSignalCache.expiresAt) {
    return clickSignalCache;
  }

  const built = buildClickSignalArtifacts();
  clickSignalCache = {
    ...built,
    expiresAt: Date.now() + CLICK_SIGNAL_CACHE_TTL_MS,
  };
  return clickSignalCache;
}

function getResultClickBoost({ url, query, baseScore = 0, telemetry = null }) {
  const normalizedUrl = normalizeIndexUrl(url);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedUrl || !normalizedQuery) {
    if (telemetry && typeof telemetry === "object") {
      telemetry.reason = "invalid-input";
      telemetry.cappedByGuardrail = false;
      telemetry.boost = 0;
    }
    return 0;
  }

  const safeBaseScore = Number(baseScore || 0);
  if (safeBaseScore < CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE) {
    if (telemetry && typeof telemetry === "object") {
      telemetry.reason = "low-base-score";
      telemetry.cappedByGuardrail = false;
      telemetry.boost = 0;
    }
    return 0;
  }

  const clickArtifacts = getClickSignalArtifacts();
  const queryUrlKey = `${normalizedQuery}||${normalizedUrl}`;
  const exactPairClicks = Number(
    clickArtifacts.queryUrlCounts.get(queryUrlKey) || 0,
  );
  const queryClicks = Number(
    clickArtifacts.queryCounts.get(normalizedQuery) || 0,
  );
  const urlClicks = Number(clickArtifacts.urlCounts.get(normalizedUrl) || 0);

  if (exactPairClicks <= 0 && urlClicks <= 0 && queryClicks <= 0) {
    if (telemetry && typeof telemetry === "object") {
      telemetry.reason = "no-signal";
      telemetry.cappedByGuardrail = false;
      telemetry.boost = 0;
    }
    return 0;
  }

  const pairBoost = Math.log2(1 + exactPairClicks) * 2.5;
  const urlBoost = Math.log2(1 + urlClicks) * 0.8;
  const ctr = queryClicks > 0 ? exactPairClicks / queryClicks : 0;
  const ctrBoost = Math.min(
    CLICK_SIGNAL_CTR_MAX_BOOST,
    ctr * CLICK_SIGNAL_CTR_MAX_BOOST,
  );
  const uncappedBoost = pairBoost + urlBoost + ctrBoost;
  const maxByBase = safeBaseScore * CLICK_SIGNAL_GUARDRAIL_MAX_SHARE;
  const boost = Math.max(
    0,
    Math.min(CLICK_SIGNAL_MAX_BOOST, uncappedBoost, maxByBase),
  );
  if (telemetry && typeof telemetry === "object") {
    telemetry.reason = boost > 0 ? "applied" : "suppressed";
    telemetry.cappedByGuardrail = uncappedBoost > boost;
    telemetry.boost = boost;
  }
  return boost;
}

function computeFreshnessScore(fetchedAt) {
  const parsedFetchedAt = Date.parse(String(fetchedAt || ""));
  if (!Number.isFinite(parsedFetchedAt)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      100 - Math.floor((Date.now() - parsedFetchedAt) / (24 * 60 * 60 * 1000)),
    ),
  );
}

// Weight for freshness signal in relevance ranking (per intent type).
// News queries heavily weight recency; docs/code prefer stability.
function getFreshnessWeight(intents) {
  if (!Array.isArray(intents) || intents.length === 0) return 0.04;
  if (intents.includes("news")) return 0.18;
  if (intents.includes("jobs")) return 0.1;
  if (intents.includes("research")) return 0.06;
  if (intents.includes("docs") || intents.includes("code")) return 0.02;
  return 0.04;
}

function getTokenIdfWeight(token, tokenDfMap, docCount) {
  const docs = Math.max(1, Number(docCount || 1));
  const df = Number(tokenDfMap?.get(token) || 0);
  const weight = 1 + Math.log(1 + docs / (1 + df));
  return Number.isFinite(weight) ? weight : 1;
}

function extractQuotedPhrases(query) {
  const input = String(query || "");
  const phrases = [];
  const seen = new Set();
  const regex = /"([^"]{2,})"/g;
  let match = regex.exec(input);
  while (match) {
    const phrase = normalizeSearchText(match[1]);
    if (phrase && phrase.length >= 2 && !seen.has(phrase)) {
      seen.add(phrase);
      phrases.push(phrase);
    }
    match = regex.exec(input);
  }
  return phrases;
}

function stableHashString(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let idx = 0; idx < text.length; idx += 1) {
    hash ^= text.charCodeAt(idx);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function estimateFetchedAt(doc) {
  const explicit = String(doc.fetchedAt || doc.fetched_at || "").trim();
  if (explicit && Number.isFinite(Date.parse(explicit))) {
    return explicit;
  }

  const categoryKey = normalizeSearchText(doc.category || "");
  const baseDays = CATEGORY_FRESHNESS_BASE_DAYS[categoryKey] || 21;
  const spreadDays =
    stableHashString(doc.id || doc.url || doc.title || "") % 14;
  const totalDays = Math.max(0, baseDays + spreadDays);
  const date = new Date(Date.now() - totalDays * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

function expandQueryTokens(tokens) {
  const seen = new Set();
  const expanded = [];

  for (const token of tokens) {
    const candidates = [token, ...(QUERY_SYNONYMS[token] || [])];
    if (token.endsWith("ies") && token.length > 4) {
      candidates.push(`${token.slice(0, -3)}y`);
    }
    if (token.endsWith("ing") && token.length > 5) {
      candidates.push(token.slice(0, -3));
    }
    if (token.endsWith("ed") && token.length > 4) {
      candidates.push(token.slice(0, -2));
    }
    if (token.endsWith("es") && token.length > 4) {
      candidates.push(token.slice(0, -2));
    }
    if (token.endsWith("s") && token.length > 3) {
      candidates.push(token.slice(0, -1));
    }

    for (const candidate of candidates) {
      const clean = String(candidate || "")
        .trim()
        .toLowerCase();
      if (!clean || clean.length < 2 || seen.has(clean)) {
        continue;
      }
      seen.add(clean);
      expanded.push(clean);
    }
  }

  return expanded;
}

function isOneEditAway(left, right) {
  if (left === right) {
    return false;
  }
  if (Math.min(left.length, right.length) < 4) {
    return false;
  }
  if (Math.abs(left.length - right.length) > 1) {
    return false;
  }

  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) {
      return false;
    }

    if (left.length > right.length) {
      leftIndex += 1;
    } else if (right.length > left.length) {
      rightIndex += 1;
    } else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  if (leftIndex < left.length || rightIndex < right.length) {
    edits += 1;
  }

  return edits <= 1;
}

function scoreTokenAgainstField(token, fieldTokens, weights) {
  if (fieldTokens.some((candidate) => candidate === token)) {
    return weights.exact;
  }
  if (
    fieldTokens.some(
      (candidate) =>
        candidate !== token &&
        (candidate.startsWith(token) || token.startsWith(candidate)),
    )
  ) {
    return weights.prefix;
  }
  if (fieldTokens.some((candidate) => isOneEditAway(token, candidate))) {
    return weights.fuzzy;
  }
  if (
    fieldTokens.some(
      (candidate) =>
        candidate.length > token.length && candidate.includes(token),
    )
  ) {
    return weights.substring;
  }
  return 0;
}

function getDocTokenBuckets(doc) {
  return {
    title: tokenize(String(doc.title || "")),
    summary: tokenize(String(doc.summary || "")),
    category: tokenize(String(doc.category || "")),
    url: tokenize(
      String(doc.url || "")
        .replace(/https?:\/\//, "")
        .replace(/[.\-/_]/g, " "),
    ),
    tags: Array.isArray(doc.tags)
      ? doc.tags.flatMap((tag) => tokenize(String(tag || "")))
      : [],
  };
}

function doesFieldContainToken(token, fieldTokens) {
  return fieldTokens.some(
    (candidate) =>
      candidate === token ||
      candidate.startsWith(token) ||
      token.startsWith(candidate) ||
      isOneEditAway(token, candidate),
  );
}

function countMatchedQueryTokens(doc, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return 0;
  }

  // Expand tokens to include synonyms for matching
  const expandedTokens = expandQueryTokens(tokens);

  const buckets = getDocTokenBuckets(doc);
  const combined = [
    ...buckets.title,
    ...buckets.summary,
    ...buckets.category,
    ...buckets.url,
    ...buckets.tags,
  ];

  let matched = 0;
  for (const token of tokens) {
    // Check if this original token matches, or any of its synonyms match
    const tokenCandidates = [token, ...(QUERY_SYNONYMS[token] || [])];
    const anyMatch = tokenCandidates.some((candidate) =>
      doesFieldContainToken(candidate, combined),
    );
    if (anyMatch) {
      matched += 1;
    }
  }
  return matched;
}

function getSourceAuthorityBoost(doc, intents) {
  const rankingConfig = getSearchRankingConfig();
  const sourceBoosts =
    rankingConfig?.sourceAuthorityBoosts || SOURCE_AUTHORITY_BOOSTS;
  let hostname = "";
  try {
    hostname = new URL(String(doc.url || "")).hostname.replace(/^www\./, "");
  } catch {
    hostname = "";
  }

  if (!hostname) {
    return 0;
  }

  let boost = Number(sourceBoosts[hostname] || 0);
  if (hostname.endsWith(".edu") || hostname.endsWith(".ac.uk")) {
    boost = Math.max(boost, 4);
  }
  if (hostname.endsWith(".gov")) {
    boost = Math.max(boost, 5);
  }

  if (intents?.has("research")) {
    if (/arxiv|pubmed|nature|science|semanticscholar/.test(hostname)) {
      boost += 2;
    }
  }

  if (intents?.has("docs")) {
    if (
      /developer\.mozilla|learn\.microsoft|nodejs\.org|python\.org|react\.dev/.test(
        hostname,
      )
    ) {
      boost += 2;
    }
  }

  if (intents?.has("news")) {
    if (/reuters|bbc|theguardian/.test(hostname)) {
      boost += 2;
    }
  }

  return boost;
}

function getAdaptiveCoverageThreshold(intents, tokenCount) {
  const rankingConfig = getSearchRankingConfig();
  const coverageByIntent =
    rankingConfig?.coverageThresholdByIntent || COVERAGE_THRESHOLD_BY_INTENT;

  if (!intents || intents.size === 0) {
    return {
      ratio: 0.6,
      requiredMatches: Math.max(2, Math.min(4, Math.ceil(tokenCount * 0.6))),
    };
  }

  let ratio = 0.6;
  for (const intent of intents) {
    const candidate = coverageByIntent[intent];
    if (typeof candidate === "number") {
      ratio = Math.max(ratio, candidate);
    }
  }

  // Keep research strict for long queries, but avoid over-filtering short research prompts.
  if (intents.has("research") && tokenCount <= 3) {
    ratio = Math.min(ratio, 0.6);
  }

  const maxRequired = intents.has("research") ? 5 : 4;
  const requiredMatches = Math.max(
    2,
    Math.min(maxRequired, Math.ceil(tokenCount * ratio)),
  );

  return { ratio, requiredMatches };
}

function doesDocMeetCoverageThreshold(
  doc,
  tokens,
  phrases,
  rawQuery = "",
  intents = new Set(),
) {
  const rankingConfig = getSearchRankingConfig();
  const optionalTokenSet = new Set(
    rankingConfig?.optionalQueryTokens || [...OPTIONAL_QUERY_TOKENS],
  );

  if (!Array.isArray(tokens) || tokens.length <= 2) {
    return true;
  }

  const requiredTokens = tokens.filter(
    (token) => !optionalTokenSet.has(String(token || "").toLowerCase()),
  );
  const coverageTokens = requiredTokens.length > 0 ? requiredTokens : tokens;
  if (coverageTokens.length <= 2) {
    return true;
  }

  const normalizedTitle = normalizeSearchText(doc.title || "");
  const normalizedSummary = normalizeSearchText(doc.summary || "");
  const normalizedQuery = normalizeSearchText(rawQuery);

  if (
    normalizedQuery &&
    (normalizedTitle.includes(normalizedQuery) ||
      normalizedSummary.includes(normalizedQuery))
  ) {
    return true;
  }

  if (
    Array.isArray(phrases) &&
    phrases.some(
      (phrase) =>
        normalizedTitle.includes(phrase) || normalizedSummary.includes(phrase),
    )
  ) {
    return true;
  }

  const matchedTokens = countMatchedQueryTokens(doc, coverageTokens);
  const threshold = getAdaptiveCoverageThreshold(
    intents,
    coverageTokens.length,
  );
  return matchedTokens >= threshold.requiredMatches;
}

function computeScore(
  doc,
  tokens,
  { rawQuery = "", phrases = [], tokenDfMap = null, docCount = 1 } = {},
) {
  if (tokens.length === 0) {
    return 0;
  }

  const expandedTokens = expandQueryTokens(tokens);

  const titleTokens = tokenize(String(doc.title || ""));
  const summaryTokens = tokenize(String(doc.summary || ""));
  const categoryTokens = tokenize(String(doc.category || ""));
  const urlTokens = tokenize(
    String(doc.url || "")
      .replace(/https?:\/\//, "")
      .replace(/[.\-/_]/g, " "),
  );
  const tags = Array.isArray(doc.tags)
    ? doc.tags.flatMap((tag) => tokenize(String(tag || "")))
    : [];

  const titleArr = titleTokens;
  const summaryArr = summaryTokens;
  const categoryArr = categoryTokens;
  const urlArr = urlTokens;
  const tagsArr = tags;
  const normalizedTitle = String(doc.title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const normalizedSummary = String(doc.summary || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const normalizedQuery =
    normalizeSearchText(rawQuery) || tokens.join(" ").trim();
  const matchedOriginalTokens = countMatchedQueryTokens(doc, tokens);
  const coverageRatio =
    tokens.length > 0 ? matchedOriginalTokens / tokens.length : 0;

  let score = 0;

  for (const token of expandedTokens) {
    const tokenWeight = getTokenIdfWeight(token, tokenDfMap, docCount);
    let tokenScore = 0;

    tokenScore += scoreTokenAgainstField(token, titleArr, {
      exact: 6,
      prefix: 3,
      substring: 1,
      fuzzy: 2,
    });
    tokenScore += scoreTokenAgainstField(token, tagsArr, {
      exact: 4,
      prefix: 2,
      substring: 1,
      fuzzy: 1,
    });
    tokenScore += scoreTokenAgainstField(token, summaryArr, {
      exact: 3,
      prefix: 1,
      substring: 0,
      fuzzy: 1,
    });
    tokenScore += scoreTokenAgainstField(token, categoryArr, {
      exact: 2,
      prefix: 1,
      substring: 0,
      fuzzy: 0,
    });
    tokenScore += scoreTokenAgainstField(token, urlArr, {
      exact: 2,
      prefix: 1,
      substring: 0,
      fuzzy: 0,
    });

    score += tokenScore * tokenWeight;
  }

  if (normalizedQuery && normalizedQuery.length >= 4) {
    if (normalizedTitle.includes(normalizedQuery)) {
      score += 8;
    } else if (normalizedSummary.includes(normalizedQuery)) {
      score += 4;
    }
  }

  // Bonus: all query tokens match in title
  if (
    tokens.length > 1 &&
    tokens.every((token) => titleArr.some((t) => t.startsWith(token)))
  ) {
    score += 5;
  }

  if (normalizedQuery && normalizedTitle.startsWith(normalizedQuery)) {
    score += 5;
  }

  for (const phrase of phrases) {
    if (normalizedTitle.includes(phrase)) {
      score += 10;
    } else if (normalizedSummary.includes(phrase)) {
      score += 5;
    }
  }

  if (tokens.length > 1) {
    score += coverageRatio * 8;
    if (matchedOriginalTokens === tokens.length) {
      score += 6;
    }
  }

  return score;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeFilterValue(value) {
  return normalizeSearchText(value);
}

function detectDocumentLanguage(doc) {
  const explicit = String(doc.language || "")
    .trim()
    .toLowerCase();
  if (explicit) {
    return explicit;
  }

  const haystack = [
    doc.title,
    doc.summary,
    doc.category,
    ...(Array.isArray(doc.tags) ? doc.tags : []),
  ]
    .join(" ")
    .toLowerCase();

  if (/[ăâîșşțţ]/.test(haystack)) {
    return "ro";
  }

  const romanianHints = [
    "stiri",
    "ghid",
    "imagini",
    "poze",
    "romania",
    "vreme",
    "cautare",
  ];
  if (romanianHints.some((token) => haystack.includes(token))) {
    return "ro";
  }

  return "en";
}

function estimateDocumentQuality(doc) {
  const explicit = Number(doc.qualityScore || doc.quality_score || 0);
  if (explicit > 0) {
    return explicit;
  }

  const title = String(doc.title || "").trim();
  const summary = String(doc.summary || "").trim();
  const tagsCount = Array.isArray(doc.tags) ? doc.tags.length : 0;
  let score = 0;

  if (title.length >= 8) {
    score += 30;
  }
  if (summary.length >= 40) {
    score += 25;
  }
  score += Math.min(20, tagsCount * 4);
  score += Math.min(25, Math.round(summary.length / 16));

  return Math.min(score, 100);
}

function safeSearchLimit(limit, fallback = 20) {
  const parsed = Number.parseInt(String(limit || fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(50, parsed));
}

function safeSearchPage(page, fallback = 1) {
  const parsed = Number.parseInt(String(page || fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(500, parsed));
}

function getDocSourceInfo(doc) {
  const explicitName = String(doc.sourceName || doc.source || "").trim();
  const explicitSlug = String(doc.sourceSlug || "").trim();
  let hostname = "";

  try {
    hostname = new URL(String(doc.url || "")).hostname.replace(/^www\./, "");
  } catch {
    hostname = "";
  }

  const sourceName = explicitName || hostname;
  const sourceSlug =
    explicitSlug ||
    sourceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return {
    sourceName,
    sourceSlug,
  };
}

function normalizeIndexedDoc(doc) {
  const sourceInfo = getDocSourceInfo(doc);
  const fetchedAt = estimateFetchedAt(doc);
  const parsedFetchedAt = Date.parse(fetchedAt);
  const freshnessScore = Number.isFinite(parsedFetchedAt)
    ? Math.max(
        0,
        Math.min(
          100,
          100 -
            Math.floor((Date.now() - parsedFetchedAt) / (24 * 60 * 60 * 1000)),
        ),
      )
    : 0;

  return {
    ...doc,
    sourceName: sourceInfo.sourceName,
    sourceSlug: sourceInfo.sourceSlug,
    language: detectDocumentLanguage(doc),
    qualityScore: estimateDocumentQuality(doc),
    fetchedAt,
    freshnessScore,
  };
}

function rerankBySourceDiversity(
  items,
  { penaltyStep = 0.18, minFactor = 0.45 } = {},
) {
  if (!Array.isArray(items) || items.length <= 1) {
    return Array.isArray(items) ? items : [];
  }

  const sourceHits = new Map();
  const reranked = [];

  for (const item of items) {
    const sourceKey =
      normalizeFilterValue(item.sourceSlug || item.sourceName || "") ||
      "unknown";
    const hits = sourceHits.get(sourceKey) || 0;
    sourceHits.set(sourceKey, hits + 1);

    const factor = Math.max(minFactor, 1 - hits * penaltyStep);
    reranked.push({
      ...item,
      _finalScore: Number(item._score || 0) * factor,
    });
  }

  reranked.sort((left, right) => {
    if (right._finalScore !== left._finalScore) {
      return right._finalScore - left._finalScore;
    }
    return Number(right._score || 0) - Number(left._score || 0);
  });

  return reranked;
}

function detectQueryIntents(query, tokens) {
  const normalizedQuery = normalizeSearchText(query);
  const tokenSet = new Set(tokens);
  const intents = new Set();

  const hasAny = (values) => values.some((value) => tokenSet.has(value));

  if (
    hasAny([
      "news",
      "latest",
      "today",
      "breaking",
      "stiri",
      "noutati",
      "azi",
      "acum",
    ]) ||
    /\b(ce\s+mai\s+e\s+nou|ultime(le)?\s+stiri)\b/i.test(normalizedQuery)
  ) {
    intents.add("news");
  }

  if (
    hasAny([
      "job",
      "jobs",
      "career",
      "remote",
      "hiring",
      "work",
      "joburi",
      "angajare",
      "angajari",
      "cariere",
      "munca",
      "lucru",
    ])
  ) {
    intents.add("jobs");
  }

  if (
    hasAny([
      "image",
      "images",
      "photo",
      "photos",
      "poze",
      "imagini",
      "imagine",
      "foto",
    ])
  ) {
    intents.add("images");
  }

  if (
    hasAny([
      "docs",
      "documentation",
      "reference",
      "api",
      "manual",
      "documentatie",
      "referinta",
      "ghid",
    ])
  ) {
    intents.add("docs");
  }

  if (
    hasAny([
      "code",
      "coding",
      "programming",
      "tutorial",
      "debug",
      "cod",
      "programare",
      "depanare",
      "tutoriale",
    ])
  ) {
    intents.add("code");
  }

  if (
    hasAny([
      "paper",
      "papers",
      "research",
      "study",
      "academic",
      "cercetare",
      "studiu",
      "studii",
      "lucrare",
      "lucrari",
    ])
  ) {
    intents.add("research");
  }

  return intents;
}

function computeIntentBoost(doc, intents) {
  if (!intents || intents.size === 0) {
    return 0;
  }

  const category = normalizeFilterValue(doc.category || "");
  const source = normalizeFilterValue(doc.sourceName || doc.sourceSlug || "");
  const tags = Array.isArray(doc.tags)
    ? doc.tags.map((tag) => normalizeFilterValue(tag))
    : [];
  const title = normalizeFilterValue(doc.title || "");

  let boost = 0;

  if (intents.has("news")) {
    if (category === "news") {
      boost += 8;
    }
    if (category === "technology" || category === "media") {
      boost += 3;
    }
    if (
      ["reuters.com", "bbc.com", "theguardian.com", "techcrunch.com"].includes(
        source,
      )
    ) {
      boost += 4;
    }
  }

  if (intents.has("jobs")) {
    if (category === "career") {
      boost += 8;
    }
    if (
      tags.some((tag) =>
        ["jobs", "career", "remote", "recruitment"].includes(tag),
      )
    ) {
      boost += 4;
    }
  }

  if (intents.has("images")) {
    if (category === "media" || category === "knowledge") {
      boost += 3;
    }
    if (
      tags.some((tag) =>
        ["images", "photo", "photos", "photography"].includes(tag),
      )
    ) {
      boost += 6;
    }
  }

  if (intents.has("docs")) {
    if (
      tags.some((tag) =>
        ["documentation", "reference", "api", "manual"].includes(tag),
      )
    ) {
      boost += 7;
    }
    if (title.includes("documentation") || title.includes("docs")) {
      boost += 5;
    }
  }

  if (intents.has("code")) {
    if (category === "development") {
      boost += 7;
    }
    if (
      tags.some((tag) =>
        ["programming", "coding", "tutorial", "debugging"].includes(tag),
      )
    ) {
      boost += 4;
    }
  }

  if (intents.has("research")) {
    if (category === "research" || category === "science") {
      boost += 8;
    }
    if (
      tags.some((tag) =>
        ["papers", "research", "academic", "scholarly"].includes(tag),
      )
    ) {
      boost += 4;
    }
  }

  return boost;
}

function boundedLevenshtein(left, right, maxDistance = 2) {
  if (left === right) {
    return 0;
  }
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, idx) => idx);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      current.push(value);
      if (value < rowMin) {
        rowMin = value;
      }
    }
    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }
    previous = current;
  }
  return previous[right.length];
}

function buildSearchVocabulary(index) {
  const vocabulary = new Set();
  for (const doc of index) {
    tokenize(doc.title || "").forEach((token) => vocabulary.add(token));
    tokenize(doc.summary || "").forEach((token) => vocabulary.add(token));
    tokenize(doc.category || "").forEach((token) => vocabulary.add(token));
    tokenize(doc.url || "").forEach((token) => vocabulary.add(token));
    if (Array.isArray(doc.tags)) {
      doc.tags
        .flatMap((tag) => tokenize(String(tag || "")))
        .forEach((token) => vocabulary.add(token));
    }
  }
  return [...vocabulary].filter((token) => token.length >= 3);
}

function suggestQueryCorrection(query, source) {
  const rawQuery = String(query || "").trim();
  const tokens = tokenize(rawQuery);
  if (tokens.length === 0) {
    return null;
  }

  const vocabulary = Array.isArray(source)
    ? buildSearchVocabulary(source)
    : Array.isArray(source?.vocabulary)
      ? source.vocabulary
      : [];
  if (vocabulary.length === 0) {
    return null;
  }

  let changed = false;
  const correctedTokens = tokens.map((token) => {
    if (token.length < 4) {
      return token;
    }

    let bestCandidate = token;
    let bestDistance = 3;

    for (const candidate of vocabulary) {
      if (candidate === token) {
        return token;
      }
      if (Math.abs(candidate.length - token.length) > 2) {
        continue;
      }
      const distance = boundedLevenshtein(token, candidate, 2);
      if (distance < bestDistance) {
        bestCandidate = candidate;
        bestDistance = distance;
      }
      if (bestDistance === 1) {
        break;
      }
    }

    if (bestCandidate !== token && bestDistance <= 2) {
      changed = true;
      return bestCandidate;
    }

    return token;
  });

  if (!changed) {
    return null;
  }

  const correctedQuery = correctedTokens.join(" ").trim();
  if (!correctedQuery || correctedQuery === tokens.join(" ")) {
    return null;
  }

  return {
    originalQuery: rawQuery,
    correctedQuery,
  };
}

function buildSearchFacets(items) {
  const facets = {
    languages: new Map(),
    categories: new Map(),
    sources: new Map(),
  };

  for (const item of items) {
    const language = String(item.language || "").trim();
    const category = String(item.category || "").trim();
    const source = String(item.sourceName || item.sourceSlug || "").trim();

    if (language) {
      facets.languages.set(language, (facets.languages.get(language) || 0) + 1);
    }
    if (category) {
      facets.categories.set(
        category,
        (facets.categories.get(category) || 0) + 1,
      );
    }
    if (source) {
      facets.sources.set(source, (facets.sources.get(source) || 0) + 1);
    }
  }

  const toEntries = (map) =>
    [...map.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .map(([value, count]) => ({ value, count }));

  return {
    languages: toEntries(facets.languages),
    categories: toEntries(facets.categories),
    sources: toEntries(facets.sources),
  };
}

function escapeRegexTerm(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSnippetTermsFromQuery(query) {
  const parsed = parseSearchOperators(query);
  const cleaned = String(parsed.cleanedQuery || "");
  const tokens = tokenize(cleaned);
  const phrases = extractQuotedPhrases(cleaned)
    .map((item) =>
      String(item || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  return [...new Set([...phrases, ...tokens])]
    .filter((term) => term.length >= 2)
    .sort((left, right) => right.length - left.length)
    .slice(0, 12);
}

function buildResultSnippet(doc, terms, maxLength = 220) {
  const raw = String(doc.summary || doc.content || doc.title || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) {
    return "";
  }

  const limit = Math.max(80, Math.min(500, Number(maxLength || 220)));
  if (!Array.isArray(terms) || terms.length === 0) {
    if (raw.length <= limit) {
      return raw;
    }
    return `${raw.slice(0, limit).trim()}...`;
  }

  const lower = raw.toLowerCase();
  let bestIndex = -1;
  let matchedLength = 0;

  for (const term of terms) {
    const needle = String(term || "").toLowerCase();
    if (!needle) {
      continue;
    }
    const index = lower.indexOf(needle);
    if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
      bestIndex = index;
      matchedLength = needle.length;
    }
  }

  if (bestIndex === -1) {
    if (raw.length <= limit) {
      return raw;
    }
    return `${raw.slice(0, limit).trim()}...`;
  }

  const center = bestIndex + Math.floor(matchedLength / 2);
  let start = Math.max(0, center - Math.floor(limit / 2));
  let end = Math.min(raw.length, start + limit);
  if (end - start < limit) {
    start = Math.max(0, end - limit);
  }

  let snippet = raw.slice(start, end).trim();
  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < raw.length) {
    snippet = `${snippet}...`;
  }
  return snippet;
}

function buildSnippetHtml(snippet, terms) {
  const raw = String(snippet || "");
  if (!raw) {
    return "";
  }

  const escapedSnippet = escapeHtml(raw);
  if (!Array.isArray(terms) || terms.length === 0) {
    return escapedSnippet;
  }

  const pattern = terms
    .map((term) => escapeRegexTerm(term))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .join("|");
  if (!pattern) {
    return escapedSnippet;
  }

  return escapedSnippet.replace(
    new RegExp(`(${pattern})`, "gi"),
    "<mark>$1</mark>",
  );
}

function runSearchAll(
  query,
  { language = "", category = "", source = "", sort = "relevance" } = {},
) {
  const artifacts = getLocalSearchArtifacts();
  const index = artifacts.docs;
  const parsedQuery = parseSearchOperators(query);
  const searchQuery = parsedQuery.cleanedQuery;
  const operators = parsedQuery.operators;
  const tokens = tokenize(searchQuery);
  const phrases = extractQuotedPhrases(searchQuery);
  const intents = detectQueryIntents(searchQuery, tokens);
  const hasKeywordQuery = tokens.length > 0 || phrases.length > 0;
  const snippetTerms = getSnippetTermsFromQuery(query);
  const normalizedLanguage = normalizeFilterValue(language);
  const normalizedCategory = normalizeFilterValue(category);
  const normalizedSource = normalizeFilterValue(source);
  const normalizedSort = normalizeFilterValue(sort) || "relevance";
  const clickTelemetryForQuery = {
    docsEvaluated: 0,
    boostApplied: 0,
    suppressedMinBase: 0,
    suppressedNoSignal: 0,
    cappedByGuardrail: 0,
    totalBoost: 0,
  };

  let ranked = index
    .map((doc) => {
      const normalized = normalizeIndexedDoc(doc);
      const baseScore = hasKeywordQuery
        ? computeScore(normalized, tokens, {
            rawQuery: searchQuery,
            phrases,
            tokenDfMap: artifacts.tokenDfMap,
            docCount: artifacts.docCount,
          })
        : 1;
      if (normalizedSort === "relevance") {
        clickTelemetryForQuery.docsEvaluated += 1;
      }
      const boostTelemetry = {};
      const clickBoost =
        normalizedSort === "relevance"
          ? getResultClickBoost({
              url: normalized.url,
              query: searchQuery,
              baseScore,
              telemetry: boostTelemetry,
            })
          : 0;
      if (normalizedSort === "relevance") {
        if (clickBoost > 0) {
          clickTelemetryForQuery.boostApplied += 1;
          clickTelemetryForQuery.totalBoost += clickBoost;
        } else if (boostTelemetry.reason === "low-base-score") {
          clickTelemetryForQuery.suppressedMinBase += 1;
        } else if (boostTelemetry.reason === "no-signal") {
          clickTelemetryForQuery.suppressedNoSignal += 1;
        }

        if (boostTelemetry.cappedByGuardrail) {
          clickTelemetryForQuery.cappedByGuardrail += 1;
        }
      }
      const freshnessScore = computeFreshnessScore(normalized.fetchedAt);
      return {
        ...normalized,
        freshnessScore,
        _score:
          baseScore +
          computeIntentBoost(normalized, intents) +
          getSourceAuthorityBoost(normalized, intents) +
          clickBoost +
          // Freshness bonus applied only for relevance sort; intent-adjusted weight.
          (normalizedSort === "relevance"
            ? freshnessScore * getFreshnessWeight(intents)
            : 0),
      };
    })
    .filter((doc) => {
      const docLanguage = normalizeFilterValue(doc.language || "");
      const docCategory = normalizeFilterValue(doc.category || "");
      const docSourceName = normalizeFilterValue(doc.sourceName || "");
      const docSourceSlug = normalizeFilterValue(doc.sourceSlug || "");

      if (
        normalizedLanguage &&
        docLanguage &&
        docLanguage !== normalizedLanguage
      ) {
        return false;
      }
      if (normalizedCategory && docCategory !== normalizedCategory) {
        return false;
      }
      if (
        normalizedSource &&
        docSourceName !== normalizedSource &&
        docSourceSlug !== normalizedSource
      ) {
        return false;
      }
      if (!doesDocMatchSiteOperator(doc, operators)) {
        return false;
      }
      if (!doesDocMatchExcludedSiteOperator(doc, operators)) {
        return false;
      }
      if (!doesDocMatchFiletypeOperator(doc, operators)) {
        return false;
      }
      if (!doesDocMatchInUrlOperator(doc, operators)) {
        return false;
      }
      if (!doesDocMatchInTitleOperator(doc, operators)) {
        return false;
      }
      return true;
    })
    .filter((doc) =>
      doesDocMeetCoverageThreshold(doc, tokens, phrases, searchQuery, intents),
    )
    .filter((doc) => (hasKeywordQuery ? doc._score > 0 : true));

  if (normalizedSort === "relevance") {
    clickSignalTelemetry.searchesEvaluated += 1;
    clickSignalTelemetry.docsEvaluated += clickTelemetryForQuery.docsEvaluated;
    clickSignalTelemetry.boostApplied += clickTelemetryForQuery.boostApplied;
    clickSignalTelemetry.suppressedMinBase +=
      clickTelemetryForQuery.suppressedMinBase;
    clickSignalTelemetry.suppressedNoSignal +=
      clickTelemetryForQuery.suppressedNoSignal;
    clickSignalTelemetry.cappedByGuardrail +=
      clickTelemetryForQuery.cappedByGuardrail;
    clickSignalTelemetry.totalBoost += clickTelemetryForQuery.totalBoost;
    clickSignalTelemetry.lastUpdatedAt = new Date().toISOString();
    clickSignalTelemetry.lastRun = {
      ...clickTelemetryForQuery,
      avgBoostApplied:
        clickTelemetryForQuery.boostApplied > 0
          ? Number(
              (
                clickTelemetryForQuery.totalBoost /
                clickTelemetryForQuery.boostApplied
              ).toFixed(3),
            )
          : 0,
    };
  }

  ranked.sort((left, right) => {
    if (normalizedSort === "newest") {
      const leftDate = Date.parse(left.fetchedAt || "") || 0;
      const rightDate = Date.parse(right.fetchedAt || "") || 0;
      if (rightDate !== leftDate) {
        return rightDate - leftDate;
      }
      return right._score - left._score;
    }

    if (normalizedSort === "quality") {
      const leftQuality = Number(left.qualityScore || 0);
      const rightQuality = Number(right.qualityScore || 0);
      if (rightQuality !== leftQuality) {
        return rightQuality - leftQuality;
      }
      return right._score - left._score;
    }

    return right._score - left._score;
  });

  if (normalizedSort === "relevance") {
    ranked = rerankBySourceDiversity(ranked);
  }

  return ranked.map(({ _score, _finalScore, ...rest }) => {
    const snippet = buildResultSnippet(rest, snippetTerms, 220);
    return {
      ...rest,
      snippet,
      snippetHtml: buildSnippetHtml(snippet, snippetTerms),
    };
  });
}

function runSearchPage(
  query,
  {
    language = "",
    category = "",
    source = "",
    sort = "relevance",
    limit = 20,
    page = 1,
  } = {},
) {
  const safeLimit = safeSearchLimit(limit);
  const safePage = safeSearchPage(page);
  let queryUsed = String(query || "").trim();
  let queryCorrection = null;

  let allResults = runSearchAll(queryUsed, {
    language,
    category,
    source,
    sort,
  });

  if (allResults.length === 0) {
    const artifacts = getLocalSearchArtifacts();
    const parsedForCorrection = parseSearchOperators(queryUsed);
    const correction = suggestQueryCorrection(
      parsedForCorrection.cleanedQuery,
      artifacts,
    );
    if (correction?.correctedQuery) {
      const correctedQueryWithOperators = rebuildQueryWithOperators(
        correction.correctedQuery,
        parsedForCorrection.operators,
      );
      const correctedResults = runSearchAll(correctedQueryWithOperators, {
        language,
        category,
        source,
        sort,
      });
      if (correctedResults.length > 0) {
        queryUsed = correctedQueryWithOperators;
        queryCorrection = {
          originalQuery: correction.originalQuery,
          correctedQuery: correction.correctedQuery,
          autoApplied: true,
        };
        allResults = correctedResults;
      }
    }
  }

  const total = allResults.length;
  const offset = (safePage - 1) * safeLimit;
  const pagedResults = allResults.slice(offset, offset + safeLimit);
  const totalPages = total > 0 ? Math.ceil(total / safeLimit) : 0;

  // Proactive spelling hint: when results exist but are sparse, suggest a correction
  // as a soft hint without auto-applying it (unlike the zero-result correction above).
  let querySuggestion = null;
  if (total > 0 && total < 5 && !queryCorrection) {
    const hintArtifacts = getLocalSearchArtifacts();
    const parsedForHint = parseSearchOperators(queryUsed);
    const hint = suggestQueryCorrection(
      parsedForHint.cleanedQuery,
      hintArtifacts,
    );
    if (
      hint?.correctedQuery &&
      hint.correctedQuery.trim().toLowerCase() !==
        parsedForHint.cleanedQuery.trim().toLowerCase()
    ) {
      querySuggestion = { correctedQuery: hint.correctedQuery };
    }
  }

  const contextualLanguages = runSearchAll(queryUsed, {
    category,
    source,
    sort,
  });
  const contextualCategories = runSearchAll(queryUsed, {
    language,
    source,
    sort,
  });
  const contextualSources = runSearchAll(queryUsed, {
    language,
    category,
    sort,
  });

  return {
    results: pagedResults,
    total,
    limit: safeLimit,
    offset,
    queryUsed,
    queryCorrection,
    querySuggestion,
    page: total > 0 ? safePage : 1,
    totalPages,
    hasNextPage: offset + safeLimit < total,
    hasPrevPage: offset > 0,
    facets: {
      languages: buildSearchFacets(contextualLanguages).languages,
      categories: buildSearchFacets(contextualCategories).categories,
      sources: buildSearchFacets(contextualSources).sources,
    },
  };
}

function runSearch(query, options = {}) {
  const payload = runSearchPage(query, options);
  return payload.results;
}

function getAppliedSearchOperators(query) {
  const parsed = parseSearchOperators(query);
  return {
    site: parsed.operators.sites,
    excludedSite: parsed.operators.excludedSites,
    filetype: parsed.operators.filetypes,
    inurl: parsed.operators.inurl,
    intitle: parsed.operators.intitle,
    cleanedQuery: parsed.cleanedQuery,
  };
}

function getSearchSources({ query = "", limit = 20 } = {}) {
  const index = readJson(searchIndexPath, []);
  const normalizedQuery = normalizeFilterValue(query);
  const safeLimit = Math.max(
    1,
    Math.min(100, Number.parseInt(String(limit || 20), 10) || 20),
  );
  const seen = new Map();

  for (const rawDoc of index) {
    const doc = normalizeIndexedDoc(rawDoc);
    const sourceName = String(doc.sourceName || "").trim();
    const sourceSlug = String(doc.sourceSlug || "").trim();
    if (!sourceName && !sourceSlug) {
      continue;
    }

    const haystack =
      `${normalizeFilterValue(sourceName)} ${normalizeFilterValue(sourceSlug)}`.trim();
    if (normalizedQuery && !haystack.includes(normalizedQuery)) {
      continue;
    }

    const mapKey = sourceSlug || sourceName.toLowerCase();
    if (!seen.has(mapKey)) {
      seen.set(mapKey, {
        slug: sourceSlug || sourceName.toLowerCase(),
        name: sourceName || sourceSlug,
        indexedCount: 0,
        languageHint: String(doc.language || "").trim(),
        categoryHint: String(doc.category || "").trim(),
      });
    }
    seen.get(mapKey).indexedCount += 1;
  }

  return [...seen.values()]
    .sort((left, right) => {
      if (right.indexedCount !== left.indexedCount) {
        return right.indexedCount - left.indexedCount;
      }
      return String(left.name).localeCompare(String(right.name));
    })
    .slice(0, safeLimit);
}

function getPopularQuerySuggestions(partial, limit = 10) {
  const normalizedPartial = normalizeFilterValue(partial);
  if (!normalizedPartial) {
    return [];
  }

  const analytics = readJson(analyticsPath, { searches: [], pageViews: [] });
  const stats = new Map();
  const searches = Array.isArray(analytics.searches) ? analytics.searches : [];

  for (const item of searches) {
    const query = String(item?.query || "").trim();
    const normalized = normalizeFilterValue(query);
    if (!normalized || normalized.length < 2) {
      continue;
    }
    if (!normalized.includes(normalizedPartial)) {
      continue;
    }

    const current = stats.get(query) || {
      hits: 0,
      positiveHits: 0,
      sumResults: 0,
    };
    const resultCount = Number(item?.resultCount || 0);
    current.hits += 1;
    if (resultCount > 0) {
      current.positiveHits += 1;
    }
    current.sumResults += resultCount;
    stats.set(query, current);
  }

  return [...stats.entries()]
    .filter(([, item]) => item.positiveHits > 0)
    .sort((left, right) => {
      const leftScore = left[1].positiveHits * 2 + left[1].hits;
      const rightScore = right[1].positiveHits * 2 + right[1].hits;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([value, item]) => ({
      value,
      score: item.positiveHits * 2 + item.hits,
      source: "analytics",
    }));
}

function getIndexQuerySuggestions(partial, limit = 10) {
  const normalizedPartial = normalizeFilterValue(partial);
  if (!normalizedPartial) {
    return [];
  }

  const artifacts = getLocalSearchArtifacts();
  const suggestions = new Map();

  for (const token of artifacts.vocabulary || []) {
    if (!token.startsWith(normalizedPartial) || token.length < 3) {
      continue;
    }
    suggestions.set(token, {
      value: token,
      score: 2,
      source: "index-token",
    });
    if (suggestions.size >= limit) {
      break;
    }
  }

  for (const doc of artifacts.docs || []) {
    const title = String(doc.title || "").trim();
    const normalizedTitle = normalizeFilterValue(title);
    if (!title || !normalizedTitle.includes(normalizedPartial)) {
      continue;
    }

    const existing = suggestions.get(title);
    if (existing) {
      existing.score += 3;
    } else {
      suggestions.set(title, {
        value: title,
        score: 3,
        source: "index-title",
      });
    }

    if (suggestions.size >= limit * 2) {
      break;
    }
  }

  return [...suggestions.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.value.localeCompare(right.value);
    })
    .slice(0, limit);
}

function getSearchSuggestions(partial, limit = 10) {
  const safeLimit = Math.max(
    1,
    Math.min(20, Number.parseInt(String(limit || 10), 10) || 10),
  );

  const merged = new Map();
  const sources = [
    ...getPopularQuerySuggestions(partial, safeLimit),
    ...getIndexQuerySuggestions(partial, safeLimit),
  ];

  for (const item of sources) {
    const key = normalizeFilterValue(item.value);
    if (!key) {
      continue;
    }
    const existing = merged.get(key);
    if (existing) {
      existing.score += Number(item.score || 0);
      continue;
    }
    merged.set(key, {
      value: String(item.value || "").trim(),
      score: Number(item.score || 0),
      source: String(item.source || "index"),
    });
  }

  return [...merged.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.value.localeCompare(right.value);
    })
    .slice(0, safeLimit)
    .map((item) => item.value);
}

function parseSearchOperators(query) {
  const input = String(query || "");
  const operators = {
    sites: [],
    excludedSites: [],
    filetypes: [],
    inurl: [],
    intitle: [],
  };

  const siteRegex = /(?:^|\s)site:([^\s"']+)/gi;
  const excludedSiteRegex = /(?:^|\s)-site:([^\s"']+)/gi;
  const filetypeRegex = /\bfiletype:([a-z0-9]{1,16})\b/gi;
  const inurlRegex = /\binurl:([^\s"']+)/gi;
  const intitleRegex = /\bintitle:(?:"([^"]+)"|([^\s"']+))/gi;

  let siteMatch = siteRegex.exec(input);
  while (siteMatch) {
    const rawSite = String(siteMatch[1] || "")
      .trim()
      .toLowerCase();
    const site = rawSite.replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (site && !operators.sites.includes(site)) {
      operators.sites.push(site);
    }
    siteMatch = siteRegex.exec(input);
  }

  let excludedSiteMatch = excludedSiteRegex.exec(input);
  while (excludedSiteMatch) {
    const rawSite = String(excludedSiteMatch[1] || "")
      .trim()
      .toLowerCase();
    const site = rawSite.replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (site && !operators.excludedSites.includes(site)) {
      operators.excludedSites.push(site);
    }
    excludedSiteMatch = excludedSiteRegex.exec(input);
  }

  let filetypeMatch = filetypeRegex.exec(input);
  while (filetypeMatch) {
    const filetype = String(filetypeMatch[1] || "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "");
    if (filetype && !operators.filetypes.includes(filetype)) {
      operators.filetypes.push(filetype);
    }
    filetypeMatch = filetypeRegex.exec(input);
  }

  let inurlMatch = inurlRegex.exec(input);
  while (inurlMatch) {
    const part = normalizeFilterValue(inurlMatch[1] || "");
    if (part && !operators.inurl.includes(part)) {
      operators.inurl.push(part);
    }
    inurlMatch = inurlRegex.exec(input);
  }

  let intitleMatch = intitleRegex.exec(input);
  while (intitleMatch) {
    const part = normalizeFilterValue(intitleMatch[1] || intitleMatch[2] || "");
    if (part && !operators.intitle.includes(part)) {
      operators.intitle.push(part);
    }
    intitleMatch = intitleRegex.exec(input);
  }

  const cleanedQuery = input
    .replace(siteRegex, " ")
    .replace(excludedSiteRegex, " ")
    .replace(filetypeRegex, " ")
    .replace(inurlRegex, " ")
    .replace(intitleRegex, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    rawQuery: input.trim(),
    cleanedQuery,
    operators,
  };
}

function rebuildQueryWithOperators(cleanedQuery, operators = {}) {
  const parts = [];
  const clean = String(cleanedQuery || "").trim();
  if (clean) {
    parts.push(clean);
  }

  const sites = Array.isArray(operators.sites) ? operators.sites : [];
  const excludedSites = Array.isArray(operators.excludedSites)
    ? operators.excludedSites
    : [];
  const filetypes = Array.isArray(operators.filetypes)
    ? operators.filetypes
    : [];
  const inurlParts = Array.isArray(operators.inurl) ? operators.inurl : [];
  const intitleParts = Array.isArray(operators.intitle)
    ? operators.intitle
    : [];

  for (const site of sites) {
    const value = String(site || "").trim();
    if (value) {
      parts.push(`site:${value}`);
    }
  }

  for (const filetype of filetypes) {
    const value = String(filetype || "")
      .trim()
      .replace(/^\./, "");
    if (value) {
      parts.push(`filetype:${value}`);
    }
  }

  for (const site of excludedSites) {
    const value = String(site || "").trim();
    if (value) {
      parts.push(`-site:${value}`);
    }
  }

  for (const part of inurlParts) {
    const value = String(part || "").trim();
    if (value) {
      parts.push(`inurl:${value}`);
    }
  }

  for (const part of intitleParts) {
    const value = String(part || "").trim();
    if (!value) {
      continue;
    }
    if (value.includes(" ")) {
      parts.push(`intitle:"${value.replace(/\"/g, "")}"`);
    } else {
      parts.push(`intitle:${value}`);
    }
  }

  return parts.join(" ").trim();
}

function doesDocMatchSiteOperator(doc, operators = {}) {
  const sites = Array.isArray(operators.sites) ? operators.sites : [];
  if (sites.length === 0) {
    return true;
  }

  let host = "";
  try {
    host = new URL(String(doc.url || "")).hostname.toLowerCase();
  } catch {
    host = "";
  }

  if (!host) {
    return false;
  }

  return sites.some((site) => host === site || host.endsWith(`.${site}`));
}

function doesDocMatchFiletypeOperator(doc, operators = {}) {
  const filetypes = Array.isArray(operators.filetypes)
    ? operators.filetypes
    : [];
  if (filetypes.length === 0) {
    return true;
  }

  let pathname = "";
  try {
    pathname = new URL(String(doc.url || "")).pathname.toLowerCase();
  } catch {
    pathname = "";
  }

  if (!pathname) {
    return false;
  }

  const extensionMatch = pathname.match(/\.([a-z0-9]{1,16})(?:$|[?#])/i);
  const extension = extensionMatch ? String(extensionMatch[1] || "") : "";
  if (!extension) {
    return false;
  }

  return filetypes.includes(extension.toLowerCase());
}

function doesDocMatchExcludedSiteOperator(doc, operators = {}) {
  const excludedSites = Array.isArray(operators.excludedSites)
    ? operators.excludedSites
    : [];
  if (excludedSites.length === 0) {
    return true;
  }

  let host = "";
  try {
    host = new URL(String(doc.url || "")).hostname.toLowerCase();
  } catch {
    host = "";
  }
  if (!host) {
    return true;
  }

  return !excludedSites.some(
    (site) => host === site || host.endsWith(`.${site}`),
  );
}

function doesDocMatchInUrlOperator(doc, operators = {}) {
  const inurlParts = Array.isArray(operators.inurl) ? operators.inurl : [];
  if (inurlParts.length === 0) {
    return true;
  }

  const url = normalizeFilterValue(doc.url || "");
  if (!url) {
    return false;
  }

  return inurlParts.every((part) => url.includes(part));
}

function doesDocMatchInTitleOperator(doc, operators = {}) {
  const intitleParts = Array.isArray(operators.intitle)
    ? operators.intitle
    : [];
  if (intitleParts.length === 0) {
    return true;
  }

  const title = normalizeFilterValue(doc.title || "");
  if (!title) {
    return false;
  }

  return intitleParts.every((part) => title.includes(part));
}

function getTrendingPeriodWindowDays(period) {
  const normalized = normalizeFilterValue(period);
  if (normalized === "daily" || normalized === "day") {
    return { key: "daily", windowDays: 1 };
  }
  if (normalized === "weekly" || normalized === "week") {
    return { key: "weekly", windowDays: 7 };
  }
  if (normalized === "monthly" || normalized === "month") {
    return { key: "monthly", windowDays: 30 };
  }
  return { key: "all", windowDays: null };
}

function toDateBucket(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function getTrendingSearches({
  period = "weekly",
  limit = 10,
  includeZero = false,
  query = "",
} = {}) {
  const analytics = readJson(analyticsPath, { searches: [], pageViews: [] });
  const searches = Array.isArray(analytics.searches) ? analytics.searches : [];
  const safeLimit = Math.max(
    1,
    Math.min(50, Number.parseInt(String(limit || 10), 10) || 10),
  );
  const normalizedQuery = normalizeFilterValue(query);
  const periodInfo = getTrendingPeriodWindowDays(period);
  const now = Date.now();
  const windowStart =
    periodInfo.windowDays == null
      ? null
      : now - periodInfo.windowDays * 24 * 60 * 60 * 1000;

  const queryStats = new Map();
  const bucketsMap = new Map();

  for (const item of searches) {
    const rawQuery = String(item?.query || "").trim();
    if (!rawQuery) {
      continue;
    }

    const normalized = normalizeFilterValue(rawQuery);
    if (!normalized || normalized.length < 2) {
      continue;
    }
    if (normalizedQuery && !normalized.includes(normalizedQuery)) {
      continue;
    }

    const atIso = String(item?.at || "").trim();
    const atMs = Date.parse(atIso);
    if (!Number.isFinite(atMs)) {
      continue;
    }
    if (windowStart != null && atMs < windowStart) {
      continue;
    }

    const resultCount = Number(item?.resultCount || 0);
    if (!includeZero && resultCount <= 0) {
      continue;
    }

    const bucket = toDateBucket(atIso);

    const existing = queryStats.get(rawQuery) || {
      query: rawQuery,
      hits: 0,
      positiveHits: 0,
      sumResults: 0,
      lastSeen: "",
      firstSeen: "",
      buckets: new Map(),
    };

    existing.hits += 1;
    if (resultCount > 0) {
      existing.positiveHits += 1;
    }
    existing.sumResults += resultCount;
    if (!existing.firstSeen || atIso < existing.firstSeen) {
      existing.firstSeen = atIso;
    }
    if (!existing.lastSeen || atIso > existing.lastSeen) {
      existing.lastSeen = atIso;
    }

    if (bucket) {
      const bucketEntry = existing.buckets.get(bucket) || {
        bucket,
        count: 0,
        positiveHits: 0,
      };
      bucketEntry.count += 1;
      if (resultCount > 0) {
        bucketEntry.positiveHits += 1;
      }
      existing.buckets.set(bucket, bucketEntry);

      const topBucket = bucketsMap.get(bucket) || {
        bucket,
        totalSearches: 0,
        positiveSearches: 0,
        queries: new Set(),
      };
      topBucket.totalSearches += 1;
      if (resultCount > 0) {
        topBucket.positiveSearches += 1;
      }
      topBucket.queries.add(rawQuery);
      bucketsMap.set(bucket, topBucket);
    }

    queryStats.set(rawQuery, existing);
  }

  const items = [...queryStats.values()]
    .map((entry) => {
      const avgResults = entry.hits > 0 ? entry.sumResults / entry.hits : 0;
      const ageDays = Math.max(
        0,
        (now - (Date.parse(entry.lastSeen) || now)) / (24 * 60 * 60 * 1000),
      );
      const recencyBoost = Math.max(0, 3 - ageDays * 0.25);
      const trendScore =
        entry.positiveHits * 3 +
        entry.hits * 1.2 +
        avgResults * 0.12 +
        recencyBoost;

      return {
        query: entry.query,
        hits: entry.hits,
        positiveHits: entry.positiveHits,
        avgResults: Number(avgResults.toFixed(2)),
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
        trendScore: Number(trendScore.toFixed(2)),
        buckets: [...entry.buckets.values()].sort((left, right) =>
          left.bucket.localeCompare(right.bucket),
        ),
      };
    })
    .sort((left, right) => {
      if (right.trendScore !== left.trendScore) {
        return right.trendScore - left.trendScore;
      }
      if (right.positiveHits !== left.positiveHits) {
        return right.positiveHits - left.positiveHits;
      }
      if (right.hits !== left.hits) {
        return right.hits - left.hits;
      }
      return left.query.localeCompare(right.query);
    })
    .slice(0, safeLimit);

  const buckets = [...bucketsMap.values()]
    .map((entry) => ({
      bucket: entry.bucket,
      totalSearches: entry.totalSearches,
      positiveSearches: entry.positiveSearches,
      uniqueQueries: entry.queries.size,
    }))
    .sort((left, right) => left.bucket.localeCompare(right.bucket));

  return {
    period: periodInfo.key,
    windowDays: periodInfo.windowDays,
    total: items.length,
    items,
    buckets,
  };
}

function getPassiveRoutingBackend() {
  return routingState.activeBackend === "django" ? "node" : "django";
}

function pickSearchBackend() {
  const activeBackend =
    routingState.activeBackend === "django" ? "django" : "node";
  const passiveBackend = getPassiveRoutingBackend();
  const canaryPercent = Math.max(
    0,
    Math.min(100, Number(routingState.canaryPercent) || 0),
  );

  if (canaryPercent >= 100) {
    return activeBackend;
  }
  if (canaryPercent <= 0) {
    return passiveBackend;
  }

  return Math.random() * 100 < canaryPercent ? activeBackend : passiveBackend;
}

function buildDjangoApiUrl(pathname, query = {}) {
  const base = String(routingState.djangoUrl || "http://127.0.0.1:8000")
    .trim()
    .replace(/\/+$/, "");
  const url = new URL(`${base}${pathname}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    const normalized = String(value).trim();
    if (!normalized) {
      continue;
    }

    url.searchParams.set(key, normalized);
  }

  return url;
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SEARCH_PROXY_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function proxyDjangoSearch(pathname, query, req) {
  const url = buildDjangoApiUrl(pathname, query);
  const { response, payload } = await fetchJsonWithTimeout(url, {
    headers: {
      Accept: "application/json",
      "X-Forwarded-For": getClientIp(req),
      "X-Magneto-Proxy": "node-search",
    },
  });

  if (!response.ok) {
    const message =
      payload?.error || `Django request failed with ${response.status}.`;
    throw new Error(message);
  }

  return payload && typeof payload === "object" ? payload : {};
}

function parseOptionalIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed);
}

function toBearerToken(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^bearer\s+/i.test(raw)) {
    return raw;
  }
  return `Bearer ${raw}`;
}

function mapDjangoExportDocToLocal(doc) {
  const source = doc && typeof doc.source === "object" ? doc.source : {};
  return {
    id:
      String(doc?.id || "").trim() ||
      `django-${stableHashString(String(doc?.url || "").trim())}`,
    url: String(doc?.url || "").trim(),
    canonicalUrl: String(doc?.canonicalUrl || "").trim(),
    title: String(doc?.title || "").trim(),
    summary: String(doc?.summary || "").trim(),
    content: String(doc?.content || "").trim(),
    language: String(doc?.language || "").trim(),
    category: String(doc?.category || "").trim(),
    tags: Array.isArray(doc?.tags) ? doc.tags : [],
    qualityScore: Number(doc?.qualityScore || 0),
    fetchedAt: String(doc?.fetchedAt || doc?.updatedAt || "").trim(),
    sourceName: String(source.name || "").trim(),
    sourceSlug: String(source.slug || "").trim(),
  };
}

async function fetchDjangoAdminExportPage({
  req,
  authHeader,
  page,
  pageSize,
  status,
  source,
  updatedSince,
}) {
  const url = buildDjangoApiUrl("/api/admin/search/export", {
    page,
    limit: pageSize,
    status,
    source,
    updatedSince,
  });

  const headers = {
    Accept: "application/json",
    "X-Forwarded-For": getClientIp(req),
    "X-Magneto-Proxy": "node-admin-sync",
  };

  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const { response, payload } = await fetchJsonWithTimeout(url, { headers });
  if (!response.ok) {
    const message =
      payload?.error ||
      `Django admin export failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload && typeof payload === "object" ? payload : {};
}

function readDjangoIndexSyncState() {
  return readJson(indexSyncStatePath, {
    updatedSince: "",
    lastRunAt: "",
    lastSuccessAt: "",
    lastError: "",
  });
}

function writeDjangoIndexSyncState(state) {
  writeJson(indexSyncStatePath, {
    updatedSince: String(state?.updatedSince || "").trim(),
    lastRunAt: String(state?.lastRunAt || "").trim(),
    lastSuccessAt: String(state?.lastSuccessAt || "").trim(),
    lastError: String(state?.lastError || "").trim(),
  });
}

function resolveLatestUpdatedAtIso(rawDocuments) {
  let latestMs = Number.NaN;
  for (const doc of rawDocuments) {
    const parsed = Date.parse(String(doc?.updatedAt || "").trim());
    if (!Number.isFinite(parsed)) {
      continue;
    }
    if (!Number.isFinite(latestMs) || parsed > latestMs) {
      latestMs = parsed;
    }
  }

  if (!Number.isFinite(latestMs)) {
    return "";
  }
  return new Date(latestMs).toISOString();
}

async function executeDjangoIndexSync({
  req = null,
  authHeader,
  source = "",
  statusFilter = "indexed",
  pageSize = 200,
  maxPages = 50,
  createBackup = true,
  updatedSince = null,
  reason = "manual",
}) {
  if (djangoSyncInFlight) {
    throw new Error("A Django index sync is already in progress.");
  }

  djangoSyncInFlight = true;
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const rawDocuments = [];
  const pageSummaries = [];
  let page = 1;
  let djangoTotal = 0;

  djangoSyncRuntime.lastRunAt = startedAtIso;
  djangoSyncRuntime.lastError = "";

  try {
    while (page <= maxPages) {
      const payload = await fetchDjangoAdminExportPage({
        req,
        authHeader,
        page,
        pageSize,
        status: statusFilter,
        source,
        updatedSince: updatedSince ? updatedSince.toISOString() : "",
      });

      const docs = Array.isArray(payload.documents) ? payload.documents : [];
      const pagination =
        payload.pagination && typeof payload.pagination === "object"
          ? payload.pagination
          : {};
      djangoTotal = Number(pagination.total || djangoTotal || 0);

      rawDocuments.push(...docs);
      pageSummaries.push({
        page,
        fetched: docs.length,
        hasNextPage: Boolean(pagination.hasNextPage),
      });

      if (!pagination.hasNextPage) {
        break;
      }
      page += 1;
    }

    const preparedDocs = rawDocuments
      .map(mapDjangoExportDocToLocal)
      .filter((doc) => doc.url && (doc.title || doc.summary || doc.content));

    const uniqueUrlCount = new Set(
      preparedDocs.map((doc) => normalizeIndexUrl(doc.url).toLowerCase()),
    ).size;

    const indexBefore = getSearchIndexStats();
    let refresh = {
      beforeCount: indexBefore.totalDocs,
      afterCount: indexBefore.totalDocs,
      removedInvalid: 0,
      deduplicated: 0,
      backupFile: null,
      artifacts: {
        docCount: indexBefore.totalDocs,
        vocabularySize: 0,
        tokenDfSize: 0,
      },
    };

    if (preparedDocs.length > 0) {
      refresh = rebuildLocalSearchIndex({
        mergeDocs: preparedDocs,
        createBackup,
      });
    }

    const latestUpdatedSince = resolveLatestUpdatedAtIso(rawDocuments);
    const syncState = readDjangoIndexSyncState();
    const persisted = {
      ...syncState,
      updatedSince:
        latestUpdatedSince ||
        String(syncState.updatedSince || "").trim() ||
        (updatedSince ? updatedSince.toISOString() : ""),
      lastRunAt: startedAtIso,
      lastSuccessAt: new Date().toISOString(),
      lastError: "",
    };
    writeDjangoIndexSyncState(persisted);

    const sync = {
      durationMs: Date.now() - startedAt,
      reason,
      source: source || "all",
      status: statusFilter,
      updatedSince: updatedSince ? updatedSince.toISOString() : "",
      nextUpdatedSince: persisted.updatedSince,
      pagesFetched: pageSummaries.length,
      maxPages,
      pageSize,
      djangoReportedTotal: djangoTotal,
      fetchedDocuments: rawDocuments.length,
      importedDocuments: preparedDocs.length,
      uniqueUrlCount,
      pageSummaries,
    };

    const result = {
      sync,
      refresh,
      index: getSearchIndexStats(),
      state: persisted,
    };

    djangoSyncRuntime.lastSuccessAt = persisted.lastSuccessAt;
    djangoSyncRuntime.lastSummary = {
      ...sync,
      backupFile: refresh.backupFile || "",
    };

    return result;
  } catch (error) {
    const message = String(error?.message || "Django sync failed.");
    const syncState = readDjangoIndexSyncState();
    const failedState = {
      ...syncState,
      lastRunAt: startedAtIso,
      lastError: message,
    };
    writeDjangoIndexSyncState(failedState);
    djangoSyncRuntime.lastError = message;
    throw error;
  } finally {
    djangoSyncInFlight = false;
  }
}

function logSearch({ query, resultCount, ip }) {
  trackQuerySequence(query, ip);
  const analytics = readJson(analyticsPath, { searches: [], pageViews: [] });
  analytics.searches.push({
    id: `s-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    query: String(query || "").trim(),
    resultCount: Number(resultCount || 0),
    ip: String(ip || "unknown"),
    at: new Date().toISOString(),
  });

  if (analytics.searches.length > 10000) {
    analytics.searches = analytics.searches.slice(-10000);
  }

  writeJson(analyticsPath, analytics);
  backupAnalytics("write");
}

function logPageView({ page, ip, userAgent }) {
  const analytics = readJson(analyticsPath, { searches: [], pageViews: [] });
  analytics.pageViews.push({
    id: `p-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    page: String(page || "unknown"),
    ip: String(ip || "unknown"),
    userAgent: String(userAgent || "unknown"),
    at: new Date().toISOString(),
  });

  if (analytics.pageViews.length > 20000) {
    analytics.pageViews = analytics.pageViews.slice(-20000);
  }

  writeJson(analyticsPath, analytics);
  backupAnalytics("write");
}

function logResultClick({ url, title, query, ip }) {
  const analytics = readJson(analyticsPath, {
    searches: [],
    pageViews: [],
    resultClicks: [],
  });
  if (!Array.isArray(analytics.resultClicks)) {
    analytics.resultClicks = [];
  }

  const normalizedUrl = normalizeIndexUrl(url);
  const normalizedQuery = normalizeSearchText(query);
  const normalizedIp = String(ip || "unknown").trim();
  const nowMs = Date.now();

  for (let i = analytics.resultClicks.length - 1; i >= 0; i -= 1) {
    const existing = analytics.resultClicks[i];
    const existingAtMs = Date.parse(String(existing?.at || ""));
    if (!Number.isFinite(existingAtMs)) {
      continue;
    }

    if (nowMs - existingAtMs > CLICK_SIGNAL_DEDUP_WINDOW_MS) {
      break;
    }

    const sameIp = String(existing?.ip || "").trim() === normalizedIp;
    const sameUrl = normalizeIndexUrl(existing?.url || "") === normalizedUrl;
    const sameQuery =
      normalizeSearchText(existing?.query || "") === normalizedQuery;
    if (sameIp && sameUrl && sameQuery) {
      return;
    }
  }

  analytics.resultClicks.push({
    id: `rc-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    url: String(normalizedUrl || ""),
    title: String(title || ""),
    query: String(query || ""),
    ip: normalizedIp,
    at: new Date().toISOString(),
  });

  if (analytics.resultClicks.length > 50000) {
    analytics.resultClicks = analytics.resultClicks.slice(-50000);
  }

  writeJson(analyticsPath, analytics);
  backupAnalytics("write");
  clickSignalCache.expiresAt = 0;
}

app.use("/api/admin", checkAdminRateLimit);

function buildAdminSearchLatestRunSummary() {
  const state = readDjangoIndexSyncState();
  const runtime = djangoSyncRuntime || {};
  const summary = runtime.lastSummary || {};
  const startedAt = String(state.lastRunAt || runtime.lastRunAt || "").trim();
  const finishedAt = String(
    state.lastSuccessAt || runtime.lastSuccessAt || "",
  ).trim();
  const status = djangoSyncInFlight
    ? "running"
    : state.lastError
      ? "error"
      : finishedAt
        ? "success"
        : "idle";

  return {
    id: startedAt || `run-${Date.now()}`,
    status,
    startedAt,
    finishedAt,
    pagesSeen: Number(summary.fetchedDocuments || 0),
    pagesIndexed: Number(summary.importedDocuments || 0),
    pagesUpdated: Number(summary.importedDocuments || 0),
    pagesFailed: state.lastError ? 1 : 0,
    pagesBlocked: 0,
    source: String(summary.source || "all"),
    durationMs: Number(summary.durationMs || 0),
    lastError: String(state.lastError || runtime.lastError || ""),
  };
}

// ─── Traffic routing state ────────────────────────────────────────────────────
const VALID_ROUTING_BACKENDS = ["node", "django"];
const VALID_CANARY_PERCENTAGES = [0, 10, 50, 100];

function _loadRoutingState() {
  const defaults = {
    activeBackend: "node",
    canaryPercent: 100,
    djangoUrl: DJANGO_API_URL,
    note: "Initial state – Node backend at 100%.",
    updatedAt: new Date().toISOString(),
  };
  try {
    const raw = fs.readFileSync(routingStatePath, "utf8");
    const saved = JSON.parse(raw);
    if (
      VALID_ROUTING_BACKENDS.includes(saved.activeBackend) &&
      VALID_CANARY_PERCENTAGES.includes(saved.canaryPercent)
    ) {
      // Always refresh djangoUrl from env so env overrides persist
      saved.djangoUrl = DJANGO_API_URL;
      return { ...defaults, ...saved };
    }
  } catch (_) {
    // File missing or corrupt — use defaults
  }
  return defaults;
}

function _saveRoutingState() {
  fs.writeFile(
    routingStatePath,
    JSON.stringify(routingState, null, 2),
    () => {},
  );
}

let routingState = _loadRoutingState();

ensureAnalyticsFile();
backupAnalytics("startup");

async function runScheduledDjangoIndexSync(reason = "scheduled") {
  if (!DJANGO_INDEX_SYNC_ENABLED) {
    return;
  }

  const authHeader = toBearerToken(DJANGO_ADMIN_TOKEN);
  if (!authHeader) {
    djangoSyncRuntime.lastError =
      "DJANGO_ADMIN_TOKEN is not set. Scheduled sync skipped.";
    return;
  }

  if (djangoSyncInFlight) {
    return;
  }

  const persisted = readDjangoIndexSyncState();
  const updatedSince = parseOptionalIsoDate(persisted.updatedSince);

  try {
    await executeDjangoIndexSync({
      req: null,
      authHeader,
      source: "",
      statusFilter: "indexed",
      pageSize: DJANGO_INDEX_SYNC_PAGE_SIZE,
      maxPages: DJANGO_INDEX_SYNC_MAX_PAGES,
      createBackup: false,
      updatedSince,
      reason,
    });
  } catch (error) {
    console.warn(
      `[sync] Scheduled Django index sync failed: ${String(error?.message || error)}`,
    );
  }
}

setInterval(() => {
  backupAnalytics("scheduled");
}, BACKUP_SCHEDULE_MS).unref();

if (DJANGO_INDEX_SYNC_ENABLED) {
  setInterval(() => {
    runScheduledDjangoIndexSync("scheduled");
  }, DJANGO_INDEX_SYNC_INTERVAL_MS).unref();

  if (DJANGO_INDEX_SYNC_STARTUP) {
    setTimeout(() => {
      runScheduledDjangoIndexSync("startup");
    }, 3000).unref();
  }
}

app.listen(PORT, () => {
  console.log(`MAGNETO server running on http://localhost:${PORT}`);
});
