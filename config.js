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

  var defaultBase = "http://127.0.0.1:8000";
  var selected = fromQuery || fromStorage || defaultBase;

  // Normalize trailing slashes to avoid double-slash API URLs.
  selected = selected.replace(/\/+$/, "");
  window.MAGNETO_API_BASE_URL = selected;
})();
