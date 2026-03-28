const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildLocalStorage(initial = {}) {
  const store = new Map(
    Object.entries(initial).map(([k, v]) => [k, String(v)]),
  );
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function runConfigCase({ search, protocol, hostname, origin, initialStorage }) {
  const configPath = path.join(__dirname, "..", "config.js");
  const code = fs.readFileSync(configPath, "utf8");

  const localStorage = buildLocalStorage(initialStorage);
  const context = {
    URL,
    URLSearchParams,
    localStorage,
    window: {
      location: { search, protocol, hostname, origin },
    },
  };

  vm.createContext(context);
  vm.runInContext(code, context, { filename: "config.js" });

  return {
    apiBase: context.window.MAGNETO_API_BASE_URL,
    source: context.window.MAGNETO_API_BASE_SOURCE,
    stored: localStorage.getItem("MAGNETO_API_BASE_URL"),
    resetValue:
      typeof context.window.resetMagnetoApiBase === "function"
        ? context.window.resetMagnetoApiBase()
        : null,
  };
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function runAssistantCases() {
  const messages = ["cum esti ?", "ce faci", "putem sa vorbim ?"];
  const outputs = [];

  for (const message of messages) {
    const { response, payload } = await jsonRequest(
      "http://127.0.0.1:3000/api/assistant/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      },
    );

    const reply = String(
      payload.response || payload.reply || payload.message || "",
    );
    outputs.push({
      message,
      status: response.status,
      provider: payload.provider,
      reply,
    });

    assert(response.ok, `assistant request failed for message: ${message}`);
    assert(
      String(payload.provider || "") === "fallback",
      `assistant provider is not fallback for message: ${message}`,
    );
    assert(
      reply.length > 0,
      `assistant reply is empty for message: ${message}`,
    );
    assert(
      /sunt|putem|vorbi|ajut|raspund/i.test(reply),
      `assistant reply does not look conversational in RO for message: ${message}`,
    );
  }

  return outputs;
}

async function runSearchRefinementCase() {
  const query =
    "cum optimizez cautarea full text intr-un site cu ranking personalizat";
  const url = `http://127.0.0.1:3000/api/search?q=${encodeURIComponent(query)}`;
  const { response, payload } = await jsonRequest(url, { method: "GET" });

  assert(response.ok, "search refinement request failed");
  const count = Array.isArray(payload.results) ? payload.results.length : 0;
  assert(count > 0, "search refinement still returns zero results on node");

  return {
    status: response.status,
    resultCount: count,
    queryUsed: payload.queryUsed || "",
    correctionReason: payload.queryCorrection?.reason || null,
  };
}

async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  const localCase = runConfigCase({
    search: "?apiBase=http://127.0.0.1:8000",
    protocol: "http:",
    hostname: "localhost",
    origin: "http://localhost:3000",
    initialStorage: {},
  });
  assert(
    localCase.apiBase === "http://127.0.0.1:8000",
    "config local query override not applied",
  );
  assert(
    localCase.source === "query",
    "config source should be query for explicit apiBase",
  );
  assert(
    localCase.stored === "http://127.0.0.1:8000",
    "config query override not persisted",
  );

  const publicCase = runConfigCase({
    search: "",
    protocol: "https:",
    hostname: "www.magneto-ai.com",
    origin: "https://www.magneto-ai.com",
    initialStorage: { MAGNETO_API_BASE_URL: "http://localhost:3000" },
  });
  assert(
    publicCase.apiBase === "https://www.magneto-ai.com",
    "config public default origin not enforced",
  );
  assert(
    publicCase.source === "default",
    "config source should be default after invalid storage cleanup",
  );
  assert(
    publicCase.stored === null,
    "config should clear invalid localhost storage on public host",
  );

  report.checks.config = { localCase, publicCase };

  report.checks.assistant = await runAssistantCases();
  report.checks.searchRefinement = await runSearchRefinementCase();

  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      { ok: false, error: String(error.message || error) },
      null,
      2,
    ),
  );
  process.exit(1);
});
