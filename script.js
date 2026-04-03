const searchForm = document.getElementById("searchForm");
const searchQuery = document.getElementById("searchQuery");
const statusMessage = document.getElementById("statusMessage");
const homeOpsStatus = document.getElementById("homeOpsStatus");
const homeHealthBadge = document.getElementById("homeHealthBadge");
const homeOpsLtrLink = document.getElementById("homeOpsLtrLink");
const homeOpsAnalyticsLink = document.getElementById("homeOpsAnalyticsLink");
const searchHistoryPanel = document.getElementById("searchHistoryPanel");
const searchHistoryList = document.getElementById("searchHistoryList");
const searchHistoryClear = document.getElementById("searchHistoryClear");
const popularSearchesPanel = document.getElementById("popularSearchesPanel");
const popularSearchesList = document.getElementById("popularSearchesList");
const quickTags = document.querySelectorAll(".quick-tags .tag");

const weatherIcon = document.getElementById("weatherIcon");
const weatherTemp = document.getElementById("weatherTemp");
const weatherSummary = document.getElementById("weatherSummary");
const weatherLocation = document.getElementById("weatherLocation");
const weatherPanel = document.querySelector(".weather-panel");
const rightPanel = document.querySelector(".right-panel");
const magnetoTitle = document.querySelector(".hero h1");

const assistantThread = document.getElementById("assistantThread");
const assistantForm = document.getElementById("assistantForm");
const assistantInput = document.getElementById("assistantInput");
const assistantSuggestions = document.getElementById("assistantSuggestions");
const assistantLaunchBtn = document.getElementById("assistantLaunchBtn");
const assistantModal = document.getElementById("assistantModal");
const assistantModalHeader = document.getElementById("assistantModalHeader");
const assistantCloseBtn = document.getElementById("assistantCloseBtn");
const assistantMinimizeBtn = document.getElementById("assistantMinimizeBtn");
const assistantMaximizeBtn = document.getElementById("assistantMaximizeBtn");
const assistantRuntimeBadge = document.getElementById("assistantRuntimeBadge");
const assistantRuntimeSummary = document.getElementById(
  "assistantRuntimeSummary",
);
const assistantStatusMessage = document.getElementById(
  "assistantStatusMessage",
);

const resultsQuery = document.getElementById("resultsQuery");
const resultsMeta = document.getElementById("resultsMeta");
const resultsActiveContext = document.getElementById("resultsActiveContext");
const resultsAssist = document.getElementById("resultsAssist");
const resultsDidYouMean = document.getElementById("resultsDidYouMean");
const resultsSuggestChips = document.getElementById("resultsSuggestChips");
const resultsRelated = document.getElementById("resultsRelated");
const resultsList = document.getElementById("resultsList");
const resultsFilters = document.getElementById("resultsFilters");
const resultsFilterLanguage = document.getElementById("resultsFilterLanguage");
const resultsFilterCategory = document.getElementById("resultsFilterCategory");
const resultsFilterSource = document.getElementById("resultsFilterSource");
const resultsSourceOptions = document.getElementById("resultsSourceOptions");
const resultsFilterSort = document.getElementById("resultsFilterSort");
const resultsFilterLimit = document.getElementById("resultsFilterLimit");
const resultsFilterReset = document.getElementById("resultsFilterReset");
const resultsRememberFilters = document.getElementById(
  "resultsRememberFilters",
);
const resultsRememberFiltersState = document.getElementById(
  "resultsRememberFiltersState",
);
const resultsPrefsToast = document.getElementById("resultsPrefsToast");
const resultsScrollTopBtn = document.getElementById("resultsScrollTopBtn");
const resultsFacets = document.getElementById("resultsFacets");
const resultsPagination = document.getElementById("resultsPagination");
const resultsPrevPage = document.getElementById("resultsPrevPage");
const resultsNextPage = document.getElementById("resultsNextPage");
const resultsPageNumbers = document.getElementById("resultsPageNumbers");
const resultsPageMeta = document.getElementById("resultsPageMeta");
const resultsCountValue = document.getElementById("resultsCountValue");
const resultsSortValue = document.getElementById("resultsSortValue");
const resultsScopeValue = document.getElementById("resultsScopeValue");

const adminAuthPanel = document.getElementById("adminAuthPanel");
const adminDashboard = document.getElementById("adminDashboard");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminAuthStatus = document.getElementById("adminAuthStatus");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminRange = document.getElementById("adminRange");
const adminRefreshBtn = document.getElementById("adminRefreshBtn");
const adminResetClickTelemetryBtn = document.getElementById(
  "adminResetClickTelemetryBtn",
);
const adminSnapshotResetClickTelemetryBtn = document.getElementById(
  "adminSnapshotResetClickTelemetryBtn",
);
const adminExportBtn = document.getElementById("adminExportBtn");
const adminOpenLtrMonitorBtn = document.getElementById(
  "adminOpenLtrMonitorBtn",
);
const adminOpenAnalyticsDashboardBtn = document.getElementById(
  "adminOpenAnalyticsDashboardBtn",
);

const kpiTotalSearches = document.getElementById("kpiTotalSearches");
const kpiTotalViews = document.getElementById("kpiTotalViews");
const kpiUniqueQueries = document.getElementById("kpiUniqueQueries");
const kpiTotalClicks = document.getElementById("kpiTotalClicks");
const kpiZeroResults = document.getElementById("kpiZeroResults");
const kpiZeroRate = document.getElementById("kpiZeroRate");
const kpiReformulations = document.getElementById("kpiReformulations");
const kpiReformulationsMeta = document.getElementById("kpiReformulationsMeta");
const kpiSearchesDelta = document.getElementById("kpiSearchesDelta");
const kpiViewsDelta = document.getElementById("kpiViewsDelta");
const kpiUniqueDelta = document.getElementById("kpiUniqueDelta");
const kpiClicksDelta = document.getElementById("kpiClicksDelta");
const kpiSafetyRate = document.getElementById("kpiSafetyRate");
const kpiSafetyMeta = document.getElementById("kpiSafetyMeta");
const zeroResultsList = document.getElementById("zeroResultsList");
const reformulationsList = document.getElementById("reformulationsList");
const topQueriesList = document.getElementById("topQueriesList");
const trafficList = document.getElementById("trafficList");
const latestSearchesList = document.getElementById("latestSearchesList");
const topClickedResultsList = document.getElementById("topClickedResultsList");
const topClickPairsList = document.getElementById("topClickPairsList");
const adminClickSignalMeta = document.getElementById("adminClickSignalMeta");
const adminClickSnapshotHistoryList = document.getElementById(
  "adminClickSnapshotHistoryList",
);
const adminClickSnapshotDiff = document.getElementById(
  "adminClickSnapshotDiff",
);
const adminClickSnapshotBaselineDiff = document.getElementById(
  "adminClickSnapshotBaselineDiff",
);
const adminClickSnapshotBaselineMeta = document.getElementById(
  "adminClickSnapshotBaselineMeta",
);
const adminPinClickSnapshotBaselineBtn = document.getElementById(
  "adminPinClickSnapshotBaselineBtn",
);
const adminClearClickSnapshotBaselineBtn = document.getElementById(
  "adminClearClickSnapshotBaselineBtn",
);
const adminClearClickSnapshotHistoryBtn = document.getElementById(
  "adminClearClickSnapshotHistoryBtn",
);
const topQueriesChart = document.getElementById("topQueriesChart");
const trafficChart = document.getElementById("trafficChart");
const dailyTrendChart = document.getElementById("dailyTrendChart");
const weeklyTrendChart = document.getElementById("weeklyTrendChart");
const adminBackupList = document.getElementById("adminBackupList");
const adminBackupRefreshBtn = document.getElementById("adminBackupRefreshBtn");
const adminBackupCreateBtn = document.getElementById("adminBackupCreateBtn");
const adminBackupReason = document.getElementById("adminBackupReason");
const adminAssistantStatusGrid = document.getElementById(
  "adminAssistantStatusGrid",
);
const adminAssistantStatusUpdatedAt = document.getElementById(
  "adminAssistantStatusUpdatedAt",
);
const adminAssistantStatusRefreshBtn = document.getElementById(
  "adminAssistantStatusRefreshBtn",
);
const adminRuntimeMetricsGrid = document.getElementById(
  "adminRuntimeMetricsGrid",
);
const adminRuntimeMetricsUpdatedAt = document.getElementById(
  "adminRuntimeMetricsUpdatedAt",
);
const adminRuntimeMetricsRefreshBtn = document.getElementById(
  "adminRuntimeMetricsRefreshBtn",
);
const adminRuntimeAutoRefreshState = document.getElementById(
  "adminRuntimeAutoRefreshState",
);
const adminRoutingStatusGrid = document.getElementById(
  "adminRoutingStatusGrid",
);
const adminRoutingUpdatedAt = document.getElementById("adminRoutingUpdatedAt");
const adminRoutingRefreshBtn = document.getElementById(
  "adminRoutingRefreshBtn",
);
const adminRoutingVerifyBtn = document.getElementById("adminRoutingVerifyBtn");
const adminRoutingVerifyResult = document.getElementById(
  "adminRoutingVerifyResult",
);
const adminRoutingBtns = document.querySelectorAll(".admin-routing-btn");
const adminSearchStatusGrid = document.getElementById("adminSearchStatusGrid");
const adminSearchStatusMeta = document.getElementById("adminSearchStatusMeta");
const adminSearchStatusRefreshBtn = document.getElementById(
  "adminSearchStatusRefreshBtn",
);
const adminSearchSeedBtn = document.getElementById("adminSearchSeedBtn");
const adminSearchCrawlBtn = document.getElementById("adminSearchCrawlBtn");
const adminSearchCrawlForm = document.getElementById("adminSearchCrawlForm");
const adminSearchSourceIds = document.getElementById("adminSearchSourceIds");
const adminSearchMaxPages = document.getElementById("adminSearchMaxPages");
const adminSearchForceSeed = document.getElementById("adminSearchForceSeed");
const adminRankingConfigJson = document.getElementById(
  "adminRankingConfigJson",
);
const adminRankingConfigMeta = document.getElementById(
  "adminRankingConfigMeta",
);
const adminRankingConfigRefreshBtn = document.getElementById(
  "adminRankingConfigRefreshBtn",
);
const adminRankingConfigSaveBtn = document.getElementById(
  "adminRankingConfigSaveBtn",
);
const adminRankingConfigResetBtn = document.getElementById(
  "adminRankingConfigResetBtn",
);
const adminRewriteRulesList = document.getElementById("adminRewriteRulesList");
const adminRewriteRulesMeta = document.getElementById("adminRewriteRulesMeta");
const adminRewriteRulesRefreshBtn = document.getElementById(
  "adminRewriteRulesRefreshBtn",
);
const adminRewriteRulesAddBtn = document.getElementById(
  "adminRewriteRulesAddBtn",
);
const adminRewriteRulesSuggestBtn = document.getElementById(
  "adminRewriteRulesSuggestBtn",
);
const adminRewriteMinConfidence = document.getElementById(
  "adminRewriteMinConfidence",
);
const adminRewriteRulesSaveBtn = document.getElementById(
  "adminRewriteRulesSaveBtn",
);
const adminRewriteRulesResetBtn = document.getElementById(
  "adminRewriteRulesResetBtn",
);
const adminSearchRunsBody = document.getElementById("adminSearchRunsBody");
const adminSearchRunsStatusFilter = document.getElementById(
  "adminSearchRunsStatusFilter",
);
const adminSearchRunsSourceFilter = document.getElementById(
  "adminSearchRunsSourceFilter",
);
const adminSearchRunsFilterClearBtn = document.getElementById(
  "adminSearchRunsFilterClearBtn",
);
const adminSearchRunsExportBtn = document.getElementById(
  "adminSearchRunsExportBtn",
);
const adminSearchRunsCopyBtn = document.getElementById(
  "adminSearchRunsCopyBtn",
);
const adminSearchRunsPreviewBtn = document.getElementById(
  "adminSearchRunsPreviewBtn",
);
const adminSearchRunsSortButtons = document.querySelectorAll(
  ".admin-search-runs-sort-btn",
);
const adminSearchAutoRefreshState = document.getElementById(
  "adminSearchAutoRefreshState",
);
const adminSearchCsvModal = document.getElementById("adminSearchCsvModal");
const adminSearchCsvModalCloseBtn = document.getElementById(
  "adminSearchCsvModalCloseBtn",
);
const adminSearchCsvPreviewContent = document.getElementById(
  "adminSearchCsvPreviewContent",
);
const adminSearchCsvPreviewSearchInput = document.getElementById(
  "adminSearchCsvPreviewSearchInput",
);
const adminSearchCsvPreviewSearchClearBtn = document.getElementById(
  "adminSearchCsvPreviewSearchClearBtn",
);
const adminSearchCsvPreviewMatchCount = document.getElementById(
  "adminSearchCsvPreviewMatchCount",
);
const adminSearchCsvPreviewPrevBtn = document.getElementById(
  "adminSearchCsvPreviewPrevBtn",
);
const adminSearchCsvPreviewNextBtn = document.getElementById(
  "adminSearchCsvPreviewNextBtn",
);
const adminSearchRunDetail = document.getElementById("adminSearchRunDetail");
const adminSearchRunDetailCloseBtn = document.getElementById(
  "adminSearchRunDetailCloseBtn",
);
const adminSearchRunDetailBody = document.getElementById(
  "adminSearchRunDetailBody",
);
const adminSearchRunsCount = document.getElementById("adminSearchRunsCount");
const adminSearchRunsRefreshBtn = document.getElementById(
  "adminSearchRunsRefreshBtn",
);
const adminSearchRunsColToggleBtn = document.getElementById(
  "adminSearchRunsColToggleBtn",
);
const adminSearchColTogglePanel = document.getElementById(
  "adminSearchColTogglePanel",
);
const adminSearchRunsPaginationWrap = document.getElementById(
  "adminSearchRunsPaginationWrap",
);
const adminSearchRunsPaginationInfo = document.getElementById(
  "adminSearchRunsPaginationInfo",
);
const adminSearchRunsPrevPageBtn = document.getElementById(
  "adminSearchRunsPrevPageBtn",
);
const adminSearchRunsNextPageBtn = document.getElementById(
  "adminSearchRunsNextPageBtn",
);
const adminIndexSyncStatusGrid = document.getElementById(
  "adminIndexSyncStatusGrid",
);
const adminIndexSyncMeta = document.getElementById("adminIndexSyncMeta");
const adminIndexSyncStatusBtn = document.getElementById(
  "adminIndexSyncStatusBtn",
);
const adminIndexSyncRunBtn = document.getElementById("adminIndexSyncRunBtn");
const adminIndexSyncResetWatermarkBtn = document.getElementById(
  "adminIndexSyncResetWatermarkBtn",
);
const adminIndexSyncForm = document.getElementById("adminIndexSyncForm");
const adminIndexSyncSource = document.getElementById("adminIndexSyncSource");
const adminIndexSyncStatusFilter = document.getElementById(
  "adminIndexSyncStatusFilter",
);
const adminIndexSyncPageSize = document.getElementById(
  "adminIndexSyncPageSize",
);
const adminIndexSyncMaxPages = document.getElementById(
  "adminIndexSyncMaxPages",
);
const adminIndexSyncUpdatedSince = document.getElementById(
  "adminIndexSyncUpdatedSince",
);
const adminIndexSyncUseWatermark = document.getElementById(
  "adminIndexSyncUseWatermark",
);
const adminIndexSyncCreateBackup = document.getElementById(
  "adminIndexSyncCreateBackup",
);
const adminIndexStatusGrid = document.getElementById("adminIndexStatusGrid");
const adminIndexMeta = document.getElementById("adminIndexMeta");
const adminIndexBackupsList = document.getElementById("adminIndexBackupsList");
const adminIndexStatusBtn = document.getElementById("adminIndexStatusBtn");
const adminIndexRefreshBtn = document.getElementById("adminIndexRefreshBtn");
const adminIndexBackupsBtn = document.getElementById("adminIndexBackupsBtn");
const adminIndexRestoreBtn = document.getElementById("adminIndexRestoreBtn");
const adminIndexForm = document.getElementById("adminIndexForm");
const adminIndexBackupReasonFilter = document.getElementById(
  "adminIndexBackupReasonFilter",
);
const adminIndexRestoreFile = document.getElementById("adminIndexRestoreFile");
const adminIndexBackupFiles = document.getElementById("adminIndexBackupFiles");
const adminIndexRefreshCreateBackup = document.getElementById(
  "adminIndexRefreshCreateBackup",
);
const adminIndexRestoreCreateBackup = document.getElementById(
  "adminIndexRestoreCreateBackup",
);

const magnetoAdminState = window.MagnetoAdminState || {};
const magnetoApiClient = window.MagnetoApiClient || {};
const magnetoTrackingApi = window.MagnetoTrackingApi || {};
const magnetoSearchApi = window.MagnetoSearchApi || {};
const magnetoAssistantApi = window.MagnetoAssistantApi || {};
const magnetoAdminApi = window.MagnetoAdminApi || {};
const ADMIN_TOKEN_KEY =
  String(magnetoAdminState.ADMIN_TOKEN_KEY || "magneto.admin.token") ||
  "magneto.admin.token";
const ADMIN_CLICK_SNAPSHOT_HISTORY_KEY = "magneto.admin.click-snapshot.history";
const ADMIN_CLICK_SNAPSHOT_BASELINE_KEY =
  "magneto.admin.click-snapshot.baseline";
const ADMIN_CLICK_SNAPSHOT_CLEANUP_DISMISS_KEY =
  "magneto.admin.click-snapshot.cleanup-dismiss";
const ADMIN_CLICK_SNAPSHOT_HISTORY_MAX = 12;
const API_BASE_URL = String(
  magnetoApiClient.API_BASE_URL || window.MAGNETO_API_BASE_URL || "",
)
  .trim()
  .replace(/\/+$/, "");
let assistantLastProvider = "ready";
let assistantLastReason = "";
let currentAdminRange = "all";
let currentBackupReason = "all";
let currentIndexBackupReason = "all";
const RUNTIME_AUTO_REFRESH_MS = 30000;
let runtimeMetricsIntervalId = null;
let runtimeMetricsCountdownIntervalId = null;
let runtimeNextRefreshAtMs = 0;
let isRuntimeRefreshInFlight = false;
const SEARCH_AUTO_REFRESH_MS = 30000;
let searchStatusIntervalId = null;
let searchStatusCountdownIntervalId = null;
let searchStatusNextRefreshAtMs = 0;
let adminSearchRecentRuns = [];
let adminSearchRunsSortKey = "startedAt";
let adminSearchRunsSortDirection = "desc";
let adminSearchCsvFullContent = "";
let csvPreviewMarkElements = [];
let csvPreviewCurrentMatchIndex = -1;
let csvPreviewMatchedRowCount = 0;
let csvPreviewTotalDataRowCount = 0;
let adminSearchExpandedRunId = null;
const ADMIN_SEARCH_RUNS_PAGE_SIZE = 10;
const ADMIN_SEARCH_RUNS_HIDDEN_COLS_KEY = "magneto.admin.search.hiddenCols";
const RESULTS_FILTER_PREFS_KEY = "magneto.results.filterPrefs";
const RESULTS_FILTER_PREFS_ENABLED_KEY = "magneto.results.filterPrefs.enabled";
const ADMIN_SEARCH_RUNS_COL_KEYS = [
  "startedAt",
  "source",
  "status",
  "trigger",
  "pagesSeen",
  "pagesIndexed",
  "pagesUpdated",
  "pagesFailed",
  "pagesBlocked",
];
let adminSearchRunsPage = 0;
let adminSearchRunsHiddenCols = new Set();
let adminClickSnapshotAutoHealState = {
  ran: false,
  at: "",
  compactedCount: 0,
};
const ADMIN_CLICK_SNAPSHOT_AUTOHEAL_VISIBLE_MS = 60 * 1000;
const FLAG_ROTATION_DEFAULT_MS = 60000;
const FLAG_ROTATION_MIN_MS = 5000;
const FLAG_ROTATION_MAX_MS = 600000;
const FLAG_ROTATION_INDEX_KEY = "MAGNETO_FLAG_INDEX";
let flagRotationTimerId = null;
let currentFlagRotationIndex = 0;
const API_FETCH_TIMEOUT_MS = Number(
  magnetoApiClient.API_FETCH_TIMEOUT_MS || 12000,
);

function getFlagRotationIntervalMs() {
  return FLAG_ROTATION_DEFAULT_MS;
}

function clearMagnetoFlagTimers() {
  if (flagRotationTimerId != null) {
    window.clearInterval(flagRotationTimerId);
    flagRotationTimerId = null;
  }
}

function normalizeFlagEntries(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalized = items
    .map((item) => {
      const name = String(item?.name?.common || "").trim();
      const flagUrl = String(item?.flags?.svg || item?.flags?.png || "").trim();
      const code = String(item?.cca2 || "").trim();

      if (!name || !flagUrl || !code) {
        return null;
      }

      return { name, flagUrl, code };
    })
    .filter(Boolean);

  // Shuffle once so rotation is not visually stuck in alphabetic clusters (A, B, C...).
  for (let i = normalized.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [normalized[i], normalized[j]] = [normalized[j], normalized[i]];
  }

  return normalized;
}

function applyMagnetoFlagFill(flagEntry) {
  if (!magnetoTitle || !flagEntry || !flagEntry.flagUrl) {
    return;
  }

  magnetoTitle.style.setProperty(
    "--magneto-fill",
    `url("${flagEntry.flagUrl}") center / cover no-repeat`,
  );
  magnetoTitle.setAttribute(
    "aria-label",
    `Magneto title filled with ${flagEntry.name} flag`,
  );
  magnetoTitle.title = `${flagEntry.name} flag`;
}

function renderFlagByIndex(flags, index) {
  if (!magnetoTitle || !Array.isArray(flags) || flags.length === 0) {
    return;
  }

  const safeIndex = ((index % flags.length) + flags.length) % flags.length;
  applyMagnetoFlagFill(flags[safeIndex]);

  try {
    localStorage.setItem(FLAG_ROTATION_INDEX_KEY, String(safeIndex));
  } catch (_error) {
    // Non-blocking if storage is unavailable.
  }
}

async function initMagnetoFlagRotation() {
  if (!magnetoTitle) {
    return;
  }

  const rotationIntervalMs = getFlagRotationIntervalMs();

  try {
    const response = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,flags,cca2",
    );

    if (!response.ok) {
      throw new Error("Could not load country flags.");
    }

    const payload = await response.json();
    const flags = normalizeFlagEntries(payload);

    if (flags.length === 0) {
      return;
    }

    clearMagnetoFlagTimers();
    let savedIndex = 0;
    try {
      savedIndex = Number(localStorage.getItem(FLAG_ROTATION_INDEX_KEY));
    } catch (_error) {
      savedIndex = 0;
    }
    currentFlagRotationIndex = Number.isFinite(savedIndex) ? savedIndex : 0;
    renderFlagByIndex(flags, currentFlagRotationIndex);

    flagRotationTimerId = window.setInterval(() => {
      currentFlagRotationIndex += 1;
      renderFlagByIndex(flags, currentFlagRotationIndex);
    }, rotationIntervalMs);
  } catch (_error) {
    // Keep default gradient fill if flags cannot be loaded.
  }
}

function setRuntimeAutoRefreshState(isOn, secondsRemaining = null) {
  if (!adminRuntimeAutoRefreshState) {
    return;
  }

  const enabled = Boolean(isOn);
  if (!enabled) {
    adminRuntimeAutoRefreshState.textContent = "Auto-refresh OFF";
  } else {
    const secondsText = Number.isFinite(Number(secondsRemaining))
      ? ` - next in ${Math.max(0, Math.ceil(Number(secondsRemaining)))}s`
      : "";
    adminRuntimeAutoRefreshState.textContent = `Auto-refresh ON${secondsText}`;
  }

  adminRuntimeAutoRefreshState.classList.toggle(
    "admin-auto-refresh-on",
    enabled,
  );
  adminRuntimeAutoRefreshState.classList.toggle(
    "admin-auto-refresh-off",
    !enabled,
  );
}

function updateRuntimeAutoRefreshCountdown() {
  if (runtimeMetricsIntervalId == null || runtimeNextRefreshAtMs <= 0) {
    setRuntimeAutoRefreshState(false);
    return;
  }

  const secondsRemaining = (runtimeNextRefreshAtMs - Date.now()) / 1000;
  setRuntimeAutoRefreshState(true, secondsRemaining);
}

function setSearchAutoRefreshState(isOn, secondsRemaining = null) {
  if (!adminSearchAutoRefreshState) {
    return;
  }

  const enabled = Boolean(isOn);
  if (!enabled) {
    adminSearchAutoRefreshState.textContent = "Auto-refresh OFF";
  } else {
    const secondsText = Number.isFinite(Number(secondsRemaining))
      ? ` - next in ${Math.max(0, Math.ceil(Number(secondsRemaining)))}s`
      : "";
    adminSearchAutoRefreshState.textContent = `Auto-refresh ON${secondsText}`;
  }

  adminSearchAutoRefreshState.classList.toggle(
    "admin-auto-refresh-on",
    enabled,
  );
  adminSearchAutoRefreshState.classList.toggle(
    "admin-auto-refresh-off",
    !enabled,
  );
}

function updateSearchAutoRefreshCountdown() {
  if (searchStatusIntervalId == null || searchStatusNextRefreshAtMs <= 0) {
    setSearchAutoRefreshState(false);
    return;
  }

  const secondsRemaining = (searchStatusNextRefreshAtMs - Date.now()) / 1000;
  setSearchAutoRefreshState(true, secondsRemaining);
}

const buildApiUrl =
  typeof magnetoApiClient.buildApiUrl === "function"
    ? magnetoApiClient.buildApiUrl
    : function buildApiUrlFallback(path) {
        const target = String(path || "").trim();
        if (!target.startsWith("/api/")) {
          return target;
        }

        return API_BASE_URL ? `${API_BASE_URL}${target}` : target;
      };

