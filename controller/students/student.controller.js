// controller/auth/student.controller.js
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const { generateAccessToken, generateRefreshToken } = require("../../middleware/jwtHelper");
const Student = require("../../models/students/student.model");
const RegisteredStudent = require("../../models/students/registered-student.model");

// Helper function to generate student ID
const generateStudentId = async () => {
  const year = new Date().getFullYear();
  const count = await Student.count();
  const sequence = String(count + 1).padStart(5, '0');
  return `FIT-${year}-${sequence}`;
};

// Helper function to transform student response
const transformStudentResponse = (student) => {
  const studentData = student.toJSON ? student.toJSON() : student;
  
  // Remove sensitive data
  delete studentData.password;
  
  // Add full name with title
  studentData.displayName = studentData.fullName;
  
  // Format dates
  if (studentData.dateOfBirth) {
    studentData.dateOfBirthFormatted = new Date(studentData.dateOfBirth).toLocaleDateString('en-BD');
  }
  
  if (studentData.enrollmentDate) {
    studentData.enrollmentDateFormatted = new Date(studentData.enrollmentDate).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  // Calculate due amount
  studentData.dueAmount = parseFloat(studentData.totalFee) - parseFloat(studentData.paidAmount);
  
  // Calculate attendance percentage
  if (studentData.totalClasses > 0) {
    studentData.attendancePercentage = ((studentData.attendedClasses / studentData.totalClasses) * 100).toFixed(2);
  }
  
  return studentData;
};

//! Create new student
const createStudent = async (req, res, next) => {
  try {
    const {
      // Personal Information
      fullName,
      fatherName,
      motherName,
      dateOfBirth,
      gender,
      
      // Contact Information
      phoneNo,
      alternativePhoneNo,
      email,
      
      // NID Information
      nidNo,
      nidFrontImage,
      nidBackImage,
      
      // Profile Image
      profileImage,
      
      // Address Information
      presentAddress,
      permanentAddress,
      district,
      upazila,
      postOffice,
      postalCode,
      
      // Educational Information
      educationLevel,
      institutionName,
      passingYear,
      
      // Professional Information
      occupation,
      companyName,
      designation,
      
      // Course Related Information
      enrolledCourseId,
      enrollmentDate,
      totalFee,
      paidAmount,
      
      // System Fields
      status = "active",
      notes,
      
      // Password (default to phone number if not provided)
      password,
    } = req.body;

    // Validate required fields
    if (!fullName || !phoneNo || !email || !presentAddress) {
      return res.status(400).json({
        success: false,
        message: "Full name, phone number, email, present and address are required!",
      });
    }

    // Check if email already exists
    const emailExists = await Student.findOne({ where: { email } });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered!",
      });
    }

    // Check if phone already exists
    const phoneExists = await Student.findOne({ where: { phoneNo } });
    if (phoneExists) {
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered!",
      });
    }

    // Check if NID already exists (if provided)
    if (nidNo) {
      const nidExists = await Student.findOne({ where: { nidNo } });
      if (nidExists) {
        return res.status(409).json({
          success: false,
          message: "This NID number is already registered!",
        });
      }
    }

    // Calculate due amount
    const dueAmount = (parseFloat(totalFee) || 0) - (parseFloat(paidAmount) || 0);
    const paymentStatus = "pending";

    // Generate student ID
    const studentId = await generateStudentId();

    // Create new student
    const newStudent = await Student.create({
      studentId, // Generated student ID
      fullName,
      fatherName: fatherName || null,
      motherName: motherName || null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || "male",
      
      phoneNo,
      alternativePhoneNo: alternativePhoneNo || null,
      email,
      
      nidNo: nidNo || null,
      nidFrontImage: nidFrontImage || null,
      nidBackImage: nidBackImage || null,
      
      profileImage: profileImage || null,
      
      presentAddress,
      permanentAddress: permanentAddress || presentAddress,
      district,
      upazila: upazila || null,
      postOffice: postOffice || null,
      postalCode: postalCode || null,
      
      educationLevel: educationLevel || null,
      institutionName: institutionName || null,
      passingYear: passingYear ? parseInt(passingYear) : null,
      
      occupation: occupation || null,
      companyName: companyName || null,
      designation: designation || null,
      
      enrolledCourseId: enrolledCourseId || null,
      enrollmentDate: enrollmentDate || new Date(),
      totalFee: totalFee || 0,
      paidAmount: paidAmount || 0,
      dueAmount: dueAmount,
      paymentStatus: paymentStatus,
      lastPaymentDate: paidAmount > 0 ? new Date() : null,
      
      status: status,
      notes: notes || null,
      password: password || phoneNo, // Default password to phone number
      registeredBy: req.user?.id || null,
    });

    // Transform response
    const studentData = transformStudentResponse(newStudent);

    // Generate tokens for student
    const userForToken = {
      id: newStudent.id,
      email: newStudent.email,
      phoneNo: newStudent.phoneNo,
      role: newStudent.role,
      status: newStudent.status,
      fullName: newStudent.fullName,
      studentId: newStudent.studentId,
    };
    
    const accessToken = generateAccessToken(userForToken);
    const refreshToken = generateRefreshToken(userForToken);

    return res.status(201).json({
      success: true,
      message: "Student registered successfully!",
      data: {
        ...studentData,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    console.error("Error creating student:", error);
    next(error);
  }
};

//! Get all students with pagination and filtering
const getAllStudents = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      district = "",
      courseId = "",
      paymentStatus = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { studentId: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phoneNo: { [Op.like]: `%${search}%` } },
        { nidNo: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    // Add district filter
    if (district) {
      whereClause.district = { [Op.like]: `%${district}%` };
    }

    // Add course filter
    if (courseId) {
      whereClause.enrolledCourseId = parseInt(courseId);
    }

    // Add payment status filter
    if (paymentStatus) {
      whereClause.paymentStatus = paymentStatus;
    }

    const { count, rows: students } = await Student.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
      attributes: { exclude: ["password"] },
    });

    // Transform each student and parse enrolledCourses
    const transformedStudents = students.map(student => {
      const transformed = transformStudentResponse(student);
      
      // Parse enrolledCourses if it's a string
      if (transformed.enrolledCourses && typeof transformed.enrolledCourses === 'string') {
        try {
          // Clean up the string by removing extra quotes and escaping
          let cleanedString = transformed.enrolledCourses;
          
          // Remove surrounding quotes if present
          if (cleanedString.startsWith('"') && cleanedString.endsWith('"')) {
            cleanedString = cleanedString.slice(1, -1);
          }
          
          // Unescape double quotes
          cleanedString = cleanedString.replace(/\\"/g, '"');
          // Unescape backslashes
          cleanedString = cleanedString.replace(/\\\\/g, '\\');
          
          // Parse the JSON string
          const parsedCourses = JSON.parse(cleanedString);
          transformed.enrolledCourses = Array.isArray(parsedCourses) ? parsedCourses : [];
        } catch (error) {
          console.error(`Error parsing enrolledCourses for student ${transformed.id}:`, error);
          transformed.enrolledCourses = [];
        }
      } else if (!transformed.enrolledCourses) {
        transformed.enrolledCourses = [];
      }
      
      // Also parse enrollmentDate if needed
      if (transformed.enrollmentDate && typeof transformed.enrollmentDate === 'string') {
        try {
          // Check if enrollmentDate is a JSON string
          if (transformed.enrollmentDate.startsWith('"')) {
            const parsedDate = JSON.parse(transformed.enrollmentDate);
            transformed.enrollmentDate = parsedDate;
          }
        } catch (error) {
          // Keep original value if parsing fails
          console.error(`Error parsing enrollmentDate for student ${transformed.id}:`, error);
        }
      }
      
      return transformed;
    });

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Students retrieved successfully!",
      data: transformedStudents,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting students:", error);
    next(error);
  }
};

