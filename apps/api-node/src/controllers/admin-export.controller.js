function createAdminExportCsvController({
  readJson,
  analyticsPath,
  parseRangeToSince,
  filterByDateRange,
  buildOverview,
  escapeCsv,
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

    const lines = [];
    lines.push(
      "rowType,timestamp,query,resultCount,page,ip,userAgent,count,percent,range",
    );

    for (const item of searches) {
      lines.push(
        [
          "search",
          item.at || "",
          item.query || "",
          item.resultCount || 0,
          "",
          item.ip || "",
          "",
          "",
          "",
          range,
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    for (const item of resultClicks) {
      lines.push(
        [
          "result_click",
          item.at || "",
          item.query || "",
          "",
          item.url || "",
          item.ip || "",
          "",
          "",
          "",
          range,
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    for (const item of pageViews) {
      lines.push(
        [
          "page_view",
          item.at || "",
          "",
          "",
          item.page || "",
          item.ip || "",
          item.userAgent || "",
          "",
          "",
          range,
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    for (const item of overview.topQueries) {
      lines.push(
        [
          "top_query",
          "",
          item.query,
          "",
          "",
          "",
          "",
          item.count,
          item.percent,
          range,
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    for (const item of overview.trafficByPage) {
      lines.push(
        [
          "traffic_page",
          "",
          "",
          "",
          item.page,
          "",
          "",
          item.count,
          item.percent,
          range,
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=magneto-analytics-${range}-${stamp}.csv`,
    );
    res.send(lines.join("\n"));
  };
}

module.exports = {
  createAdminExportCsvController,
};
