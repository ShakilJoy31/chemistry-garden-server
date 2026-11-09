// models/otp.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const OTP = sequelize.define(
  "otp",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: dt.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    otp: {
      type: dt.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [5, 5],
      },
    },
    expiresAt: {
      type: dt.DATE,
      allowNull: false,
    },
    isUsed: {
      type: dt.BOOLEAN,
      defaultValue: false,
    },
    attemptCount: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    type: {
      type: dt.ENUM('registration', 'password_reset'),
      defaultValue: 'registration',
      allowNull: false,
    },
  },
  {
    tableName: "otps",
    timestamps: true,
    indexes: [
      {
        fields: ["email", "otp"],
      },
      {
        fields: ["expiresAt"],
      },
      {
        fields: ["type"], // Add index for type
      },
      {
        fields: ["email", "type"], // Composite index for faster queries
      },
    ],
  }
);

module.exports = OTP;