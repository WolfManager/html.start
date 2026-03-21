function getLoginState({ loginAttemptMap, key, loginWindowMs }) {
  const now = Date.now();
  const state = loginAttemptMap.get(key) || {
    attempts: [],
    failedCount: 0,
    lockUntil: 0,
  };

  state.attempts = state.attempts.filter((ts) => now - ts <= loginWindowMs);

  if (state.lockUntil <= now) {
    state.lockUntil = 0;
  }

  loginAttemptMap.set(key, state);
  return state;
}

function issueAdminToken({ jwt, jwtSecret, adminUser }) {
  return jwt.sign({ username: adminUser, role: "admin" }, jwtSecret, {
    expiresIn: "12h",
  });
}

module.exports = {
  getLoginState,
  issueAdminToken,
};