//! Get student by ID
const getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const student = await Student.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    const studentData = transformStudentResponse(student);

    return res.status(200).json({
      success: true,
      message: "Student retrieved successfully!",
      data: studentData,
    });
  } catch (error) {
    console.error("Error getting student by ID:", error);
    next(error);
  }
};

//! Get student by Student ID
const getStudentByStudentId = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findOne({
      where: { studentId },
      attributes: { exclude: ["password"] },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found with this ID!",
      });
    }

    const studentData = transformStudentResponse(student);

    return res.status(200).json({
      success: true,
      message: "Student retrieved successfully!",
      data: studentData,
    });
  } catch (error) {
    console.error("Error getting student by student ID:", error);
    next(error);
  }
};





//! Update student
const updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
 
    // Check if student exists
    const existingStudent = await Student.findOne({ where: { id } });
    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }
 
    // --- Password change: verify current password before allowing it ---
    if (updateData.password) {
      if (!updateData.currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to change your password.",
        });
      }
 
      const isCurrentPasswordCorrect = updateData.currentPassword === existingStudent.password;
 
      if (!isCurrentPasswordCorrect) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }
 
      // Hash the new password before it gets saved below
      updateData.password = updateData.password;
    }
 
    // currentPassword is only used for verification above — never persist it
    delete updateData.currentPassword;
    // -------------------------------------------------------------------
 
    // Check if new email already exists (if changed)
    if (updateData.email && updateData.email !== existingStudent.email) {
      const emailExists = await Student.findOne({ 
        where: { email: updateData.email } 
      });
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "This email is already registered!",
        });
      }
    }
 
    // Check if new phone already exists (if changed)
    if (updateData.phoneNo && updateData.phoneNo !== existingStudent.phoneNo) {
      const phoneExists = await Student.findOne({ 
        where: { phoneNo: updateData.phoneNo } 
      });
      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "This phone number is already registered!",
        });
      }
    }
 
    // Check if new NID already exists (if changed and provided)
    if (updateData.nidNo && updateData.nidNo !== existingStudent.nidNo) {
      const nidExists = await Student.findOne({ 
        where: { nidNo: updateData.nidNo } 
      });
      if (nidExists) {
        return res.status(409).json({
          success: false,
          message: "This NID number is already registered!",
        });
      }
    }
 
    // Calculate payment details if fee or paid amount changed
    if (updateData.totalFee !== undefined || updateData.paidAmount !== undefined) {
      const totalFee = updateData.totalFee !== undefined ? parseFloat(updateData.totalFee) : parseFloat(existingStudent.totalFee);
      const paidAmount = updateData.paidAmount !== undefined ? parseFloat(updateData.paidAmount) : parseFloat(existingStudent.paidAmount);
      const dueAmount = totalFee - paidAmount;
      
      updateData.dueAmount = dueAmount;
      updateData.paymentStatus = dueAmount <= 0 ? "paid" : (paidAmount > 0 ? "partial" : "pending");
      
      if (paidAmount > parseFloat(existingStudent.paidAmount)) {
        updateData.lastPaymentDate = new Date();
      }
    }
 
    // Parse numeric fields
    if (updateData.passingYear) {
      updateData.passingYear = parseInt(updateData.passingYear);
    }
 
    // Perform update
    await Student.update(updateData, {
      where: { id },
    });
 
    // Fetch updated student
    const updatedStudent = await Student.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });
 
    const studentData = transformStudentResponse(updatedStudent);
 
    return res.status(200).json({
      success: true,
      message: "Student updated successfully!",
      data: studentData,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    next(error);
  }
};






