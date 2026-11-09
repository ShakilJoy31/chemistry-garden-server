// models/category/category.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Category = sequelize.define(
  "category",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    /* ---------- Core fields ---------- */
    name: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    slug: {
      type: dt.STRING,
      allowNull: true,
      unique: true,
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },

    /* ---------- Lifecycle ---------- */
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    /* ---------- Audit ---------- */
    createdBy: {
      type: dt.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "categories",
    timestamps: true,
    indexes: [
      { fields: ["isActive"] },
      { fields: ["name"] },
      { fields: ["slug"] },
    ],
  }
);

module.exports = Category;