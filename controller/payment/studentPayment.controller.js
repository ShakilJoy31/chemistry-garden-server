// controllers/payment/payment.controller.js
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Student = require("../../models/students/student.model");
const Payment = require("../../models/Payment/studentPayment.model");

//! Submit new payment
const submitPayment = async (req, res, next) => {
  try {
    const {
      studentId,
      studentName,
      transactionId,
      paymentNumber,
      amount,
      paymentMethod,
      remarks
    } = req.body;

    // Validate required fields
    if (!studentId || !transactionId || !paymentNumber || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Student ID, Transaction ID, Payment Number, Amount, and Payment Method are required!",
      });
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid payment amount!",
      });
    }

    // Validate payment method
    const validMethods = ['bkash', 'nagad', 'rocket', 'upay'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method! Must be one of: bkash, nagad, rocket, upay",
      });
    }

    // Check if student exists
    const student = await Student.findOne({ 
      where: { 
        [Op.or]: [
          { studentId: studentId },
          { id: studentId }
        ]
      } 
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found! Please check your student ID.",
      });
    }

    // Check if transaction ID already exists
    const existingPayment = await Payment.findOne({
      where: { transactionId }
    });

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: "Transaction ID already exists! Please check your transaction ID.",
      });
    }

    // Create payment record
    const payment = await Payment.create({
      studentId: student.studentId,
      studentName: student.fullName,
      transactionId,
      paymentNumber,
      amount: parseFloat(amount),
      paymentMethod,
      status: 'pending',
      submittedBy: student.email || student.studentId,
      remarks: remarks || null,
    });

    return res.status(201).json({
      success: true,
      message: "Payment submitted successfully! Your payment is pending verification.",
      data: {
        id: payment.id,
        studentId: payment.studentId,
        studentName: payment.studentName,
        transactionId: payment.transactionId,
        paymentNumber: payment.paymentNumber,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        createdAt: payment.createdAt,
      },
    });
  } catch (error) {
    console.error("Error submitting payment:", error);
    next(error);
  }
};

//! Get payment by ID
const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findOne({ where: { id } });

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

//! Get student payment history
const getStudentPayments = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 10, status = '' } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {
      studentId: studentId
    };

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Student payments retrieved successfully!",
      data: payments,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting student payments:", error);
    next(error);
  }
};

//! Get all payments (Admin)
const getAllPayments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = "",
      paymentMethod = "",
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

    if (search) {
      whereClause[Op.or] = [
        { studentId: { [Op.like]: `%${search}%` } },
        { studentName: { [Op.like]: `%${search}%` } },
        { transactionId: { [Op.like]: `%${search}%` } },
        { paymentNumber: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: payments } = await Payment.findAndCountAll({
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
    console.error("Error getting all payments:", error);
    next(error);
  }
};

//! Verify payment (Admin)
const verifyPayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status || !['completed', 'failed', 'cancelled'].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Valid status is required! Must be: completed, failed, or cancelled",
      });
    }

    const payment = await Payment.findOne({ where: { id }, transaction });
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }

    // Update payment status
    await payment.update({
      status: status,
      verifiedBy: req.user?.email || "admin",
      verifiedAt: new Date(),
      remarks: remarks || payment.remarks,
    }, { transaction });

    console.log(status);
    // If payment is completed, update student's payment information
    if (status === 'completed') {
      const student = await Student.findOne({ 
        where: { studentId: payment.studentId },
        transaction 
      });
      console.log(student)

      if (student) {
        const newPaidAmount = parseFloat(student.paidAmount) + parseFloat(payment.amount);
        const newDueAmount = parseFloat(student.totalFee) - newPaidAmount;
        const paymentStatus = newDueAmount <= 0 ? "paid" : (newPaidAmount > 0 ? "partial" : "pending");

        await student.update({
          paidAmount: newPaidAmount,
          dueAmount: newDueAmount,
          paymentStatus: paymentStatus,
          lastPaymentDate: new Date(),
        }, { transaction });
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Payment ${status} successfully!`,
      data: payment,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error verifying payment:", error);
    next(error);
  }
};

//! Delete payment (Admin)
const deletePayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findOne({ where: { id } });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }

    await payment.destroy();

    return res.status(200).json({
      success: true,
      message: "Payment deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting payment:", error);
    next(error);
  }
};

//! Get payment statistics
const getPaymentStats = async (req, res, next) => {
  try {
    const totalPayments = await Payment.count();
    const pendingPayments = await Payment.count({ where: { status: "pending" } });
    const completedPayments = await Payment.count({ where: { status: "completed" } });
    const failedPayments = await Payment.count({ where: { status: "failed" } });

    const totalAmountResult = await Payment.sum("amount", { where: { status: "completed" } });
    const totalAmount = totalAmountResult || 0;

    const byMethod = await Payment.findAll({
      attributes: [
        "paymentMethod",
        [sequelize.fn("COUNT", sequelize.col("paymentMethod")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total"],
      ],
      where: { status: "completed" },
      group: ["paymentMethod"],
    });

    return res.status(200).json({
      success: true,
      message: "Payment statistics retrieved successfully!",
      data: {
        total: totalPayments,
        pending: pendingPayments,
        completed: completedPayments,
        failed: failedPayments,
        totalAmount: totalAmount,
        byMethod: byMethod,
      },
    });
  } catch (error) {
    console.error("Error getting payment stats:", error);
    next(error);
  }
};

module.exports = {
  submitPayment,
  getPaymentById,
  getStudentPayments,
  getAllPayments,
  verifyPayment,
  deletePayment,
  getPaymentStats,
};