const apiFetch =
  typeof magnetoApiClient.apiFetch === "function"
    ? magnetoApiClient.apiFetch
    : function apiFetchFallback(path, options) {
        const requestOptions =
          options && typeof options === "object" ? { ...options } : {};
        const timeoutRaw = Number(requestOptions.timeoutMs);
        const timeoutMs =
          Number.isFinite(timeoutRaw) && timeoutRaw > 0
            ? timeoutRaw
            : API_FETCH_TIMEOUT_MS;
        delete requestOptions.timeoutMs;

        const controller = new AbortController();
        const originalSignal = requestOptions.signal;
        let removeAbortForwarder = null;

        if (originalSignal) {
          if (originalSignal.aborted) {
            controller.abort();
          } else {
            const forwardAbort = () => controller.abort();
            originalSignal.addEventListener("abort", forwardAbort, {
              once: true,
            });
            removeAbortForwarder = () => {
              originalSignal.removeEventListener("abort", forwardAbort);
            };
          }
        }

        requestOptions.signal = controller.signal;
        const timeoutId = window.setTimeout(
          () => controller.abort(),
          timeoutMs,
        );

        return fetch(buildApiUrl(path), requestOptions)
          .catch((error) => {
            if (error?.name === "AbortError") {
              throw new Error(
                `Request timed out after ${timeoutMs}ms. Check API server and API base.`,
              );
            }
            throw error;
          })
          .finally(() => {
            window.clearTimeout(timeoutId);
            if (removeAbortForwarder) {
              removeAbortForwarder();
            }
          });
      };

function syncSidePanelHeights() {
  if (!rightPanel) {
    return;
  }

  // Keep panel sizing controlled by CSS fixed-height rules.
  rightPanel.style.minHeight = "";
  rightPanel.style.height = "";
}

function updateSearchStatus(message, isError = false) {
  if (!statusMessage) {
    return;
  }

  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function updateAssistantStatus(message, isError = false) {
  if (!assistantStatusMessage) {
    return;
  }

  assistantStatusMessage.textContent = String(message || "");
  assistantStatusMessage.classList.toggle("error", isError);
}

function getAssistantApiBaseSummary() {
  return API_BASE_URL || window.MAGNETO_API_BASE_URL || "(relative /api)";
}

function formatApiBaseSourceLabel(source) {
  const normalized = String(source || "default")
    .trim()
    .toLowerCase();

  if (normalized === "query") {
    return "URL override";
  }

  if (normalized === "localstorage") {
    return "saved browser override";
  }

  return "default base";
}

function getAssistantRuntimeView(
  provider = assistantLastProvider,
  reason = "",
) {
  const normalizedProvider = String(provider || "ready").trim();
  const providerKey = normalizedProvider.toLowerCase();
  const apiBase = getAssistantApiBaseSummary();
  const sourceLabel = formatApiBaseSourceLabel(window.MAGNETO_API_BASE_SOURCE);
  const trimmedReason = String(reason || "").trim();

  if (providerKey === "local-fallback" || providerKey === "fallback") {
    return {
      badge: "Fallback",
      badgeState: "fallback",
      summary: trimmedReason
        ? `Using local fallback replies. API base: ${apiBase}. Source: ${sourceLabel}. ${trimmedReason}`
        : `Using local fallback replies. API base: ${apiBase}. Source: ${sourceLabel}.`,
      status: trimmedReason
        ? `Fallback mode active. ${trimmedReason}`
        : `Fallback mode active. API base source: ${sourceLabel}.`,
      statusIsError: Boolean(trimmedReason),
    };
  }

  if (providerKey && providerKey !== "ready" && providerKey !== "unknown") {
    return {
      badge: "Live API",
      badgeState: "live",
      summary: `Connected through ${normalizedProvider}. API base: ${apiBase}. Source: ${sourceLabel}.`,
      status: `Assistant connected through ${normalizedProvider}. API base source: ${sourceLabel}.`,
      statusIsError: false,
    };
  }

  return {
    badge: "Ready",
    badgeState: "ready",
    summary: `Assistant ready. API base: ${apiBase}. Source: ${sourceLabel}.`,
    status: `Assistant ready. API base source: ${sourceLabel}.`,
    statusIsError: false,
  };
}

function renderAssistantRuntime(
  provider = assistantLastProvider,
  reason = assistantLastReason,
) {
  assistantLastProvider =
    String(provider || assistantLastProvider || "ready").trim() || "ready";
  const providerKey = assistantLastProvider.toLowerCase();
  assistantLastReason =
    providerKey === "local-fallback" || providerKey === "fallback"
      ? String(reason || assistantLastReason || "").trim()
      : String(reason || "").trim();

  const view = getAssistantRuntimeView(
    assistantLastProvider,
    assistantLastReason,
  );

  if (assistantRuntimeBadge) {
    assistantRuntimeBadge.textContent = view.badge;
    assistantRuntimeBadge.dataset.state = view.badgeState;
  }

  if (assistantRuntimeSummary) {
    assistantRuntimeSummary.textContent = view.summary;
  }

  updateAssistantStatus(view.status, view.statusIsError);
}

function initHomeKeyboardShortcuts() {
  if (!searchQuery) {
    return;
  }

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTypingTarget =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    if (
      event.key === "/" &&
      !isTypingTarget &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault();
      searchQuery.focus();
      searchQuery.select();
      updateSearchStatus("Search focused. Type your query and press Enter.");
      return;
    }

    if (
      event.key.toLowerCase() === "k" &&
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey
    ) {
      event.preventDefault();
      searchQuery.focus();
      searchQuery.select();
      updateSearchStatus("Quick search ready.");
      return;
    }

    if (event.key === "Escape" && document.activeElement === searchQuery) {
      searchQuery.value = "";
      updateSearchStatus("Search cleared.");
    }
  });
}

function addAssistantMessage(role, text) {
  if (!assistantThread) {
    return;
  }

  const message = document.createElement("p");
  message.className = `assistant-bubble ${role}`;
  message.textContent = text;
  assistantThread.appendChild(message);
  assistantThread.scrollTop = assistantThread.scrollHeight;
}

function buildAssistantContent(rawQuery) {
  const query = String(rawQuery || "").trim();

  if (!query) {
    return {
      message:
        "Ask me anything. I can help with weather, writing, ideas, planning, and more.",
      suggestions: [
        "What can you help me with?",
        "Summarize this text",
        "Plan my day",
      ],
    };
  }

  const normalized = query.toLowerCase();

  if (/weather|rain|sun|forecast/.test(normalized)) {
    return {
      message:
        "I can check live weather details. Include city and timeframe for best accuracy.",
      suggestions: [
        "weather now in Bucharest",
        "weather tomorrow in my city",
        "weekend forecast in Cluj",
      ],
    };
  }

  if (/news|politics|economy/.test(normalized)) {
    return {
      message: "Try narrowing by source and timeframe.",
      suggestions: [
        `${query} last 24 hours`,
        `${query} trusted sources`,
        `${query} analysis`,
      ],
    };
  }

  if (/sport|football|tennis|basketball/.test(normalized)) {
    return {
      message: "For sports, scores and schedule filters are useful.",
      suggestions: [
        `${query} live scores`,
        `${query} schedule`,
        `${query} standings`,
      ],
    };
  }

  if (/job|career|cv|hiring/.test(normalized)) {
    return {
      message: "Use location and seniority for a cleaner job search.",
      suggestions: [
        `${query} remote`,
        `${query} entry level`,
        `${query} salary`,
      ],
    };
  }

  return {
    message: "I can help with that. Here are some useful next prompts.",
    suggestions: [
      `Explain ${query} simply`,
      `Give me practical steps for ${query}`,
      `What are the pros and cons of ${query}?`,
    ],
  };
}

function updateAssistant(query) {
  if (!assistantSuggestions) {
    return;
  }

  assistantSuggestions.innerHTML = "";
  const content = buildAssistantContent(query);

  content.suggestions.forEach((suggestion) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "assistant-chip";
    button.textContent = suggestion;

    button.addEventListener("click", () => {
      if (!assistantInput) {
        return;
      }

      assistantInput.value = suggestion;
      assistantInput.focus();
    });

    assistantSuggestions.appendChild(button);
  });
}

async function buildLocalAssistantFallback(query) {
  const content = buildAssistantContent(query);

  try {
    const params = new URLSearchParams({
      q: String(query || "").trim(),
      limit: "3",
      sort: "relevance",
    });
    const response = await apiFetch(`/api/search?${params.toString()}`);
    const payload = await response.json().catch(() => ({}));
    const results = Array.isArray(payload.results) ? payload.results : [];

    if (response.ok && results.length > 0) {
      const topRows = results.slice(0, 3).map((item, index) => {
        const title = String(item?.title || item?.url || "Result").trim();
        return `${index + 1}. ${title}`;
      });

      return {
        reply:
          "AI is temporarily unavailable, but I found these relevant MAGNETO results:\n" +
          topRows.join("\n"),
        suggestions: [
          `Open results for ${query}`,
          ...content.suggestions.slice(0, 2),
        ],
      };
    }
  } catch {
    // Keep local generic fallback if search grounding also fails.
  }

  return {
    reply: content.message,
    suggestions: content.suggestions,
  };
}

async function requestAssistantResponse(userText) {
  const history = assistantThread
    ? Array.from(assistantThread.querySelectorAll(".assistant-bubble"))
        .slice(-6)
        .map((el) => ({
          role: el.classList.contains("user") ? "user" : "assistant",
          content: String(el.textContent || "").trim(),
        }))
    : [];

  try {
    const payload =
      typeof magnetoAssistantApi.requestAssistantChat === "function"
        ? await magnetoAssistantApi.requestAssistantChat(userText, history)
        : await (async () => {
            const response = await apiFetch("/api/assistant/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: userText, history }),
            });

            const fallbackPayload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(
                fallbackPayload.error || "Assistant request failed.",
              );
            }

            return fallbackPayload;
          })();

    const reply = String(payload.reply || "").trim();
    const suggestions = Array.isArray(payload.suggestions)
      ? payload.suggestions
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [];

    if (!reply) {
      throw new Error("Assistant returned empty response.");
    }

    return {
      reply,
      suggestions: suggestions.slice(0, 3),
      provider: String(payload.provider || "unknown"),
    };
  } catch (error) {
    const fallback = await buildLocalAssistantFallback(userText);
    const reason = String(error?.message || "Assistant unavailable.");
    const isFileProtocol = window.location.protocol === "file:";
    const help = isFileProtocol
      ? "Open MAGNETO through http://localhost:3000 (not file://) so API routes are available."
      : reason;

    return {
      reply: fallback.reply,
      suggestions: fallback.suggestions,
      provider: "local-fallback",
      reason: help,
    };
  }
}

function initAssistantChat() {
  if (!assistantThread || !assistantForm || !assistantInput) {
    return;
  }

  let isDraggingAssistant = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let isAssistantFullscreen = false;
  let assistantPreMinimizePosition = null;

  const clearAssistantSurface = () => {
    if (assistantThread) {
      assistantThread.innerHTML = "";
    }
    if (assistantSuggestions) {
      assistantSuggestions.innerHTML = "";
      assistantSuggestions.hidden = true;
    }
    updateAssistantStatus("");
  };

  const setAssistantFullscreen = (enabled) => {
    if (!assistantModal) {
      return;
    }

    isAssistantFullscreen = Boolean(enabled);
    assistantModal.classList.toggle("assistant-modal-fullscreen", enabled);

    if (enabled) {
      assistantModal.dataset.prevLeft = assistantModal.style.left || "";
      assistantModal.dataset.prevTop = assistantModal.style.top || "";
      assistantModal.dataset.prevRight = assistantModal.style.right || "";
      assistantModal.style.left = "";
      assistantModal.style.top = "";
      assistantModal.style.right = "";
      if (assistantMaximizeBtn) {
        assistantMaximizeBtn.textContent = "<>";
        assistantMaximizeBtn.setAttribute("title", "Restore");
        assistantMaximizeBtn.setAttribute("aria-label", "Restore assistant");
      }
      return;
    }

    assistantModal.style.left = assistantModal.dataset.prevLeft || "";
    assistantModal.style.top = assistantModal.dataset.prevTop || "";
    assistantModal.style.right = assistantModal.dataset.prevRight || "";
    if (!assistantModal.style.left || !assistantModal.style.top) {
      const modalWidth = assistantModal.offsetWidth || 440;
      applyAssistantPosition(window.innerWidth - modalWidth - 18, 108);
    }

    if (assistantMaximizeBtn) {
      assistantMaximizeBtn.textContent = "[]";
      assistantMaximizeBtn.setAttribute("title", "Maximize");
      assistantMaximizeBtn.setAttribute("aria-label", "Maximize assistant");
    }
  };

  const setAssistantMinimized = (enabled) => {
    if (!assistantModal) {
      return;
    }

    if (enabled) {
      if (isAssistantFullscreen) {
        setAssistantFullscreen(false);
      }

      assistantPreMinimizePosition = {
        left: assistantModal.style.left || "",
        top: assistantModal.style.top || "",
        right: assistantModal.style.right || "",
      };

      assistantModal.style.left = "";
      assistantModal.style.top = "";
      assistantModal.style.right = "";
    }

    assistantModal.classList.toggle(
      "assistant-modal-minimized",
      Boolean(enabled),
    );

    if (!enabled) {
      if (assistantPreMinimizePosition) {
        assistantModal.style.left = assistantPreMinimizePosition.left;
        assistantModal.style.top = assistantPreMinimizePosition.top;
        assistantModal.style.right = assistantPreMinimizePosition.right;
      }

      if (!assistantModal.style.left || !assistantModal.style.top) {
        const modalWidth = assistantModal.offsetWidth || 440;
        applyAssistantPosition(window.innerWidth - modalWidth - 18, 108);
      }
    }

    if (assistantMinimizeBtn) {
      assistantMinimizeBtn.textContent = enabled ? "+" : "_";
      assistantMinimizeBtn.setAttribute(
        "title",
        enabled ? "Expand" : "Minimize",
      );
      assistantMinimizeBtn.setAttribute(
        "aria-label",
        enabled ? "Expand assistant" : "Minimize assistant",
      );
    }
  };

  const clampAssistantPosition = (left, top) => {
    if (!assistantModal) {
      return { left, top };
    }

    const modalWidth = assistantModal.offsetWidth || 440;
    const maxLeft = Math.max(8, window.innerWidth - modalWidth - 8);
    const clampedLeft = Math.max(8, Math.min(left, maxLeft));
    const clampedTop = Math.max(8, Math.min(top, window.innerHeight - 120));
    return { left: clampedLeft, top: clampedTop };
  };

  const applyAssistantPosition = (left, top) => {
    if (!assistantModal) {
      return;
    }
    const next = clampAssistantPosition(left, top);
    assistantModal.style.left = `${Math.round(next.left)}px`;
    assistantModal.style.top = `${Math.round(next.top)}px`;
    assistantModal.style.right = "auto";
  };

  const openAssistantModal = () => {
    if (!assistantModal) {
      return;
    }
    clearAssistantSurface();
    renderAssistantRuntime();
    assistantModal.hidden = false;
    setAssistantMinimized(false);

    if (!assistantModal.dataset.positioned) {
      requestAnimationFrame(() => {
        if (!assistantModal) {
          return;
        }
        const modalWidth = assistantModal.offsetWidth || 440;
        applyAssistantPosition(window.innerWidth - modalWidth - 18, 108);
        assistantModal.dataset.positioned = "true";
      });
    }

    requestAnimationFrame(() => {
      assistantInput.focus();
    });
  };

  const closeAssistantModal = () => {
    if (!assistantModal) {
      return;
    }
    clearAssistantSurface();
    assistantModal.hidden = true;
  };

  if (assistantLaunchBtn) {
    assistantLaunchBtn.addEventListener("click", openAssistantModal);
  }

  if (assistantCloseBtn) {
    assistantCloseBtn.addEventListener("click", closeAssistantModal);
  }

  if (assistantMinimizeBtn) {
    assistantMinimizeBtn.addEventListener("click", () => {
      if (!assistantModal) {
        return;
      }
      const willMinimize = !assistantModal.classList.contains(
        "assistant-modal-minimized",
      );
      setAssistantMinimized(willMinimize);
    });
  }

  if (assistantMaximizeBtn) {
    assistantMaximizeBtn.addEventListener("click", () => {
      setAssistantFullscreen(!isAssistantFullscreen);
    });
  }

  if (assistantModal) {
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !assistantModal.hidden) {
        closeAssistantModal();
      }
    });

    window.addEventListener("resize", () => {
      if (
        assistantModal.hidden ||
        isAssistantFullscreen ||
        assistantModal.classList.contains("assistant-modal-minimized")
      ) {
        return;
      }
      const rect = assistantModal.getBoundingClientRect();
      applyAssistantPosition(rect.left, rect.top);
    });
  }

  if (assistantModalHeader && assistantModal) {
    assistantModalHeader.addEventListener("mousedown", (event) => {
      if (
        isAssistantFullscreen ||
        assistantModal.classList.contains("assistant-modal-minimized")
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("button") ||
          target.closest("input") ||
          target.closest("a"))
      ) {
        return;
      }

      const rect = assistantModal.getBoundingClientRect();
      isDraggingAssistant = true;
      dragOffsetX = event.clientX - rect.left;
      dragOffsetY = event.clientY - rect.top;
      document.body.style.userSelect = "none";
    });

    window.addEventListener("mousemove", (event) => {
      if (!isDraggingAssistant || !assistantModal || assistantModal.hidden) {
        return;
      }

      applyAssistantPosition(
        event.clientX - dragOffsetX,
        event.clientY - dragOffsetY,
      );
    });

    window.addEventListener("mouseup", () => {
      if (!isDraggingAssistant) {
        return;
      }
      isDraggingAssistant = false;
      document.body.style.userSelect = "";
    });
  }

  assistantForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userText = assistantInput.value.trim();
    if (!userText) {
      return;
    }

    addAssistantMessage("user", userText);
    addAssistantMessage("bot", "Thinking...");
    updateAssistantStatus("Assistant is replying...");

    const result = await requestAssistantResponse(userText);
    if (assistantThread && assistantThread.lastElementChild) {
      assistantThread.lastElementChild.textContent = result.reply;
    }

    if (result.provider === "local-fallback" && result.reason) {
      console.warn(`Assistant fallback active: ${result.reason}`);
    }

    renderAssistantRuntime(result.provider, result.reason || "");

    assistantInput.value = "";
    requestAnimationFrame(syncSidePanelHeights);
  });

  renderAssistantRuntime();
  requestAnimationFrame(syncSidePanelHeights);
}

const SEARCH_HISTORY_KEY = "magneto.search-history";
const SEARCH_HISTORY_LIMIT = 10;

function getSearchHistory() {
  try {
    const json = localStorage.getItem(SEARCH_HISTORY_KEY);
    return Array.isArray(JSON.parse(json || "[]")) ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(queries) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(queries));
  } catch (error) {
    console.warn("Could not save search history:", error);
  }
}

function addToSearchHistory(query) {
  const normalized = String(query || "").trim();
  if (!normalized || normalized.length < 2) {
    return;
  }

  const history = getSearchHistory();
  const filtered = history.filter(
    (q) =>
      String(q || "")
        .trim()
        .toLowerCase() !== normalized.toLowerCase(),
  );
  const updated = [normalized, ...filtered].slice(0, SEARCH_HISTORY_LIMIT);
  saveSearchHistory(updated);
  renderSearchHistory(updated);
}

function renderSearchHistory(queries) {
  if (!searchHistoryPanel || !searchHistoryList) {
    return;
  }

  if (!Array.isArray(queries) || queries.length === 0) {
    searchHistoryPanel.hidden = true;
    return;
  }

  searchHistoryList.innerHTML = "";
  queries.forEach((query) => {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) {
      return;
    }

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "search-history-chip";
    chip.textContent = normalizedQuery;
    chip.addEventListener("click", () => {
      searchQuery.value = normalizedQuery;
      searchForm.dispatchEvent(new Event("submit", { bubbles: true }));
    });

    searchHistoryList.appendChild(chip);
  });

  if (searchHistoryList.childNodes.length > 0) {
    searchHistoryPanel.hidden = false;
  }
}

function clearSearchHistory() {
  saveSearchHistory([]);
  if (searchHistoryPanel) {
    searchHistoryPanel.hidden = true;
  }
  if (searchHistoryList) {
    searchHistoryList.innerHTML = "";
  }
}

async function fetchPopularSearches() {
  if (typeof magnetoSearchApi.fetchPopularSearches === "function") {
    return magnetoSearchApi.fetchPopularSearches();
  }

  try {
    const response = await apiFetch("/api/analytics/popular-searches");
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload.queries) ? payload.queries : [];
  } catch (error) {
    return [];
  }
}

function renderPopularSearches(queries) {
  if (!popularSearchesPanel || !popularSearchesList) {
    return;
  }

  if (!Array.isArray(queries) || queries.length === 0) {
    popularSearchesPanel.hidden = true;
    return;
  }

  popularSearchesList.innerHTML = "";
  queries.slice(0, 6).forEach((query) => {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) {
      return;
    }

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "popular-search-chip";
    chip.textContent = normalizedQuery;
    chip.addEventListener("click", () => {
      searchQuery.value = normalizedQuery;
      searchForm.dispatchEvent(new Event("submit", { bubbles: true }));
    });

    popularSearchesList.appendChild(chip);
  });

  if (popularSearchesList.childNodes.length > 0) {
    popularSearchesPanel.hidden = false;
  }
}

function initHomeForm() {
  if (!searchForm || !searchQuery) {
    return;
  }

  const initHomeOpsPanel = async () => {
    if (!homeOpsStatus || !homeHealthBadge) {
      return;
    }

    const token = getAdminToken();
    const protectedLinks = [homeOpsLtrLink, homeOpsAnalyticsLink].filter(
      Boolean,
    );

    protectedLinks.forEach((link) => {
      if (!token) {
        link.setAttribute("aria-disabled", "true");
        link.style.opacity = "0.6";
      } else {
        link.removeAttribute("aria-disabled");
        link.style.opacity = "1";
      }
    });

    if (!token) {
      homeOpsStatus.textContent =
        "Public health available. Sign in via Admin Panel for LTR/Analytics dashboards.";
    }

    try {
      const response = await apiFetch("/api/health");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Health check failed.");
      }

      const backend = String(payload.backend || "unknown").toUpperCase();
      const now = new Date().toLocaleTimeString();
      homeHealthBadge.textContent = "Healthy";
      homeHealthBadge.classList.remove("warn");
      homeHealthBadge.classList.add("ok");
      homeOpsStatus.textContent = `Backend ${backend} is reachable. Last check: ${now}.`;
    } catch (error) {
      homeHealthBadge.textContent = "Degraded";
      homeHealthBadge.classList.remove("ok");
      homeHealthBadge.classList.add("warn");
      homeOpsStatus.textContent =
        error?.message || "Could not read health endpoint.";
    }

    protectedLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        if (!getAdminToken()) {
          event.preventDefault();
          updateSearchStatus(
            "Sign in via Admin Panel before opening protected dashboards.",
            true,
          );
        }
      });
    });
  };

  initHomeOpsPanel();

  let searchSuggestAbortController = null;
  let searchSuggestDebounceId = null;
  const searchSuggestDataListId = "searchQuerySuggestions";
  let searchSuggestDataList = document.getElementById(searchSuggestDataListId);

  if (!searchSuggestDataList) {
    searchSuggestDataList = document.createElement("datalist");
    searchSuggestDataList.id = searchSuggestDataListId;
    document.body.appendChild(searchSuggestDataList);
  }

  searchQuery.setAttribute("list", searchSuggestDataListId);

  const renderSearchSuggestions = (items) => {
    if (!searchSuggestDataList) {
      return;
    }

    searchSuggestDataList.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    items.forEach((value) => {
      const normalized = String(value || "").trim();
      if (!normalized) {
        return;
      }
      const option = document.createElement("option");
      option.value = normalized;
      searchSuggestDataList.appendChild(option);
    });
  };

  const fetchSearchSuggestions = async (partial) => {
    const query = String(partial || "").trim();
    if (query.length < 2) {
      renderSearchSuggestions([]);
      return;
    }

    if (searchSuggestAbortController) {
      searchSuggestAbortController.abort();
    }
    searchSuggestAbortController = new AbortController();

    try {
      const params = new URLSearchParams({ q: query, limit: "8" });
      const response = await apiFetch(
        `/api/search/suggest?${params.toString()}`,
        {
          signal: searchSuggestAbortController.signal,
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        renderSearchSuggestions([]);
        return;
      }

      const suggestions = Array.isArray(payload.suggestions)
        ? payload.suggestions.slice(0, 8)
        : [];
      renderSearchSuggestions(suggestions);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      renderSearchSuggestions([]);
    }
  };

  searchQuery.addEventListener("input", () => {
    if (searchSuggestDebounceId != null) {
      window.clearTimeout(searchSuggestDebounceId);
    }

    const currentValue = searchQuery.value;
    searchSuggestDebounceId = window.setTimeout(() => {
      fetchSearchSuggestions(currentValue);
    }, 160);
  });

  searchQuery.addEventListener("blur", () => {
    if (!searchSuggestDataList) {
      return;
    }
    window.setTimeout(() => {
      if (document.activeElement !== searchQuery) {
        searchSuggestDataList.innerHTML = "";
      }
    }, 120);
  });

  if (searchHistoryClear) {
    searchHistoryClear.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Clear your entire search history? This cannot be undone.",
      );
      if (confirmed) {
        clearSearchHistory();
        updateSearchStatus("Search history cleared.");
      }
    });
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = searchQuery.value.trim();

    if (!query) {
      updateSearchStatus("Please type a search query.", true);
      return;
    }

    addToSearchHistory(query);
    updateSearchStatus("Searching with MAGNETO Core...");
    window.location.href = `results.html?q=${encodeURIComponent(query)}`;
  });

  quickTags.forEach((tagButton) => {
    tagButton.addEventListener("click", () => {
      const query = tagButton.dataset.query;
      if (!query) {
        return;
      }

      searchQuery.value = query;
      searchQuery.focus();
      updateSearchStatus(`Suggestion applied: ${query}`);
    });
  });

  initAssistantChat();
  initHomeKeyboardShortcuts();

  const homeAnimatedNodes = document.querySelectorAll(
    ".hero-metric-card, .feature-card, .search-signal",
  );
  homeAnimatedNodes.forEach((node, index) => {
    node.style.animationDelay = `${Math.min(index * 70, 280)}ms`;
  });
}

