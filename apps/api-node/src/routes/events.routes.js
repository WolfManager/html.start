const express = require("express");

function createEventsRoutes({ pageViewController, resultClickController }) {
  const router = express.Router();
  router.post("/api/events/page-view", pageViewController);
  router.post("/api/events/result-click", resultClickController);
  return router;
}

module.exports = {
  createEventsRoutes,
};
