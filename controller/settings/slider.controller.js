const { Op } = require("sequelize");
const fs = require("fs");
const path = require("path");
const Slider = require("../../models/Settings/slider.model");
const SliderSettings = require("../../models/Settings/sliderSettings.model");

//! Get all sliders (public - only active)
const getPublicSliders = async (req, res, next) => {
  try {
    const sliders = await Slider.findAll({
      where: { isActive: true },
      order: [["order", "ASC"], ["createdAt", "DESC"]],
    });

    // Get global settings
    let settings = await SliderSettings.findOne();
    if (!settings) {
      settings = await SliderSettings.create({});
    }

    return res.status(200).json({
      success: true,
      data: {
        sliders,
        settings: {
          autoPlay: settings.autoPlay,
          showArrows: settings.showArrows,
          showDots: settings.showDots,
          pauseOnHover: settings.pauseOnHover,
          infiniteLoop: settings.infiniteLoop,
          defaultSlideDuration: settings.defaultSlideDuration,
          defaultTransitionSpeed: settings.defaultTransitionSpeed,
          defaultTransitionEffect: settings.defaultTransitionEffect,
          arrowColor: settings.arrowColor,
          arrowBgColor: settings.arrowBgColor,
          dotColor: settings.dotColor,
          activeDotColor: settings.activeDotColor,
          height: settings.height,
          mobileHeight: settings.mobileHeight,
        },
      },
    });
  } catch (error) {
    console.error("Error getting public sliders:", error);
    next(error);
  }
};

//! Get all sliders (admin - with pagination and filters)
const getAllSliders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive,
      sortBy = "order",
      sortOrder = "ASC",
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { subtitle: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Active status filter
    if (isActive !== undefined && isActive !== "undefined" && isActive !== "") {
      whereClause.isActive = isActive === "true";
    }

    const { count, rows } = await Slider.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: offset,
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting all sliders:", error);
    next(error);
  }
};

//! Get slider by ID
const getSliderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const slider = await Slider.findOne({
      where: { id },
    });

    if (!slider) {
      return res.status(404).json({
        success: false,
        message: "Slider not found!",
      });
    }

    return res.status(200).json({
      success: true,
      data: slider,
    });
  } catch (error) {
    console.error("Error getting slider by ID:", error);
    next(error);
  }
};

//! Get slider statistics
const getSliderStats = async (req, res, next) => {
  try {
    const totalSliders = await Slider.count();
    const activeSliders = await Slider.count({ where: { isActive: true } });
    const inactiveSliders = await Slider.count({ where: { isActive: false } });

    return res.status(200).json({
      success: true,
      data: {
        total: totalSliders,
        active: activeSliders,
        inactive: inactiveSliders,
      },
    });
  } catch (error) {
    console.error("Error getting slider stats:", error);
    next(error);
  }
};

//! Upsert slider (create or update)
const upsertSlider = async (req, res, next) => {
  try {
    const {
      sliderId,
      title,
      subtitle,
      description,
      image,
      imageAlt,
      buttonText,
      buttonLink,
      buttonStyle,
      buttonTarget,
      secondaryButtonText,
      secondaryButtonLink,
      secondaryButtonStyle,
      secondaryButtonTarget,
      textPosition,
      textColor,
      overlayColor,
      overlayOpacity,
      slideDuration,
      transitionSpeed,
      transitionEffect,
      order,
      isActive,
    } = req.body;

    const userEmail = req.user?.email || "system";

    // Validate required fields
    if (!title || !image) {
      return res.status(400).json({
        success: false,
        message: "Title and image are required!",
      });
    }

    const sliderData = {
      title,
      subtitle: subtitle || null,
      description: description || null,
      image,
      imageAlt: imageAlt || title,
      buttonText: buttonText || null,
      buttonLink: buttonLink || null,
      buttonStyle: buttonStyle || "primary",
      buttonTarget: buttonTarget || "_self",
      secondaryButtonText: secondaryButtonText || null,
      secondaryButtonLink: secondaryButtonLink || null,
      secondaryButtonStyle: secondaryButtonStyle || "outline",
      secondaryButtonTarget: secondaryButtonTarget || "_self",
      textPosition: textPosition || "left",
      textColor: textColor || "#ffffff",
      overlayColor: overlayColor || "rgba(0, 0, 0, 0.5)",
      overlayOpacity: overlayOpacity !== undefined ? parseInt(overlayOpacity) : 50,
      slideDuration: slideDuration ? parseInt(slideDuration) : 5000,
      transitionSpeed: transitionSpeed ? parseInt(transitionSpeed) : 500,
      transitionEffect: transitionEffect || "fade",
      order: order !== undefined ? parseInt(order) : 0,
      isActive: isActive !== undefined ? isActive : true,
      updatedBy: userEmail,
    };

    let slider;

    if (sliderId) {
      // Update existing slider
      const existingSlider = await Slider.findOne({ where: { id: sliderId } });

      if (!existingSlider) {
        return res.status(404).json({
          success: false,
          message: "Slider not found!",
        });
      }

      // Delete old image if new one is provided
      if (image && existingSlider.image && existingSlider.image !== image) {
        const oldImagePath = path.join(__dirname, "../../../public", existingSlider.image);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error("Error deleting old image:", err);
          }
        }
      }

      await Slider.update(sliderData, { where: { id: sliderId } });
      slider = await Slider.findOne({ where: { id: sliderId } });
    } else {
      // Create new slider
      sliderData.createdBy = userEmail;
      slider = await Slider.create(sliderData);
    }

    return res.status(sliderId ? 200 : 201).json({
      success: true,
      message: sliderId ? "Slider updated successfully!" : "Slider created successfully!",
      data: slider,
    });
  } catch (error) {
    console.error("Error upserting slider:", error);
    next(error);
  }
};

