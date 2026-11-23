// models/course.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Course = sequelize.define(
  "course",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    courseId: {
      type: dt.STRING,
      allowNull: true,
      unique: true,
    },
    courseName: {
      type: dt.STRING,
      allowNull: true,
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    duration: {
      type: dt.INTEGER,
      allowNull: true,
    },
    durationUnit: {
      type: dt.ENUM("days", "weeks", "months", "years"),
      allowNull: true,
    },
    totalFee: {
      type: dt.DECIMAL(10, 2),
      allowNull: true,
    },
    status: {
      type: dt.ENUM("active", "inactive"),
      defaultValue: "active",
    },
    thumbnail: {
      type: dt.STRING,
      allowNull: true,
    },
    syllabus: {
      type: dt.TEXT,
      allowNull: true,
    },
    prerequisites: {
      type: dt.TEXT,
      allowNull: true,
    },
    category: {
      type: dt.STRING,
      allowNull: true,
    },
    level: {
      type: dt.STRING,
      allowNull: true,
    },
    instructor: {
      type: dt.STRING,
      allowNull: true,
    },
    maxStudents: {
      type: dt.INTEGER,
      allowNull: true,
    },
    startDate: {
      type: dt.DATE,
      allowNull: true,
    },
    endDate: {
      type: dt.DATE,
      allowNull: true,
    },
    classSchedule: {
      type: dt.TEXT,
      allowNull: true,
    },
    materials: {
      type: dt.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: dt.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "courses",
    timestamps: true,
  }
);

module.exports = Course;