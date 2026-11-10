const express = require("express");
const router = express.Router();

const verifyJWT = require("../middleware/verifyJWT");
const verifyApprovedStudentJWT = require("../middleware/verifyApprovedStudentJWT");

const {
  // admin
  createExam,
  adminGetExams,
  adminGetExamById,
  updateExam,
  deleteExam,
  toggleSubmission,
  adminGetAttempts,
  // student
  studentGetExamsByCourse,
  studentGetExamById,
  studentStartExam,
  studentSubmitExam,
  studentGetMyAttempts,
  studentGetExamResult,
} = require("../controller/course/moduleExam.controller");

/* ---------------- ADMIN ---------------- */
router.post("/admin/create", verifyJWT, createExam);
router.get("/admin/all", verifyJWT, adminGetExams);
router.get("/admin/:id", verifyJWT, adminGetExamById);
router.put("/admin/:id", verifyJWT, updateExam);
router.patch("/admin/:id/toggle-submission", verifyJWT, toggleSubmission);
router.delete("/admin/:id", verifyJWT, deleteExam);
router.get("/admin/:id/attempts", verifyJWT, adminGetAttempts);

/* ---------------- STUDENT ----------------
   Order matters! `/student/:id/result` MUST come before `/student/:id`,
   otherwise Express treats "result" as the `:id` value.
   ------------------------------------------ */
router.get("/student/by-course/:courseId", verifyApprovedStudentJWT, studentGetExamsByCourse);
router.get("/student/my-attempts", verifyApprovedStudentJWT, studentGetMyAttempts);
router.get("/student/:id/result", verifyApprovedStudentJWT, studentGetExamResult);
router.get("/student/:id", verifyApprovedStudentJWT, studentGetExamById);
router.post("/student/:id/start", verifyApprovedStudentJWT, studentStartExam);
router.post("/student/:id/submit", verifyApprovedStudentJWT, studentSubmitExam);

module.exports = router;