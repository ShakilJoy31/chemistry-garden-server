// routes/payment/payment.routes.js
const express = require("express");
const verifyApprovedStudentJWT = require("../middleware/verifyApprovedStudentJWT");
const { submitPayment, getStudentPayments, getAllPayments, getPaymentStats, verifyPayment, deletePayment, getPaymentById } = require("../controller/payment/studentPayment.controller");
const verifyJWT = require("../middleware/verifyJWT");
const { submitStorePayment, getStudentStorePayments, getStorePaymentById, checkStudentItemPayment, getPaymentsByItem, getAllStorePayments, getStorePaymentStats, verifyStorePayment, deleteStorePayment, getStudentNotifications, markStudentNotificationAsRead, getStudentNotificationCount, getAdminNotifications, markAdminNotificationAsRead, markAllAdminNotificationsAsRead, getAdminNotificationCount } = require("../controller/payment/storePayment.controller");


const router = express.Router();

// Public routes (Student)
router.post("/submit-payment", verifyApprovedStudentJWT, submitPayment);
router.get("/student-payments/:studentId", verifyApprovedStudentJWT, getStudentPayments);

// Protected routes (Student with auth)
router.get("/my-payments/:studentId", verifyApprovedStudentJWT, getStudentPayments);
router.get("/get-payment/:id", verifyApprovedStudentJWT, getPaymentById);

// Admin only routes
router.get("/admin/all-payments", verifyJWT, getAllPayments);
router.get("/admin/payment-stats", verifyJWT, getPaymentStats);
router.patch("/admin/verify-payment/:id", verifyJWT, verifyPayment);
router.delete("/admin/delete-payment/:id", verifyJWT, deletePayment);

































// Student routes (authenticated)
router.post("/submit-store-payment", verifyApprovedStudentJWT, submitStorePayment);
router.get("/student-store-payments/:studentId", verifyApprovedStudentJWT, getStudentStorePayments);
router.get("/get-store-payment/:id", verifyApprovedStudentJWT, getStorePaymentById);
router.get("/check-item-payment/:studentId/:itemType/:itemId", verifyApprovedStudentJWT, checkStudentItemPayment);

// Student Notification Routes
router.get("/student-notifications/:studentId", verifyApprovedStudentJWT, getStudentNotifications);
router.patch("/mark-student-notification/:id", verifyApprovedStudentJWT, markStudentNotificationAsRead);
router.get("/student-notification-count/:studentId", verifyApprovedStudentJWT, getStudentNotificationCount);

// Get payments by item type and item ID
router.get("/payments-by-item/:itemType/:itemId", verifyJWT, getPaymentsByItem);

// Admin Notification Routes
router.get("/admin/notifications", verifyJWT, getAdminNotifications);
router.patch("/admin/mark-notification/:id", verifyJWT, markAdminNotificationAsRead);
router.patch("/admin/mark-all-notifications", verifyJWT, markAllAdminNotificationsAsRead);
router.get("/admin/notification-count", verifyJWT, getAdminNotificationCount);

// Admin only routes
router.get("/admin/all-store-payments", verifyJWT, getAllStorePayments);
router.get("/admin/store-payment-stats", verifyJWT, getStorePaymentStats);
router.patch("/admin/verify-store-payment/:id", verifyJWT, verifyStorePayment);
router.delete("/admin/delete-store-payment/:id", verifyJWT, deleteStorePayment);



module.exports = router;