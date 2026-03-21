function createRequestObservabilityMiddleware({ randomUUID }) {
  return (req, res, next) => {
    const startedAt = Date.now();
    const incomingRequestId = String(req.headers["x-request-id"] || "").trim();
    const requestId = incomingRequestId || randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    const originalEnd = res.end.bind(res);
    res.end = (...args) => {
      if (!res.headersSent) {
        res.setHeader("X-Response-Time-Ms", String(Date.now() - startedAt));
      }

      return originalEnd(...args);
    };

    next();
  };
}

module.exports = {
  createRequestObservabilityMiddleware,
};
