const fs = require("fs");
const path = require("path");
const ValuedClients = require("../../models/Settings/valuedClients.model");

// Normalize the clients array from any shape
const normalizeClients = (input) => {
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
    .filter((c) => c && typeof c === "object" && c.logo)
    .map((c) => ({
      name: (c.name || "").toString().trim(),
      logo: c.logo.toString().trim(),
      logoAlt: c.logoAlt ? c.logoAlt.toString().trim() : null,
      link: c.link ? c.link.toString().trim() : null,
      industry: c.industry ? c.industry.toString().trim() : null,
    }));
};

//! Public — get the active record
const getPublicValuedClients = async (req, res, next) => {
  try {
    const record = await ValuedClients.findOne({
      where: { isActive: true },
      order: [["updatedAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: record || null,
    });
  } catch (error) {
    console.error("Error getting public valued clients:", error);
    next(error);
  }
};

//! Admin — get the record (or null)
const getValuedClients = async (req, res, next) => {
  try {
    const record = await ValuedClients.findOne({
      order: [["updatedAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: record || null,
    });
  } catch (error) {
    console.error("Error getting valued clients:", error);
    next(error);
  }
};

//! Admin — upsert (create or update single record)
const upsertValuedClients = async (req, res, next) => {
  try {
    const {
      id,
      eyebrow,
      heading,
      description,
      clients,
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

    const normalizedClients = normalizeClients(clients);

    if (normalizedClients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one client with a logo is required!",
      });
    }

    const data = {
      eyebrow: eyebrow || null,
      heading: heading.trim(),
      description: description || null,

      clients: normalizedClients,

      columns:
        columns !== undefined
          ? Math.min(Math.max(parseInt(columns), 2), 6)
          : 4,
      logoHeight:
        logoHeight !== undefined ? Math.max(parseInt(logoHeight), 40) : 80,
      logoBackgroundColor: logoBackgroundColor || "#FFFFFF",
      cardBorderColor: cardBorderColor || "#E2E8F0",
      logoEffect: logoEffect || "grayscale-hover",
      showIndustryTag:
        showIndustryTag !== undefined ? showIndustryTag : false,

      backgroundColor: backgroundColor || "#FFFFFF",
      headingColor: headingColor || "#1D4ED8",
      textColor: textColor || "#5B6B84",
      accentColor: accentColor || "#1D4ED8",

      isActive: isActive !== undefined ? isActive : true,
      updatedBy: userEmail,
    };

    // -------------------------------------------------------------------------
    // Find the target record:
    //   1. If `id` was sent AND a record exists with that id → use it
    //   2. Otherwise, fall back to the singleton (latest) record
    //   3. Otherwise, we'll create a new one
    // -------------------------------------------------------------------------
    let existing = null;

    if (id) {
      existing = await ValuedClients.findOne({ where: { id } });
    }

    if (!existing) {
      // Singleton fallback — reuse whatever row exists
      existing = await ValuedClients.findOne({
        order: [["updatedAt", "DESC"]],
      });
    }

    let record;

    if (existing) {
      // ------- Delete old logos that are no longer referenced -------
      const oldLogos = Array.isArray(existing.clients)
        ? existing.clients
        : [];
      const newLogosSet = new Set(normalizedClients.map((c) => c.logo));

      for (const oldClient of oldLogos) {
        if (oldClient.logo && !newLogosSet.has(oldClient.logo)) {
          const oldPath = path.join(
            __dirname,
            "../../../public",
            oldClient.logo
          );
          if (fs.existsSync(oldPath)) {
            try {
              fs.unlinkSync(oldPath);
            } catch (err) {
              console.error("Error deleting old logo:", err);
            }
          }
        }
      }

      // ------- Update in place (uses setters — JSON-safe) -------
      existing.set(data);
      await existing.save();
      record = existing;
    } else {
      // ------- Create new -------
      data.createdBy = userEmail;
      record = await ValuedClients.create(data);
    }

    return res.status(200).json({
      success: true,
      message: existing
        ? "Valued Clients updated successfully!"
        : "Valued Clients created successfully!",
      data: record,
    });
  } catch (error) {
    console.error("Error upserting valued clients:", error);
    next(error);
  }
};

//! Admin — toggle active status
const updateValuedClientsStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const userEmail = req.user?.email || "system";

    const record = await ValuedClients.findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Valued Clients record not found!",
      });
    }

    await ValuedClients.update(
      { isActive, updatedBy: userEmail },
      { where: { id } }
    );

    const updated = await ValuedClients.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Status updated successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating valued clients status:", error);
    next(error);
  }
};

//! Admin — delete (removes record + all logo files)
const deleteValuedClients = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await ValuedClients.findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Valued Clients record not found!",
      });
    }

    const clientsList = Array.isArray(record.clients) ? record.clients : [];
    for (const c of clientsList) {
      if (c.logo) {
        const fullPath = path.join(__dirname, "../../../public", c.logo);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (err) {
            console.error("Error deleting logo:", err);
          }
        }
      }
    }

    await ValuedClients.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Valued Clients deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting valued clients:", error);
    next(error);
  }
};

module.exports = {
  getPublicValuedClients,
  getValuedClients,
  upsertValuedClients,
  updateValuedClientsStatus,
  deleteValuedClients,
};