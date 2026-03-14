const searchForm = document.getElementById("searchForm");
const searchQuery = document.getElementById("searchQuery");
const statusMessage = document.getElementById("statusMessage");
const quickTags = document.querySelectorAll(".quick-tags .tag");

const weatherIcon = document.getElementById("weatherIcon");
const weatherTemp = document.getElementById("weatherTemp");
const weatherSummary = document.getElementById("weatherSummary");
const weatherLocation = document.getElementById("weatherLocation");
const weatherForecast = document.getElementById("weatherForecast");
const weatherPanel = document.querySelector(".weather-panel");
const rightPanel = document.querySelector(".right-panel");
const magnetoTitle = document.querySelector(".hero h1");

const assistantThread = document.getElementById("assistantThread");
const assistantForm = document.getElementById("assistantForm");
const assistantInput = document.getElementById("assistantInput");
const assistantSuggestions = document.getElementById("assistantSuggestions");

const resultsQuery = document.getElementById("resultsQuery");
const resultsMeta = document.getElementById("resultsMeta");
const resultsList = document.getElementById("resultsList");

const adminAuthPanel = document.getElementById("adminAuthPanel");
const adminDashboard = document.getElementById("adminDashboard");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminAuthStatus = document.getElementById("adminAuthStatus");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminRange = document.getElementById("adminRange");
const adminRefreshBtn = document.getElementById("adminRefreshBtn");
const adminExportBtn = document.getElementById("adminExportBtn");

const kpiTotalSearches = document.getElementById("kpiTotalSearches");
const kpiTotalViews = document.getElementById("kpiTotalViews");
const kpiUniqueQueries = document.getElementById("kpiUniqueQueries");
const kpiSearchesDelta = document.getElementById("kpiSearchesDelta");
const kpiViewsDelta = document.getElementById("kpiViewsDelta");
const kpiUniqueDelta = document.getElementById("kpiUniqueDelta");
const topQueriesList = document.getElementById("topQueriesList");
const trafficList = document.getElementById("trafficList");
const latestSearchesList = document.getElementById("latestSearchesList");
const topQueriesChart = document.getElementById("topQueriesChart");
const trafficChart = document.getElementById("trafficChart");
const dailyTrendChart = document.getElementById("dailyTrendChart");
const weeklyTrendChart = document.getElementById("weeklyTrendChart");
const adminBackupList = document.getElementById("adminBackupList");
const adminBackupRefreshBtn = document.getElementById("adminBackupRefreshBtn");
const adminBackupCreateBtn = document.getElementById("adminBackupCreateBtn");
const adminBackupReason = document.getElementById("adminBackupReason");
const adminAssistantStatusGrid = document.getElementById(
  "adminAssistantStatusGrid",
);
const adminAssistantStatusUpdatedAt = document.getElementById(
  "adminAssistantStatusUpdatedAt",
);
const adminAssistantStatusRefreshBtn = document.getElementById(
  "adminAssistantStatusRefreshBtn",
);
const adminRuntimeMetricsGrid = document.getElementById(
  "adminRuntimeMetricsGrid",
);
const adminRuntimeMetricsUpdatedAt = document.getElementById(
  "adminRuntimeMetricsUpdatedAt",
);
const adminRuntimeMetricsRefreshBtn = document.getElementById(
  "adminRuntimeMetricsRefreshBtn",
);
const adminRuntimeAutoRefreshState = document.getElementById(
  "adminRuntimeAutoRefreshState",
);
const adminRoutingStatusGrid = document.getElementById(
  "adminRoutingStatusGrid",
);
const adminRoutingUpdatedAt = document.getElementById("adminRoutingUpdatedAt");
const adminRoutingRefreshBtn = document.getElementById(
  "adminRoutingRefreshBtn",
);
const adminRoutingVerifyBtn = document.getElementById("adminRoutingVerifyBtn");
const adminRoutingVerifyResult = document.getElementById(
  "adminRoutingVerifyResult",
);
const adminRoutingBtns = document.querySelectorAll(".admin-routing-btn");

const ADMIN_TOKEN_KEY = "magneto.admin.token";
const API_BASE_URL = String(window.MAGNETO_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
let currentAdminRange = "all";
let currentBackupReason = "all";
const RUNTIME_AUTO_REFRESH_MS = 30000;
let runtimeMetricsIntervalId = null;
let runtimeMetricsCountdownIntervalId = null;
let runtimeNextRefreshAtMs = 0;
let isRuntimeRefreshInFlight = false;
const FLAG_ROTATION_DEFAULT_MS = 60000;
const FLAG_ROTATION_MIN_MS = 5000;
const FLAG_ROTATION_MAX_MS = 600000;
const FLAG_ROTATION_INDEX_KEY = "MAGNETO_FLAG_INDEX";
let flagRotationTimerId = null;
let currentFlagRotationIndex = 0;

function getFlagRotationIntervalMs() {
  return FLAG_ROTATION_DEFAULT_MS;
}

function clearMagnetoFlagTimers() {
  if (flagRotationTimerId != null) {
    window.clearInterval(flagRotationTimerId);
    flagRotationTimerId = null;
  }
}

function normalizeFlagEntries(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalized = items
    .map((item) => {
      const name = String(item?.name?.common || "").trim();
      const flagUrl = String(item?.flags?.svg || item?.flags?.png || "").trim();
      const code = String(item?.cca2 || "").trim();

      if (!name || !flagUrl || !code) {
        return null;
      }

      return { name, flagUrl, code };
    })
    .filter(Boolean);

  // Shuffle once so rotation is not visually stuck in alphabetic clusters (A, B, C...).
  for (let i = normalized.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [normalized[i], normalized[j]] = [normalized[j], normalized[i]];
  }

  return normalized;
}

function applyMagnetoFlagFill(flagEntry) {
  if (!magnetoTitle || !flagEntry || !flagEntry.flagUrl) {
    return;
  }

  magnetoTitle.style.setProperty(
    "--magneto-fill",
    `url("${flagEntry.flagUrl}") center / cover no-repeat`,
  );
  magnetoTitle.setAttribute(
    "aria-label",
    `Magneto title filled with ${flagEntry.name} flag`,
  );
  magnetoTitle.title = `${flagEntry.name} flag`;
}

function renderFlagByIndex(flags, index) {
  if (!magnetoTitle || !Array.isArray(flags) || flags.length === 0) {
    return;
  }

  const safeIndex = ((index % flags.length) + flags.length) % flags.length;
  applyMagnetoFlagFill(flags[safeIndex]);

  try {
    localStorage.setItem(FLAG_ROTATION_INDEX_KEY, String(safeIndex));
  } catch (_error) {
    // Non-blocking if storage is unavailable.
  }
}

async function initMagnetoFlagRotation() {
  if (!magnetoTitle) {
    return;
  }

  const rotationIntervalMs = getFlagRotationIntervalMs();

  try {
    const response = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,flags,cca2",
    );

    if (!response.ok) {
      throw new Error("Could not load country flags.");
    }

    const payload = await response.json();
    const flags = normalizeFlagEntries(payload);

    if (flags.length === 0) {
      return;
    }

    clearMagnetoFlagTimers();
    let savedIndex = 0;
    try {
      savedIndex = Number(localStorage.getItem(FLAG_ROTATION_INDEX_KEY));
    } catch (_error) {
      savedIndex = 0;
    }
    currentFlagRotationIndex = Number.isFinite(savedIndex) ? savedIndex : 0;
    renderFlagByIndex(flags, currentFlagRotationIndex);

    flagRotationTimerId = window.setInterval(() => {
      currentFlagRotationIndex += 1;
      renderFlagByIndex(flags, currentFlagRotationIndex);
    }, rotationIntervalMs);
  } catch (_error) {
    // Keep default gradient fill if flags cannot be loaded.
  }
}

