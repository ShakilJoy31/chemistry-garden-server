const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const WhatsAppNumber = sequelize.define(
  "whatsapp-number",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    whatsappNumber: {
      type: dt.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isNumeric: true,
        len: [10, 15] // Adjust based on your country's number format
      }
    },
    message: {
      type: dt.TEXT,
      allowNull: true,
      defaultValue: 'Hello! I would like to get more information about ISAB accreditation services.',
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "whatsapp-numbers",
    timestamps: true,
  }
);

module.exports = WhatsAppNumber;