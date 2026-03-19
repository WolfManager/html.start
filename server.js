const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL =
  String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
const ANTHROPIC_API_KEY = String(process.env.ANTHROPIC_API_KEY || "").trim();
const ANTHROPIC_MODEL =
  String(process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest").trim() ||
  "claude-3-5-sonnet-latest";
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL =
  String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim() ||
  "gemini-2.5-flash";

function parseModelCandidates(value, defaults) {
  const list = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const merged = [...list, ...defaults];
  return [...new Set(merged)];
}

const OPENAI_MODEL_CANDIDATES = parseModelCandidates(
  process.env.OPENAI_MODEL_CANDIDATES,
  [OPENAI_MODEL, "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"],
);
const ANTHROPIC_MODEL_CANDIDATES = parseModelCandidates(
  process.env.ANTHROPIC_MODEL_CANDIDATES,
  [ANTHROPIC_MODEL, "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
);
const GEMINI_MODEL_CANDIDATES = parseModelCandidates(
  process.env.GEMINI_MODEL_CANDIDATES,
  [GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest"],
);

function parseProviderOrder(value) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeAiProvider(item, ""))
    .filter(Boolean);
}

function normalizeAiProvider(input, fallback = "openai") {
  const normalized = String(input || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "openai" ||
    normalized === "anthropic" ||
    normalized === "gemini"
  ) {
    return normalized;
  }

  return fallback;
}

const AI_PRIMARY_PROVIDER = normalizeAiProvider(
  process.env.AI_PRIMARY_PROVIDER,
  "openai",
);
const AI_FALLBACK_PROVIDER = normalizeAiProvider(
  process.env.AI_FALLBACK_PROVIDER,
  AI_PRIMARY_PROVIDER === "openai" ? "anthropic" : "openai",
);
const AI_ROUTING_MODE =
  String(process.env.AI_ROUTING_MODE || "smart")
    .trim()
    .toLowerCase() || "smart";
const AI_PROVIDER_ORDER = parseProviderOrder(process.env.AI_PROVIDER_ORDER);

const dataDir = path.join(__dirname, "data");
const analyticsPath = path.join(dataDir, "analytics.json");
const searchIndexPath = path.join(dataDir, "search-index.json");
const backupDir = path.join(dataDir, "backups");
const assistantMemoryPath = path.join(dataDir, "assistant-memory.json");
const routingStatePath = path.join(dataDir, "routing-state.json");
const indexSyncStatePath = path.join(dataDir, "index-sync-state.json");
const rankingConfigPath = path.join(dataDir, "search-ranking-config.json");
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
const DJANGO_INDEX_SYNC_ENABLED =
  String(process.env.DJANGO_INDEX_SYNC_ENABLED || "true")
    .trim()
    .toLowerCase() !== "false";
const DJANGO_INDEX_SYNC_STARTUP =
  String(process.env.DJANGO_INDEX_SYNC_STARTUP || "true")
    .trim()
    .toLowerCase() !== "false";
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

app.use(express.json({ limit: "250kb" }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  const incomingRequestId = String(req.headers["x-request-id"] || "").trim();
  const requestId = incomingRequestId || randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  const originalEnd = res.end.bind(res);
  res.end = (...args) => {
    if (!res.headersSent) {
      res.setHeader("X-Response-Time-Ms", String(Date.now() - startedAt));
    }

    return originalEnd(...args);
  };

  next();
});
app.use(express.static(__dirname));

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

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return String(req.ip || "unknown");
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

function getLoginState(key) {
  const now = Date.now();
  const state = loginAttemptMap.get(key) || {
    attempts: [],
    failedCount: 0,
    lockUntil: 0,
  };

  state.attempts = state.attempts.filter((ts) => now - ts <= LOGIN_WINDOW_MS);

  if (state.lockUntil <= now) {
    state.lockUntil = 0;
  }

  loginAttemptMap.set(key, state);
  return state;
}

function checkAdminRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const state = adminRateMap.get(ip) || { hits: [] };
  state.hits = state.hits.filter((ts) => now - ts <= ADMIN_WINDOW_MS);

  if (state.hits.length >= ADMIN_RATE_LIMIT_COUNT) {
    const retryAfter = Math.max(
      1,
      Math.ceil((ADMIN_WINDOW_MS - (now - state.hits[0])) / 1000),
    );
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: `Too many admin requests. Retry in ${retryAfter} seconds.`,
    });
    adminRateMap.set(ip, state);
    return;
  }

  state.hits.push(now);
  adminRateMap.set(ip, state);
  next();
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

function normalizeAssistantSuggestions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);
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

function normalizeAssistantQueryKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 400);
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

