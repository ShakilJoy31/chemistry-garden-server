const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Student = require("../../models/students/student.model");
const StorePayment = require("../../models/Payment/storePayment.model");
const Course = require("../../models/Course/course.model");
const Exam = require("../../models/Course/exam.model");
const StoreItem = require("../../models/Settings/store.model");

//! Submit store payment
const submitStorePayment = async (req, res, next) => {
  try {
    const {
      studentId,
      studentName,
      transactionId,
      paymentNumber,
      amount,
      originalAmount,
      discountAmount,
      couponCode,
      paymentMethod,
      itemType,
      itemId,
      itemName,
      itemCode,
      courseId,
      examId,
      storeItemId,
      mockTestId,
      isoExamId,
      paymentPurpose,
      remarks,
    } = req.body;

    // ============================================================
    // 1. BASIC VALIDATION
    // ============================================================
    if (
      !studentId ||
      !transactionId ||
      !paymentNumber ||
      !amount ||
      !paymentMethod
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Student ID, Transaction ID, Payment Number, Amount, and Payment Method are required!",
      });
    }

    if (isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid payment amount!",
      });
    }

    const validMethods = ["bkash", "nagad", "rocket", "upay"];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment method! Must be one of: bkash, nagad, rocket, upay",
      });
    }

    const validItemTypes = [
      "course",
      "exam",
      "store_item",
      "mock_test",
      "iso_exam",
      "other",
    ];
    if (itemType && !validItemTypes.includes(itemType)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid item type! Must be one of: course, exam, store_item, mock_test, iso_exam, other",
      });
    }

    // ============================================================
    // 2. TRANSACTION ID VALIDATION
    //    Real bKash/Nagad/Rocket trx IDs are alphanumeric, ~8-20 chars.
    //    This rejects junk like "a", "!!!", or whitespace-only.
    // ============================================================
    const trimmedTrxId = String(transactionId).trim();

    if (trimmedTrxId.length < 6 || trimmedTrxId.length > 40) {
      return res.status(400).json({
        success: false,
        message:
          "Transaction ID must be between 6 and 40 characters long. Please enter the exact TrxID from your payment SMS.",
      });
    }

    if (!/^[A-Za-z0-9\-_]+$/.test(trimmedTrxId)) {
      return res.status(400).json({
        success: false,
        message:
          "Transaction ID can only contain letters, numbers, hyphens, and underscores.",
      });
    }

    // ============================================================
    // 3. PAYMENT NUMBER VALIDATION
    //    Bangladesh mobile numbers: 11 digits starting with 01[3-9].
    //    This blocks junk like "dfsgdg" and "fghdfgh".
    // ============================================================
    const trimmedPhone = String(paymentNumber).trim();

    if (!/^01[3-9]\d{8}$/.test(trimmedPhone)) {
      return res.status(400).json({
        success: false,
        message:
          "Payment number must be a valid 11-digit Bangladeshi mobile number (e.g. 01XXXXXXXXX). Please enter the exact number you paid from.",
      });
    }

    // ============================================================
    // 4. STUDENT EXISTS
    // ============================================================
    const student = await Student.findOne({
      where: {
        [Op.or]: [{ studentId: studentId }, { id: studentId }],
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found! Please check your student ID.",
      });
    }

    // ============================================================
    // 5. TRANSACTION ID UNIQUENESS (global)
    // ============================================================
    const existingPayment = await StorePayment.findOne({
      where: { transactionId: trimmedTrxId },
    });

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message:
          "Transaction ID already exists! Please check your transaction ID.",
      });
    }

    // ============================================================
    // 6. REFERENCED ITEM EXISTS
    // ============================================================
    if (courseId) {
      const course = await Course.findOne({ where: { id: courseId } });
      if (!course) {
        return res.status(404).json({
          success: false,
          message: `Course with ID ${courseId} not found!`,
        });
      }
    }

    if (examId) {
      const exam = await Exam.findOne({ where: { id: examId } });
      if (!exam) {
        return res.status(404).json({
          success: false,
          message: `Exam with ID ${examId} not found!`,
        });
      }
    }

    if (storeItemId) {
      const storeItem = await StoreItem.findOne({
        where: { id: storeItemId },
      });
      if (!storeItem) {
        return res.status(404).json({
          success: false,
          message: `Store item with ID ${storeItemId} not found!`,
        });
      }
    }

    // ============================================================
    // 7. DUPLICATE ITEM CHECK  🚨 THE CRITICAL FIX
    //
    //    Blocks: same student + same item + existing payment in
    //            a "counts as already paid/pending" status.
    //
    //    NOTE: Adjust the status array to match your actual enum.
    //    If you use 'verified' instead of 'approved', add it here.
    // ============================================================
    const resolvedItemType = itemType || "other";
    const BLOCKING_STATUSES = ["pending", "approved", "completed"];

    // Match by the correct FK for each item type.
    // NEVER by itemId alone — course 15 and exam 15 are different.
    const itemMatch = {};
    if (resolvedItemType === "course") {
      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: "courseId is required for itemType 'course'.",
        });
      }
      itemMatch.courseId = courseId;
    } else if (resolvedItemType === "exam") {
      if (!examId) {
        return res.status(400).json({
          success: false,
          message: "examId is required for itemType 'exam'.",
        });
      }
      itemMatch.examId = examId;
    } else if (resolvedItemType === "store_item") {
      if (!storeItemId) {
        return res.status(400).json({
          success: false,
          message: "storeItemId is required for itemType 'store_item'.",
        });
      }
      itemMatch.storeItemId = storeItemId;
    } else if (resolvedItemType === "mock_test") {
      if (!mockTestId) {
        return res.status(400).json({
          success: false,
          message: "mockTestId is required for itemType 'mock_test'.",
        });
      }
      itemMatch.mockTestId = mockTestId;
    } else if (resolvedItemType === "iso_exam") {
      if (!isoExamId) {
        return res.status(400).json({
          success: false,
          message: "isoExamId is required for itemType 'iso_exam'.",
        });
      }
      itemMatch.isoExamId = isoExamId;
    } else {
      // 'other' — fall back to itemId if provided
      if (itemId) {
        itemMatch.itemId = itemId;
      }
    }

    if (Object.keys(itemMatch).length > 0) {
      const duplicate = await StorePayment.findOne({
        where: {
          studentId: student.studentId,
          itemType: resolvedItemType,
          ...itemMatch,
          status: { [Op.in]: BLOCKING_STATUSES },
        },
        order: [["createdAt", "DESC"]],
      });

      if (duplicate) {
        const isPending = duplicate.status === "pending";
        const statusMessage = isPending
          ? "You already have a pending payment for this item. Please wait for admin verification."
          : "This item is already paid on your account. You cannot submit another payment for it.";

        return res.status(409).json({
          success: false,
          message: statusMessage,
          data: {
            existingPaymentId: duplicate.id,
            transactionId: duplicate.transactionId,
            status: duplicate.status,
            itemType: duplicate.itemType,
            courseId: duplicate.courseId,
            examId: duplicate.examId,
            storeItemId: duplicate.storeItemId,
            mockTestId: duplicate.mockTestId,
            isoExamId: duplicate.isoExamId,
            createdAt: duplicate.createdAt,
          },
        });
      }
    }

    // ============================================================
    // 8. DETERMINE PAYMENT PURPOSE
    // ============================================================
    let finalPaymentPurpose = paymentPurpose;
    if (!finalPaymentPurpose) {
      if (itemType === "course") finalPaymentPurpose = "Course Enrollment";
      else if (itemType === "exam") finalPaymentPurpose = "Exam Access";
      else if (itemType === "store_item") finalPaymentPurpose = "Document Purchase";
      else if (itemType === "mock_test") finalPaymentPurpose = "Mock Test Access";
      else if (itemType === "iso_exam") finalPaymentPurpose = "ISO Exam Access";
      else finalPaymentPurpose = "Store Purchase";
    }

    // ============================================================
    // 9. CREATE PAYMENT
    // ============================================================
    const payment = await StorePayment.create({
      studentId: student.studentId,
      studentName: student.fullName || studentName,
      studentEmail: student.email,
      studentPhone: student.phoneNo,
      transactionId: trimmedTrxId,
      paymentNumber: trimmedPhone,
      amount: parseFloat(amount),
      originalAmount: originalAmount
        ? parseFloat(originalAmount)
        : parseFloat(amount),
      discountAmount: discountAmount ? parseFloat(discountAmount) : 0,
      couponCode: couponCode || null,
      paymentMethod,
      itemType: resolvedItemType,
      itemId: itemId || null,
      itemName: itemName || null,
      itemCode: itemCode || null,
      courseId: courseId || null,
      examId: examId || null,
      storeItemId: storeItemId || null,
      mockTestId: mockTestId || null,
      isoExamId: isoExamId || null,
      status: "pending",
      paymentPurpose: finalPaymentPurpose,
      submittedBy: student.email || student.studentId,
      remarks: remarks || null,
    });

    // ============================================================
    // 10. RESPONSE
    // ============================================================
    return res.status(201).json({
      success: true,
      message:
        "Payment submitted successfully! Your payment is pending verification.",
      data: {
        id: payment.id,
        studentId: payment.studentId,
        studentName: payment.studentName,
        transactionId: payment.transactionId,
        paymentNumber: payment.paymentNumber,
        amount: payment.amount,
        originalAmount: payment.originalAmount,
        discountAmount: payment.discountAmount,
        couponCode: payment.couponCode,
        paymentMethod: payment.paymentMethod,
        itemType: payment.itemType,
        itemName: payment.itemName,
        itemCode: payment.itemCode,
        courseId: payment.courseId,
        examId: payment.examId,
        storeItemId: payment.storeItemId,
        mockTestId: payment.mockTestId,
        isoExamId: payment.isoExamId,
        paymentPurpose: payment.paymentPurpose,
        status: payment.status,
        createdAt: payment.createdAt,
      },
    });
  } catch (error) {
    console.error("Error submitting store payment:", error);

    // Friendly handler for unique constraint races
    if (
      error.name === "SequelizeUniqueConstraintError" ||
      error.original?.code === "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "A duplicate record already exists (transaction ID or item). Please try again.",
      });
    }

    next(error);
  }
};




