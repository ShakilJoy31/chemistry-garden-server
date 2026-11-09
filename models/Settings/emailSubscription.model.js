const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const EmailSubscription = sequelize.define(
  "email-subscription",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    email: {
      type: dt.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isEmail: true,
      }
    },
    isSubscribed: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    subscribedAt: {
      type: dt.DATE,
      allowNull: false,
      defaultValue: dt.NOW,
    },
    unsubscribedAt: {
      type: dt.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "email-subscriptions",
    timestamps: true,
  }
);

module.exports = EmailSubscription;