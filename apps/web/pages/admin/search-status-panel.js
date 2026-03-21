(function initMagnetoAdminSearchStatusPanel(global) {
  function renderSearchStatus({
    payload,
    statusGrid,
    statusMeta,
    createStatusItem,
    formatDate,
    onRecentRunsChange,
    onRenderRunsTable,
  }) {
    if (!statusGrid || typeof createStatusItem !== "function") {
      return;
    }

    statusGrid.innerHTML = "";

    const search = payload?.search || payload || {};
    const sources = search.sources || {};
    const docs = search.documents || {};
    const rewriteRules = search.rewriteRules || {};
    const latestRun = search.latestRun || {};
    const recentRuns = Array.isArray(search.recentRuns)
      ? [...search.recentRuns]
      : [];

    if (typeof onRecentRunsChange === "function") {
      onRecentRunsChange(recentRuns);
    }

    const pagesSummary = [
      `seen=${Number(latestRun.pagesSeen || 0)}`,
      `indexed=${Number(latestRun.pagesIndexed || 0)}`,
      `updated=${Number(latestRun.pagesUpdated || 0)}`,
      `failed=${Number(latestRun.pagesFailed || 0)}`,
    ].join(" | ");

    const safeFormatDate =
      typeof formatDate === "function"
        ? formatDate
        : (value) => (value ? new Date(value).toLocaleString() : "-");

    const items = [
      [
        "Sources",
        `${Number(sources.active || 0)} active / ${Number(sources.total || 0)} total`,
      ],
      ["Indexed Docs", String(Number(docs.indexed || 0))],
      ["Blocked Docs", String(Number(docs.blocked || 0))],
      ["Errored Docs", String(Number(docs.errors || 0))],
      ["Block Rules", String(Number(search.blockRules || 0))],
      [
        "Rewrite Rules",
        `${Number(rewriteRules.enabled || 0)} enabled / ${Number(rewriteRules.total || 0)} total`,
      ],
      ["Latest Run Status", String(latestRun.status || "idle")],
      ["Latest Run Started", safeFormatDate(latestRun.startedAt)],
      ["Latest Run Finished", safeFormatDate(latestRun.finishedAt)],
      ["Latest Run Pages", pagesSummary],
    ];

    items.forEach(([label, value]) => {
      statusGrid.appendChild(createStatusItem(label, String(value)));
    });

    if (statusMeta) {
      statusMeta.textContent = `Updated: ${new Date().toLocaleString()}`;
    }

    if (typeof onRenderRunsTable === "function") {
      onRenderRunsTable();
    }
  }

  function renderSearchStatusError({
    errorMessage,
    statusGrid,
    statusMeta,
    documentRef,
  }) {
    if (!statusGrid || !documentRef) {
      return;
    }

    statusGrid.innerHTML = "";
    const fallback = documentRef.createElement("p");
    fallback.className = "admin-status-error";
    fallback.textContent = `Could not load search engine status: ${String(errorMessage)}`;
    statusGrid.appendChild(fallback);

    if (statusMeta) {
      statusMeta.textContent = `Error: ${new Date().toLocaleString()}`;
    }
  }

  global.MagnetoAdminSearchStatusPanel = {
    renderSearchStatus,
    renderSearchStatusError,
  };
})(window);