function setRuntimeAutoRefreshState(isOn, secondsRemaining = null) {
  if (!adminRuntimeAutoRefreshState) {
    return;
  }

  const enabled = Boolean(isOn);
  if (!enabled) {
    adminRuntimeAutoRefreshState.textContent = "Auto-refresh OFF";
  } else {
    const secondsText = Number.isFinite(Number(secondsRemaining))
      ? ` - next in ${Math.max(0, Math.ceil(Number(secondsRemaining)))}s`
      : "";
    adminRuntimeAutoRefreshState.textContent = `Auto-refresh ON${secondsText}`;
  }

  adminRuntimeAutoRefreshState.classList.toggle(
    "admin-auto-refresh-on",
    enabled,
  );
  adminRuntimeAutoRefreshState.classList.toggle(
    "admin-auto-refresh-off",
    !enabled,
  );
}

function updateRuntimeAutoRefreshCountdown() {
  if (runtimeMetricsIntervalId == null || runtimeNextRefreshAtMs <= 0) {
    setRuntimeAutoRefreshState(false);
    return;
  }

  const secondsRemaining = (runtimeNextRefreshAtMs - Date.now()) / 1000;
  setRuntimeAutoRefreshState(true, secondsRemaining);
}

function buildApiUrl(path) {
  const target = String(path || "").trim();
  if (!target.startsWith("/api/")) {
    return target;
  }

  return API_BASE_URL ? `${API_BASE_URL}${target}` : target;
}

function apiFetch(path, options) {
  return fetch(buildApiUrl(path), options);
}

function syncSidePanelHeights() {
  if (!rightPanel) {
    return;
  }

  // Keep panel sizing controlled by CSS fixed-height rules.
  rightPanel.style.minHeight = "";
  rightPanel.style.height = "";
}

function updateStatus(message, isError = false) {
  if (!statusMessage) {
    return;
  }

  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function initHomeKeyboardShortcuts() {
  if (!searchQuery) {
    return;
  }

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTypingTarget =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    if (
      event.key === "/" &&
      !isTypingTarget &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault();
      searchQuery.focus();
      searchQuery.select();
      updateStatus("Search focused. Type your query and press Enter.");
      return;
    }

    if (
      event.key.toLowerCase() === "k" &&
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey
    ) {
      event.preventDefault();
      searchQuery.focus();
      searchQuery.select();
      updateStatus("Quick search ready.");
      return;
    }

    if (event.key === "Escape" && document.activeElement === searchQuery) {
      searchQuery.value = "";
      updateStatus("Search cleared.");
    }
  });
}

function addAssistantMessage(role, text) {
  if (!assistantThread) {
    return;
  }

  const message = document.createElement("p");
  message.className = `assistant-bubble ${role}`;
  message.textContent = text;
  assistantThread.appendChild(message);
  assistantThread.scrollTop = assistantThread.scrollHeight;
}

function buildAssistantContent(rawQuery) {
  const query = String(rawQuery || "").trim();

  if (!query) {
    return {
      message:
        "Ask me anything. I can help with weather, writing, ideas, planning, and more.",
      suggestions: [
        "What can you help me with?",
        "Summarize this text",
        "Plan my day",
      ],
    };
  }

  const normalized = query.toLowerCase();

  if (/weather|rain|sun|forecast/.test(normalized)) {
    return {
      message:
        "I can check live weather details. Include city and timeframe for best accuracy.",
      suggestions: [
        "weather now in Bucharest",
        "weather tomorrow in my city",
        "weekend forecast in Cluj",
      ],
    };
  }

  if (/news|politics|economy/.test(normalized)) {
    return {
      message: "Try narrowing by source and timeframe.",
      suggestions: [
        `${query} last 24 hours`,
        `${query} trusted sources`,
        `${query} analysis`,
      ],
    };
  }

  if (/sport|football|tennis|basketball/.test(normalized)) {
    return {
      message: "For sports, scores and schedule filters are useful.",
      suggestions: [
        `${query} live scores`,
        `${query} schedule`,
        `${query} standings`,
      ],
    };
  }

  if (/job|career|cv|hiring/.test(normalized)) {
    return {
      message: "Use location and seniority for a cleaner job search.",
      suggestions: [
        `${query} remote`,
        `${query} entry level`,
        `${query} salary`,
      ],
    };
  }

  return {
    message: "I can help with that. Here are some useful next prompts.",
    suggestions: [
      `Explain ${query} simply`,
      `Give me practical steps for ${query}`,
      `What are the pros and cons of ${query}?`,
    ],
  };
}

function updateAssistant(query) {
  if (!assistantSuggestions) {
    return;
  }

  assistantSuggestions.innerHTML = "";
  const content = buildAssistantContent(query);

  content.suggestions.forEach((suggestion) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "assistant-chip";
    button.textContent = suggestion;

    button.addEventListener("click", () => {
      if (!assistantInput) {
        return;
      }

      assistantInput.value = suggestion;
      assistantInput.focus();
      updateStatus(`Assistant suggestion selected: ${suggestion}`);
    });

    assistantSuggestions.appendChild(button);
  });
}

function buildLocalAssistantFallback(query) {
  const content = buildAssistantContent(query);
  return {
    reply: content.message,
    suggestions: content.suggestions,
  };
}

async function requestAssistantResponse(userText) {
  const history = assistantThread
    ? Array.from(assistantThread.querySelectorAll(".assistant-bubble"))
        .slice(-6)
        .map((el) => ({
          role: el.classList.contains("user") ? "user" : "assistant",
          content: String(el.textContent || "").trim(),
        }))
    : [];

  try {
    const response = await apiFetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText, history }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Assistant request failed.");
    }

    const reply = String(payload.reply || "").trim();
    const suggestions = Array.isArray(payload.suggestions)
      ? payload.suggestions
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [];

    if (!reply) {
      throw new Error("Assistant returned empty response.");
    }

    return {
      reply,
      suggestions: suggestions.slice(0, 3),
      provider: String(payload.provider || "unknown"),
    };
  } catch (error) {
    const fallback = buildLocalAssistantFallback(userText);
    const reason = String(error?.message || "Assistant unavailable.");
    const isFileProtocol = window.location.protocol === "file:";
    const help = isFileProtocol
      ? "Open MAGNETO through http://localhost:3000 (not file://) so API routes are available."
      : reason;

    return {
      reply: fallback.reply,
      suggestions: fallback.suggestions,
      provider: "local-fallback",
      reason: help,
    };
  }
}

function initAssistantChat() {
  if (!assistantThread || !assistantForm || !assistantInput) {
    return;
  }

  assistantForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userText = assistantInput.value.trim();
    if (!userText) {
      return;
    }

    addAssistantMessage("user", userText);
    addAssistantMessage("bot", "Thinking...");

    const result = await requestAssistantResponse(userText);
    if (assistantThread && assistantThread.lastElementChild) {
      assistantThread.lastElementChild.textContent = result.reply;
    }

    updateStatus(
      result.provider === "local-fallback"
        ? `Assistant fallback active. ${result.reason || ""}`.trim()
        : "Assistant response ready.",
    );

    assistantInput.value = "";
    requestAnimationFrame(syncSidePanelHeights);
  });

  requestAnimationFrame(syncSidePanelHeights);
}

