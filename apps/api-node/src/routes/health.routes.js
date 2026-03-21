const express = require("express");

function createHealthRoutes({ healthController }) {
  const router = express.Router();
  router.get("/api/health", healthController);
  return router;
}

module.exports = {
  createHealthRoutes,
};
