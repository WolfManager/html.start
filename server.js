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
  String(process.env.GEMINI_MODEL || "gemini-1.5-flash").trim() ||
  "gemini-1.5-flash";

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
  [GEMINI_MODEL, "gemini-1.5-flash", "gemini-1.5-pro"],
);

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

const dataDir = path.join(__dirname, "data");
const analyticsPath = path.join(dataDir, "analytics.json");
const searchIndexPath = path.join(dataDir, "search-index.json");
const backupDir = path.join(dataDir, "backups");
const assistantMemoryPath = path.join(dataDir, "assistant-memory.json");
const routingStatePath = path.join(dataDir, "routing-state.json");

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

function buildOverview(searches, pageViews) {
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

  return {
    totals: {
      totalSearches,
      totalPageViews: totalViews,
      uniqueQueries: Object.keys(queryCounts).length,
    },
    topQueries,
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

function getTotalsForItems(searches, pageViews) {
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
  };
}

function getPeriodComparison(allSearches, allPageViews, range) {
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

  const previousSearches = allSearches.filter((item) => {
    const at = Date.parse(String(item.at || ""));
    return !Number.isNaN(at) && at >= previousStart && at < previousEnd;
  });

  const previousPageViews = allPageViews.filter((item) => {
    const at = Date.parse(String(item.at || ""));
    return !Number.isNaN(at) && at >= previousStart && at < previousEnd;
  });

  const currentTotals = getTotalsForItems(currentSearches, currentPageViews);
  const previousTotals = getTotalsForItems(previousSearches, previousPageViews);

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
  // Premium mode: route conversational requests to AI providers.
  void message;
  return false;
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
  return String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function computeScore(doc, tokens) {
  if (tokens.length === 0) {
    return 0;
  }

  const title = String(doc.title || "").toLowerCase();
  const summary = String(doc.summary || "").toLowerCase();
  const category = String(doc.category || "").toLowerCase();
  const tags = Array.isArray(doc.tags)
    ? doc.tags.map((tag) => String(tag || "").toLowerCase())
    : [];

  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 6;
    }

    if (summary.includes(token)) {
      score += 3;
    }

    if (category.includes(token)) {
      score += 2;
    }

    for (const tag of tags) {
      if (tag.includes(token)) {
        score += 4;
      }
    }
  }

  return score;
}

function runSearch(query) {
  const index = readJson(searchIndexPath, []);
  const tokens = tokenize(query);

  const ranked = index
    .map((doc) => ({ ...doc, score: computeScore(doc, tokens) }))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ score, ...rest }) => rest);

  if (ranked.length > 0) {
    return ranked;
  }

  return index.slice(0, 12);
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

app.get("/api/search", (req, res) => {
  const query = String(req.query.q || "").trim();

  if (!query) {
    res.status(400).json({ error: "Query is required." });
    return;
  }

  const results = runSearch(query);
  logSearch({
    query,
    resultCount: results.length,
    ip: req.ip,
  });

  res.json({
    engine: "MAGNETO Core",
    query,
    total: results.length,
    results,
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

app.get("/api/admin/overview", adminAuth, (req, res) => {
  const analytics = readJson(analyticsPath, { searches: [], pageViews: [] });
  const allSearches = Array.isArray(analytics.searches)
    ? analytics.searches
    : [];
  const allPageViews = Array.isArray(analytics.pageViews)
    ? analytics.pageViews
    : [];
  const requestedRange = String(req.query.range || "all");
  const range = ["all", "24h", "7d", "30d"].includes(requestedRange)
    ? requestedRange
    : "all";

  const sinceDate = parseRangeToSince(range);
  const searches = filterByDateRange(allSearches, sinceDate);
  const pageViews = filterByDateRange(allPageViews, sinceDate);
  const overview = buildOverview(searches, pageViews);
  const comparison = getPeriodComparison(allSearches, allPageViews, range);

  res.json({
    generatedAt: new Date().toISOString(),
    range,
    comparison,
    ...overview,
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
  const analytics = readJson(analyticsPath, { searches: [], pageViews: [] });
  const allSearches = Array.isArray(analytics.searches)
    ? analytics.searches
    : [];
  const allPageViews = Array.isArray(analytics.pageViews)
    ? analytics.pageViews
    : [];
  const requestedRange = String(req.query.range || "all");
  const range = ["all", "24h", "7d", "30d"].includes(requestedRange)
    ? requestedRange
    : "all";

  const sinceDate = parseRangeToSince(range);
  const searches = filterByDateRange(allSearches, sinceDate);
  const pageViews = filterByDateRange(allPageViews, sinceDate);
  const overview = buildOverview(searches, pageViews);

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

setInterval(() => {
  backupAnalytics("scheduled");
}, BACKUP_SCHEDULE_MS).unref();

app.listen(PORT, () => {
  console.log(`MAGNETO server running on http://localhost:${PORT}`);
});
