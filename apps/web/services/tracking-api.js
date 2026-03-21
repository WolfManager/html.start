(function initMagnetoTrackingApi(global) {
  const apiFetch = global.MagnetoApiClient?.apiFetch;

  async function trackPageView(pageName) {
    if (typeof apiFetch !== "function") {
      return;
    }

    try {
      await apiFetch("/api/events/page-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pageName }),
      });
    } catch {
      // No-op for tracking failures.
    }
  }

  async function trackResultClick(url, title, query) {
    if (typeof apiFetch !== "function") {
      return;
    }

    try {
      const normalizedUrl = String(url || "").trim();
      const normalizedTitle = String(title || "").trim();
      const normalizedQuery = String(query || "").trim();

      if (!normalizedUrl || !normalizedTitle || !normalizedQuery) {
        return;
      }

      await apiFetch("/api/events/result-click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: normalizedUrl,
          title: normalizedTitle,
          query: normalizedQuery,
        }),
      });
    } catch (error) {
      console.debug("Could not track result click:", error);
    }
  }

  global.MagnetoTrackingApi = {
    trackPageView,
    trackResultClick,
  };
})(window);
