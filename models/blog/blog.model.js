// models/blog/blog.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Blog = sequelize.define(
  "blog",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    blogCode: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      comment: "Auto-generated code like BLOG-2026-0001",
    },
    categoryId: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "Plain integer reference to blog_categories.id (no FK constraint)",
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
      type: dt.TEXT("long"),
      allowNull: false,
      comment: "Full blog content (HTML / markdown supported)",
    },
    shortDescription: {
      type: dt.STRING(500),
      allowNull: true,
      comment: "Used for cards / previews",
    },
    thumbnail: {
      type: dt.STRING,
      allowNull: false,
      comment: "Main thumbnail / cover image URL",
    },
    author: {
      type: dt.STRING,
      allowNull: true,
    },
    tags: {
      type: dt.JSON,
      allowNull: false,
      defaultValue: [],
      comment: "Array of tag strings",
    },
    readTime: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "Estimated read time in minutes",
    },
    views: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isFeatured: {
      type: dt.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: dt.BOOLEAN,
      defaultValue: true,
    },
    displayOrder: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    publishedAt: {
      type: dt.DATE,
      allowNull: true,
      comment: "When the blog was (or should be) published",
    },
    metaTitle: { type: dt.STRING, allowNull: true },
    metaDescription: { type: dt.TEXT, allowNull: true },
    createdBy: { type: dt.INTEGER, allowNull: true },
    updatedBy: { type: dt.INTEGER, allowNull: true },
  },
  {
    tableName: "blogs",
    timestamps: true,
    indexes: [
      { fields: ["slug"] },
      { fields: ["categoryId"] },
      { fields: ["isActive"] },
      { fields: ["isFeatured"] },
      { fields: ["publishedAt"] },
    ],
  }
);

module.exports = Blog;