//! Delete student
const deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingStudent = await Student.findOne({ where: { id } });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    await Student.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    next(error);
  }
};

//! Update student status
const updateStudentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const student = await Student.findOne({ where: { id } });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    await Student.update({ status }, { where: { id } });

    const updatedStudent = await Student.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    const studentData = transformStudentResponse(updatedStudent);

    return res.status(200).json({
      success: true,
      message: `Student ${status} successfully!`,
      data: studentData,
    });
  } catch (error) {
    console.error("Error updating student status:", error);
    next(error);
  }
};











//! Student login (checks both Student and RegisteredStudent tables)
const studentLogin = async (req, res, next) => {
  try {
    const { email, phoneNo, password } = req.body;

    // Check if email/phone and password are provided
    if ((!email && !phoneNo) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/Phone number and password are required.",
      });
    }

    // Build where clause for search
    const whereClause = {};
    if (email) {
      whereClause.email = email;
    } else if (phoneNo) {
      whereClause.phoneNo = phoneNo;
    }

    // FIRST: Check in main Student table (approved/active students)
    let student = await Student.findOne({
      where: whereClause,
    });

    // If found in Student table, process login
    if (student) {
      // Check password
      if (student.password !== password) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials.",
        });
      }

      // Check status
      if (student.status !== "active") {
        let statusMessage = "";
        if (student.status === "inactive") {
          statusMessage = "Your account is inactive. Please contact support.";
        } else if (student.status === "suspended") {
          statusMessage = "Your account has been suspended. Please contact support.";
        } else if (student.status === "completed") {
          statusMessage = "You have completed your course. Thank you!";
        }
        
        return res.status(403).json({
          success: false,
          message: statusMessage,
          accountInfo: {
            id: student.id,
            studentId: student.studentId,
            fullName: student.fullName,
            status: student.status,
          },
        });
      }

      // Update last login time
      await Student.update(
        { lastLoginAt: new Date() },
        { where: { id: student.id } }
      );

      const studentData = transformStudentResponse(student);

      // Generate tokens
      const userForToken = {
        id: student.id,
        email: student.email,
        phoneNo: student.phoneNo,
        role: student.role,
        status: student.status,
        fullName: student.fullName,
        studentId: student.studentId,
        isRegisteredStudent: false,
      };
      
      const accessToken = generateAccessToken(userForToken);
      const refreshToken = generateRefreshToken(userForToken);

      return res.status(200).json({
        success: true,
        message: "Login successful!",
        data: {
          ...studentData,
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      });
    }


    const registeredStudent = await RegisteredStudent.findOne({
      where: whereClause,
    });

    if (!registeredStudent) {
      return res.status(404).json({
        success: false,
        message: "No account found with these credentials.",
      });
    }

    // Check password
    if (registeredStudent.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // Handle different statuses for registered students
    if (registeredStudent.status === "pending") {
      // Generate token for pending user to check status later
      const userForToken = {
        id: registeredStudent.id,
        email: registeredStudent.email,
        phoneNo: registeredStudent.phoneNo,
        role: "student",
        status: registeredStudent.status,
        fullName: registeredStudent.fullName,
        registrationId: registeredStudent.registrationId,
        isRegisteredStudent: true,
      };
      
      const accessToken = generateAccessToken(userForToken);
      const refreshToken = generateRefreshToken(userForToken);

      return res.status(403).json({
        success: false,
        message: "Your registration is pending approval. Please wait for admin approval.",
        accountStatus: "pending",
        data: {
          id: registeredStudent.id,
          fullName: registeredStudent.fullName,
          email: registeredStudent.email,
          phoneNo: registeredStudent.phoneNo,
          registrationId: registeredStudent.registrationId,
          status: registeredStudent.status,
          registeredAt: registeredStudent.registeredAt,
          photo: registeredStudent.photo,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      });
    }

    if (registeredStudent.status === "rejected") {
      return res.status(403).json({
        success: false,
        message: `Your registration was rejected. Reason: ${registeredStudent.rejectionReason || "No reason provided"}. Please contact support.`,
        accountStatus: "rejected",
        accountInfo: {
          id: registeredStudent.id,
          registrationId: registeredStudent.registrationId,
          fullName: registeredStudent.fullName,
          status: registeredStudent.status,
        },
      });
    }

    if (registeredStudent.status === "approved") {
      // This shouldn't happen as approved students should be moved to main table
      // But just in case, we'll handle it
      return res.status(403).json({
        success: false,
        message: "Your registration is approved but not activated. Please contact support.",
        accountStatus: "approved",
        accountInfo: {
          id: registeredStudent.id,
          registrationId: registeredStudent.registrationId,
          fullName: registeredStudent.fullName,
          status: registeredStudent.status,
        },
      });
    }

    return res.status(401).json({
      success: false,
      message: "Unable to login. Please contact support.",
    });

  } catch (error) {
    console.error("Error during student login:", error);
    next(error);
  }
};












