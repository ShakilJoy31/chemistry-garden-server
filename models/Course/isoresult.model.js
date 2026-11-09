// models/Course/isoresult.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const IsoResult = sequelize.define(
  "isoresult",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    isoExamId: {
      type: dt.INTEGER,
      allowNull: false,
    },
    studentId: {
      type: dt.INTEGER,
      allowNull: false,
    },
    studentName: {
      type: dt.STRING,
      allowNull: true,
    },
    studentStudentId: {
      type: dt.STRING,
      allowNull: true,
    },
    // MCQ section results
    totalMcqQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    attemptedMcqQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    correctMcqAnswers: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    incorrectMcqAnswers: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    obtainedMcqMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    totalMcqMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    // Short questions results
    totalShortQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    attemptedShortQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    obtainedShortMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    totalShortMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    // Long questions results
    totalLongQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    attemptedLongQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    obtainedLongMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    totalLongMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    // Overall results
    obtainedMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    totalMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    percentage: {
      type: dt.DECIMAL(5, 2),
      defaultValue: 0,
    },
    isPassed: {
      type: dt.BOOLEAN,
      defaultValue: false,
    },
    // Student answers stored as JSON
    mcqAnswers: {
      type: dt.JSON,
      defaultValue: [],
      comment: "Array of MCQ answers [{questionId, selectedOptions, isCorrect, marksObtained}]",
    },
    shortAnswers: {
      type: dt.JSON,
      defaultValue: [],
      comment: "Array of short answers [{questionId, answerText, marksObtained}]",
    },
    longAnswers: {
      type: dt.JSON,
      defaultValue: [],
      comment: "Array of long answers [{questionId, answerText, subAnswers, marksObtained}]",
    },
    startedAt: {
      type: dt.DATE,
      allowNull: true,
    },
    submittedAt: {
      type: dt.DATE,
      allowNull: true,
    },
    status: {
      type: dt.ENUM("pending", "in-progress", "completed"),
      defaultValue: "pending",
    },
  },
  {
    tableName: "iso_results",
    timestamps: true,
  }
);

module.exports = IsoResult;