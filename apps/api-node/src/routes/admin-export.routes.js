const express = require("express");

function createAdminExportRoutes({ adminAuth, adminExportCsvController }) {
  const router = express.Router();
  router.get("/api/admin/export.csv", adminAuth, adminExportCsvController);
  return router;
}

module.exports = {
  createAdminExportRoutes,
};