//! Change student password
const changeStudentPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation password do not match",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    const student = await Student.findOne({ where: { id } });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (student.password !== currentPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    await Student.update({ password: newPassword }, { where: { id } });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: {
        id: student.id,
        studentId: student.studentId,
        fullName: student.fullName,
        email: student.email,
      },
    });
  } catch (error) {
    console.error("Error changing password:", error);
    next(error);
  }
};

//! Update attendance
const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { attended } = req.body;

    const student = await Student.findOne({ where: { id } });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    const newTotalClasses = student.totalClasses + 1;
    const newAttendedClasses = attended ? student.attendedClasses + 1 : student.attendedClasses;
    const newAttendancePercentage = (newAttendedClasses / newTotalClasses) * 100;

    await Student.update({
      totalClasses: newTotalClasses,
      attendedClasses: newAttendedClasses,
      attendancePercentage: newAttendancePercentage.toFixed(2),
    }, { where: { id } });

    const updatedStudent = await Student.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully!",
      data: transformStudentResponse(updatedStudent),
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    next(error);
  }
};

//! Issue certificate to student
const issueCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { certificateNumber } = req.body;

    const student = await Student.findOne({ where: { id } });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    const certificateNum = certificateNumber || `CERT-${student.studentId}-${Date.now()}`;

    await Student.update({
      certificateIssued: true,
      certificateNumber: certificateNum,
      certificateIssuedDate: new Date(),
      courseCompletionDate: new Date(),
    }, { where: { id } });

    const updatedStudent = await Student.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      success: true,
      message: "Certificate issued successfully!",
      data: transformStudentResponse(updatedStudent),
    });
  } catch (error) {
    console.error("Error issuing certificate:", error);
    next(error);
  }
};

