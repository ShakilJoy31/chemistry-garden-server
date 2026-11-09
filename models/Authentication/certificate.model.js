// models/Certificate/certificate.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Certificate = sequelize.define(
  "certificate",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    // Certificate Basic Information
    name: {
      type: dt.STRING,
      allowNull: false,
    },
    address: {
      type: dt.TEXT,
      allowNull: false,
    },
    standard: {
      type: dt.STRING,
      allowNull: false,
      comment: "e.g., ISO 9001:2015-Quality Management System",
    },
    accreditationBody: {
      type: dt.STRING,
      allowNull: false,
      comment: "e.g., iSAB, USA",
    },
    certificationBody: {
      type: dt.STRING,
      allowNull: false,
      comment: "e.g., Moody Inspection & Assurance LLC. USA",
    },
    country: {
      type: dt.STRING,
      allowNull: false,
    },
    scope: {
      type: dt.TEXT,
      allowNull: false,
    },
    certificateNumber: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    issueDate: {
      type: dt.DATEONLY,
      allowNull: false,
    },
    registrationDate: {
      type: dt.DATEONLY,
      allowNull: false,
    },
    expiryDate: {
      type: dt.DATEONLY,
      allowNull: false,
    },
    // Additional Fields
    certificateFile: {
      type: dt.STRING,
      allowNull: true,
      comment: "PDF or image of the certificate",
    },
    logo: {
      type: dt.STRING,
      allowNull: true,
    },
    // Status Fields
    status: {
      type: dt.ENUM("active", "expired", "suspended", "pending"),
      defaultValue: "active",
    },
    isVerified: {
      type: dt.BOOLEAN,
      defaultValue: false,
    },
    verifiedAt: {
      type: dt.DATE,
      allowNull: true,
    },
    // System Fields
    createdBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "User ID who created this certificate",
    },
    notes: {
      type: dt.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "certificates",
    timestamps: true,
  }
);

module.exports = Certificate;