function isSimpleAssistantQuery(message) {
  const normalized = normalizeAssistantQueryKey(message);
  if (!normalized) {
    return true;
  }

  if (
    /^(hi|hello|hey|salut|buna|test|ping|health check|health-check)$/i.test(
      normalized,
    )
  ) {
    return true;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const charCount = normalized.length;
  const hasQuestion = normalized.includes("?");
  const hasSentencePunctuation = /[.!:;,]/.test(normalized);
  const helper = classifyAssistantHelper(normalized);

  if (helper === "writing") {
    return false;
  }

  if (helper === "weather") {
    return false;
  }

  return (
    wordCount <= ASSISTANT_SIMPLE_QUERY_WORDS &&
    charCount <= 48 &&
    !hasQuestion &&
    !hasSentencePunctuation
  );
}

function buildRuleBasedAssistantResponse(message) {
  const raw = String(message || "").trim();
  const q = raw.toLowerCase();

  if (!raw) {
    return {
      reply: "Tell me what you want to search and I will refine it.",
      suggestions: [
        "latest news today",
        "best laptops 2026",
        "javascript tutorial",
      ],
    };
  }

  if (/weather|rain|sun|forecast/.test(q)) {
    return {
      reply: "Add city and timeframe for more precise weather results.",
      suggestions: [
        `${raw} in my city`,
        `${raw} this weekend`,
        "hourly weather forecast",
      ],
    };
  }

  if (/news|politics|economy/.test(q)) {
    return {
      reply: "Try trusted sources and a specific timeframe.",
      suggestions: [
        `${raw} last 24 hours`,
        `${raw} trusted sources`,
        `${raw} analysis`,
      ],
    };
  }

  if (/job|career|cv|hiring/.test(q)) {
    return {
      reply: "Include location and seniority to narrow job results.",
      suggestions: [`${raw} remote`, `${raw} entry level`, `${raw} salary`],
    };
  }

  return {
    reply: "Good topic. Here are refined search options.",
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
      return {
        ...normalized,
        freshnessScore: computeFreshnessScore(normalized.fetchedAt),
        _score:
          baseScore +
          computeIntentBoost(normalized, intents) +
          getSourceAuthorityBoost(normalized, intents) +
          clickBoost,
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

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Missing auth token." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const ip = getClientIp(req);
  const user = String(username || "")
    .trim()
    .toLowerCase();
  const key = `${ip}|${user}`;
  const state = getLoginState(key);
  const now = Date.now();

  if (state.lockUntil > now) {
    const retryAfter = Math.max(1, Math.ceil((state.lockUntil - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: `Account temporarily locked. Retry in ${retryAfter} seconds.`,
    });
    return;
  }

  if (state.attempts.length >= LOGIN_RATE_LIMIT_COUNT) {
    const retryAfter = Math.max(
      1,
      Math.ceil((LOGIN_WINDOW_MS - (now - state.attempts[0])) / 1000),
    );
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: `Too many login attempts. Retry in ${retryAfter} seconds.`,
    });
    return;
  }

  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    state.attempts.push(now);
    state.failedCount += 1;

    if (state.failedCount >= LOCKOUT_THRESHOLD) {
      state.lockUntil = now + LOCKOUT_MS;
      state.failedCount = 0;
    }

    loginAttemptMap.set(key, state);
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  loginAttemptMap.delete(key);

  const token = jwt.sign({ username: ADMIN_USER, role: "admin" }, JWT_SECRET, {
    expiresIn: "12h",
  });

  res.json({ token });
});

app.get("/api/search/sources", async (req, res) => {
  const query = String(req.query.q || "").trim();
  const limit = String(req.query.limit || "").trim();

  if (pickSearchBackend() === "django") {
    try {
      const payload = await proxyDjangoSearch(
        "/api/search/sources",
        { q: query, limit },
        req,
      );
      res.json({
        ok: true,
        ...payload,
        servedBy: "django",
      });
      return;
    } catch (error) {
      console.warn(
        `[search] Django sources proxy failed, falling back to Node: ${String(error?.message || error)}`,
      );
    }
  }

  const sources = getSearchSources({ query, limit });

  res.json({
    ok: true,
    total: sources.length,
    sources,
    servedBy: "node",
  });
});

app.get("/api/search/suggest", async (req, res) => {
  const query = String(req.query.q || "").trim();
  const limit = String(req.query.limit || "").trim();

  if (!query || query.length < 2) {
    res.json({
      ok: true,
      query,
      total: 0,
      suggestions: [],
      servedBy: "node",
    });
    return;
  }

  if (pickSearchBackend() === "django") {
    try {
      const payload = await proxyDjangoSearch(
        "/api/search/suggest",
        { q: query, limit },
        req,
      );
      res.json({
        ok: true,
        ...payload,
        servedBy: "django",
      });
      return;
    } catch (error) {
      console.warn(
        `[search] Django suggest proxy failed, falling back to Node: ${String(error?.message || error)}`,
      );
    }
  }

  const suggestions = getSearchSuggestions(query, limit || 10);
  res.json({
    ok: true,
    query,
    total: suggestions.length,
    suggestions,
    servedBy: "node",
  });
});

app.get("/api/search/trending", async (req, res) => {
  const period = String(req.query.period || "weekly").trim() || "weekly";
  const limit = String(req.query.limit || "10").trim() || "10";
  const includeZero =
    String(req.query.includeZero || "false")
      .trim()
      .toLowerCase() === "true";
  const query = String(req.query.q || "").trim();

  if (pickSearchBackend() === "django") {
    try {
      const payload = await proxyDjangoSearch(
        "/api/search/trending",
        {
          period,
          limit,
          includeZero: includeZero ? "true" : "false",
          q: query,
        },
        req,
      );

      res.json({
        ok: true,
        ...payload,
        servedBy: "django",
      });
      return;
    } catch (error) {
      console.warn(
        `[search] Django trending proxy failed, falling back to Node: ${String(error?.message || error)}`,
      );
    }
  }

  const payload = getTrendingSearches({
    period,
    limit,
    includeZero,
    query,
  });

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    ...payload,
    servedBy: "node",
  });
});

