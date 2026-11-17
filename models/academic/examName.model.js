const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const ExamName = sequelize.define(
  "exam_name",
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
    passMark: {
      type: dt.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    totalMark: {
      type: dt.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 100,
      validate: {
        min: 0,
      },
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
    tableName: "exam_names",
    timestamps: true,
    indexes: [
      {
        fields: ["isActive"],
      },
    ],
  }
);

module.exports = ExamName;