function getWeatherView(weatherCode) {
  if (weatherCode === 0) {
    return { icon: "☀️", summary: "Sunny" };
  }

  if (weatherCode === 1) {
    return { icon: "🌤️", summary: "Mostly sunny" };
  }

  if (weatherCode === 2) {
    return { icon: "⛅", summary: "Partly cloudy" };
  }

  if (weatherCode === 3) {
    return { icon: "☁️", summary: "Cloudy" };
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return { icon: "🌫️", summary: "Fog" };
  }

  if (
    weatherCode === 51 ||
    weatherCode === 53 ||
    weatherCode === 55 ||
    weatherCode === 56 ||
    weatherCode === 57 ||
    weatherCode === 61 ||
    weatherCode === 63 ||
    weatherCode === 65 ||
    weatherCode === 66 ||
    weatherCode === 67 ||
    weatherCode === 80 ||
    weatherCode === 81 ||
    weatherCode === 82 ||
    weatherCode === 95 ||
    weatherCode === 96 ||
    weatherCode === 99
  ) {
    return { icon: "🌦️", summary: "Rain" };
  }

  return { icon: "🌥️", summary: "Variable conditions" };
}

async function fetchWeatherByCoords(latitude, longitude) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    "&current=temperature_2m,weather_code" +
    "&timezone=auto";

  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error("Could not get weather data.");
  }

  const data = await response.json();
  const current = data.current;

  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("Incomplete weather data.");
  }

  return {
    temperature: current.temperature_2m,
    weatherCode: current.weather_code,
  };
}

async function fetchLocationName(latitude, longitude) {
  const reverseUrl =
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    "&localityLanguage=en";

  const response = await fetch(reverseUrl);
  if (!response.ok) {
    throw new Error("Could not resolve location name.");
  }

  const data = await response.json();
  const city =
    data.city || data.locality || data.principalSubdivision || data.countryName;
  const country = data.countryName;

  if (!city && !country) {
    throw new Error("Location name unavailable.");
  }

  if (city && country && city.toLowerCase() !== country.toLowerCase()) {
    return `${city}, ${country}`;
  }

  return city || country;
}

function setWeatherUI({ temperature, weatherCode, locationText }) {
  if (!weatherTemp || !weatherSummary || !weatherLocation || !weatherIcon) {
    return;
  }

  const view = getWeatherView(Number(weatherCode));
  weatherTemp.textContent = `${Math.round(temperature)}\u00B0C`;
  weatherSummary.textContent = view.summary;
  weatherLocation.textContent = locationText;
  weatherIcon.innerHTML = view.icon;
}

const WEATHER_IP_CACHE_KEY = "magneto.weather.ipLocation";
const WEATHER_IP_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const WEATHER_PRECISE_CACHE_KEY = "magneto.weather.preciseLocation";
const WEATHER_PRECISE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const WEATHER_PRECISE_PROMPT_KEY = "magneto.weather.precisePromptAt";
const WEATHER_PRECISE_PROMPT_COOLDOWN_MS = 12 * 60 * 60 * 1000;

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function readCachedIpLocation() {
  try {
    const raw = localStorage.getItem(WEATHER_IP_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const age = Date.now() - Number(parsed.savedAt || 0);
    if (age > WEATHER_IP_CACHE_TTL_MS) {
      localStorage.removeItem(WEATHER_IP_CACHE_KEY);
      return null;
    }

    if (
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number"
    ) {
      return null;
    }

    // Discard stale cross-country cache when timezone clearly indicates Germany.
    const tz = getBrowserTimeZone();
    const cachedCountry = String(parsed.country || "").toLowerCase();
    if (
      tz === "Europe/Berlin" &&
      cachedCountry &&
      cachedCountry !== "germany"
    ) {
      localStorage.removeItem(WEATHER_IP_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveCachedIpLocation(location) {
  try {
    localStorage.setItem(
      WEATHER_IP_CACHE_KEY,
      JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city || "",
        country: location.country || "",
        savedAt: Date.now(),
      }),
    );
  } catch {
    // Ignore cache write failures
  }
}

function readCachedPreciseLocation() {
  try {
    const raw = localStorage.getItem(WEATHER_PRECISE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const age = Date.now() - Number(parsed.savedAt || 0);
    if (age > WEATHER_PRECISE_CACHE_TTL_MS) {
      localStorage.removeItem(WEATHER_PRECISE_CACHE_KEY);
      return null;
    }

    if (
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveCachedPreciseLocation(location) {
  try {
    localStorage.setItem(
      WEATHER_PRECISE_CACHE_KEY,
      JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city || "",
        country: location.country || "",
        savedAt: Date.now(),
      }),
    );
  } catch {
    // Ignore cache write failures.
  }
}

function canAttemptPrecisePrompt() {
  try {
    const lastPromptAt = Number(
      localStorage.getItem(WEATHER_PRECISE_PROMPT_KEY) || 0,
    );
    return Date.now() - lastPromptAt > WEATHER_PRECISE_PROMPT_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markPrecisePromptAttempt() {
  try {
    localStorage.setItem(WEATHER_PRECISE_PROMPT_KEY, String(Date.now()));
  } catch {
    // Ignore write failures.
  }
}

async function fetchLocationByIp() {
  const cached = readCachedIpLocation();
  if (cached) {
    return cached;
  }

  const providers = [
    {
      url: "https://ipwho.is/",
      parse: (data) => ({
        latitude: Number(data?.latitude),
        longitude: Number(data?.longitude),
        city: String(data?.city || ""),
        country: String(data?.country || ""),
      }),
      isValid: (data) => data && data.success !== false,
    },
    {
      url: "https://ipapi.co/json/",
      parse: (data) => ({
        latitude: Number(data?.latitude),
        longitude: Number(data?.longitude),
        city: String(data?.city || ""),
        country: String(data?.country_name || ""),
      }),
      isValid: (data) => data && !data.error,
    },
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url);
      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      if (!provider.isValid(data)) {
        continue;
      }

      const location = provider.parse(data);
      if (
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude)
      ) {
        continue;
      }

      saveCachedIpLocation(location);
      return location;
    } catch {
      // Try next provider
    }
  }

  throw new Error("IP location detection unavailable.");
}

async function fetchLocationFromBackend() {
  if (
    typeof window.MagnetoLocationApi?.fetchLocationFromBackend === "function"
  ) {
    return window.MagnetoLocationApi.fetchLocationFromBackend();
  }

  const response = await apiFetch("/api/location/auto");
  if (!response.ok) {
    throw new Error("Backend location unavailable.");
  }

  const data = await response.json();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Invalid backend location coordinates.");
  }

  return {
    latitude,
    longitude,
    city: String(data.city || ""),
    country: String(data.country || ""),
    source: String(data.source || "backend"),
  };
}

const TIMEZONE_LOCATION_FALLBACKS = {
  "Europe/Berlin": {
    latitude: 52.52,
    longitude: 13.405,
    city: "Berlin",
    country: "Germany",
  },
  "Europe/Bucharest": {
    latitude: 44.4268,
    longitude: 26.1025,
    city: "Bucharest",
    country: "Romania",
  },
};

function getTimezoneFallbackLocation() {
  return TIMEZONE_LOCATION_FALLBACKS[getBrowserTimeZone()] || null;
}

function getBrowserLocationWithoutPrompt() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
          city: "",
          country: "",
        });
      },
      () => reject(new Error("Geolocation unavailable.")),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 15 * 60 * 1000,
      },
    );
  });
}

async function fetchBestAutomaticLocation() {
  // 1) Reuse last known precise location first.
  const preciseCache = readCachedPreciseLocation();
  if (preciseCache) {
    return { ...preciseCache, source: "precise-cache" };
  }

  // 2) Exact location using browser geolocation.
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const permission = await navigator.permissions.query({
        name: "geolocation",
      });

      if (permission.state === "granted") {
        const precise = await getBrowserLocationWithoutPrompt();
        saveCachedPreciseLocation(precise);
        return { ...precise, source: "browser-granted" };
      }

      if (permission.state === "prompt" && canAttemptPrecisePrompt()) {
        markPrecisePromptAttempt();
        const precise = await getBrowserLocationWithoutPrompt();
        saveCachedPreciseLocation(precise);
        return { ...precise, source: "browser-prompted" };
      }
    }
  } catch {
    // Continue with non-precise providers.
  }

  // 3) Server-side IP lookup.
  try {
    return await fetchLocationFromBackend();
  } catch {
    // Continue with browser-side providers.
  }

  // 4) Browser-side IP providers.
  try {
    return await fetchLocationByIp();
  } catch {
    // Continue to timezone fallback.
  }

  // 5) Timezone fallback.
  const timezoneFallback = getTimezoneFallbackLocation();
  if (timezoneFallback) {
    return {
      ...timezoneFallback,
      source: "timezone-fallback",
    };
  }

  // Final deterministic fallback to avoid empty weather widget.
  return {
    latitude: 52.52,
    longitude: 13.405,
    city: "Berlin",
    country: "Germany",
    source: "default-fallback",
  };
}

function initWeatherWidget() {
  if (!weatherTemp || !weatherSummary || !weatherLocation || !weatherIcon) {
    return;
  }

  weatherSummary.textContent = "Detecting location automatically...";
  weatherLocation.textContent = "Using best available location without popup.";

  (async () => {
    try {
      const ipLocation = await fetchBestAutomaticLocation();
      const latitude = ipLocation.latitude;
      const longitude = ipLocation.longitude;

      const [weather, locationName] = await Promise.all([
        fetchWeatherByCoords(latitude, longitude),
        fetchLocationName(latitude, longitude).catch(() => ""),
      ]);

      const fallbackLabel = [ipLocation.city, ipLocation.country]
        .filter(Boolean)
        .join(", ");
      const locationText =
        locationName ||
        fallbackLabel ||
        `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`;

      setWeatherUI({ ...weather, locationText });
    } catch {
      weatherSummary.textContent = "Weather unavailable";
      weatherLocation.textContent = "Could not detect location automatically.";
    }
  })();
}

async function trackPageView(pageName) {
  if (typeof magnetoTrackingApi.trackPageView === "function") {
    return magnetoTrackingApi.trackPageView(pageName);
  }

  try {
    await apiFetch("/api/events/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: pageName }),
    });
  } catch {
    // No-op for tracking failures
  }
}

