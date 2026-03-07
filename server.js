const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

const dataDir = path.join(__dirname, "data");
const analyticsPath = path.join(dataDir, "analytics.json");
const searchIndexPath = path.join(dataDir, "search-index.json");
const backupDir = path.join(dataDir, "backups");

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

const loginAttemptMap = new Map();
const adminRateMap = new Map();
let lastBackupAt = 0;

app.use(express.json({ limit: "250kb" }));
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

app.use("/api/admin", checkAdminRateLimit);

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

ensureAnalyticsFile();
backupAnalytics("startup");

setInterval(() => {
  backupAnalytics("scheduled");
}, BACKUP_SCHEDULE_MS).unref();

app.listen(PORT, () => {
  console.log(`MAGNETO server running on http://localhost:${PORT}`);
});
