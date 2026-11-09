// models/Course/isoexam.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const IsoExam = sequelize.define(
  "isoexam",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    isoExamId: {
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
      comment: "Controls whether students can submit/attend this ISO exam",
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    courseId: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "ID of the course this ISO exam belongs to",
    },
    courseName: {
      type: dt.STRING,
      allowNull: true,
      comment: "Course name for quick reference",
    },
    // Section counts
    totalMcqQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    totalShortQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    totalLongQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    totalQuestions: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    totalMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    mcqMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
      comment: "Total marks from MCQ section",
    },
    shortMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
      comment: "Total marks from short questions section",
    },
    longMarks: {
      type: dt.INTEGER,
      defaultValue: 0,
      comment: "Total marks from long questions section",
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
      comment: "Whether this ISO exam requires payment",
    },
    isoExamCost: {
      type: dt.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
      comment: "Cost of the ISO exam in BDT",
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
      comment: "Array of student IDs assigned to this ISO exam",
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
          JSON.stringify(value || [])
        );
      },
    },
    instructions: {
      type: dt.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "ID of admin who created this ISO exam",
    },
    publishedAt: {
      type: dt.DATE,
      allowNull: true,
    },

        instructions: {
      type: dt.TEXT,
      allowNull: true,
    },
    // ===== APPLY SET (per section) =====
    applyMcqSet: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "If true, each student gets mcqSetCount random MCQs",
    },
    mcqSetCount: { type: dt.INTEGER, allowNull: true },
    applyShortSet: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "If true, each student gets shortSetCount random short questions",
    },
    shortSetCount: { type: dt.INTEGER, allowNull: true },
    applyLongSet: {
      type: dt.BOOLEAN,
      defaultValue: false,
      comment: "If true, each student gets longSetCount random long questions",
    },
    longSetCount: { type: dt.INTEGER, allowNull: true },

    
  },
  {
    tableName: "iso_exams",
    timestamps: true,
  }
);

module.exports = IsoExam;