app.get("/api/analytics/popular-searches", (_req, res) => {
  try {
    const analyticsContent = fs.readFileSync(analyticsPath, "utf-8");
    const analytics = JSON.parse(analyticsContent);

    const searches = Array.isArray(analytics.searches)
      ? analytics.searches
      : [];

    const queryMap = new Map();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    searches.forEach((item) => {
      const query = String(item.query || "")
        .trim()
        .toLowerCase();
      if (!query || query.length < 2) {
        return;
      }

      const itemTime = new Date(item.at).getTime();
      const age = now - itemTime;

      if (age > sevenDaysMs) {
        return;
      }

      if (!queryMap.has(query)) {
        queryMap.set(query, {
          query: String(item.query || "").trim(),
          count: 0,
          lastSeen: itemTime,
        });
      }

      const entry = queryMap.get(query);
      entry.count += 1;
      if (itemTime > entry.lastSeen) {
        entry.lastSeen = itemTime;
      }
    });

    const sorted = Array.from(queryMap.values())
      .sort((a, b) => {
        const countDiff = b.count - a.count;
        if (countDiff !== 0) return countDiff;
        return b.lastSeen - a.lastSeen;
      })
      .slice(0, 12)
      .map((item) => item.query);

    res.json({
      ok: true,
      queries: sorted,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      `[analytics] Error fetching popular searches: ${String(error?.message || error)}`,
    );
    res.json({
      ok: true,
      queries: [],
      generatedAt: new Date().toISOString(),
    });
  }
});

app.get("/api/search", async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (!query) {
    res.status(400).json({ error: "Query is required." });
    return;
  }

  const language = String(req.query.language || "").trim();
  const category = String(req.query.category || "").trim();
  const source = String(req.query.source || "").trim();
  const sort = String(req.query.sort || "relevance").trim() || "relevance";
  const limit = String(req.query.limit || "").trim();
  const page = String(req.query.page || "").trim();

  if (pickSearchBackend() === "django") {
    try {
      const payload = await proxyDjangoSearch(
        "/api/search",
        {
          q: query,
          language,
          category,
          source,
          sort,
          limit,
          page,
        },
        req,
      );

      res.json({
        ...payload,
        servedBy: "django",
      });
      return;
    } catch (error) {
      console.warn(
        `[search] Django search proxy failed, falling back to Node: ${String(error?.message || error)}`,
      );
    }
  }

  const payload = runSearchPage(query, {
    language,
    category,
    source,
    sort,
    limit,
    page,
  });

  logSearch({
    query,
    resultCount: payload.total,
    ip: req.ip,
  });

  res.json({
    engine: "MAGNETO Core",
    query,
    queryUsed: payload.queryUsed || query,
    appliedOperators: getAppliedSearchOperators(payload.queryUsed || query),
    queryCorrection: payload.queryCorrection || null,
    suggestions:
      payload.total > 0
        ? []
        : getSearchSuggestions(payload.queryUsed || query, 8),
    total: payload.total,
    appliedFilters: {
      language,
      category,
      source,
      sort,
      limit: payload.limit,
      page: payload.page,
    },
    pagination: {
      page: payload.page,
      pageSize: payload.limit,
      offset: payload.offset,
      total: payload.total,
      totalPages: payload.totalPages,
      hasNextPage: payload.hasNextPage,
      hasPrevPage: payload.hasPrevPage,
      nextPage: payload.hasNextPage ? payload.page + 1 : null,
      prevPage: payload.hasPrevPage ? payload.page - 1 : null,
    },
    facets: payload.facets,
    results: payload.results,
    servedBy: "node",
  });
});

app.post("/api/events/page-view", (req, res) => {
  const page = String(req.body?.page || "unknown");
  logPageView({
    page,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "unknown",
  });
  res.json({ ok: true });
});

app.post("/api/events/result-click", (req, res) => {
  const url = String(req.body?.url || "").trim();
  const title = String(req.body?.title || "").trim();
  const query = String(req.body?.query || "").trim();

  if (!url || !title || !query) {
    res.status(400).json({ error: "URL, title, and query are required." });
    return;
  }

  logResultClick({
    url,
    title,
    query,
    ip: req.ip,
  });

  res.json({ ok: true });
});

app.post("/api/assistant/chat", async (req, res) => {
  if (!checkAssistantRateLimit(req, res)) {
    return;
  }

  assistantMetrics.requestsTotal += 1;

  const ip = getClientIp(req);
  const message = String(req.body?.message || "").trim();
  const history = req.body?.history;
  const helper = classifyAssistantHelper(message);

  if (!message) {
    res.status(400).json({ error: "Message is required." });
    return;
  }

  if (message.length > ASSISTANT_MAX_CHARS) {
    res.status(400).json({
      error: `Message too long. Max ${ASSISTANT_MAX_CHARS} characters.`,
    });
    return;
  }

  const cacheKey = normalizeAssistantQueryKey(message);
  const weatherIntent = isWeatherAssistantQuery(message, history, ip);
  const dateNewsIntent = isDateOrNewsAssistantQuery(message);

  // Weather intent has priority over stale generic cache entries.
  if (weatherIntent) {
    try {
      const weather = await buildWeatherAssistantResponse(message, ip);
      assistantMetrics.localHybridResponses += 1;
      markIpWeatherContext(ip);
      setAssistantCacheEntry(cacheKey, {
        model: "weather-live",
        helper: "weather",
        reply: weather.reply,
        suggestions: weather.suggestions,
      });
      storeAssistantMemory({
        ip,
        message,
        reply: weather.reply,
        provider: "weather-live",
        helper: "weather",
        model: "weather-live",
      });
      incrementMetricCounter(assistantMetrics.providerCounts, "weather-live");
      incrementMetricCounter(assistantMetrics.helperCounts, "weather");
      res.json({
        ok: true,
        provider: "weather-live",
        model: "weather-live",
        helper: "weather",
        reply: weather.reply,
        suggestions: weather.suggestions,
      });
      return;
    } catch {
      // Continue normal assistant flow (AI/fallback) if weather providers are unavailable.
    }
  }

  if (dateNewsIntent.enabled) {
    const dateNews = await buildDateNewsAssistantResponse(message);
    assistantMetrics.localHybridResponses += 1;
    setAssistantCacheEntry(cacheKey, {
      model: "date-news-live",
      helper: "general",
      reply: dateNews.reply,
      suggestions: dateNews.suggestions,
    });
    storeAssistantMemory({
      ip,
      message,
      reply: dateNews.reply,
      provider: "date-news-live",
      helper: "general",
      model: "date-news-live",
    });
    incrementMetricCounter(assistantMetrics.providerCounts, "date-news-live");
    incrementMetricCounter(assistantMetrics.helperCounts, "general");
    res.json({
      ok: true,
      provider: "date-news-live",
      model: "date-news-live",
      helper: "general",
      reply: dateNews.reply,
      suggestions: dateNews.suggestions,
    });
    return;
  }

  const cached = getAssistantCacheEntry(cacheKey);
  if (cached) {
    assistantMetrics.cacheHits += 1;
    storeAssistantMemory({
      ip,
      message,
      reply: cached.reply,
      provider: "cache",
      helper: cached.helper || helper,
      model: cached.model || "hybrid",
    });
    incrementMetricCounter(assistantMetrics.providerCounts, "cache");
    incrementMetricCounter(
      assistantMetrics.helperCounts,
      cached.helper || helper,
    );
    res.json({
      ok: true,
      provider: "cache",
      model: cached.model || "hybrid",
      helper: cached.helper || helper,
      reply: cached.reply,
      suggestions: cached.suggestions,
    });
    return;
  }

  if (isSimpleAssistantQuery(message)) {
    assistantMetrics.localHybridResponses += 1;
    const localHelper = helper === "writing" ? "writing" : "general";
    const local = buildRuleBasedAssistantResponse(message);
    setAssistantCacheEntry(cacheKey, {
      model: "rule-based",
      helper: localHelper,
      reply: local.reply,
      suggestions: local.suggestions,
    });
    storeAssistantMemory({
      ip,
      message,
      reply: local.reply,
      provider: "local-hybrid",
      helper: localHelper,
      model: "rule-based",
    });
    incrementMetricCounter(assistantMetrics.providerCounts, "local-hybrid");
    incrementMetricCounter(assistantMetrics.helperCounts, localHelper);
    res.json({
      ok: true,
      provider: "local-hybrid",
      model: "rule-based",
      helper: localHelper,
      reply: local.reply,
      suggestions: local.suggestions,
    });
    return;
  }

  try {
    const ai = await generateAssistantResponse({ message, history, helper });
    const suggestions =
      ai.suggestions.length > 0
        ? ai.suggestions
        : [`${message} guide`, `${message} 2026`, `${message} explained`];

    if (ai.provider === "openai") {
      assistantMetrics.openaiResponses += 1;
    } else if (ai.provider === "anthropic") {
      assistantMetrics.anthropicResponses += 1;
    } else if (ai.provider === "gemini") {
      assistantMetrics.geminiResponses += 1;
    } else {
      assistantMetrics.localHybridResponses += 1;
    }
    incrementMetricCounter(assistantMetrics.providerCounts, ai.provider);
    incrementMetricCounter(assistantMetrics.helperCounts, helper);
    setAssistantCacheEntry(cacheKey, {
      model: ai.model,
      helper,
      reply: ai.reply,
      suggestions,
    });
    storeAssistantMemory({
      ip,
      message,
      reply: ai.reply,
      provider: ai.provider,
      helper,
      model: ai.model,
    });

    res.json({
      ok: true,
      provider: ai.provider,
      model: ai.model,
      helper,
      reply: ai.reply,
      suggestions,
    });
  } catch (error) {
    assistantMetrics.fallbackResponses += 1;
    assistantMetrics.lastProviderError = String(
      error?.message || "Assistant provider unavailable.",
    );
    assistantMetrics.lastProviderErrorAt = new Date().toISOString();

    const fallback = buildRuleBasedAssistantResponse(message);
    setAssistantCacheEntry(cacheKey, {
      model: "rule-based",
      helper,
      reply: fallback.reply,
      suggestions: fallback.suggestions,
    });
    storeAssistantMemory({
      ip,
      message,
      reply: fallback.reply,
      provider: "fallback",
      helper,
      model: "rule-based",
    });
    incrementMetricCounter(assistantMetrics.providerCounts, "fallback");
    incrementMetricCounter(assistantMetrics.helperCounts, helper);

    res.json({
      ok: true,
      provider: "fallback",
      model: "rule-based",
      helper,
      reply: fallback.reply,
      suggestions: fallback.suggestions,
      warning: String(error?.message || "Assistant provider unavailable."),
    });
  }
});

