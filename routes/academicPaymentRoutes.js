// routes/payment/monthlyPayment.routes.js
const express = require("express");
const { getMonthlyPaymentGrid, getStudentPaymentHistory, getStudentYearlySummary, saveMonthlyPayments, updateMonthlyPayment } = require("../controller/students/monthlyPayment.controller");


const router = express.Router();

// grid for one month (class/batch/search filters)
router.get("/get-monthly-payment-grid", getMonthlyPaymentGrid);

// one student's history (default: currentYear-5 → currentYear+5)
router.get("/get-student-payment-history/:studentId", getStudentPaymentHistory);

// yearly totals for a student
router.get("/get-student-yearly-summary/:studentId", getStudentYearlySummary);

// bulk save (admin)
router.post("/save-monthly-payments", saveMonthlyPayments);

// single row fix
router.put("/update-monthly-payment/:id", updateMonthlyPayment);

module.exports = router;