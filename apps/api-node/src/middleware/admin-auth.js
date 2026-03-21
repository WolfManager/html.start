function createAdminAuthMiddleware({ jwt, jwtSecret }) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      res.status(401).json({ error: "Missing auth token." });
      return;
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token." });
    }
  };
}

module.exports = {
  createAdminAuthMiddleware,
};