function initHomeForm() {
  if (!searchForm || !searchQuery) {
    return;
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = searchQuery.value.trim();

    if (!query) {
      updateStatus("Please type a search query.", true);
      return;
    }

    updateStatus("Searching with MAGNETO Core...");
    window.location.href = `results.html?q=${encodeURIComponent(query)}`;
  });

  quickTags.forEach((tagButton) => {
    tagButton.addEventListener("click", () => {
      const query = tagButton.dataset.query;
      if (!query) {
        return;
      }

      searchQuery.value = query;
      searchQuery.focus();
      updateStatus(`Suggestion applied: ${query}`);
    });
  });

  initAssistantChat();
  initHomeKeyboardShortcuts();
}

function getWeatherView(weatherCode) {
  if (weatherCode === 0) {
    return { icon: "☀️", summary: "Sunny" };
  }

  if (weatherCode === 1) {
    return { icon: "🌤️", summary: "Mostly sunny" };
  }

  if (weatherCode === 2) {
    return { icon: "⛅", summary: "Partly cloudy" };
  }

  if (weatherCode === 3) {
    return { icon: "☁️", summary: "Cloudy" };
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return { icon: "🌫️", summary: "Fog" };
  }

  if (
    weatherCode === 51 ||
    weatherCode === 53 ||
    weatherCode === 55 ||
    weatherCode === 56 ||
    weatherCode === 57 ||
    weatherCode === 61 ||
    weatherCode === 63 ||
    weatherCode === 65 ||
    weatherCode === 66 ||
    weatherCode === 67 ||
    weatherCode === 80 ||
    weatherCode === 81 ||
    weatherCode === 82 ||
    weatherCode === 95 ||
    weatherCode === 96 ||
    weatherCode === 99
  ) {
    return { icon: "🌦️", summary: "Rain" };
  }

  return { icon: "🌥️", summary: "Variable conditions" };
}

async function fetchWeatherByCoords(latitude, longitude) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    "&current=temperature_2m,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&forecast_days=7&timezone=auto";

  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error("Could not get weather data.");
  }

  const data = await response.json();
  const current = data.current;
  const daily = data.daily;

  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("Incomplete weather data.");
  }

  const hasDaily =
    daily &&
    Array.isArray(daily.time) &&
    Array.isArray(daily.weather_code) &&
    Array.isArray(daily.temperature_2m_max) &&
    Array.isArray(daily.temperature_2m_min);

  const forecast = hasDaily
    ? daily.time.slice(0, 7).map((dateIso, index) => ({
        dateIso,
        weatherCode: Number(daily.weather_code[index]),
        tempMax: Number(daily.temperature_2m_max[index]),
        tempMin: Number(daily.temperature_2m_min[index]),
      }))
    : [];

  return {
    temperature: current.temperature_2m,
    weatherCode: current.weather_code,
    forecast,
  };
}

async function fetchLocationName(latitude, longitude) {
  const reverseUrl =
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    "&localityLanguage=en";

  const response = await fetch(reverseUrl);
  if (!response.ok) {
    throw new Error("Could not resolve location name.");
  }

  const data = await response.json();
  const city =
    data.city || data.locality || data.principalSubdivision || data.countryName;
  const country = data.countryName;

  if (!city && !country) {
    throw new Error("Location name unavailable.");
  }

  if (city && country && city.toLowerCase() !== country.toLowerCase()) {
    return `${city}, ${country}`;
  }

  return city || country;
}

function formatForecastDay(dateIso, index) {
  const date = new Date(`${dateIso}T12:00:00`);
  if (index === 0) {
    return "Today";
  }

  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function renderWeatherForecast(forecast) {
  if (!weatherForecast) {
    return;
  }

  weatherForecast.innerHTML = "";

  if (!Array.isArray(forecast) || forecast.length === 0) {
    const message = document.createElement("p");
    message.className = "weather-forecast-empty";
    message.textContent = "7-day forecast unavailable.";
    weatherForecast.appendChild(message);
    return;
  }

  forecast.forEach((day, index) => {
    const item = document.createElement("article");
    item.className = "weather-day";

    const label = document.createElement("p");
    label.className = "weather-day-label";
    label.textContent = formatForecastDay(day.dateIso, index);

    const icon = document.createElement("span");
    icon.className = "weather-day-icon";
    icon.innerHTML = getWeatherView(day.weatherCode).icon;

    const temp = document.createElement("p");
    temp.className = "weather-day-temp";
    temp.textContent = `${Math.round(day.tempMax)}\u00B0C`;

    item.append(label, icon, temp);
    weatherForecast.appendChild(item);
  });
}

function setWeatherUI({ temperature, weatherCode, locationText, forecast }) {
  if (!weatherTemp || !weatherSummary || !weatherLocation || !weatherIcon) {
    return;
  }

  const view = getWeatherView(Number(weatherCode));
  weatherTemp.textContent = `${Math.round(temperature)}\u00B0C`;
  weatherSummary.textContent = view.summary;
  weatherLocation.textContent = locationText;
  weatherIcon.innerHTML = view.icon;
  renderWeatherForecast(forecast || []);
}

const WEATHER_IP_CACHE_KEY = "magneto.weather.ipLocation";
const WEATHER_IP_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const WEATHER_PRECISE_CACHE_KEY = "magneto.weather.preciseLocation";
const WEATHER_PRECISE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const WEATHER_PRECISE_PROMPT_KEY = "magneto.weather.precisePromptAt";
const WEATHER_PRECISE_PROMPT_COOLDOWN_MS = 12 * 60 * 60 * 1000;

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function readCachedIpLocation() {
  try {
    const raw = localStorage.getItem(WEATHER_IP_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const age = Date.now() - Number(parsed.savedAt || 0);
    if (age > WEATHER_IP_CACHE_TTL_MS) {
      localStorage.removeItem(WEATHER_IP_CACHE_KEY);
      return null;
    }

    if (
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number"
    ) {
      return null;
    }

    // Discard stale cross-country cache when timezone clearly indicates Germany.
    const tz = getBrowserTimeZone();
    const cachedCountry = String(parsed.country || "").toLowerCase();
    if (
      tz === "Europe/Berlin" &&
      cachedCountry &&
      cachedCountry !== "germany"
    ) {
      localStorage.removeItem(WEATHER_IP_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveCachedIpLocation(location) {
  try {
    localStorage.setItem(
      WEATHER_IP_CACHE_KEY,
      JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city || "",
        country: location.country || "",
        savedAt: Date.now(),
      }),
    );
  } catch {
    // Ignore cache write failures
  }
}

function readCachedPreciseLocation() {
  try {
    const raw = localStorage.getItem(WEATHER_PRECISE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const age = Date.now() - Number(parsed.savedAt || 0);
    if (age > WEATHER_PRECISE_CACHE_TTL_MS) {
      localStorage.removeItem(WEATHER_PRECISE_CACHE_KEY);
      return null;
    }

    if (
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveCachedPreciseLocation(location) {
  try {
    localStorage.setItem(
      WEATHER_PRECISE_CACHE_KEY,
      JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city || "",
        country: location.country || "",
        savedAt: Date.now(),
      }),
    );
  } catch {
    // Ignore cache write failures.
  }
}

function canAttemptPrecisePrompt() {
  try {
    const lastPromptAt = Number(
      localStorage.getItem(WEATHER_PRECISE_PROMPT_KEY) || 0,
    );
    return Date.now() - lastPromptAt > WEATHER_PRECISE_PROMPT_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markPrecisePromptAttempt() {
  try {
    localStorage.setItem(WEATHER_PRECISE_PROMPT_KEY, String(Date.now()));
  } catch {
    // Ignore write failures.
  }
}

async function fetchLocationByIp() {
  const cached = readCachedIpLocation();
  if (cached) {
    return cached;
  }

  const providers = [
    {
      url: "https://ipwho.is/",
      parse: (data) => ({
        latitude: Number(data?.latitude),
        longitude: Number(data?.longitude),
        city: String(data?.city || ""),
        country: String(data?.country || ""),
      }),
      isValid: (data) => data && data.success !== false,
    },
    {
      url: "https://ipapi.co/json/",
      parse: (data) => ({
        latitude: Number(data?.latitude),
        longitude: Number(data?.longitude),
        city: String(data?.city || ""),
        country: String(data?.country_name || ""),
      }),
      isValid: (data) => data && !data.error,
    },
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url);
      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      if (!provider.isValid(data)) {
        continue;
      }

      const location = provider.parse(data);
      if (
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude)
      ) {
        continue;
      }

      saveCachedIpLocation(location);
      return location;
    } catch {
      // Try next provider
    }
  }

  throw new Error("IP location detection unavailable.");
}

async function fetchLocationFromBackend() {
  const response = await apiFetch("/api/location/auto");
  if (!response.ok) {
    throw new Error("Backend location unavailable.");
  }

  const data = await response.json();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Invalid backend location coordinates.");
  }

  return {
    latitude,
    longitude,
    city: String(data.city || ""),
    country: String(data.country || ""),
    source: String(data.source || "backend"),
  };
}

const TIMEZONE_LOCATION_FALLBACKS = {
  "Europe/Berlin": {
    latitude: 52.52,
    longitude: 13.405,
    city: "Berlin",
    country: "Germany",
  },
  "Europe/Bucharest": {
    latitude: 44.4268,
    longitude: 26.1025,
    city: "Bucharest",
    country: "Romania",
  },
};

function getTimezoneFallbackLocation() {
  return TIMEZONE_LOCATION_FALLBACKS[getBrowserTimeZone()] || null;
}

function getBrowserLocationWithoutPrompt() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
          city: "",
          country: "",
        });
      },
      () => reject(new Error("Geolocation unavailable.")),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 15 * 60 * 1000,
      },
    );
  });
}

