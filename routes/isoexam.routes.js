// routes/course/isoexam.routes.js
const express = require("express");
const { 
  createIsoExam, 
  getAllIsoExams, 
  getIsoExamById, 
  getIsoExamsByCourse, 
  updateIsoExam, 
  deleteIsoExam, 
  assignStudentsToIsoExam, 
  getAvailableStudentsForIsoExam, 
  getIsoExamResults,
  submitIsoExamAnswers,
  getStudentIsoExamAttempts,
  checkIsoExamAttempt,
  startIsoExam,
  getAllPaidIsoExams,
  updateIsoExamResult
} = require("../controller/course/isoexam.controller");
const verifyJWT = require("../middleware/verifyJWT");
const verifyApprovedStudentJWT = require("../middleware/verifyApprovedStudentJWT");

const router = express.Router();

// All routes require authentication

// ISO Exam CRUD
router.post("/create", verifyJWT, createIsoExam);
router.get("/all", getAllIsoExams);
router.get("/all-isoexam-for-student", getAllPaidIsoExams);
router.get("/get/:id", verifyJWT, getIsoExamById);
router.put("/update/:id", verifyJWT, updateIsoExam);
router.delete("/delete/:id", verifyJWT, deleteIsoExam);

// Course specific
router.get("/course/:courseId", getIsoExamsByCourse);

// Student assignment
router.post("/assign-students/:id", assignStudentsToIsoExam);
router.get("/available-students/:id", getAvailableStudentsForIsoExam);

// Results
router.get("/results/:isoExamId", getIsoExamResults);
router.post("/update-result", verifyJWT, updateIsoExamResult);


//! ==================== STUDENT ISO EXAM PARTICIPATION ====================

router.get("/all-isoexams-for-student", verifyApprovedStudentJWT, getAllIsoExams);
router.get("/get-isoexam-for-student/:id", verifyApprovedStudentJWT, getIsoExamById);
router.post("/start/:isoExamId", verifyApprovedStudentJWT, startIsoExam);
router.post("/submit/:isoExamId", verifyApprovedStudentJWT, submitIsoExamAnswers);
router.get("/check-attempt/:isoExamId", verifyApprovedStudentJWT, checkIsoExamAttempt);
router.get("/student-attempts", verifyApprovedStudentJWT, getStudentIsoExamAttempts);

module.exports = router;