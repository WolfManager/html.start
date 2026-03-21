const express = require("express");

function createAdminOverviewRoutes({
  adminAuth,
  adminOverviewController,
  clickSignalResetController,
  clickSignalSnapshotResetController,
}) {
  const router = express.Router();
  router.get("/api/admin/overview", adminAuth, adminOverviewController);
  router.post(
    "/api/admin/click-signal/reset",
    adminAuth,
    clickSignalResetController,
  );
  router.post(
    "/api/admin/click-signal/snapshot-reset",
    adminAuth,
    clickSignalSnapshotResetController,
  );
  return router;
}

module.exports = {
  createAdminOverviewRoutes,
};
