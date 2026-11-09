const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const VisionMission = sequelize.define(
  "vision_mission",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Section heading (e.g. "Vision, Mission & Core Values")
    sectionTitle: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "Vision, Mission & Core Values",
    },
    sectionSubtitle: {
      type: dt.TEXT,
      allowNull: true,
    },
    // Optional section-level image (background or side illustration)
    sectionImage: {
      type: dt.STRING,
      allowNull: true,
    },
    sectionImageAlt: {
      type: dt.STRING,
      allowNull: true,
    },

    // -------- Vision --------
    visionTitle: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "Vision",
    },
    visionDescription: {
      type: dt.TEXT,
      allowNull: false,
    },
    visionImage: {
      type: dt.STRING,
      allowNull: true,
    },
    visionImageAlt: {
      type: dt.STRING,
      allowNull: true,
    },

    // -------- Mission --------
    missionTitle: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "Mission",
    },
    missionDescription: {
      type: dt.TEXT,
      allowNull: false,
    },
    missionImage: {
      type: dt.STRING,
      allowNull: true,
    },
    missionImageAlt: {
      type: dt.STRING,
      allowNull: true,
    },

    // -------- Core Values --------
    coreValuesTitle: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "Core Values",
    },
    coreValuesDescription: {
      type: dt.TEXT,
      allowNull: true,
    },
    // Array of { title, description?, icon? }
// Array of { title, description?, icon? }
coreValues: {
  type: dt.JSON,
  allowNull: false,
  defaultValue: [],
  // Always return a real array, even if the driver returns a JSON string.
  get() {
    const raw = this.getDataValue("coreValues");
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
  // Accept arrays, JSON strings, or anything else — always store as an array.
  set(value) {
    if (Array.isArray(value)) {
      this.setDataValue("coreValues", value);
      return;
    }
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        this.setDataValue(
          "coreValues",
          Array.isArray(parsed) ? parsed : []
        );
        return;
      } catch {
        this.setDataValue("coreValues", []);
        return;
      }
    }
    this.setDataValue("coreValues", []);
  },
},

    // -------- Styling --------
    textPosition: {
      type: dt.ENUM("left", "center", "right"),
      defaultValue: "left",
    },
    textColor: {
      type: dt.STRING,
      defaultValue: "#0B1220",
    },
    accentColor: {
      type: dt.STRING,
      defaultValue: "#1D4ED8",
    },
    backgroundColor: {
      type: dt.STRING,
      defaultValue: "#F5F8FC",
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
    tableName: "vision_mission",
    timestamps: true,
    indexes: [
      { fields: ["isActive"] },
    ],
  }
);

module.exports = VisionMission;