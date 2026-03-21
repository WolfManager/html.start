function createRankingConfigGetController({ getSearchRankingConfig }) {
  return (_req, res) => {
    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      rankingConfig: getSearchRankingConfig(),
    });
  };
}

function createRankingConfigPostController({
  resetSearchRankingConfig,
  writeSearchRankingConfig,
}) {
  return (req, res) => {
    const shouldReset = Boolean(req.body?.reset);

    try {
      const rankingConfig = shouldReset
        ? resetSearchRankingConfig()
        : writeSearchRankingConfig(req.body?.rankingConfig || {});
      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        rankingConfig,
      });
    } catch (error) {
      res.status(400).json({
        error: String(error?.message || "Could not update ranking config."),
      });
    }
  };
}

function createRewriteRulesGetController({ getQueryRewriteRules }) {
  return (_req, res) => {
    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      rewriteRules: getQueryRewriteRules(),
    });
  };
}

function createRewriteRulesPostController({
  resetQueryRewriteRules,
  writeQueryRewriteRules,
}) {
  return (req, res) => {
    const shouldReset = Boolean(req.body?.reset);

    try {
      const rewriteRules = shouldReset
        ? resetQueryRewriteRules()
        : writeQueryRewriteRules((req.body || {}).rewriteRules || []);
      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        rewriteRules,
      });
    } catch (error) {
      res.status(400).json({
        error: String(error?.message || "Could not update rewrite rules."),
      });
    }
  };
}

function createRewriteRuleSuggestionsController({
  buildRewriteRuleSuggestions,
}) {
  return (req, res) => {
    const limitRaw = String(req.query.limit || "").trim();
    const limit = Number.parseInt(limitRaw, 10);
    const minConfidenceRaw = String(req.query.minConfidence || "").trim();
    let minConfidence = 0;

    if (minConfidenceRaw) {
      minConfidence = Number(minConfidenceRaw);
      if (!Number.isFinite(minConfidence)) {
        res.status(400).json({ error: "Invalid minConfidence value." });
        return;
      }
    }

    if (minConfidence < 0 || minConfidence > 0.99) {
      res
        .status(400)
        .json({ error: "minConfidence must be between 0 and 0.99." });
      return;
    }

    const suggestions = buildRewriteRuleSuggestions({
      limit: Number.isFinite(limit) ? limit : 10,
      minConfidence,
    });

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      suggestions,
      total: suggestions.length,
      minConfidence,
    });
  };
}

function createSearchSeedController({
  djangoAdminToken,
  toBearerToken,
  executeDjangoIndexSync,
  djangoIndexSyncPageSize,
  djangoIndexSyncMaxPages,
}) {
  return async (req, res) => {
    const authHeader =
      toBearerToken(djangoAdminToken) ||
      toBearerToken(req.headers.authorization || "");
    if (!authHeader) {
      res.status(400).json({
        error:
          "Missing Django auth token. Set DJANGO_ADMIN_TOKEN or provide Authorization header.",
      });
      return;
    }

    try {
      const result = await executeDjangoIndexSync({
        req,
        authHeader,
        source: "",
        statusFilter: "indexed",
        pageSize: djangoIndexSyncPageSize,
        maxPages: Math.max(5, djangoIndexSyncMaxPages),
        createBackup: true,
        updatedSince: null,
        reason: "seed",
      });

      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        seed: result.sync,
        refresh: result.refresh,
        index: result.index,
      });
    } catch (error) {
      res.status(502).json({
        error: String(error?.message || "Could not seed search sources."),
      });
    }
  };
}

function createSearchCrawlController({
  djangoAdminToken,
  toBearerToken,
  executeDjangoIndexSync,
  djangoIndexSyncPageSize,
  djangoIndexSyncMaxPages,
}) {
  return async (req, res) => {
    const authHeader =
      toBearerToken(djangoAdminToken) ||
      toBearerToken(req.headers.authorization || "");
    if (!authHeader) {
      res.status(400).json({
        error:
          "Missing Django auth token. Set DJANGO_ADMIN_TOKEN or provide Authorization header.",
      });
      return;
    }

    const maxPages = Math.max(
      1,
      Math.min(
        300,
        Number.parseInt(
          String(req.body?.maxPages || djangoIndexSyncMaxPages),
          10,
        ) || djangoIndexSyncMaxPages,
      ),
    );

    try {
      const result = await executeDjangoIndexSync({
        req,
        authHeader,
        source: "",
        statusFilter: "indexed",
        pageSize: djangoIndexSyncPageSize,
        maxPages,
        createBackup: true,
        updatedSince: null,
        reason: "crawl",
      });

      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        crawl: result.sync,
        refresh: result.refresh,
        index: result.index,
      });
    } catch (error) {
      res.status(502).json({
        error: String(error?.message || "Could not start search crawl."),
      });
    }
  };
}

module.exports = {
  createRankingConfigGetController,
  createRankingConfigPostController,
  createRewriteRulesGetController,
  createRewriteRulesPostController,
  createRewriteRuleSuggestionsController,
  createSearchSeedController,
  createSearchCrawlController,
};
