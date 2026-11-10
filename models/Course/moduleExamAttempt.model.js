const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const ModuleExamAttempt = sequelize.define(
  "module_exam_attempt",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    moduleExamId: {
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
      type: dt.TEXT,
      allowNull: true,
      defaultValue: "[]",
      comment: "JSON: [{ questionId, selectedOptions, isCorrect, marksObtained }]",
      get() {
        const raw = this.getDataValue("answers");
        if (!raw) return [];
        if (typeof raw === "string") {
          try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        }
        return Array.isArray(raw) ? raw : [];
      },
      set(value) {
        this.setDataValue("answers", JSON.stringify(value || []));
      },
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
      type: dt.ENUM("in-progress", "completed"),
      defaultValue: "in-progress",
    },
  },
  {
    tableName: "module_exam_attempts",
    timestamps: true,
    indexes: [
      { fields: ["moduleExamId"] },
      { fields: ["studentId"] },
      { fields: ["moduleExamId", "studentId"], unique: true, name: "uniq_exam_student" },
    ],
  }
);

module.exports = ModuleExamAttempt;