async function fetchBestAutomaticLocation() {
  // 1) Reuse last known precise location first.
  const preciseCache = readCachedPreciseLocation();
  if (preciseCache) {
    return { ...preciseCache, source: "precise-cache" };
  }

  // 2) Exact location using browser geolocation.
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const permission = await navigator.permissions.query({
        name: "geolocation",
      });

      if (permission.state === "granted") {
        const precise = await getBrowserLocationWithoutPrompt();
        saveCachedPreciseLocation(precise);
        return { ...precise, source: "browser-granted" };
      }

      if (permission.state === "prompt" && canAttemptPrecisePrompt()) {
        markPrecisePromptAttempt();
        const precise = await getBrowserLocationWithoutPrompt();
        saveCachedPreciseLocation(precise);
        return { ...precise, source: "browser-prompted" };
      }
    }
  } catch {
    // Continue with non-precise providers.
  }

  // 3) Server-side IP lookup.
  try {
    return await fetchLocationFromBackend();
  } catch {
    // Continue with browser-side providers.
  }

  // 4) Browser-side IP providers.
  try {
    return await fetchLocationByIp();
  } catch {
    // Continue to timezone fallback.
  }

  // 5) Timezone fallback.
  const timezoneFallback = getTimezoneFallbackLocation();
  if (timezoneFallback) {
    return {
      ...timezoneFallback,
      source: "timezone-fallback",
    };
  }

  // Final deterministic fallback to avoid empty weather widget.
  return {
    latitude: 52.52,
    longitude: 13.405,
    city: "Berlin",
    country: "Germany",
    source: "default-fallback",
  };
}

function initWeatherWidget() {
  if (!weatherTemp || !weatherSummary || !weatherLocation || !weatherIcon) {
    return;
  }

  weatherSummary.textContent = "Detecting location automatically...";
  weatherLocation.textContent = "Using best available location without popup.";

  (async () => {
    try {
      const ipLocation = await fetchBestAutomaticLocation();
      const latitude = ipLocation.latitude;
      const longitude = ipLocation.longitude;

      const [weather, locationName] = await Promise.all([
        fetchWeatherByCoords(latitude, longitude),
        fetchLocationName(latitude, longitude).catch(() => ""),
      ]);

      const fallbackLabel = [ipLocation.city, ipLocation.country]
        .filter(Boolean)
        .join(", ");
      const locationText =
        locationName ||
        fallbackLabel ||
        `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`;

      setWeatherUI({ ...weather, locationText });
    } catch {
      weatherSummary.textContent = "Weather unavailable";
      weatherLocation.textContent = "Could not detect location automatically.";
      renderWeatherForecast([]);
    }
  })();
}

async function trackPageView(pageName) {
  try {
    await apiFetch("/api/events/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: pageName }),
    });
  } catch {
    // No-op for tracking failures
  }
}

async function initResultsPage() {
  if (!resultsQuery || !resultsMeta || !resultsList) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const query = String(params.get("q") || "").trim();

  if (!query) {
    resultsQuery.textContent = "No active search";
    resultsMeta.textContent = "Go back to homepage and enter a query.";
    return;
  }

  resultsQuery.textContent = `Results for: ${query}`;
  resultsMeta.textContent = "Loading data from MAGNETO Core...";

  try {
    const response = await apiFetch(
      `/api/search?q=${encodeURIComponent(query)}`,
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Search request failed.");
    }

    resultsMeta.textContent = `${payload.total} results from ${payload.engine}`;
    resultsList.innerHTML = "";

    for (const item of payload.results) {
      const li = document.createElement("li");
      li.className = "result-card";

      const anchor = document.createElement("a");
      anchor.className = "result-link";
      anchor.href = item.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = item.title;

      const description = document.createElement("p");
      description.className = "result-description";
      description.textContent = item.summary;

      const category = document.createElement("p");
      category.className = "result-description";
      category.textContent = `Category: ${item.category}`;

      li.append(anchor, description, category);
      resultsList.appendChild(li);
    }
  } catch (error) {
    resultsMeta.textContent = error.message || "Could not load results.";
  }
}

function setAdminStatus(message, isError = false) {
  if (!adminAuthStatus) {
    return;
  }

  adminAuthStatus.textContent = message;
  adminAuthStatus.classList.toggle("error", isError);
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
  if (!token) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }

  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

async function fetchAdminOverview(range = "all") {
  const token = getAdminToken();
  const params = new URLSearchParams({ range });

  const response = await apiFetch(`/api/admin/overview?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not load admin data.");
  }

  return payload;
}

async function fetchAdminBackups(reason = "all") {
  const token = getAdminToken();
  const params = new URLSearchParams({ reason });
  const response = await apiFetch(`/api/admin/backups?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load backup list.");
  }

  return payload.backups || [];
}

async function fetchAdminAssistantStatus() {
  const token = getAdminToken();
  const response = await apiFetch("/api/admin/assistant-status", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load assistant status.");
  }

  return payload;
}

async function fetchAdminRuntimeMetrics() {
  const token = getAdminToken();
  const response = await apiFetch("/api/admin/runtime-metrics", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load runtime metrics.");
  }

  return payload;
}

