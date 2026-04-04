const {
  assistantTtsRequestSchema,
  formatZodError,
} = require("../schemas/assistant.schemas");

function sanitizeAssistantTtsText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function createAssistantTtsController({
  assistantTtsEnabled,
  assistantTtsMaxChars,
  assistantTtsTimeoutMs,
  coquiTtsApiUrl,
  coquiTtsApiKey,
  coquiTtsApiKeyHeader,
  coquiTtsSpeaker,
  coquiTtsLanguage,
  coquiTtsModel,
}) {
  return async (req, res) => {
    if (!assistantTtsEnabled) {
      res.status(503).json({
        error: "Assistant voice is disabled on this server.",
      });
      return;
    }

    const parsedRequest = assistantTtsRequestSchema.safeParse(req.body || {});
    if (!parsedRequest.success) {
      res.status(400).json({ error: formatZodError(parsedRequest.error) });
      return;
    }

    const text = sanitizeAssistantTtsText(parsedRequest.data.text);
    const speakerOverride = parsedRequest.data.speaker
      ? String(parsedRequest.data.speaker).slice(0, 120).trim()
      : null;
    const languageOverride = parsedRequest.data.language
      ? String(parsedRequest.data.language).slice(0, 8).trim().toLowerCase()
      : null;

    if (text.length > assistantTtsMaxChars) {
      res.status(400).json({
        error: `Text too long. Max ${assistantTtsMaxChars} characters.`,
      });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      assistantTtsTimeoutMs,
    );

    try {
      const qp = new URLSearchParams({ text });
      const speakerId = speakerOverride || coquiTtsSpeaker;
      const languageId = languageOverride || coquiTtsLanguage;
      if (speakerId) qp.set("speaker_id", speakerId);
      if (languageId) qp.set("language_id", languageId);

      const headers = {};
      if (coquiTtsApiKey) {
        headers[String(coquiTtsApiKeyHeader || "X-API-Key")] =
          String(coquiTtsApiKey);
      }

      const response = await fetch(`${coquiTtsApiUrl}?${qp.toString()}`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        res.status(502).json({
          error:
            errorText.trim() ||
            `Coqui TTS request failed with status ${response.status}.`,
        });
        return;
      }

      const contentType = String(
        response.headers.get("content-type") || "audio/wav",
      ).toLowerCase();
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      res.json({
        ok: true,
        provider: "coqui-tts",
        mimeType: contentType.includes("audio/") ? contentType : "audio/wav",
        audioBase64: audioBuffer.toString("base64"),
      });
    } catch (error) {
      const isTimeout =
        String(error?.name || "").toLowerCase() === "aborterror";
      res.status(isTimeout ? 504 : 502).json({
        error: isTimeout
          ? "Coqui TTS request timed out."
          : "Coqui TTS service unavailable.",
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

module.exports = {
  createAssistantTtsController,
};
