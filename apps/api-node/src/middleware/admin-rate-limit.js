function createAdminRateLimitMiddleware({
  adminRateMap,
  adminWindowMs,
  adminRateLimitCount,
  getClientIp,
}) {
  return (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const state = adminRateMap.get(ip) || { hits: [] };
    state.hits = state.hits.filter((ts) => now - ts <= adminWindowMs);

    if (state.hits.length >= adminRateLimitCount) {
      const retryAfter = Math.max(
        1,
        Math.ceil((adminWindowMs - (now - state.hits[0])) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: `Too many admin requests. Retry in ${retryAfter} seconds.`,
      });
      adminRateMap.set(ip, state);
      return;
    }

    state.hits.push(now);
    adminRateMap.set(ip, state);
    next();
  };
}

module.exports = {
  createAdminRateLimitMiddleware,
};