app.get("/api/location/auto", async (req, res) => {
  const ip = getClientIp(req);

  try {
    const location = await resolveApproxLocationByIp(ip);
    res.json({
      ok: true,
      source: location.source,
      ip: sanitizeIpForLookup(ip) || "auto",
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      country: location.country,
    });
  } catch {
    res.status(503).json({
      ok: false,
      error: "Automatic location currently unavailable.",
    });
  }
});

app.use("/api/admin", checkAdminRateLimit);

app.get("/api/admin/assistant-status", adminAuth, (_req, res) => {
  const memory = getAssistantMemorySummary();
  const providers = {
    routingMode: AI_ROUTING_MODE,
    primary: AI_PRIMARY_PROVIDER,
    fallback: AI_FALLBACK_PROVIDER,
    configured: {
      openai: Boolean(OPENAI_API_KEY),
      anthropic: Boolean(ANTHROPIC_API_KEY),
      gemini: Boolean(GEMINI_API_KEY),
    },
    models: {
      openai: OPENAI_MODEL,
      anthropic: ANTHROPIC_MODEL,
      gemini: GEMINI_MODEL,
    },
    activeModels: {
      openai: getActiveProviderModel("openai") || OPENAI_MODEL,
      anthropic: getActiveProviderModel("anthropic") || ANTHROPIC_MODEL,
      gemini: getActiveProviderModel("gemini") || GEMINI_MODEL,
    },
    modelCandidates: {
      openai: OPENAI_MODEL_CANDIDATES,
      anthropic: ANTHROPIC_MODEL_CANDIDATES,
      gemini: GEMINI_MODEL_CANDIDATES,
    },
    health: Object.fromEntries(assistantProviderHealthMap.entries()),
  };
  const anyProviderConfigured = Object.values(providers.configured).some(
    Boolean,
  );

  res.json({
    generatedAt: new Date().toISOString(),
    assistant: {
      configured: anyProviderConfigured,
      model: `${providers.primary}:${providers.models[providers.primary] || OPENAI_MODEL}`,
      providers,
      limits: {
        windowSeconds: Math.round(ASSISTANT_WINDOW_MS / 1000),
        rateLimitCount: ASSISTANT_RATE_LIMIT_COUNT,
        maxChars: ASSISTANT_MAX_CHARS,
        historyMessages: ASSISTANT_HISTORY_MESSAGES,
        historyChars: ASSISTANT_HISTORY_CHARS,
        replyMaxChars: ASSISTANT_REPLY_MAX_CHARS,
        modelTemperature: ASSISTANT_MODEL_TEMPERATURE,
        providerMaxTokens: {
          openai: ASSISTANT_OPENAI_MAX_TOKENS,
          anthropic: ASSISTANT_ANTHROPIC_MAX_TOKENS,
          gemini: ASSISTANT_GEMINI_MAX_TOKENS,
        },
        simpleQueryWords: ASSISTANT_SIMPLE_QUERY_WORDS,
      },
      cache: {
        ttlSeconds: Math.round(ASSISTANT_CACHE_TTL_MS / 1000),
        maxEntries: ASSISTANT_CACHE_MAX_ENTRIES,
        currentEntries: assistantCacheMap.size,
      },
      memory: {
        path: "data/assistant-memory.json",
        ...memory,
        maxItems: ASSISTANT_MEMORY_MAX_ITEMS,
      },
      metrics: assistantMetrics,
      billing: {
        note: "Billing and quota are managed separately for each AI provider account.",
        openai: {
          overviewUrl:
            "https://platform.openai.com/settings/organization/billing/overview",
          usageUrl: "https://platform.openai.com/usage",
        },
        anthropic: {
          overviewUrl: "https://console.anthropic.com/settings/plans",
          usageUrl: "https://console.anthropic.com/settings/usage",
        },
        gemini: {
          overviewUrl: "https://aistudio.google.com/",
          usageUrl:
            "https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas",
        },
      },
    },
  });
});

