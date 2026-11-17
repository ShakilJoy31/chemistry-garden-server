const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Batch = sequelize.define(
  "batch",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    classId: {
      type: dt.INTEGER,
      allowNull: false,          // every batch must belong to a class
      // no `references` because you don't want associations
    },
    name: {
      type: dt.STRING,
      allowNull: false,
      validate: { notEmpty: true },
      // NOTE: uniqueness is now per-class, handled at controller level
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdBy: { type: dt.STRING, allowNull: true },
    updatedBy: { type: dt.STRING, allowNull: true },
  },
  {
    tableName: "batches",
    timestamps: true,
    indexes: [
      { fields: ["isActive"] },
      { fields: ["classId"] },
      { unique: true, fields: ["classId", "name"] }, // name unique within a class
    ],
  }
);

module.exports = Batch;