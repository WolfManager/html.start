const {
  getLoginState,
  issueAdminToken,
} = require("../services/auth/admin-auth.service");

function createLoginController({
  jwt,
  adminUser,
  adminPassword,
  jwtSecret,
  loginRateLimitCount,
  loginWindowMs,
  lockoutThreshold,
  lockoutMs,
  loginAttemptMap,
  getClientIp,
}) {
  return (req, res) => {
    const { username, password } = req.body || {};
    const ip = getClientIp(req);
    const user = String(username || "")
      .trim()
      .toLowerCase();
    const key = `${ip}|${user}`;
    const state = getLoginState({
      loginAttemptMap,
      key,
      loginWindowMs,
    });
    const now = Date.now();

    if (state.lockUntil > now) {
      const retryAfter = Math.max(1, Math.ceil((state.lockUntil - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: `Account temporarily locked. Retry in ${retryAfter} seconds.`,
      });
      return;
    }

    if (state.attempts.length >= loginRateLimitCount) {
      const retryAfter = Math.max(
        1,
        Math.ceil((loginWindowMs - (now - state.attempts[0])) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: `Too many login attempts. Retry in ${retryAfter} seconds.`,
      });
      return;
    }

    if (username !== adminUser || password !== adminPassword) {
      state.attempts.push(now);
      state.failedCount += 1;

      if (state.failedCount >= lockoutThreshold) {
        state.lockUntil = now + lockoutMs;
        state.failedCount = 0;
      }

      loginAttemptMap.set(key, state);
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }

    loginAttemptMap.delete(key);

    const token = issueAdminToken({
      jwt,
      jwtSecret,
      adminUser,
    });

    res.json({ token });
  };
}

module.exports = {
  createLoginController,
};
