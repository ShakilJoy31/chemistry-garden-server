const fs = require("fs");
const path = require("path");
const ValuedPartners = require("../../models/Settings/valuedPartners.model");

// Normalize the partners array from any shape
const normalizePartners = (input) => {
  let arr = input;

  if (typeof arr === "string" && arr.trim()) {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = [];
    }
  }

  if (!Array.isArray(arr)) return [];

  return arr
    .filter((p) => p && typeof p === "object" && p.logo)
    .map((p) => ({
      name: (p.name || "").toString().trim(),
      logo: p.logo.toString().trim(),
      logoAlt: p.logoAlt ? p.logoAlt.toString().trim() : null,
      link: p.link ? p.link.toString().trim() : null,
      industry: p.industry ? p.industry.toString().trim() : null,
    }));
};

//! Public — get the active record
const getPublicValuedPartners = async (req, res, next) => {
  try {
    const record = await ValuedPartners.findOne({
      where: { isActive: true },
      order: [["updatedAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: record || null,
    });
  } catch (error) {
    console.error("Error getting public valued partners:", error);
    next(error);
  }
};

//! Admin — get the record (or null)
const getValuedPartners = async (req, res, next) => {
  try {
    const record = await ValuedPartners.findOne({
      order: [["updatedAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: record || null,
    });
  } catch (error) {
    console.error("Error getting valued partners:", error);
    next(error);
  }
};

//! Admin — upsert (create or update single record)
const upsertValuedPartners = async (req, res, next) => {
  try {
    const {
      id,
      eyebrow,
      heading,
      description,
      headerAlignment,
      partners,
      columns,
      logoHeight,
      logoBackgroundColor,
      cardBorderColor,
      logoEffect,
      showIndustryTag,
      backgroundColor,
      headingColor,
      textColor,
      accentColor,
      isActive,
    } = req.body;

    const userEmail = req.user?.email || "system";

    if (!heading || !heading.trim()) {
      return res.status(400).json({
        success: false,
        message: "Heading is required!",
      });
    }

    const normalizedPartners = normalizePartners(partners);

    if (normalizedPartners.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one partner with a logo is required!",
      });
    }

    const data = {
      eyebrow: eyebrow || null,
      heading: heading.trim(),
      description: description || null,
      headerAlignment: headerAlignment === "right" ? "right" : "left",

      partners: normalizedPartners,

      columns:
        columns !== undefined
          ? Math.min(Math.max(parseInt(columns), 2), 6)
          : 3,
      logoHeight:
        logoHeight !== undefined ? Math.max(parseInt(logoHeight), 40) : 90,
      logoBackgroundColor: logoBackgroundColor || "#FFFFFF",
      cardBorderColor: cardBorderColor || "#E2E8F0",
      logoEffect: logoEffect || "none",
      showIndustryTag:
        showIndustryTag !== undefined ? showIndustryTag : false,

      backgroundColor: backgroundColor || "#FFFFFF",
      headingColor: headingColor || "#1D4ED8",
      textColor: textColor || "#5B6B84",
      accentColor: accentColor || "#1D4ED8",

      isActive: isActive !== undefined ? isActive : true,
      updatedBy: userEmail,
    };

    // Find target record: by id if provided, else fall back to singleton
    let existing = null;
    if (id) {
      existing = await ValuedPartners.findOne({ where: { id } });
    }
    if (!existing) {
      existing = await ValuedPartners.findOne({
        order: [["updatedAt", "DESC"]],
      });
    }

    let record;

    if (existing) {
      // Delete old logos no longer referenced
      const oldLogos = Array.isArray(existing.partners)
        ? existing.partners
        : [];
      const newLogosSet = new Set(normalizedPartners.map((p) => p.logo));

      for (const oldPartner of oldLogos) {
        if (oldPartner.logo && !newLogosSet.has(oldPartner.logo)) {
          const oldPath = path.join(
            __dirname,
            "../../../public",
            oldPartner.logo
          );
          if (fs.existsSync(oldPath)) {
            try {
              fs.unlinkSync(oldPath);
            } catch (err) {
              console.error("Error deleting old partner logo:", err);
            }
          }
        }
      }

      existing.set(data);
      await existing.save();
      record = existing;
    } else {
      data.createdBy = userEmail;
      record = await ValuedPartners.create(data);
    }

    return res.status(200).json({
      success: true,
      message: existing
        ? "Valued Partners updated successfully!"
        : "Valued Partners created successfully!",
      data: record,
    });
  } catch (error) {
    console.error("Error upserting valued partners:", error);
    next(error);
  }
};

//! Admin — toggle active status
const updateValuedPartnersStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const userEmail = req.user?.email || "system";

    const record = await ValuedPartners.findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Valued Partners record not found!",
      });
    }

    await ValuedPartners.update(
      { isActive, updatedBy: userEmail },
      { where: { id } }
    );

    const updated = await ValuedPartners.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Status updated successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating valued partners status:", error);
    next(error);
  }
};

//! Admin — delete (removes record + all logo files)
const deleteValuedPartners = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await ValuedPartners.findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Valued Partners record not found!",
      });
    }

    const partnersList = Array.isArray(record.partners) ? record.partners : [];
    for (const p of partnersList) {
      if (p.logo) {
        const fullPath = path.join(__dirname, "../../../public", p.logo);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (err) {
            console.error("Error deleting partner logo:", err);
          }
        }
      }
    }

    await ValuedPartners.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Valued Partners deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting valued partners:", error);
    next(error);
  }
};

module.exports = {
  getPublicValuedPartners,
  getValuedPartners,
  upsertValuedPartners,
  updateValuedPartnersStatus,
  deleteValuedPartners,
};