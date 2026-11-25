const jwt = require("jsonwebtoken");
const Student = require("../models/students/student.model");
const BrotherEnterprise = require("../models/Authentication/brotherEnterprise.model");

const verifyAdminOrApprovedStudent = (req, res, next) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }

  const access_token = authHeader.split(" ")[1];

  jwt.verify(access_token, process.env.JWT_ACCESS_TOKEN, async (error, decoded) => {
    if (error) {
      return res.status(401).json({ success: false, message: "Session Expired! Please login again." });
    }
    if (!decoded?.id) {
      return res.status(401).json({ success: false, message: "Invalid token!" });
    }

    try {
      // 1) Try admin/staff first
      const admin = await BrotherEnterprise.findOne({
        where: { id: decoded.id },
        attributes: { exclude: ["password"] },
      });

      if (admin) {
        if (admin.status !== "active") {
          return res.status(403).json({ success: false, message: "Account is not active." });
        }
        req.user = {
          id: admin.id,
          email: admin.email,
          role: admin.role,
          status: admin.status,
          fullName: admin.fullName,
          type: "admin",
        };
        return next();
      }

      // 2) Otherwise try approved student
      const student = await Student.findOne({
        where: { id: decoded.id },
        attributes: { exclude: ["password"] },
      });

      if (!student) {
        return res.status(404).json({ success: false, message: "User not found!" });
      }

      // Same device check you already had
      if (decoded.deviceId && student.activeDeviceId !== decoded.deviceId) {
        return res.status(401).json({
          success: false,
          message: "This session is no longer valid on this device. Please login again.",
        });
      }

      if (student.status !== "active") {
        return res.status(403).json({ success: false, message: "Account is not active." });
      }

      // If "approved" means a specific flag/status, enforce it here, e.g.:
      // if (student.approvalStatus !== 'approved') { ... }

      req.user = {
        id: student.id,
        email: student.email,
        phoneNo: student.phoneNo,
        role: student.role,
        status: student.status,
        fullName: student.fullName,
        studentId: student.studentId,
        deviceId: student.activeDeviceId,
        type: "student",
      };
      return next();
    } catch (err) {
      console.error("Auth error:", err);
      return res.status(500).json({ success: false, message: "Server error during authentication." });
    }
  });
};

module.exports = verifyAdminOrApprovedStudent;