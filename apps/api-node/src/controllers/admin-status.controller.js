function createAssistantStatusController({
  getAssistantMemorySummary,
  aiRoutingMode,
  aiPrimaryProvider,
  aiFallbackProvider,
  openaiApiKey,
  anthropicApiKey,
  geminiApiKey,
  ollamaEnabled,
  ollamaBaseUrl,
  litellmEnabled,
  litellmBaseUrl,
  litellmApiKey,
  openaiModel,
  anthropicModel,
  geminiModel,
  ollamaModel,
  litellmModel,
  getActiveProviderModel,
  openaiModelCandidates,
  anthropicModelCandidates,
  geminiModelCandidates,
  ollamaModelCandidates,
  litellmModelCandidates,
  assistantProviderHealthMap,
  assistantWindowMs,
  assistantRateLimitCount,
  assistantMaxChars,
  assistantHistoryMessages,
  assistantHistoryChars,
  assistantReplyMaxChars,
  assistantModelTemperature,
  assistantOpenaiMaxTokens,
  assistantAnthropicMaxTokens,
  assistantGeminiMaxTokens,
  assistantOllamaMaxTokens,
  assistantLitellmMaxTokens,
  assistantSimpleQueryWords,
  assistantCacheTtlMs,
  assistantCacheMaxEntries,
  assistantCacheMap,
  assistantMemoryMaxItems,
  assistantMetrics,
}) {
  return (_req, res) => {
    const memory = getAssistantMemorySummary();
    const providers = {
      routingMode: aiRoutingMode,
      primary: aiPrimaryProvider,
      fallback: aiFallbackProvider,
      configured: {
        openai: Boolean(openaiApiKey),
        anthropic: Boolean(anthropicApiKey),
        gemini: Boolean(geminiApiKey),
        ollama: Boolean(ollamaEnabled && ollamaBaseUrl && ollamaModel),
        litellm: Boolean(litellmEnabled && litellmBaseUrl && litellmApiKey),
      },
      endpoints: {
        ollamaBaseUrl: String(ollamaBaseUrl || ""),
        litellmBaseUrl: String(litellmBaseUrl || ""),
      },
      models: {
        openai: openaiModel,
        anthropic: anthropicModel,
        gemini: geminiModel,
        ollama: ollamaModel,
        litellm: litellmModel,
      },
      activeModels: {
        openai: getActiveProviderModel("openai") || openaiModel,
        anthropic: getActiveProviderModel("anthropic") || anthropicModel,
        gemini: getActiveProviderModel("gemini") || geminiModel,
        ollama: getActiveProviderModel("ollama") || ollamaModel,
        litellm: getActiveProviderModel("litellm") || litellmModel,
      },
      modelCandidates: {
        openai: openaiModelCandidates,
        anthropic: anthropicModelCandidates,
        gemini: geminiModelCandidates,
        ollama: ollamaModelCandidates,
        litellm: litellmModelCandidates,
      },
      health: Object.fromEntries(assistantProviderHealthMap.entries()),
    };
    const anyProviderConfigured = Object.values(providers.configured).some(
      Boolean,
    );

    res.json({
      generatedAt: new Date().toISOString(),
      assistant: {
        configured: anyProviderConfigured,
        model: `${providers.primary}:${providers.models[providers.primary] || openaiModel}`,
        providers,
        limits: {
          windowSeconds: Math.round(assistantWindowMs / 1000),
          rateLimitCount: assistantRateLimitCount,
          maxChars: assistantMaxChars,
          historyMessages: assistantHistoryMessages,
          historyChars: assistantHistoryChars,
          replyMaxChars: assistantReplyMaxChars,
          modelTemperature: assistantModelTemperature,
          providerMaxTokens: {
            openai: assistantOpenaiMaxTokens,
            anthropic: assistantAnthropicMaxTokens,
            gemini: assistantGeminiMaxTokens,
            ollama: assistantOllamaMaxTokens,
            litellm: assistantLitellmMaxTokens,
          },
          simpleQueryWords: assistantSimpleQueryWords,
        },
        cache: {
          ttlSeconds: Math.round(assistantCacheTtlMs / 1000),
          maxEntries: assistantCacheMaxEntries,
          currentEntries: assistantCacheMap.size,
        },
        memory: {
          path: "data/assistant-memory.json",
          ...memory,
          maxItems: assistantMemoryMaxItems,
        },
        metrics: assistantMetrics,
        billing: {
          note: "Billing and quota are managed separately for each AI provider account.",
          openai: {
            overviewUrl:
              "https://platform.openai.com/settings/organization/billing/overview",
            usageUrl: "https://platform.openai.com/usage",
          },
          anthropic: {
            overviewUrl: "https://console.anthropic.com/settings/plans",
            usageUrl: "https://console.anthropic.com/settings/usage",
          },
          gemini: {
            overviewUrl: "https://aistudio.google.com/",
            usageUrl:
              "https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas",
          },
        },
      },
    });
  };
}

function createRuntimeMetricsController({
  assistantCacheMap,
  assistantContextMap,
  assistantProviderHealthMap,
  assistantProviderModelStateMap,
  assistantMetrics,
  loginAttemptMap,
  adminRateMap,
  assistantRateMap,
}) {
  return (_req, res) => {
    const memory = process.memoryUsage();
    const toMb = (bytes) =>
      Math.round((Number(bytes || 0) / (1024 * 1024)) * 100) / 100;

    res.json({
      generatedAt: new Date().toISOString(),
      runtime: {
        process: {
          nodeVersion: process.version,
          platform: process.platform,
          pid: process.pid,
          uptimeSeconds: Math.round(process.uptime()),
        },
        memory: {
          rssMb: toMb(memory.rss),
          heapTotalMb: toMb(memory.heapTotal),
          heapUsedMb: toMb(memory.heapUsed),
          externalMb: toMb(memory.external),
          arrayBuffersMb: toMb(memory.arrayBuffers),
        },
        assistant: {
          cacheEntries: assistantCacheMap.size,
          contextEntries: assistantContextMap.size,
          providerHealthEntries: assistantProviderHealthMap.size,
          modelStateEntries: assistantProviderModelStateMap.size,
          metrics: assistantMetrics,
        },
        rateLimitMaps: {
          loginAttempts: loginAttemptMap.size,
          admin: adminRateMap.size,
          assistant: assistantRateMap.size,
        },
      },
    });
  };
}

function createSearchStatusController({
  getSearchIndexStats,
  buildAdminSearchLatestRunSummary,
  getSearchRankingConfig,
  getQueryRewriteRules,
}) {
  return (_req, res) => {
    const indexStats = getSearchIndexStats();
    const latestRun = buildAdminSearchLatestRunSummary();
    const rankingConfig = getSearchRankingConfig();
    const rewriteRules = getQueryRewriteRules();
    const sourceCount = Array.isArray(indexStats.topSources)
      ? indexStats.topSources.length
      : 0;

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      search: {
        sources: {
          active: sourceCount,
          total: sourceCount,
        },
        documents: {
          indexed: Number(indexStats.totalDocs || 0),
          blocked: 0,
          errors: 0,
        },
        blockRules: 0,
        latestRun,
        recentRuns: latestRun.startedAt ? [latestRun] : [],
        rankingConfig,
        rewriteRules: {
          enabled: rewriteRules.filter((rule) => Boolean(rule?.enabled)).length,
          total: rewriteRules.length,
        },
      },
    });
  };
}

module.exports = {
  createAssistantStatusController,
  createRuntimeMetricsController,
  createSearchStatusController,
};
