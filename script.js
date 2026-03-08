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

const assistantThread = document.getElementById("assistantThread");
const assistantSuggestions = document.getElementById("assistantSuggestions");
const assistantForm = document.getElementById("assistantForm");
const assistantInput = document.getElementById("assistantInput");

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

const ADMIN_TOKEN_KEY = "magneto.admin.token";
let currentAdminRange = "all";
let currentBackupReason = "all";

function syncSidePanelHeights() {
  if (!weatherPanel || !rightPanel) {
    return;
  }

  // Keep assistant equal to weather height without forcing weather to grow.
  rightPanel.style.minHeight = "";
  const weatherHeight = Math.ceil(weatherPanel.getBoundingClientRect().height);
  if (weatherHeight > 0) {
    rightPanel.style.minHeight = `${weatherHeight}px`;
  }
}

function updateStatus(message, isError = false) {
  if (!statusMessage) {
    return;
  }

  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
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
      message: "Start with a topic and I will suggest a more precise query.",
      suggestions: ["world news today", "javascript tutorials", "remote jobs"],
    };
  }

  const normalized = query.toLowerCase();

  if (/weather|rain|sun|forecast/.test(normalized)) {
    return {
      message: "Add city + date for better weather results.",
      suggestions: [
        `${query} this weekend`,
        `${query} in my city`,
        "hourly weather forecast",
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
    message: `Great query. Here are 3 refined versions for "${query}".`,
    suggestions: [`${query} guide`, `${query} 2026`, `${query} explained`],
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
      if (!searchQuery) {
        return;
      }

      searchQuery.value = suggestion;
      searchQuery.focus();
      updateStatus(`Suggestion applied: ${suggestion}`);
      addAssistantMessage("user", suggestion);
      addAssistantMessage(
        "bot",
        "Running search with your selected suggestion.",
      );
      window.location.href = `results.html?q=${encodeURIComponent(suggestion)}`;
    });

    assistantSuggestions.appendChild(button);
  });
}

function initAssistantChat() {
  if (!assistantThread || !assistantForm || !assistantInput) {
    return;
  }

  if (assistantThread.children.length === 0) {
    addAssistantMessage(
      "bot",
      "Hi, I am MAGNETO Assistant. Tell me what you want to search.",
    );
  }

  assistantForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const userText = assistantInput.value.trim();
    if (!userText) {
      return;
    }

    addAssistantMessage("user", userText);
    const content = buildAssistantContent(userText);
    addAssistantMessage("bot", content.message);

    if (searchQuery) {
      searchQuery.value = userText;
    }

    updateAssistant(userText);
    assistantInput.value = "";
  });

  updateAssistant(searchQuery?.value || "");
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

  searchQuery.addEventListener("input", () => {
    updateAssistant(searchQuery.value);
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
      updateAssistant(query);
    });
  });

  initAssistantChat();
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
  if (index === 0) {
    return "Today";
  }

  const date = new Date(`${dateIso}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short" });
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
    temp.textContent = `${Math.round(day.tempMax)}\u00B0 / ${Math.round(day.tempMin)}\u00B0`;

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
  const response = await fetch("/api/location/auto");
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
    await fetch("/api/events/page-view", {
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
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
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

  const response = await fetch(`/api/admin/overview?${params.toString()}`, {
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
  const response = await fetch(`/api/admin/backups?${params.toString()}`, {
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

async function downloadBackupFile(fileName) {
  const token = getAdminToken();
  const params = new URLSearchParams({ fileName });
  const response = await fetch(
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
  const response = await fetch("/api/admin/backups/create", {
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

async function restoreBackup(fileName) {
  const token = getAdminToken();
  const response = await fetch("/api/admin/backups/restore", {
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
    return true;
  } catch {
    setAdminToken("");
    return false;
  }
}

function initAdminPage() {
  if (!adminLoginForm || !adminAuthPanel || !adminDashboard) {
    return;
  }

  if (adminRange) {
    adminRange.value = currentAdminRange;
  }

  if (adminBackupReason) {
    adminBackupReason.value = currentBackupReason;
  }

  tryAutoLogin();

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
      const response = await fetch("/api/auth/login", {
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
      setAdminStatus("Signed in.");
    } catch (error) {
      setAdminStatus(error.message || "Could not sign in.", true);
    }
  });

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", () => {
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
        setAdminStatus("Analytics refreshed.");
      } catch (error) {
        setAdminStatus(error.message || "Could not refresh analytics.", true);
      }
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
        const response = await fetch(
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
}

function getPageNameFromPath() {
  const fileName = window.location.pathname.split("/").pop() || "index.html";

  if (!fileName || fileName === "/") {
    return "index.html";
  }

  return fileName;
}

initHomeForm();
initWeatherWidget();
initResultsPage();
initAdminPage();
trackPageView(getPageNameFromPath());
