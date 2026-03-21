function createIndexSyncController({
  parseOptionalIsoDate,
  readDjangoIndexSyncState,
  writeDjangoIndexSyncState,
  toBearerToken,
  djangoAdminToken,
  executeDjangoIndexSync,
}) {
  return async (req, res) => {
    const source = String(req.body?.source || "")
      .trim()
      .toLowerCase();
    const statusFilter = String(req.body?.status || "indexed")
      .trim()
      .toLowerCase();
    const pageSize = Math.max(
      1,
      Math.min(
        500,
        Number.parseInt(String(req.body?.pageSize || "200"), 10) || 200,
      ),
    );
    const maxPages = Math.max(
      1,
      Math.min(
        300,
        Number.parseInt(String(req.body?.maxPages || "50"), 10) || 50,
      ),
    );
    const createBackup =
      req.body?.createBackup == null ? true : Boolean(req.body?.createBackup);
    const useWatermark = Boolean(req.body?.useWatermark);
    const resetWatermark = Boolean(req.body?.resetWatermark);
    const updatedSinceRaw = String(req.body?.updatedSince || "").trim();
    let updatedSince = updatedSinceRaw
      ? parseOptionalIsoDate(updatedSinceRaw)
      : null;
    let usedPersistedWatermark = false;

    const allowedStatuses = new Set(["indexed", "blocked", "error", "all"]);
    if (!allowedStatuses.has(statusFilter)) {
      res.status(400).json({
        error: "Invalid status. Allowed: indexed, blocked, error, all.",
      });
      return;
    }

    if (updatedSinceRaw && !updatedSince) {
      res.status(400).json({ error: "Invalid updatedSince ISO datetime." });
      return;
    }

    if (resetWatermark) {
      const syncState = readDjangoIndexSyncState();
      writeDjangoIndexSyncState({
        ...syncState,
        updatedSince: "",
      });
    }

    if (!updatedSince && useWatermark) {
      const syncState = readDjangoIndexSyncState();
      const persisted = parseOptionalIsoDate(syncState.updatedSince);
      if (persisted) {
        updatedSince = persisted;
        usedPersistedWatermark = true;
      }
    }

    const explicitDjangoToken = toBearerToken(
      req.body?.djangoToken || djangoAdminToken,
    );
    const forwardedAuthHeader = toBearerToken(req.headers.authorization || "");
    const djangoAuthHeader = explicitDjangoToken || forwardedAuthHeader;

    if (!djangoAuthHeader) {
      res.status(400).json({
        error:
          "Missing Django auth token. Provide body.djangoToken or DJANGO_ADMIN_TOKEN.",
      });
      return;
    }

    try {
      const result = await executeDjangoIndexSync({
        req,
        authHeader: djangoAuthHeader,
        source,
        statusFilter,
        pageSize,
        maxPages,
        createBackup,
        updatedSince,
        reason: "manual",
      });

      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        sync: {
          ...result.sync,
          useWatermark,
          resetWatermark,
          usedPersistedWatermark,
        },
        refresh: result.refresh,
        index: result.index,
        state: result.state,
      });
    } catch (error) {
      res.status(502).json({
        error: String(error?.message || "Django sync failed."),
        sync: {
          source: source || "all",
          status: statusFilter,
          updatedSince: updatedSince ? updatedSince.toISOString() : "",
          maxPages,
          pageSize,
        },
      });
    }
  };
}

function createIndexSyncResetWatermarkController({
  parseOptionalIsoDate,
  readDjangoIndexSyncState,
  writeDjangoIndexSyncState,
}) {
  return (req, res) => {
    const updatedSinceRaw = String(req.body?.updatedSince || "").trim();
    const updatedSince = updatedSinceRaw
      ? parseOptionalIsoDate(updatedSinceRaw)
      : null;

    if (updatedSinceRaw && !updatedSince) {
      res.status(400).json({ error: "Invalid updatedSince ISO datetime." });
      return;
    }

    const current = readDjangoIndexSyncState();
    const nextState = {
      ...current,
      updatedSince: updatedSince ? updatedSince.toISOString() : "",
      lastError: "",
    };
    writeDjangoIndexSyncState(nextState);

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      state: nextState,
    });
  };
}

function createIndexSyncStatusController({
  djangoSyncInFlight,
  djangoIndexSyncEnabled,
  djangoIndexSyncIntervalMs,
  djangoIndexSyncStartup,
  djangoIndexSyncMaxPages,
  djangoIndexSyncPageSize,
  djangoAdminToken,
  djangoSyncRuntime,
  readDjangoIndexSyncState,
}) {
  return (_req, res) => {
    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      running: djangoSyncInFlight,
      config: {
        enabled: djangoIndexSyncEnabled,
        intervalMs: djangoIndexSyncIntervalMs,
        startup: djangoIndexSyncStartup,
        defaultMaxPages: djangoIndexSyncMaxPages,
        defaultPageSize: djangoIndexSyncPageSize,
        hasDjangoAdminToken: Boolean(djangoAdminToken),
      },
      runtime: djangoSyncRuntime,
      state: readDjangoIndexSyncState(),
    });
  };
}

module.exports = {
  createIndexSyncController,
  createIndexSyncResetWatermarkController,
  createIndexSyncStatusController,
};