//! Update slider status
const updateSliderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const userEmail = req.user?.email || "system";

    const slider = await Slider.findOne({ where: { id } });

    if (!slider) {
      return res.status(404).json({
        success: false,
        message: "Slider not found!",
      });
    }

    await Slider.update(
      { isActive, updatedBy: userEmail },
      { where: { id } }
    );

    const updatedSlider = await Slider.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Slider status updated successfully!",
      data: updatedSlider,
    });
  } catch (error) {
    console.error("Error updating slider status:", error);
    next(error);
  }
};

//! Reorder sliders
const reorderSliders = async (req, res, next) => {
  try {
    const { orders } = req.body; // Array of { id, order }

    const userEmail = req.user?.email || "system";

    for (const item of orders) {
      await Slider.update(
        { order: item.order, updatedBy: userEmail },
        { where: { id: item.id } }
      );
    }

    const sliders = await Slider.findAll({
      order: [["order", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Sliders reordered successfully!",
      data: sliders,
    });
  } catch (error) {
    console.error("Error reordering sliders:", error);
    next(error);
  }
};

//! Delete slider
const deleteSlider = async (req, res, next) => {
  try {
    const { id } = req.params;

    const slider = await Slider.findOne({ where: { id } });

    if (!slider) {
      return res.status(404).json({
        success: false,
        message: "Slider not found!",
      });
    }

    // Delete associated image file
    if (slider.image) {
      const imagePath = path.join(__dirname, "../../../public", slider.image);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (err) {
          console.error("Error deleting image:", err);
        }
      }
    }

    await Slider.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Slider deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting slider:", error);
    next(error);
  }
};

//! Get slider settings
const getSliderSettings = async (req, res, next) => {
  try {
    let settings = await SliderSettings.findOne();

    if (!settings) {
      settings = await SliderSettings.create({});
    }

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error getting slider settings:", error);
    next(error);
  }
};

//! Update slider settings (upsert)
const updateSliderSettings = async (req, res, next) => {
  try {
    const {
      autoPlay,
      showArrows,
      showDots,
      pauseOnHover,
      infiniteLoop,
      defaultSlideDuration,
      defaultTransitionSpeed,
      defaultTransitionEffect,
      arrowColor,
      arrowBgColor,
      dotColor,
      activeDotColor,
      height,
      mobileHeight,
    } = req.body;

    const userEmail = req.user?.email || "system";

    let settings = await SliderSettings.findOne();

    const settingsData = {
      autoPlay: autoPlay !== undefined ? autoPlay : true,
      showArrows: showArrows !== undefined ? showArrows : true,
      showDots: showDots !== undefined ? showDots : true,
      pauseOnHover: pauseOnHover !== undefined ? pauseOnHover : true,
      infiniteLoop: infiniteLoop !== undefined ? infiniteLoop : true,
      defaultSlideDuration: defaultSlideDuration ? parseInt(defaultSlideDuration) : 5000,
      defaultTransitionSpeed: defaultTransitionSpeed ? parseInt(defaultTransitionSpeed) : 500,
      defaultTransitionEffect: defaultTransitionEffect || "fade",
      arrowColor: arrowColor || "#ffffff",
      arrowBgColor: arrowBgColor || "rgba(0, 0, 0, 0.3)",
      dotColor: dotColor || "#ffffff",
      activeDotColor: activeDotColor || "#f97316",
      height: height || "600px",
      mobileHeight: mobileHeight || "400px",
      updatedBy: userEmail,
    };

    if (settings) {
      await SliderSettings.update(settingsData, { where: { id: settings.id } });
      settings = await SliderSettings.findOne();
    } else {
      settings = await SliderSettings.create(settingsData);
    }

    return res.status(200).json({
      success: true,
      message: "Slider settings updated successfully!",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating slider settings:", error);
    next(error);
  }
};

module.exports = {
  getPublicSliders,
  getAllSliders,
  getSliderById,
  getSliderStats,
  upsertSlider,
  updateSliderStatus,
  reorderSliders,
  deleteSlider,
  getSliderSettings,
  updateSliderSettings,
};