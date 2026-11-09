// models/Course/mocktest.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const MockTest = sequelize.define(
  "mocktest",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    mockTestId: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    title: {
      type: dt.STRING,
      allowNull: false,
    },
    allowSubmission: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "Controls whether students can submit/attend this mock test",
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    courseId: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "ID of the course this mock test belongs to",
    },
    courseName: {
      type: dt.STRING,
      allowNull: true,
      comment: "Course name for quick reference",
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
      comment: "Duration in minutes",
    },
    isPaid: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "Whether this mock test requires payment",
    },
    mockTestCost: {
      type: dt.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
      comment: "Cost of the mock test in BDT",
      validate: {
        min: 0,
      },
    },
    status: {
      type: dt.ENUM("draft", "published", "archived"),
      defaultValue: "published",
    },
    assignedStudents: {
      type: dt.TEXT,
      defaultValue: "[]",
      comment: "Array of student IDs assigned to this mock test",
      get() {
        const rawValue = this.getDataValue("assignedStudents");
        if (!rawValue) return [];
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue);
          } catch (e) {
            return [];
          }
        }
        return rawValue;
      },
      set(value) {
        this.setDataValue("assignedStudents", JSON.stringify(value || []));
      },
    },
    assignedStudentDetails: {
      type: dt.TEXT,
      defaultValue: "[]",
      comment: "Array of student objects with name, ID, etc.",
      get() {
        const rawValue = this.getDataValue("assignedStudentDetails");
        if (!rawValue) return [];
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue);
          } catch (e) {
            return [];
          }
        }
        return rawValue;
      },
      set(value) {
        this.setDataValue(
          "assignedStudentDetails",
          JSON.stringify(value || []),
        );
      },
    },
    instructions: {
      type: dt.TEXT,
      allowNull: true,
    },
    // NEW APPLY SET FIELDS
    applySet: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "If true, each student gets setQuestionCount random questions",
    },
    setQuestionCount: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "Number of random questions each student receives",
    },
    createdBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "ID of admin who created this mock test",
    },
    publishedAt: {
      type: dt.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "mock_tests",
    timestamps: true,
  }
);

module.exports = MockTest;