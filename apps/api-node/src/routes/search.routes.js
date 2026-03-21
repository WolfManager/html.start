const express = require("express");

function createSearchRoutes({ searchController }) {
  const router = express.Router();
  router.get("/api/search", searchController);
  return router;
}

module.exports = {
  createSearchRoutes,
};
