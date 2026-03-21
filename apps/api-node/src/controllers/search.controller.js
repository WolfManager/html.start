function createSearchController({
  pickSearchBackend,
  makeSearchCacheKey,
  getFromSearchCache,
  proxyDjangoSearch,
  runSearchPage,
  logSearch,
  getAppliedSearchOperators,
  getSearchSuggestions,
  getRelatedQueries,
  setInSearchCache,
}) {
  return async (req, res) => {
    const query = String(req.query.q || req.query.query || "").trim();

    if (!query) {
      res.status(400).json({ error: "Query is required." });
      return;
    }

    const language = String(req.query.language || "").trim();
    const category = String(req.query.category || "").trim();
    const source = String(req.query.source || "").trim();
    const sort = String(req.query.sort || "relevance").trim() || "relevance";
    const limit = String(req.query.limit || "").trim();
    const page = String(req.query.page || "").trim();

    // Fast cache path: only for Node-served results (not Django proxy).
    if (pickSearchBackend() !== "django") {
      const earlyCacheKey = makeSearchCacheKey(query, {
        language,
        category,
        source,
        sort,
        limit,
        page,
      });
      const cached = getFromSearchCache(earlyCacheKey);
      if (cached) {
        return res.json({ ...cached, fromCache: true });
      }
    }

    if (pickSearchBackend() === "django") {
      try {
        const payload = await proxyDjangoSearch(
          "/api/search",
          {
            q: query,
            language,
            category,
            source,
            sort,
            limit,
            page,
          },
          req,
        );

        res.json({
          ...payload,
          servedBy: "django",
        });
        return;
      } catch (error) {
        console.warn(
          `[search] Django search proxy failed, falling back to Node: ${String(error?.message || error)}`,
        );
      }
    }

    const payload = runSearchPage(query, {
      language,
      category,
      source,
      sort,
      limit,
      page,
    });

    logSearch({
      query,
      resultCount: payload.total,
      ip: req.ip,
    });

    const cacheKey = makeSearchCacheKey(query, {
      language,
      category,
      source,
      sort,
      limit: payload.limit,
      page: payload.page,
    });

    const responsePayload = {
      engine: "MAGNETO Core",
      query,
      queryUsed: payload.queryUsed || query,
      appliedOperators: getAppliedSearchOperators(payload.queryUsed || query),
      queryCorrection: payload.queryCorrection || null,
      querySuggestion: payload.querySuggestion || null,
      suggestions:
        payload.total > 0
          ? []
          : getSearchSuggestions(payload.queryUsed || query, 8),
      relatedQueries: getRelatedQueries(query, 6),
      total: payload.total,
      appliedFilters: {
        language,
        category,
        source,
        sort,
        limit: payload.limit,
        page: payload.page,
      },
      pagination: {
        page: payload.page,
        pageSize: payload.limit,
        offset: payload.offset,
        total: payload.total,
        totalPages: payload.totalPages,
        hasNextPage: payload.hasNextPage,
        hasPrevPage: payload.hasPrevPage,
        nextPage: payload.hasNextPage ? payload.page + 1 : null,
        prevPage: payload.hasPrevPage ? payload.page - 1 : null,
      },
      facets: payload.facets,
      results: payload.results,
      servedBy: "node",
    };

    setInSearchCache(cacheKey, responsePayload);
    res.json(responsePayload);
  };
}

module.exports = {
  createSearchController,
};
