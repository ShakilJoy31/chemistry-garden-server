// models/students/student.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Student = sequelize.define(
  "student",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    // Personal Information
    studentId: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    fullName: {
      type: dt.STRING,
      allowNull: false,
    },
    fatherName: {
      type: dt.STRING,
      allowNull: true,
    },
    motherName: {
      type: dt.STRING,
      allowNull: true,
    },
    dateOfBirth: {
      type: dt.DATEONLY,
      allowNull: true,
    },
    gender: {
      type: dt.ENUM("male", "female", "other"),
      allowNull: false,
      defaultValue: "male",
    },

    // Contact Information
    phoneNo: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    alternativePhoneNo: {
      type: dt.STRING,
      allowNull: true,
    },
    email: {
      type: dt.STRING,
      allowNull: true,
    },

    // NID Information
    nidNo: {
      type: dt.STRING,
      allowNull: true,
      unique: true,
    },
    nidFrontImage: {
      type: dt.STRING,
      allowNull: true,
    },
    nidBackImage: {
      type: dt.STRING,
      allowNull: true,
    },

    // Profile Image
    profileImage: {
      type: dt.STRING,
      allowNull: true,
    },

    // Address Information
    presentAddress: {
      type: dt.TEXT,
      allowNull: true,
    },
    permanentAddress: {
      type: dt.TEXT,
      allowNull: true,
    },
    district: {
      type: dt.STRING,
      allowNull: true,
    },
    upazila: {
      type: dt.STRING,
      allowNull: true,
    },
    postOffice: {
      type: dt.STRING,
      allowNull: true,
    },
    postalCode: {
      type: dt.STRING,
      allowNull: true,
    },

    // Educational Information
    educationLevel: {
      type: dt.ENUM("ssc", "hsc", "diploma", "bachelor", "masters", "other"),
      allowNull: true,
    },
    institutionName: {
      type: dt.STRING,
      allowNull: true,
    },
    passingYear: {
      type: dt.INTEGER,
      allowNull: true,
    },

    // Professional Information
    occupation: {
      type: dt.STRING,
      allowNull: true,
    },
    companyName: {
      type: dt.STRING,
      allowNull: true,
    },
    designation: {
      type: dt.STRING,
      allowNull: true,
    },

    // Course Related Information
    enrolledCourseId: {
      type: dt.INTEGER,
      allowNull: true,
    },
    enrolledCourses: {
      type: dt.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Array of enrolled courses with details",
    },
    enrollmentDate: {
      type: dt.DATE,
      allowNull: true,
    },
    courseCompletionDate: {
      type: dt.DATE,
      allowNull: true,
    },
    certificateIssued: {
      type: dt.BOOLEAN,
      defaultValue: false,
    },
    certificateNumber: {
      type: dt.STRING,
      allowNull: true,
    },
    certificateIssuedDate: {
      type: dt.DATE,
      allowNull: true,
    },

    // Payment Information
    totalFee: {
      type: dt.DECIMAL(10, 2),
      defaultValue: 0,
    },
    paidAmount: {
      type: dt.DECIMAL(10, 2),
      defaultValue: 0,
    },
    dueAmount: {
      type: dt.DECIMAL(10, 2),
      defaultValue: 0,
    },
    paymentStatus: {
      type: dt.ENUM("pending", "partial", "paid"),
      defaultValue: "pending",
    },
    lastPaymentDate: {
      type: dt.DATE,
      allowNull: true,
    },

    // Class Attendance
    totalClasses: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    attendedClasses: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    attendancePercentage: {
      type: dt.DECIMAL(5, 2),
      defaultValue: 0,
    },

    // System Fields
    role: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "student",
    },
    status: {
      type: dt.ENUM("active", "inactive", "suspended", "completed"),
      defaultValue: "active",
    },
    password: {
      type: dt.STRING,
      allowNull: false,
    },
    lastLoginAt: {
      type: dt.DATE,
      allowNull: true,
    },
    registeredBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "ID of the enterprise/admin who registered this student",
    },
    notes: {
      type: dt.TEXT,
      allowNull: true,
    },

    class: {
      type: dt.STRING,
      allowNull: true,
    },
    batch: {
      type: dt.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "students-collections",
    timestamps: true,
  },
);

module.exports = Student;
