(function initMagnetoAdminState(global) {
  const ADMIN_TOKEN_KEY = "magneto.admin.token";

  function getAdminToken() {
    try {
      return global.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function setAdminToken(token) {
    try {
      if (!token) {
        global.localStorage.removeItem(ADMIN_TOKEN_KEY);
        return;
      }

      global.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } catch {
      // Non-blocking when storage is unavailable.
    }
  }

  global.MagnetoAdminState = {
    ADMIN_TOKEN_KEY,
    getAdminToken,
    setAdminToken,
  };
})(window);
