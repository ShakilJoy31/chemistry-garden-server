const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const SliderSettings = sequelize.define(
  "slider_settings",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Global slider settings
    autoPlay: {
      type: dt.BOOLEAN,
      defaultValue: true,
    },
    showArrows: {
      type: dt.BOOLEAN,
      defaultValue: true,
    },
    showDots: {
      type: dt.BOOLEAN,
      defaultValue: true,
    },
    pauseOnHover: {
      type: dt.BOOLEAN,
      defaultValue: true,
    },
    infiniteLoop: {
      type: dt.BOOLEAN,
      defaultValue: true,
    },
    defaultSlideDuration: {
      type: dt.INTEGER,
      defaultValue: 5000,
    },
    defaultTransitionSpeed: {
      type: dt.INTEGER,
      defaultValue: 500,
    },
    defaultTransitionEffect: {
      type: dt.ENUM("fade", "slide", "zoom", "slide-up", "slide-down"),
      defaultValue: "fade",
    },
    // Arrow styling
    arrowColor: {
      type: dt.STRING,
      defaultValue: "#ffffff",
    },
    arrowBgColor: {
      type: dt.STRING,
      defaultValue: "rgba(0, 0, 0, 0.3)",
    },
    // Dots styling
    dotColor: {
      type: dt.STRING,
      defaultValue: "#ffffff",
    },
    activeDotColor: {
      type: dt.STRING,
      defaultValue: "#f97316",
    },
    // Height settings
    height: {
      type: dt.STRING,
      defaultValue: "600px",
    },
    mobileHeight: {
      type: dt.STRING,
      defaultValue: "400px",
    },
    updatedBy: {
      type: dt.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "slider_settings",
    timestamps: true,
  }
);

module.exports = SliderSettings;