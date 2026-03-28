(function initMagnetoApiConfig() {
  // Priority: valid query param > valid localStorage > safe default.
  var params = new URLSearchParams(window.location.search || "");
  var fromQuery = String(params.get("apiBase") || "").trim();
  var fromStorage = "";

  try {
    fromStorage = String(
      localStorage.getItem("MAGNETO_API_BASE_URL") || "",
    ).trim();
  } catch (_error) {
    fromStorage = "";
  }

  var isHttp =
    window.location.protocol === "http:" ||
    window.location.protocol === "https:";
  var host = String(window.location.hostname || "").toLowerCase();
  var isLocalHost =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  var localApiHost = host === "::1" ? "127.0.0.1" : host || "127.0.0.1";
  var defaultBase = "http://127.0.0.1:3000";

  function persistApiBase(value) {
    try {
      if (value) {
        localStorage.setItem("MAGNETO_API_BASE_URL", value);
      } else {
        localStorage.removeItem("MAGNETO_API_BASE_URL");
      }
    } catch (_error) {
      // Ignore storage persistence issues.
    }
  }

  function safeParseUrl(rawValue) {
    try {
      return new URL(String(rawValue || "").trim());
    } catch (_error) {
      return null;
    }
  }

  var parsedStorage = safeParseUrl(fromStorage);
  if (!parsedStorage) {
    fromStorage = "";
  }

  var parsedQuery = safeParseUrl(fromQuery);
  if (!parsedQuery) {
    fromQuery = "";
  }

  if (isLocalHost && parsedStorage) {
    var storageHost = String(parsedStorage.hostname || "").toLowerCase();
    var storagePort = String(parsedStorage.port || "");
    var storageIsLocal =
      storageHost === "localhost" ||
      storageHost === "127.0.0.1" ||
      storageHost === "::1";

    // Guard against stale local API override (ex: old :5500) that breaks search.
    if (storageIsLocal && storagePort && storagePort !== "3000") {
      fromStorage = "";
      try {
        persistApiBase("");
      } catch (_error) {
        // Ignore storage cleanup issues.
      }
    }
  }

  if (!isLocalHost && parsedStorage) {
    var remoteStorageHost = String(parsedStorage.hostname || "").toLowerCase();
    var remoteStorageIsLocal =
      remoteStorageHost === "localhost" ||
      remoteStorageHost === "127.0.0.1" ||
      remoteStorageHost === "::1";

    // A public/non-local frontend should never keep a localhost API override.
    if (remoteStorageIsLocal) {
      fromStorage = "";
      persistApiBase("");
    }
  }

  if (isHttp) {
    // If frontend runs on localhost with a non-API port (e.g. Live Server),
    // prefer the local API server on :3000 by default.
    defaultBase = isLocalHost
      ? "http://" + localApiHost + ":3000"
      : window.location.origin;
  }

  if (parsedQuery) {
    fromQuery = String(parsedQuery).replace(/\/+$/, "");
    // Persist explicit override from URL so reloads stay stable in the same browser.
    persistApiBase(fromQuery);
    fromStorage = fromQuery;
  }

  var selected = fromQuery || fromStorage || defaultBase;

  // Normalize trailing slashes to avoid double-slash API URLs.
  selected = selected.replace(/\/+$/, "");
  window.MAGNETO_API_BASE_URL = selected;
  window.MAGNETO_API_BASE_SOURCE = fromQuery
    ? "query"
    : fromStorage
      ? "localStorage"
      : "default";
  window.setMagnetoApiBase = function setMagnetoApiBase(rawValue) {
    var parsed = safeParseUrl(rawValue);
    if (!parsed) {
      throw new Error("Invalid API base URL.");
    }
    var normalized = String(parsed).replace(/\/+$/, "");
    persistApiBase(normalized);
    window.MAGNETO_API_BASE_URL = normalized;
    window.MAGNETO_API_BASE_SOURCE = "localStorage";
    return normalized;
  };
  window.resetMagnetoApiBase = function resetMagnetoApiBase() {
    persistApiBase("");
    window.MAGNETO_API_BASE_URL = defaultBase.replace(/\/+$/, "");
    window.MAGNETO_API_BASE_SOURCE = "default";
    return window.MAGNETO_API_BASE_URL;
  };
})();
