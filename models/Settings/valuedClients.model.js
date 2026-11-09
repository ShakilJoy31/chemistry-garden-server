const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const ValuedClients = sequelize.define(
  "valued_clients",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // -------- Header --------
    // Small accent label above the heading (optional)
    eyebrow: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "Trusted by industry leaders",
    },
    heading: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "Our Valued Clients",
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
      defaultValue:
        "We deliver tailor-made consulting, audit, cybersecurity, training, and ISO certification solutions across diverse industries.",
    },

    // -------- Clients List --------
    // Array of { name, logo, logoAlt?, link?, industry? }
    clients: {
      type: dt.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        const raw = this.getDataValue("clients");
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string" && raw.trim()) {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      },
      set(value) {
        if (Array.isArray(value)) {
          this.setDataValue("clients", value);
          return;
        }
        if (typeof value === "string" && value.trim()) {
          try {
            const parsed = JSON.parse(value);
            this.setDataValue("clients", Array.isArray(parsed) ? parsed : []);
            return;
          } catch {
            this.setDataValue("clients", []);
            return;
          }
        }
        this.setDataValue("clients", []);
      },
    },

    // -------- Layout / Behavior --------
    columns: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 4,
      validate: { min: 2, max: 6 },
    },
    logoHeight: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 80, // px
    },
    logoBackgroundColor: {
      type: dt.STRING,
      defaultValue: "#FFFFFF",
    },
    cardBorderColor: {
      type: dt.STRING,
      defaultValue: "#E2E8F0",
    },
    // Filter style for logos (none | grayscale | grayscale-hover)
    logoEffect: {
      type: dt.ENUM("none", "grayscale", "grayscale-hover"),
      defaultValue: "grayscale-hover",
    },
    showIndustryTag: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // -------- Styling --------
    backgroundColor: {
      type: dt.STRING,
      defaultValue: "#FFFFFF",
    },
    headingColor: {
      type: dt.STRING,
      defaultValue: "#1D4ED8",
    },
    textColor: {
      type: dt.STRING,
      defaultValue: "#5B6B84",
    },
    accentColor: {
      type: dt.STRING,
      defaultValue: "#1D4ED8",
    },

    // -------- Status / Meta --------
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
    tableName: "valued_clients",
    timestamps: true,
    indexes: [{ fields: ["isActive"] }],
  }
);

module.exports = ValuedClients;