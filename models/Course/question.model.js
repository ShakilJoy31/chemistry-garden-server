const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Question = sequelize.define(
  "question",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    examId: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "ID of the exam this question belongs to",
    },
    questionText: {
      type: dt.TEXT,
      allowNull: false,
    },
    questionType: {
      type: dt.ENUM("single", "multiple"),
      defaultValue: "single",
      comment: "Single correct or multiple correct answers",
    },
    options: {
      type: dt.TEXT,  // Changed from JSON to TEXT
      allowNull: false,
      defaultValue: "[]",
      comment: "Array of options: [{id, text, isCorrect}]",
      get() {
        const rawValue = this.getDataValue('options');
        if (!rawValue) return [];
        if (typeof rawValue === 'string') {
          try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error("Error parsing options:", e);
            return [];
          }
        }
        return Array.isArray(rawValue) ? rawValue : [];
      },
      set(value) {
        const stringValue = JSON.stringify(value || []);
        this.setDataValue('options', stringValue);
      }
    },
    correctAnswers: {
      type: dt.TEXT,  // Changed from JSON to TEXT
      allowNull: false,
      defaultValue: "[]",
      comment: "Array of correct option IDs",
      get() {
        const rawValue = this.getDataValue('correctAnswers');
        if (!rawValue) return [];
        if (typeof rawValue === 'string') {
          try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error("Error parsing correctAnswers:", e);
            return [];
          }
        }
        return Array.isArray(rawValue) ? rawValue : [];
      },
      set(value) {
        const stringValue = JSON.stringify(value || []);
        this.setDataValue('correctAnswers', stringValue);
      }
    },
    marks: {
      type: dt.INTEGER,
      defaultValue: 1,
    },
    order: {
      type: dt.INTEGER,
      defaultValue: 0,
      comment: "Order of question in exam",
    },
    explanation: {
      type: dt.TEXT,
      allowNull: true,
      comment: "Explanation for the correct answer",
    },
  },
  {
    tableName: "questions",
    timestamps: true,
  }
);

module.exports = Question;