const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const PublicSms = sequelize.define(
  "public-sms",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    name: {
      type: dt.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      }
    },
    email: {
      type: dt.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        isEmail: true,
      }
    },
    phone: {
      type: dt.STRING(20),
      allowNull: true,
    },
    country: {
      type: dt.STRING(100),
      allowNull: true,
    },
    subject: {
      type: dt.STRING(255),
      allowNull: true,
    },
    message: {
      type: dt.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      }
    },
    isRead: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isReplied: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    repliedAt: {
      type: dt.DATE,
      allowNull: true,
    },
    replyMessage: {
      type: dt.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "public-sms",
    timestamps: true,
  }
);

module.exports = PublicSms;