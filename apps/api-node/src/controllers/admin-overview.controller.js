function createAdminOverviewController({
  readJson,
  analyticsPath,
  parseRangeToSince,
  filterByDateRange,
  buildOverview,
  getPeriodComparison,
  clickSignalWindowDays,
  clickSignalDecayHalfLifeDays,
  clickSignalDecayMinWeight,
  clickSignalMaxBoost,
  clickSignalCtrMaxBoost,
  clickSignalGuardrailMinBaseScore,
  clickSignalGuardrailMaxShare,
  clickSignalDedupWindowMs,
  getClickSignalTelemetry,
}) {
  return (req, res) => {
    const analytics = readJson(analyticsPath, {
      searches: [],
      pageViews: [],
      resultClicks: [],
    });
    const allSearches = Array.isArray(analytics.searches)
      ? analytics.searches
      : [];
    const allPageViews = Array.isArray(analytics.pageViews)
      ? analytics.pageViews
      : [];
    const allResultClicks = Array.isArray(analytics.resultClicks)
      ? analytics.resultClicks
      : [];
    const requestedRange = String(req.query.range || "all");
    const range = ["all", "24h", "7d", "30d"].includes(requestedRange)
      ? requestedRange
      : "all";

    const sinceDate = parseRangeToSince(range);
    const searches = filterByDateRange(allSearches, sinceDate);
    const pageViews = filterByDateRange(allPageViews, sinceDate);
    const resultClicks = filterByDateRange(allResultClicks, sinceDate);
    const overview = buildOverview(searches, pageViews, resultClicks);
    const comparison = getPeriodComparison(
      allSearches,
      allPageViews,
      allResultClicks,
      range,
    );

    res.json({
      generatedAt: new Date().toISOString(),
      range,
      comparison,
      clickSignalConfig: {
        windowDays: clickSignalWindowDays,
        decayHalfLifeDays: clickSignalDecayHalfLifeDays,
        decayMinWeight: clickSignalDecayMinWeight,
        maxBoost: clickSignalMaxBoost,
        ctrMaxBoost: clickSignalCtrMaxBoost,
        guardrailMinBaseScore: clickSignalGuardrailMinBaseScore,
        guardrailMaxShare: clickSignalGuardrailMaxShare,
        dedupSeconds: Math.round(clickSignalDedupWindowMs / 1000),
        rangeStartAt: sinceDate ? sinceDate.toISOString() : null,
      },
      clickSignalTelemetry: getClickSignalTelemetry(),
      ...overview,
    });
  };
}

function createClickSignalResetController({
  createClickSignalTelemetryState,
  setClickSignalTelemetry,
}) {
  return (_req, res) => {
    const nextTelemetry = createClickSignalTelemetryState();
    setClickSignalTelemetry(nextTelemetry);

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      clickSignalTelemetry: nextTelemetry,
    });
  };
}

function createClickSignalSnapshotResetController({
  createClickSignalTelemetryState,
  getClickSignalTelemetry,
  setClickSignalTelemetry,
  clickSignalWindowDays,
  clickSignalDecayHalfLifeDays,
  clickSignalDecayMinWeight,
  clickSignalMaxBoost,
  clickSignalCtrMaxBoost,
  clickSignalGuardrailMinBaseScore,
  clickSignalGuardrailMaxShare,
  clickSignalDedupWindowMs,
}) {
  return (_req, res) => {
    const generatedAt = new Date().toISOString();
    const snapshot = {
      generatedAt,
      clickSignalConfig: {
        windowDays: clickSignalWindowDays,
        decayHalfLifeDays: clickSignalDecayHalfLifeDays,
        decayMinWeight: clickSignalDecayMinWeight,
        maxBoost: clickSignalMaxBoost,
        ctrMaxBoost: clickSignalCtrMaxBoost,
        guardrailMinBaseScore: clickSignalGuardrailMinBaseScore,
        guardrailMaxShare: clickSignalGuardrailMaxShare,
        dedupSeconds: Math.round(clickSignalDedupWindowMs / 1000),
      },
      clickSignalTelemetry: getClickSignalTelemetry(),
    };

    const nextTelemetry = createClickSignalTelemetryState();
    setClickSignalTelemetry(nextTelemetry);

    res.json({
      ok: true,
      generatedAt,
      snapshot,
      clickSignalTelemetry: nextTelemetry,
    });
  };
}

module.exports = {
  createAdminOverviewController,
  createClickSignalResetController,
  createClickSignalSnapshotResetController,
};
