// controllers/students/registered-student.controller.js
const { Op } = require("sequelize");
const RegisteredStudent = require("../../models/students/registered-student.model");
const Student = require("../../models/students/student.model");
const { generateAccessToken, generateRefreshToken } = require("../../middleware/jwtHelper");

// Helper function to generate unique registration ID
const generateRegistrationId = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const prefix = `FIT-${year}${month}-`;

  const latestRegistration = await Student.findOne({
    where: {
      studentId: {                          // ✅ studentId, not registrationId
        [Op.like]: `${prefix}%`,
      },
    },
    order: [['studentId', 'DESC']],         // ✅ order by studentId
    attributes: ['studentId'],              // ✅ select studentId
  });

  let nextNumber = 1;

  if (latestRegistration && latestRegistration.studentId) {
    const lastNumber = parseInt(latestRegistration.studentId.split('-')[2], 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  if (nextNumber === 1) {
    const count = await Student.count({
      where: {
        studentId: {                        // ✅ studentId
          [Op.like]: `${prefix}%`,
        },
      },
    });
    nextNumber = count + 1;
  }

  const sequence = String(nextNumber).padStart(6, '0');
  return `${prefix}${sequence}`;
};

// Helper function to transform registered student response
const transformRegisteredStudentResponse = (registeredStudent) => {
  const data = registeredStudent.toJSON ? registeredStudent.toJSON() : registeredStudent;
  delete data.password;
  return data;
};



//! Register new student (Self-registration from frontend)
const registerStudent = async (req, res, next) => {
  try {
    const {
      fullName,
      nickName,
      email,
      password,
      phoneNo,
      photo,
      metadata = {},
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required!",
      });
    }

    // Check main students table for email (source of truth now)
    const emailExistsMain = await Student.findOne({ where: { email } });
    if (emailExistsMain) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered. Please login instead.",
      });
    }

    // Phone check (only when provided)
    if (phoneNo) {
      const phoneExistsMain = await Student.findOne({ where: { phoneNo } });
      if (phoneExistsMain) {
        return res.status(409).json({
          success: false,
          message:
            "This phone number is already registered. Please login instead.",
        });
      }
    }

    // Still guard against duplicate pending registrations
    const emailExistsRegistered = await RegisteredStudent.findOne({
      where: { email },
    });
    if (emailExistsRegistered) {
      return res.status(409).json({
        success: false,
        message:
          "A registration with this email is already in progress. Please wait or login.",
      });
    }

    const studentId = await generateRegistrationId();

    // Create the real student directly
    // 🔒 Use the `fields` whitelist so nothing unexpected (hooks, spread
    // from generateRegistrationId, etc.) leaks into the INSERT.
    const newStudent = await Student.create(
      {
        studentId,
        fullName,
        email,
        phoneNo: phoneNo || null,
        password, // hashed by the Student model's beforeCreate hook
        profileImage: photo || null,
        role: "student",
        status: "active",
      },
      {
        fields: [
          "studentId",
          "fullName",
          "email",
          "phoneNo",
          "password",
          "profileImage",
          "role",
          "status",
        ],
      }
    );

    // ✅ Token now carries the Student table PK
    const userForToken = {
      id: newStudent.id,
      studentId: newStudent.studentId,
      email: newStudent.email,
      phoneNo: newStudent.phoneNo,
      role: "student",
      status: newStudent.status,
      fullName: newStudent.fullName,
      isRegisteredStudent: false,
      idType: "student",
    };

    const accessToken = generateAccessToken(userForToken);
    const refreshToken = generateRefreshToken(userForToken);

    // ✅ Convert Sequelize instance to plain object BEFORE spreading.
    // Spreading the instance directly produces { dataValues, _previousDataValues, ... }
    // which is why the frontend couldn't read `data.id`.
    const studentData = newStudent.toJSON();
    delete studentData.password; // never expose the password

    return res.status(201).json({
      success: true,
      message: "Registration successful! Welcome aboard.",
      data: {
        ...studentData,
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (error) {
    console.error("Error registering student:", error);
    next(error);
  }
};



//! Student Login (for both pending and approved students)
const loginStudent = async (req, res, next) => {
  try {
    const { email, phoneNo, password } = req.body;

    // Check if either email or phone number is provided
    if ((!email && !phoneNo) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/Phone number and password are required!",
      });
    }

    // Build where clause
    const whereClause = {};
    if (email) {
      whereClause.email = email;
    } else if (phoneNo) {
      whereClause.phoneNo = phoneNo;
    }

    // First, check if student exists in main table (approved students)
    let student = await Student.findOne({
      where: whereClause,
    });

    if (student) {
      // Check if student is active
      if (student.status !== "active") {
        return res.status(403).json({
          success: false,
          message: `Your account is ${student.status}. Please contact support.`,
        });
      }

      if (student.password !== password) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials!",
        });
      }

      // Update last login time
      await Student.update(
        { lastLoginAt: new Date() },
        { where: { id: student.id } }
      );

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

      // Remove password from response
      const studentData = student.toJSON();
      delete studentData.password;

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

    // If not in main table, check registered students table
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
        message: "Invalid credentials!",
      });
    }

    // Based on status, return appropriate message
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
      });
    }

    if (registeredStudent.status === "approved") {
      // This shouldn't happen as approved students should be moved to main table
      // But just in case, we'll handle it
      return res.status(403).json({
        success: false,
        message: "Your registration is approved but not activated. Please contact support.",
        accountStatus: "approved",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Unable to login. Please contact support.",
    });
  } catch (error) {
    console.error("Error logging in student:", error);
    next(error);
  }
};

