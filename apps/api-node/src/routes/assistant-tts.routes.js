const express = require("express");

function createAssistantTtsRoutes({ assistantTtsController }) {
  const router = express.Router();
  router.post("/api/assistant/tts", assistantTtsController);
  return router;
}

module.exports = {
  createAssistantTtsRoutes,
};
