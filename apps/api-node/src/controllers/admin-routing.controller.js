function createRoutingGetController({ getRoutingState }) {
  return (_req, res) => {
    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      routing: { ...getRoutingState() },
    });
  };
}

function createRoutingUpdateController({
  validRoutingBackends,
  validCanaryPercentages,
  getRoutingState,
  saveRoutingState,
}) {
  return (req, res) => {
    const body = req.body || {};
    const newBackend = String(body.activeBackend || "").toLowerCase();
    const newCanaryRaw = body.canaryPercent;
    const newNote = String(body.note || "").slice(0, 300);
    const routingState = getRoutingState();

    if (newBackend && !validRoutingBackends.includes(newBackend)) {
      res
        .status(400)
        .json({ error: "Invalid activeBackend. Allowed: node, django." });
      return;
    }

    if (
      newCanaryRaw !== undefined &&
      !validCanaryPercentages.includes(Number(newCanaryRaw))
    ) {
      res
        .status(400)
        .json({ error: "Invalid canaryPercent. Allowed: 0, 10, 50, 100." });
      return;
    }

    if (newBackend) {
      routingState.activeBackend = newBackend;
    }

    if (newCanaryRaw !== undefined) {
      routingState.canaryPercent = Number(newCanaryRaw);
    }

    if (newNote) {
      routingState.note = newNote;
    }

    routingState.updatedAt = new Date().toISOString();
    saveRoutingState();

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      routing: { ...routingState },
    });
  };
}

function createRoutingVerifyController({ getRoutingState, port }) {
  return async (_req, res) => {
    const checks = [];
    const routingState = getRoutingState();

    const nodeHealthUrl = `http://127.0.0.1:${port}/api/health`;
    const nodeStart = Date.now();
    try {
      const nodeResp = await fetch(nodeHealthUrl);
      const nodeData = await nodeResp.json().catch(() => ({}));
      const nodeOk =
        nodeResp.ok && (nodeData.ok === true || nodeData.status === "ok");
      checks.push({
        backend: "node",
        url: nodeHealthUrl,
        ok: nodeOk,
        statusCode: nodeResp.status,
        latencyMs: Date.now() - nodeStart,
      });
    } catch (err) {
      checks.push({
        backend: "node",
        url: nodeHealthUrl,
        ok: false,
        error: String(err?.message || "Unreachable"),
        latencyMs: Date.now() - nodeStart,
      });
    }

    const djangoHealthUrl = `${routingState.djangoUrl}/api/health`;
    const djangoStart = Date.now();
    try {
      const djangoResp = await fetch(djangoHealthUrl);
      const djangoData = await djangoResp.json().catch(() => ({}));
      const djangoOk =
        djangoResp.ok && (djangoData.ok === true || djangoData.status === "ok");
      checks.push({
        backend: "django",
        url: djangoHealthUrl,
        ok: djangoOk,
        statusCode: djangoResp.status,
        latencyMs: Date.now() - djangoStart,
      });
    } catch (err) {
      checks.push({
        backend: "django",
        url: djangoHealthUrl,
        ok: false,
        error: String(err?.message || "Unreachable"),
        latencyMs: Date.now() - djangoStart,
      });
    }

    const allOk = checks.every((item) => item.ok);
    res.json({
      ok: allOk,
      generatedAt: new Date().toISOString(),
      checks,
      routing: { ...routingState },
    });
  };
}

module.exports = {
  createRoutingGetController,
  createRoutingUpdateController,
  createRoutingVerifyController,
};