//! Get student profile (for both pending and approved)
const getStudentProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isRegisteredStudent = req.user.isRegisteredStudent;

    if (isRegisteredStudent) {
      // User is from registered students table
      const registeredStudent = await RegisteredStudent.findOne({
        where: { id: userId },
        attributes: { exclude: ["password"] },
      });

      if (!registeredStudent) {
        return res.status(404).json({
          success: false,
          message: "Student not found!",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Profile retrieved successfully!",
        data: {
          ...registeredStudent.toJSON(),
          isApproved: false,
        },
      });
    } else {
      // User is from main students table
      const student = await Student.findOne({
        where: { id: userId },
        attributes: { exclude: ["password"] },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found!",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Profile retrieved successfully!",
        data: {
          ...student.toJSON(),
          isApproved: true,
        },
      });
    }
  } catch (error) {
    console.error("Error getting student profile:", error);
    next(error);
  }
};

//! Get registered student by ID for themselves (student verification)
const getRegisteredStudentByIdForHimself = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verify the student is requesting their own data
    if (req.user && req.user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: "You can only access your own profile!",
      });
    }

    const registeredStudent = await RegisteredStudent.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    if (!registeredStudent) {
      return res.status(404).json({
        success: false,
        message: "Registered student not found!",
      });
    }

    const studentData = transformRegisteredStudentResponse(registeredStudent);

    return res.status(200).json({
      success: true,
      message: "Registered student retrieved successfully!",
      data: studentData,
    });
  } catch (error) {
    console.error("Error getting registered student by ID:", error);
    next(error);
  }
};

//! Check registration status
const checkRegistrationStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const registeredStudent = await RegisteredStudent.findOne({
      where: { id: userId },
      attributes: ["id", "status", "rejectionReason", "registeredAt", "fullName", "email", "phoneNo", "registrationId", "photo"],
    });

    if (!registeredStudent) {
      return res.status(404).json({
        success: false,
        message: "Registration not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Registration status retrieved successfully!",
      data: {
        status: registeredStudent.status,
        rejectionReason: registeredStudent.rejectionReason,
        registeredAt: registeredStudent.registeredAt,
        studentInfo: {
          id: registeredStudent.id,
          fullName: registeredStudent.fullName,
          email: registeredStudent.email,
          phoneNo: registeredStudent.phoneNo,
          registrationId: registeredStudent.registrationId,
          photo: registeredStudent.photo,
        },
      },
    });
  } catch (error) {
    console.error("Error checking registration status:", error);
    next(error);
  }
};







