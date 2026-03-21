const express = require("express");

function createAdminStatusRoutes({
  adminAuth,
  assistantStatusController,
  runtimeMetricsController,
  searchStatusController,
}) {
  const router = express.Router();
  router.get(
    "/api/admin/assistant-status",
    adminAuth,
    assistantStatusController,
  );
  router.get("/api/admin/runtime-metrics", adminAuth, runtimeMetricsController);
  router.get("/api/admin/search/status", adminAuth, searchStatusController);
  return router;
}

module.exports = {
  createAdminStatusRoutes,
};
