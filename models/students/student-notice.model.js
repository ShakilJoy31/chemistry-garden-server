// models/notice/student-notice.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const StudentNotice = sequelize.define(
  "studentNotice",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },

    title: {
      type: dt.STRING,
      allowNull: false,
    },
    description: {
      type: dt.TEXT,
      allowNull: false,
    },

    // ─── Targeting ───
    // class & batch are stored as STRINGS because the Student model stores
    // them as strings too (student.class / student.batch). This keeps
    // filtering trivial: WHERE class = '...' AND batch = '...'.
    // When the admin selects "Everyone", both are null.
    class: {
      type: dt.STRING,
      allowNull: true,
    },
    batch: {
      type: dt.STRING,
      allowNull: true,
    },

    // Snapshot of recipients at publish time.
    // [
    //   { studentId: 12, studentCode: "ChGr-2025-00012",
    //     fullName: "Rahim", phoneNo: "017...",
    //     seen: false, seenAt: null }
    // ]
    students: {
      type: dt.JSON,
      allowNull: true,
      defaultValue: [],
    },

    recipientCount: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    seenCount: {
      type: dt.INTEGER,
      defaultValue: 0,
    },

    // ─── SMS ───
    sendSms: {
      type: dt.BOOLEAN,
      defaultValue: false,
    },
    smsTemplate: {
      type: dt.TEXT,
      allowNull: true,
    },
    smsSummary: {
      type: dt.JSON,
      allowNull: true,
      // { queued, sent, failed, skipped, errors: [] }
    },

    isActive: {
      type: dt.BOOLEAN,
      defaultValue: true,
    },

    // ─── Audit ───
    createdBy: {
      type: dt.STRING,
      allowNull: true,
    },
    updatedBy: {
      type: dt.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "student-notices",
    timestamps: true,
  }
);

module.exports = StudentNotice;