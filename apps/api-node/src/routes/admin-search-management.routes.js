const express = require("express");

function createAdminSearchManagementRoutes({
  adminAuth,
  rankingConfigGetController,
  rankingConfigPostController,
  rewriteRulesGetController,
  rewriteRulesPostController,
  rewriteRuleSuggestionsController,
  searchSeedController,
  searchCrawlController,
}) {
  const router = express.Router();
  router.get(
    "/api/admin/search/ranking-config",
    adminAuth,
    rankingConfigGetController,
  );
  router.post(
    "/api/admin/search/ranking-config",
    adminAuth,
    rankingConfigPostController,
  );
  router.get(
    "/api/admin/search/rewrite-rules",
    adminAuth,
    rewriteRulesGetController,
  );
  router.post(
    "/api/admin/search/rewrite-rules/update",
    adminAuth,
    rewriteRulesPostController,
  );
  router.get(
    "/api/admin/search/rewrite-rules/suggestions",
    adminAuth,
    rewriteRuleSuggestionsController,
  );
  router.post("/api/admin/search/seed", adminAuth, searchSeedController);
  router.post("/api/admin/search/crawl", adminAuth, searchCrawlController);
  return router;
}

module.exports = {
  createAdminSearchManagementRoutes,
};