async function initResultsPage() {
  if (!resultsQuery || !resultsMeta || !resultsList) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const areResultsPrefsEnabled = () => {
    try {
      return localStorage.getItem(RESULTS_FILTER_PREFS_ENABLED_KEY) !== "0";
    } catch {
      return true;
    }
  };

  const setResultsPrefsEnabled = (enabled) => {
    try {
      localStorage.setItem(
        RESULTS_FILTER_PREFS_ENABLED_KEY,
        enabled ? "1" : "0",
      );
    } catch {
      // Keep search usable even if browser storage is unavailable.
    }
  };

  const syncResultsPrefsStateBadge = (enabled) => {
    if (!resultsRememberFiltersState) {
      return;
    }
    resultsRememberFiltersState.textContent = enabled
      ? "Preferences active"
      : "Preferences off";
    resultsRememberFiltersState.classList.toggle("is-off", !enabled);
  };

  const removeStoredResultsPrefs = () => {
    try {
      localStorage.removeItem(RESULTS_FILTER_PREFS_KEY);
    } catch {
      // Keep search usable even if browser storage is unavailable.
    }
  };

  const savedResultsPrefs = (() => {
    if (!areResultsPrefsEnabled()) {
      return {};
    }
    try {
      const raw = localStorage.getItem(RESULTS_FILTER_PREFS_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }
      return parsed;
    } catch {
      return {};
    }
  })();

  const hasParam = (name) => params.has(name);
  const pickParamOrSaved = (name, fallback = "") => {
    if (hasParam(name)) {
      return String(params.get(name) || "").trim();
    }
    return String(savedResultsPrefs?.[name] || fallback).trim();
  };

  const normalizeSort = (value) => {
    const normalized = String(value || "relevance")
      .trim()
      .toLowerCase();
    if (normalized === "newest" || normalized === "quality") {
      return normalized;
    }
    return "relevance";
  };

  const normalizeLimit = (value) => {
    const normalized = String(value || "20").trim();
    return /^\d+$/.test(normalized) ? normalized : "20";
  };

  const initialQuery = String(params.get("q") || "").trim();
  const initialLanguage = pickParamOrSaved("language", "");
  const initialCategory = String(params.get("category") || "").trim();
  const initialSource = String(params.get("source") || "").trim();
  const initialSort = normalizeSort(pickParamOrSaved("sort", "relevance"));
  const initialLimit = normalizeLimit(pickParamOrSaved("limit", "20"));
  const initialPageRaw = String(params.get("page") || "").trim();
  const initialPage = /^\d+$/.test(initialPageRaw) ? Number(initialPageRaw) : 1;

  if (!initialQuery) {
    resultsQuery.textContent = "No active search";
    resultsMeta.textContent = "Go back to homepage and enter a query.";
    if (resultsActiveContext) {
      resultsActiveContext.hidden = true;
      resultsActiveContext.innerHTML = "";
    }
    if (resultsPagination) {
      resultsPagination.hidden = true;
    }
    if (resultsFacets) {
      resultsFacets.hidden = true;
    }
    return;
  }

  if (resultsFilterLanguage) {
    resultsFilterLanguage.value = initialLanguage;
  }
  if (resultsFilterCategory) {
    resultsFilterCategory.value = initialCategory;
  }
  if (resultsFilterSource) {
    resultsFilterSource.value = initialSource;
  }
  if (resultsFilterSort) {
    resultsFilterSort.value = initialSort;
  }
  if (resultsFilterLimit) {
    resultsFilterLimit.value = initialLimit;
  }
  if (resultsRememberFilters) {
    const enabled = areResultsPrefsEnabled();
    resultsRememberFilters.checked = enabled;
    syncResultsPrefsStateBadge(enabled);
  } else {
    syncResultsPrefsStateBadge(areResultsPrefsEnabled());
  }

  let currentQuery = initialQuery;
  const renderResultsHeading = () => {
    resultsQuery.textContent = `Results for: ${currentQuery}`;
  };
  renderResultsHeading();

  async function copyCurrentResultsLink() {
    const shareUrl = String(window.location.href || "");
    if (!shareUrl) {
      showResultsPrefsToast("Could not read current link.");
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const fallbackInput = document.createElement("textarea");
        fallbackInput.value = shareUrl;
        fallbackInput.setAttribute("readonly", "true");
        fallbackInput.style.position = "fixed";
        fallbackInput.style.opacity = "0";
        document.body.appendChild(fallbackInput);
        fallbackInput.select();
        document.execCommand("copy");
        fallbackInput.remove();
      }
      showResultsPrefsToast("Shareable link copied.");
    } catch {
      showResultsPrefsToast("Could not copy link. Use the address bar.");
    }
  }

  function renderResultsActiveContext(context) {
    if (!resultsActiveContext) {
      return;
    }

    if (!context || !String(context.query || "").trim()) {
      resultsActiveContext.hidden = true;
      resultsActiveContext.innerHTML = "";
      return;
    }

    const chips = [];
    chips.push(`Query: ${context.query}`);
    if (context.language) {
      chips.push(`Language: ${context.language}`);
    }
    if (context.category) {
      chips.push(`Category: ${context.category}`);
    }
    if (context.source) {
      chips.push(`Source: ${context.source}`);
    }
    if (context.sort) {
      chips.push(`Sort: ${context.sort}`);
    }
    if (context.limit) {
      chips.push(`Limit: ${context.limit}`);
    }
    if (Number.isFinite(Number(context.page)) && Number(context.page) > 1) {
      chips.push(`Page: ${Number(context.page)}`);
    }
    if (Number.isFinite(Number(context.total))) {
      chips.push(`Results: ${Number(context.total)}`);
    }

    const hasRefinements =
      Boolean(context.language) ||
      Boolean(context.category) ||
      Boolean(context.source) ||
      String(context.sort || "relevance").toLowerCase() !== "relevance" ||
      String(context.limit || "20") !== "20" ||
      (Number.isFinite(Number(context.page)) && Number(context.page) > 1);

    resultsActiveContext.innerHTML = "";
    chips.forEach((chipText) => {
      const chip = document.createElement("span");
      chip.className = "results-active-chip";
      chip.textContent = chipText;
      resultsActiveContext.appendChild(chip);
    });

    const shareChip = document.createElement("button");
    shareChip.type = "button";
    shareChip.className = "results-active-chip results-active-chip-share";
    shareChip.textContent = "Copy shareable link";
    shareChip.addEventListener("click", async () => {
      await copyCurrentResultsLink();
    });
    resultsActiveContext.appendChild(shareChip);

    if (hasRefinements) {
      const clearChip = document.createElement("button");
      clearChip.type = "button";
      clearChip.className = "results-active-chip results-active-chip-action";
      clearChip.textContent = "Clear filters";
      clearChip.addEventListener("click", async () => {
        if (resultsFilterLanguage) {
          resultsFilterLanguage.value = "";
        }
        if (resultsFilterCategory) {
          resultsFilterCategory.value = "";
        }
        if (resultsFilterSource) {
          resultsFilterSource.value = "";
        }
        if (resultsFilterSort) {
          resultsFilterSort.value = "relevance";
        }
        if (resultsFilterLimit) {
          resultsFilterLimit.value = "20";
        }
        currentPage = 1;
        persistResultsFilterPrefs();
        await performResultsSearch(true, 1);
      });
      resultsActiveContext.appendChild(clearChip);
    }

    resultsActiveContext.hidden = chips.length === 0;
  }

  function formatResultsSort(value) {
    const normalized = String(value || "relevance")
      .trim()
      .toLowerCase();
    if (normalized === "newest") {
      return "Newest";
    }
    if (normalized === "quality") {
      return "Quality";
    }
    return "Relevance";
  }

  function extractHostname(rawUrl) {
    try {
      return new URL(String(rawUrl || "")).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function formatResultDate(rawValue) {
    if (!rawValue) {
      return "";
    }
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  let currentPage = Math.max(1, initialPage);
  let resultsPrefsToastTimerId = null;
  let lastPagination = {
    page: currentPage,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
    total: 0,
  };

  function setResultsUrl(pageValue) {
    const language = String(resultsFilterLanguage?.value || "").trim();
    const category = String(resultsFilterCategory?.value || "").trim();
    const source = String(resultsFilterSource?.value || "").trim();
    const sort =
      String(resultsFilterSort?.value || "relevance").trim() || "relevance";
    const limit = String(resultsFilterLimit?.value || "20").trim() || "20";

    const urlParams = new URLSearchParams({
      q: currentQuery,
      limit,
      page: String(pageValue),
    });
    if (language) {
      urlParams.set("language", language);
    }
    if (category) {
      urlParams.set("category", category);
    }
    if (source) {
      urlParams.set("source", source);
    }
    if (sort) {
      urlParams.set("sort", sort);
    }
    window.history.replaceState({}, "", `results.html?${urlParams.toString()}`);
  }

  function persistResultsFilterPrefs() {
    if (!areResultsPrefsEnabled()) {
      removeStoredResultsPrefs();
      return;
    }

    const nextPrefs = {
      language: String(resultsFilterLanguage?.value || "").trim(),
      sort: normalizeSort(String(resultsFilterSort?.value || "relevance")),
      limit: normalizeLimit(String(resultsFilterLimit?.value || "20")),
    };

    try {
      localStorage.setItem(RESULTS_FILTER_PREFS_KEY, JSON.stringify(nextPrefs));
    } catch {
      // Keep search functional even if browser storage is unavailable.
    }
  }

  function showResultsPrefsToast(message) {
    if (!resultsPrefsToast) {
      return;
    }

    if (resultsPrefsToastTimerId != null) {
      window.clearTimeout(resultsPrefsToastTimerId);
      resultsPrefsToastTimerId = null;
    }

    resultsPrefsToast.textContent = String(message || "");
    resultsPrefsToast.hidden = false;
    resultsPrefsToast.classList.remove("is-visible");
    window.requestAnimationFrame(() => {
      resultsPrefsToast.classList.add("is-visible");
    });

    resultsPrefsToastTimerId = window.setTimeout(() => {
      resultsPrefsToast.classList.remove("is-visible");
      window.setTimeout(() => {
        if (resultsPrefsToast) {
          resultsPrefsToast.hidden = true;
        }
      }, 190);
    }, 1800);
  }

  function renderFacets(facets) {
    if (!resultsFacets) {
      return;
    }

    resultsFacets.innerHTML = "";

    const groups = [
      {
        key: "languages",
        label: "Language",
        target: resultsFilterLanguage,
      },
      {
        key: "categories",
        label: "Category",
        target: resultsFilterCategory,
      },
      {
        key: "sources",
        label: "Source",
        target: resultsFilterSource,
      },
    ];

    let hasAnyFacet = false;
    for (const group of groups) {
      const entries = Array.isArray(facets?.[group.key])
        ? facets[group.key]
        : [];
      for (const entry of entries.slice(0, 8)) {
        const value = String(entry?.value || "").trim();
        const count = Number(entry?.count || 0);
        if (!value || count <= 0) {
          continue;
        }

        hasAnyFacet = true;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "results-facet-chip";
        chip.textContent = `${group.label}: ${value} (${count})`;
        chip.addEventListener("click", async () => {
          if (!group.target) {
            return;
          }
          group.target.value = value;
          currentPage = 1;
          await performResultsSearch(true, 1);
        });
        resultsFacets.appendChild(chip);
      }
    }

    resultsFacets.hidden = !hasAnyFacet;
  }

  function renderPagination(pagination) {
    if (
      !resultsPagination ||
      !resultsPrevPage ||
      !resultsNextPage ||
      !resultsPageMeta
    ) {
      return;
    }

    const total = Number(pagination?.total || 0);
    const page = Number(pagination?.page || 1);
    const totalPages = Number(pagination?.totalPages || 0);
    const hasPrev = Boolean(pagination?.hasPrevPage);
    const hasNext = Boolean(pagination?.hasNextPage);

    if (total <= 0) {
      resultsPagination.hidden = true;
      resultsPageMeta.textContent = "Page 1 of 1";
      resultsPrevPage.disabled = true;
      resultsNextPage.disabled = true;
      if (resultsPageNumbers) {
        resultsPageNumbers.innerHTML = "";
      }
      return;
    }

    resultsPagination.hidden = false;
    resultsPageMeta.textContent = `Page ${page} of ${Math.max(1, totalPages)}`;
    resultsPrevPage.disabled = !hasPrev;
    resultsNextPage.disabled = !hasNext;

    if (!resultsPageNumbers) {
      return;
    }

    const visiblePages = [];
    const windowStart = Math.max(1, page - 2);
    const windowEnd = Math.min(totalPages, page + 2);

    visiblePages.push(1);
    for (let idx = windowStart; idx <= windowEnd; idx += 1) {
      if (idx !== 1 && idx !== totalPages) {
        visiblePages.push(idx);
      }
    }
    if (totalPages > 1) {
      visiblePages.push(totalPages);
    }

    const orderedUnique = [];
    for (const candidate of visiblePages) {
      if (!orderedUnique.includes(candidate)) {
        orderedUnique.push(candidate);
      }
    }
    orderedUnique.sort((a, b) => a - b);

    resultsPageNumbers.innerHTML = "";
    let lastPage = 0;
    for (const pageNumber of orderedUnique) {
      if (pageNumber - lastPage > 1) {
        const ellipsis = document.createElement("span");
        ellipsis.className = "results-page-ellipsis";
        ellipsis.textContent = "...";
        resultsPageNumbers.appendChild(ellipsis);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "results-page-number";
      if (pageNumber === page) {
        button.classList.add("active");
      }
      button.textContent = String(pageNumber);
      button.disabled = pageNumber === page;
      button.addEventListener("click", async () => {
        currentPage = pageNumber;
        await performResultsSearch(true, pageNumber);
      });
      resultsPageNumbers.appendChild(button);

      lastPage = pageNumber;
    }
  }

  function renderResultsStateCard(
    message,
    tone = "neutral",
    withRetry = false,
  ) {
    resultsList.innerHTML = "";

    const li = document.createElement("li");
    li.className = `result-card results-state-card ${tone === "error" ? "results-state-card-error" : "results-state-card-neutral"}`;

    const description = document.createElement("p");
    description.className = "result-description";
    description.textContent = String(message || "No data available.");
    li.appendChild(description);

    if (withRetry) {
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "results-state-action";
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", async () => {
        await performResultsSearch(true, currentPage);
      });
      li.appendChild(retryBtn);
    }

    resultsList.appendChild(li);
  }

  function renderResultsLoadingState() {
    resultsList.innerHTML = "";
    for (let index = 0; index < 3; index += 1) {
      const li = document.createElement("li");
      li.className = "result-card result-card-loading";

      const title = document.createElement("span");
      title.className = "results-skeleton results-skeleton-title";

      const lineA = document.createElement("span");
      lineA.className = "results-skeleton results-skeleton-line";

      const lineB = document.createElement("span");
      lineB.className =
        "results-skeleton results-skeleton-line results-skeleton-line-short";

      li.append(title, lineA, lineB);
      resultsList.appendChild(li);
    }
  }

  async function performResultsSearch(updateUrl = false, pageOverride = null) {
    const language = String(resultsFilterLanguage?.value || "").trim();
    const category = String(resultsFilterCategory?.value || "").trim();
    const source = String(resultsFilterSource?.value || "").trim();
    const sort =
      String(resultsFilterSort?.value || "relevance").trim() || "relevance";
    const limit = String(resultsFilterLimit?.value || "20").trim() || "20";
    const targetPage = Math.max(
      1,
      Number.isFinite(Number(pageOverride))
        ? Number(pageOverride)
        : currentPage,
    );

    const requestParams = new URLSearchParams({
      q: currentQuery,
      limit,
      page: String(targetPage),
    });
    if (language) {
      requestParams.set("language", language);
    }
    if (category) {
      requestParams.set("category", category);
    }
    if (source) {
      requestParams.set("source", source);
    }
    if (sort) {
      requestParams.set("sort", sort);
    }

    if (updateUrl) {
      setResultsUrl(targetPage);
    }

    persistResultsFilterPrefs();

    resultsMeta.textContent = "Loading data from MAGNETO Core...";
    renderResultsActiveContext({
      query: currentQuery,
      language,
      category,
      source,
      sort,
      limit,
      page: targetPage,
    });
    resultsList.setAttribute("aria-busy", "true");
    renderResultsLoadingState();
    if (resultsRelated) {
      resultsRelated.hidden = true;
    }

    try {
      const response = await apiFetch(
        `/api/search?${requestParams.toString()}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Search request failed.");
      }

      if (resultsAssist) {
        resultsAssist.hidden = true;
      }
      if (resultsDidYouMean) {
        resultsDidYouMean.hidden = true;
        resultsDidYouMean.innerHTML = "";
      }
      if (resultsSuggestChips) {
        resultsSuggestChips.hidden = true;
        resultsSuggestChips.innerHTML = "";
      }

      const correction = payload.queryCorrection || null;
      const correctionOriginal = String(correction?.originalQuery || "").trim();
      const correctionApplied = String(correction?.correctedQuery || "").trim();

      if (
        resultsAssist &&
        resultsDidYouMean &&
        correctionOriginal &&
        correctionApplied &&
        correctionOriginal.toLowerCase() !== correctionApplied.toLowerCase() &&
        String(payload.queryUsed || "")
          .trim()
          .toLowerCase() === correctionApplied.toLowerCase()
      ) {
        const prefix = document.createElement("span");
        prefix.textContent = `Showing results for ${correctionApplied}. `;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "results-didyoumean-btn";
        btn.textContent = `Search instead for ${correctionOriginal}`;
        btn.addEventListener("click", async () => {
          currentQuery = correctionOriginal;
          currentPage = 1;
          renderResultsHeading();
          await performResultsSearch(true, 1);
        });

        resultsDidYouMean.append(prefix, btn);
        resultsDidYouMean.hidden = false;
        resultsAssist.hidden = false;
      }

      // Proactive "Did you mean?" hint — shown even when results exist but are sparse.
      const suggestion = payload.querySuggestion || null;
      const suggestionQuery = String(suggestion?.correctedQuery || "").trim();
      if (
        resultsAssist &&
        resultsDidYouMean &&
        suggestionQuery &&
        suggestionQuery.toLowerCase() !==
          String(currentQuery || "")
            .trim()
            .toLowerCase() &&
        !correctionApplied // don't double-show with auto-correction
      ) {
        resultsDidYouMean.innerHTML = "";
        const hintPrefix = document.createElement("span");
        hintPrefix.textContent = "Did you mean: ";
        const hintBtn = document.createElement("button");
        hintBtn.type = "button";
        hintBtn.className = "results-didyoumean-btn";
        hintBtn.textContent = suggestionQuery;
        hintBtn.addEventListener("click", async () => {
          currentQuery = suggestionQuery;
          currentPage = 1;
          renderResultsHeading();
          await performResultsSearch(true, 1);
        });
        resultsDidYouMean.append(hintPrefix, hintBtn);
        resultsDidYouMean.hidden = false;
        resultsAssist.hidden = false;
      }

      if (resultsAssist && resultsSuggestChips) {
        const suggestions = Array.isArray(payload.suggestions)
          ? payload.suggestions
              .map((item) => String(item || "").trim())
              .filter((item) => item.length > 0)
              .filter((item, index, arr) => arr.indexOf(item) === index)
              .filter(
                (item) => item.toLowerCase() !== currentQuery.toLowerCase(),
              )
              .slice(0, 5)
          : [];

        if (suggestions.length > 0) {
          suggestions.forEach((suggestion) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "results-suggest-chip";
            chip.textContent = suggestion;
            chip.addEventListener("click", async () => {
              currentQuery = suggestion;
              currentPage = 1;
              renderResultsHeading();
              await performResultsSearch(true, 1);
            });
            resultsSuggestChips.appendChild(chip);
          });

          resultsSuggestChips.hidden = false;
          resultsAssist.hidden = false;
        }
      }

      const applied = payload.appliedFilters || {};
      currentPage = Number(payload.pagination?.page || targetPage || 1);
      lastPagination = payload.pagination || lastPagination;
      const appliedParts = [];
      if (applied.language) {
        appliedParts.push(`language: ${applied.language}`);
      }
      if (applied.category) {
        appliedParts.push(`category: ${applied.category}`);
      }
      if (applied.source) {
        appliedParts.push(`source: ${applied.source}`);
      }
      if (applied.sort) {
        appliedParts.push(`sort: ${applied.sort}`);
      }
      if (applied.limit) {
        appliedParts.push(`limit: ${applied.limit}`);
      }
      if (applied.page) {
        appliedParts.push(`page: ${applied.page}`);
      }
      const filtersText = appliedParts.length
        ? ` | Filters: ${appliedParts.join(", ")}`
        : "";
      resultsMeta.textContent = `${payload.total} results from ${payload.engine}${filtersText}`;
      renderResultsActiveContext({
        query: currentQuery,
        language: applied.language || language,
        category: applied.category || category,
        source: applied.source || source,
        sort: applied.sort || sort,
        limit: applied.limit || limit,
        page: applied.page || currentPage,
        total: payload.total,
      });
      if (resultsCountValue) {
        resultsCountValue.textContent = String(payload.total || 0);
      }
      if (resultsSortValue) {
        resultsSortValue.textContent = formatResultsSort(applied.sort);
      }
      if (resultsScopeValue) {
        resultsScopeValue.textContent = String(
          applied.source || payload.engine || "MAGNETO Core",
        );
      }
      renderFacets(payload.facets || {});
      renderPagination(payload.pagination || {});

      if (!Array.isArray(payload.results) || payload.results.length === 0) {
        renderResultsStateCard(
          "No exact matches in MAGNETO Core index. Try broader terms or relax one filter.",
        );
        renderPagination(payload.pagination || {});
        resultsList.setAttribute("aria-busy", "false");
        return;
      }

      resultsList.innerHTML = "";

      for (const item of payload.results) {
        const li = document.createElement("li");
        li.className = "result-card";
        li.style.animationDelay = `${Math.min(resultsList.children.length * 55, 330)}ms`;

        const top = document.createElement("div");
        top.className = "result-card-top";

        const pills = document.createElement("div");
        pills.className = "result-card-pills";

        const categoryPill = document.createElement("span");
        categoryPill.className = "result-pill";
        categoryPill.textContent = item.category || "General";
        pills.appendChild(categoryPill);

        if (item.language) {
          const languagePill = document.createElement("span");
          languagePill.className = "result-pill";
          languagePill.textContent = String(item.language).toUpperCase();
          pills.appendChild(languagePill);
        }

        const domain = document.createElement("p");
        domain.className = "result-domain";
        domain.textContent = extractHostname(item.url);

        top.append(pills, domain);

        const anchor = document.createElement("a");
        anchor.className = "result-link";
        anchor.href = item.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = item.title;
        anchor.addEventListener("click", () => {
          trackResultClick(item.url, item.title, currentQuery, {
            category: item.category || "",
            sourceSlug: item.sourceSlug || "",
            sourceName: item.sourceName || "",
            position: Number(item.position || 0),
            score: Number(item.score || item.doc_score || 0),
          });
        });

        const description = document.createElement("p");
        description.className = "result-description";
        description.innerHTML = item.snippetHtml || escapeHtml(item.summary);

        const metaLine = document.createElement("p");
        metaLine.className = "result-meta";
        const metaParts = [];
        if (item.sourceName) {
          metaParts.push(`source: ${item.sourceName}`);
        }
        if (typeof item.qualityScore !== "undefined") {
          metaParts.push(`quality: ${item.qualityScore}`);
        }
        metaLine.textContent = metaParts.length ? metaParts.join(" | ") : "";

        const footer = document.createElement("div");
        footer.className = "result-footer";

        if (item.sourceName) {
          const sourceChip = document.createElement("span");
          sourceChip.className = "result-footer-chip";
          sourceChip.textContent = `Source: ${item.sourceName}`;
          footer.appendChild(sourceChip);
        }

        const dateText = formatResultDate(item.fetchedAt);
        if (dateText) {
          const freshnessChip = document.createElement("span");
          freshnessChip.className = "result-footer-chip";
          freshnessChip.textContent = `Indexed: ${dateText}`;
          footer.appendChild(freshnessChip);
        }

        if (typeof item.qualityScore !== "undefined") {
          const qualityChip = document.createElement("span");
          qualityChip.className = "result-footer-chip";
          qualityChip.textContent = `Quality: ${item.qualityScore}`;
          footer.appendChild(qualityChip);
        }

        li.append(top, anchor, description);
        if (metaLine.textContent) {
          li.appendChild(metaLine);
        }
        if (footer.childNodes.length > 0) {
          li.appendChild(footer);
        }
        resultsList.appendChild(li);
      }

      // Related queries section — powered by session co-occurrence tracking.
      if (resultsRelated) {
        resultsRelated.innerHTML = "";
        resultsRelated.hidden = true;
        const related = Array.isArray(payload.relatedQueries)
          ? payload.relatedQueries
              .map((q) => String(q || "").trim())
              .filter((q) => q.length > 0)
              .filter((q) => q.toLowerCase() !== currentQuery.toLowerCase())
              .slice(0, 6)
          : [];
        if (related.length > 0) {
          const title = document.createElement("p");
          title.className = "results-related-title";
          title.textContent = "Related searches";
          resultsRelated.appendChild(title);
          const chips = document.createElement("div");
          chips.className = "results-related-chips";
          related.forEach((q) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "results-suggest-chip results-related-chip";
            chip.textContent = q;
            chip.addEventListener("click", async () => {
              currentQuery = q;
              currentPage = 1;
              renderResultsHeading();
              await performResultsSearch(true, 1);
            });
            chips.appendChild(chip);
          });
          resultsRelated.appendChild(chips);
          resultsRelated.hidden = false;
        }
      }
      resultsList.setAttribute("aria-busy", "false");
    } catch (error) {
      const apiBaseLabel = API_BASE_URL || "(relative /api)";
      const baseMessage = error.message || "Could not load results.";
      resultsMeta.textContent = `${baseMessage} API base: ${apiBaseLabel}`;
      renderResultsActiveContext({
        query: currentQuery,
        language,
        category,
        source,
        sort,
        limit,
        page: targetPage,
      });
      renderResultsStateCard(
        "We could not load results right now. Check connectivity or try again.",
        "error",
        true,
      );
      if (resultsAssist) {
        resultsAssist.hidden = true;
      }
      if (resultsCountValue) {
        resultsCountValue.textContent = "0";
      }
      if (resultsFacets) {
        resultsFacets.hidden = true;
        resultsFacets.innerHTML = "";
      }
      if (resultsPagination) {
        resultsPagination.hidden = true;
      }
      resultsList.setAttribute("aria-busy", "false");
    }
  }

  if (resultsFilters) {
    resultsFilters.addEventListener("submit", async (event) => {
      event.preventDefault();
      currentPage = 1;
      await performResultsSearch(true, 1);
    });
  }

  const resetResultsFiltersAndSearch = async () => {
    if (resultsFilterLanguage) {
      resultsFilterLanguage.value = "";
    }
    if (resultsFilterCategory) {
      resultsFilterCategory.value = "";
    }
    if (resultsFilterSource) {
      resultsFilterSource.value = "";
    }
    if (resultsFilterSort) {
      resultsFilterSort.value = "relevance";
    }
    if (resultsFilterLimit) {
      resultsFilterLimit.value = "20";
    }
    currentPage = 1;
    persistResultsFilterPrefs();
    await performResultsSearch(true, 1);
  };

  if (resultsFilterReset) {
    resultsFilterReset.addEventListener("click", async () => {
      await resetResultsFiltersAndSearch();
    });
  }

  if (resultsRememberFilters) {
    resultsRememberFilters.addEventListener("change", () => {
      const enabled = Boolean(resultsRememberFilters.checked);
      setResultsPrefsEnabled(enabled);
      syncResultsPrefsStateBadge(enabled);
      if (enabled) {
        persistResultsFilterPrefs();
        showResultsPrefsToast("Filter memory enabled.");
      } else {
        removeStoredResultsPrefs();
        showResultsPrefsToast("Filter memory disabled.");
      }
    });
  }

  window.addEventListener("keydown", async (event) => {
    if (!resultsFilters) {
      return;
    }

    const activeElement = document.activeElement;
    const activeTag = String(activeElement?.tagName || "").toLowerCase();
    const isTypingContext =
      activeTag === "input" ||
      activeTag === "textarea" ||
      activeTag === "select" ||
      Boolean(activeElement?.isContentEditable);

    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isTypingContext &&
      resultsFilterSource
    ) {
      event.preventDefault();
      resultsFilterSource.focus();
      resultsFilterSource.select();
      return;
    }

    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey
    ) {
      event.preventDefault();
      currentPage = 1;
      await performResultsSearch(true, 1);
      return;
    }

    if (
      event.key.toLowerCase() === "r" &&
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      await resetResultsFiltersAndSearch();
    }
  });

  if (resultsScrollTopBtn) {
    const syncScrollTopButton = () => {
      const isVisible = window.scrollY > 420;
      resultsScrollTopBtn.hidden = !isVisible;
      resultsScrollTopBtn.classList.toggle("is-visible", isVisible);
    };

    resultsScrollTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", syncScrollTopButton, {
      passive: true,
    });
    syncScrollTopButton();
  }

  if (resultsPrevPage) {
    resultsPrevPage.addEventListener("click", async () => {
      if (!lastPagination.hasPrevPage) {
        return;
      }
      currentPage = Math.max(1, currentPage - 1);
      await performResultsSearch(true, currentPage);
    });
  }

  if (resultsNextPage) {
    resultsNextPage.addEventListener("click", async () => {
      if (!lastPagination.hasNextPage) {
        return;
      }
      currentPage += 1;
      await performResultsSearch(true, currentPage);
    });
  }

  async function loadSourceSuggestions(partial = "") {
    if (!resultsSourceOptions) {
      return;
    }

    const q = String(partial || "").trim();
    const sourceParams = new URLSearchParams();
    if (q) {
      sourceParams.set("q", q);
    }
    sourceParams.set("limit", "30");

    try {
      const response = await apiFetch(
        `/api/search/sources?${sourceParams.toString()}`,
      );
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.sources)) {
        return;
      }

      resultsSourceOptions.innerHTML = "";
      payload.sources.forEach((entry) => {
        const slug = String(entry.slug || "").trim();
        const name = String(entry.name || "").trim();
        if (!slug && !name) {
          return;
        }

        const slugOption = document.createElement("option");
        slugOption.value = slug || name;
        resultsSourceOptions.appendChild(slugOption);

        if (name && name.toLowerCase() !== slug.toLowerCase()) {
          const nameOption = document.createElement("option");
          nameOption.value = name;
          resultsSourceOptions.appendChild(nameOption);
        }
      });
    } catch {
      // Keep search usable even if suggestions endpoint is unavailable.
    }
  }

  if (resultsFilterSource) {
    resultsFilterSource.addEventListener("input", () => {
      loadSourceSuggestions(resultsFilterSource.value);
    });
  }

  await loadSourceSuggestions(initialSource);

  await performResultsSearch(false, currentPage);
}

function setAdminStatus(message, isError = false) {
  if (!adminAuthStatus) {
    return;
  }

  adminAuthStatus.textContent = message;
  adminAuthStatus.classList.toggle("error", isError);
}

function getAdminToken() {
  if (typeof magnetoAdminState.getAdminToken === "function") {
    return magnetoAdminState.getAdminToken();
  }

  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
  if (typeof magnetoAdminState.setAdminToken === "function") {
    magnetoAdminState.setAdminToken(token);
    return;
  }

  if (!token) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }

  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function openAdminDashboardPage(path) {
  const token = getAdminToken();
  if (!token) {
    setAdminStatus("Please sign in first.", true);
    return;
  }

  const target = String(path || "").trim();
  if (!target) {
    return;
  }

  window.open(target, "_blank", "noopener,noreferrer");
}

function areAdminClickSnapshotsEquivalent(a, b) {
  if (!a || !b) {
    return false;
  }

  return (
    Number(a.searchesEvaluated || 0) === Number(b.searchesEvaluated || 0) &&
    Number(a.docsEvaluated || 0) === Number(b.docsEvaluated || 0) &&
    Number(a.boostApplied || 0) === Number(b.boostApplied || 0) &&
    Number(a.suppressedMinBase || 0) === Number(b.suppressedMinBase || 0) &&
    Number(a.suppressedNoSignal || 0) === Number(b.suppressedNoSignal || 0) &&
    Number(a.cappedByGuardrail || 0) === Number(b.cappedByGuardrail || 0) &&
    Number(a.totalBoost || 0) === Number(b.totalBoost || 0) &&
    Math.abs(Number(a.avgBoostApplied || 0) - Number(b.avgBoostApplied || 0)) <
      0.0005
  );
}

function getAdminClickSnapshotTimeMs(item) {
  const parsed = Date.parse(String(item?.at || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAdminClickSnapshotHistory(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const dedupeWindowMs = 2 * 60 * 1000;
  const normalized = items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      at: String(item.at || item.generatedAt || new Date().toISOString()),
      searchesEvaluated: Number(item.searchesEvaluated || 0),
      docsEvaluated: Number(item.docsEvaluated || 0),
      boostApplied: Number(item.boostApplied || 0),
      suppressedMinBase: Number(item.suppressedMinBase || 0),
      suppressedNoSignal: Number(item.suppressedNoSignal || 0),
      cappedByGuardrail: Number(item.cappedByGuardrail || 0),
      totalBoost: Number(item.totalBoost || 0),
      avgBoostApplied: Number(item.avgBoostApplied || 0),
    }))
    .sort((a, b) => {
      return getAdminClickSnapshotTimeMs(b) - getAdminClickSnapshotTimeMs(a);
    });

  const deduped = [];
  for (const item of normalized) {
    const previous = deduped[deduped.length - 1];
    if (!previous) {
      deduped.push(item);
      continue;
    }

    const sameTelemetry = areAdminClickSnapshotsEquivalent(item, previous);
    const timeGapMs = Math.abs(
      getAdminClickSnapshotTimeMs(item) - getAdminClickSnapshotTimeMs(previous),
    );
    if (sameTelemetry && timeGapMs <= dedupeWindowMs) {
      continue;
    }

    deduped.push(item);
  }

  return deduped.slice(0, ADMIN_CLICK_SNAPSHOT_HISTORY_MAX);
}

function getAdminClickSnapshotHistory() {
  try {
    const raw = localStorage.getItem(ADMIN_CLICK_SNAPSHOT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const normalized = normalizeAdminClickSnapshotHistory(parsed);

    if (
      Array.isArray(parsed) &&
      JSON.stringify(parsed) !== JSON.stringify(normalized)
    ) {
      const compactedCount = Math.max(0, parsed.length - normalized.length);
      localStorage.setItem(
        ADMIN_CLICK_SNAPSHOT_HISTORY_KEY,
        JSON.stringify(normalized),
      );
      adminClickSnapshotAutoHealState = {
        ran: true,
        at: new Date().toISOString(),
        compactedCount,
      };
    }

    return normalized;
  } catch {
    return [];
  }
}

function getAdminClickSnapshotAutoHealText() {
  if (!adminClickSnapshotAutoHealState.ran) {
    return "";
  }

  const healedAtMs = Date.parse(
    String(adminClickSnapshotAutoHealState.at || ""),
  );
  if (
    Number.isFinite(healedAtMs) &&
    Date.now() - healedAtMs > ADMIN_CLICK_SNAPSHOT_AUTOHEAL_VISIBLE_MS
  ) {
    adminClickSnapshotAutoHealState = {
      ran: false,
      at: "",
      compactedCount: 0,
    };
    return "";
  }

  const atLabel = adminClickSnapshotAutoHealState.at
    ? new Date(adminClickSnapshotAutoHealState.at).toLocaleString()
    : "just now";
  return ` Auto-heal applied at ${atLabel} (${adminClickSnapshotAutoHealState.compactedCount} merged).`;
}

function getAdminClickSnapshotHistoryCleanupInfo() {
  try {
    const raw = localStorage.getItem(ADMIN_CLICK_SNAPSHOT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const rawCount = Array.isArray(parsed) ? parsed.length : 0;
    const normalizedCount = normalizeAdminClickSnapshotHistory(parsed).length;
    return {
      rawCount,
      normalizedCount,
      compactedCount: Math.max(0, rawCount - normalizedCount),
    };
  } catch {
    return {
      rawCount: 0,
      normalizedCount: 0,
      compactedCount: 0,
    };
  }
}

function buildAdminClickSnapshotCleanupSignature(cleanupInfo, latest) {
  const latestAt = String(latest?.at || "");
  return [
    Number(cleanupInfo?.compactedCount || 0),
    Number(cleanupInfo?.rawCount || 0),
    Number(cleanupInfo?.normalizedCount || 0),
    latestAt,
  ].join("|");
}

function getDismissedAdminClickSnapshotCleanupSignature() {
  try {
    return String(
      localStorage.getItem(ADMIN_CLICK_SNAPSHOT_CLEANUP_DISMISS_KEY) || "",
    );
  } catch {
    return "";
  }
}

function setDismissedAdminClickSnapshotCleanupSignature(signature) {
  try {
    const normalized = String(signature || "").trim();
    if (!normalized) {
      localStorage.removeItem(ADMIN_CLICK_SNAPSHOT_CLEANUP_DISMISS_KEY);
      return;
    }
    localStorage.setItem(ADMIN_CLICK_SNAPSHOT_CLEANUP_DISMISS_KEY, normalized);
  } catch {
    // Non-blocking when storage is unavailable.
  }
}

function saveAdminClickSnapshotHistory(items) {
  const safe = normalizeAdminClickSnapshotHistory(items);

  try {
    localStorage.setItem(
      ADMIN_CLICK_SNAPSHOT_HISTORY_KEY,
      JSON.stringify(safe),
    );
  } catch {
    // Non-blocking when storage is unavailable.
  }
}

function addAdminClickSnapshotHistoryItem(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  const telemetry = snapshot.clickSignalTelemetry || {};
  const item = {
    at: String(snapshot.generatedAt || new Date().toISOString()),
    searchesEvaluated: Number(telemetry.searchesEvaluated || 0),
    docsEvaluated: Number(telemetry.docsEvaluated || 0),
    boostApplied: Number(telemetry.boostApplied || 0),
    suppressedMinBase: Number(telemetry.suppressedMinBase || 0),
    suppressedNoSignal: Number(telemetry.suppressedNoSignal || 0),
    cappedByGuardrail: Number(telemetry.cappedByGuardrail || 0),
    totalBoost: Number(telemetry.totalBoost || 0),
    avgBoostApplied: Number(telemetry.lastRun?.avgBoostApplied || 0),
  };

  const history = getAdminClickSnapshotHistory();
  const latest = history[0];
  if (latest && areAdminClickSnapshotsEquivalent(item, latest)) {
    const latestTime = Date.parse(String(latest.at || ""));
    const itemTime = Date.parse(String(item.at || ""));
    const latestMs = Number.isFinite(latestTime) ? latestTime : 0;
    const itemMs = Number.isFinite(itemTime) ? itemTime : 0;
    const dedupeWindowMs = 2 * 60 * 1000;

    if (Math.abs(itemMs - latestMs) <= dedupeWindowMs) {
      return;
    }
  }

  history.unshift(item);
  saveAdminClickSnapshotHistory(history);
}

function getAdminClickSnapshotBaseline() {
  try {
    const raw = localStorage.getItem(ADMIN_CLICK_SNAPSHOT_BASELINE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveAdminClickSnapshotBaseline(item) {
  if (!item || typeof item !== "object") {
    localStorage.removeItem(ADMIN_CLICK_SNAPSHOT_BASELINE_KEY);
    return;
  }

  try {
    localStorage.setItem(
      ADMIN_CLICK_SNAPSHOT_BASELINE_KEY,
      JSON.stringify(item),
    );
  } catch {
    // Non-blocking when storage is unavailable.
  }
}

function clearAdminClickSnapshotHistory() {
  saveAdminClickSnapshotHistory([]);
}

function formatDiffDelta(value, decimals = 0) {
  const safeValue = Number(value || 0);
  const rounded = Number(safeValue.toFixed(decimals));
  const className =
    rounded > 0
      ? "delta-positive"
      : rounded < 0
        ? "delta-negative"
        : "delta-neutral";
  const trend = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const text = `${rounded > 0 ? "+" : ""}${rounded} (${trend})`;
  return { className, text, trend };
}

function renderAdminClickSnapshotHistory() {
  const history = getAdminClickSnapshotHistory();
  const baseline = getAdminClickSnapshotBaseline();
  const cleanupInfo = getAdminClickSnapshotHistoryCleanupInfo();
  const autoHealText = getAdminClickSnapshotAutoHealText();
  const latest = history[0];
  const cleanupSignature = buildAdminClickSnapshotCleanupSignature(
    cleanupInfo,
    latest,
  );
  const cleanupDismissed =
    getDismissedAdminClickSnapshotCleanupSignature() === cleanupSignature;
  const cleanupText =
    cleanupInfo.compactedCount > 0 && !cleanupDismissed
      ? ` Local cleanup: merged ${cleanupInfo.compactedCount} duplicate snapshots.`
      : "";
  const latestSnapshotText = latest
    ? `Latest snapshot: ${new Date(String(latest.at || "")).toLocaleString()}.`
    : "Latest snapshot: none yet.";

  if (adminPinClickSnapshotBaselineBtn) {
    adminPinClickSnapshotBaselineBtn.disabled = history.length === 0;
    adminPinClickSnapshotBaselineBtn.title =
      history.length === 0
        ? "Create at least one snapshot first."
        : "Use the newest snapshot as baseline.";
  }
  if (adminClearClickSnapshotBaselineBtn) {
    adminClearClickSnapshotBaselineBtn.disabled = !baseline;
    adminClearClickSnapshotBaselineBtn.title = baseline
      ? "Remove the current baseline."
      : "No baseline is pinned yet.";
  }
  if (adminClearClickSnapshotHistoryBtn) {
    adminClearClickSnapshotHistoryBtn.disabled = history.length === 0;
    adminClearClickSnapshotHistoryBtn.textContent =
      history.length > 0
        ? `Clear History (${history.length})`
        : "Clear History";
    adminClearClickSnapshotHistoryBtn.title =
      history.length === 0
        ? "No local snapshots to clear."
        : `Delete all local telemetry snapshots (${history.length}).`;
  }

  const historyItemsForRender =
    cleanupInfo.compactedCount > 0 && !cleanupDismissed
      ? [
          {
            __cleanupSummary: true,
            compactedCount: cleanupInfo.compactedCount,
            rawCount: cleanupInfo.rawCount,
            normalizedCount: cleanupInfo.normalizedCount,
          },
          ...history,
        ]
      : history;

  renderListItems(
    adminClickSnapshotHistoryList,
    historyItemsForRender,
    (item) => {
      if (item.__cleanupSummary) {
        return `Cleanup summary | merged ${item.compactedCount} duplicates (${item.rawCount} raw -> ${item.normalizedCount} kept)`;
      }

      return `${new Date(item.at).toLocaleString()} | searches ${item.searchesEvaluated}, docs ${item.docsEvaluated}, applied ${item.boostApplied}, capped ${item.cappedByGuardrail}, suppressed ${item.suppressedMinBase + item.suppressedNoSignal}, avg ${item.avgBoostApplied}`;
    },
  );

  if (
    cleanupInfo.compactedCount > 0 &&
    !cleanupDismissed &&
    adminClickSnapshotHistoryList
  ) {
    const firstRow = adminClickSnapshotHistoryList.firstElementChild;
    if (firstRow) {
      firstRow.classList.add("admin-list-cleanup-summary");

      const dismissBtn = document.createElement("button");
      dismissBtn.type = "button";
      dismissBtn.className = "admin-list-cleanup-dismiss";
      dismissBtn.textContent = "Dismiss";
      dismissBtn.title = "Hide cleanup summary until history changes.";
      dismissBtn.addEventListener("click", () => {
        setDismissedAdminClickSnapshotCleanupSignature(cleanupSignature);
        renderAdminClickSnapshotHistory();
      });
      firstRow.appendChild(dismissBtn);
    }
  }

  if (!adminClickSnapshotDiff) {
    return;
  }

  if (history.length < 2) {
    adminClickSnapshotDiff.textContent =
      "Snapshot diff: need at least 2 snapshots.";
  } else {
    const latest = history[0];
    const previous = history[1];
    const diffApplied = latest.boostApplied - previous.boostApplied;
    const diffCapped = latest.cappedByGuardrail - previous.cappedByGuardrail;
    const diffSuppressed =
      latest.suppressedMinBase +
      latest.suppressedNoSignal -
      (previous.suppressedMinBase + previous.suppressedNoSignal);
    const diffAvg = Number(
      (latest.avgBoostApplied - previous.avgBoostApplied).toFixed(3),
    );

    const appliedDelta = formatDiffDelta(diffApplied, 0);
    const cappedDelta = formatDiffDelta(diffCapped, 0);
    const suppressedDelta = formatDiffDelta(diffSuppressed, 0);
    const avgDelta = formatDiffDelta(diffAvg, 3);

    adminClickSnapshotDiff.innerHTML = `Snapshot diff (latest vs previous): applied <span class="${appliedDelta.className}">${appliedDelta.text}</span>, capped <span class="${cappedDelta.className}">${cappedDelta.text}</span>, suppressed <span class="${suppressedDelta.className}">${suppressedDelta.text}</span>, avg boost <span class="${avgDelta.className}">${avgDelta.text}</span>.`;
  }

  if (!adminClickSnapshotBaselineDiff) {
    return;
  }

  if (!baseline || !latest) {
    adminClickSnapshotBaselineDiff.textContent =
      "Baseline diff: no baseline pinned.";
    if (adminClickSnapshotBaselineMeta) {
      adminClickSnapshotBaselineMeta.textContent = `Baseline status: none pinned. ${latestSnapshotText}${cleanupText}${autoHealText}`;
    }
    return;
  }

  if (adminClickSnapshotBaselineMeta) {
    adminClickSnapshotBaselineMeta.textContent = `Baseline status: pinned at ${new Date(String(baseline.at || "")).toLocaleString()}. ${latestSnapshotText}${cleanupText}${autoHealText}`;
  }

  const baselineApplied = Number(baseline.boostApplied || 0);
  const baselineCapped = Number(baseline.cappedByGuardrail || 0);
  const baselineSuppressed =
    Number(baseline.suppressedMinBase || 0) +
    Number(baseline.suppressedNoSignal || 0);
  const baselineAvg = Number(baseline.avgBoostApplied || 0);

  const diffAppliedVsBaseline = latest.boostApplied - baselineApplied;
  const diffCappedVsBaseline = latest.cappedByGuardrail - baselineCapped;
  const diffSuppressedVsBaseline =
    latest.suppressedMinBase + latest.suppressedNoSignal - baselineSuppressed;
  const diffAvgVsBaseline = Number(
    (latest.avgBoostApplied - baselineAvg).toFixed(3),
  );

  const appliedBaselineDelta = formatDiffDelta(diffAppliedVsBaseline, 0);
  const cappedBaselineDelta = formatDiffDelta(diffCappedVsBaseline, 0);
  const suppressedBaselineDelta = formatDiffDelta(diffSuppressedVsBaseline, 0);
  const avgBaselineDelta = formatDiffDelta(diffAvgVsBaseline, 3);

  adminClickSnapshotBaselineDiff.innerHTML = `Baseline diff (${new Date(String(baseline.at || "")).toLocaleString()} -> latest): applied <span class="${appliedBaselineDelta.className}">${appliedBaselineDelta.text}</span>, capped <span class="${cappedBaselineDelta.className}">${cappedBaselineDelta.text}</span>, suppressed <span class="${suppressedBaselineDelta.className}">${suppressedBaselineDelta.text}</span>, avg boost <span class="${avgBaselineDelta.className}">${avgBaselineDelta.text}</span>.`;
}

async function fetchAdminOverview(range = "all") {
  if (typeof magnetoAdminApi.fetchAdminOverview === "function") {
    return magnetoAdminApi.fetchAdminOverview(range);
  }

  const token = getAdminToken();
  const params = new URLSearchParams({ range });

  const response = await apiFetch(`/api/admin/overview?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not load admin data.");
  }

  return payload;
}

async function resetClickSignalTelemetry() {
  if (typeof magnetoAdminApi.resetClickSignalTelemetry === "function") {
    return magnetoAdminApi.resetClickSignalTelemetry();
  }

  const token = getAdminToken();
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
  if (
    typeof magnetoAdminApi.snapshotAndResetClickSignalTelemetry === "function"
  ) {
    return magnetoAdminApi.snapshotAndResetClickSignalTelemetry();
  }

  const token = getAdminToken();
  const response = await apiFetch("/api/admin/click-signal/snapshot-reset", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not snapshot and reset telemetry.");
  }

  return payload;
}

async function exportAdminCsv(range = "all") {
  if (typeof magnetoAdminApi.exportAdminCsv === "function") {
    return magnetoAdminApi.exportAdminCsv(range);
  }

  const token = getAdminToken();
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
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `magneto-analytics-${range}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setClickTelemetryActionButtonsBusy(isBusy) {
  const busy = Boolean(isBusy);
  if (adminResetClickTelemetryBtn) {
    adminResetClickTelemetryBtn.disabled = busy;
  }
  if (adminSnapshotResetClickTelemetryBtn) {
    adminSnapshotResetClickTelemetryBtn.disabled = busy;
  }
}

async function fetchAdminBackups(reason = "all") {
  if (typeof magnetoAdminApi.fetchAdminBackups === "function") {
    return magnetoAdminApi.fetchAdminBackups(reason);
  }

  const token = getAdminToken();
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

async function fetchAdminAssistantStatus() {
  if (typeof magnetoAdminApi.fetchAdminAssistantStatus === "function") {
    return magnetoAdminApi.fetchAdminAssistantStatus();
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.fetchAdminRuntimeMetrics === "function") {
    return magnetoAdminApi.fetchAdminRuntimeMetrics();
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.fetchAdminSearchStatus === "function") {
    return magnetoAdminApi.fetchAdminSearchStatus();
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.fetchAdminRankingConfig === "function") {
    return magnetoAdminApi.fetchAdminRankingConfig();
  }

  const token = getAdminToken();
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

async function postAdminRankingConfig({ rankingConfig = null, reset = false }) {
  if (typeof magnetoAdminApi.postAdminRankingConfig === "function") {
    return magnetoAdminApi.postAdminRankingConfig({ rankingConfig, reset });
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.fetchAdminRewriteRules === "function") {
    return magnetoAdminApi.fetchAdminRewriteRules();
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.postAdminRewriteRules === "function") {
    return magnetoAdminApi.postAdminRewriteRules({ rewriteRules, reset });
  }

  const token = getAdminToken();
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

async function fetchAdminRewriteRuleSuggestions(limit = 10, minConfidence = 0) {
  if (typeof magnetoAdminApi.fetchAdminRewriteRuleSuggestions === "function") {
    return magnetoAdminApi.fetchAdminRewriteRuleSuggestions(
      limit,
      minConfidence,
    );
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.postAdminSearchSeed === "function") {
    return magnetoAdminApi.postAdminSearchSeed(force);
  }

  const token = getAdminToken();
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

async function postAdminSearchCrawl({ sourceIds = [], maxPages = null } = {}) {
  if (typeof magnetoAdminApi.postAdminSearchCrawl === "function") {
    return magnetoAdminApi.postAdminSearchCrawl({ sourceIds, maxPages });
  }

  const token = getAdminToken();
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

async function fetchAdminIndexSyncStatus() {
  if (typeof magnetoAdminApi.fetchAdminIndexSyncStatus === "function") {
    return magnetoAdminApi.fetchAdminIndexSyncStatus();
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.postAdminIndexSync === "function") {
    return magnetoAdminApi.postAdminIndexSync(body);
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.postAdminIndexSyncResetWatermark === "function") {
    return magnetoAdminApi.postAdminIndexSyncResetWatermark(updatedSince);
  }

  const token = getAdminToken();
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

async function fetchAdminIndexStatus() {
  if (typeof magnetoAdminApi.fetchAdminIndexStatus === "function") {
    return magnetoAdminApi.fetchAdminIndexStatus();
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.postAdminIndexRefresh === "function") {
    return magnetoAdminApi.postAdminIndexRefresh(body);
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.fetchAdminIndexBackups === "function") {
    return magnetoAdminApi.fetchAdminIndexBackups(reason);
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.postAdminIndexRestore === "function") {
    return magnetoAdminApi.postAdminIndexRestore(body);
  }

  const token = getAdminToken();
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

async function downloadBackupFile(fileName) {
  if (typeof magnetoAdminApi.downloadBackupFile === "function") {
    return magnetoAdminApi.downloadBackupFile(fileName);
  }

  const token = getAdminToken();
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
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function createBackupNow() {
  if (typeof magnetoAdminApi.createBackupNow === "function") {
    return magnetoAdminApi.createBackupNow();
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.restoreBackup === "function") {
    return magnetoAdminApi.restoreBackup(fileName);
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.fetchAdminRouting === "function") {
    return magnetoAdminApi.fetchAdminRouting();
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.postAdminRouting === "function") {
    return magnetoAdminApi.postAdminRouting(update);
  }

  const token = getAdminToken();
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
  if (typeof magnetoAdminApi.fetchAdminRoutingVerify === "function") {
    return magnetoAdminApi.fetchAdminRoutingVerify();
  }

  const token = getAdminToken();
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

function renderRoutingState(routing) {
  if (
    typeof window.MagnetoAdminRoutingPanel?.renderRoutingState === "function"
  ) {
    return window.MagnetoAdminRoutingPanel.renderRoutingState({
      routing,
      statusGrid: adminRoutingStatusGrid,
      updatedAtElement: adminRoutingUpdatedAt,
      createStatusItem: createAssistantStatusItem,
    });
  }

  if (!adminRoutingStatusGrid) {
    return;
  }
  adminRoutingStatusGrid.innerHTML = "";

  const backendLabel =
    routing.activeBackend === "django" ? "Django" : "Node.js";
  const canaryLabel =
    routing.canaryPercent != null ? `${routing.canaryPercent}%` : "—";

  const items = [
    ["Active Backend", backendLabel],
    ["Canary %", canaryLabel],
    ["Django URL", routing.djangoUrl || "—"],
    ["Note", routing.note || "—"],
    [
      "Last Changed",
      routing.updatedAt ? new Date(routing.updatedAt).toLocaleString() : "—",
    ],
  ];

  items.forEach(([label, value]) => {
    adminRoutingStatusGrid.appendChild(
      createAssistantStatusItem(label, String(value)),
    );
  });

  if (adminRoutingUpdatedAt) {
    adminRoutingUpdatedAt.textContent = routing.updatedAt
      ? `State as of: ${new Date(routing.updatedAt).toLocaleString()}`
      : "";
  }
}

function renderRoutingVerify(result) {
  if (
    typeof window.MagnetoAdminRoutingPanel?.renderRoutingVerify === "function"
  ) {
    return window.MagnetoAdminRoutingPanel.renderRoutingVerify({
      result,
      verifyResultElement: adminRoutingVerifyResult,
      documentRef: document,
    });
  }

  if (!adminRoutingVerifyResult) {
    return;
  }
  adminRoutingVerifyResult.hidden = false;
  adminRoutingVerifyResult.innerHTML = "";

  const header = document.createElement("p");
  header.className = result.ok
    ? "admin-routing-verify-ok"
    : "admin-routing-verify-fail";
  header.textContent = result.ok
    ? "Dry-test PASSED – both backends reachable."
    : "Dry-test PARTIAL – one or more backends unreachable.";
  adminRoutingVerifyResult.appendChild(header);

  const list = document.createElement("ul");
  list.className = "admin-list";
  (result.checks || []).forEach((check) => {
    const li = document.createElement("li");
    const status = check.ok ? "OK" : "FAIL";
    const latency = check.latencyMs != null ? ` ${check.latencyMs}ms` : "";
    const errPart = check.error ? ` — ${check.error}` : "";
    li.textContent = `[${status}] ${check.backend.toUpperCase()} ${check.url}${latency}${errPart}`;
    li.className = check.ok
      ? "admin-routing-check-ok"
      : "admin-routing-check-fail";
    list.appendChild(li);
  });
  adminRoutingVerifyResult.appendChild(list);
}

async function refreshRoutingStatus(okMessage = "") {
  if (!adminRoutingStatusGrid) {
    return;
  }

  try {
    const payload = await fetchAdminRouting();
    renderRoutingState(payload.routing || {});
    if (adminRoutingVerifyResult) {
      adminRoutingVerifyResult.hidden = true;
    }
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    if (okMessage) {
      setAdminStatus(error.message || "Could not load routing state.", true);
    }
  }
}

function getFilteredSortedSearchRuns() {
  const statusFilter = String(adminSearchRunsStatusFilter?.value || "all")
    .trim()
    .toLowerCase();
  const sourceFilter = String(adminSearchRunsSourceFilter?.value || "")
    .trim()
    .toLowerCase();

  let filteredRuns = adminSearchRecentRuns.filter((run) => {
    const runStatus = String(run?.status || "")
      .trim()
      .toLowerCase();
    const runSource = String(run?.source || "")
      .trim()
      .toLowerCase();

    if (statusFilter !== "all" && runStatus !== statusFilter) {
      return false;
    }
    if (sourceFilter && !runSource.includes(sourceFilter)) {
      return false;
    }
    return true;
  });

  filteredRuns = [...filteredRuns].sort((a, b) => {
    const left = getSearchRunSortValue(a, adminSearchRunsSortKey);
    const right = getSearchRunSortValue(b, adminSearchRunsSortKey);

    if (left < right) {
      return adminSearchRunsSortDirection === "asc" ? -1 : 1;
    }
    if (left > right) {
      return adminSearchRunsSortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

  return filteredRuns;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightCsvLine(line, query) {
  const rawLine = String(line || "");
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    return escapeHtml(rawLine);
  }

  const pattern = new RegExp(`(${escapeRegex(normalizedQuery)})`, "gi");
  return rawLine
    .split(pattern)
    .map((part) => {
      if (part.toLowerCase() === normalizedQuery.toLowerCase()) {
        return `<mark>${escapeHtml(part)}</mark>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

function closeSearchCsvPreviewModal() {
  if (!adminSearchCsvModal) {
    return;
  }

  adminSearchCsvModal.hidden = true;
  if (adminSearchCsvPreviewSearchInput) {
    adminSearchCsvPreviewSearchInput.value = "";
  }
}

function updateCsvPreviewNavButtons() {
  const hasMatches = csvPreviewMarkElements.length > 0;
  if (adminSearchCsvPreviewPrevBtn) {
    adminSearchCsvPreviewPrevBtn.disabled = !hasMatches;
  }
  if (adminSearchCsvPreviewNextBtn) {
    adminSearchCsvPreviewNextBtn.disabled = !hasMatches;
  }
}

function renderCsvPreviewMatchCounter() {
  if (!adminSearchCsvPreviewMatchCount) {
    return;
  }
  const total = csvPreviewMarkElements.length;
  if (csvPreviewCurrentMatchIndex >= 0 && total > 0) {
    adminSearchCsvPreviewMatchCount.textContent = `Match ${csvPreviewCurrentMatchIndex + 1} / ${total}`;
  } else if (total > 0) {
    adminSearchCsvPreviewMatchCount.textContent = `${csvPreviewMatchedRowCount} / ${csvPreviewTotalDataRowCount} rows \u00b7 ${total} occurrence${total !== 1 ? "s" : ""}`;
  } else {
    adminSearchCsvPreviewMatchCount.textContent = `Rows: ${csvPreviewMatchedRowCount}`;
  }
}

function navigateCsvPreviewMatch(direction) {
  if (csvPreviewMarkElements.length === 0) {
    return;
  }
  if (csvPreviewCurrentMatchIndex >= 0) {
    csvPreviewMarkElements[csvPreviewCurrentMatchIndex].classList.remove(
      "current",
    );
  }
  if (csvPreviewCurrentMatchIndex === -1) {
    csvPreviewCurrentMatchIndex =
      direction === 1 ? 0 : csvPreviewMarkElements.length - 1;
  } else {
    csvPreviewCurrentMatchIndex =
      (csvPreviewCurrentMatchIndex +
        direction +
        csvPreviewMarkElements.length) %
      csvPreviewMarkElements.length;
  }
  csvPreviewMarkElements[csvPreviewCurrentMatchIndex].classList.add("current");
  csvPreviewMarkElements[csvPreviewCurrentMatchIndex].scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
  renderCsvPreviewMatchCounter();
}

function updateSearchCsvPreviewByQuery() {
  if (!adminSearchCsvPreviewContent) {
    return;
  }

  const full = String(adminSearchCsvFullContent || "");
  const lines = full
    .split(/\r?\n/)
    .map((line) => String(line || ""))
    .filter((line) => line.length > 0);

  csvPreviewMarkElements = [];
  csvPreviewCurrentMatchIndex = -1;

  if (lines.length === 0) {
    adminSearchCsvPreviewContent.textContent = "";
    csvPreviewMatchedRowCount = 0;
    csvPreviewTotalDataRowCount = 0;
    renderCsvPreviewMatchCounter();
    updateCsvPreviewNavButtons();
    return;
  }

  const header = lines[0];
  const dataLines = lines.slice(1);
  const query = String(adminSearchCsvPreviewSearchInput?.value || "")
    .trim()
    .toLowerCase();

  if (!query) {
    adminSearchCsvPreviewContent.textContent = `${lines.join("\n")}\n`;
    csvPreviewMatchedRowCount = dataLines.length;
    csvPreviewTotalDataRowCount = dataLines.length;
    renderCsvPreviewMatchCounter();
    updateCsvPreviewNavButtons();
    return;
  }

  const matched = dataLines.filter((line) =>
    line.toLowerCase().includes(query),
  );
  const highlighted = [
    escapeHtml(header),
    ...matched.map((line) => highlightCsvLine(line, query)),
  ];
  adminSearchCsvPreviewContent.innerHTML = `${highlighted.join("\n")}\n`;
  csvPreviewMarkElements = [
    ...adminSearchCsvPreviewContent.querySelectorAll("mark"),
  ];
  csvPreviewMatchedRowCount = matched.length;
  csvPreviewTotalDataRowCount = dataLines.length;
  renderCsvPreviewMatchCounter();
  updateCsvPreviewNavButtons();
}

function openSearchCsvPreviewModal(content) {
  if (!adminSearchCsvModal || !adminSearchCsvPreviewContent) {
    return;
  }

  adminSearchCsvFullContent = String(content || "");
  if (adminSearchCsvPreviewSearchInput) {
    adminSearchCsvPreviewSearchInput.value = "";
  }
  updateSearchCsvPreviewByQuery();

  adminSearchCsvModal.hidden = false;
}

function buildSearchRunsCsv(rows) {
  const header = [
    "startedAt",
    "source",
    "status",
    "trigger",
    "pagesSeen",
    "pagesIndexed",
    "pagesUpdated",
    "pagesFailed",
    "pagesBlocked",
  ];

  const lines = [header.join(",")];
  rows.forEach((run) => {
    const line = [
      run.startedAt || "",
      run.source || "",
      run.status || "",
      run.trigger || "",
      Number(run.pagesSeen || 0),
      Number(run.pagesIndexed || 0),
      Number(run.pagesUpdated || 0),
      Number(run.pagesFailed || 0),
      Number(run.pagesBlocked || 0),
    ]
      .map(escapeCsvValue)
      .join(",");
    lines.push(line);
  });

  return `${lines.join("\n")}\n`;
}

function exportSearchRunsCsv() {
  const rows = getFilteredSortedSearchRuns();
  if (!rows.length) {
    setAdminStatus("No crawl runs to export for current filters.", true);
    return;
  }

  const content = buildSearchRunsCsv(rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `magneto-crawl-runs-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setAdminStatus(`Exported ${rows.length} crawl run(s) to CSV.`);
}

async function copySearchRunsCsvToClipboard() {
  const rows = getFilteredSortedSearchRuns();
  if (!rows.length) {
    setAdminStatus("No crawl runs to copy for current filters.", true);
    return;
  }

  const content = buildSearchRunsCsv(rows);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
    } else {
      const area = document.createElement("textarea");
      area.value = content;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.top = "-9999px";
      document.body.appendChild(area);
      area.focus();
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) {
        throw new Error("Clipboard API unavailable.");
      }
    }

    setAdminStatus(`Copied ${rows.length} crawl run(s) as CSV.`);
  } catch (error) {
    setAdminStatus(error.message || "Could not copy CSV to clipboard.", true);
  }
}

function previewSearchRunsCsv() {
  const rows = getFilteredSortedSearchRuns();
  if (!rows.length) {
    setAdminStatus("No crawl runs to preview for current filters.", true);
    return;
  }

  const content = buildSearchRunsCsv(rows);
  openSearchCsvPreviewModal(content);
}

function getSearchRunSortValue(run, key) {
  if (!run) {
    return "";
  }

  const numericKeys = new Set([
    "pagesSeen",
    "pagesIndexed",
    "pagesUpdated",
    "pagesFailed",
    "pagesBlocked",
  ]);

  if (key === "startedAt") {
    return new Date(run.startedAt || 0).getTime() || 0;
  }

  if (numericKeys.has(key)) {
    return Number(run[key] || 0);
  }

  return String(run[key] || "")
    .trim()
    .toLowerCase();
}

function updateSearchRunsSortButtonsUI() {
  adminSearchRunsSortButtons.forEach((button) => {
    const key = String(button.dataset.sortKey || "");
    const label = String(button.textContent || "")
      .replace(/[\u2191\u2193]/g, "")
      .trim();
    if (key === adminSearchRunsSortKey) {
      const arrow =
        adminSearchRunsSortDirection === "asc" ? "\u2191" : "\u2193";
      button.textContent = `${label} ${arrow}`;
      button.classList.add("active");
    } else {
      button.textContent = label;
      button.classList.remove("active");
    }
  });
}

function formatRunDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) {
    return "-";
  }
  const start = new Date(startedAt);
  const end = new Date(finishedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }
  const secs = Math.round((end - start) / 1000);
  if (secs < 0) {
    return "-";
  }
  if (secs < 60) {
    return `${secs}s`;
  }
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) {
    return remSecs ? `${mins}m ${remSecs}s` : `${mins}m`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function loadHiddenCols() {
  try {
    const raw = localStorage.getItem(ADMIN_SEARCH_RUNS_HIDDEN_COLS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        adminSearchRunsHiddenCols = new Set(
          arr.filter((k) => ADMIN_SEARCH_RUNS_COL_KEYS.includes(k)),
        );
      }
    }
  } catch {
    adminSearchRunsHiddenCols = new Set();
  }
}

function saveHiddenCols() {
  try {
    localStorage.setItem(
      ADMIN_SEARCH_RUNS_HIDDEN_COLS_KEY,
      JSON.stringify([...adminSearchRunsHiddenCols]),
    );
  } catch {
    // ignore
  }
}

function updateColTogglePanelUI() {
  ADMIN_SEARCH_RUNS_COL_KEYS.forEach((key) => {
    const cb = document.getElementById(`adminSearchColToggle_${key}`);
    if (cb) {
      cb.checked = !adminSearchRunsHiddenCols.has(key);
    }
  });
}

function applyColHeaderVisibility() {
  document
    .querySelectorAll(".admin-search-runs-table thead th[data-col-key]")
    .forEach((th) => {
      th.hidden = adminSearchRunsHiddenCols.has(th.dataset.colKey);
    });
}

function renderAdminSearchRunsPagination(filtered, pageCount) {
  if (!adminSearchRunsPaginationWrap) {
    return;
  }
  if (filtered === 0 || pageCount <= 1) {
    adminSearchRunsPaginationWrap.hidden = true;
    return;
  }
  adminSearchRunsPaginationWrap.hidden = false;
  if (adminSearchRunsPaginationInfo) {
    adminSearchRunsPaginationInfo.textContent = `Page ${adminSearchRunsPage + 1} of ${pageCount}`;
  }
  if (adminSearchRunsPrevPageBtn) {
    adminSearchRunsPrevPageBtn.disabled = adminSearchRunsPage === 0;
  }
  if (adminSearchRunsNextPageBtn) {
    adminSearchRunsNextPageBtn.disabled = adminSearchRunsPage >= pageCount - 1;
  }
}

function closeSearchRunDetail() {
  adminSearchExpandedRunId = null;
  if (adminSearchRunDetail) {
    adminSearchRunDetail.hidden = true;
  }
  if (adminSearchRunDetailBody) {
    adminSearchRunDetailBody.innerHTML = "";
  }
  adminSearchRunsBody?.querySelectorAll("tr.selected").forEach((tr) => {
    tr.classList.remove("selected");
  });
}

function renderSearchRunDetail(run) {
  if (!adminSearchRunDetailBody || !adminSearchRunDetail) {
    return;
  }
  adminSearchRunDetailBody.innerHTML = "";

  const runStatus = String(run.status || "-").toLowerCase();
  const statusBadge = document.createElement("span");
  statusBadge.className = "admin-search-run-status-badge";
  if (runStatus === "completed") {
    statusBadge.classList.add("admin-search-run-status-completed");
  } else if (runStatus === "running") {
    statusBadge.classList.add("admin-search-run-status-running");
  } else if (runStatus === "partial") {
    statusBadge.classList.add("admin-search-run-status-partial");
  } else if (runStatus === "failed") {
    statusBadge.classList.add("admin-search-run-status-failed");
  }
  statusBadge.textContent = String(run.status || "-").toUpperCase();

  const textFields = [
    ["Run ID", String(run.id ?? "-")],
    ["Source", String(run.source || "all")],
    ["Trigger", String(run.trigger || "-")],
    ["Started At", formatAssistantDate(run.startedAt)],
    ["Finished At", formatAssistantDate(run.finishedAt)],
    ["Duration", formatRunDuration(run.startedAt, run.finishedAt)],
    ["Pages Seen", String(Number(run.pagesSeen || 0))],
    ["Pages Indexed", String(Number(run.pagesIndexed || 0))],
    ["Pages Updated", String(Number(run.pagesUpdated || 0))],
    ["Pages Failed", String(Number(run.pagesFailed || 0))],
    ["Pages Blocked", String(Number(run.pagesBlocked || 0))],
  ];
  if (String(run.notes || "").trim()) {
    textFields.push(["Notes", String(run.notes)]);
  }

  const createDetailField = (label, valueEl) => {
    const item = document.createElement("div");
    item.className = "admin-search-run-detail-field";
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    if (typeof valueEl === "string") {
      dd.textContent = valueEl;
    } else {
      dd.appendChild(valueEl);
    }
    item.append(dt, dd);
    return item;
  };

  adminSearchRunDetailBody.appendChild(
    createDetailField("Status", statusBadge),
  );
  textFields.forEach(([label, value]) => {
    adminSearchRunDetailBody.appendChild(createDetailField(label, value));
  });
  adminSearchRunDetail.hidden = false;
}

function toggleSearchRunDetail(run) {
  const runId = String(run.id ?? "");
  if (adminSearchExpandedRunId !== null && adminSearchExpandedRunId === runId) {
    closeSearchRunDetail();
    return;
  }
  adminSearchExpandedRunId = runId;
  adminSearchRunsBody
    ?.querySelectorAll("tr.admin-search-run-clickable")
    .forEach((tr) => {
      if (tr.dataset.runId === runId) {
        tr.classList.add("selected");
      } else {
        tr.classList.remove("selected");
      }
    });
  renderSearchRunDetail(run);
}

function renderAdminSearchRunsTable() {
  if (!adminSearchRunsBody) {
    return;
  }

  adminSearchRunsBody.innerHTML = "";
  const allFiltered = getFilteredSortedSearchRuns();
  const total = adminSearchRecentRuns.length;
  const filtered = allFiltered.length;
  const visibleColCount = ADMIN_SEARCH_RUNS_COL_KEYS.filter(
    (k) => !adminSearchRunsHiddenCols.has(k),
  ).length;

  if (adminSearchRunsCount) {
    adminSearchRunsCount.textContent = `Showing ${filtered} of ${total} run${total !== 1 ? "s" : ""}`;
  }

  const pageSize = ADMIN_SEARCH_RUNS_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(filtered / pageSize));
  if (adminSearchRunsPage >= pageCount) {
    adminSearchRunsPage = Math.max(0, pageCount - 1);
  }
  const pageStart = adminSearchRunsPage * pageSize;
  const pageRuns = allFiltered.slice(pageStart, pageStart + pageSize);

  if (
    adminSearchExpandedRunId !== null &&
    !pageRuns.some((run) => String(run.id ?? "") === adminSearchExpandedRunId)
  ) {
    closeSearchRunDetail();
  }

  renderAdminSearchRunsPagination(filtered, pageCount);

  if (pageRuns.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = visibleColCount || 9;
    cell.className = "admin-search-runs-empty";
    cell.textContent = adminSearchRecentRuns.length
      ? "No runs match current filters."
      : "No crawl runs yet.";
    row.appendChild(cell);
    adminSearchRunsBody.appendChild(row);
    updateSearchRunsSortButtonsUI();
    return;
  }

  const makeTd = (colKey, text, child) => {
    const td = document.createElement("td");
    td.dataset.colKey = colKey;
    if (adminSearchRunsHiddenCols.has(colKey)) {
      td.hidden = true;
    }
    if (child) {
      td.appendChild(child);
    } else {
      td.textContent = text;
    }
    return td;
  };

  pageRuns.forEach((run) => {
    const row = document.createElement("tr");

    const runStatus = String(run.status || "-").toLowerCase();
    const statusBadge = document.createElement("span");
    statusBadge.className = "admin-search-run-status-badge";
    if (runStatus === "completed") {
      statusBadge.classList.add("admin-search-run-status-completed");
    } else if (runStatus === "running") {
      statusBadge.classList.add("admin-search-run-status-running");
    } else if (runStatus === "partial") {
      statusBadge.classList.add("admin-search-run-status-partial");
    } else if (runStatus === "failed") {
      statusBadge.classList.add("admin-search-run-status-failed");
    }
    statusBadge.textContent = String(run.status || "-").toUpperCase();

    row.append(
      makeTd("startedAt", formatAssistantDate(run.startedAt)),
      makeTd("source", String(run.source || "all")),
      makeTd("status", "", statusBadge),
      makeTd("trigger", String(run.trigger || "-")),
      makeTd("pagesSeen", String(Number(run.pagesSeen || 0))),
      makeTd("pagesIndexed", String(Number(run.pagesIndexed || 0))),
      makeTd("pagesUpdated", String(Number(run.pagesUpdated || 0))),
      makeTd("pagesFailed", String(Number(run.pagesFailed || 0))),
      makeTd("pagesBlocked", String(Number(run.pagesBlocked || 0))),
    );

    row.className = "admin-search-run-clickable";
    row.dataset.runId = String(run.id ?? "");
    row.tabIndex = 0;
    if (
      adminSearchExpandedRunId !== null &&
      adminSearchExpandedRunId === String(run.id ?? "")
    ) {
      row.classList.add("selected");
    }
    row.addEventListener("click", () => toggleSearchRunDetail(run));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSearchRunDetail(run);
      }
    });
    adminSearchRunsBody.appendChild(row);
  });

  updateSearchRunsSortButtonsUI();
}

function renderAdminSearchStatus(payload) {
  if (
    typeof window.MagnetoAdminSearchStatusPanel?.renderSearchStatus ===
    "function"
  ) {
    return window.MagnetoAdminSearchStatusPanel.renderSearchStatus({
      payload,
      statusGrid: adminSearchStatusGrid,
      statusMeta: adminSearchStatusMeta,
      createStatusItem: createAssistantStatusItem,
      formatDate: formatAssistantDate,
      onRecentRunsChange: (runs) => {
        adminSearchRecentRuns = runs;
      },
      onRenderRunsTable: renderAdminSearchRunsTable,
    });
  }

  if (!adminSearchStatusGrid) {
    return;
  }

  adminSearchStatusGrid.innerHTML = "";

  const search = payload?.search || payload || {};
  const sources = search.sources || {};
  const docs = search.documents || {};
  const rewriteRules = search.rewriteRules || {};
  const latestRun = search.latestRun || {};
  adminSearchRecentRuns = Array.isArray(search.recentRuns)
    ? [...search.recentRuns]
    : [];

  const pagesSummary = [
    `seen=${Number(latestRun.pagesSeen || 0)}`,
    `indexed=${Number(latestRun.pagesIndexed || 0)}`,
    `updated=${Number(latestRun.pagesUpdated || 0)}`,
    `failed=${Number(latestRun.pagesFailed || 0)}`,
  ].join(" | ");

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
    ["Latest Run Started", formatAssistantDate(latestRun.startedAt)],
    ["Latest Run Finished", formatAssistantDate(latestRun.finishedAt)],
    ["Latest Run Pages", pagesSummary],
  ];

  items.forEach(([label, value]) => {
    adminSearchStatusGrid.appendChild(
      createAssistantStatusItem(label, String(value)),
    );
  });

  if (adminSearchStatusMeta) {
    adminSearchStatusMeta.textContent = `Updated: ${new Date().toLocaleString()}`;
  }

  renderAdminSearchRunsTable();
}

function renderAdminRankingConfig(payload) {
  if (!adminRankingConfigJson) {
    return;
  }

  const config = payload?.rankingConfig || payload || {};
  adminRankingConfigJson.value = JSON.stringify(config, null, 2);

  if (adminRankingConfigMeta) {
    adminRankingConfigMeta.textContent = `Updated: ${formatAssistantDate(payload?.generatedAt)}`;
  }
}

function renderAdminRewriteRulesEmpty() {
  if (!adminRewriteRulesList) {
    return;
  }

  adminRewriteRulesList.innerHTML = "";
  const empty = document.createElement("p");
  empty.className = "admin-rewrite-rules-empty";
  empty.textContent =
    "No rewrite rules configured. Add a rule to catch typos or recurring failed queries.";
  adminRewriteRulesList.appendChild(empty);
}

function createAdminRewriteRuleRow(rule = {}) {
  const row = document.createElement("div");
  row.className = "admin-rewrite-rule-row";

  const enabledLabel = document.createElement("label");
  enabledLabel.className = "admin-search-force-label";
  const enabledInput = document.createElement("input");
  enabledInput.type = "checkbox";
  enabledInput.checked = rule.enabled !== false;
  enabledInput.dataset.field = "enabled";
  enabledLabel.append(enabledInput, document.createTextNode("Enabled"));

  const matchTypeSelect = document.createElement("select");
  matchTypeSelect.dataset.field = "matchType";
  ["exact", "contains"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    if (String(rule.matchType || "exact").toLowerCase() === value) {
      option.selected = true;
    }
    matchTypeSelect.appendChild(option);
  });

  const fromInput = document.createElement("input");
  fromInput.type = "text";
  fromInput.placeholder = "From query";
  fromInput.value = String(rule.from || "");
  fromInput.dataset.field = "from";

  const toInput = document.createElement("input");
  toInput.type = "text";
  toInput.placeholder = "To query";
  toInput.value = String(rule.to || "");
  toInput.dataset.field = "to";

  const reasonInput = document.createElement("input");
  reasonInput.type = "text";
  reasonInput.placeholder = "Reason";
  reasonInput.value = String(rule.reason || "configured-rewrite");
  reasonInput.dataset.field = "reason";

  const signals =
    rule?.signals && typeof rule.signals === "object" ? rule.signals : null;
  const confidence = Number(signals?.confidence || 0);
  const reformulations = Number(signals?.reformulations || 0);
  const maxImprovement = Number(signals?.maxImprovement || 0);
  const signalBadge = document.createElement("span");
  signalBadge.className = "admin-rewrite-rule-signal";
  if (signals) {
    signalBadge.textContent = `c=${confidence.toFixed(2)} | n=${reformulations}`;
    signalBadge.title = `confidence=${confidence.toFixed(2)}, reformulations=${reformulations}, maxImprovement=${maxImprovement}`;
  } else {
    signalBadge.textContent = "manual";
    signalBadge.classList.add("manual");
    signalBadge.title = "Manual rule";
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "results-back-link admin-rewrite-rule-remove";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    row.remove();
    if (
      adminRewriteRulesList &&
      adminRewriteRulesList.querySelectorAll(".admin-rewrite-rule-row")
        .length === 0
    ) {
      renderAdminRewriteRulesEmpty();
    }
  });

  row.append(
    enabledLabel,
    matchTypeSelect,
    fromInput,
    toInput,
    reasonInput,
    signalBadge,
    removeBtn,
  );
  return row;
}

function appendAdminRewriteRule(rule = {}, shouldFocus = false) {
  if (!adminRewriteRulesList) {
    return;
  }

  const emptyState = adminRewriteRulesList.querySelector(
    ".admin-rewrite-rules-empty",
  );
  if (emptyState) {
    emptyState.remove();
  }

  const row = createAdminRewriteRuleRow(rule);
  adminRewriteRulesList.appendChild(row);

  if (shouldFocus) {
    row.querySelector('[data-field="from"]')?.focus();
  }
}

function collectAdminRewriteRules() {
  if (!adminRewriteRulesList) {
    return [];
  }

  const rows = [
    ...adminRewriteRulesList.querySelectorAll(".admin-rewrite-rule-row"),
  ];
  return rows.map((row, index) => {
    const matchType = String(
      row.querySelector('[data-field="matchType"]')?.value || "exact",
    )
      .trim()
      .toLowerCase();
    const from = String(
      row.querySelector('[data-field="from"]')?.value || "",
    ).trim();
    const to = String(
      row.querySelector('[data-field="to"]')?.value || "",
    ).trim();
    const reason = String(
      row.querySelector('[data-field="reason"]')?.value || "configured-rewrite",
    ).trim();
    const enabled = Boolean(
      row.querySelector('[data-field="enabled"]')?.checked,
    );

    if (!from || !to) {
      throw new Error(`Rule ${index + 1} requires both From and To values.`);
    }
    if (!["exact", "contains"].includes(matchType)) {
      throw new Error(`Rule ${index + 1} has an invalid match type.`);
    }

    return {
      enabled,
      matchType,
      from,
      to,
      reason: reason || "configured-rewrite",
    };
  });
}

function hasAdminRewriteRule(rule) {
  if (!adminRewriteRulesList) {
    return false;
  }

  const fromNorm = String(rule?.from || "")
    .trim()
    .toLowerCase();
  const toNorm = String(rule?.to || "")
    .trim()
    .toLowerCase();
  const matchTypeNorm = String(rule?.matchType || "exact")
    .trim()
    .toLowerCase();
  if (!fromNorm || !toNorm) {
    return false;
  }

  const rows = [
    ...adminRewriteRulesList.querySelectorAll(".admin-rewrite-rule-row"),
  ];
  return rows.some((row) => {
    const rowFrom = String(
      row.querySelector('[data-field="from"]')?.value || "",
    )
      .trim()
      .toLowerCase();
    const rowTo = String(row.querySelector('[data-field="to"]')?.value || "")
      .trim()
      .toLowerCase();
    const rowMatch = String(
      row.querySelector('[data-field="matchType"]')?.value || "exact",
    )
      .trim()
      .toLowerCase();
    return (
      rowFrom === fromNorm && rowTo === toNorm && rowMatch === matchTypeNorm
    );
  });
}

function renderAdminRewriteRules(payload) {
  if (!adminRewriteRulesList) {
    return;
  }

  const rules = Array.isArray(payload?.rewriteRules)
    ? payload.rewriteRules
    : [];
  adminRewriteRulesList.innerHTML = "";

  if (rules.length === 0) {
    renderAdminRewriteRulesEmpty();
  } else {
    rules.forEach((rule) => appendAdminRewriteRule(rule, false));
  }

  if (adminRewriteRulesMeta) {
    const enabledCount = rules.filter((rule) => rule?.enabled !== false).length;
    adminRewriteRulesMeta.textContent = `Updated: ${formatAssistantDate(payload?.generatedAt)} | ${enabledCount} enabled / ${rules.length} total`;
  }
}

function renderAdminSearchStatusError(errorMessage) {
  if (
    typeof window.MagnetoAdminSearchStatusPanel?.renderSearchStatusError ===
    "function"
  ) {
    return window.MagnetoAdminSearchStatusPanel.renderSearchStatusError({
      errorMessage,
      statusGrid: adminSearchStatusGrid,
      statusMeta: adminSearchStatusMeta,
      documentRef: document,
    });
  }

  if (!adminSearchStatusGrid) {
    return;
  }

  adminSearchStatusGrid.innerHTML = "";
  const fallback = document.createElement("p");
  fallback.className = "admin-status-error";
  fallback.textContent = `Could not load search engine status: ${String(errorMessage)}`;
  adminSearchStatusGrid.appendChild(fallback);

  if (adminSearchStatusMeta) {
    adminSearchStatusMeta.textContent = `Error: ${new Date().toLocaleString()}`;
  }
}

function renderAdminIndexSyncStatus(payload) {
  if (!adminIndexSyncStatusGrid) {
    return;
  }

  adminIndexSyncStatusGrid.innerHTML = "";
  const config = payload?.config || {};
  const runtime = payload?.runtime || {};
  const state = payload?.state || {};
  const summary = runtime.lastSummary || {};

  const items = [
    ["Running", payload?.running ? "Yes" : "No"],
    ["Sync Enabled", config.enabled ? "Yes" : "No"],
    ["Startup Sync", config.startup ? "Yes" : "No"],
    ["Interval", `${Math.round(Number(config.intervalMs || 0) / 1000)}s`],
    [
      "Defaults",
      `maxPages=${config.defaultMaxPages || "-"}, pageSize=${config.defaultPageSize || "-"}`,
    ],
    ["Django Token", config.hasDjangoAdminToken ? "Configured" : "Missing"],
    ["Watermark", String(state.updatedSince || "-")],
    ["Last Run", formatAssistantDate(state.lastRunAt || runtime.lastRunAt)],
    [
      "Last Success",
      formatAssistantDate(state.lastSuccessAt || runtime.lastSuccessAt),
    ],
    ["Last Error", String(state.lastError || runtime.lastError || "None")],
    [
      "Last Imported",
      typeof summary.importedDocuments === "number"
        ? String(summary.importedDocuments)
        : "-",
    ],
    [
      "Last Duration",
      typeof summary.durationMs === "number" ? `${summary.durationMs} ms` : "-",
    ],
  ];

  items.forEach(([label, value]) => {
    adminIndexSyncStatusGrid.appendChild(
      createAssistantStatusItem(label, String(value)),
    );
  });

  if (adminIndexSyncMeta) {
    adminIndexSyncMeta.textContent = `Updated: ${formatAssistantDate(payload?.generatedAt)}`;
  }
}

function renderAdminIndexSyncStatusError(errorMessage) {
  if (!adminIndexSyncStatusGrid) {
    return;
  }

  adminIndexSyncStatusGrid.innerHTML = "";
  const fallback = document.createElement("p");
  fallback.className = "admin-status-error";
  fallback.textContent = `Could not load index sync status: ${String(errorMessage)}`;
  adminIndexSyncStatusGrid.appendChild(fallback);

  if (adminIndexSyncMeta) {
    adminIndexSyncMeta.textContent = `Error: ${new Date().toLocaleString()}`;
  }
}

function renderAdminIndexStatus(payload) {
  if (!adminIndexStatusGrid) {
    return;
  }

  adminIndexStatusGrid.innerHTML = "";
  const index = payload?.index || {};
  const file = index.file || {};
  const topLanguages = Array.isArray(index.topLanguages)
    ? index.topLanguages.slice(0, 4)
    : [];
  const topSources = Array.isArray(index.topSources)
    ? index.topSources.slice(0, 4)
    : [];

  const items = [
    ["Total Docs", String(Number(index.totalDocs || 0))],
    [
      "Index File",
      `${Math.max(1, Math.round(Number(file.sizeBytes || 0) / 1024))} KB`,
    ],
    ["File Updated", formatAssistantDate(file.mtime)],
    [
      "Top Languages",
      topLanguages.length
        ? topLanguages
            .map((item) => `${item.value} (${item.count})`)
            .join(" | ")
        : "-",
    ],
    [
      "Top Sources",
      topSources.length
        ? topSources.map((item) => `${item.value} (${item.count})`).join(" | ")
        : "-",
    ],
  ];

  items.forEach(([label, value]) => {
    adminIndexStatusGrid.appendChild(
      createAssistantStatusItem(label, String(value)),
    );
  });

  if (adminIndexMeta) {
    adminIndexMeta.textContent = `Updated: ${formatAssistantDate(payload?.generatedAt)}`;
  }
}

function renderAdminIndexBackups(backups) {
  if (!adminIndexBackupsList) {
    return;
  }

  adminIndexBackupsList.innerHTML = "";
  if (adminIndexBackupFiles) {
    adminIndexBackupFiles.innerHTML = "";
  }

  if (!Array.isArray(backups) || backups.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No index backups available.";
    adminIndexBackupsList.appendChild(li);
    return;
  }

  backups.forEach((item) => {
    const fileName = String(item.fileName || "").trim();
    if (!fileName) {
      return;
    }

    if (adminIndexBackupFiles) {
      const option = document.createElement("option");
      option.value = fileName;
      adminIndexBackupFiles.appendChild(option);
    }

    const li = document.createElement("li");
    li.className = "admin-backup-item";

    const meta = document.createElement("div");
    meta.className = "admin-backup-meta";
    const sizeKb = Math.max(1, Math.round(Number(item.sizeBytes || 0) / 1024));
    meta.textContent = `${fileName} | ${formatAssistantDate(item.createdAt)} | ${String(item.reason || "-")} | ${sizeKb} KB`;

    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "results-back-link admin-restore-btn";
    useBtn.textContent = "Use";
    useBtn.addEventListener("click", () => {
      if (adminIndexRestoreFile) {
        adminIndexRestoreFile.value = fileName;
      }
    });

    const actions = document.createElement("div");
    actions.className = "admin-backup-actions";
    actions.appendChild(useBtn);

    li.append(meta, actions);
    adminIndexBackupsList.appendChild(li);
  });
}

function renderAdminIndexStatusError(errorMessage) {
  if (!adminIndexStatusGrid) {
    return;
  }

  adminIndexStatusGrid.innerHTML = "";
  const fallback = document.createElement("p");
  fallback.className = "admin-status-error";
  fallback.textContent = `Could not load local index status: ${String(errorMessage)}`;
  adminIndexStatusGrid.appendChild(fallback);
}

function renderAdminIndexBackupsError(errorMessage) {
  if (!adminIndexBackupsList) {
    return;
  }

  adminIndexBackupsList.innerHTML = "";
  const li = document.createElement("li");
  li.className = "admin-status-error";
  li.textContent = `Could not load local index backups: ${String(errorMessage)}`;
  adminIndexBackupsList.appendChild(li);
}

async function refreshAdminIndexStatusWithMessage(okMessage = "") {
  if (!adminIndexStatusGrid) {
    return;
  }

  try {
    const payload = await fetchAdminIndexStatus();
    renderAdminIndexStatus(payload);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    renderAdminIndexStatusError(
      error.message || "Could not load local index status.",
    );
    if (okMessage) {
      setAdminStatus(
        error.message || "Could not load local index status.",
        true,
      );
    }
  }
}

async function refreshAdminIndexBackupsWithMessage(okMessage = "") {
  if (!adminIndexBackupsList) {
    return;
  }

  try {
    const payload = await fetchAdminIndexBackups(currentIndexBackupReason);
    renderAdminIndexBackups(payload.backups || []);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    renderAdminIndexBackupsError(
      error.message || "Could not load local index backups.",
    );
    if (okMessage) {
      setAdminStatus(
        error.message || "Could not load local index backups.",
        true,
      );
    }
  }
}

async function refreshAdminIndexPanelWithMessage(okMessage = "") {
  await Promise.all([
    refreshAdminIndexStatusWithMessage(""),
    refreshAdminIndexBackupsWithMessage(""),
  ]);

  if (okMessage) {
    setAdminStatus(okMessage);
  }
}

async function refreshIndexSyncStatusWithMessage(okMessage = "") {
  if (!adminIndexSyncStatusGrid) {
    return;
  }

  try {
    const payload = await fetchAdminIndexSyncStatus();
    renderAdminIndexSyncStatus(payload);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    renderAdminIndexSyncStatusError(
      error.message || "Could not load index sync status.",
    );
    if (okMessage) {
      setAdminStatus(
        error.message || "Could not load index sync status.",
        true,
      );
    }
  }
}

async function refreshSearchStatusWithMessage(okMessage = "") {
  if (!adminSearchStatusGrid) {
    return;
  }

  try {
    const payload = await fetchAdminSearchStatus();
    renderAdminSearchStatus(payload);
    if (payload?.search?.rankingConfig) {
      renderAdminRankingConfig({
        generatedAt: payload.generatedAt,
        rankingConfig: payload.search.rankingConfig,
      });
    }
    await refreshIndexSyncStatusWithMessage("");
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    renderAdminSearchStatusError(
      error.message || "Could not load search engine status.",
    );
    if (okMessage) {
      setAdminStatus(
        error.message || "Could not load search engine status.",
        true,
      );
    }
  }
}

async function refreshRankingConfigWithMessage(okMessage = "") {
  if (!adminRankingConfigJson) {
    return;
  }

  try {
    const payload = await fetchAdminRankingConfig();
    renderAdminRankingConfig(payload);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    if (okMessage) {
      setAdminStatus(error.message || "Could not load ranking config.", true);
    }
    if (adminRankingConfigMeta) {
      adminRankingConfigMeta.textContent = "Could not load ranking config.";
    }
  }
}

async function refreshRewriteRulesWithMessage(okMessage = "") {
  if (!adminRewriteRulesList) {
    return;
  }

  try {
    const payload = await fetchAdminRewriteRules();
    renderAdminRewriteRules(payload);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    renderAdminRewriteRulesEmpty();
    if (adminRewriteRulesMeta) {
      adminRewriteRulesMeta.textContent = "Could not load rewrite rules.";
    }
    if (okMessage) {
      setAdminStatus(error.message || "Could not load rewrite rules.", true);
    }
  }
}

async function trackResultClick(url, title, query, metadata = {}) {
  if (typeof magnetoTrackingApi.trackResultClick === "function") {
    return magnetoTrackingApi.trackResultClick(url, title, query, metadata);
  }

  try {
    const normalizedUrl = String(url || "").trim();
    const normalizedTitle = String(title || "").trim();
    const normalizedQuery = String(query || "").trim();

    if (!normalizedUrl || !normalizedTitle || !normalizedQuery) {
      return;
    }

    await apiFetch("/api/events/result-click", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: normalizedUrl,
        title: normalizedTitle,
        query: normalizedQuery,
        category: String(metadata?.category || "").trim(),
        sourceSlug: String(metadata?.sourceSlug || "").trim(),
        sourceName: String(metadata?.sourceName || "").trim(),
        position: Number(metadata?.position || 0),
        score: Number(metadata?.score || 0),
      }),
    });
  } catch (error) {
    console.debug("Could not track result click:", error);
  }
}

function renderBarChart(
  container,
  items,
  { labelKey, valueKey, valueSuffix = "" },
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-chart-empty";
    empty.textContent = "No chart data yet.";
    container.appendChild(empty);
    return;
  }

  const maxValue = Math.max(
    ...items.map((item) => Number(item[valueKey]) || 0),
    1,
  );

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "admin-chart-row";

    const label = document.createElement("span");
    label.className = "admin-chart-label";
    label.textContent = String(item[labelKey] || "");

    const track = document.createElement("div");
    track.className = "admin-chart-track";

    const fill = document.createElement("div");
    fill.className = "admin-chart-fill";
    const value = Number(item[valueKey]) || 0;
    const widthPercent = (value / maxValue) * 100;
    fill.style.width = `${Math.max(4, widthPercent)}%`;

    const valueLabel = document.createElement("span");
    valueLabel.className = "admin-chart-value";
    valueLabel.textContent = `${value}${valueSuffix}`;

    track.append(fill, valueLabel);
    row.append(label, track);
    container.appendChild(row);
  });
}

function renderTrendChart(container, points) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(points) || points.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-chart-empty";
    empty.textContent = "No trend data yet.";
    container.appendChild(empty);
    return;
  }

  const maxValue = Math.max(
    ...points.map((point) =>
      Math.max(
        Number(point.searchCount) || 0,
        Number(point.pageViewCount) || 0,
      ),
    ),
    1,
  );

  points.forEach((point) => {
    const row = document.createElement("div");
    row.className = "admin-trend-row";

    const label = document.createElement("span");
    label.className = "admin-trend-label";
    label.textContent = String(point.label || "-");

    const barsWrap = document.createElement("div");
    barsWrap.className = "admin-trend-bars";

    const searchTrack = document.createElement("div");
    searchTrack.className = "admin-trend-track";
    const searchFill = document.createElement("div");
    searchFill.className = "admin-trend-fill admin-trend-fill-search";
    const searchValue = Number(point.searchCount) || 0;
    searchFill.style.width = `${Math.max(2, (searchValue / maxValue) * 100)}%`;
    const searchLabel = document.createElement("span");
    searchLabel.className = "admin-trend-value";
    searchLabel.textContent = String(searchValue);
    searchTrack.append(searchFill, searchLabel);

    const viewTrack = document.createElement("div");
    viewTrack.className = "admin-trend-track";
    const viewFill = document.createElement("div");
    viewFill.className = "admin-trend-fill admin-trend-fill-views";
    const viewValue = Number(point.pageViewCount) || 0;
    viewFill.style.width = `${Math.max(2, (viewValue / maxValue) * 100)}%`;
    const viewLabel = document.createElement("span");
    viewLabel.className = "admin-trend-value";
    viewLabel.textContent = String(viewValue);
    viewTrack.append(viewFill, viewLabel);

    barsWrap.append(searchTrack, viewTrack);
    row.append(label, barsWrap);
    container.appendChild(row);
  });
}

function renderListItems(element, items, formatter) {
  if (!element) {
    return;
  }

  element.innerHTML = "";

  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No data yet.";
    element.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = formatter(item);
    element.appendChild(li);
  });
}

function renderAdminDashboard(data) {
  if (!data) {
    return;
  }

  if (kpiTotalSearches) {
    kpiTotalSearches.textContent = String(data.totals?.totalSearches || 0);
  }

  if (kpiTotalViews) {
    kpiTotalViews.textContent = String(data.totals?.totalPageViews || 0);
  }

  if (kpiUniqueQueries) {
    kpiUniqueQueries.textContent = String(data.totals?.uniqueQueries || 0);
  }

  if (kpiTotalClicks) {
    kpiTotalClicks.textContent = String(data.totals?.totalResultClicks || 0);
  }

  if (kpiZeroResults) {
    kpiZeroResults.textContent = String(data.totals?.zeroResultSearches || 0);
  }

  if (kpiReformulations) {
    kpiReformulations.textContent = String(data.totals?.reformulations || 0);
  }

  applyDeltaState(
    kpiSearchesDelta,
    data.comparison?.deltaPercent?.totalSearches,
  );
  applyDeltaState(kpiViewsDelta, data.comparison?.deltaPercent?.totalPageViews);
  applyDeltaState(kpiUniqueDelta, data.comparison?.deltaPercent?.uniqueQueries);
  applyDeltaState(
    kpiClicksDelta,
    data.comparison?.deltaPercent?.totalResultClicks,
  );

  if (kpiZeroRate) {
    const totalSearches = Number(data.totals?.totalSearches || 0);
    const zeroResults = Number(data.totals?.zeroResultSearches || 0);
    const zeroRate =
      totalSearches > 0
        ? Number(((zeroResults / totalSearches) * 100).toFixed(1))
        : 0;
    kpiZeroRate.textContent = `${zeroRate}% of searches returned zero results`;
  }

  if (kpiReformulationsMeta) {
    const reformulations = Number(data.totals?.reformulations || 0);
    const totalSearches = Number(data.totals?.totalSearches || 0);
    const reformulationRate =
      totalSearches > 0
        ? Number(((reformulations / totalSearches) * 100).toFixed(1))
        : 0;
    kpiReformulationsMeta.textContent = `${reformulationRate}% of searches were refinements`;
  }

  if (kpiSafetyRate || kpiSafetyMeta) {
    const telemetry = data.clickSignalTelemetry || {};
    const docs = Number(telemetry.docsEvaluated || 0);
    const applied = Number(telemetry.boostApplied || 0);
    const capped = Number(telemetry.cappedByGuardrail || 0);
    const suppressed =
      Number(telemetry.suppressedMinBase || 0) +
      Number(telemetry.suppressedNoSignal || 0);
    const coverage = docs > 0 ? Number(((applied / docs) * 100).toFixed(1)) : 0;

    if (kpiSafetyRate) {
      kpiSafetyRate.textContent = `${coverage}%`;
    }

    if (kpiSafetyMeta) {
      kpiSafetyMeta.textContent = `Applied ${applied}/${docs}, capped ${capped}, suppressed ${suppressed}`;
    }
  }

  renderListItems(
    topQueriesList,
    data.topQueries || [],
    (item) => `${item.query} - ${item.count} searches (${item.percent}%)`,
  );

  renderListItems(
    trafficList,
    data.trafficByPage || [],
    (item) => `${item.page}: ${item.count} views (${item.percent}%)`,
  );

  renderListItems(
    latestSearchesList,
    data.latestSearches || [],
    (item) =>
      `${new Date(item.at).toLocaleString()} | ${item.query} (${item.resultCount} results)`,
  );

  renderListItems(
    zeroResultsList,
    data.zeroResultQueries || [],
    (item) =>
      `${item.query} - ${item.count} zero-result searches (${item.percent}%)`,
  );

  renderListItems(
    reformulationsList,
    data.reformulationSummary || [],
    (item) =>
      `${item.type} - ${item.count}${Array.isArray(item.examples) && item.examples.length > 0 ? ` | examples: ${item.examples.join(", ")}` : ""}`,
  );

  renderListItems(
    topClickedResultsList,
    data.topClickedResults || [],
    (item) =>
      `${item.count} clicks (${item.percent}%) | ${item.title || item.url}${item.lastQuery ? ` | query: ${item.lastQuery}` : ""}`,
  );

  renderListItems(
    topClickPairsList,
    data.topClickPairs || [],
    (item) =>
      `${item.count} clicks (${item.percent}% of clicks, ${item.ctrPercent || 0}% CTR over ${item.queryTotalClicks || 0} query clicks) | ${item.query} -> ${item.title || item.url}`,
  );

  if (adminClickSignalMeta) {
    const cfg = data.clickSignalConfig || {};
    const telemetry = data.clickSignalTelemetry || {};
    const lastRun = telemetry.lastRun || {};
    adminClickSignalMeta.textContent = `Click signal: window ${cfg.windowDays || "-"}d, half-life ${cfg.decayHalfLifeDays || "-"}d, min decay ${cfg.decayMinWeight ?? "-"}, max boost ${cfg.maxBoost || "-"}, CTR max ${cfg.ctrMaxBoost || "-"}, guardrail min base ${cfg.guardrailMinBaseScore || "-"}, guardrail share ${cfg.guardrailMaxShare ?? "-"}, dedup ${cfg.dedupSeconds || "-"}s. Telemetry: searches ${telemetry.searchesEvaluated || 0}, docs ${telemetry.docsEvaluated || 0}, applied ${telemetry.boostApplied || 0}, suppressed(min base) ${telemetry.suppressedMinBase || 0}, suppressed(no signal) ${telemetry.suppressedNoSignal || 0}, capped ${telemetry.cappedByGuardrail || 0}, last-run avg boost ${lastRun.avgBoostApplied || 0}.`;
  }

  renderBarChart(topQueriesChart, data.topQueries || [], {
    labelKey: "query",
    valueKey: "percent",
    valueSuffix: "%",
  });

  renderBarChart(trafficChart, data.trafficByPage || [], {
    labelKey: "page",
    valueKey: "percent",
    valueSuffix: "%",
  });

  renderTrendChart(dailyTrendChart, data.trends?.daily || []);
  renderTrendChart(weeklyTrendChart, data.trends?.weekly || []);
  renderAdminClickSnapshotHistory();
}

function renderBackupList(items) {
  if (!adminBackupList) {
    return;
  }

  adminBackupList.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No backups available yet.";
    adminBackupList.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "admin-backup-item";

    const meta = document.createElement("div");
    meta.className = "admin-backup-meta";
    const created = new Date(item.createdAt).toLocaleString();
    const sizeKb = Math.max(
      1,
      Math.round((Number(item.sizeBytes) || 0) / 1024),
    );
    meta.textContent = `${item.fileName} | ${created} | ${item.reason} | ${sizeKb} KB`;

    const actions = document.createElement("div");
    actions.className = "admin-backup-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "results-back-link admin-restore-btn";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", async () => {
      downloadBtn.disabled = true;
      try {
        await downloadBackupFile(item.fileName);
        setAdminStatus(`Backup downloaded: ${item.fileName}`);
      } catch (error) {
        setAdminStatus(error.message || "Could not download backup.", true);
      } finally {
        downloadBtn.disabled = false;
      }
    });

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "results-back-link admin-restore-btn";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", async () => {
      const confirmed = window.confirm(
        `Restore analytics from backup '${item.fileName}'? Current analytics will be backed up first.`,
      );
      if (!confirmed) {
        return;
      }

      restoreBtn.disabled = true;
      try {
        await restoreBackup(item.fileName);
        setAdminStatus(`Backup restored: ${item.fileName}`);
        const [overview, backups] = await Promise.all([
          fetchAdminOverview(currentAdminRange),
          fetchAdminBackups(),
        ]);
        renderAdminDashboard(overview);
        renderBackupList(backups);
      } catch (error) {
        setAdminStatus(error.message || "Could not restore backup.", true);
      } finally {
        restoreBtn.disabled = false;
      }
    });

    actions.append(downloadBtn, restoreBtn);
    li.append(meta, actions);
    adminBackupList.appendChild(li);
  });
}

function formatAssistantDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function createAssistantStatusItem(label, value) {
  const item = document.createElement("article");
  item.className = "admin-assistant-status-item";

  const key = document.createElement("p");
  key.className = "admin-assistant-status-key";
  key.textContent = label;

  const val = document.createElement("p");
  val.className = "admin-assistant-status-value";
  val.textContent = value;

  item.append(key, val);
  return item;
}

function createRuntimeHealthItem(level, reasons) {
  const normalizedLevel = String(level || "ok").toLowerCase();
  const safeLevel = ["ok", "warning", "critical"].includes(normalizedLevel)
    ? normalizedLevel
    : "ok";

  const reasonText =
    Array.isArray(reasons) && reasons.length
      ? reasons
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .join("; ")
      : "No active alerts";

  const item = document.createElement("article");
  item.className = "admin-assistant-status-item";

  const key = document.createElement("p");
  key.className = "admin-assistant-status-key";
  key.textContent = "Health";

  const val = document.createElement("div");
  val.className = "admin-assistant-status-value";

  const badge = document.createElement("span");
  badge.className = `admin-health-pill admin-health-${safeLevel}`;
  badge.textContent = safeLevel.toUpperCase();

  const reason = document.createElement("p");
  reason.className = "admin-health-reasons";
  reason.textContent = reasonText;

  val.append(badge, reason);
  item.append(key, val);
  return item;
}

function renderAdminAssistantStatus(payload) {
  if (!adminAssistantStatusGrid) {
    return;
  }

  adminAssistantStatusGrid.innerHTML = "";

  const assistant = payload?.assistant || {};
  const limits = assistant.limits || {};
  const cache = assistant.cache || {};
  const memory = assistant.memory || {};
  const metrics = assistant.metrics || {};
  const billing = assistant.billing || {};
  const providers = assistant.providers || {};
  const providerHealth = assistant.providerHealth || {};

  const runtimeMode = assistant.configured
    ? "AI provider configured"
    : "Fallback only (no API key)";

  const errorSummary = metrics.lastProviderError
    ? `${metrics.lastProviderError} (${formatAssistantDate(metrics.lastProviderErrorAt)})`
    : "None";

  const openaiHealth = providerHealth.openai || {};
  const anthropicHealth = providerHealth.anthropic || {};
  const geminiHealth = providerHealth.gemini || {};

  const formatProviderHealth = (entry) => {
    if (!entry || entry.configured === false) {
      return "Not configured";
    }

    if (entry.ok) {
      return `OK (${String(entry.model || "-")})`;
    }

    const reason = String(entry.error || "Unavailable");
    return `FAIL (${reason.slice(0, 120)})`;
  };

  const items = [
    ["Runtime", runtimeMode],
    ["Model", String(assistant.model || "-")],
    [
      "Provider Order",
      `${String(providers.primary || "-")} -> ${String(providers.fallback || "-")}`,
    ],
    ["Requests Total", String(metrics.requestsTotal ?? 0)],
    ["Cache Hits", String(metrics.cacheHits ?? 0)],
    ["OpenAI Responses", String(metrics.openaiResponses ?? 0)],
    ["OpenAI Live", formatProviderHealth(openaiHealth)],
    ["Anthropic Responses", String(metrics.anthropicResponses ?? 0)],
    ["Anthropic Live", formatProviderHealth(anthropicHealth)],
    ["Gemini Responses", String(metrics.geminiResponses ?? 0)],
    ["Gemini Live", formatProviderHealth(geminiHealth)],
    ["Local Hybrid Responses", String(metrics.localHybridResponses ?? 0)],
    ["Fallback Responses", String(metrics.fallbackResponses ?? 0)],
    ["Last Provider Error", errorSummary],
    [
      "Rate Limit",
      `${limits.rateLimitCount ?? "-"} / ${limits.windowSeconds ?? "-"}s`,
    ],
    ["Max Input", `${limits.maxChars ?? "-"} chars`],
    ["Simple Query Threshold", `${limits.simpleQueryWords ?? "-"} words`],
    [
      "Cache",
      `${cache.currentEntries ?? 0}/${cache.maxEntries ?? "-"} entries (${cache.ttlSeconds ?? "-"}s TTL)`,
    ],
    ["Memory", `${memory.totalItems ?? 0}/${memory.maxItems ?? "-"} items`],
    ["Memory File", String(memory.path || "-")],
  ];

  items.forEach(([label, value]) => {
    adminAssistantStatusGrid.appendChild(
      createAssistantStatusItem(label, String(value)),
    );
  });

  const linksCard = document.createElement("article");
  linksCard.className =
    "admin-assistant-status-item admin-assistant-status-links";

  const linksTitle = document.createElement("p");
  linksTitle.className = "admin-assistant-status-key";
  linksTitle.textContent = "Billing Links";

  const linksWrap = document.createElement("p");
  linksWrap.className = "admin-assistant-status-value";

  const billingLinks = [
    {
      label: "OpenAI Billing",
      href: billing?.openai?.overviewUrl,
    },
    {
      label: "OpenAI Usage",
      href: billing?.openai?.usageUrl,
    },
    {
      label: "Anthropic Billing",
      href: billing?.anthropic?.overviewUrl,
    },
    {
      label: "Anthropic Usage",
      href: billing?.anthropic?.usageUrl,
    },
    {
      label: "Gemini Billing",
      href: billing?.gemini?.overviewUrl,
    },
    {
      label: "Gemini Usage",
      href: billing?.gemini?.usageUrl,
    },
  ].filter((item) => Boolean(item.href));

  billingLinks.forEach((item) => {
    const link = document.createElement("a");
    link.href = String(item.href || "#");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "admin-assistant-link";
    link.textContent = item.label;
    linksWrap.append(link);
  });

  linksCard.append(linksTitle, linksWrap);
  adminAssistantStatusGrid.appendChild(linksCard);

  if (adminAssistantStatusUpdatedAt) {
    adminAssistantStatusUpdatedAt.textContent = `Updated: ${formatAssistantDate(payload?.generatedAt)}`;
  }
}

function renderAdminAssistantStatusError(errorMessage) {
  if (!adminAssistantStatusGrid) {
    return;
  }

  adminAssistantStatusGrid.innerHTML = "";
  const fallback = document.createElement("p");
  fallback.className = "admin-chart-empty";
  fallback.textContent = errorMessage;
  adminAssistantStatusGrid.appendChild(fallback);

  if (adminAssistantStatusUpdatedAt) {
    adminAssistantStatusUpdatedAt.textContent = "";
  }
}

function renderAdminRuntimeMetrics(payload) {
  if (!adminRuntimeMetricsGrid) {
    return;
  }

  adminRuntimeMetricsGrid.innerHTML = "";

  const runtime = payload?.runtime || {};
  const requests = runtime.requests || {};
  const status = requests.status || {};
  const latency = runtime.latencyMs || {};
  const routes = Array.isArray(requests.topRoutes) ? requests.topRoutes : [];
  const health = runtime.health || {};

  adminRuntimeMetricsGrid.appendChild(
    createRuntimeHealthItem(health.level, health.reasons),
  );

  const items = [
    ["Started At", formatAssistantDate(runtime.startedAt)],
    ["Uptime", `${runtime.uptimeSeconds ?? 0}s`],
    ["API Requests", String(requests.apiTotal ?? 0)],
    ["Requests Last 60s", String(requests.last60s ?? 0)],
    ["Request Rate", `${requests.ratePerMinute ?? 0} req/min`],
    ["2xx", String(status["2xx"] ?? 0)],
    ["4xx", String(status["4xx"] ?? 0)],
    ["5xx", String(status["5xx"] ?? 0)],
    ["Other Status", String(status.other ?? 0)],
    ["Latency Avg", `${latency.avg ?? 0} ms`],
    ["Latency P95", `${latency.p95 ?? 0} ms`],
    ["Latency Sample Size", String(latency.sampleSize ?? 0)],
    [
      "Top Routes",
      routes.length
        ? routes
            .map((item) => `${String(item.path || "-")} (${item.count ?? 0})`)
            .join(" | ")
        : "No API traffic yet",
    ],
  ];

  items.forEach(([label, value]) => {
    adminRuntimeMetricsGrid.appendChild(
      createAssistantStatusItem(label, String(value)),
    );
  });

  if (adminRuntimeMetricsUpdatedAt) {
    adminRuntimeMetricsUpdatedAt.textContent = `Updated: ${formatAssistantDate(payload?.generatedAt)}`;
  }
}

function renderAdminRuntimeMetricsError(errorMessage) {
  if (!adminRuntimeMetricsGrid) {
    return;
  }

  adminRuntimeMetricsGrid.innerHTML = "";
  const fallback = document.createElement("p");
  fallback.className = "admin-chart-empty";
  fallback.textContent = errorMessage;
  adminRuntimeMetricsGrid.appendChild(fallback);

  if (adminRuntimeMetricsUpdatedAt) {
    adminRuntimeMetricsUpdatedAt.textContent = "";
  }
}

async function refreshRuntimeMetricsWithStatus(okMessage = "") {
  if (!adminRuntimeMetricsGrid) {
    return;
  }

  if (isRuntimeRefreshInFlight) {
    return;
  }

  isRuntimeRefreshInFlight = true;

  try {
    const payload = await fetchAdminRuntimeMetrics();
    renderAdminRuntimeMetrics(payload);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    renderAdminRuntimeMetricsError(
      error.message || "Could not load runtime metrics.",
    );
    if (okMessage) {
      setAdminStatus(error.message || "Could not load runtime metrics.", true);
    }
  } finally {
    isRuntimeRefreshInFlight = false;
  }
}

function stopRuntimeAutoRefresh() {
  if (runtimeMetricsCountdownIntervalId != null) {
    window.clearInterval(runtimeMetricsCountdownIntervalId);
    runtimeMetricsCountdownIntervalId = null;
  }
  runtimeNextRefreshAtMs = 0;

  if (runtimeMetricsIntervalId == null) {
    setRuntimeAutoRefreshState(false);
    return;
  }

  window.clearInterval(runtimeMetricsIntervalId);
  runtimeMetricsIntervalId = null;
  setRuntimeAutoRefreshState(false);
}

function stopSearchAutoRefresh() {
  if (searchStatusCountdownIntervalId != null) {
    window.clearInterval(searchStatusCountdownIntervalId);
    searchStatusCountdownIntervalId = null;
  }
  searchStatusNextRefreshAtMs = 0;

  if (searchStatusIntervalId == null) {
    setSearchAutoRefreshState(false);
    return;
  }

  window.clearInterval(searchStatusIntervalId);
  searchStatusIntervalId = null;
  setSearchAutoRefreshState(false);
}

function shouldRunRuntimeAutoRefresh() {
  if (!adminRuntimeMetricsGrid || !adminDashboard) {
    return false;
  }

  if (adminDashboard.hidden) {
    return false;
  }

  if (!getAdminToken()) {
    return false;
  }

  if (document.visibilityState === "hidden") {
    return false;
  }

  return true;
}

function shouldRunSearchAutoRefresh() {
  if (!adminSearchStatusGrid || !adminDashboard) {
    return false;
  }

  if (adminDashboard.hidden) {
    return false;
  }

  if (!getAdminToken()) {
    return false;
  }

  if (document.visibilityState === "hidden") {
    return false;
  }

  return true;
}

function ensureRuntimeAutoRefresh() {
  if (!shouldRunRuntimeAutoRefresh()) {
    stopRuntimeAutoRefresh();
    return;
  }

  if (runtimeMetricsIntervalId != null) {
    updateRuntimeAutoRefreshCountdown();
    return;
  }

  runtimeNextRefreshAtMs = Date.now() + RUNTIME_AUTO_REFRESH_MS;

  runtimeMetricsIntervalId = window.setInterval(() => {
    if (!shouldRunRuntimeAutoRefresh()) {
      stopRuntimeAutoRefresh();
      return;
    }

    runtimeNextRefreshAtMs = Date.now() + RUNTIME_AUTO_REFRESH_MS;
    updateRuntimeAutoRefreshCountdown();
    refreshRuntimeMetricsWithStatus("");
  }, RUNTIME_AUTO_REFRESH_MS);

  if (runtimeMetricsCountdownIntervalId == null) {
    runtimeMetricsCountdownIntervalId = window.setInterval(
      updateRuntimeAutoRefreshCountdown,
      1000,
    );
  }

  updateRuntimeAutoRefreshCountdown();
}

function ensureSearchAutoRefresh() {
  if (!shouldRunSearchAutoRefresh()) {
    stopSearchAutoRefresh();
    return;
  }

  if (searchStatusIntervalId != null) {
    updateSearchAutoRefreshCountdown();
    return;
  }

  searchStatusNextRefreshAtMs = Date.now() + SEARCH_AUTO_REFRESH_MS;

  searchStatusIntervalId = window.setInterval(() => {
    if (!shouldRunSearchAutoRefresh()) {
      stopSearchAutoRefresh();
      return;
    }

    searchStatusNextRefreshAtMs = Date.now() + SEARCH_AUTO_REFRESH_MS;
    updateSearchAutoRefreshCountdown();
    refreshSearchStatusWithMessage("");
  }, SEARCH_AUTO_REFRESH_MS);

  if (searchStatusCountdownIntervalId == null) {
    searchStatusCountdownIntervalId = window.setInterval(
      updateSearchAutoRefreshCountdown,
      1000,
    );
  }

  updateSearchAutoRefreshCountdown();
}

async function refreshAssistantStatusWithStatus(okMessage = "") {
  if (!adminAssistantStatusGrid) {
    return;
  }

  try {
    const payload = await fetchAdminAssistantStatus();
    renderAdminAssistantStatus(payload);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    renderAdminAssistantStatusError(
      error.message || "Could not load assistant status.",
    );
    if (okMessage) {
      setAdminStatus(error.message || "Could not load assistant status.", true);
    }
  }
}

async function refreshBackupsWithStatus(okMessage) {
  try {
    const backups = await fetchAdminBackups(currentBackupReason);
    renderBackupList(backups);
    if (okMessage) {
      setAdminStatus(okMessage);
    }
  } catch (error) {
    setAdminStatus(error.message || "Could not load backups.", true);
  }
}

async function tryAutoLogin() {
  const token = getAdminToken();
  if (!token) {
    return false;
  }

  try {
    if (adminRange) {
      currentAdminRange = adminRange.value || "all";
    }
    const data = await fetchAdminOverview(currentAdminRange);
    adminAuthPanel.hidden = true;
    adminDashboard.hidden = false;
    renderAdminDashboard(data);
    await refreshBackupsWithStatus("");
    await refreshRuntimeMetricsWithStatus("");
    await refreshAssistantStatusWithStatus("");
    await refreshRoutingStatus("");
    await refreshSearchStatusWithMessage("");
    await refreshRewriteRulesWithMessage("");
    await refreshAdminIndexPanelWithMessage("");
    ensureRuntimeAutoRefresh();
    ensureSearchAutoRefresh();
    return true;
  } catch {
    setAdminToken("");
    stopRuntimeAutoRefresh();
    stopSearchAutoRefresh();
    return false;
  }
}

function initAdminPage() {
  if (!adminLoginForm || !adminAuthPanel || !adminDashboard) {
    return;
  }

  setRuntimeAutoRefreshState(false);
  setSearchAutoRefreshState(false);
  loadHiddenCols();
  applyColHeaderVisibility();
  updateColTogglePanelUI();

  if (adminRange) {
    adminRange.value = currentAdminRange;
  }

  if (adminBackupReason) {
    adminBackupReason.value = currentBackupReason;
  }
  if (adminIndexBackupReasonFilter) {
    adminIndexBackupReasonFilter.value = currentIndexBackupReason;
  }

  tryAutoLogin();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      ensureRuntimeAutoRefresh();
      ensureSearchAutoRefresh();
      if (shouldRunRuntimeAutoRefresh()) {
        refreshRuntimeMetricsWithStatus("");
      }
      if (shouldRunSearchAutoRefresh()) {
        refreshSearchStatusWithMessage("");
      }
      return;
    }

    stopRuntimeAutoRefresh();
    stopSearchAutoRefresh();
  });

  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username =
      document.getElementById("adminUsername")?.value?.trim() || "";
    const password = document.getElementById("adminPassword")?.value || "";

    if (!username || !password) {
      setAdminStatus("Please enter username and password.", true);
      return;
    }

    setAdminStatus("Authenticating...");

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Sign in failed.");
      }

      setAdminToken(payload.token);
      currentAdminRange = adminRange?.value || "all";
      const data = await fetchAdminOverview(currentAdminRange);
      adminAuthPanel.hidden = true;
      adminDashboard.hidden = false;
      renderAdminDashboard(data);
      await refreshBackupsWithStatus("");
      await refreshRuntimeMetricsWithStatus("");
      await refreshAssistantStatusWithStatus("");
      await refreshRoutingStatus("");
      await refreshSearchStatusWithMessage("");
      await refreshRewriteRulesWithMessage("");
      await refreshAdminIndexPanelWithMessage("");
      ensureRuntimeAutoRefresh();
      ensureSearchAutoRefresh();
      setAdminStatus("Signed in.");
    } catch (error) {
      setAdminStatus(error.message || "Could not sign in.", true);
    }
  });

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", () => {
      stopRuntimeAutoRefresh();
      stopSearchAutoRefresh();
      setAdminToken("");
      adminDashboard.hidden = true;
      adminAuthPanel.hidden = false;
      setAdminStatus("Signed out.");
    });
  }

  if (adminRange) {
    adminRange.addEventListener("change", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      currentAdminRange = adminRange.value || "all";
      try {
        const data = await fetchAdminOverview(currentAdminRange);
        renderAdminDashboard(data);
      } catch (error) {
        setAdminStatus(error.message || "Could not refresh analytics.", true);
      }
    });
  }

  if (adminRefreshBtn) {
    adminRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      try {
        const data = await fetchAdminOverview(currentAdminRange);
        renderAdminDashboard(data);
        await refreshRuntimeMetricsWithStatus("");
        await refreshAssistantStatusWithStatus("");
        await refreshSearchStatusWithMessage("");
        await refreshRewriteRulesWithMessage("");
        await refreshAdminIndexPanelWithMessage("");
        ensureRuntimeAutoRefresh();
        ensureSearchAutoRefresh();
        setAdminStatus("Analytics refreshed.");
      } catch (error) {
        setAdminStatus(error.message || "Could not refresh analytics.", true);
      }
    });
  }

  if (adminOpenLtrMonitorBtn) {
    adminOpenLtrMonitorBtn.addEventListener("click", () => {
      openAdminDashboardPage("admin-ltr-monitor.html");
    });
  }

  if (adminOpenAnalyticsDashboardBtn) {
    adminOpenAnalyticsDashboardBtn.addEventListener("click", () => {
      openAdminDashboardPage("analytics-dashboard.html");
    });
  }

  if (adminAssistantStatusRefreshBtn) {
    adminAssistantStatusRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      await refreshAssistantStatusWithStatus("Assistant status refreshed.");
    });
  }

  if (adminRuntimeMetricsRefreshBtn) {
    adminRuntimeMetricsRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        stopRuntimeAutoRefresh();
        return;
      }

      await refreshRuntimeMetricsWithStatus("Runtime metrics refreshed.");
      ensureRuntimeAutoRefresh();
    });
  }

  if (adminExportBtn) {
    adminExportBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      try {
        await exportAdminCsv(currentAdminRange);
        setAdminStatus("CSV export completed.");
      } catch (error) {
        setAdminStatus(error.message || "Could not export CSV.", true);
      }
    });
  }

  if (adminResetClickTelemetryBtn) {
    adminResetClickTelemetryBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      if (
        !window.confirm(
          "Reset click telemetry counters now? This cannot be undone.",
        )
      ) {
        return;
      }

      setClickTelemetryActionButtonsBusy(true);
      try {
        await resetClickSignalTelemetry();
        const data = await fetchAdminOverview(currentAdminRange);
        renderAdminDashboard(data);
        setAdminStatus("Click telemetry reset.");
      } catch (error) {
        setAdminStatus(
          error.message || "Could not reset click telemetry.",
          true,
        );
      } finally {
        setClickTelemetryActionButtonsBusy(false);
      }
    });
  }

  if (adminSnapshotResetClickTelemetryBtn) {
    adminSnapshotResetClickTelemetryBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      if (
        !window.confirm(
          "Create snapshot and reset click telemetry counters now?",
        )
      ) {
        return;
      }

      setClickTelemetryActionButtonsBusy(true);
      try {
        const payload = await snapshotAndResetClickSignalTelemetry();
        addAdminClickSnapshotHistoryItem(payload.snapshot);
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const blob = new Blob(
          [JSON.stringify(payload.snapshot || {}, null, 2)],
          {
            type: "application/json;charset=utf-8",
          },
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `magneto-click-telemetry-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        const data = await fetchAdminOverview(currentAdminRange);
        renderAdminDashboard(data);
        setAdminStatus("Telemetry snapshot downloaded and counters reset.");
      } catch (error) {
        setAdminStatus(
          error.message || "Could not snapshot/reset click telemetry.",
          true,
        );
      } finally {
        setClickTelemetryActionButtonsBusy(false);
      }
    });
  }

  if (adminClearClickSnapshotHistoryBtn) {
    adminClearClickSnapshotHistoryBtn.addEventListener("click", () => {
      if (adminDashboard.hidden) {
        return;
      }

      if (!getAdminClickSnapshotHistory().length) {
        setAdminStatus("No local telemetry snapshots to clear.");
        renderAdminClickSnapshotHistory();
        return;
      }

      if (!window.confirm("Clear all local telemetry snapshots?")) {
        return;
      }

      clearAdminClickSnapshotHistory();
      renderAdminClickSnapshotHistory();
      setAdminStatus("Local telemetry snapshot history cleared.");
    });
  }

  if (adminPinClickSnapshotBaselineBtn) {
    adminPinClickSnapshotBaselineBtn.addEventListener("click", () => {
      if (adminDashboard.hidden) {
        return;
      }

      const history = getAdminClickSnapshotHistory();
      if (!history.length) {
        setAdminStatus("No snapshots available to pin as baseline.", true);
        return;
      }

      saveAdminClickSnapshotBaseline(history[0]);
      renderAdminClickSnapshotHistory();
      setAdminStatus("Latest snapshot pinned as baseline.");
    });
  }

  if (adminClearClickSnapshotBaselineBtn) {
    adminClearClickSnapshotBaselineBtn.addEventListener("click", () => {
      if (adminDashboard.hidden) {
        return;
      }

      saveAdminClickSnapshotBaseline(null);
      renderAdminClickSnapshotHistory();
      setAdminStatus("Baseline cleared.");
    });
  }

  if (adminBackupRefreshBtn) {
    adminBackupRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshBackupsWithStatus("Backup list refreshed.");
    });
  }

  if (adminBackupReason) {
    adminBackupReason.addEventListener("change", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      currentBackupReason = adminBackupReason.value || "all";
      await refreshBackupsWithStatus("Backup filter applied.");
    });
  }

  if (adminBackupCreateBtn) {
    adminBackupCreateBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      try {
        const backups = await createBackupNow();
        renderBackupList(backups);
        setAdminStatus("Manual backup created.");
      } catch (error) {
        setAdminStatus(error.message || "Could not create backup.", true);
      }
    });
  }

  if (adminRoutingRefreshBtn) {
    adminRoutingRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshRoutingStatus("Routing status refreshed.");
    });
  }

  if (adminRoutingVerifyBtn) {
    adminRoutingVerifyBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      try {
        setAdminStatus("Running dry-test...");
        const result = await fetchAdminRoutingVerify();
        renderRoutingVerify(result);
        renderRoutingState(result.routing || {});
        setAdminStatus(
          result.ok
            ? "Dry-test PASSED."
            : "Dry-test PARTIAL – see results below.",
          !result.ok,
        );
      } catch (error) {
        setAdminStatus(error.message || "Dry-test failed.", true);
      }
    });
  }

  adminRoutingBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      const backend = btn.dataset.backend || "node";
      const canaryPercent = Number(btn.dataset.canary ?? 100);
      const note = btn.dataset.note || "";
      try {
        const result = await postAdminRouting({
          activeBackend: backend,
          canaryPercent,
          note,
        });
        renderRoutingState(result.routing || {});
        if (adminRoutingVerifyResult) {
          adminRoutingVerifyResult.hidden = true;
        }
        setAdminStatus(
          `Routing switched: ${backend.toUpperCase()} @ ${canaryPercent}%.`,
        );
      } catch (error) {
        setAdminStatus(error.message || "Could not update routing.", true);
      }
    });
  });

  if (adminSearchStatusRefreshBtn) {
    adminSearchStatusRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshSearchStatusWithMessage("Search status refreshed.");
      ensureSearchAutoRefresh();
    });
  }

  if (adminRankingConfigRefreshBtn) {
    adminRankingConfigRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshRankingConfigWithMessage("Ranking config refreshed.");
    });
  }

  if (adminRankingConfigSaveBtn) {
    adminRankingConfigSaveBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden || !adminRankingConfigJson) {
        return;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(String(adminRankingConfigJson.value || "{}"));
      } catch {
        setAdminStatus("Ranking config JSON is invalid.", true);
        return;
      }

      adminRankingConfigSaveBtn.disabled = true;
      try {
        const payload = await postAdminRankingConfig({ rankingConfig: parsed });
        renderAdminRankingConfig(payload);
        await refreshSearchStatusWithMessage("");
        setAdminStatus("Ranking config saved.");
      } catch (error) {
        setAdminStatus(error.message || "Could not save ranking config.", true);
      } finally {
        adminRankingConfigSaveBtn.disabled = false;
      }
    });
  }

  if (adminRankingConfigResetBtn) {
    adminRankingConfigResetBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      const confirmed = window.confirm(
        "Reset search ranking config to defaults?",
      );
      if (!confirmed) {
        return;
      }

      adminRankingConfigResetBtn.disabled = true;
      try {
        const payload = await postAdminRankingConfig({ reset: true });
        renderAdminRankingConfig(payload);
        await refreshSearchStatusWithMessage("");
        setAdminStatus("Ranking config reset to defaults.");
      } catch (error) {
        setAdminStatus(
          error.message || "Could not reset ranking config.",
          true,
        );
      } finally {
        adminRankingConfigResetBtn.disabled = false;
      }
    });
  }

  if (adminRewriteRulesRefreshBtn) {
    adminRewriteRulesRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      await refreshRewriteRulesWithMessage("Rewrite rules refreshed.");
    });
  }

  if (adminRewriteRulesAddBtn) {
    adminRewriteRulesAddBtn.addEventListener("click", () => {
      if (adminDashboard.hidden) {
        return;
      }

      appendAdminRewriteRule({}, true);
      setAdminStatus("New rewrite rule added locally. Save to apply it.");
    });
  }

  if (adminRewriteRulesSuggestBtn) {
    adminRewriteRulesSuggestBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      const minConfidenceRaw = Number(adminRewriteMinConfidence?.value || 0.6);
      const minConfidence = Number.isFinite(minConfidenceRaw)
        ? Math.max(0, Math.min(0.99, minConfidenceRaw))
        : 0.6;

      adminRewriteRulesSuggestBtn.disabled = true;
      try {
        const payload = await fetchAdminRewriteRuleSuggestions(
          12,
          minConfidence.toFixed(2),
        );
        const suggestions = Array.isArray(payload?.suggestions)
          ? payload.suggestions
          : [];

        if (suggestions.length === 0) {
          setAdminStatus(
            `No rewrite suggestions matched min confidence ${minConfidence.toFixed(2)}.`,
          );
          return;
        }

        let added = 0;
        suggestions.forEach((suggestion) => {
          if (!hasAdminRewriteRule(suggestion)) {
            appendAdminRewriteRule(suggestion, false);
            added += 1;
          }
        });

        if (added === 0) {
          setAdminStatus("All suggested rewrite rules are already present.");
        } else {
          const confidences = suggestions
            .map((item) => Number(item?.signals?.confidence || 0))
            .filter((value) => Number.isFinite(value) && value > 0);
          const avgConfidence = confidences.length
            ? (
                confidences.reduce((sum, value) => sum + value, 0) /
                confidences.length
              ).toFixed(2)
            : "n/a";
          setAdminStatus(
            `${added} telemetry suggestion${added !== 1 ? "s" : ""} added (avg confidence ${avgConfidence}, min ${minConfidence.toFixed(2)}). Save rules to apply them.`,
          );
        }
      } catch (error) {
        setAdminStatus(
          error.message || "Could not fetch rewrite suggestions.",
          true,
        );
      } finally {
        adminRewriteRulesSuggestBtn.disabled = false;
      }
    });
  }

  if (adminRewriteRulesSaveBtn) {
    adminRewriteRulesSaveBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      let rewriteRules = [];
      try {
        rewriteRules = collectAdminRewriteRules();
      } catch (error) {
        setAdminStatus(error.message || "Rewrite rules are invalid.", true);
        return;
      }

      adminRewriteRulesSaveBtn.disabled = true;
      try {
        const payload = await postAdminRewriteRules({ rewriteRules });
        renderAdminRewriteRules(payload);
        await refreshSearchStatusWithMessage("");
        setAdminStatus("Rewrite rules saved.");
      } catch (error) {
        setAdminStatus(error.message || "Could not save rewrite rules.", true);
      } finally {
        adminRewriteRulesSaveBtn.disabled = false;
      }
    });
  }

  if (adminRewriteRulesResetBtn) {
    adminRewriteRulesResetBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      if (!window.confirm("Reset query rewrite rules to defaults?")) {
        return;
      }

      adminRewriteRulesResetBtn.disabled = true;
      try {
        const payload = await postAdminRewriteRules({ reset: true });
        renderAdminRewriteRules(payload);
        await refreshSearchStatusWithMessage("");
        setAdminStatus("Rewrite rules reset to defaults.");
      } catch (error) {
        setAdminStatus(error.message || "Could not reset rewrite rules.", true);
      } finally {
        adminRewriteRulesResetBtn.disabled = false;
      }
    });
  }

  if (adminIndexSyncStatusBtn) {
    adminIndexSyncStatusBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshIndexSyncStatusWithMessage("Index sync status refreshed.");
    });
  }

  if (adminIndexSyncRunBtn) {
    adminIndexSyncRunBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      const payload = {
        source: String(adminIndexSyncSource?.value || "").trim(),
        status: String(adminIndexSyncStatusFilter?.value || "indexed").trim(),
        pageSize: Number(adminIndexSyncPageSize?.value || 200),
        maxPages: Number(adminIndexSyncMaxPages?.value || 50),
        updatedSince: String(adminIndexSyncUpdatedSince?.value || "").trim(),
        useWatermark: Boolean(adminIndexSyncUseWatermark?.checked),
        createBackup: Boolean(adminIndexSyncCreateBackup?.checked),
      };

      adminIndexSyncRunBtn.disabled = true;
      try {
        const result = await postAdminIndexSync(payload);
        await refreshSearchStatusWithMessage("");
        await refreshIndexSyncStatusWithMessage("");
        const imported = Number(result?.sync?.importedDocuments || 0);
        const fetched = Number(result?.sync?.fetchedDocuments || 0);
        setAdminStatus(
          `Index sync finished. Imported ${imported}, fetched ${fetched}.`,
        );
      } catch (error) {
        setAdminStatus(error.message || "Could not run index sync.", true);
      } finally {
        adminIndexSyncRunBtn.disabled = false;
      }
    });
  }

  if (adminIndexSyncForm && adminIndexSyncRunBtn) {
    adminIndexSyncForm.addEventListener("submit", (event) => {
      event.preventDefault();
      adminIndexSyncRunBtn.click();
    });
  }

  if (adminIndexSyncResetWatermarkBtn) {
    adminIndexSyncResetWatermarkBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      const updatedSince = String(
        adminIndexSyncUpdatedSince?.value || "",
      ).trim();
      adminIndexSyncResetWatermarkBtn.disabled = true;
      try {
        await postAdminIndexSyncResetWatermark(updatedSince);
        await refreshIndexSyncStatusWithMessage("");
        setAdminStatus(
          updatedSince
            ? `Sync watermark set to ${updatedSince}.`
            : "Sync watermark reset.",
        );
      } catch (error) {
        setAdminStatus(
          error.message || "Could not update sync watermark.",
          true,
        );
      } finally {
        adminIndexSyncResetWatermarkBtn.disabled = false;
      }
    });
  }

  if (adminIndexStatusBtn) {
    adminIndexStatusBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshAdminIndexStatusWithMessage("Local index status refreshed.");
    });
  }

  if (adminIndexBackupsBtn) {
    adminIndexBackupsBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshAdminIndexBackupsWithMessage(
        "Local index backups refreshed.",
      );
    });
  }

  if (adminIndexBackupReasonFilter) {
    adminIndexBackupReasonFilter.addEventListener("change", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      currentIndexBackupReason =
        String(adminIndexBackupReasonFilter.value || "all").trim() || "all";
      await refreshAdminIndexBackupsWithMessage("Index backup filter applied.");
    });
  }

  if (adminIndexRefreshBtn) {
    adminIndexRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      const createBackup = Boolean(adminIndexRefreshCreateBackup?.checked);
      adminIndexRefreshBtn.disabled = true;
      try {
        const payload = await postAdminIndexRefresh({ createBackup });
        renderAdminIndexStatus(payload);
        await refreshAdminIndexBackupsWithMessage("");
        const count = Number(
          payload?.refresh?.afterCount || payload?.index?.totalDocs || 0,
        );
        setAdminStatus(`Local index rebuilt. Total docs: ${count}.`);
      } catch (error) {
        setAdminStatus(error.message || "Could not rebuild local index.", true);
      } finally {
        adminIndexRefreshBtn.disabled = false;
      }
    });
  }

  if (adminIndexRestoreBtn) {
    adminIndexRestoreBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      const fileName = String(adminIndexRestoreFile?.value || "").trim();
      if (!fileName) {
        setAdminStatus("Choose a backup file to restore.", true);
        return;
      }

      const confirmed = window.confirm(
        `Restore local index from backup '${fileName}'?`,
      );
      if (!confirmed) {
        return;
      }

      const createBackup = Boolean(adminIndexRestoreCreateBackup?.checked);
      adminIndexRestoreBtn.disabled = true;
      try {
        await postAdminIndexRestore({ fileName, createBackup });
        await refreshAdminIndexPanelWithMessage("");
        setAdminStatus(`Local index restored from ${fileName}.`);
      } catch (error) {
        setAdminStatus(
          error.message || "Could not restore local index backup.",
          true,
        );
      } finally {
        adminIndexRestoreBtn.disabled = false;
      }
    });
  }

  if (adminIndexForm && adminIndexRefreshBtn) {
    adminIndexForm.addEventListener("submit", (event) => {
      event.preventDefault();
      adminIndexRefreshBtn.click();
    });
  }

  if (adminSearchRunsRefreshBtn) {
    adminSearchRunsRefreshBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await refreshSearchStatusWithMessage("Search runs refreshed.");
      ensureSearchAutoRefresh();
    });
  }

  if (adminSearchRunsColToggleBtn && adminSearchColTogglePanel) {
    adminSearchRunsColToggleBtn.addEventListener("click", (event) => {
      event.preventDefault();
      adminSearchColTogglePanel.hidden = !adminSearchColTogglePanel.hidden;
      adminSearchRunsColToggleBtn.setAttribute(
        "aria-expanded",
        String(!adminSearchColTogglePanel.hidden),
      );
      if (!adminSearchColTogglePanel.hidden) {
        updateColTogglePanelUI();
      }
    });

    document.addEventListener("click", (event) => {
      if (adminSearchColTogglePanel.hidden) {
        return;
      }
      if (
        adminSearchColTogglePanel.contains(event.target) ||
        adminSearchRunsColToggleBtn.contains(event.target)
      ) {
        return;
      }
      adminSearchColTogglePanel.hidden = true;
      adminSearchRunsColToggleBtn.setAttribute("aria-expanded", "false");
    });

    adminSearchColTogglePanel.addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") {
        return;
      }
      const colKey = (
        String(input.dataset.colKey || "") ||
        String(input.id || "").replace("adminSearchColToggle_", "")
      ).trim();
      if (!ADMIN_SEARCH_RUNS_COL_KEYS.includes(colKey)) {
        return;
      }
      if (input.checked) {
        adminSearchRunsHiddenCols.delete(colKey);
      } else {
        adminSearchRunsHiddenCols.add(colKey);
      }
      saveHiddenCols();
      applyColHeaderVisibility();
      renderAdminSearchRunsTable();
    });
  }

  if (adminSearchRunsPrevPageBtn) {
    adminSearchRunsPrevPageBtn.addEventListener("click", () => {
      if (adminSearchRunsPage <= 0) {
        return;
      }
      adminSearchRunsPage -= 1;
      renderAdminSearchRunsTable();
    });
  }

  if (adminSearchRunsNextPageBtn) {
    adminSearchRunsNextPageBtn.addEventListener("click", () => {
      adminSearchRunsPage += 1;
      renderAdminSearchRunsTable();
    });
  }

  if (adminSearchSeedBtn) {
    adminSearchSeedBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      const force = Boolean(adminSearchForceSeed?.checked);
      adminSearchSeedBtn.disabled = true;
      try {
        const payload = await postAdminSearchSeed(force);
        renderAdminSearchStatus(payload);
        ensureSearchAutoRefresh();
        setAdminStatus(
          `Seed completed. Created ${Number(payload.created || 0)}, updated ${Number(payload.updated || 0)}.`,
        );
      } catch (error) {
        setAdminStatus(error.message || "Could not seed search sources.", true);
      } finally {
        adminSearchSeedBtn.disabled = false;
      }
    });
  }

  if (adminSearchCrawlBtn) {
    adminSearchCrawlBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }

      const sourceIds = String(adminSearchSourceIds?.value || "")
        .split(/[^0-9]+/)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
      const uniqueSourceIds = [...new Set(sourceIds)];

      const maxPagesRaw = String(adminSearchMaxPages?.value || "").trim();
      const maxPages = /^\d+$/.test(maxPagesRaw) ? Number(maxPagesRaw) : null;

      adminSearchCrawlBtn.disabled = true;
      try {
        const payload = await postAdminSearchCrawl({
          sourceIds: uniqueSourceIds,
          maxPages,
        });
        if (payload.search) {
          renderAdminSearchStatus(payload);
        } else {
          await refreshSearchStatusWithMessage("");
        }
        ensureSearchAutoRefresh();

        const runsCount = Array.isArray(payload.runs) ? payload.runs.length : 0;
        setAdminStatus(`Crawl completed for ${runsCount} source run(s).`);
      } catch (error) {
        setAdminStatus(error.message || "Could not run search crawl.", true);
      } finally {
        adminSearchCrawlBtn.disabled = false;
      }
    });
  }

  if (adminSearchCrawlForm && adminSearchCrawlBtn) {
    adminSearchCrawlForm.addEventListener("submit", (event) => {
      event.preventDefault();
      adminSearchCrawlBtn.click();
    });
  }

  if (adminSearchRunsStatusFilter) {
    adminSearchRunsStatusFilter.addEventListener("change", () => {
      adminSearchRunsPage = 0;
      renderAdminSearchRunsTable();
    });
  }

  if (adminSearchRunsSourceFilter) {
    adminSearchRunsSourceFilter.addEventListener("input", () => {
      adminSearchRunsPage = 0;
      renderAdminSearchRunsTable();
    });
  }

  if (adminSearchRunsFilterClearBtn) {
    adminSearchRunsFilterClearBtn.addEventListener("click", () => {
      if (adminSearchRunsStatusFilter) {
        adminSearchRunsStatusFilter.value = "all";
      }
      if (adminSearchRunsSourceFilter) {
        adminSearchRunsSourceFilter.value = "";
      }
      adminSearchRunsPage = 0;
      renderAdminSearchRunsTable();
    });
  }

  if (adminSearchRunsExportBtn) {
    adminSearchRunsExportBtn.addEventListener("click", () => {
      if (adminDashboard.hidden) {
        return;
      }
      exportSearchRunsCsv();
    });
  }

  if (adminSearchRunsCopyBtn) {
    adminSearchRunsCopyBtn.addEventListener("click", async () => {
      if (adminDashboard.hidden) {
        return;
      }
      await copySearchRunsCsvToClipboard();
    });
  }

  if (adminSearchRunsPreviewBtn) {
    adminSearchRunsPreviewBtn.addEventListener("click", () => {
      if (adminDashboard.hidden) {
        return;
      }
      previewSearchRunsCsv();
    });
  }

  if (adminSearchCsvModalCloseBtn) {
    adminSearchCsvModalCloseBtn.addEventListener(
      "click",
      closeSearchCsvPreviewModal,
    );
  }

  if (adminSearchCsvModal) {
    adminSearchCsvModal.addEventListener("click", (event) => {
      if (event.target === adminSearchCsvModal) {
        closeSearchCsvPreviewModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      adminSearchCsvModal &&
      !adminSearchCsvModal.hidden
    ) {
      closeSearchCsvPreviewModal();
    }
  });

  if (adminSearchCsvPreviewSearchInput) {
    adminSearchCsvPreviewSearchInput.addEventListener(
      "input",
      updateSearchCsvPreviewByQuery,
    );
  }

  if (adminSearchCsvPreviewSearchClearBtn) {
    adminSearchCsvPreviewSearchClearBtn.addEventListener("click", () => {
      if (adminSearchCsvPreviewSearchInput) {
        adminSearchCsvPreviewSearchInput.value = "";
      }
      updateSearchCsvPreviewByQuery();
    });
  }

  if (adminSearchCsvPreviewSearchInput) {
    adminSearchCsvPreviewSearchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        navigateCsvPreviewMatch(event.shiftKey ? -1 : 1);
      }
    });
  }

  if (adminSearchCsvPreviewPrevBtn) {
    adminSearchCsvPreviewPrevBtn.addEventListener("click", () =>
      navigateCsvPreviewMatch(-1),
    );
  }

  if (adminSearchCsvPreviewNextBtn) {
    adminSearchCsvPreviewNextBtn.addEventListener("click", () =>
      navigateCsvPreviewMatch(1),
    );
  }

  if (adminSearchRunDetailCloseBtn) {
    adminSearchRunDetailCloseBtn.addEventListener(
      "click",
      closeSearchRunDetail,
    );
  }

  adminSearchRunsSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = String(button.dataset.sortKey || "").trim();
      if (!key) {
        return;
      }

      if (adminSearchRunsSortKey === key) {
        adminSearchRunsSortDirection =
          adminSearchRunsSortDirection === "asc" ? "desc" : "asc";
      } else {
        adminSearchRunsSortKey = key;
        const descendingByDefault = new Set([
          "startedAt",
          "pagesSeen",
          "pagesIndexed",
          "pagesUpdated",
          "pagesFailed",
          "pagesBlocked",
        ]);
        adminSearchRunsSortDirection = descendingByDefault.has(key)
          ? "desc"
          : "asc";
      }

      adminSearchRunsPage = 0;
      renderAdminSearchRunsTable();
    });
  });
}
