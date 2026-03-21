const express = require("express");

function createLocationRoutes({ locationAutoController }) {
  const router = express.Router();
  router.get("/api/location/auto", locationAutoController);
  return router;
}

module.exports = {
  createLocationRoutes,
};
