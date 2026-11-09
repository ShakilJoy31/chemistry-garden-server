const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const ValuedPartners = sequelize.define(
  "valued_partners",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    }, 

    // -------- Header --------
    eyebrow: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "Trusted by industry leaders",
    },
    heading: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "Our Valued Partners",
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
      defaultValue:
        "We deliver tailor-made consulting, audit, cybersecurity, training, and ISO certification solutions across diverse industries.",
    },

    // Header alignment — 'left' | 'right'
    headerAlignment: {
      type: dt.ENUM("left", "right"),
      defaultValue: "left",
      allowNull: false,
    },

    // -------- Partners List --------
    // Array of { name, logo, logoAlt?, link?, industry? }
    partners: {
      type: dt.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        const raw = this.getDataValue("partners");
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
          this.setDataValue("partners", value);
          return;
        }
        if (typeof value === "string" && value.trim()) {
          try {
            const parsed = JSON.parse(value);
            this.setDataValue("partners", Array.isArray(parsed) ? parsed : []);
            return;
          } catch {
            this.setDataValue("partners", []);
            return;
          }
        }
        this.setDataValue("partners", []);
      },
    },

    // -------- Layout / Behavior --------
    columns: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 3,
      validate: { min: 2, max: 6 },
    },
    logoHeight: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 90,
    },
    logoBackgroundColor: {
      type: dt.STRING,
      defaultValue: "#FFFFFF",
    },
    cardBorderColor: {
      type: dt.STRING,
      defaultValue: "#E2E8F0",
    },
    logoEffect: {
      type: dt.ENUM("none", "grayscale", "grayscale-hover"),
      defaultValue: "none",
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
    tableName: "valued_partners",
    timestamps: true,
    indexes: [{ fields: ["isActive"] }],
  }
);

module.exports = ValuedPartners;