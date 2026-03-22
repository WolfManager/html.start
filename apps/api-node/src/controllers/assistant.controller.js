function createAssistantChatController({
  checkAssistantRateLimit,
  assistantMetrics,
  getClientIp,
  classifyAssistantHelper,
  assistantMaxChars,
  normalizeAssistantQueryKey,
  isWeatherAssistantQuery,
  isDateOrNewsAssistantQuery,
  buildWeatherAssistantResponse,
  markIpWeatherContext,
  setAssistantCacheEntry,
  storeAssistantMemory,
  incrementMetricCounter,
  buildDateNewsAssistantResponse,
  getAssistantCacheEntry,
  isSimpleAssistantQuery,
  buildRuleBasedAssistantResponse,
  generateAssistantResponse,
}) {
  return async (req, res) => {
    if (!checkAssistantRateLimit(req, res)) {
      return;
    }

    assistantMetrics.requestsTotal += 1;

    const ip = getClientIp(req);
    const message = String(req.body?.message || "").trim();
    const history = req.body?.history;
    const helper = classifyAssistantHelper(message);

    if (!message) {
      res.status(400).json({ error: "Message is required." });
      return;
    }

    if (message.length > assistantMaxChars) {
      res.status(400).json({
        error: `Message too long. Max ${assistantMaxChars} characters.`,
      });
      return;
    }

    const cacheKey = normalizeAssistantQueryKey(message);
    const weatherIntent = isWeatherAssistantQuery(message, history, ip);
    const dateNewsIntent = isDateOrNewsAssistantQuery(message);

    // Weather intent has priority over stale generic cache entries.
    if (weatherIntent) {
      try {
        const weather = await buildWeatherAssistantResponse(message, ip);
        assistantMetrics.localHybridResponses += 1;
        markIpWeatherContext(ip);
        setAssistantCacheEntry(cacheKey, {
          model: "weather-live",
          helper: "weather",
          reply: weather.reply,
          suggestions: weather.suggestions,
        });
        storeAssistantMemory({
          ip,
          message,
          reply: weather.reply,
          provider: "weather-live",
          helper: "weather",
          model: "weather-live",
        });
        incrementMetricCounter(assistantMetrics.providerCounts, "weather-live");
        incrementMetricCounter(assistantMetrics.helperCounts, "weather");
        res.json({
          ok: true,
          provider: "weather-live",
          model: "weather-live",
          helper: "weather",
          reply: weather.reply,
          suggestions: weather.suggestions,
        });
        return;
      } catch {
        // Continue normal assistant flow (AI/fallback) if weather providers are unavailable.
      }
    }

    if (dateNewsIntent.enabled) {
      const dateNews = await buildDateNewsAssistantResponse(message);
      assistantMetrics.localHybridResponses += 1;
      setAssistantCacheEntry(cacheKey, {
        model: "date-news-live",
        helper: "general",
        reply: dateNews.reply,
        suggestions: dateNews.suggestions,
      });
      storeAssistantMemory({
        ip,
        message,
        reply: dateNews.reply,
        provider: "date-news-live",
        helper: "general",
        model: "date-news-live",
      });
      incrementMetricCounter(assistantMetrics.providerCounts, "date-news-live");
      incrementMetricCounter(assistantMetrics.helperCounts, "general");
      res.json({
        ok: true,
        provider: "date-news-live",
        model: "date-news-live",
        helper: "general",
        reply: dateNews.reply,
        suggestions: dateNews.suggestions,
      });
      return;
    }

    const cached = getAssistantCacheEntry(cacheKey);
    if (cached) {
      const isStaleGenericRuleReply =
        String(cached.model || "") === "rule-based" &&
        String(cached.reply || "").trim() ===
          "Good topic. Here are refined search options.";
      const isRuleBasedForNonSimplePrompt =
        String(cached.model || "") === "rule-based" &&
        !isSimpleAssistantQuery(message);

      if (isStaleGenericRuleReply || isRuleBasedForNonSimplePrompt) {
        // Ignore stale legacy fallback cache entries and regenerate response.
      } else {
        assistantMetrics.cacheHits += 1;
        storeAssistantMemory({
          ip,
          message,
          reply: cached.reply,
          provider: "cache",
          helper: cached.helper || helper,
          model: cached.model || "hybrid",
        });
        incrementMetricCounter(assistantMetrics.providerCounts, "cache");
        incrementMetricCounter(
          assistantMetrics.helperCounts,
          cached.helper || helper,
        );
        res.json({
          ok: true,
          provider: "cache",
          model: cached.model || "hybrid",
          helper: cached.helper || helper,
          reply: cached.reply,
          suggestions: cached.suggestions,
        });
        return;
      }
    }

    if (isSimpleAssistantQuery(message)) {
      assistantMetrics.localHybridResponses += 1;
      const localHelper = helper === "writing" ? "writing" : "general";
      const local = buildRuleBasedAssistantResponse(message);
      setAssistantCacheEntry(cacheKey, {
        model: "rule-based",
        helper: localHelper,
        reply: local.reply,
        suggestions: local.suggestions,
      });
      storeAssistantMemory({
        ip,
        message,
        reply: local.reply,
        provider: "local-hybrid",
        helper: localHelper,
        model: "rule-based",
      });
      incrementMetricCounter(assistantMetrics.providerCounts, "local-hybrid");
      incrementMetricCounter(assistantMetrics.helperCounts, localHelper);
      res.json({
        ok: true,
        provider: "local-hybrid",
        model: "rule-based",
        helper: localHelper,
        reply: local.reply,
        suggestions: local.suggestions,
      });
      return;
    }

    try {
      const ai = await generateAssistantResponse({ message, history, helper });
      const suggestions =
        ai.suggestions.length > 0
          ? ai.suggestions
          : [`${message} guide`, `${message} 2026`, `${message} explained`];

      if (ai.provider === "openai") {
        assistantMetrics.openaiResponses += 1;
      } else if (ai.provider === "anthropic") {
        assistantMetrics.anthropicResponses += 1;
      } else if (ai.provider === "gemini") {
        assistantMetrics.geminiResponses += 1;
      } else {
        assistantMetrics.localHybridResponses += 1;
      }
      incrementMetricCounter(assistantMetrics.providerCounts, ai.provider);
      incrementMetricCounter(assistantMetrics.helperCounts, helper);
      setAssistantCacheEntry(cacheKey, {
        model: ai.model,
        helper,
        reply: ai.reply,
        suggestions,
      });
      storeAssistantMemory({
        ip,
        message,
        reply: ai.reply,
        provider: ai.provider,
        helper,
        model: ai.model,
      });

      res.json({
        ok: true,
        provider: ai.provider,
        model: ai.model,
        helper,
        reply: ai.reply,
        suggestions,
      });
    } catch (error) {
      assistantMetrics.fallbackResponses += 1;
      assistantMetrics.lastProviderError = String(
        error?.message || "Assistant provider unavailable.",
      );
      assistantMetrics.lastProviderErrorAt = new Date().toISOString();

      const fallback = buildRuleBasedAssistantResponse(message);
      storeAssistantMemory({
        ip,
        message,
        reply: fallback.reply,
        provider: "fallback",
        helper,
        model: "rule-based",
      });
      incrementMetricCounter(assistantMetrics.providerCounts, "fallback");
      incrementMetricCounter(assistantMetrics.helperCounts, helper);

      res.json({
        ok: true,
        provider: "fallback",
        model: "rule-based",
        helper,
        reply: fallback.reply,
        suggestions: fallback.suggestions,
        warning: String(error?.message || "Assistant provider unavailable."),
      });
    }
  };
}

module.exports = {
  createAssistantChatController,
};