app.get("/api/admin/runtime-metrics", adminAuth, (_req, res) => {
  const memory = process.memoryUsage();
  const toMb = (bytes) =>
    Math.round((Number(bytes || 0) / (1024 * 1024)) * 100) / 100;

  res.json({
    generatedAt: new Date().toISOString(),
    runtime: {
      process: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
      },
      memory: {
        rssMb: toMb(memory.rss),
        heapTotalMb: toMb(memory.heapTotal),
        heapUsedMb: toMb(memory.heapUsed),
        externalMb: toMb(memory.external),
        arrayBuffersMb: toMb(memory.arrayBuffers),
      },
      assistant: {
        cacheEntries: assistantCacheMap.size,
        contextEntries: assistantContextMap.size,
        providerHealthEntries: assistantProviderHealthMap.size,
        modelStateEntries: assistantProviderModelStateMap.size,
        metrics: assistantMetrics,
      },
      rateLimitMaps: {
        loginAttempts: loginAttemptMap.size,
        admin: adminRateMap.size,
        assistant: assistantRateMap.size,
      },
    },
  });
});

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

function getDjangoSyncAuthHeaderFromRequest(req) {
  return (
    toBearerToken(process.env.DJANGO_ADMIN_TOKEN) ||
    toBearerToken(req.headers.authorization || "")
  );
}

app.get("/api/admin/search/status", adminAuth, (_req, res) => {
  const indexStats = getSearchIndexStats();
  const latestRun = buildAdminSearchLatestRunSummary();
  const rankingConfig = getSearchRankingConfig();
  const sourceCount = Array.isArray(indexStats.topSources)
    ? indexStats.topSources.length
    : 0;

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    search: {
      sources: {
        active: sourceCount,
        total: sourceCount,
      },
      documents: {
        indexed: Number(indexStats.totalDocs || 0),
        blocked: 0,
        errors: 0,
      },
      blockRules: 0,
      latestRun,
      recentRuns: latestRun.startedAt ? [latestRun] : [],
      rankingConfig,
    },
  });
});

app.get("/api/admin/search/ranking-config", adminAuth, (_req, res) => {
  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    rankingConfig: getSearchRankingConfig(),
  });
});

app.post("/api/admin/search/ranking-config", adminAuth, (req, res) => {
  const shouldReset = Boolean(req.body?.reset);

  try {
    const rankingConfig = shouldReset
      ? resetSearchRankingConfig()
      : writeSearchRankingConfig(req.body?.rankingConfig || {});
    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      rankingConfig,
    });
  } catch (error) {
    res.status(400).json({
      error: String(error?.message || "Could not update ranking config."),
    });
  }
});

app.post("/api/admin/search/seed", adminAuth, async (req, res) => {
  const authHeader = getDjangoSyncAuthHeaderFromRequest(req);
  if (!authHeader) {
    res.status(400).json({
      error:
        "Missing Django auth token. Set DJANGO_ADMIN_TOKEN or provide Authorization header.",
    });
    return;
  }

  try {
    const result = await executeDjangoIndexSync({
      req,
      authHeader,
      source: "",
      statusFilter: "indexed",
      pageSize: DJANGO_INDEX_SYNC_PAGE_SIZE,
      maxPages: Math.max(5, DJANGO_INDEX_SYNC_MAX_PAGES),
      createBackup: true,
      updatedSince: null,
      reason: "seed",
    });

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      seed: result.sync,
      refresh: result.refresh,
      index: result.index,
    });
  } catch (error) {
    res.status(502).json({
      error: String(error?.message || "Could not seed search sources."),
    });
  }
});

app.post("/api/admin/search/crawl", adminAuth, async (req, res) => {
  const authHeader = getDjangoSyncAuthHeaderFromRequest(req);
  if (!authHeader) {
    res.status(400).json({
      error:
        "Missing Django auth token. Set DJANGO_ADMIN_TOKEN or provide Authorization header.",
    });
    return;
  }

  const maxPages = Math.max(
    1,
    Math.min(
      300,
      Number.parseInt(
        String(req.body?.maxPages || DJANGO_INDEX_SYNC_MAX_PAGES),
        10,
      ) || DJANGO_INDEX_SYNC_MAX_PAGES,
    ),
  );

  try {
    const result = await executeDjangoIndexSync({
      req,
      authHeader,
      source: "",
      statusFilter: "indexed",
      pageSize: DJANGO_INDEX_SYNC_PAGE_SIZE,
      maxPages,
      createBackup: true,
      updatedSince: null,
      reason: "crawl",
    });

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      crawl: result.sync,
      refresh: result.refresh,
      index: result.index,
    });
  } catch (error) {
    res.status(502).json({
      error: String(error?.message || "Could not start search crawl."),
    });
  }
});

app.get("/api/admin/index/status", adminAuth, (_req, res) => {
  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    index: getSearchIndexStats(),
  });
});

app.post("/api/admin/index/refresh", adminAuth, (req, res) => {
  const mergeDocs = Array.isArray(req.body?.mergeDocs)
    ? req.body.mergeDocs
    : [];
  const createBackup =
    req.body?.createBackup == null ? true : Boolean(req.body?.createBackup);

  if (mergeDocs.length > 2000) {
    res.status(400).json({
      error: "Too many mergeDocs items in one request. Max is 2000.",
    });
    return;
  }

  try {
    const refresh = rebuildLocalSearchIndex({
      mergeDocs,
      createBackup,
    });

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      refresh,
      index: getSearchIndexStats(),
    });
  } catch (error) {
    res.status(500).json({
      error: String(error?.message || "Could not refresh local search index."),
    });
  }
});

