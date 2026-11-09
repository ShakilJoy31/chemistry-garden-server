// controllers/auth/otp.controller.js
const { Op } = require("sequelize");
const RegisteredStudent = require("../../models/students/registered-student.model");
const Student = require("../../models/students/student.model");
const OTP = require("../../models/Settings/otp.model");
const { sendEmail } = require("./enhancedEmail.service");
const { generateOTP, createOTPEmailTemplate, createPasswordResetEmailTemplate } = require("./emailTemplate.service");
const Email = require("../../models/Settings/email.model");

//! Send OTP for registration
const sendRegistrationOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required!",
      });
    }

    // Check if email already exists in registered students
    const emailExistsRegistered = await RegisteredStudent.findOne({
      where: { email }
    });

    if (emailExistsRegistered) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered. Please wait for approval or login.",
      });
    }

    // Check if email already exists in main students table
    const emailExistsMain = await Student.findOne({
      where: { email }
    });

    if (emailExistsMain) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered as an active student. Please login.",
      });
    }

    // Delete any existing OTPs for this email
    await OTP.destroy({
      where: {
        email,
        isUsed: false,
        expiresAt: {
          [Op.gt]: new Date()
        }
      }
    });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP to database
    await OTP.create({
      email,
      otp,
      expiresAt,
      isUsed: false,
      attemptCount: 0,
    });

    // Get app name from active email config
    let appName = "FIT INFOTECH";
    try {
      const Email = require("../../models/email/email.model");
      const activeEmail = await Email.findOne({
        where: { isActive: true },
        attributes: ["appName"],
      });
      if (activeEmail && activeEmail.appName) {
        appName = activeEmail.appName;
      }
    } catch (error) {
      console.log("Using default app name:", appName);
    }

    // Create email template
    const emailTemplate = createOTPEmailTemplate(otp, appName);

    // Send email
    const emailResult = await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    if (!emailResult.success) {
      console.error("Email sending failed:", emailResult.error);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email!",
      data: {
        email: email,
        expiresIn: "5 minutes",
      },
    });

  } catch (error) {
    console.error("Error sending OTP:", error);
    next(error);
  }
};

//! Verify OTP
const verifyRegistrationOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required!",
      });
    }

    // Find OTP in database
    const otpRecord = await OTP.findOne({
      where: {
        email,
        otp,
        isUsed: false,
        expiresAt: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!otpRecord) {
      // Check if OTP exists but expired
      const expiredOTP = await OTP.findOne({
        where: {
          email,
          otp,
          isUsed: false,
          expiresAt: {
            [Op.lte]: new Date()
          }
        }
      });

      if (expiredOTP) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new one.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    // Check attempt count
    if (otpRecord.attemptCount >= 5) {
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    // Mark OTP as used
    await OTP.update({
      isUsed: true,
    }, {
      where: { id: otpRecord.id }
    });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully!",
      data: {
        email: email,
        verified: true,
      },
    });

  } catch (error) {
    console.error("Error verifying OTP:", error);
    next(error);
  }
};











//! Send OTP for password reset
const sendPasswordResetOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required!",
      });
    }

    // Check if email exists in RegisteredStudent table
    const registeredStudent = await RegisteredStudent.findOne({
      where: { email }
    });

    // Check if email exists in Student table
    const student = await Student.findOne({
      where: { email }
    });

    if (!registeredStudent && !student) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address.",
      });
    }

    // Delete any existing OTPs for this email (for password reset)
    await OTP.destroy({
      where: {
        email,
        isUsed: false,
        type: 'password_reset',
        expiresAt: {
          [Op.gt]: new Date()
        }
      }
    });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await OTP.create({
      email,
      otp,
      expiresAt,
      isUsed: false,
      type: 'password_reset', // Add type to distinguish from registration OTP
      attemptCount: 0,
    });

    let appName = "FIT INFOTECH";
    try {
      const activeEmail = await Email.findOne({
        where: { isActive: true },
        attributes: ["appName"],
      });
      if (activeEmail && activeEmail.appName) {
        appName = activeEmail.appName;
      }
    } catch (error) {
      console.log("Using default app name:", appName);
    }

    // Create password reset email template
    const emailTemplate = createPasswordResetEmailTemplate(otp, appName);

    const emailResult = await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    if (!emailResult.success) {
      console.error("Email sending failed:", emailResult.error);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent successfully to your email!",
      data: {
        email: email,
        expiresIn: "5 minutes",
      },
    });

  } catch (error) {
    console.error("Error sending password reset OTP:", error);
    next(error);
  }
};

//! Verify password reset OTP
const verifyPasswordResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required!",
      });
    }

    const otpRecord = await OTP.findOne({
      where: {
        email,
        otp,
        isUsed: false,
        type: 'password_reset',
        expiresAt: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!otpRecord) {
      const expiredOTP = await OTP.findOne({
        where: {
          email,
          otp,
          isUsed: false,
          type: 'password_reset',
          expiresAt: {
            [Op.lte]: new Date()
          }
        }
      });

      if (expiredOTP) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new one.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    if (otpRecord.attemptCount >= 5) {
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    // Mark OTP as used
    await OTP.update({
      isUsed: true,
    }, {
      where: { id: otpRecord.id }
    });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully!",
      data: {
        email: email,
        verified: true,
      },
    });

  } catch (error) {
    console.error("Error verifying password reset OTP:", error);
    next(error);
  }
};

//! Reset password after OTP verification
const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, new password, and confirm password are required!",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match!",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long!",
      });
    }

    // Check if user exists in RegisteredStudent table
    let userFound = false;
    const registeredStudent = await RegisteredStudent.findOne({
      where: { email }
    });

    if (registeredStudent) {
      await RegisteredStudent.update({
        password: newPassword,
      }, {
        where: { id: registeredStudent.id }
      });
      userFound = true;
    }

    // Check if user exists in Student table
    const student = await Student.findOne({
      where: { email }
    });

    if (student) {
      await Student.update({
        password: newPassword,
      }, {
        where: { id: student.id }
      });
      userFound = true;
    }

    if (!userFound) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address.",
      });
    }

    // Delete all used OTPs for this email
    await OTP.destroy({
      where: {
        email,
        type: 'password_reset'
      }
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully! You can now login with your new password.",
    });

  } catch (error) {
    console.error("Error resetting password:", error);
    next(error);
  }
};

// Export all functions
module.exports = {
  sendRegistrationOTP,
  verifyRegistrationOTP,
  sendPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPassword,
};
