const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Email = sequelize.define(
  "email",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    appName: {
      type: dt.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    email: {
      type: dt.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    emailAppPassword: {
      type: dt.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [8, 255],
      },
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
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
    tableName: "emails",
    timestamps: true,
    indexes: [
      {
        fields: ["isActive"],
      },
      {
        fields: ["appName"],
      },
    ],
  }
);

module.exports = Email;