//! Get payment by ID
const getStorePaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await StorePayment.findOne({ where: { id } });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment retrieved successfully!",
      data: payment,
    });
  } catch (error) {
    console.error("Error getting payment:", error);
    next(error);
  }
};

//! Get student store payment history
const getStudentStorePayments = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 10, status = '', itemType = '' } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // First, find the student by their primary key (id) to get the actual studentId
    const student = await Student.findOne({
      where: { id: studentId }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    // Build where clause using the student's actual studentId (e.g., "FIT-2026-00004")
    const whereClause = {
      studentId: student.studentId, 
    };

    // Override with status filter if provided
    if (status) {
      whereClause.status = status;
    }

    if (itemType) {
      whereClause.itemType = itemType;
    }

    const { count, rows: payments } = await StorePayment.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Student store payments retrieved successfully!",
      data: payments,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting student store payments:", error);
    next(error);
  }
};

//! Get payments by item type and item ID
const getPaymentsByItem = async (req, res, next) => {
  try {
    const { itemType, itemId } = req.params;
    const { page = 1, limit = 10, status = '' } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // Map itemType to the correct column
    let itemColumn = 'itemId';
    if (itemType === 'course') {
      itemColumn = 'courseId';
    } else if (itemType === 'exam') {
      itemColumn = 'examId';
    } else if (itemType === 'store_item') {
      itemColumn = 'storeItemId';
    } else if (itemType === 'mock_test') {
      itemColumn = 'mockTestId';
    } else if (itemType === 'iso_exam') {
      itemColumn = 'isoExamId';
    }

    const whereClause = {
      itemType: itemType,
      [itemColumn]: parseInt(itemId, 10)
    };

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: payments } = await StorePayment.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Payments retrieved successfully!",
      data: payments,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting payments by item:", error);
    next(error);
  }
};