async function downloadBackupFile(fileName) {
  const token = getAdminToken();
  const params = new URLSearchParams({ fileName });
  const response = await apiFetch(
    `/api/admin/backups/download?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Could not download backup.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function createBackupNow() {
  const token = getAdminToken();
  const response = await apiFetch("/api/admin/backups/create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not create backup.");
  }

  return payload.backups || [];
}

async function fetchAdminRouting() {
  const token = getAdminToken();
  const response = await apiFetch("/api/admin/routing", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load routing state.");
  }
  return payload;
}

async function postAdminRouting(update) {
  const token = getAdminToken();
  const response = await apiFetch("/api/admin/routing", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(update),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not update routing.");
  }
  return payload;
}

async function fetchAdminRoutingVerify() {
  const token = getAdminToken();
  const response = await apiFetch("/api/admin/routing/verify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Routing verify failed.");
  }
  return payload;
}

function renderRoutingState(routing) {
  if (!adminRoutingStatusGrid) {
    return;
  }
  adminRoutingStatusGrid.innerHTML = "";

  const backendLabel =
    routing.activeBackend === "django" ? "Django" : "Node.js";
  const canaryLabel =
    routing.canaryPercent != null ? `${routing.canaryPercent}%` : "—";

  const items = [
    ["Active Backend", backendLabel],
    ["Canary %", canaryLabel],
    ["Django URL", routing.djangoUrl || "—"],
    ["Note", routing.note || "—"],
    [
      "Last Changed",
      routing.updatedAt ? new Date(routing.updatedAt).toLocaleString() : "—",
    ],
  ];

  items.forEach(([label, value]) => {
    adminRoutingStatusGrid.appendChild(
      createAssistantStatusItem(label, String(value)),
    );
  });

  if (adminRoutingUpdatedAt) {
    adminRoutingUpdatedAt.textContent = routing.updatedAt
      ? `State as of: ${new Date(routing.updatedAt).toLocaleString()}`
      : "";
  }
}

function renderRoutingVerify(result) {
  if (!adminRoutingVerifyResult) {
    return;
  }
  adminRoutingVerifyResult.hidden = false;
  adminRoutingVerifyResult.innerHTML = "";

  const header = document.createElement("p");
  header.className = result.ok
    ? "admin-routing-verify-ok"
    : "admin-routing-verify-fail";
  header.textContent = result.ok
    ? "Dry-test PASSED – both backends reachable."
    : "Dry-test PARTIAL – one or more backends unreachable.";
  adminRoutingVerifyResult.appendChild(header);

  const list = document.createElement("ul");
  list.className = "admin-list";
  (result.checks || []).forEach((check) => {
    const li = document.createElement("li");
    const status = check.ok ? "OK" : "FAIL";
    const latency = check.latencyMs != null ? ` ${check.latencyMs}ms` : "";
    const errPart = check.error ? ` — ${check.error}` : "";
    li.textContent = `[${status}] ${check.backend.toUpperCase()} ${check.url}${latency}${errPart}`;
    li.className = check.ok
      ? "admin-routing-check-ok"
      : "admin-routing-check-fail";
    list.appendChild(li);
  });
  adminRoutingVerifyResult.appendChild(list);
}

async function refreshRoutingStatus(okMessage = "") {
  if (!adminRoutingStatusGrid) {
    return;
  }
  try {
    const payload = await fetchAdminRouting();
    renderRoutingState(payload.routing || {});
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    if (adminRoutingStatusGrid) {
      const errEl = document.createElement("p");
      errEl.className = "admin-chart-empty";
      errEl.textContent = error.message || "Could not load routing state.";
      adminRoutingStatusGrid.innerHTML = "";
      adminRoutingStatusGrid.appendChild(errEl);
    }
    if (okMessage) {
      setAdminStatus(error.message || "Could not load routing state.", true);
    }
  }
}

async function restoreBackup(fileName) {
  const token = getAdminToken();
  const response = await apiFetch("/api/admin/backups/restore", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileName }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not restore backup.");
  }

  return payload;
}

function formatDeltaText(value) {
  if (value == null) {
    return "No previous period data";
  }

  if (value === 0) {
    return "No change vs previous period";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value}% vs previous period`;
}

function applyDeltaState(element, value) {
  if (!element) {
    return;
  }

  element.textContent = formatDeltaText(value);
  element.classList.remove("delta-positive", "delta-negative", "delta-neutral");

  if (value == null || value === 0) {
    element.classList.add("delta-neutral");
    return;
  }

  element.classList.add(value > 0 ? "delta-positive" : "delta-negative");
}

function renderBarChart(
  container,
  items,
  { labelKey, valueKey, valueSuffix = "" },
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-chart-empty";
    empty.textContent = "No chart data yet.";
    container.appendChild(empty);
    return;
  }

  const maxValue = Math.max(
    ...items.map((item) => Number(item[valueKey]) || 0),
    1,
  );

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "admin-chart-row";

    const label = document.createElement("span");
    label.className = "admin-chart-label";
    label.textContent = String(item[labelKey] || "");

    const track = document.createElement("div");
    track.className = "admin-chart-track";

    const fill = document.createElement("div");
    fill.className = "admin-chart-fill";
    const value = Number(item[valueKey]) || 0;
    const widthPercent = (value / maxValue) * 100;
    fill.style.width = `${Math.max(4, widthPercent)}%`;

    const valueLabel = document.createElement("span");
    valueLabel.className = "admin-chart-value";
    valueLabel.textContent = `${value}${valueSuffix}`;

    track.append(fill, valueLabel);
    row.append(label, track);
    container.appendChild(row);
  });
}

function renderTrendChart(container, points) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(points) || points.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-chart-empty";
    empty.textContent = "No trend data yet.";
    container.appendChild(empty);
    return;
  }

  const maxValue = Math.max(
    ...points.map((point) =>
      Math.max(
        Number(point.searchCount) || 0,
        Number(point.pageViewCount) || 0,
      ),
    ),
    1,
  );

  points.forEach((point) => {
    const row = document.createElement("div");
    row.className = "admin-trend-row";

    const label = document.createElement("span");
    label.className = "admin-trend-label";
    label.textContent = String(point.label || "-");

    const barsWrap = document.createElement("div");
    barsWrap.className = "admin-trend-bars";

    const searchTrack = document.createElement("div");
    searchTrack.className = "admin-trend-track";
    const searchFill = document.createElement("div");
    searchFill.className = "admin-trend-fill admin-trend-fill-search";
    const searchValue = Number(point.searchCount) || 0;
    searchFill.style.width = `${Math.max(2, (searchValue / maxValue) * 100)}%`;
    const searchLabel = document.createElement("span");
    searchLabel.className = "admin-trend-value";
    searchLabel.textContent = String(searchValue);
    searchTrack.append(searchFill, searchLabel);

    const viewTrack = document.createElement("div");
    viewTrack.className = "admin-trend-track";
    const viewFill = document.createElement("div");
    viewFill.className = "admin-trend-fill admin-trend-fill-views";
    const viewValue = Number(point.pageViewCount) || 0;
    viewFill.style.width = `${Math.max(2, (viewValue / maxValue) * 100)}%`;
    const viewLabel = document.createElement("span");
    viewLabel.className = "admin-trend-value";
    viewLabel.textContent = String(viewValue);
    viewTrack.append(viewFill, viewLabel);

    barsWrap.append(searchTrack, viewTrack);
    row.append(label, barsWrap);
    container.appendChild(row);
  });
}

function renderListItems(element, items, formatter) {
  if (!element) {
    return;
  }

  element.innerHTML = "";

  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No data yet.";
    element.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = formatter(item);
    element.appendChild(li);
  });
}

