// models/Course/isoquestion.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const IsoQuestion = sequelize.define(
  "isoquestion",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    isoExamId: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "ID of the ISO exam this question belongs to",
    },
    questionText: {
      type: dt.TEXT,
      allowNull: false,
    },
    questionType: {
      type: dt.ENUM("mcq", "short", "long"),
      defaultValue: "mcq",
      comment: "Type of question: mcq, short, or long",
    },
    // MCQ specific fields
    options: {
      type: dt.TEXT,
      allowNull: true,
      defaultValue: "[]",
      comment: "Array of options for MCQ: [{id, text, isCorrect}]",
      get() {
        const rawValue = this.getDataValue('options');
        if (!rawValue) return [];
        if (typeof rawValue === 'string') {
          try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
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
      type: dt.TEXT,
      allowNull: true,
      defaultValue: "[]",
      comment: "Array of correct option IDs for MCQ",
      get() {
        const rawValue = this.getDataValue('correctAnswers');
        if (!rawValue) return [];
        if (typeof rawValue === 'string') {
          try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
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
    // For short and long questions - model answer / marking scheme
    modelAnswer: {
      type: dt.TEXT,
      allowNull: true,
      comment: "Model answer or marking scheme for short/long questions",
    },
    // Marks for this question
    marks: {
      type: dt.INTEGER,
      defaultValue: 1,
    },
    order: {
      type: dt.INTEGER,
      defaultValue: 0,
      comment: "Order of question in ISO exam",
    },
    // Section identifier
    section: {
      type: dt.ENUM("mcq", "short", "long"),
      allowNull: false,
      defaultValue: "mcq",
      comment: "Which section this question belongs to",
    },
    // For long questions - case study text
    caseStudyText: {
      type: dt.TEXT,
      allowNull: true,
      comment: "Case study text for long questions",
    },
    // Sub-questions for long questions
    subQuestions: {
      type: dt.TEXT,
      allowNull: true,
      defaultValue: "[]",
      comment: "Array of sub-questions for long questions",
      get() {
        const rawValue = this.getDataValue('subQuestions');
        if (!rawValue) return [];
        if (typeof rawValue === 'string') {
          try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            return [];
          }
        }
        return Array.isArray(rawValue) ? rawValue : [];
      },
      set(value) {
        this.setDataValue('subQuestions', JSON.stringify(value || []));
      }
    },
    // Keywords for marking short/long questions
    keywords: {
      type: dt.TEXT,
      allowNull: true,
      defaultValue: "[]",
      comment: "Array of keywords for marking short/long questions",
      get() {
        const rawValue = this.getDataValue('keywords');
        if (!rawValue) return [];
        if (typeof rawValue === 'string') {
          try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            return [];
          }
        }
        return Array.isArray(rawValue) ? rawValue : [];
      },
      set(value) {
        this.setDataValue('keywords', JSON.stringify(value || []));
      }
    },
    // Difficulty level
    difficulty: {
      type: dt.ENUM("easy", "medium", "hard"),
      defaultValue: "medium",
    },
    explanation: {
      type: dt.TEXT,
      allowNull: true,
      comment: "Explanation for the answer (mainly for MCQ)",
    },
  },
  {
    tableName: "iso_questions",
    timestamps: true,
  }
);

module.exports = IsoQuestion;

