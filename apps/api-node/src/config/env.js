function parseModelCandidates(value, defaults) {
  const list = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const merged = [...list, ...defaults];
  return [...new Set(merged)];
}

function normalizeAiProvider(input, fallback = "openai") {
  const normalized = String(input || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "openai" ||
    normalized === "anthropic" ||
    normalized === "gemini" ||
    normalized === "ollama" ||
    normalized === "litellm"
  ) {
    return normalized;
  }

  return fallback;
}

function parseProviderOrder(value) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeAiProvider(item, ""))
    .filter(Boolean);
}

function parseStringList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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
const OLLAMA_ENABLED = ["1", "true", "yes", "on"].includes(
  String(process.env.OLLAMA_ENABLED || "")
    .trim()
    .toLowerCase(),
);
const OLLAMA_BASE_URL =
  String(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").trim() ||
  "http://127.0.0.1:11434";
const OLLAMA_MODEL =
  String(process.env.OLLAMA_MODEL || "llama3.1:8b").trim() || "llama3.1:8b";
const LITELLM_ENABLED = ["1", "true", "yes", "on"].includes(
  String(process.env.LITELLM_ENABLED || "")
    .trim()
    .toLowerCase(),
);
const LITELLM_BASE_URL =
  String(process.env.LITELLM_BASE_URL || "http://127.0.0.1:4000").trim() ||
  "http://127.0.0.1:4000";
const LITELLM_API_KEY = String(process.env.LITELLM_API_KEY || "").trim();
const LITELLM_MODEL =
  String(process.env.LITELLM_MODEL || "llm-primary").trim() || "llm-primary";
const AI_PRIMARY_PROVIDER = normalizeAiProvider(
  process.env.AI_PRIMARY_PROVIDER,
  "openai",
);

const env = {
  PORT: Number(process.env.PORT || 3000),
  LOG_LEVEL:
    String(process.env.LOG_LEVEL || "info")
      .trim()
      .toLowerCase() || "info",
  CORS_ALLOWED_ORIGINS: parseStringList(process.env.CORS_ALLOWED_ORIGINS),
  JWT_SECRET: process.env.JWT_SECRET || "change-this-secret",
  ADMIN_USER: process.env.ADMIN_USER || "admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "change-this-password",
  OPENAI_API_KEY,
  OPENAI_MODEL,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  OLLAMA_ENABLED,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
  LITELLM_ENABLED,
  LITELLM_BASE_URL,
  LITELLM_API_KEY,
  LITELLM_MODEL,
  OPENAI_MODEL_CANDIDATES: parseModelCandidates(
    process.env.OPENAI_MODEL_CANDIDATES,
    [OPENAI_MODEL, "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"],
  ),
  ANTHROPIC_MODEL_CANDIDATES: parseModelCandidates(
    process.env.ANTHROPIC_MODEL_CANDIDATES,
    [ANTHROPIC_MODEL, "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
  ),
  GEMINI_MODEL_CANDIDATES: parseModelCandidates(
    process.env.GEMINI_MODEL_CANDIDATES,
    [GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest"],
  ),
  OLLAMA_MODEL_CANDIDATES: parseModelCandidates(
    process.env.OLLAMA_MODEL_CANDIDATES,
    [OLLAMA_MODEL, "llama3.1:8b", "mistral:7b", "phi3:mini"],
  ),
  LITELLM_MODEL_CANDIDATES: parseModelCandidates(
    process.env.LITELLM_MODEL_CANDIDATES,
    [LITELLM_MODEL, "llm-fast", "llm-primary"],
  ),
  AI_PRIMARY_PROVIDER,
  AI_FALLBACK_PROVIDER: normalizeAiProvider(
    process.env.AI_FALLBACK_PROVIDER,
    AI_PRIMARY_PROVIDER === "openai" ? "anthropic" : "openai",
  ),
  AI_ROUTING_MODE:
    String(process.env.AI_ROUTING_MODE || "smart")
      .trim()
      .toLowerCase() || "smart",
  AI_PROVIDER_ORDER: parseProviderOrder(process.env.AI_PROVIDER_ORDER),
  SEARCH_CACHE_TTL_MS:
    envNumber("SEARCH_CACHE_TTL_SECONDS", 300, { min: 30, max: 3600 }) * 1000,
  SEARCH_CACHE_MAX_ENTRIES: envNumber("SEARCH_CACHE_MAX_ENTRIES", 500, {
    min: 50,
    max: 5000,
  }),
  SEARCH_PROXY_TIMEOUT_MS: envNumber("SEARCH_PROXY_TIMEOUT_MS", 5000, {
    min: 500,
    max: 30000,
  }),
  LOGIN_WINDOW_MS:
    envNumber("LOGIN_WINDOW_MINUTES", 15, { min: 1, max: 120 }) * 60 * 1000,
  LOGIN_RATE_LIMIT_COUNT: envNumber("LOGIN_RATE_LIMIT_COUNT", 20, {
    min: 1,
    max: 500,
  }),
  LOCKOUT_THRESHOLD: envNumber("LOCKOUT_THRESHOLD", 5, {
    min: 1,
    max: 20,
  }),
  LOCKOUT_MS:
    envNumber("LOCKOUT_MINUTES", 15, { min: 1, max: 180 }) * 60 * 1000,
  ADMIN_WINDOW_MS:
    envNumber("ADMIN_WINDOW_SECONDS", 60, { min: 5, max: 600 }) * 1000,
  ADMIN_RATE_LIMIT_COUNT: envNumber("ADMIN_RATE_LIMIT_COUNT", 120, {
    min: 5,
    max: 2000,
  }),
  BACKUP_MIN_INTERVAL_MS:
    envNumber("BACKUP_MIN_INTERVAL_MINUTES", 15, { min: 1, max: 240 }) *
    60 *
    1000,
  BACKUP_SCHEDULE_MS:
    envNumber("BACKUP_SCHEDULE_MINUTES", 60, { min: 1, max: 1440 }) * 60 * 1000,
  DJANGO_INDEX_SYNC_INTERVAL_MS:
    envNumber("DJANGO_INDEX_SYNC_INTERVAL_MINUTES", 15, {
      min: 1,
      max: 1440,
    }) *
    60 *
    1000,
  DJANGO_INDEX_SYNC_MAX_PAGES: envNumber("DJANGO_INDEX_SYNC_MAX_PAGES", 50, {
    min: 1,
    max: 300,
  }),
  DJANGO_INDEX_SYNC_PAGE_SIZE: envNumber("DJANGO_INDEX_SYNC_PAGE_SIZE", 200, {
    min: 1,
    max: 500,
  }),
  DJANGO_INDEX_SYNC_ENABLED:
    String(process.env.DJANGO_INDEX_SYNC_ENABLED || "true")
      .trim()
      .toLowerCase() !== "false",
  DJANGO_INDEX_SYNC_STARTUP:
    String(process.env.DJANGO_INDEX_SYNC_STARTUP || "true")
      .trim()
      .toLowerCase() !== "false",
  MAX_BACKUP_FILES: envNumber("MAX_BACKUP_FILES", 120, {
    min: 5,
    max: 10000,
  }),
  TREND_DAILY_POINTS: envNumber("TREND_DAILY_POINTS", 14, {
    min: 7,
    max: 90,
  }),
  TREND_WEEKLY_POINTS: envNumber("TREND_WEEKLY_POINTS", 8, {
    min: 4,
    max: 104,
  }),
  ASSISTANT_WINDOW_MS:
    envNumber("ASSISTANT_WINDOW_SECONDS", 60, { min: 5, max: 600 }) * 1000,
  ASSISTANT_RATE_LIMIT_COUNT: envNumber("ASSISTANT_RATE_LIMIT_COUNT", 240, {
    min: 1,
    max: 5000,
  }),
  ASSISTANT_MAX_CHARS: envNumber("ASSISTANT_MAX_CHARS", 4000, {
    min: 100,
    max: 12000,
  }),
  ASSISTANT_HISTORY_MESSAGES: envNumber("ASSISTANT_HISTORY_MESSAGES", 14, {
    min: 0,
    max: 50,
  }),
  ASSISTANT_HISTORY_CHARS: envNumber("ASSISTANT_HISTORY_CHARS", 1200, {
    min: 0,
    max: 12000,
  }),
  ASSISTANT_REPLY_MAX_CHARS: envNumber("ASSISTANT_REPLY_MAX_CHARS", 1200, {
    min: 100,
    max: 12000,
  }),
  ASSISTANT_MODEL_TEMPERATURE: envNumber("ASSISTANT_MODEL_TEMPERATURE", 0.4, {
    min: 0,
    max: 2,
  }),
  ASSISTANT_OPENAI_MAX_TOKENS: envNumber("ASSISTANT_OPENAI_MAX_TOKENS", 600, {
    min: 64,
    max: 8000,
  }),
  ASSISTANT_ANTHROPIC_MAX_TOKENS: envNumber(
    "ASSISTANT_ANTHROPIC_MAX_TOKENS",
    600,
    {
      min: 64,
      max: 8000,
    },
  ),
  ASSISTANT_GEMINI_MAX_TOKENS: envNumber("ASSISTANT_GEMINI_MAX_TOKENS", 600, {
    min: 64,
    max: 8000,
  }),
  ASSISTANT_LITELLM_MAX_TOKENS: envNumber("ASSISTANT_LITELLM_MAX_TOKENS", 600, {
    min: 64,
    max: 8000,
  }),
  ASSISTANT_PROVIDER_TIMEOUT_MS: envNumber(
    "ASSISTANT_PROVIDER_TIMEOUT_MS",
    15000,
    {
      min: 1000,
      max: 60000,
    },
  ),
  ASSISTANT_CACHE_TTL_MS:
    envNumber("ASSISTANT_CACHE_TTL_SECONDS", 3600, {
      min: 60,
      max: 86400,
    }) * 1000,
  ASSISTANT_CACHE_MAX_ENTRIES: envNumber("ASSISTANT_CACHE_MAX_ENTRIES", 500, {
    min: 10,
    max: 5000,
  }),
  ASSISTANT_MEMORY_MAX_ITEMS: envNumber("ASSISTANT_MEMORY_MAX_ITEMS", 100, {
    min: 10,
    max: 5000,
  }),
  ASSISTANT_SIMPLE_QUERY_WORDS: envNumber("ASSISTANT_SIMPLE_QUERY_WORDS", 8, {
    min: 1,
    max: 100,
  }),
  CLICK_SIGNAL_WINDOW_DAYS: envNumber("CLICK_SIGNAL_WINDOW_DAYS", 30, {
    min: 1,
    max: 365,
  }),
  CLICK_SIGNAL_MAX_BOOST: envNumber("CLICK_SIGNAL_MAX_BOOST", 10, {
    min: 0,
    max: 100,
  }),
  CLICK_SIGNAL_CTR_MAX_BOOST: envNumber("CLICK_SIGNAL_CTR_MAX_BOOST", 3, {
    min: 0,
    max: 100,
  }),
  CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE: envNumber(
    "CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE",
    0.8,
    { min: 0, max: 2 },
  ),
  CLICK_SIGNAL_GUARDRAIL_MAX_SHARE: envNumber(
    "CLICK_SIGNAL_GUARDRAIL_MAX_SHARE",
    0.8,
    { min: 0, max: 2 },
  ),
  CLICK_SIGNAL_DECAY_HALFLIFE_DAYS: envNumber(
    "CLICK_SIGNAL_DECAY_HALFLIFE_DAYS",
    7,
    { min: 1, max: 120 },
  ),
  CLICK_SIGNAL_DECAY_MIN_WEIGHT: envNumber(
    "CLICK_SIGNAL_DECAY_MIN_WEIGHT",
    0.05,
    { min: 0, max: 1 },
  ),
  CLICK_SIGNAL_DEDUP_WINDOW_MS:
    envNumber("CLICK_SIGNAL_DEDUP_SECONDS", 20, { min: 1, max: 300 }) * 1000,
  DJANGO_API_URL:
    String(process.env.DJANGO_API_URL || "http://127.0.0.1:8000").trim() ||
    "http://127.0.0.1:8000",
  DJANGO_ADMIN_TOKEN: String(process.env.DJANGO_ADMIN_TOKEN || "").trim(),
};

module.exports = {
  env,
  envNumber,
  normalizeAiProvider,
  parseModelCandidates,
  parseProviderOrder,
};
