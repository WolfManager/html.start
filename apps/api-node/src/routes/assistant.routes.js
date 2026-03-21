const express = require("express");

function createAssistantRoutes({ assistantChatController }) {
  const router = express.Router();
  router.post("/api/assistant/chat", assistantChatController);
  return router;
}

module.exports = {
  createAssistantRoutes,
};