//! Get student statistics
const getStudentStats = async (req, res, next) => {
  try {
    const totalStudents = await Student.count();
    const activeStudents = await Student.count({ where: { status: "active" } });
    const inactiveStudents = await Student.count({ where: { status: "inactive" } });
    const completedStudents = await Student.count({ where: { status: "completed" } });
    const certificateIssuedCount = await Student.count({ where: { certificateIssued: true } });
    
    const paidStudents = await Student.count({ where: { paymentStatus: "paid" } });
    const partialPaidStudents = await Student.count({ where: { paymentStatus: "partial" } });
    const pendingPaymentStudents = await Student.count({ where: { paymentStatus: "pending" } });
    
    const totalRevenueResult = await Student.sum("paidAmount");
    const totalRevenue = totalRevenueResult || 0;
    
    const totalDueResult = await Student.sum("dueAmount");
    const totalDue = totalDueResult || 0;
    
    const byDistrict = await Student.findAll({
      attributes: [
        "district",
        [sequelize.fn("COUNT", sequelize.col("district")), "count"],
      ],
      group: ["district"],
    });
    
    const byGender = await Student.findAll({
      attributes: [
        "gender",
        [sequelize.fn("COUNT", sequelize.col("gender")), "count"],
      ],
      group: ["gender"],
    });

    return res.status(200).json({
      success: true,
      message: "Student statistics retrieved successfully!",
      data: {
        total: totalStudents,
        active: activeStudents,
        inactive: inactiveStudents,
        completed: completedStudents,
        certificateIssued: certificateIssuedCount,
        paymentStats: {
          paid: paidStudents,
          partial: partialPaidStudents,
          pending: pendingPaymentStudents,
        },
        financialStats: {
          totalRevenue: totalRevenue,
          totalDue: totalDue,
        },
        byDistrict,
        byGender,
      },
    });
  } catch (error) {
    console.error("Error getting student stats:", error);
    next(error);
  }
};


