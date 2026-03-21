const express = require("express");

function createAdminIndexManagementRoutes({
  adminAuth,
  indexStatusController,
  indexRefreshController,
  indexBackupsController,
  indexRestoreController,
}) {
  const router = express.Router();
  router.get("/api/admin/index/status", adminAuth, indexStatusController);
  router.post("/api/admin/index/refresh", adminAuth, indexRefreshController);
  router.get("/api/admin/index/backups", adminAuth, indexBackupsController);
  router.post("/api/admin/index/restore", adminAuth, indexRestoreController);
  return router;
}

module.exports = {
  createAdminIndexManagementRoutes,
};
