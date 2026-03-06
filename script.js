const searchForm = document.getElementById("searchForm");
const searchQuery = document.getElementById("searchQuery");
const searchEngine = document.getElementById("searchEngine");
const searchLanguage = document.getElementById("searchLanguage");
const statusMessage = document.getElementById("statusMessage");
const quickTags = document.querySelectorAll(".quick-tags .tag");
const weatherIcon = document.getElementById("weatherIcon");
const weatherTemp = document.getElementById("weatherTemp");
const weatherSummary = document.getElementById("weatherSummary");
const weatherLocation = document.getElementById("weatherLocation");
const assistantThread = document.getElementById("assistantThread");
const assistantSuggestions = document.getElementById("assistantSuggestions");
const assistantForm = document.getElementById("assistantForm");
const assistantInput = document.getElementById("assistantInput");

const resultsQuery = document.getElementById("resultsQuery");
const resultsMeta = document.getElementById("resultsMeta");
const resultsList = document.getElementById("resultsList");

const STORAGE_KEY = "magneto.preferences";

const languageLabel = {
  all: "toate limbile",
  ro: "romana",
  en: "engleza",
  es: "spaniola",
  fr: "franceza",
  de: "germana",
  it: "italiana",
  pt: "portugheza",
  nl: "olandeza",
  pl: "poloneza",
  tr: "turca",
  ar: "araba",
  hi: "hindi",
  ja: "japoneza",
  ko: "coreeana",
  "zh-CN": "chineza simplificata",
  "zh-TW": "chineza traditionala",
  ru: "rusa",
  uk: "ucraineana",
  el: "greaca",
  sv: "suedeza",
  da: "daneza",
  fi: "finlandeza",
  no: "norvegiana",
  cs: "ceha",
  hu: "maghiara",
  vi: "vietnameza",
  th: "tailandeza",
  id: "indoneziana",
  ms: "malaeziana",
  he: "ebraica",
};

const engineLabel = {
  google: "Google",
  duckduckgo: "DuckDuckGo",
  bing: "Bing",
};

function buildSearchUrl(engine, query, language) {
  const encodedQuery = encodeURIComponent(query);

  if (engine === "google") {
    if (language === "all") {
      return `https://www.google.com/search?q=${encodedQuery}`;
    }

    const languageCode = encodeURIComponent(language);
    const lrCode = encodeURIComponent(`lang_${language}`);
    return `https://www.google.com/search?q=${encodedQuery}&hl=${languageCode}&lr=${lrCode}`;
  }

  if (engine === "duckduckgo") {
    if (language === "all") {
      return `https://duckduckgo.com/?q=${encodedQuery}`;
    }

    return `https://duckduckgo.com/?q=${encodedQuery}%20language:${encodeURIComponent(language)}`;
  }

  if (engine === "bing") {
    if (language === "all") {
      return `https://www.bing.com/search?q=${encodedQuery}`;
    }

    const languageCode = encodeURIComponent(language);
    return `https://www.bing.com/search?q=${encodedQuery}&setlang=${languageCode}`;
  }

  return `https://www.google.com/search?q=${encodedQuery}`;
}

function navigateToResults(query) {
  if (!query) {
    return;
  }

  const engine = searchEngine?.value || "google";
  const language = searchLanguage?.value || "all";
  const params = new URLSearchParams({ q: query, engine, language });
  window.location.href = `results.html?${params.toString()}`;
}

