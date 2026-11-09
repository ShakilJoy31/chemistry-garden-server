// models/students/registered-student.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const RegisteredStudent = sequelize.define(
  "registered_student",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    // Registration Information
    registrationId: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    
    // Personal Information (Minimal for registration)
    fullName: {
      type: dt.STRING,
      allowNull: false,
    },
    nickName: {
      type: dt.STRING,
      allowNull: true,
    },
    email: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    phoneNo: {
      type: dt.STRING,
      allowNull: true,
    },
    photo: {
      type: dt.STRING,
      allowNull: true,
      comment: "Profile photo URL",
    },
    
    // Security
    password: {
      type: dt.STRING,
      allowNull: false,
    },
    
    // Status
    status: {
      type: dt.ENUM("pending", "approved", "rejected", "completed"),
      defaultValue: "pending",
    },
    
    // Verification
    emailVerified: {
      type: dt.BOOLEAN,
      defaultValue: false,
    },
    phoneVerified: {
      type: dt.BOOLEAN,
      defaultValue: false,
    },
    
    // Timestamps
    registeredAt: {
      type: dt.DATE,
      defaultValue: dt.NOW,
    },
    approvedAt: {
      type: dt.DATE,
      allowNull: true,
    },
    approvedBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "ID of the admin who approved this registration",
    },
    
    // Rejection
    rejectionReason: {
      type: dt.TEXT,
      allowNull: true,
    },
    
    // Metadata (registration source, device type, browser info)
    metadata: {
      type: dt.JSON,
      allowNull: true,
      defaultValue: {},
      comment: "Store additional registration data (source, device, browser, etc.)",
    },
    
    // IP Address & User Agent for tracking
    ipAddress: {
      type: dt.STRING,
      allowNull: true,
    },
    userAgent: {
      type: dt.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "registered-students",
    timestamps: true,
    createdAt: "registeredAt",
    updatedAt: "updatedAt",
  }
);

module.exports = RegisteredStudent;