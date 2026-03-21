const fs = require("fs");
const path = require("path");

function createAdminBackupsListController({
  isAllowedBackupReason,
  listBackups,
}) {
  return (req, res) => {
    const requestedReason = String(req.query.reason || "all").trim();
    const reasonFilter = requestedReason === "all" ? "all" : requestedReason;
    if (reasonFilter !== "all" && !isAllowedBackupReason(reasonFilter)) {
      res.status(400).json({ error: "Invalid backup reason filter." });
      return;
    }

    const allBackups = listBackups();
    const filteredBackups =
      reasonFilter === "all"
        ? allBackups
        : allBackups.filter((item) => item.reason === reasonFilter);

    res.json({
      generatedAt: new Date().toISOString(),
      reason: reasonFilter,
      backups: filteredBackups.slice(0, 100),
    });
  };
}

function createAdminBackupsDownloadController({
  backupDir,
  sanitizeBackupFileName,
}) {
  return (req, res) => {
    const fileName = sanitizeBackupFileName(req.query.fileName);
    if (!fileName) {
      res.status(400).json({ error: "Invalid backup file name." });
      return;
    }

    const sourcePath = path.join(backupDir, fileName);
    if (!fs.existsSync(sourcePath)) {
      res.status(404).json({ error: "Backup file not found." });
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${JSON.stringify(fileName)}`,
    );
    res.sendFile(sourcePath);
  };
}

function createAdminBackupsCreateController({ backupAnalytics, listBackups }) {
  return (_req, res) => {
    backupAnalytics("manual", { force: true });
    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      backups: listBackups().slice(0, 100),
    });
  };
}

function createAdminBackupsRestoreController({
  backupDir,
  sanitizeBackupFileName,
  analyticsPath,
  backupAnalytics,
}) {
  return (req, res) => {
    const fileName = sanitizeBackupFileName(req.body?.fileName);
    if (!fileName) {
      res.status(400).json({ error: "Invalid backup file name." });
      return;
    }

    const sourcePath = path.join(backupDir, fileName);
    if (!fs.existsSync(sourcePath)) {
      res.status(404).json({ error: "Backup file not found." });
      return;
    }

    backupAnalytics("pre-restore", { force: true });
    fs.copyFileSync(sourcePath, analyticsPath);
    backupAnalytics("restored", { force: true });

    res.json({
      ok: true,
      restoredFrom: fileName,
      generatedAt: new Date().toISOString(),
    });
  };
}

module.exports = {
  createAdminBackupsListController,
  createAdminBackupsDownloadController,
  createAdminBackupsCreateController,
  createAdminBackupsRestoreController,
};