app.get("/api/admin/index/backups", adminAuth, (req, res) => {
  const requestedReason = String(req.query.reason || "all")
    .trim()
    .toLowerCase();
  const backups = listSearchIndexBackups();
  const filtered =
    requestedReason && requestedReason !== "all"
      ? backups.filter(
          (item) => String(item.reason || "").toLowerCase() === requestedReason,
        )
      : backups;

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    reason: requestedReason || "all",
    total: filtered.length,
    backups: filtered.slice(0, 200),
  });
});

app.post("/api/admin/index/restore", adminAuth, (req, res) => {
  const fileName = sanitizeSearchIndexBackupFileName(req.body?.fileName);
  if (!fileName) {
    res.status(400).json({ error: "Invalid search-index backup file name." });
    return;
  }

  const createBackup =
    req.body?.createBackup == null ? true : Boolean(req.body?.createBackup);

  try {
    const restore = restoreSearchIndexFromBackup(fileName, { createBackup });
    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      restore,
      index: getSearchIndexStats(),
    });
  } catch (error) {
    const message = String(error?.message || "Could not restore search index.");
    if (/not found/i.test(message)) {
      res.status(404).json({ error: message });
      return;
    }
    res.status(400).json({ error: message });
  }
});

app.post("/api/admin/index/sync-django", adminAuth, async (req, res) => {
  const source = String(req.body?.source || "")
    .trim()
    .toLowerCase();
  const statusFilter = String(req.body?.status || "indexed")
    .trim()
    .toLowerCase();
  const pageSize = Math.max(
    1,
    Math.min(
      500,
      Number.parseInt(String(req.body?.pageSize || "200"), 10) || 200,
    ),
  );
  const maxPages = Math.max(
    1,
    Math.min(
      300,
      Number.parseInt(String(req.body?.maxPages || "50"), 10) || 50,
    ),
  );
  const createBackup =
    req.body?.createBackup == null ? true : Boolean(req.body?.createBackup);
  const useWatermark = Boolean(req.body?.useWatermark);
  const resetWatermark = Boolean(req.body?.resetWatermark);
  const updatedSinceRaw = String(req.body?.updatedSince || "").trim();
  let updatedSince = updatedSinceRaw
    ? parseOptionalIsoDate(updatedSinceRaw)
    : null;
  let usedPersistedWatermark = false;

  const allowedStatuses = new Set(["indexed", "blocked", "error", "all"]);
  if (!allowedStatuses.has(statusFilter)) {
    res.status(400).json({
      error: "Invalid status. Allowed: indexed, blocked, error, all.",
    });
    return;
  }

  if (updatedSinceRaw && !updatedSince) {
    res.status(400).json({ error: "Invalid updatedSince ISO datetime." });
    return;
  }

  if (resetWatermark) {
    const syncState = readDjangoIndexSyncState();
    writeDjangoIndexSyncState({
      ...syncState,
      updatedSince: "",
    });
  }

  if (!updatedSince && useWatermark) {
    const syncState = readDjangoIndexSyncState();
    const persisted = parseOptionalIsoDate(syncState.updatedSince);
    if (persisted) {
      updatedSince = persisted;
      usedPersistedWatermark = true;
    }
  }

  const explicitDjangoToken = toBearerToken(
    req.body?.djangoToken || process.env.DJANGO_ADMIN_TOKEN,
  );
  const forwardedAuthHeader = toBearerToken(req.headers.authorization || "");
  const djangoAuthHeader = explicitDjangoToken || forwardedAuthHeader;

  if (!djangoAuthHeader) {
    res.status(400).json({
      error:
        "Missing Django auth token. Provide body.djangoToken or DJANGO_ADMIN_TOKEN.",
    });
    return;
  }

  try {
    const result = await executeDjangoIndexSync({
      req,
      authHeader: djangoAuthHeader,
      source,
      statusFilter,
      pageSize,
      maxPages,
      createBackup,
      updatedSince,
      reason: "manual",
    });

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      sync: {
        ...result.sync,
        useWatermark,
        resetWatermark,
        usedPersistedWatermark,
      },
      refresh: result.refresh,
      index: result.index,
      state: result.state,
    });
  } catch (error) {
    res.status(502).json({
      error: String(error?.message || "Django sync failed."),
      sync: {
        source: source || "all",
        status: statusFilter,
        updatedSince: updatedSince ? updatedSince.toISOString() : "",
        maxPages,
        pageSize,
      },
    });
  }
});

app.post("/api/admin/index/sync-reset-watermark", adminAuth, (req, res) => {
  const updatedSinceRaw = String(req.body?.updatedSince || "").trim();
  const updatedSince = updatedSinceRaw
    ? parseOptionalIsoDate(updatedSinceRaw)
    : null;

  if (updatedSinceRaw && !updatedSince) {
    res.status(400).json({ error: "Invalid updatedSince ISO datetime." });
    return;
  }

  const current = readDjangoIndexSyncState();
  const nextState = {
    ...current,
    updatedSince: updatedSince ? updatedSince.toISOString() : "",
    lastError: "",
  };
  writeDjangoIndexSyncState(nextState);

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    state: nextState,
  });
});

app.get("/api/admin/index/sync-status", adminAuth, (_req, res) => {
  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    running: djangoSyncInFlight,
    config: {
      enabled: DJANGO_INDEX_SYNC_ENABLED,
      intervalMs: DJANGO_INDEX_SYNC_INTERVAL_MS,
      startup: DJANGO_INDEX_SYNC_STARTUP,
      defaultMaxPages: DJANGO_INDEX_SYNC_MAX_PAGES,
      defaultPageSize: DJANGO_INDEX_SYNC_PAGE_SIZE,
      hasDjangoAdminToken: Boolean(
        String(process.env.DJANGO_ADMIN_TOKEN || "").trim(),
      ),
    },
    runtime: djangoSyncRuntime,
    state: readDjangoIndexSyncState(),
  });
});

