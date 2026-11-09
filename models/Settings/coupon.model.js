// models/Settings/coupon.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Coupon = sequelize.define(
  "coupon",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    couponCode: {
      type: dt.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 50]
      }
    },
    discountPercentage: {
      type: dt.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 100
      },
      comment: "Discount percentage (0-100)"
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether the coupon is active and can be used"
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
      comment: "Description of the coupon"
    },
  },
  {
    tableName: "coupons",
    timestamps: true,
  }
);

module.exports = Coupon;