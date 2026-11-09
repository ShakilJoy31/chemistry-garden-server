const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Chat = sequelize.define(
  "chat",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    userId: {
      type: dt.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      }
    },
    userName: {
      type: dt.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      }
    },
    userEmail: {
      type: dt.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        isEmail: true,
      }
    },
    userPhone: {
      type: dt.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
      }
    },
    messages: {
      type: dt.JSON, // Changed from dt.JSON to dt.JSON
      allowNull: false,
      defaultValue: [],
      // Add getter and setter to ensure proper JSON handling
      get() {
        const value = this.getDataValue('messages');
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (e) {
            return value;
          }
        }
        return value || [];
      },
      set(value) {
        // Ensure value is always an array
        const messages = Array.isArray(value) ? value : [];
        this.setDataValue('messages', messages);
      }
    },
    status: {
      type: dt.ENUM('active', 'resolved', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
    isOnline: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lastActivity: {
      type: dt.DATE,
      allowNull: true,
    },
    unreadCount: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    }
  },
  {
    tableName: "chats",
    timestamps: true,
  }
);

module.exports = Chat;