//! Approve registered student and move to main students table
const approveRegisteredStudent = async (req, res, next) => {

  try {
    const { id } = req.params;

    const registeredStudent = await RegisteredStudent.findOne({
      where: { id },
    });

    if (!registeredStudent) {
      return res.status(404).json({
        success: false,
        message: "Registered student not found!",
      });
    }

    if (registeredStudent.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This registration is already ${registeredStudent.status}. Cannot approve again.`,
      });
    }

    // ✅ FIX: Only include phoneNo in the OR when it is actually present.
    // A null phoneNo would turn into `phoneNo IS NULL`, matching every
    // student with no phone number and producing a false 409.
    const orConditions = [{ email: registeredStudent.email }];
    if (registeredStudent.phoneNo) {
      orConditions.push({ phoneNo: registeredStudent.phoneNo });
    }

    const existingStudent = await Student.findOne({
      where: { [Op.or]: orConditions },
    });

    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message:
          "A student with this email or phone number already exists in the main database.",
      });
    }

    // ✅ FIX: safe ID generator with a loop instead of a single bump
    const generateNextStudentId = async () => {
      const year = new Date().getFullYear();

      const lastStudent = await Student.findOne({
        where: { studentId: { [Op.like]: `FIT-${year}-%` } },
        order: [["studentId", "DESC"]],
        attributes: ["studentId"],
      });

      let nextNumber = 1;

      if (lastStudent && lastStudent.studentId) {
        const parts = lastStudent.studentId.split("-");
        if (parts.length === 3) {
          const lastNumber = parseInt(parts[2], 10);
          if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
        }
      } else {
        const totalStudents = await Student.count();
        if (totalStudents > 0) {
          const anyLastStudent = await Student.findOne({
            order: [["studentId", "DESC"]],
            attributes: ["studentId"],
          });
          if (anyLastStudent && anyLastStudent.studentId) {
            const parts = anyLastStudent.studentId.split("-");
            if (parts.length === 3) {
              const lastNumber = parseInt(parts[2], 10);
              if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
            }
          }
        }
      }

      while (true) {
        const candidate = `FIT-${year}-${String(nextNumber).padStart(5, "0")}`;
        const exists = await Student.findOne({ where: { studentId: candidate } });
        if (!exists) return candidate;
        nextNumber++;
      }
    };

    const studentId = await generateNextStudentId();
    console.log("Generated student ID:", studentId);

    const newStudent = await Student.create({
      studentId,
      fullName: registeredStudent.fullName,
      nickName: registeredStudent.nickName || null,
      email: registeredStudent.email,
      phoneNo: registeredStudent.phoneNo || null,
      password: registeredStudent.password,
      profileImage: registeredStudent.photo || null,
      status: "active",
      role: "student",
      enrollmentDate: new Date(),
      registeredBy: req.user?.id || null,
      presentAddress: "Pending completion - Student needs to update profile",
      district: "Pending completion - Student needs to update profile",
      gender: "male",
    });

    await RegisteredStudent.update(
      {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: req.user?.id || null,
      },
      { where: { id: registeredStudent.id } }
    );

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

    const studentData = newStudent.toJSON();
    delete studentData.password;

    return res.status(200).json({
      success: true,
      message: "Student registration approved successfully!",
      data: {
        approvedStudent: {
          ...studentData,
          tokens: { accessToken, refreshToken },
        },
        registrationInfo: {
          registrationId: registeredStudent.registrationId,
          approvedAt: new Date(),
          previousStatus: "pending",
        },
      },
    });
  } catch (error) {
    console.error("Error approving registered student:", error);

    if (
      error.name === "SequelizeUniqueConstraintError" ||
      error.original?.code === "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "A duplicate record already exists (email, phone, NID, or student ID). Please try again.",
        error: error.message,
      });
    }

    next(error);
  }
};



//! Reject registered student
const rejectRegisteredStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    const registeredStudent = await RegisteredStudent.findOne({ 
      where: { id } 
    });
    
    if (!registeredStudent) {
      return res.status(404).json({
        success: false,
        message: "Registered student not found!",
      });
    }

    if (registeredStudent.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot reject registration with status: ${registeredStudent.status}`,
      });
    }

    await RegisteredStudent.update({
      status: "rejected",
      rejectionReason: rejectionReason || "No reason provided",
    }, {
      where: { id: registeredStudent.id }
    });

    const updatedStudent = await RegisteredStudent.findOne({ 
      where: { id } 
    });

    return res.status(200).json({
      success: true,
      message: "Student registration rejected successfully!",
      data: transformRegisteredStudentResponse(updatedStudent),
    });
  } catch (error) {
    console.error("Error rejecting registered student:", error);
    next(error);
  }
};





