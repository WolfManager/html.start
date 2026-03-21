function createHealthController({
  port,
  loginWindowMs,
  loginRateLimitCount,
  lockoutThreshold,
  lockoutMs,
  adminWindowMs,
  adminRateLimitCount,
  backupMinIntervalMs,
  backupScheduleMs,
  maxBackupFiles,
  trendDailyPoints,
  trendWeeklyPoints,
}) {
  return (_req, res) => {
    res.json({
      ok: true,
      service: "magneto-search",
      timestamp: new Date().toISOString(),
      runtime: {
        port,
        loginWindowMinutes: Math.round(loginWindowMs / 60000),
        loginRateLimitCount,
        lockoutThreshold,
        lockoutMinutes: Math.round(lockoutMs / 60000),
        adminWindowSeconds: Math.round(adminWindowMs / 1000),
        adminRateLimitCount,
        backupMinIntervalMinutes: Math.round(backupMinIntervalMs / 60000),
        backupScheduleMinutes: Math.round(backupScheduleMs / 60000),
        maxBackupFiles,
        trendDailyPoints,
        trendWeeklyPoints,
      },
    });
  };
}

module.exports = {
  createHealthController,
};
