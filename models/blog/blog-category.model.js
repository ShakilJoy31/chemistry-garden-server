// models/blog/blog-category.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const BlogCategory = sequelize.define(
  "blog_category",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    categoryCode: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      comment: "Auto-generated code like BCAT-2026-0001",
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
      comment: "Optional cover image for the category",
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
    metaTitle: { type: dt.STRING, allowNull: true },
    metaDescription: { type: dt.TEXT, allowNull: true },
    createdBy: { type: dt.INTEGER, allowNull: true },
    updatedBy: { type: dt.INTEGER, allowNull: true },
  },
  {
    tableName: "blog_categories",
    timestamps: true,
    indexes: [
      { fields: ["slug"] },
      { fields: ["isActive"] },
      { fields: ["displayOrder"] },
    ],
  }
);

module.exports = BlogCategory;