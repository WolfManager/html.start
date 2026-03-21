(function initMagnetoApiClient(global) {
  const API_BASE_URL = String(global.MAGNETO_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const API_FETCH_TIMEOUT_MS = 12000;

  function buildApiUrl(path) {
    const target = String(path || "").trim();
    if (!target.startsWith("/api/")) {
      return target;
    }

    return API_BASE_URL ? `${API_BASE_URL}${target}` : target;
  }

  function apiFetch(path, options) {
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
        originalSignal.addEventListener("abort", forwardAbort, { once: true });
        removeAbortForwarder = () => {
          originalSignal.removeEventListener("abort", forwardAbort);
        };
      }
    }

    requestOptions.signal = controller.signal;
    const timeoutId = global.setTimeout(() => controller.abort(), timeoutMs);

    return global
      .fetch(buildApiUrl(path), requestOptions)
      .catch((error) => {
        if (error?.name === "AbortError") {
          throw new Error(
            `Request timed out after ${timeoutMs}ms. Check API server and API base.`,
          );
        }
        throw error;
      })
      .finally(() => {
        global.clearTimeout(timeoutId);
        if (removeAbortForwarder) {
          removeAbortForwarder();
        }
      });
  }

  global.MagnetoApiClient = {
    API_BASE_URL,
    API_FETCH_TIMEOUT_MS,
    buildApiUrl,
    apiFetch,
  };
})(window);
