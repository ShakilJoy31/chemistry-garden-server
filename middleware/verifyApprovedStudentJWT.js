const jwt = require("jsonwebtoken");
const Student = require("../models/students/student.model");

const verifyApprovedStudentJWT = (req, res, next) => {
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
      const user = await Student.findOne({ 
        where: { id: decoded.id },
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        return res.status(404).json({ success: false, message: "Student not found!" });
      }

      // ─── NEW: Check if the device is still the active one ───
      if (decoded.deviceId && user.activeDeviceId !== decoded.deviceId) {
        return res.status(401).json({ 
          success: false, 
          message: "This session is no longer valid on this device. Please login again." 
        });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ success: false, message: "Account is not active." });
      }

      req.user = {
        id: user.id,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        status: user.status,
        fullName: user.fullName,
        studentId: user.studentId,
        deviceId: user.activeDeviceId, // Pass this along
      };
      
      next();
    } catch (error) {
      console.error("JWT verification error:", error);
      return res.status(500).json({ success: false, message: "Server error during authentication." });
    }
  });
};

module.exports = verifyApprovedStudentJWT;