function renderAdminDashboard(data) {
  if (!data) {
    return;
  }

  if (kpiTotalSearches) {
    kpiTotalSearches.textContent = String(data.totals?.totalSearches || 0);
  }

  if (kpiTotalViews) {
    kpiTotalViews.textContent = String(data.totals?.totalPageViews || 0);
  }

  if (kpiUniqueQueries) {
    kpiUniqueQueries.textContent = String(data.totals?.uniqueQueries || 0);
  }

  applyDeltaState(
    kpiSearchesDelta,
    data.comparison?.deltaPercent?.totalSearches,
  );
  applyDeltaState(kpiViewsDelta, data.comparison?.deltaPercent?.totalPageViews);
  applyDeltaState(kpiUniqueDelta, data.comparison?.deltaPercent?.uniqueQueries);

  renderListItems(
    topQueriesList,
    data.topQueries || [],
    (item) => `${item.query} - ${item.count} searches (${item.percent}%)`,
  );

  renderListItems(
    trafficList,
    data.trafficByPage || [],
    (item) => `${item.page}: ${item.count} views (${item.percent}%)`,
  );

  renderListItems(
    latestSearchesList,
    data.latestSearches || [],
    (item) =>
      `${new Date(item.at).toLocaleString()} | ${item.query} (${item.resultCount} results)`,
  );

  renderBarChart(topQueriesChart, data.topQueries || [], {
    labelKey: "query",
    valueKey: "percent",
    valueSuffix: "%",
  });

  renderBarChart(trafficChart, data.trafficByPage || [], {
    labelKey: "page",
    valueKey: "percent",
    valueSuffix: "%",
  });

  renderTrendChart(dailyTrendChart, data.trends?.daily || []);
  renderTrendChart(weeklyTrendChart, data.trends?.weekly || []);
}

function renderBackupList(items) {
  if (!adminBackupList) {
    return;
  }

  adminBackupList.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No backups available yet.";
    adminBackupList.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "admin-backup-item";

    const meta = document.createElement("div");
    meta.className = "admin-backup-meta";
    const created = new Date(item.createdAt).toLocaleString();
    const sizeKb = Math.max(
      1,
      Math.round((Number(item.sizeBytes) || 0) / 1024),
    );
    meta.textContent = `${item.fileName} | ${created} | ${item.reason} | ${sizeKb} KB`;

    const actions = document.createElement("div");
    actions.className = "admin-backup-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "results-back-link admin-restore-btn";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", async () => {
      downloadBtn.disabled = true;
      try {
        await downloadBackupFile(item.fileName);
        setAdminStatus(`Backup downloaded: ${item.fileName}`);
      } catch (error) {
        setAdminStatus(error.message || "Could not download backup.", true);
      } finally {
        downloadBtn.disabled = false;
      }
    });

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "results-back-link admin-restore-btn";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", async () => {
      const confirmed = window.confirm(
        `Restore analytics from backup '${item.fileName}'? Current analytics will be backed up first.`,
      );
      if (!confirmed) {
        return;
      }

      restoreBtn.disabled = true;
      try {
        await restoreBackup(item.fileName);
        setAdminStatus(`Backup restored: ${item.fileName}`);
        const [overview, backups] = await Promise.all([
          fetchAdminOverview(currentAdminRange),
          fetchAdminBackups(),
        ]);
        renderAdminDashboard(overview);
        renderBackupList(backups);
      } catch (error) {
        setAdminStatus(error.message || "Could not restore backup.", true);
      } finally {
        restoreBtn.disabled = false;
      }
    });

    actions.append(downloadBtn, restoreBtn);
    li.append(meta, actions);
    adminBackupList.appendChild(li);
  });
}

function formatAssistantDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function createAssistantStatusItem(label, value) {
  const item = document.createElement("article");
  item.className = "admin-assistant-status-item";

  const key = document.createElement("p");
  key.className = "admin-assistant-status-key";
  key.textContent = label;

  const val = document.createElement("p");
  val.className = "admin-assistant-status-value";
  val.textContent = value;

  item.append(key, val);
  return item;
}

function createRuntimeHealthItem(level, reasons) {
  const normalizedLevel = String(level || "ok").toLowerCase();
  const safeLevel = ["ok", "warning", "critical"].includes(normalizedLevel)
    ? normalizedLevel
    : "ok";

  const reasonText =
    Array.isArray(reasons) && reasons.length
      ? reasons
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .join("; ")
      : "No active alerts";

  const item = document.createElement("article");
  item.className = "admin-assistant-status-item";

  const key = document.createElement("p");
  key.className = "admin-assistant-status-key";
  key.textContent = "Health";

  const val = document.createElement("div");
  val.className = "admin-assistant-status-value";

  const badge = document.createElement("span");
  badge.className = `admin-health-pill admin-health-${safeLevel}`;
  badge.textContent = safeLevel.toUpperCase();

  const reason = document.createElement("p");
  reason.className = "admin-health-reasons";
  reason.textContent = reasonText;

  val.append(badge, reason);
  item.append(key, val);
  return item;
}

function renderAdminAssistantStatus(payload) {
  if (!adminAssistantStatusGrid) {
    return;
  }

  adminAssistantStatusGrid.innerHTML = "";

  const assistant = payload?.assistant || {};
  const limits = assistant.limits || {};
  const cache = assistant.cache || {};
  const memory = assistant.memory || {};
  const metrics = assistant.metrics || {};
  const billing = assistant.billing || {};
  const providers = assistant.providers || {};
  const providerHealth = assistant.providerHealth || {};

  const runtimeMode = assistant.configured
    ? "AI provider configured"
    : "Fallback only (no API key)";

  const errorSummary = metrics.lastProviderError
    ? `${metrics.lastProviderError} (${formatAssistantDate(metrics.lastProviderErrorAt)})`
    : "None";

  const openaiHealth = providerHealth.openai || {};
  const anthropicHealth = providerHealth.anthropic || {};
  const geminiHealth = providerHealth.gemini || {};

  const formatProviderHealth = (entry) => {
    if (!entry || entry.configured === false) {
      return "Not configured";
    }

    if (entry.ok) {
      return `OK (${String(entry.model || "-")})`;
    }

    const reason = String(entry.error || "Unavailable");
    return `FAIL (${reason.slice(0, 120)})`;
  };

  const items = [
    ["Runtime", runtimeMode],
    ["Model", String(assistant.model || "-")],
    [
      "Provider Order",
      `${String(providers.primary || "-")} -> ${String(providers.fallback || "-")}`,
    ],
    ["Requests Total", String(metrics.requestsTotal ?? 0)],
    ["Cache Hits", String(metrics.cacheHits ?? 0)],
    ["OpenAI Responses", String(metrics.openaiResponses ?? 0)],
    ["OpenAI Live", formatProviderHealth(openaiHealth)],
    ["Anthropic Responses", String(metrics.anthropicResponses ?? 0)],
    ["Anthropic Live", formatProviderHealth(anthropicHealth)],
    ["Gemini Responses", String(metrics.geminiResponses ?? 0)],
    ["Gemini Live", formatProviderHealth(geminiHealth)],
    ["Local Hybrid Responses", String(metrics.localHybridResponses ?? 0)],
    ["Fallback Responses", String(metrics.fallbackResponses ?? 0)],
    ["Last Provider Error", errorSummary],
    [
      "Rate Limit",
      `${limits.rateLimitCount ?? "-"} / ${limits.windowSeconds ?? "-"}s`,
    ],
    ["Max Input", `${limits.maxChars ?? "-"} chars`],
    ["Simple Query Threshold", `${limits.simpleQueryWords ?? "-"} words`],
    [
      "Cache",
      `${cache.currentEntries ?? 0}/${cache.maxEntries ?? "-"} entries (${cache.ttlSeconds ?? "-"}s TTL)`,
    ],
    ["Memory", `${memory.totalItems ?? 0}/${memory.maxItems ?? "-"} items`],
    ["Memory File", String(memory.path || "-")],
  ];

  items.forEach(([label, value]) => {
    adminAssistantStatusGrid.appendChild(
      createAssistantStatusItem(label, String(value)),
    );
  });

  const linksCard = document.createElement("article");
  linksCard.className =
    "admin-assistant-status-item admin-assistant-status-links";

  const linksTitle = document.createElement("p");
  linksTitle.className = "admin-assistant-status-key";
  linksTitle.textContent = "Billing Links";

  const linksWrap = document.createElement("p");
  linksWrap.className = "admin-assistant-status-value";

  const billingLinks = [
    {
      label: "OpenAI Billing",
      href: billing?.openai?.overviewUrl,
    },
    {
      label: "OpenAI Usage",
      href: billing?.openai?.usageUrl,
    },
    {
      label: "Anthropic Billing",
      href: billing?.anthropic?.overviewUrl,
    },
    {
      label: "Anthropic Usage",
      href: billing?.anthropic?.usageUrl,
    },
    {
      label: "Gemini Billing",
      href: billing?.gemini?.overviewUrl,
    },
    {
      label: "Gemini Usage",
      href: billing?.gemini?.usageUrl,
    },
  ].filter((item) => Boolean(item.href));

  billingLinks.forEach((item) => {
    const link = document.createElement("a");
    link.href = String(item.href || "#");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "admin-assistant-link";
    link.textContent = item.label;
    linksWrap.append(link);
  });

  linksCard.append(linksTitle, linksWrap);
  adminAssistantStatusGrid.appendChild(linksCard);

  if (adminAssistantStatusUpdatedAt) {
    adminAssistantStatusUpdatedAt.textContent = `Updated: ${formatAssistantDate(payload?.generatedAt)}`;
  }
}

