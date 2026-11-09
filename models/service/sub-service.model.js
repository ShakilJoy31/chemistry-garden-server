// models/service/sub-service.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const SubService = sequelize.define(
  "sub_service",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    subServiceCode: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      comment: "Auto-generated code like SUB-2026-0001",
    },
    serviceId: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "Plain integer reference to services.id (no FK constraint)",
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
    description: { type: dt.TEXT, allowNull: true },
    shortDescription: { type: dt.STRING(500), allowNull: true },
    image: { type: dt.STRING, allowNull: true },
    icon: { type: dt.STRING, allowNull: true },
    isActive: { type: dt.BOOLEAN, defaultValue: true },
    displayOrder: { type: dt.INTEGER, defaultValue: 0 },
    assignedStudents: {
      type: dt.JSON,
      allowNull: false,
      defaultValue: [],
    },
    metaTitle: { type: dt.STRING, allowNull: true },
    metaDescription: { type: dt.TEXT, allowNull: true },
    createdBy: { type: dt.INTEGER, allowNull: true },
    updatedBy: { type: dt.INTEGER, allowNull: true },
  },
  {
    tableName: "sub_services",
    timestamps: true,
    indexes: [
      { fields: ["serviceId"] },
      { fields: ["slug"] },
      { fields: ["isActive"] },
    ],
  }
);

module.exports = SubService;