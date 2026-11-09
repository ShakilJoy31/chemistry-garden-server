// models/service/sub-service-detail.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const SubServiceDetail = sequelize.define(
  "sub_service_detail",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    subServiceId: {
      type: dt.INTEGER,
      allowNull: false,
      unique: true,
      comment: "One-to-one with sub_services.id",
    },

    /* ================= HERO ================= */
    heroBadge: { type: dt.STRING, allowNull: true },
    heroTitle: { type: dt.STRING, allowNull: true },
    heroSubtitle: { type: dt.TEXT, allowNull: true },
    heroPrimaryBtnText: { type: dt.STRING, allowNull: true },
    heroPrimaryBtnLink: { type: dt.STRING, allowNull: true },
    heroSecondaryBtnText: { type: dt.STRING, allowNull: true },
    heroSecondaryBtnLink: { type: dt.STRING, allowNull: true },

    /* ================= AT A GLANCE (JSON) ================= */
    // [{ label: "Standard Code", value: "ISO/IEC 27001:2022" }, ...]
    atAGlance: { type: dt.JSON, allowNull: false, defaultValue: [] },

    /* ================= OVERVIEW ================= */
    overviewBadge: { type: dt.STRING, allowNull: true },
    overviewTitle: { type: dt.STRING, allowNull: true },
    overviewBody: { type: dt.TEXT, allowNull: true },

    /* ================= WHO NEEDS IT (JSON) ================= */
    // [{ icon: "💻", title: "...", description: "..." }, ...]
    whoNeedsIt: { type: dt.JSON, allowNull: false, defaultValue: [] },

    /* ================= PROCESS (JSON) ================= */
    // [{ step: "Step 01", title: "...", description: "..." }, ...]
    processSteps: { type: dt.JSON, allowNull: false, defaultValue: [] },

    /* ================= DELIVERABLES (JSON) ================= */
    // [{ icon: "📋", title: "...", description: "..." }, ...]
    deliverables: { type: dt.JSON, allowNull: false, defaultValue: [] },

    /* ================= BENEFITS (JSON) ================= */
    // [{ icon: "🌍", title: "...", description: "..." }, ...]
    benefits: { type: dt.JSON, allowNull: false, defaultValue: [] },

    /* ================= FAQ (JSON) ================= */
    // [{ question: "...", answer: "..." }, ...]
    faqs: { type: dt.JSON, allowNull: false, defaultValue: [] },

    /* ================= BOTTOM CTA ================= */
    ctaTitle: { type: dt.STRING, allowNull: true },
    ctaSubtitle: { type: dt.TEXT, allowNull: true },
    ctaPrimaryBtnText: { type: dt.STRING, allowNull: true },
    ctaPrimaryBtnLink: { type: dt.STRING, allowNull: true },
    ctaSecondaryBtnText: { type: dt.STRING, allowNull: true },
    ctaSecondaryBtnLink: { type: dt.STRING, allowNull: true },

    /* ================= STATUS ================= */
    isPublished: { type: dt.BOOLEAN, defaultValue: false },
    createdBy: { type: dt.INTEGER, allowNull: true },
    updatedBy: { type: dt.INTEGER, allowNull: true },
  },
  {
    tableName: "sub_service_details",
    timestamps: true,
    indexes: [
      { fields: ["subServiceId"], unique: true },
      { fields: ["isPublished"] },
    ],
  }
);

module.exports = SubServiceDetail;