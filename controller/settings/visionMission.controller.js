const fs = require("fs");
const path = require("path");
const VisionMission = require("../../models/Settings/visionMission.model");

//! Public — get the active vision/mission record
const getPublicVisionMission = async (req, res, next) => {
  try {
    let record = await VisionMission.findOne({
      where: { isActive: true },
      order: [["updatedAt", "DESC"]],
    });

    // If none exists, return empty structure so frontend can handle gracefully
    if (!record) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Error getting public vision/mission:", error);
    next(error);
  }
};

//! Admin — get the record (or null)
const getVisionMission = async (req, res, next) => {
  try {
    const record = await VisionMission.findOne({
      order: [["updatedAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: record || null,
    });
  } catch (error) {
    console.error("Error getting vision/mission:", error);
    next(error);
  }
};

//! Admin — upsert (create or update the single record)
const upsertVisionMission = async (req, res, next) => {
  try {
    const {
      id,
      sectionTitle,
      sectionSubtitle,
      sectionImage,
      sectionImageAlt,
      visionTitle,
      visionDescription,
      visionImage,
      visionImageAlt,
      missionTitle,
      missionDescription,
      missionImage,
      missionImageAlt,
      coreValuesTitle,
      coreValuesDescription,
      coreValues,
      textPosition,
      textColor,
      accentColor,
      backgroundColor,
      isActive,
    } = req.body;

    const userEmail = req.user?.email || "system";

    // Validate required fields
    if (!visionDescription || !missionDescription) {
      return res.status(400).json({
        success: false,
        message: "Vision description and Mission description are required!",
      });
    }

    // Normalize coreValues — must be an array of { title, description?, icon? }
    let normalizedCoreValues = [];
    if (Array.isArray(coreValues)) {
      normalizedCoreValues = coreValues
        .filter((v) => v && typeof v.title === "string" && v.title.trim())
        .map((v) => ({
          title: v.title.trim(),
          description: (v.description || "").trim() || null,
          icon: v.icon || null,
        }));
    }

    const data = {
      sectionTitle: sectionTitle || "Vision, Mission & Core Values",
      sectionSubtitle: sectionSubtitle || null,
      sectionImage: sectionImage || null,
      sectionImageAlt: sectionImageAlt || null,

      visionTitle: visionTitle || "Vision",
      visionDescription,
      visionImage: visionImage || null,
      visionImageAlt: visionImageAlt || null,

      missionTitle: missionTitle || "Mission",
      missionDescription,
      missionImage: missionImage || null,
      missionImageAlt: missionImageAlt || null,

      coreValuesTitle: coreValuesTitle || "Core Values",
      coreValuesDescription: coreValuesDescription || null,
      coreValues: normalizedCoreValues,

      textPosition: textPosition || "left",
      textColor: textColor || "#0B1220",
      accentColor: accentColor || "#1D4ED8",
      backgroundColor: backgroundColor || "#F5F8FC",
      isActive: isActive !== undefined ? isActive : true,
      updatedBy: userEmail,
    };

    let record;

    if (id) {
      // Update existing
      const existing = await VisionMission.findOne({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Vision/Mission record not found!",
        });
      }

      // Delete old images if replaced
      const imageFields = [
        "sectionImage",
        "visionImage",
        "missionImage",
      ];
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

      await VisionMission.update(data, { where: { id } });
      record = await VisionMission.findOne({ where: { id } });
    } else {
      // Upsert by singleton — reuse the first row if one exists
      const existing = await VisionMission.findOne({
        order: [["updatedAt", "DESC"]],
      });

      if (existing) {
        // Delete old replaced images
        const imageFields = ["sectionImage", "visionImage", "missionImage"];
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

        await VisionMission.update(data, { where: { id: existing.id } });
        record = await VisionMission.findOne({ where: { id: existing.id } });
      } else {
        data.createdBy = userEmail;
        record = await VisionMission.create(data);
      }
    }

    return res.status(id ? 200 : 201).json({
      success: true,
      message: id
        ? "Vision/Mission updated successfully!"
        : "Vision/Mission created successfully!",
      data: record,
    });
  } catch (error) {
    console.error("Error upserting vision/mission:", error);
    next(error);
  }
};

//! Admin — update active status
const updateVisionMissionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const userEmail = req.user?.email || "system";

    const record = await VisionMission.findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Vision/Mission record not found!",
      });
    }

    await VisionMission.update(
      { isActive, updatedBy: userEmail },
      { where: { id } }
    );

    const updated = await VisionMission.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Status updated successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating vision/mission status:", error);
    next(error);
  }
};

//! Admin — delete (also removes associated images)
const deleteVisionMission = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await VisionMission.findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Vision/Mission record not found!",
      });
    }

    // Delete images
    const imageFields = ["sectionImage", "visionImage", "missionImage"];
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

    await VisionMission.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Vision/Mission deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting vision/mission:", error);
    next(error);
  }
};

module.exports = {
  getPublicVisionMission,
  getVisionMission,
  upsertVisionMission,
  updateVisionMissionStatus,
  deleteVisionMission,
};