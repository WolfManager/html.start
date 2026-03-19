(function initMagnetoApiConfig() {
  // Priority: query param > localStorage > default.
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
        localStorage.removeItem("MAGNETO_API_BASE_URL");
      } catch (_error) {
        // Ignore storage cleanup issues.
      }
    }
  }

  if (isHttp) {
    // If frontend runs on localhost with a non-API port (e.g. Live Server),
    // prefer the local API server on :3000 by default.
    defaultBase = isLocalHost
      ? "http://" + localApiHost + ":3000"
      : window.location.origin;
  }
  var selected = fromQuery || fromStorage || defaultBase;

  // Normalize trailing slashes to avoid double-slash API URLs.
  selected = selected.replace(/\/+$/, "");
  window.MAGNETO_API_BASE_URL = selected;
})();
