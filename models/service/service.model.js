// models/service/service.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Service = sequelize.define(
  "service",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    serviceCode: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      comment: "Auto-generated code like SVC-2026-0001",
    },
    title: {
      type: dt.STRING,
      allowNull: false,
    },
    slug: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    shortDescription: {
      type: dt.STRING(500),
      allowNull: true,
    },
    image: {
      type: dt.STRING,
      allowNull: true,
    },
    icon: {
      type: dt.STRING,
      allowNull: true,
    },
    isActive: {
      type: dt.BOOLEAN,
      defaultValue: true,
    },
    displayOrder: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    assignedStudents: {
      type: dt.JSON,
      allowNull: false,
      defaultValue: [],
      comment: "Array of student IDs",
    },
    metaTitle: { type: dt.STRING, allowNull: true },
    metaDescription: { type: dt.TEXT, allowNull: true },
    createdBy: { type: dt.INTEGER, allowNull: true },
    updatedBy: { type: dt.INTEGER, allowNull: true },
  },
  {
    tableName: "services",
    timestamps: true,
    indexes: [{ fields: ["slug"] }, { fields: ["isActive"] }],
  }
);

module.exports = Service;