//! Assign or Unassign course to/from student (with multiple course support)
const assignCourseToStudent = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { studentId } = req.params;
    const { courseId, action = 'assign' } = req.body; // action: 'assign' or 'unassign'
    
    console.log('========================================');
    console.log('Action:', action, { studentId, courseId });
    
    // Check if student exists
    const student = await Student.findOne({ 
      where: { id: studentId },
      transaction 
    });
    
    if (!student) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }
    
    // Check if student is active (only for assignment)
    if (action === 'assign' && student.status !== "active") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot assign course to student with status: ${student.status}. Student must be active.`,
      });
    }
    
    // Check if course exists and is active (only for assignment)
    const Course = require("../../models/Course/course.model");
    const course = await Course.findOne({ 
      where: { id: courseId, status: "active" },
      transaction 
    });
    
    if (!course) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Course not found or not active!",
      });
    }
    
    // IMPORTANT: Get the raw value directly from database to avoid any getter interference
    const rawStudent = await Student.findOne({
      where: { id: studentId },
      attributes: ['enrolledCourses', 'enrolledCourseId'],
      raw: true,
      transaction
    });
    
    let enrolledCourses = [];
    
    // Parse existing enrolledCourses correctly
    if (rawStudent && rawStudent.enrolledCourses) {
      let rawValue = rawStudent.enrolledCourses;
      console.log('Raw enrolledCourses from DB:', rawValue);
      console.log('Type of raw enrolledCourses:', typeof rawValue);
      
      // Handle different possible formats
      if (Array.isArray(rawValue)) {
        enrolledCourses = rawValue;
      } else if (typeof rawValue === 'string') {
        try {
          // Handle double or triple encoded JSON
          let parsed = rawValue;
          while (typeof parsed === 'string' && (parsed.startsWith('"') || parsed.startsWith('['))) {
            try {
              parsed = JSON.parse(parsed);
            } catch (e) {
              break;
            }
          }
          enrolledCourses = Array.isArray(parsed) ? parsed : [];
          console.log('Parsed enrolledCourses:', enrolledCourses);
        } catch (e) {
          console.error('Error parsing enrolledCourses:', e);
          enrolledCourses = [];
        }
      }
    }
    
    // Ensure it's an array
    if (!Array.isArray(enrolledCourses)) {
      enrolledCourses = [];
    }
    
    console.log('Current enrolled courses count:', enrolledCourses.length);
    console.log('Existing course IDs:', enrolledCourses.map(c => c.courseId));
    
    let resultMessage = '';
    let updatedEnrolledCourses = [];
    
    if (action === 'assign') {
      // ==================== ASSIGN LOGIC ====================
      
      // Check if student is already enrolled in this course
      const alreadyEnrolled = enrolledCourses.some(
        (enrollment) => enrollment.courseId === courseId && enrollment.status !== "dropped"
      );
      
      if (alreadyEnrolled) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Student is already enrolled in this course!",
        });
      }
      
      // Create new enrollment record
      const newEnrollment = {
        id: Date.now(),
        courseId: courseId,
        courseName: course.courseName,
        courseCode: course.courseId,
        enrollmentDate: new Date(),
        status: "enrolled",
        progress: 0,
      };
      
      // Add new course to existing enrolled courses
      enrolledCourses.push(newEnrollment);
      
      resultMessage = `Course "${course.courseName}" assigned to ${student.fullName} successfully!`;
      updatedEnrolledCourses = enrolledCourses;
      
    } else if (action === 'unassign') {
      // ==================== UNASSIGN LOGIC ====================
      
      // Find and remove the course from enrolledCourses
      const courseIndex = enrolledCourses.findIndex(
        (enrollment) => enrollment.courseId === parseInt(courseId)
      );
      
      if (courseIndex === -1) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Student is not enrolled in this course!",
        });
      }
      
      // Remove the course from the array
      const removedCourse = enrolledCourses.splice(courseIndex, 1)[0];
      console.log('Removed course:', removedCourse);
      console.log('Remaining courses:', enrolledCourses);
      
      resultMessage = `Course "${removedCourse.courseName || 'Course'}" unassigned from ${student.fullName} successfully!`;
      updatedEnrolledCourses = enrolledCourses;
      
    } else {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid action! Use 'assign' or 'unassign'.",
      });
    }
    
    // Determine new enrolledCourseId
    let newEnrolledCourseId = null;
    if (updatedEnrolledCourses.length > 0) {
      newEnrolledCourseId = updatedEnrolledCourses[0].courseId;
    }
    
    // Update student record
    const coursesToStore = JSON.stringify(updatedEnrolledCourses);
    console.log('Storing as:', coursesToStore);
    
    await student.update({
      enrolledCourses: coursesToStore,
      enrolledCourseId: newEnrolledCourseId,
      enrollmentDate: updatedEnrolledCourses.length > 0 ? student.enrollmentDate : null,
      status: updatedEnrolledCourses.length > 0 ? "active" : "active", // Keep active even if no courses
    }, { transaction });
    
    await transaction.commit();
    
    // Fetch updated student to verify
    const updatedStudent = await Student.findOne({
      where: { id: studentId },
      attributes: { exclude: ["password"] },
    });
    
    console.log('Final verification - enrolledCourses type:', typeof updatedStudent.enrolledCourses);
    console.log('Final verification - enrolledCourses value:', updatedStudent.enrolledCourses);
    console.log('========================================');
    
    return res.status(200).json({
      success: true,
      message: resultMessage,
      data: {
        student: updatedStudent,
        action: action,
        totalCourses: updatedEnrolledCourses.length,
      },
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error("Error processing course action:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process course action",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};



module.exports = {
  createStudent,
  getAllStudents,
  getStudentById,
  getStudentByStudentId,
  updateStudent,
  deleteStudent,
  updateStudentStatus,
  studentLogin,
  changeStudentPassword,
  updateAttendance,
  issueCertificate,
  getStudentStats,
  assignCourseToStudent
};

