(function bootstrapMagnetoHomePage(global) {
  if (typeof global.initHomeForm === "function") {
    global.initHomeForm();
  }
  if (
    typeof global.renderSearchHistory === "function" &&
    typeof global.getSearchHistory === "function"
  ) {
    global.renderSearchHistory(global.getSearchHistory());
  }
  if (
    typeof global.fetchPopularSearches === "function" &&
    typeof global.renderPopularSearches === "function"
  ) {
    global.fetchPopularSearches().then((queries) => {
      global.renderPopularSearches(queries);
    });
  }
  if (typeof global.initMagnetoFlagRotation === "function") {
    global.initMagnetoFlagRotation();
  }
  if (typeof global.initWeatherWidget === "function") {
    global.initWeatherWidget();
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
