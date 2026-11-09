const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const ContactSection = sequelize.define(
  "contact_section",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // -------- Top strip / brand bar --------
    topBarColor: {
      type: dt.STRING,
      defaultValue: "#1D4ED8",
    },
    // Logo shown top-right (image URL)
    logoImage: {
      type: dt.STRING,
      allowNull: true,
    },
    logoImageAlt: {
      type: dt.STRING,
      allowNull: true,
    },
    // Optional logo link (click target)
    logoLink: {
      type: dt.STRING,
      allowNull: true,
    },

    // -------- Header --------
    heading: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "GET IN TOUCH",
    },
    tagline: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "Audit. Comply. Train. Certification globally",
    },
    subTagline: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "with",
    },
    companyName: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "M/S. FIT INFOTECH",
    },

    // -------- Contact Cards (array of 3 or more) --------
    // Each item: { type: 'location'|'email'|'phone'|'custom', title, value, link, icon }
    // value may contain \n for multi-line addresses
    contactCards: {
      type: dt.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        const raw = this.getDataValue("contactCards");
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
          this.setDataValue("contactCards", value);
          return;
        }
        if (typeof value === "string" && value.trim()) {
          try {
            const parsed = JSON.parse(value);
            this.setDataValue(
              "contactCards",
              Array.isArray(parsed) ? parsed : []
            );
            return;
          } catch {
            this.setDataValue("contactCards", []);
            return;
          }
        }
        this.setDataValue("contactCards", []);
      },
    },

    // -------- CTA Banner --------
    ctaText: {
      type: dt.STRING,
      allowNull: true,
      defaultValue:
        "To explore our cybersecurity auditing & GRC compliance services, visit:",
    },
    ctaLinkText: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "www.fitinfotech.net",
    },
    ctaLinkUrl: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "https://www.fitinfotech.net",
    },
    ctaBackgroundColor: {
      type: dt.STRING,
      defaultValue: "#0B1220",
    },
    ctaTextColor: {
      type: dt.STRING,
      defaultValue: "#E5EDFF",
    },
    ctaLinkColor: {
      type: dt.STRING,
      defaultValue: "#60A5FA",
    },
    // Icon shown on the right of the CTA (image URL — optional)
    ctaIconImage: {
      type: dt.STRING,
      allowNull: true,
    },

    // -------- Footer --------
    copyrightText: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "Copyright © 2026 FIT INFOTECH. All rights reserved.",
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
      defaultValue: "#0B1220",
    },
    mutedTextColor: {
      type: dt.STRING,
      defaultValue: "#5B6B84",
    },
    cardBackgroundColor: {
      type: dt.STRING,
      defaultValue: "#F5F8FC",
    },
    cardBorderColor: {
      type: dt.STRING,
      defaultValue: "#E2E8F0",
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
    tableName: "contact_section",
    timestamps: true,
    indexes: [{ fields: ["isActive"] }],
  }
);

module.exports = ContactSection;