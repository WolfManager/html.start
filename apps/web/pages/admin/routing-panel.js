(function initMagnetoAdminRoutingPanel(global) {
  function renderRoutingState({
    routing,
    statusGrid,
    updatedAtElement,
    createStatusItem,
  }) {
    if (!statusGrid || typeof createStatusItem !== "function") {
      return;
    }

    statusGrid.innerHTML = "";

    const backendLabel =
      routing.activeBackend === "django" ? "Django" : "Node.js";
    const canaryLabel =
      routing.canaryPercent != null ? `${routing.canaryPercent}%` : "-";

    const items = [
      ["Active Backend", backendLabel],
      ["Canary %", canaryLabel],
      ["Django URL", routing.djangoUrl || "-"],
      ["Note", routing.note || "-"],
      [
        "Last Changed",
        routing.updatedAt ? new Date(routing.updatedAt).toLocaleString() : "-",
      ],
    ];

    items.forEach(([label, value]) => {
      statusGrid.appendChild(createStatusItem(label, String(value)));
    });

    if (updatedAtElement) {
      updatedAtElement.textContent = routing.updatedAt
        ? `State as of: ${new Date(routing.updatedAt).toLocaleString()}`
        : "";
    }
  }

  function renderRoutingVerify({ result, verifyResultElement, documentRef }) {
    if (!verifyResultElement || !documentRef) {
      return;
    }

    verifyResultElement.hidden = false;
    verifyResultElement.innerHTML = "";

    const header = documentRef.createElement("p");
    header.className = result.ok
      ? "admin-routing-verify-ok"
      : "admin-routing-verify-fail";
    header.textContent = result.ok
      ? "Dry-test PASSED - both backends reachable."
      : "Dry-test PARTIAL - one or more backends unreachable.";
    verifyResultElement.appendChild(header);

    const list = documentRef.createElement("ul");
    list.className = "admin-list";
    (result.checks || []).forEach((check) => {
      const li = documentRef.createElement("li");
      const status = check.ok ? "OK" : "FAIL";
      const latency = check.latencyMs != null ? ` ${check.latencyMs}ms` : "";
      const errPart = check.error ? ` - ${check.error}` : "";
      li.textContent = `[${status}] ${check.backend.toUpperCase()} ${check.url}${latency}${errPart}`;
      li.className = check.ok
        ? "admin-routing-check-ok"
        : "admin-routing-check-fail";
      list.appendChild(li);
    });
    verifyResultElement.appendChild(list);
  }

  global.MagnetoAdminRoutingPanel = {
    renderRoutingState,
    renderRoutingVerify,
  };
})(window);
