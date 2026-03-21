function createIndexStatusController({ getSearchIndexStats }) {
  return (_req, res) => {
    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      index: getSearchIndexStats(),
    });
  };
}

function createIndexRefreshController({
  rebuildLocalSearchIndex,
  getSearchIndexStats,
}) {
  return (req, res) => {
    const mergeDocs = Array.isArray(req.body?.mergeDocs)
      ? req.body.mergeDocs
      : [];
    const createBackup =
      req.body?.createBackup == null ? true : Boolean(req.body?.createBackup);

    if (mergeDocs.length > 2000) {
      res.status(400).json({
        error: "Too many mergeDocs items in one request. Max is 2000.",
      });
      return;
    }

    try {
      const refresh = rebuildLocalSearchIndex({
        mergeDocs,
        createBackup,
      });

      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        refresh,
        index: getSearchIndexStats(),
      });
    } catch (error) {
      res.status(500).json({
        error: String(
          error?.message || "Could not refresh local search index.",
        ),
      });
    }
  };
}

function createIndexBackupsController({ listSearchIndexBackups }) {
  return (req, res) => {
    const requestedReason = String(req.query.reason || "all")
      .trim()
      .toLowerCase();
    const backups = listSearchIndexBackups();
    const filtered =
      requestedReason && requestedReason !== "all"
        ? backups.filter(
            (item) =>
              String(item.reason || "").toLowerCase() === requestedReason,
          )
        : backups;

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      reason: requestedReason || "all",
      total: filtered.length,
      backups: filtered.slice(0, 200),
    });
  };
}

function createIndexRestoreController({
  sanitizeSearchIndexBackupFileName,
  restoreSearchIndexFromBackup,
  getSearchIndexStats,
}) {
  return (req, res) => {
    const fileName = sanitizeSearchIndexBackupFileName(req.body?.fileName);
    if (!fileName) {
      res.status(400).json({ error: "Invalid search-index backup file name." });
      return;
    }

    const createBackup =
      req.body?.createBackup == null ? true : Boolean(req.body?.createBackup);

    try {
      const restore = restoreSearchIndexFromBackup(fileName, { createBackup });
      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        restore,
        index: getSearchIndexStats(),
      });
    } catch (error) {
      const message = String(
        error?.message || "Could not restore search index.",
      );
      if (/not found/i.test(message)) {
        res.status(404).json({ error: message });
        return;
      }
      res.status(400).json({ error: message });
    }
  };
}

module.exports = {
  createIndexStatusController,
  createIndexRefreshController,
  createIndexBackupsController,
  createIndexRestoreController,
};
