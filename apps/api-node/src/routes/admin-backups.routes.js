const express = require("express");

function createAdminBackupsRoutes({
  adminAuth,
  adminBackupsListController,
  adminBackupsDownloadController,
  adminBackupsCreateController,
  adminBackupsRestoreController,
}) {
  const router = express.Router();
  router.get("/api/admin/backups", adminAuth, adminBackupsListController);
  router.get(
    "/api/admin/backups/download",
    adminAuth,
    adminBackupsDownloadController,
  );
  router.post(
    "/api/admin/backups/create",
    adminAuth,
    adminBackupsCreateController,
  );
  router.post(
    "/api/admin/backups/restore",
    adminAuth,
    adminBackupsRestoreController,
  );
  return router;
}

module.exports = {
  createAdminBackupsRoutes,
};
