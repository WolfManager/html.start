function createSearchRelatedController({ getRelatedQueries }) {
  return (req, res) => {
    const query = String(req.query.q || "").trim();
    const limit = Math.min(10, Math.max(1, Number(req.query.limit || 6) || 6));

    if (!query) {
      res.status(400).json({ error: "Query is required." });
      return;
    }

    const related = getRelatedQueries(query, limit);
    res.json({
      ok: true,
      query,
      related,
      generatedAt: new Date().toISOString(),
    });
  };
}

module.exports = {
  createSearchRelatedController,
};
