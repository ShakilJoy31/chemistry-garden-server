const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Slider = sequelize.define(
  "slider",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: dt.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    subtitle: {
      type: dt.STRING,
      allowNull: true,
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    image: {
      type: dt.STRING,
      allowNull: false,
    },
    imageAlt: {
      type: dt.STRING,
      allowNull: true,
    },
    // Button configuration
    buttonText: {
      type: dt.STRING,
      allowNull: true,
    },
    buttonLink: {
      type: dt.STRING,
      allowNull: true,
    },
    buttonStyle: {
      type: dt.ENUM("primary", "secondary", "outline", "ghost"),
      defaultValue: "primary",
    },
    buttonTarget: {
      type: dt.ENUM("_self", "_blank"),
      defaultValue: "_self",
    },
    // Secondary button (optional)
    secondaryButtonText: {
      type: dt.STRING,
      allowNull: true,
    },
    secondaryButtonLink: {
      type: dt.STRING,
      allowNull: true,
    },
    secondaryButtonStyle: {
      type: dt.ENUM("primary", "secondary", "outline", "ghost"),
      defaultValue: "outline",
    },
    secondaryButtonTarget: {
      type: dt.ENUM("_self", "_blank"),
      defaultValue: "_self",
    },
    // Styling options
    textPosition: {
      type: dt.ENUM("left", "center", "right"),
      defaultValue: "left",
    },
    textColor: {
      type: dt.STRING,
      defaultValue: "#ffffff",
    },
    overlayColor: {
      type: dt.STRING,
      defaultValue: "rgba(0, 0, 0, 0.5)",
    },
    overlayOpacity: {
      type: dt.INTEGER,
      defaultValue: 50,
      validate: {
        min: 0,
        max: 100,
      },
    },
    // Slider behavior
    slideDuration: {
      type: dt.INTEGER,
      defaultValue: 5000, // milliseconds
      comment: "Duration each slide is shown in milliseconds",
    },
    transitionSpeed: {
      type: dt.INTEGER,
      defaultValue: 500, // milliseconds
      comment: "Transition animation speed in milliseconds",
    },
    transitionEffect: {
      type: dt.ENUM("fade", "slide", "zoom", "slide-up", "slide-down"),
      defaultValue: "fade",
    },
    // Order and status
    order: {
      type: dt.INTEGER,
      defaultValue: 0,
    },
    isActive: {
      type: dt.BOOLEAN,
      defaultValue: true,
    },
    // Metadata
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
    tableName: "sliders",
    timestamps: true,
    indexes: [
      {
        fields: ["isActive"],
      },
      {
        fields: ["order"],
      },
    ],
  }
);

module.exports = Slider;