app.get("/api/admin/overview", adminAuth, (req, res) => {
  const analytics = readJson(analyticsPath, {
    searches: [],
    pageViews: [],
    resultClicks: [],
  });
  const allSearches = Array.isArray(analytics.searches)
    ? analytics.searches
    : [];
  const allPageViews = Array.isArray(analytics.pageViews)
    ? analytics.pageViews
    : [];
  const allResultClicks = Array.isArray(analytics.resultClicks)
    ? analytics.resultClicks
    : [];
  const requestedRange = String(req.query.range || "all");
  const range = ["all", "24h", "7d", "30d"].includes(requestedRange)
    ? requestedRange
    : "all";

  const sinceDate = parseRangeToSince(range);
  const searches = filterByDateRange(allSearches, sinceDate);
  const pageViews = filterByDateRange(allPageViews, sinceDate);
  const resultClicks = filterByDateRange(allResultClicks, sinceDate);
  const overview = buildOverview(searches, pageViews, resultClicks);
  const comparison = getPeriodComparison(
    allSearches,
    allPageViews,
    allResultClicks,
    range,
  );

  res.json({
    generatedAt: new Date().toISOString(),
    range,
    comparison,
    clickSignalConfig: {
      windowDays: CLICK_SIGNAL_WINDOW_DAYS,
      decayHalfLifeDays: CLICK_SIGNAL_DECAY_HALFLIFE_DAYS,
      decayMinWeight: CLICK_SIGNAL_DECAY_MIN_WEIGHT,
      maxBoost: CLICK_SIGNAL_MAX_BOOST,
      ctrMaxBoost: CLICK_SIGNAL_CTR_MAX_BOOST,
      guardrailMinBaseScore: CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE,
      guardrailMaxShare: CLICK_SIGNAL_GUARDRAIL_MAX_SHARE,
      dedupSeconds: Math.round(CLICK_SIGNAL_DEDUP_WINDOW_MS / 1000),
      rangeStartAt: sinceDate ? sinceDate.toISOString() : null,
    },
    clickSignalTelemetry,
    ...overview,
  });
});

app.post("/api/admin/click-signal/reset", adminAuth, (_req, res) => {
  clickSignalTelemetry = createClickSignalTelemetryState();

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    clickSignalTelemetry,
  });
});

app.post("/api/admin/click-signal/snapshot-reset", adminAuth, (_req, res) => {
  const generatedAt = new Date().toISOString();
  const snapshot = {
    generatedAt,
    clickSignalConfig: {
      windowDays: CLICK_SIGNAL_WINDOW_DAYS,
      decayHalfLifeDays: CLICK_SIGNAL_DECAY_HALFLIFE_DAYS,
      decayMinWeight: CLICK_SIGNAL_DECAY_MIN_WEIGHT,
      maxBoost: CLICK_SIGNAL_MAX_BOOST,
      ctrMaxBoost: CLICK_SIGNAL_CTR_MAX_BOOST,
      guardrailMinBaseScore: CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE,
      guardrailMaxShare: CLICK_SIGNAL_GUARDRAIL_MAX_SHARE,
      dedupSeconds: Math.round(CLICK_SIGNAL_DEDUP_WINDOW_MS / 1000),
    },
    clickSignalTelemetry,
  };

  clickSignalTelemetry = createClickSignalTelemetryState();

  res.json({
    ok: true,
    generatedAt,
    snapshot,
    clickSignalTelemetry,
  });
});

app.get("/api/admin/backups", adminAuth, (req, res) => {
  const requestedReason = String(req.query.reason || "all").trim();
  const reasonFilter = requestedReason === "all" ? "all" : requestedReason;
  if (reasonFilter !== "all" && !isAllowedBackupReason(reasonFilter)) {
    res.status(400).json({ error: "Invalid backup reason filter." });
    return;
  }

  const allBackups = listBackups();
  const filteredBackups =
    reasonFilter === "all"
      ? allBackups
      : allBackups.filter((item) => item.reason === reasonFilter);

  res.json({
    generatedAt: new Date().toISOString(),
    reason: reasonFilter,
    backups: filteredBackups.slice(0, 100),
  });
});

app.get("/api/admin/backups/download", adminAuth, (req, res) => {
  const fileName = sanitizeBackupFileName(req.query.fileName);
  if (!fileName) {
    res.status(400).json({ error: "Invalid backup file name." });
    return;
  }

  const sourcePath = path.join(backupDir, fileName);
  if (!fs.existsSync(sourcePath)) {
    res.status(404).json({ error: "Backup file not found." });
    return;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${JSON.stringify(fileName)}`,
  );
  res.sendFile(sourcePath);
});

app.post("/api/admin/backups/create", adminAuth, (_req, res) => {
  backupAnalytics("manual", { force: true });
  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    backups: listBackups().slice(0, 100),
  });
});

app.post("/api/admin/backups/restore", adminAuth, (req, res) => {
  const fileName = sanitizeBackupFileName(req.body?.fileName);
  if (!fileName) {
    res.status(400).json({ error: "Invalid backup file name." });
    return;
  }

  const sourcePath = path.join(backupDir, fileName);
  if (!fs.existsSync(sourcePath)) {
    res.status(404).json({ error: "Backup file not found." });
    return;
  }

  backupAnalytics("pre-restore", { force: true });
  fs.copyFileSync(sourcePath, analyticsPath);
  backupAnalytics("restored", { force: true });

  res.json({
    ok: true,
    restoredFrom: fileName,
    generatedAt: new Date().toISOString(),
  });
});

app.get("/api/admin/export.csv", adminAuth, (req, res) => {
  const analytics = readJson(analyticsPath, {
    searches: [],
    pageViews: [],
    resultClicks: [],
  });
  const allSearches = Array.isArray(analytics.searches)
    ? analytics.searches
    : [];
  const allPageViews = Array.isArray(analytics.pageViews)
    ? analytics.pageViews
    : [];
  const allResultClicks = Array.isArray(analytics.resultClicks)
    ? analytics.resultClicks
    : [];
  const requestedRange = String(req.query.range || "all");
  const range = ["all", "24h", "7d", "30d"].includes(requestedRange)
    ? requestedRange
    : "all";

  const sinceDate = parseRangeToSince(range);
  const searches = filterByDateRange(allSearches, sinceDate);
  const pageViews = filterByDateRange(allPageViews, sinceDate);
  const resultClicks = filterByDateRange(allResultClicks, sinceDate);
  const overview = buildOverview(searches, pageViews, resultClicks);

  const lines = [];
  lines.push(
    "rowType,timestamp,query,resultCount,page,ip,userAgent,count,percent,range",
  );

  for (const item of searches) {
    lines.push(
      [
        "search",
        item.at || "",
        item.query || "",
        item.resultCount || 0,
        "",
        item.ip || "",
        "",
        "",
        "",
        range,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  for (const item of resultClicks) {
    lines.push(
      [
        "result_click",
        item.at || "",
        item.query || "",
        "",
        item.url || "",
        item.ip || "",
        "",
        "",
        "",
        range,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  for (const item of pageViews) {
    lines.push(
      [
        "page_view",
        item.at || "",
        "",
        "",
        item.page || "",
        item.ip || "",
        item.userAgent || "",
        "",
        "",
        range,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  for (const item of overview.topQueries) {
    lines.push(
      [
        "top_query",
        "",
        item.query,
        "",
        "",
        "",
        "",
        item.count,
        item.percent,
        range,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  for (const item of overview.trafficByPage) {
    lines.push(
      [
        "traffic_page",
        "",
        "",
        "",
        item.page,
        "",
        "",
        item.count,
        item.percent,
        range,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=magneto-analytics-${range}-${stamp}.csv`,
  );
  res.send(lines.join("\n"));
});

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    service: "magneto-search",
    timestamp: new Date().toISOString(),
    runtime: {
      port: PORT,
      loginWindowMinutes: Math.round(LOGIN_WINDOW_MS / 60000),
      loginRateLimitCount: LOGIN_RATE_LIMIT_COUNT,
      lockoutThreshold: LOCKOUT_THRESHOLD,
      lockoutMinutes: Math.round(LOCKOUT_MS / 60000),
      adminWindowSeconds: Math.round(ADMIN_WINDOW_MS / 1000),
      adminRateLimitCount: ADMIN_RATE_LIMIT_COUNT,
      backupMinIntervalMinutes: Math.round(BACKUP_MIN_INTERVAL_MS / 60000),
      backupScheduleMinutes: Math.round(BACKUP_SCHEDULE_MS / 60000),
      maxBackupFiles: MAX_BACKUP_FILES,
      trendDailyPoints: TREND_DAILY_POINTS,
      trendWeeklyPoints: TREND_WEEKLY_POINTS,
    },
  });
});

