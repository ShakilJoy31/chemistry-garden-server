const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const ModuleExam = sequelize.define(
  "module_exam",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    examCode: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    courseId: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "The module this exam belongs to",
    },
    title: {
      type: dt.STRING,
      allowNull: false,
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    instructions: {
      type: dt.TEXT,
      allowNull: true,
    },
    totalQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    totalMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    passingMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    duration: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "Minutes; null = no time limit",
    },
    isPaid: {
      type: dt.BOOLEAN,
      defaultValue: false,
    },
    examCost: {
      type: dt.DECIMAL(10, 2),
      defaultValue: 0,
    },
    applySet: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "If true, each student gets setQuestionCount random questions",
    },
    setQuestionCount: {
      type: dt.INTEGER,
      allowNull: true,
    },
    allowSubmission: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "Toggle: whether students can currently take this exam",
    },
    status: {
      type: dt.ENUM("draft", "published", "archived"),
      defaultValue: "published",
    },
    createdBy: {
      type: dt.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "module_exams",
    timestamps: true,
    indexes: [{ fields: ["courseId"] }, { fields: ["status"] }],
  }
);

module.exports = ModuleExam;