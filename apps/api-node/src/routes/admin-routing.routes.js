const express = require("express");

function createAdminRoutingRoutes({
  adminAuth,
  routingGetController,
  routingUpdateController,
  routingVerifyController,
}) {
  const router = express.Router();
  router.get("/api/admin/routing", adminAuth, routingGetController);
  router.post("/api/admin/routing", adminAuth, routingUpdateController);
  router.post("/api/admin/routing/verify", adminAuth, routingVerifyController);
  return router;
}

module.exports = {
  createAdminRoutingRoutes,
};
