const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Result = sequelize.define(
  "result",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    examId: {
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
    totalQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    attemptedQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    correctAnswers: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    incorrectAnswers: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
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
    answers: {
      type: dt.JSON,
      defaultValue: [],
      comment: "Array of student answers [{questionId, selectedOptions, isCorrect, marksObtained}]",
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
    tableName: "results",
    timestamps: true,
  }
);

module.exports = Result;