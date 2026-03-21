(function initMagnetoLocationApi(global) {
  const apiFetch = global.MagnetoApiClient?.apiFetch;

  async function fetchLocationFromBackend() {
    if (typeof apiFetch !== "function") {
      throw new Error("Backend location unavailable.");
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
      ip: String(data.ip || ""),
    };
  }

  global.MagnetoLocationApi = {
    fetchLocationFromBackend,
  };
})(window);
