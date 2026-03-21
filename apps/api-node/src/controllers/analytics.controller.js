function createPopularSearchesController({ fs, analyticsPath }) {
  return (_req, res) => {
    try {
      const analyticsContent = fs.readFileSync(analyticsPath, "utf-8");
      const analytics = JSON.parse(analyticsContent);

      const searches = Array.isArray(analytics.searches)
        ? analytics.searches
        : [];

      const queryMap = new Map();
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      searches.forEach((item) => {
        const query = String(item.query || "")
          .trim()
          .toLowerCase();
        if (!query || query.length < 2) {
          return;
        }

        const itemTime = new Date(item.at).getTime();
        const age = now - itemTime;

        if (age > sevenDaysMs) {
          return;
        }

        if (!queryMap.has(query)) {
          queryMap.set(query, {
            query: String(item.query || "").trim(),
            count: 0,
            lastSeen: itemTime,
          });
        }

        const entry = queryMap.get(query);
        entry.count += 1;
        if (itemTime > entry.lastSeen) {
          entry.lastSeen = itemTime;
        }
      });

      const sorted = Array.from(queryMap.values())
        .sort((a, b) => {
          const countDiff = b.count - a.count;
          if (countDiff !== 0) {
            return countDiff;
          }
          return b.lastSeen - a.lastSeen;
        })
        .slice(0, 12)
        .map((item) => item.query);

      res.json({
        ok: true,
        queries: sorted,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `[analytics] Error fetching popular searches: ${String(error?.message || error)}`,
      );
      res.json({
        ok: true,
        queries: [],
        generatedAt: new Date().toISOString(),
      });
    }
  };
}

module.exports = {
  createPopularSearchesController,
};
