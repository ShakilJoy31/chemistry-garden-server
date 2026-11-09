// routes/settings.routes.js (or wherever you put your routes)
const express = require("express");
const { 
  getAllPaymentMethods, 
  getPaymentMethodById, 
  upsertPaymentMethod, 
  updatePaymentMethodStatus, 
  deletePaymentMethod 
} = require("../controller/payment/paymentMethod.controller");

const { 
  getAllEmails, 
  getEmailById, 
  getEmailStats, 
  createEmail, 
  updateEmail, 
  deleteEmail 
} = require("../controller/settings/email.controller");
const { getAllFAQs, getFAQById, getFAQStats, getFAQsByCategory, getAllCategories, createFAQ, updateFAQ, updateFAQStatus, deleteFAQ, bulkDeleteFAQs, reorderFAQs } = require("../controller/settings/faq.controller");
const { getAllCoupons, getCouponById, getCouponByCode, createCoupon, updateCoupon, deleteCoupon, toggleCouponStatus } = require("../controller/settings/coupon.controller");



const router = express.Router();

//! Payment Method routes
// Public routes (for frontend)
router.get("/get-payment-methods", getAllPaymentMethods);
router.get("/get-payment-method/:id", getPaymentMethodById);

// Admin routes
router.post("/upsert-payment-method", upsertPaymentMethod);
router.patch("/update-payment-method-status/:id", updatePaymentMethodStatus);
router.delete("/delete-payment-method/:id", deletePaymentMethod);

//! Email routes
router.get("/get-emails", getAllEmails);
router.get("/get-email/:id", getEmailById);
router.get("/email-stats", getEmailStats);
router.post("/add-new-email", createEmail);
router.put("/update-email/:id", updateEmail);
router.delete("/delete-email/:id", deleteEmail);

//! FAQ routes

// Public routes (for frontend)
router.get("/get-faqs", getAllFAQs);
router.get("/get-faq/:id", getFAQById);
router.get("/faq-stats", getFAQStats);
router.get("/get-faqs-by-category/:category", getFAQsByCategory);
router.get("/get-all-categories", getAllCategories);

// Admin routes
router.post("/add-new-faq", createFAQ);
router.put("/update-faq/:id", updateFAQ);
router.patch("/update-faq-status/:id", updateFAQStatus);
router.delete("/delete-faq/:id", deleteFAQ);
router.delete("/bulk-delete-faqs", bulkDeleteFAQs);
router.put("/reorder-faqs", reorderFAQs);







//! ============= COUPON MANAGEMENT ROUTES =============

// Get all coupons with filters and pagination (admin)
router.get("/coupons", getAllCoupons);

// Get single coupon by ID (admin)
router.get("/coupons/:id", getCouponById);

// Get coupon by code (public)
router.get("/coupons/code/:code", getCouponByCode);

// Create new coupon (admin)
router.post("/coupons", createCoupon);

// Update coupon (admin)
router.put("/coupons/:id", updateCoupon);

// Delete coupon (admin)
router.delete("/coupons/:id", deleteCoupon);

// Toggle coupon status (admin)
router.patch("/coupons/:id/toggle", toggleCouponStatus);

module.exports = router;