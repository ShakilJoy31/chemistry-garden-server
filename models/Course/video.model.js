const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Video = sequelize.define(
  "video",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    courseId: {
      type: dt.INTEGER,
      allowNull: false,
    },
    title: {
      type: dt.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    videoUrl: {
      type: dt.STRING,
      allowNull: false,
    },
    videoName: {
      type: dt.STRING,
      allowNull: true,
    },
    videoSize: {
      type: dt.INTEGER,
      allowNull: true,
    },
    thumbnail: {
      type: dt.STRING,
      allowNull: true,
    },
    duration: {
      type: dt.INTEGER,
      allowNull: true,
    },
    order: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isFree: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    viewCount: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    tableName: "videos",
    timestamps: true,
    indexes: [
      { fields: ["courseId"] },
      { fields: ["isActive"] },
    ],
  }
);

module.exports = Video;