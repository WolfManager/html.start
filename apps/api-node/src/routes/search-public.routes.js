const express = require("express");

function createSearchPublicRoutes({
  searchSourcesController,
  searchSuggestController,
  searchTrendingController,
}) {
  const router = express.Router();
  router.get("/api/search/sources", searchSourcesController);
  router.get("/api/search/suggest", searchSuggestController);
  router.get("/api/search/trending", searchTrendingController);
  return router;
}

module.exports = {
  createSearchPublicRoutes,
};
