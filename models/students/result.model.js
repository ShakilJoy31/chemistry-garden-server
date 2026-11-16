// models/Result/result.model.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../database/connection");

const Result = sequelize.define(
  "Result",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    studentCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    studentName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    class: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    batch: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    cq: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },
    mcq: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },
    examName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    publishedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "batch-results",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

module.exports = Result;