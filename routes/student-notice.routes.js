// routes/notice/student-notice.routes.js
const express = require("express");
const verifyJWT = require("../middleware/verifyJWT");
const { createNotice, getAllNotices, getNoticeStats, getNoticeById, updateNotice, deleteNotice, getStudentNotices, markNoticeSeen, markSingleNoticeSeen, sendLoginCredentials } = require("../controller/students/student-notice.controller");
const verifyApprovedStudentJWT = require("../middleware/verifyApprovedStudentJWT");
const ensureOwnStudent = require("../middleware/ensureOwnStudent");


const router = express.Router();

// ── Admin ──
router.post("/create", verifyJWT, createNotice);
router.get("/get-all", verifyJWT, getAllNotices);
router.get("/stats", verifyJWT, getNoticeStats);
router.get("/get/:id", verifyJWT, getNoticeById);
router.put("/update/:id", verifyJWT, updateNotice);
router.delete("/delete/:id", verifyJWT, deleteNotice);
router.post("/send-login-credentials", verifyJWT, sendLoginCredentials);

// ── Student ──
// A student can read their feed + mark as seen.
// Using verifyApprovedStudentJWT keeps parity with the course route.
router.get(
  "/student-feed/:studentId",
  verifyApprovedStudentJWT,
  ensureOwnStudent,
  getStudentNotices
);
router.put(
  "/mark-seen/:studentId",
  verifyApprovedStudentJWT,
  ensureOwnStudent,
  markNoticeSeen
);
router.put(
  "/mark-single-seen/:id/:studentId",
  verifyApprovedStudentJWT,
  ensureOwnStudent,
  markSingleNoticeSeen
);

module.exports = router;