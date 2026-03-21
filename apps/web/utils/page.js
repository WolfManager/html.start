(function initMagnetoPageUtils(global) {
  function getPageNameFromPath() {
    const fileName = global.location.pathname.split("/").pop() || "index.html";

    if (!fileName || fileName === "/") {
      return "index.html";
    }

    return fileName;
  }

  global.MagnetoPageUtils = {
    getPageNameFromPath,
  };
})(window);