// ─── Traffic routing state ────────────────────────────────────────────────────
const VALID_ROUTING_BACKENDS = ["node", "django"];
const VALID_CANARY_PERCENTAGES = [0, 10, 50, 100];

function _loadRoutingState() {
  const defaults = {
    activeBackend: "node",
    canaryPercent: 100,
    djangoUrl: String(process.env.DJANGO_API_URL || "http://127.0.0.1:8000"),
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
      saved.djangoUrl = String(
        process.env.DJANGO_API_URL || "http://127.0.0.1:8000",
      );
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

app.get("/api/admin/routing", adminAuth, (_req, res) => {
  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    routing: { ...routingState },
  });
});

app.post("/api/admin/routing", adminAuth, (req, res) => {
  const body = req.body || {};
  const newBackend = String(body.activeBackend || "").toLowerCase();
  const newCanaryRaw = body.canaryPercent;
  const newNote = String(body.note || "").slice(0, 300);

  if (newBackend && !VALID_ROUTING_BACKENDS.includes(newBackend)) {
    res
      .status(400)
      .json({ error: "Invalid activeBackend. Allowed: node, django." });
    return;
  }

  if (
    newCanaryRaw !== undefined &&
    !VALID_CANARY_PERCENTAGES.includes(Number(newCanaryRaw))
  ) {
    res
      .status(400)
      .json({ error: "Invalid canaryPercent. Allowed: 0, 10, 50, 100." });
    return;
  }

  if (newBackend) {
    routingState.activeBackend = newBackend;
  }

  if (newCanaryRaw !== undefined) {
    routingState.canaryPercent = Number(newCanaryRaw);
  }

  if (newNote) {
    routingState.note = newNote;
  }

  routingState.updatedAt = new Date().toISOString();
  _saveRoutingState();

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    routing: { ...routingState },
  });
});

app.post("/api/admin/routing/verify", adminAuth, async (_req, res) => {
  const checks = [];

  const nodeHealthUrl = `http://127.0.0.1:${PORT}/api/health`;
  const nodeStart = Date.now();
  try {
    const nodeResp = await fetch(nodeHealthUrl);
    const nodeData = await nodeResp.json().catch(() => ({}));
    const nodeOk =
      nodeResp.ok && (nodeData.ok === true || nodeData.status === "ok");
    checks.push({
      backend: "node",
      url: nodeHealthUrl,
      ok: nodeOk,
      statusCode: nodeResp.status,
      latencyMs: Date.now() - nodeStart,
    });
  } catch (err) {
    checks.push({
      backend: "node",
      url: nodeHealthUrl,
      ok: false,
      error: String(err?.message || "Unreachable"),
      latencyMs: Date.now() - nodeStart,
    });
  }

  const djangoHealthUrl = `${routingState.djangoUrl}/api/health`;
  const djangoStart = Date.now();
  try {
    const djangoResp = await fetch(djangoHealthUrl);
    const djangoData = await djangoResp.json().catch(() => ({}));
    const djangoOk =
      djangoResp.ok && (djangoData.ok === true || djangoData.status === "ok");
    checks.push({
      backend: "django",
      url: djangoHealthUrl,
      ok: djangoOk,
      statusCode: djangoResp.status,
      latencyMs: Date.now() - djangoStart,
    });
  } catch (err) {
    checks.push({
      backend: "django",
      url: djangoHealthUrl,
      ok: false,
      error: String(err?.message || "Unreachable"),
      latencyMs: Date.now() - djangoStart,
    });
  }

  const allOk = checks.every((c) => c.ok);
  res.json({
    ok: allOk,
    generatedAt: new Date().toISOString(),
    checks,
    routing: { ...routingState },
  });
});

ensureAnalyticsFile();
backupAnalytics("startup");

async function runScheduledDjangoIndexSync(reason = "scheduled") {
  if (!DJANGO_INDEX_SYNC_ENABLED) {
    return;
  }

  const authHeader = toBearerToken(process.env.DJANGO_ADMIN_TOKEN);
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