function updateStatus(message, isError = false) {
  if (!statusMessage) {
    return;
  }

  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function savePreferences(engine, language) {
  const payload = { engine, language };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadPreferences() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function detectBrowserLanguage() {
  const browserLanguages =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  if (!browserLanguages) {
    return "all";
  }

  const values = Array.from(searchLanguage?.options || []).map((option) =>
    option.value.toLowerCase(),
  );

  for (const locale of browserLanguages) {
    const normalized = String(locale || "").trim();
    if (!normalized) {
      continue;
    }

    const exact = normalized.toLowerCase();
    const base = exact.split("-")[0];

    if (values.includes(exact)) {
      return searchLanguage.options[values.indexOf(exact)].value;
    }

    if (values.includes(base)) {
      return searchLanguage.options[values.indexOf(base)].value;
    }
  }

  return "all";
}

function initHomeForm() {
  if (!searchForm || !searchQuery || !searchEngine || !searchLanguage) {
    return;
  }

  const stored = loadPreferences();

  if (stored?.engine && engineLabel[stored.engine]) {
    searchEngine.value = stored.engine;
  }

  if (stored?.language && languageLabel[stored.language]) {
    searchLanguage.value = stored.language;
    updateStatus("Preferintele tale au fost incarcate.");
  } else {
    const detected = detectBrowserLanguage();
    if (detected !== "all" && languageLabel[detected]) {
      searchLanguage.value = detected;
      updateStatus(`Limba detectata automat: ${languageLabel[detected]}.`);
    }
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = searchQuery.value.trim();
    const engine = searchEngine.value;
    const language = searchLanguage.value;

    if (!query) {
      updateStatus("Te rog scrie un termen de cautare.", true);
      return;
    }

    savePreferences(engine, language);
    const params = new URLSearchParams({ q: query, engine, language });
    window.location.href = `results.html?${params.toString()}`;
  });

  searchQuery.addEventListener("input", () => {
    const text = searchQuery.value;
    refreshAssistantSuggestions(text);
  });

  quickTags.forEach((tagButton) => {
    tagButton.addEventListener("click", () => {
      const query = tagButton.dataset.query;
      if (!query) {
        return;
      }

      searchQuery.value = query;
      searchQuery.focus();
      updateStatus(`Sugestie aplicata: ${query}`);
      refreshAssistantSuggestions(query);
    });
  });

  initAssistantChat();
  refreshAssistantSuggestions(searchQuery.value);
}

function buildAssistantContent(rawQuery) {
  const query = (rawQuery || "").trim();

  if (!query) {
    return {
      message:
        "Poti incepe cu o cautare simpla, apoi eu iti propun directii mai precise.",
      suggestions: [
        "stiri locale azi",
        "vremea pe urmatoarele 7 zile",
        "program transport public",
      ],
    };
  }

  const normalized = query.toLowerCase();

  if (/vreme|ploaie|soare|temperatura/.test(normalized)) {
    return {
      message: "Pare o cautare meteo. Vrei si o varianta mai specifica?",
      suggestions: [
        `${query} in orasul meu`,
        `${query} weekend`,
        "prognoza meteo ora cu ora",
      ],
    };
  }

  if (/stiri|news|actualitate|politic/.test(normalized)) {
    return {
      message: "Iti pot rafina cautarea pentru noutati relevante.",
      suggestions: [
        `${query} ultimele 24 ore`,
        `${query} surse oficiale`,
        `${query} analiza`,
      ],
    };
  }

  if (/sport|meci|fotbal|tenis|baschet/.test(normalized)) {
    return {
      message: "Pentru sport, merita sa vezi rezultate + program.",
      suggestions: [
        `${query} rezultate live`,
        `${query} clasament`,
        `${query} program urmator`,
      ],
    };
  }

  if (/retete|mancare|restaurant|food/.test(normalized)) {
    return {
      message: "Iti recomand sa cauti si dupa timp de preparare.",
      suggestions: [
        `${query} rapid`,
        `${query} ingrediente simple`,
        `${query} video`,
      ],
    };
  }

  if (/job|loc de munca|angajare|cv|cariera/.test(normalized)) {
    return {
      message: "Pentru joburi, filtrele corecte fac diferenta.",
      suggestions: [
        `${query} remote`,
        `${query} fara experienta`,
        `${query} salariu`,
      ],
    };
  }

  return {
    message: `Buna directie. Pentru "${query}" iti propun 3 cautari mai exacte:`,
    suggestions: [
      `${query} ghid complet`,
      `${query} 2026`,
      `${query} explicat simplu`,
    ],
  };
}

function updateAssistant(query) {
  if (!assistantSuggestions) {
    return;
  }

  const content = buildAssistantContent(query);
  assistantSuggestions.innerHTML = "";

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
      updateStatus(`MAGNETO iti propune: ${suggestion}`);
      addAssistantMessage("user", suggestion);
      addAssistantMessage(
        "bot",
        `Perfect. Te trimit catre rezultate pentru: ${suggestion}`,
      );
      refreshAssistantSuggestions(suggestion);
      navigateToResults(suggestion);
    });
    assistantSuggestions.appendChild(button);
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

function buildAssistantReply(userText) {
  const query = String(userText || "").trim();
  if (!query) {
    return "Spune-mi un subiect, iar eu iti propun o cautare mai precisa.";
  }

  const normalized = query.toLowerCase();

  if (/vreme|ploaie|soare|temperatura/.test(normalized)) {
    return "Iti recomand sa adaugi orasul si intervalul de timp ca sa obtii rezultate mai bune.";
  }

  if (/stiri|news|actualitate|politic/.test(normalized)) {
    return "Poti filtra dupa 'ultimele 24 ore' si 'surse oficiale' pentru informatii mai curate.";
  }

  if (/sport|meci|fotbal|tenis|baschet/.test(normalized)) {
    return "Adauga 'rezultate live' sau 'program urmator' ca sa vezi rapid ce te intereseaza.";
  }

  if (/retete|mancare|restaurant|food/.test(normalized)) {
    return "Incearca sa adaugi 'rapid' sau 'ingrediente simple' pentru retete usor de urmat.";
  }

  if (/job|loc de munca|angajare|cv|cariera/.test(normalized)) {
    return "Un filtru util este combinatia dintre 'remote', 'oras' si 'nivel experienta'.";
  }

  return "Foarte bine. Incearca sa adaugi un context clar: locatie, perioada sau scopul cautarii.";
}

