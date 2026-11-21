// models/payment/monthlyPayment.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const MonthlyPayment = sequelize.define(
  "monthlyPayment",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    studentId: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "FK → students-collections.id",
    },
    studentCode: {
      type: dt.STRING,
      allowNull: false,
      comment: "Denormalised studentId (e.g. FIT-2026-00001) for fast search",
    },
    studentName: {
      type: dt.STRING,
      allowNull: false,
      comment: "Denormalised fullName",
    },
    class: {
      type: dt.STRING,
      allowNull: true,
    },
    batch: {
      type: dt.STRING,
      allowNull: true,
    },

    year: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "e.g. 2026",
    },
    month: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "1 – 12",
    },

    amount: {
      type: dt.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Amount this student owes for the month",
    },
    paidAmount: {
      type: dt.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    dueAmount: {
      type: dt.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    status: {
      type: dt.ENUM("pending", "partial", "paid"),
      allowNull: false,
      defaultValue: "pending",
    },

    paidAt: {
      type: dt.DATE,
      allowNull: true,
    },
    note: {
      type: dt.TEXT,
      allowNull: true,
    },

    createdBy: { type: dt.STRING, allowNull: true },
    updatedBy: { type: dt.STRING, allowNull: true },
  },
  {
    tableName: "monthly-payments",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["studentId", "year", "month"] },
      { fields: ["year", "month"] },
      { fields: ["class", "batch"] },
      { fields: ["studentId"] },
      { fields: ["status"] },
    ],
  }
);

module.exports = MonthlyPayment;