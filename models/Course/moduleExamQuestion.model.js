const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const ModuleExamQuestion = sequelize.define(
  "module_exam_question",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    moduleExamId: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "FK to module_exams.id",
    },
    questionText: {
      type: dt.TEXT,
      allowNull: false,
    },
    questionType: {
      type: dt.ENUM("single", "multiple"),
      defaultValue: "single",
    },
    options: {
      type: dt.TEXT,
      allowNull: false,
      defaultValue: "[]",
      comment: "JSON: [{ id, text, isCorrect }]",
      get() {
        const raw = this.getDataValue("options");
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
        this.setDataValue("options", JSON.stringify(value || []));
      },
    },
    correctAnswers: {
      type: dt.TEXT,
      allowNull: false,
      defaultValue: "[]",
      comment: "JSON: array of option ids",
      get() {
        const raw = this.getDataValue("correctAnswers");
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
        this.setDataValue("correctAnswers", JSON.stringify(value || []));
      },
    },
    marks: {
      type: dt.INTEGER,
      defaultValue: 1,
    },
    order: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    explanation: {
      type: dt.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "module_exam_questions",
    timestamps: true,
    indexes: [{ fields: ["moduleExamId"] }],
  }
);

module.exports = ModuleExamQuestion;