function initAssistantChat() {
  if (!assistantThread || !assistantForm || !assistantInput) {
    return;
  }

  if (assistantThread.children.length === 0) {
    addAssistantMessage(
      "bot",
      "Salut, sunt MAGNETO Assistant. Spune-mi ce vrei sa cauti si te ajut cu sugestii.",
    );
  }

  assistantForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const userText = assistantInput.value.trim();
    if (!userText) {
      return;
    }

    addAssistantMessage("user", userText);
    const reply = buildAssistantReply(userText);
    addAssistantMessage("bot", reply);

    if (searchQuery) {
      searchQuery.value = userText;
    }

    refreshAssistantSuggestions(userText);
    assistantInput.value = "";
  });
}

function refreshAssistantSuggestions(query) {
  const content = buildAssistantContent(query);

  if (
    assistantThread &&
    assistantThread.children.length === 1 &&
    assistantThread.firstChild?.textContent?.includes("Salut")
  ) {
    addAssistantMessage("bot", content.message);
  }

  updateAssistant(query);
}

function getWeatherView(weatherCode) {
  if (weatherCode === 0) {
    return { icon: "&#9728;", summary: "Cer senin" };
  }

  if (weatherCode === 1 || weatherCode === 2 || weatherCode === 3) {
    return { icon: "&#9729;", summary: "Innorat" };
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return { icon: "&#9729;&#8776;", summary: "Ceata" };
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
    return { icon: "&#9729;&#8942;", summary: "Ploaie" };
  }

  return { icon: "&#9729;", summary: "Conditii variabile" };
}

async function fetchWeatherByCoords(latitude, longitude) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    "&current=temperature_2m,weather_code&timezone=auto";

  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error("Nu am putut obtine datele meteo.");
  }

  const data = await response.json();
  const current = data.current;

  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("Date meteo incomplete.");
  }

  return {
    temperature: current.temperature_2m,
    weatherCode: current.weather_code,
  };
}

function setWeatherUI({ temperature, weatherCode, locationText }) {
  if (!weatherTemp || !weatherSummary || !weatherLocation || !weatherIcon) {
    return;
  }

  const view = getWeatherView(Number(weatherCode));
  weatherTemp.textContent = `${Math.round(temperature)}\u00B0C`;
  weatherSummary.textContent = view.summary;
  weatherLocation.textContent = locationText;
  weatherIcon.innerHTML = view.icon;
}

function initWeatherWidget() {
  if (!weatherTemp || !weatherSummary || !weatherLocation || !weatherIcon) {
    return;
  }

  if (!navigator.geolocation) {
    weatherSummary.textContent = "GPS indisponibil";
    weatherLocation.textContent = "Browserul tau nu suporta geolocatia.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      try {
        const weather = await fetchWeatherByCoords(latitude, longitude);
        const locationText = `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`;
        setWeatherUI({ ...weather, locationText });
      } catch {
        weatherSummary.textContent = "Meteo indisponibil";
        weatherLocation.textContent = "Nu am putut incarca vremea acum.";
      }
    },
    () => {
      weatherSummary.textContent = "Permisiune GPS refuzata";
      weatherLocation.textContent = "Activeaza localizarea pentru meteo local.";
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 600000,
    },
  );
}

function createResultLinks(query, language, engine) {
  const engines = [engine, "google", "duckduckgo", "bing"].filter(
    (value, index, array) => array.indexOf(value) === index,
  );

  const links = engines.map((engineName) => ({
    title: `${engineLabel[engineName] || "Google"} - rezultate web`,
    description: `Cauta pe ${engineLabel[engineName] || "Google"} in ${languageLabel[language] || "limba selectata"}.`,
    href: buildSearchUrl(engineName, query, language),
  }));

  links.push({
    title: "Wikipedia",
    description: "Vezi articole relevante in enciclopedia online.",
    href: `https://www.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
  });

  links.push({
    title: "YouTube",
    description: "Descopera clipuri si explicatii pentru cautarea ta.",
    href: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  });

  links.push({
    title: "GitHub",
    description: "Rezultate tehnice si proiecte open-source.",
    href: `https://github.com/search?q=${encodeURIComponent(query)}`,
  });

  return links;
}

function initResultsPage() {
  if (!resultsQuery || !resultsMeta || !resultsList) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const query = (params.get("q") || "").trim();
  const engine = params.get("engine") || "google";
  const language = params.get("language") || "all";

  if (!query) {
    resultsQuery.textContent = "Nicio cautare activa";
    resultsMeta.textContent =
      "Intoarce-te la pagina principala si introdu un termen.";
    return;
  }

  savePreferences(engine, language);
  resultsQuery.textContent = `Rezultate pentru: ${query}`;
  resultsMeta.textContent = `Motor preferat: ${engineLabel[engine] || "Google"} | Limba: ${languageLabel[language] || "toate limbile"}`;

  const links = createResultLinks(query, language, engine);

  links.forEach((item) => {
    const li = document.createElement("li");
    li.className = "result-card";

    const anchor = document.createElement("a");
    anchor.className = "result-link";
    anchor.href = item.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = item.title;

    const paragraph = document.createElement("p");
    paragraph.className = "result-description";
    paragraph.textContent = item.description;

    li.append(anchor, paragraph);
    resultsList.appendChild(li);
  });
}

initHomeForm();
initWeatherWidget();
initResultsPage();
