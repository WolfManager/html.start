function createPageViewController({ logPageView }) {
  return (req, res) => {
    const page = String(req.body?.page || "unknown");
    logPageView({
      page,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "unknown",
    });
    res.json({ ok: true });
  };
}

function createResultClickController({ logResultClick }) {
  return (req, res) => {
    const url = String(req.body?.url || "").trim();
    const title = String(req.body?.title || "").trim();
    const query = String(req.body?.query || "").trim();

    if (!url || !title || !query) {
      res.status(400).json({ error: "URL, title, and query are required." });
      return;
    }

    logResultClick({
      url,
      title,
      query,
      ip: req.ip,
    });

    res.json({ ok: true });
  };
}

module.exports = {
  createPageViewController,
  createResultClickController,
};
