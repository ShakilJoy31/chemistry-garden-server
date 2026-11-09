// models/Payment/storePayment.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const StorePayment = sequelize.define(
  "storePayment",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    // Student Information
    studentId: {
      type: dt.STRING,
      allowNull: false,
      references: {
        model: 'students-collections',
        key: 'studentId'
      }
    },
    studentName: {
      type: dt.STRING,
      allowNull: false,
    },
    studentEmail: {
      type: dt.STRING,
      allowNull: true,
    },
    studentPhone: {
      type: dt.STRING,
      allowNull: true,
    },

    // Payment Details
    transactionId: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    paymentNumber: {
      type: dt.STRING,
      allowNull: false,
    },
    amount: {
      type: dt.DECIMAL(10, 2),
      allowNull: false,
    },
    originalAmount: {
      type: dt.DECIMAL(10, 2),
      allowNull: true,
      comment: "Original amount before coupon discount"
    },
    discountAmount: {
      type: dt.DECIMAL(10, 2),
      defaultValue: 0,
      comment: "Discount amount applied from coupon"
    },
    couponCode: {
      type: dt.STRING,
      allowNull: true,
      comment: "Coupon code used for discount"
    },
    paymentMethod: {
      type: dt.STRING,
      allowNull: false,
      validate: {
        isIn: [['bkash', 'nagad', 'rocket', 'upay']]
      }
    },

    // Item Information
    itemType: {
      type: dt.ENUM('course', 'exam', 'store_item', 'mock_test', 'iso_exam', 'other'),
      allowNull: false,
      defaultValue: 'other',
      comment: "Type of item purchased"
    },
    itemId: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "ID of the item (course_id, exam_id, store_item_id, etc.)"
    },
    itemName: {
      type: dt.STRING,
      allowNull: true,
      comment: "Name of the item purchased"
    },
    itemCode: {
      type: dt.STRING,
      allowNull: true,
      comment: "Code/Identifier of the item (course_id, exam_id, etc.)"
    },

    // Specific Item IDs for different types
    courseId: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "Reference to course if itemType is 'course'"
    },
    examId: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "Reference to exam if itemType is 'exam'"
    },
    storeItemId: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "Reference to store item if itemType is 'store_item'"
    },
    mockTestId: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "Reference to mock test if itemType is 'mock_test'"
    },
    isoExamId: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "Reference to ISO exam if itemType is 'iso_exam'"
    },

    // Payment Status
    status: {
      type: dt.ENUM('pending', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending',
    },
    paymentPurpose: {
      type: dt.STRING,
      allowNull: true,
      comment: "Purpose of payment (e.g., 'Course Enrollment', 'Document Purchase', 'Exam Access')"
    },

    // Notification Fields
    adminChecked: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "Whether admin has viewed/checked this payment notification"
    },
    studentChecked: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "Whether student has viewed/checked this payment notification"
    },

    // System Fields
    submittedBy: {
      type: dt.STRING,
      allowNull: true,
    },
    verifiedBy: {
      type: dt.STRING,
      allowNull: true,
    },
    verifiedAt: {
      type: dt.DATE,
      allowNull: true,
    },
    remarks: {
      type: dt.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "store_payments",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['transactionId']
      },
      {
        fields: ['studentId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['paymentMethod']
      },
      {
        fields: ['itemType']
      },
      {
        fields: ['itemId']
      },
      {
        fields: ['courseId']
      },
      {
        fields: ['examId']
      },
      {
        fields: ['storeItemId']
      },
      {
        fields: ['mockTestId']
      },
      {
        fields: ['isoExamId']
      },
      {
        fields: ['adminChecked']
      },
      {
        fields: ['studentChecked']
      }
    ]
  }
);

module.exports = StorePayment;

