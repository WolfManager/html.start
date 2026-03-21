(function initMagnetoAssistantApi(global) {
  const apiFetch = global.MagnetoApiClient?.apiFetch;

  async function requestAssistantChat(message, history) {
    if (typeof apiFetch !== "function") {
      throw new Error("Assistant API unavailable.");
    }

    const response = await apiFetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Assistant request failed.");
    }

    return payload;
  }

  global.MagnetoAssistantApi = {
    requestAssistantChat,
  };
})(window);
