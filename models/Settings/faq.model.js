// models/Settings/faq.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const FAQ = sequelize.define(
  "faq",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    question: {
      type: dt.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    answer: {
      type: dt.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    category: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "General",
    },
    order: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: "faqs",
    timestamps: true,
    indexes: [
      {
        fields: ["isActive"],
      },
      {
        fields: ["category"],
      },
      {
        fields: ["order"],
      },
    ],
  }
);

module.exports = FAQ;