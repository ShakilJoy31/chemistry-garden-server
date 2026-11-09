const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const StoreItem = sequelize.define(
  "store_item",
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
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    price: {
      type: dt.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    discountPrice: {
      type: dt.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    category: {
      type: dt.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    documentUrl: {
      type: dt.STRING,
      allowNull: false,
    },
    documentName: {
      type: dt.STRING,
      allowNull: false,
    },
    documentSize: {
      type: dt.INTEGER,
      allowNull: true,
    },
    coverImage: {
      type: dt.STRING,
      allowNull: true,
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    isFeatured: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    downloadCount: {
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
    tableName: "store_items",
    timestamps: true,
    indexes: [
      {
        fields: ["category"],
      },
      {
        fields: ["isActive"],
      },
      {
        fields: ["isFeatured"],
      },
    ],
  }
);

module.exports = StoreItem;