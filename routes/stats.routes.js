// routes/stats/stats.routes.js
const express = require("express");
const { getPublicStats, getAdminStats, getStatsSummary } = require("../controller/stats.controller");

const router = express.Router();

/* ============================================================
   PUBLIC — safe, trimmed stats for the marketing site
============================================================ */
router.get("/public", getPublicStats);

/* ============================================================
   ADMIN — everything (auth protected)
============================================================ */
router.get("/admin", getAdminStats);

/* ============================================================
   ADMIN — lightweight header summary (auth protected)
============================================================ */
router.get("/admin/summary", getStatsSummary);

module.exports = router;