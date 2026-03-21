const express = require("express");

function createAuthRoutes({ loginController }) {
  const router = express.Router();
  router.post("/api/auth/login", loginController);
  return router;
}

module.exports = {
  createAuthRoutes,
};