function renderAdminAssistantStatusError(errorMessage) {
  if (!adminAssistantStatusGrid) {
    return;
  }

  adminAssistantStatusGrid.innerHTML = "";
  const fallback = document.createElement("p");
  fallback.className = "admin-chart-empty";
  fallback.textContent = errorMessage;
  adminAssistantStatusGrid.appendChild(fallback);

  if (adminAssistantStatusUpdatedAt) {
    adminAssistantStatusUpdatedAt.textContent = "";
  }
}

function renderAdminRuntimeMetrics(payload) {
  if (!adminRuntimeMetricsGrid) {
    return;
  }

  adminRuntimeMetricsGrid.innerHTML = "";

  const runtime = payload?.runtime || {};
  const requests = runtime.requests || {};
  const status = requests.status || {};
  const latency = runtime.latencyMs || {};
  const routes = Array.isArray(requests.topRoutes) ? requests.topRoutes : [];
  const health = runtime.health || {};

  adminRuntimeMetricsGrid.appendChild(
    createRuntimeHealthItem(health.level, health.reasons),
  );

  const items = [
    ["Started At", formatAssistantDate(runtime.startedAt)],
    ["Uptime", `${runtime.uptimeSeconds ?? 0}s`],
    ["API Requests", String(requests.apiTotal ?? 0)],
    ["Requests Last 60s", String(requests.last60s ?? 0)],
    ["Request Rate", `${requests.ratePerMinute ?? 0} req/min`],
    ["2xx", String(status["2xx"] ?? 0)],
    ["4xx", String(status["4xx"] ?? 0)],
    ["5xx", String(status["5xx"] ?? 0)],
    ["Other Status", String(status.other ?? 0)],
    ["Latency Avg", `${latency.avg ?? 0} ms`],
    ["Latency P95", `${latency.p95 ?? 0} ms`],
    ["Latency Sample Size", String(latency.sampleSize ?? 0)],
    [
      "Top Routes",
      routes.length
        ? routes
            .map((item) => `${String(item.path || "-")} (${item.count ?? 0})`)
            .join(" | ")
        : "No API traffic yet",
    ],
  ];

  items.forEach(([label, value]) => {
    adminRuntimeMetricsGrid.appendChild(
      createAssistantStatusItem(label, String(value)),
    );
  });

  if (adminRuntimeMetricsUpdatedAt) {
    adminRuntimeMetricsUpdatedAt.textContent = `Updated: ${formatAssistantDate(payload?.generatedAt)}`;
  }
}

function renderAdminRuntimeMetricsError(errorMessage) {
  if (!adminRuntimeMetricsGrid) {
    return;
  }

  adminRuntimeMetricsGrid.innerHTML = "";
  const fallback = document.createElement("p");
  fallback.className = "admin-chart-empty";
  fallback.textContent = errorMessage;
  adminRuntimeMetricsGrid.appendChild(fallback);

  if (adminRuntimeMetricsUpdatedAt) {
    adminRuntimeMetricsUpdatedAt.textContent = "";
  }
}

async function refreshRuntimeMetricsWithStatus(okMessage = "") {
  if (!adminRuntimeMetricsGrid) {
    return;
  }

  if (isRuntimeRefreshInFlight) {
    return;
  }

  isRuntimeRefreshInFlight = true;

  try {
    const payload = await fetchAdminRuntimeMetrics();
    renderAdminRuntimeMetrics(payload);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    renderAdminRuntimeMetricsError(
      error.message || "Could not load runtime metrics.",
    );
    if (okMessage) {
      setAdminStatus(error.message || "Could not load runtime metrics.", true);
    }
  } finally {
    isRuntimeRefreshInFlight = false;
  }
}

function stopRuntimeAutoRefresh() {
  if (runtimeMetricsCountdownIntervalId != null) {
    window.clearInterval(runtimeMetricsCountdownIntervalId);
    runtimeMetricsCountdownIntervalId = null;
  }
  runtimeNextRefreshAtMs = 0;

  if (runtimeMetricsIntervalId == null) {
    setRuntimeAutoRefreshState(false);
    return;
  }

  window.clearInterval(runtimeMetricsIntervalId);
  runtimeMetricsIntervalId = null;
  setRuntimeAutoRefreshState(false);
}

function shouldRunRuntimeAutoRefresh() {
  if (!adminRuntimeMetricsGrid || !adminDashboard) {
    return false;
  }

  if (adminDashboard.hidden) {
    return false;
  }

  if (!getAdminToken()) {
    return false;
  }

  if (document.visibilityState === "hidden") {
    return false;
  }

  return true;
}

function ensureRuntimeAutoRefresh() {
  if (!shouldRunRuntimeAutoRefresh()) {
    stopRuntimeAutoRefresh();
    return;
  }

  if (runtimeMetricsIntervalId != null) {
    updateRuntimeAutoRefreshCountdown();
    return;
  }

  runtimeNextRefreshAtMs = Date.now() + RUNTIME_AUTO_REFRESH_MS;

  runtimeMetricsIntervalId = window.setInterval(() => {
    if (!shouldRunRuntimeAutoRefresh()) {
      stopRuntimeAutoRefresh();
      return;
    }

    runtimeNextRefreshAtMs = Date.now() + RUNTIME_AUTO_REFRESH_MS;
    updateRuntimeAutoRefreshCountdown();
    refreshRuntimeMetricsWithStatus("");
  }, RUNTIME_AUTO_REFRESH_MS);

  if (runtimeMetricsCountdownIntervalId == null) {
    runtimeMetricsCountdownIntervalId = window.setInterval(
      updateRuntimeAutoRefreshCountdown,
      1000,
    );
  }

  updateRuntimeAutoRefreshCountdown();
}