//! Get all registered students (with pagination and filters) - For Admin
const getAllRegisteredStudents = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      startDate = "",
      endDate = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { registrationId: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phoneNo: { [Op.like]: `%${search}%` } },
        { nickName: { [Op.like]: `%${search}%` } },
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    if (startDate) {
      whereClause.registeredAt = { [Op.gte]: new Date(startDate) };
    }
    if (endDate) {
      whereClause.registeredAt = { 
        ...whereClause.registeredAt,
        [Op.lte]: new Date(endDate) 
      };
    }

    const { count, rows: registeredStudents } = await RegisteredStudent.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["registeredAt", "DESC"]],
      attributes: { exclude: ["password"] },
    });

    const transformedStudents = registeredStudents.map(student => 
      transformRegisteredStudentResponse(student)
    );

    const totalPages = Math.ceil(count / limitNumber);

    const stats = {
      total: count,
      pending: await RegisteredStudent.count({ where: { status: "pending" } }),
      approved: await RegisteredStudent.count({ where: { status: "approved" } }),
      rejected: await RegisteredStudent.count({ where: { status: "rejected" } }),
    };

    return res.status(200).json({
      success: true,
      message: "Registered students retrieved successfully!",
      data: transformedStudents,
      stats,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting registered students:", error);
    next(error);
  }
};




















//! Get single registered student by ID (For Admin)
const getRegisteredStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const registeredStudent = await RegisteredStudent.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    if (!registeredStudent) {
      return res.status(404).json({
        success: false,
        message: "Registered student not found!",
      });
    }

    const studentData = transformRegisteredStudentResponse(registeredStudent);

    return res.status(200).json({
      success: true,
      message: "Registered student retrieved successfully!",
      data: studentData,
    });
  } catch (error) {
    console.error("Error getting registered student by ID:", error);
    next(error);
  }
};













//! Get single registered student by ID (For Admin)
const getApprovedStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const registeredStudent = await Student.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    if (!registeredStudent) {
      return res.status(404).json({
        success: false,
        message: "Registered student not found!",
      });
    }

    const studentData = transformRegisteredStudentResponse(registeredStudent);

    return res.status(200).json({
      success: true,
      message: "Registered student retrieved successfully!",
      data: studentData,
    });
  } catch (error) {
    console.error("Error getting registered student by ID:", error);
    next(error);
  }
};





