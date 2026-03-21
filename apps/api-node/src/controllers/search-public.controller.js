function createSearchSourcesController({
  pickSearchBackend,
  proxyDjangoSearch,
  getSearchSources,
}) {
  return async (req, res) => {
    const query = String(req.query.q || "").trim();
    const limit = String(req.query.limit || "").trim();

    if (pickSearchBackend() === "django") {
      try {
        const payload = await proxyDjangoSearch(
          "/api/search/sources",
          { q: query, limit },
          req,
        );
        res.json({
          ok: true,
          ...payload,
          servedBy: "django",
        });
        return;
      } catch (error) {
        console.warn(
          `[search] Django sources proxy failed, falling back to Node: ${String(error?.message || error)}`,
        );
      }
    }

    const sources = getSearchSources({ query, limit });

    res.json({
      ok: true,
      total: sources.length,
      sources,
      servedBy: "node",
    });
  };
}

function createSearchSuggestController({
  pickSearchBackend,
  proxyDjangoSearch,
  getSearchSuggestions,
}) {
  return async (req, res) => {
    const query = String(req.query.q || "").trim();
    const limit = String(req.query.limit || "").trim();

    if (!query || query.length < 2) {
      res.json({
        ok: true,
        query,
        total: 0,
        suggestions: [],
        servedBy: "node",
      });
      return;
    }

    if (pickSearchBackend() === "django") {
      try {
        const payload = await proxyDjangoSearch(
          "/api/search/suggest",
          { q: query, limit },
          req,
        );
        res.json({
          ok: true,
          ...payload,
          servedBy: "django",
        });
        return;
      } catch (error) {
        console.warn(
          `[search] Django suggest proxy failed, falling back to Node: ${String(error?.message || error)}`,
        );
      }
    }

    const suggestions = getSearchSuggestions(query, limit || 10);
    res.json({
      ok: true,
      query,
      total: suggestions.length,
      suggestions,
      servedBy: "node",
    });
  };
}

function createSearchTrendingController({
  pickSearchBackend,
  proxyDjangoSearch,
  getTrendingSearches,
}) {
  return async (req, res) => {
    const period = String(req.query.period || "weekly").trim() || "weekly";
    const limit = String(req.query.limit || "10").trim() || "10";
    const includeZero =
      String(req.query.includeZero || "false")
        .trim()
        .toLowerCase() === "true";
    const query = String(req.query.q || "").trim();

    if (pickSearchBackend() === "django") {
      try {
        const payload = await proxyDjangoSearch(
          "/api/search/trending",
          {
            period,
            limit,
            includeZero: includeZero ? "true" : "false",
            q: query,
          },
          req,
        );

        res.json({
          ok: true,
          ...payload,
          servedBy: "django",
        });
        return;
      } catch (error) {
        console.warn(
          `[search] Django trending proxy failed, falling back to Node: ${String(error?.message || error)}`,
        );
      }
    }

    const payload = getTrendingSearches({
      period,
      limit,
      includeZero,
      query,
    });

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      ...payload,
      servedBy: "node",
    });
  };
}

module.exports = {
  createSearchSourcesController,
  createSearchSuggestController,
  createSearchTrendingController,
};
