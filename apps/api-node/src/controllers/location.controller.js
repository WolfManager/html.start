function createLocationAutoController({
  getClientIp,
  resolveApproxLocationByIp,
  sanitizeIpForLookup,
}) {
  return async (req, res) => {
    const ip = getClientIp(req);

    try {
      const location = await resolveApproxLocationByIp(ip);
      res.json({
        ok: true,
        source: location.source,
        ip: sanitizeIpForLookup(ip) || "auto",
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city,
        country: location.country,
      });
    } catch {
      res.status(503).json({
        ok: false,
        error: "Automatic location currently unavailable.",
      });
    }
  };
}

module.exports = {
  createLocationAutoController,
};