async function refreshAssistantStatusWithStatus(okMessage = "") {
  if (!adminAssistantStatusGrid) {
    return;
  }

  try {
    const payload = await fetchAdminAssistantStatus();
    renderAdminAssistantStatus(payload);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    renderAdminAssistantStatusError(
      error.message || "Could not load assistant status.",
    );
    if (okMessage) {
      setAdminStatus(error.message || "Could not load assistant status.", true);
    }
  }
}

async function refreshBackupsWithStatus(okMessage) {
  try {
    const backups = await fetchAdminBackups(currentBackupReason);
    renderBackupList(backups);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    setAdminStatus(error.message || "Could not load backups.", true);
  }
}

async function tryAutoLogin() {
  const token = getAdminToken();
  if (!token) {
    return false;
  }

  try {
    if (adminRange) {
      currentAdminRange = adminRange.value || "all";
    }
    const data = await fetchAdminOverview(currentAdminRange);
    adminAuthPanel.hidden = true;
    adminDashboard.hidden = false;
    renderAdminDashboard(data);
    await refreshBackupsWithStatus("");
    await refreshRuntimeMetricsWithStatus("");
    await refreshAssistantStatusWithStatus("");
    await refreshRoutingStatus("");
    ensureRuntimeAutoRefresh();
    return true;
  } catch {
    setAdminToken("");
    stopRuntimeAutoRefresh();
    return false;
  }
}

function initAdminPage() {
  if (!adminLoginForm || !adminAuthPanel || !adminDashboard) {
    return;
  }

  setRuntimeAutoRefreshState(false);

  if (adminRange) {
    adminRange.value = currentAdminRange;
  }

  if (adminBackupReason) {
    adminBackupReason.value = currentBackupReason;
  }

  tryAutoLogin();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      ensureRuntimeAutoRefresh();
      if (shouldRunRuntimeAutoRefresh()) {
        refreshRuntimeMetricsWithStatus("");
      }
      return;
    }

    stopRuntimeAutoRefresh();
  });

  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username =
      document.getElementById("adminUsername")?.value?.trim() || "";
    const password = document.getElementById("adminPassword")?.value || "";

    if (!username || !password) {
      setAdminStatus("Please enter username and password.", true);
      return;
    }

    setAdminStatus("Authenticating...");

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Sign in failed.");
      }

      setAdminToken(payload.token);
      currentAdminRange = adminRange?.value || "all";
      const data = await fetchAdminOverview(currentAdminRange);
      adminAuthPanel.hidden = true;
      adminDashboard.hidden = false;
      renderAdminDashboard(data);
      await refreshBackupsWithStatus("");
      await refreshRuntimeMetricsWithStatus("");
      await refreshAssistantStatusWithStatus("");
      await refreshRoutingStatus("");
      ensureRuntimeAutoRefresh();
      setAdminStatus("Signed in.");
    } catch (error) {
      setAdminStatus(error.message || "Could not sign in.", true);
    }
  });

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", () => {
      stopRuntimeAutoRefresh();
      setAdminToken("");
      adminDashboard.hidden = true;
      adminAuthPanel.hidden = false;
      setAdminStatus("Signed out.");
    });
  }

  if (adminRange) {
    adminRange.addEventListener("change", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      currentAdminRange = adminRange.value || "all";
      try {
        const data = await fetchAdminOverview(currentAdminRange);
        renderAdminDashboard(data);
      } catch (error) {
        setAdminStatus(error.message || "Could not refresh analytics.", true);
      }
    });
  }

  if (adminRefreshBtn) {
    adminRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      try {
        const data = await fetchAdminOverview(currentAdminRange);
        renderAdminDashboard(data);
        await refreshRuntimeMetricsWithStatus("");
        await refreshAssistantStatusWithStatus("");
        ensureRuntimeAutoRefresh();
        setAdminStatus("Analytics refreshed.");
      } catch (error) {
        setAdminStatus(error.message || "Could not refresh analytics.", true);
      }
    });
  }

  if (adminAssistantStatusRefreshBtn) {
    adminAssistantStatusRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      await refreshAssistantStatusWithStatus("Assistant status refreshed.");
    });
  }

  if (adminRuntimeMetricsRefreshBtn) {
    adminRuntimeMetricsRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        stopRuntimeAutoRefresh();
        return;
      }

      await refreshRuntimeMetricsWithStatus("Runtime metrics refreshed.");
      ensureRuntimeAutoRefresh();
    });
  }

  if (adminExportBtn) {
    adminExportBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      try {
        const token = getAdminToken();
        const params = new URLSearchParams({ range: currentAdminRange });
        const response = await apiFetch(
          `/api/admin/export.csv?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Could not export CSV.");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `magneto-analytics-${currentAdminRange}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setAdminStatus("CSV export completed.");
      } catch (error) {
        setAdminStatus(error.message || "Could not export CSV.", true);
      }
    });
  }

  if (adminBackupRefreshBtn) {
    adminBackupRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshBackupsWithStatus("Backup list refreshed.");
    });
  }

  if (adminBackupReason) {
    adminBackupReason.addEventListener("change", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      currentBackupReason = adminBackupReason.value || "all";
      await refreshBackupsWithStatus("Backup filter applied.");
    });
  }

  if (adminBackupCreateBtn) {
    adminBackupCreateBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      try {
        const backups = await createBackupNow();
        renderBackupList(backups);
        setAdminStatus("Manual backup created.");
      } catch (error) {
        setAdminStatus(error.message || "Could not create backup.", true);
      }
    });
  }

  if (adminRoutingRefreshBtn) {
    adminRoutingRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshRoutingStatus("Routing status refreshed.");
    });
  }

  if (adminRoutingVerifyBtn) {
    adminRoutingVerifyBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      try {
        setAdminStatus("Running dry-test...");
        const result = await fetchAdminRoutingVerify();
        renderRoutingVerify(result);
        renderRoutingState(result.routing || {});
        setAdminStatus(
          result.ok
            ? "Dry-test PASSED."
            : "Dry-test PARTIAL – see results below.",
          !result.ok,
        );
      } catch (error) {
        setAdminStatus(error.message || "Dry-test failed.", true);
      }
    });
  }

  adminRoutingBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      const backend = btn.dataset.backend || "node";
      const canaryPercent = Number(btn.dataset.canary ?? 100);
      const note = btn.dataset.note || "";
      try {
        const result = await postAdminRouting({
          activeBackend: backend,
          canaryPercent,
          note,
        });
        renderRoutingState(result.routing || {});
        if (adminRoutingVerifyResult) {
          adminRoutingVerifyResult.hidden = true;
        }
        setAdminStatus(
          `Routing switched: ${backend.toUpperCase()} @ ${canaryPercent}%.`,
        );
      } catch (error) {
        setAdminStatus(error.message || "Could not update routing.", true);
      }
    });
  });
}

function getPageNameFromPath() {
  const fileName = window.location.pathname.split("/").pop() || "index.html";

  if (!fileName || fileName === "/") {
    return "index.html";
  }

  return fileName;
}

initHomeForm();
initMagnetoFlagRotation();
initWeatherWidget();
initResultsPage();
initAdminPage();
trackPageView(getPageNameFromPath());

window.addEventListener("resize", syncSidePanelHeights);
requestAnimationFrame(syncSidePanelHeights);
