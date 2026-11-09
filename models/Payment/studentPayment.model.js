// models/Payment/payment.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Payment = sequelize.define(
  "payment",
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
    paymentMethod: {
      type: dt.STRING,
      allowNull: false,
      validate: {
        isIn: [['bkash', 'nagad', 'rocket', 'upay']]
      }
    },
    // Payment Status
    status: {
      type: dt.ENUM('pending', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending',
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
    tableName: "payments",
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
      }
    ]
  }
);

module.exports = Payment;