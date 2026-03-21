(function initMagnetoAdminApi(global) {
  const apiFetch = global.MagnetoApiClient?.apiFetch;
  const getAdminToken = global.MagnetoAdminState?.getAdminToken;

  function resolveToken() {
    if (typeof getAdminToken === "function") {
      return getAdminToken();
    }

    return "";
  }

  async function fetchAdminOverview(range = "all") {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const params = new URLSearchParams({ range });
    const response = await apiFetch(
      `/api/admin/overview?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load admin data.");
    }

    return payload;
  }

  async function exportAdminCsv(range = "all") {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const params = new URLSearchParams({ range });
    const response = await apiFetch(
      `/api/admin/export.csv?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Could not export CSV.");
    }

    const blob = await response.blob();
    const url = global.URL.createObjectURL(blob);
    const link = global.document.createElement("a");
    link.href = url;
    link.download = `magneto-analytics-${range}.csv`;
    global.document.body.appendChild(link);
    link.click();
    link.remove();
    global.URL.revokeObjectURL(url);
  }

  async function resetClickSignalTelemetry() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/click-signal/reset", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Could not reset click telemetry.");
    }

    return payload;
  }

  async function snapshotAndResetClickSignalTelemetry() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/click-signal/snapshot-reset", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        payload.error || "Could not snapshot and reset telemetry.",
      );
    }

    return payload;
  }

  async function fetchAdminBackups(reason = "all") {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const params = new URLSearchParams({ reason });
    const response = await apiFetch(`/api/admin/backups?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load backup list.");
    }

    return payload.backups || [];
  }

  async function downloadBackupFile(fileName) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const params = new URLSearchParams({ fileName });
    const response = await apiFetch(
      `/api/admin/backups/download?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Could not download backup.");
    }

    const blob = await response.blob();
    const url = global.URL.createObjectURL(blob);
    const link = global.document.createElement("a");
    link.href = url;
    link.download = fileName;
    global.document.body.appendChild(link);
    link.click();
    link.remove();
    global.URL.revokeObjectURL(url);
  }

  async function createBackupNow() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/backups/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not create backup.");
    }

    return payload.backups || [];
  }

  async function restoreBackup(fileName) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/backups/restore", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileName }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not restore backup.");
    }

    return payload;
  }

  async function fetchAdminRouting() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/routing", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load routing state.");
    }
    return payload;
  }

  async function postAdminRouting(update) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/routing", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(update),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not update routing.");
    }
    return payload;
  }

  async function fetchAdminRoutingVerify() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/routing/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Routing verify failed.");
    }
    return payload;
  }

  async function fetchAdminAssistantStatus() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/assistant-status", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load assistant status.");
    }

    return payload;
  }

  async function fetchAdminRuntimeMetrics() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/runtime-metrics", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load runtime metrics.");
    }

    return payload;
  }

  async function fetchAdminSearchStatus() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/search/status", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load search engine status.");
    }

    return payload;
  }

  async function fetchAdminRankingConfig() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/search/ranking-config", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load ranking config.");
    }

    return payload;
  }

  async function postAdminRankingConfig({
    rankingConfig = null,
    reset = false,
  }) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/search/ranking-config", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reset: Boolean(reset),
        rankingConfig: rankingConfig || undefined,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not update ranking config.");
    }

    return payload;
  }

  async function fetchAdminRewriteRules() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/search/rewrite-rules", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load rewrite rules.");
    }

    return payload;
  }

  async function postAdminRewriteRules({ rewriteRules = null, reset = false }) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/search/rewrite-rules/update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reset: Boolean(reset),
        rewriteRules: Array.isArray(rewriteRules) ? rewriteRules : undefined,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not update rewrite rules.");
    }

    return payload;
  }

  async function fetchAdminRewriteRuleSuggestions(
    limit = 10,
    minConfidence = 0,
  ) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const query = new URLSearchParams({
      limit: String(limit),
      minConfidence: String(minConfidence),
    });
    const response = await apiFetch(
      `/api/admin/search/rewrite-rules/suggestions?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        payload.error || "Could not load rewrite rule suggestions.",
      );
    }

    return payload;
  }

  async function postAdminSearchSeed(force = false) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/search/seed", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ force: Boolean(force) }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not seed search sources.");
    }

    return payload;
  }

  async function postAdminSearchCrawl({
    sourceIds = [],
    maxPages = null,
  } = {}) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const body = {};
    if (Array.isArray(sourceIds) && sourceIds.length > 0) {
      body.sourceIds = sourceIds;
    }
    if (Number.isFinite(Number(maxPages)) && Number(maxPages) > 0) {
      body.maxPages = Number(maxPages);
    }

    const response = await apiFetch("/api/admin/search/crawl", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not start search crawl.");
    }

    return payload;
  }

  async function fetchAdminIndexStatus() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/index/status", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load local index status.");
    }

    return payload;
  }

  async function postAdminIndexRefresh(body = {}) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/index/refresh", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not rebuild local index.");
    }

    return payload;
  }

  async function fetchAdminIndexBackups(reason = "all") {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const params = new URLSearchParams({ reason });
    const response = await apiFetch(
      `/api/admin/index/backups?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load local index backups.");
    }

    return payload;
  }

  async function postAdminIndexRestore(body = {}) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/index/restore", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not restore local index backup.");
    }

    return payload;
  }

  async function fetchAdminIndexSyncStatus() {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/index/sync-status", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load index sync status.");
    }

    return payload;
  }

  async function postAdminIndexSync(body = {}) {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/index/sync-django", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not run index sync.");
    }

    return payload;
  }

  async function postAdminIndexSyncResetWatermark(updatedSince = "") {
    if (typeof apiFetch !== "function") {
      throw new Error("Admin API unavailable.");
    }

    const token = resolveToken();
    const response = await apiFetch("/api/admin/index/sync-reset-watermark", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ updatedSince: String(updatedSince || "").trim() }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not reset sync watermark.");
    }

    return payload;
  }

  global.MagnetoAdminApi = {
    fetchAdminOverview,
    exportAdminCsv,
    resetClickSignalTelemetry,
    snapshotAndResetClickSignalTelemetry,
    fetchAdminBackups,
    downloadBackupFile,
    createBackupNow,
    restoreBackup,
    fetchAdminAssistantStatus,
    fetchAdminRuntimeMetrics,
    fetchAdminSearchStatus,
    fetchAdminRankingConfig,
    postAdminRankingConfig,
    fetchAdminRewriteRules,
    postAdminRewriteRules,
    fetchAdminRewriteRuleSuggestions,
    postAdminSearchSeed,
    postAdminSearchCrawl,
    fetchAdminIndexStatus,
    postAdminIndexRefresh,
    fetchAdminIndexBackups,
    postAdminIndexRestore,
    fetchAdminIndexSyncStatus,
    postAdminIndexSync,
    postAdminIndexSyncResetWatermark,
    fetchAdminRouting,
    postAdminRouting,
    fetchAdminRoutingVerify,
  };
})(window);
