// routes/course/mocktest.routes.js
const express = require("express");
const verifyJWT = require("../middleware/verifyJWT");
const { createMockTest, getAllMockTests, getAllPaidMockTests, getMockTestById, updateMockTest, deleteMockTest, getMockTestsByCourse, assignStudentsToMockTest, getAvailableStudentsForMockTest, getMockTestResults, startMockTest, submitMockTestAnswers, checkMockTestAttempt, getStudentMockTestAttempts } = require("../controller/course/mocktest.controller");
const verifyApprovedStudentJWT = require("../middleware/verifyApprovedStudentJWT");

const  router = express.Router();

// All routes require authentication

// Mock Test CRUD
router.post("/create", verifyJWT, createMockTest);
router.get("/all", getAllMockTests);
router.get("/all-mocktest-for-student", getAllPaidMockTests);
router.get("/get/:id", verifyJWT, getMockTestById);
router.put("/update/:id", verifyJWT, updateMockTest);
router.delete("/delete/:id", verifyJWT, deleteMockTest);

// Course specific
router.get("/course/:courseId", getMockTestsByCourse);

// Student assignment
router.post("/assign-students/:id", assignStudentsToMockTest);
router.get("/available-students/:id", getAvailableStudentsForMockTest);

// Results
router.get("/results/:mockTestId", getMockTestResults);

// ==================== STUDENT MOCK TEST PARTICIPATION ====================

router.get("/all-mocktests-for-student", verifyApprovedStudentJWT, getAllMockTests);
router.get("/get-mocktest-for-student/:id", verifyApprovedStudentJWT, getMockTestById);
router.post("/start/:mockTestId", verifyApprovedStudentJWT, startMockTest);
router.post("/submit/:mockTestId", verifyApprovedStudentJWT, submitMockTestAnswers);
router.get("/check-attempt/:mockTestId", verifyApprovedStudentJWT, checkMockTestAttempt);
router.get("/student-attempts", verifyApprovedStudentJWT, getStudentMockTestAttempts);

module.exports = router;