//! Update registered student (Self-update for students)
const updateRegisteredStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      nickName,
      phoneNo,
      photo,
      metadata,
      currentPassword,
      password,
    } = req.body;

    if (req.user && req.user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile!",
      });
    }

    const registeredStudent = await RegisteredStudent.findOne({
      where: { id },
    });

    if (!registeredStudent) {
      return res.status(404).json({
        success: false,
        message: "Registered student not found!",
      });
    }

    if (registeredStudent.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot update registration with status: ${registeredStudent.status}. Only pending registrations can be updated.`,
      });
    }

    const updateData = {};

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to change your password.",
        });
      }
      if (currentPassword !== registeredStudent.password) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }
      updateData.password = password;
    }

    if (fullName) updateData.fullName = fullName;
    if (nickName !== undefined) updateData.nickName = nickName || null;

    if (phoneNo !== undefined) {
      // ✅ Only run the duplicate lookups when a real phone value exists.
      if (phoneNo) {
        const phoneExists = await RegisteredStudent.findOne({
          where: {
            phoneNo: phoneNo,
            id: { [Op.ne]: id },
          },
        });
        if (phoneExists) {
          return res.status(409).json({
            success: false,
            message:
              "This phone number is already registered by another student.",
          });
        }

        const phoneExistsMain = await Student.findOne({
          where: { phoneNo: phoneNo },
        });
        if (phoneExistsMain) {
          return res.status(409).json({
            success: false,
            message:
              "This phone number is already registered as an active student.",
          });
        }

        updateData.phoneNo = phoneNo;
      } else {
        // Explicitly clearing the phone is fine — just don't query for null
        updateData.phoneNo = null;
      }
    }

    if (photo !== undefined) updateData.photo = photo || null;

    if (metadata) {
      const currentMetadata = registeredStudent.metadata || {};
      updateData.metadata = {
        ...currentMetadata,
        ...metadata,
        updatedAt: new Date().toISOString(),
      };
    }

    await RegisteredStudent.update(updateData, { where: { id } });

    const updatedStudent = await RegisteredStudent.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      success: true,
      message: "Registration updated successfully!",
      data: transformRegisteredStudentResponse(updatedStudent),
    });
  } catch (error) {
    console.error("Error updating registered student:", error);

    if (
      error.name === "SequelizeUniqueConstraintError" ||
      error.original?.code === "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        success: false,
        message: "Duplicate entry found. Please check your information.",
        error: error.message,
      });
    }

    next(error);
  }
};








//! Delete registered student (Admin action)
const deleteRegisteredStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const registeredStudent = await RegisteredStudent.findOne({ 
      where: { id } 
    });

    if (!registeredStudent) {
      return res.status(404).json({
        success: false,
        message: "Registered student not found!",
      });
    }

    await RegisteredStudent.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Registered student deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting registered student:", error);
    next(error);
  }
};

//! Get registration statistics (For Admin)
const getRegistrationStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const stats = {
      total: await RegisteredStudent.count(),
      pending: await RegisteredStudent.count({ where: { status: "pending" } }),
      approved: await RegisteredStudent.count({ where: { status: "approved" } }),
      rejected: await RegisteredStudent.count({ where: { status: "rejected" } }),
      today: await RegisteredStudent.count({ 
        where: { 
          registeredAt: { [Op.gte]: today }
        } 
      }),
      thisWeek: await RegisteredStudent.count({ 
        where: { 
          registeredAt: { [Op.gte]: weekAgo }
        } 
      }),
      thisMonth: await RegisteredStudent.count({ 
        where: { 
          registeredAt: { [Op.gte]: monthAgo }
        } 
      }),
      approvalRate: {
        percentage: "0",
        approved: 0,
        total: 0,
      },
    };

    if (stats.total > 0) {
      stats.approvalRate = {
        approved: stats.approved,
        total: stats.total,
        percentage: ((stats.approved / stats.total) * 100).toFixed(2),
      };
    }

    return res.status(200).json({
      success: true,
      message: "Registration statistics retrieved successfully!",
      data: stats,
    });
  } catch (error) {
    console.error("Error getting registration stats:", error);
    next(error);
  }
};

module.exports = {
  registerStudent,
  loginStudent,
  getStudentProfile,
  checkRegistrationStatus,
  approveRegisteredStudent,
  rejectRegisteredStudent,
  getAllRegisteredStudents,
  getRegisteredStudentById,
  getRegisteredStudentByIdForHimself,
  deleteRegisteredStudent,
  getRegistrationStats,
  getApprovedStudentById,
  updateRegisteredStudent
};

