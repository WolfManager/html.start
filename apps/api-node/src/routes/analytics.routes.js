const express = require("express");

function createAnalyticsRoutes({ popularSearchesController }) {
  const router = express.Router();
  router.get("/api/analytics/popular-searches", popularSearchesController);
  return router;
}

module.exports = {
  createAnalyticsRoutes,
};
