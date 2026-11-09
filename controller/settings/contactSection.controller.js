const fs = require("fs");
const path = require("path");
const ContactSection = require("../../models/Settings/contactSection.model");

// Allowed card types — used to sanitize input
const ALLOWED_CARD_TYPES = ["location", "email", "phone", "custom"];

// Normalize an array of contact cards from any shape
const normalizeCards = (input) => {
  let arr = input;

  // Accept JSON string
  if (typeof arr === "string" && arr.trim()) {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = [];
    }
  }

  if (!Array.isArray(arr)) return [];

  return arr
    .filter((c) => c && typeof c === "object")
    .map((c) => ({
      type: ALLOWED_CARD_TYPES.includes(c.type) ? c.type : "custom",
      title: (c.title || "").toString().trim(),
      value: (c.value || "").toString().trim(), // may contain \n
      link: c.link ? c.link.toString().trim() : null,
      icon: c.icon ? c.icon.toString().trim() : null, // optional image URL
    }))
    .filter((c) => c.title); // must have a title
};

//! Public — get the active record
const getPublicContactSection = async (req, res, next) => {
  try {
    const record = await ContactSection.findOne({
      where: { isActive: true },
      order: [["updatedAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: record || null,
    });
  } catch (error) {
    console.error("Error getting public contact section:", error);
    next(error);
  }
};

//! Admin — get the record (or null)
const getContactSection = async (req, res, next) => {
  try {
    const record = await ContactSection.findOne({
      order: [["updatedAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: record || null,
    });
  } catch (error) {
    console.error("Error getting contact section:", error);
    next(error);
  }
};

//! Admin — upsert (create or update single record)
const upsertContactSection = async (req, res, next) => {
  try {
    const {
      id,
      topBarColor,
      logoImage,
      logoImageAlt,
      logoLink,
      heading,
      tagline,
      subTagline,
      companyName,
      contactCards,
      ctaText,
      ctaLinkText,
      ctaLinkUrl,
      ctaBackgroundColor,
      ctaTextColor,
      ctaLinkColor,
      ctaIconImage,
      copyrightText,
      backgroundColor,
      headingColor,
      textColor,
      mutedTextColor,
      cardBackgroundColor,
      cardBorderColor,
      isActive,
    } = req.body;

    const userEmail = req.user?.email || "system";

    // Required validation
    if (!heading || !heading.trim()) {
      return res.status(400).json({
        success: false,
        message: "Heading is required!",
      });
    }

    const normalizedCards = normalizeCards(contactCards);

    if (normalizedCards.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one contact card is required!",
      });
    }

    const data = {
      topBarColor: topBarColor || "#1D4ED8",
      logoImage: logoImage || null,
      logoImageAlt: logoImageAlt || null,
      logoLink: logoLink || null,

      heading: heading.trim(),
      tagline: tagline || null,
      subTagline: subTagline || null,
      companyName: companyName || null,

      contactCards: normalizedCards,

      ctaText: ctaText || null,
      ctaLinkText: ctaLinkText || null,
      ctaLinkUrl: ctaLinkUrl || null,
      ctaBackgroundColor: ctaBackgroundColor || "#0B1220",
      ctaTextColor: ctaTextColor || "#E5EDFF",
      ctaLinkColor: ctaLinkColor || "#60A5FA",
      ctaIconImage: ctaIconImage || null,

      copyrightText: copyrightText || null,

      backgroundColor: backgroundColor || "#FFFFFF",
      headingColor: headingColor || "#1D4ED8",
      textColor: textColor || "#0B1220",
      mutedTextColor: mutedTextColor || "#5B6B84",
      cardBackgroundColor: cardBackgroundColor || "#F5F8FC",
      cardBorderColor: cardBorderColor || "#E2E8F0",

      isActive: isActive !== undefined ? isActive : true,
      updatedBy: userEmail,
    };

    let record;

    if (id) {
      const existing = await ContactSection.findOne({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Contact section not found!",
        });
      }

      // Delete replaced logo / CTA icon files
      const imageFields = ["logoImage", "ctaIconImage"];
      for (const field of imageFields) {
        const oldVal = existing[field];
        const newVal = data[field];
        if (oldVal && newVal && oldVal !== newVal) {
          const oldPath = path.join(__dirname, "../../../public", oldVal);
          if (fs.existsSync(oldPath)) {
            try {
              fs.unlinkSync(oldPath);
            } catch (err) {
              console.error(`Error deleting old ${field}:`, err);
            }
          }
        }
      }

      await ContactSection.update(data, { where: { id } });
      record = await ContactSection.findOne({ where: { id } });
    } else {
      // Singleton: reuse existing row if present
      const existing = await ContactSection.findOne({
        order: [["updatedAt", "DESC"]],
      });

      if (existing) {
        const imageFields = ["logoImage", "ctaIconImage"];
        for (const field of imageFields) {
          const oldVal = existing[field];
          const newVal = data[field];
          if (oldVal && newVal && oldVal !== newVal) {
            const oldPath = path.join(__dirname, "../../../public", oldVal);
            if (fs.existsSync(oldPath)) {
              try {
                fs.unlinkSync(oldPath);
              } catch (err) {
                console.error(`Error deleting old ${field}:`, err);
              }
            }
          }
        }

        await ContactSection.update(data, { where: { id: existing.id } });
        record = await ContactSection.findOne({ where: { id: existing.id } });
      } else {
        data.createdBy = userEmail;
        record = await ContactSection.create(data);
      }
    }

    return res.status(id ? 200 : 201).json({
      success: true,
      message: id
        ? "Contact section updated successfully!"
        : "Contact section created successfully!",
      data: record,
    });
  } catch (error) {
    console.error("Error upserting contact section:", error);
    next(error);
  }
};

//! Admin — toggle active status
const updateContactSectionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const userEmail = req.user?.email || "system";

    const record = await ContactSection.findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Contact section not found!",
      });
    }

    await ContactSection.update(
      { isActive, updatedBy: userEmail },
      { where: { id } }
    );

    const updated = await ContactSection.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Status updated successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating contact status:", error);
    next(error);
  }
};

//! Admin — delete (also removes associated images)
const deleteContactSection = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await ContactSection.findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Contact section not found!",
      });
    }

    const imageFields = ["logoImage", "ctaIconImage"];
    for (const field of imageFields) {
      const val = record[field];
      if (val) {
        const fullPath = path.join(__dirname, "../../../public", val);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (err) {
            console.error(`Error deleting ${field}:`, err);
          }
        }
      }
    }

    await ContactSection.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Contact section deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting contact section:", error);
    next(error);
  }
};

module.exports = {
  getPublicContactSection,
  getContactSection,
  upsertContactSection,
  updateContactSectionStatus,
  deleteContactSection,
};