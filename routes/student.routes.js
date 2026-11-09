// routes/authentication/studentRoutes.js
const express = require("express");
const { createStudent, studentLogin, getStudentByStudentId, updateStudent, deleteStudent, updateStudentStatus, changeStudentPassword, updateAttendance, issueCertificate, assignCourseToStudent, getAllStudents } = require("../controller/students/student.controller");
const verifyJWT = require("../middleware/verifyJWT");
const { registerStudent, getAllRegisteredStudents, getRegistrationStats, getRegisteredStudentById, approveRegisteredStudent, rejectRegisteredStudent, deleteRegisteredStudent, getApprovedStudentById, updateRegisteredStudent } = require("../controller/students/registered-student.controller");
const { getAllCourses, getCourseStats, getCourseById, createCourse, updateCourse, deleteCourse } = require("../controller/course/course.controller");
const verifyStudentJWT = require("../middleware/verifyStudentJWT");
const verifyApprovedStudentJWT = require("../middleware/verifyApprovedStudentJWT");
const router = express.Router();

//! Public routes (no authentication required)
router.post("/register-student", createStudent);
router.post("/login-student", studentLogin);
router.get("/get-student-by-student-id/:studentId", getStudentByStudentId);

//! Protected routes (authentication required)
router.get("/get-students", verifyJWT, getAllStudents);

router.get("/get-student/:id", verifyJWT, getRegisteredStudentById);
router.get("/get-student-himself/:id", verifyApprovedStudentJWT, getRegisteredStudentById);
router.get("/get-approved-student-himself/:id", verifyApprovedStudentJWT, getApprovedStudentById);
router.put("/update-student/:id", verifyJWT, updateStudent);
router.put("/update-student-himself/:id", verifyApprovedStudentJWT, updateStudent);
router.delete("/delete-student/:id", verifyJWT, deleteStudent);
router.put("/update-student-status/:id", verifyJWT, updateStudentStatus);
router.put("/change-student-password/:id", verifyJWT, changeStudentPassword);
router.put("/update-attendance/:id", verifyJWT, updateAttendance);
router.put("/issue-certificate/:id", verifyJWT, issueCertificate);
router.get("/get-student-stats", verifyJWT, getRegistrationStats);
router.post("/:studentId/assign-course", assignCourseToStudent);
router.post("/student-login", studentLogin);














//! Getting registered student who submit their information by themself. 

// Public routes (no authentication required)
router.post("/register", registerStudent);

// Protected routes (admin/enterprise only)
router.get("/get-all", verifyJWT, getAllRegisteredStudents);
router.get("/get-stats", verifyJWT, getRegistrationStats);
router.get("/get/:id", verifyJWT,  getRegisteredStudentById);
router.get("/get-himself/:id", verifyStudentJWT,  getRegisteredStudentById);
router.put("/approve/:id",  approveRegisteredStudent);
router.put("/reject/:id", verifyJWT,  rejectRegisteredStudent);
router.delete("/delete/:id", verifyJWT,  deleteRegisteredStudent);
router.put("/update/:id",  updateRegisteredStudent);









//! Course enrollment routes for superadmin. (Super admin will add course by these api endpoint. )


// Protected routes (require authentication)
router.get("/all", getAllCourses);
router.get("/stats", verifyJWT, getCourseStats);
router.get("/get-course/:id", getCourseById);
router.get("/get-course-by-student/:id", verifyApprovedStudentJWT, getCourseById);
router.post("/create", verifyJWT, createCourse);
router.put("/update-course/:id", verifyJWT, updateCourse);
router.delete("/delete-course/:id", verifyJWT, deleteCourse);

module.exports = router;