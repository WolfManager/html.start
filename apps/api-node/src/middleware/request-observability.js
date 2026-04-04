function createRequestObservabilityMiddleware({ randomUUID, logger }) {
  return (req, res, next) => {
    const startedAt = Date.now();
    const incomingRequestId = String(req.headers["x-request-id"] || "").trim();
    const requestId = incomingRequestId || randomUUID();
    const requestLogger = logger
      ? logger.child({
          requestId,
          method: req.method,
          path: req.originalUrl || req.url,
        })
      : null;

    req.requestId = requestId;
    req.log = requestLogger;
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

    res.on("finish", () => {
      if (!requestLogger) {
        return;
      }

      requestLogger.info(
        {
          statusCode: res.statusCode,
          responseTimeMs: Date.now() - startedAt,
          ip: req.ip,
        },
        "request completed",
      );
    });

    next();
  };
}

module.exports = {
  createRequestObservabilityMiddleware,
};
