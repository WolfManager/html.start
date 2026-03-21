const express = require("express");

function createSearchRelatedRoutes({ searchRelatedController }) {
  const router = express.Router();
  router.get("/api/search/related", searchRelatedController);
  return router;
}

module.exports = {
  createSearchRelatedRoutes,
};