//! Get all store payments (Admin)
const getAllStorePayments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = "",
      paymentMethod = "",
      itemType = "",
      search = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (status) {
      whereClause.status = status;
    }

    if (paymentMethod) {
      whereClause.paymentMethod = paymentMethod;
    }

    if (itemType) {
      whereClause.itemType = itemType;
    }

    if (search) {
      whereClause[Op.or] = [
        { studentId: { [Op.like]: `%${search}%` } },
        { studentName: { [Op.like]: `%${search}%` } },
        { transactionId: { [Op.like]: `%${search}%` } },
        { paymentNumber: { [Op.like]: `%${search}%` } },
        { itemName: { [Op.like]: `%${search}%` } },
        { itemCode: { [Op.like]: `%${search}%` } },
        { couponCode: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: payments } = await StorePayment.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Store payments retrieved successfully!",
      data: payments,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting all store payments:", error);
    next(error);
  }
};
















//! Verify store payment (Admin)
const verifyStorePayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    // Validate status
    if (!status || !['completed', 'failed', 'cancelled'].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Valid status is required! Must be: completed, failed, or cancelled",
      });
    }

    // Find payment
    const payment = await StorePayment.findOne({ where: { id }, transaction });
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }

    // Update payment status - Set studentChecked to true when admin verifies
    await payment.update({
      status: status,
      verifiedBy: req.user?.email || "admin",
      verifiedAt: new Date(),
      remarks: remarks || payment.remarks,
      studentChecked: true, // Set to true when admin verifies
    }, { transaction });

    // If payment is completed, update student's information
    if (status === 'completed') {
      const student = await Student.findOne({
        where: { studentId: payment.studentId },
        transaction
      });

      if (student) {
        // Update student's payment information
        const newPaidAmount = parseFloat(student.paidAmount) + parseFloat(payment.amount);
        const newDueAmount = parseFloat(student.totalFee) - newPaidAmount;
        const paymentStatus = newDueAmount <= 0 ? "paid" : (newPaidAmount > 0 ? "partial" : "pending");

        await student.update({
          paidAmount: newPaidAmount,
          dueAmount: newDueAmount,
          paymentStatus: paymentStatus,
          lastPaymentDate: new Date(),
        }, { transaction });

        // Add student's primary id to payment data for response
        payment.dataValues.studentPrimaryId = student.id;
      }
    }

    await transaction.commit();

    // Prepare response data with student primary id
    const responseData = payment.toJSON();
    
    // If student was found and payment is completed, ensure studentPrimaryId is in response
    if (status === 'completed') {
      const student = await Student.findOne({
        where: { studentId: payment.studentId }
      });
      if (student) {
        responseData.studentPrimaryId = student.id;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Store payment ${status} successfully!`,
      data: responseData,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error verifying store payment:", error);
    next(error);
  }
};





































//! Delete store payment (Admin)
const deleteStorePayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await StorePayment.findOne({ where: { id } });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }

    await payment.destroy();

    return res.status(200).json({
      success: true,
      message: "Store payment deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting store payment:", error);
    next(error);
  }
};

//! Get store payment statistics
const getStorePaymentStats = async (req, res, next) => {
  try {
    const totalPayments = await StorePayment.count();
    const pendingPayments = await StorePayment.count({ where: { status: "pending" } });
    const completedPayments = await StorePayment.count({ where: { status: "completed" } });
    const failedPayments = await StorePayment.count({ where: { status: "failed" } });

    const totalAmountResult = await StorePayment.sum("amount", { where: { status: "completed" } });
    const totalAmount = totalAmountResult || 0;

    // Stats by item type
    const byItemType = await StorePayment.findAll({
      attributes: [
        "itemType",
        [sequelize.fn("COUNT", sequelize.col("itemType")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total"],
      ],
      where: { status: "completed" },
      group: ["itemType"],
    });

    // Stats by payment method
    const byMethod = await StorePayment.findAll({
      attributes: [
        "paymentMethod",
        [sequelize.fn("COUNT", sequelize.col("paymentMethod")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total"],
      ],
      where: { status: "completed" },
      group: ["paymentMethod"],
    });

    // Coupon usage stats
    const couponUsage = await StorePayment.findAll({
      attributes: [
        "couponCode",
        [sequelize.fn("COUNT", sequelize.col("couponCode")), "count"],
        [sequelize.fn("SUM", sequelize.col("discountAmount")), "totalDiscount"],
      ],
      where: {
        status: "completed",
        couponCode: { [Op.ne]: null }
      },
      group: ["couponCode"],
      order: [[sequelize.literal("totalDiscount"), "DESC"]],
      limit: 10,
    });

    return res.status(200).json({
      success: true,
      message: "Store payment statistics retrieved successfully!",
      data: {
        total: totalPayments,
        pending: pendingPayments,
        completed: completedPayments,
        failed: failedPayments,
        totalAmount: totalAmount,
        byItemType: byItemType,
        byMethod: byMethod,
        topCoupons: couponUsage,
      },
    });
  } catch (error) {
    console.error("Error getting store payment stats:", error);
    next(error);
  }
};

//! Check if student has paid for a specific item
const checkStudentItemPayment = async (req, res, next) => {
  try {
    const { studentId, itemType, itemId } = req.params;

    const payment = await StorePayment.findOne({
      where: {
        studentId: studentId,
        itemType: itemType,
        status: 'completed',
        [Op.or]: [
          { itemId: parseInt(itemId, 10) },
          // Also check specific ID columns based on item type
          ...(itemType === 'course' ? [{ courseId: parseInt(itemId, 10) }] : []),
          ...(itemType === 'exam' ? [{ examId: parseInt(itemId, 10) }] : []),
          ...(itemType === 'store_item' ? [{ storeItemId: parseInt(itemId, 10) }] : []),
          ...(itemType === 'mock_test' ? [{ mockTestId: parseInt(itemId, 10) }] : []),
          ...(itemType === 'iso_exam' ? [{ isoExamId: parseInt(itemId, 10) }] : []),
        ]
      }
    });

    return res.status(200).json({
      success: true,
      message: "Payment check completed",
      data: {
        hasPaid: !!payment,
        payment: payment ? {
          id: payment.id,
          transactionId: payment.transactionId,
          amount: payment.amount,
          status: payment.status,
          paymentPurpose: payment.paymentPurpose,
          createdAt: payment.createdAt,
        } : null
      }
    });
  } catch (error) {
    console.error("Error checking student item payment:", error);
    next(error);
  }
};











// controllers/payment/storePayment.controller.js

// Add these new controller functions

//! Get admin notifications (pending payments where adminChecked is false)
const getAdminNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {
      adminChecked: false,
      status: 'pending'
    };

    const { count, rows: notifications } = await StorePayment.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Admin notifications retrieved successfully!",
      data: notifications,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting admin notifications:", error);
    next(error);
  }
};

//! Get student notifications (pending payments where studentChecked is false)
const getStudentNotifications = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // First, find the student by their primary key (id) to get the actual studentId
    const student = await Student.findOne({
      where: { id: studentId }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    // Use the student's actual studentId (e.g., FIT-2026-00001) to query payments
    const whereClause = {
      studentId: student.studentId,
      studentChecked: true,
      status: 'completed'
    };

    const { count, rows: notifications } = await StorePayment.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Student notifications retrieved successfully!",
      data: notifications,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting student notifications:", error);
    next(error);
  }
};







//! Mark admin notification as read
const markAdminNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await StorePayment.findOne({ where: { id } });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }

    await payment.update({
      adminChecked: true
    });

    return res.status(200).json({
      success: true,
      message: "Notification marked as read!",
      data: payment,
    });
  } catch (error) {
    console.error("Error marking admin notification as read:", error);
    next(error);
  }
};

//! Mark student notification as read
const markStudentNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await StorePayment.findOne({ where: { id } });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }

    await payment.update({
      studentChecked: false
    });

    return res.status(200).json({
      success: true,
      message: "Notification marked as read!",
      data: payment,
    });
  } catch (error) {
    console.error("Error marking student notification as read:", error);
    next(error);
  }
};

//! Mark all admin notifications as read
const markAllAdminNotificationsAsRead = async (req, res, next) => {
  try {
    const [updatedCount] = await StorePayment.update(
      { adminChecked: true },
      {
        where: {
          adminChecked: false,
          status: 'pending'
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: `${updatedCount} notifications marked as read!`,
      data: { updatedCount },
    });
  } catch (error) {
    console.error("Error marking all admin notifications as read:", error);
    next(error);
  }
};

//! Get notification count for admin
const getAdminNotificationCount = async (req, res, next) => {
  try {
    const count = await StorePayment.count({
      where: {
        adminChecked: false,
        status: 'pending'
      }
    });

    return res.status(200).json({
      success: true,
      message: "Admin notification count retrieved successfully!",
      data: { count },
    });
  } catch (error) {
    console.error("Error getting admin notification count:", error);
    next(error);
  }
};




//! Get notification count for student
const getStudentNotificationCount = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // First, find the student by their primary key (id) to get the actual studentId
    const student = await Student.findOne({
      where: { id: studentId }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    // Use the student's actual studentId (e.g., FIT-2026-00001) to query payments
    const count = await StorePayment.count({
      where: {
        studentId: student.studentId,
        studentChecked: true,
        status: 'completed'
      }
    });

    return res.status(200).json({
      success: true,
      message: "Student notification count retrieved successfully!",
      data: { count },
    });
  } catch (error) {
    console.error("Error getting student notification count:", error);
    next(error);
  }
};


module.exports = {
  submitStorePayment,
  getStorePaymentById,
  getStudentStorePayments,
  getPaymentsByItem,
  getAllStorePayments,
  verifyStorePayment,
  deleteStorePayment,
  getStorePaymentStats,
  checkStudentItemPayment,

  getAdminNotifications,
  getStudentNotifications,
  markAdminNotificationAsRead,
  markStudentNotificationAsRead,
  markAllAdminNotificationsAsRead,
  getAdminNotificationCount,
  getStudentNotificationCount,
};