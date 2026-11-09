// routes/auth/otp.routes.js
const express = require("express");
const { sendRegistrationOTP, verifyRegistrationOTP, sendPasswordResetOTP, verifyPasswordResetOTP, resetPassword } = require("../controller/settings/otp.controller");
const router = express.Router();


// Send OTP for registration
router.post("/send-otp", sendRegistrationOTP);

// Verify OTP
router.post("/verify-otp", verifyRegistrationOTP);


// Password reset OTP routes
router.post("/send-password-reset-otp", sendPasswordResetOTP);
router.post("/verify-password-reset-otp", verifyPasswordResetOTP);
router.post("/reset-password", resetPassword);

module.exports = router;