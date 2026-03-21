(function initMagnetoSearchApi(global) {
  const apiFetch = global.MagnetoApiClient?.apiFetch;

  async function fetchPopularSearches() {
    if (typeof apiFetch !== "function") {
      return [];
    }

    try {
      const response = await apiFetch("/api/analytics/popular-searches");
      if (!response.ok) {
        return [];
      }
      const payload = await response.json();
      return Array.isArray(payload.queries) ? payload.queries : [];
    } catch {
      return [];
    }
  }

  global.MagnetoSearchApi = {
    fetchPopularSearches,
  };
})(window);
