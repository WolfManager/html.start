const express = require("express");

function createAdminIndexSyncRoutes({
  adminAuth,
  indexSyncController,
  indexSyncResetWatermarkController,
  indexSyncStatusController,
}) {
  const router = express.Router();
  router.post("/api/admin/index/sync-django", adminAuth, indexSyncController);
  router.post(
    "/api/admin/index/sync-reset-watermark",
    adminAuth,
    indexSyncResetWatermarkController,
  );
  router.get(
    "/api/admin/index/sync-status",
    adminAuth,
    indexSyncStatusController,
  );
  return router;
}

module.exports = {
  createAdminIndexSyncRoutes,
};
