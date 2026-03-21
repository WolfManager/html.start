(function bootstrapMagnetoAdminPage(global) {
  if (typeof global.initAdminPage === "function") {
    global.initAdminPage();
  }
  if (
    typeof global.trackPageView === "function" &&
    global.MagnetoPageUtils?.getPageNameFromPath
  ) {
    global.trackPageView(global.MagnetoPageUtils.getPageNameFromPath());
  }
  if (typeof global.syncSidePanelHeights === "function") {
    global.addEventListener("resize", global.syncSidePanelHeights);
    global.requestAnimationFrame(global.syncSidePanelHeights);
  }
})(window);
