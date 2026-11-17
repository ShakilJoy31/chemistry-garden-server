const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Class = sequelize.define(
  "class",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
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
    tableName: "classes",
    timestamps: true,
    indexes: [
      {
        fields: ["isActive"],
      },
    ],
  }
);

module.exports = Class;