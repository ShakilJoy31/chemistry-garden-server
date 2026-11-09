const express = require("express");
const { 
  createExam, 
  getAllExams, 
  getExamById, 
  getExamsByCourse, 
  updateExam, 
  deleteExam, 
  assignStudentsToExam, 
  getAvailableStudentsForExam, 
  getExamResults,
  submitExamAnswers,
  getStudentExamAttempts,
  checkExamAttempt,
  startExam,
  getAllPaidExams
} = require("../controller/course/exam.controller");
const verifyJWT = require("../middleware/verifyJWT");
const verifyApprovedStudentJWT = require("../middleware/verifyApprovedStudentJWT");

const router = express.Router();

// All routes require authentication

// Exam CRUD
router.post("/create", verifyJWT, createExam);
router.get("/all", getAllExams);
router.get("/all-exam-for-student", getAllPaidExams);
router.get("/get/:id",verifyJWT, getExamById);
router.put("/update/:id",verifyJWT, updateExam);
router.delete("/delete/:id", verifyJWT, deleteExam);

// Course specific
router.get("/course/:courseId", getExamsByCourse);

// Student assignment
router.post("/assign-students/:id", assignStudentsToExam);
router.get("/available-students/:id", getAvailableStudentsForExam);

// Results
router.get("/results/:examId", getExamResults);





//! ==================== NEW ROUTES FOR STUDENT EXAM PARTICIPATION ====================

// Start an exam (create result record with in-progress status)
router.get("/all-exams-for-student",verifyApprovedStudentJWT, getAllExams);

router.get("/get-exam-for-student/:id",verifyApprovedStudentJWT, getExamById);

router.post("/start/:examId", verifyApprovedStudentJWT, startExam);

// Submit exam answers
router.post("/submit/:examId", verifyApprovedStudentJWT, submitExamAnswers);

// Check if student has already attempted an exam
router.get("/check-attempt/:examId", verifyApprovedStudentJWT, checkExamAttempt);

// Get all exam attempts for the logged-in student
router.get("/student-attempts", verifyApprovedStudentJWT, getStudentExamAttempts);

module.exports = router;