const { Op } = require("sequelize");
const Year = require("../../models/academic/year.model");


//! Get all years with pagination and filters
const getAllYears = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isActive !== undefined && isActive !== "undefined" && isActive !== "") {
      whereClause.isActive = isActive === "true";
    }

    const { count, rows } = await Year.findAndCountAll({
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
    console.error("Error getting years:", error);
    next(error);
  }
};

//! Get year by ID
const getYearById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Year.findOne({ where: { id } });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Year not found!",
      });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Error getting year by ID:", error);
    next(error);
  }
};

//! Get year statistics
const getYearStats = async (req, res, next) => {
  try {
    const totalItems = await Year.count();
    const activeItems = await Year.count({ where: { isActive: true } });
    const inactiveItems = await Year.count({ where: { isActive: false } });

    return res.status(200).json({
      success: true,
      data: { totalItems, activeItems, inactiveItems },
    });
  } catch (error) {
    console.error("Error getting year stats:", error);
    next(error);
  }
};

//! Create new year
const createYear = async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Name is required!",
      });
    }

    const existing = await Year.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Year with this name already exists!",
      });
    }

    const newItem = await Year.create({
      name: name.trim(),
      description: description || "",
      isActive: isActive !== undefined ? isActive : true,
      createdBy: userEmail,
      updatedBy: userEmail,
    });

    return res.status(201).json({
      success: true,
      message: "Year created successfully!",
      data: newItem,
    });
  } catch (error) {
    console.error("Error creating year:", error);
    next(error);
  }
};

//! Update year
const updateYear = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    const existingItem = await Year.findOne({ where: { id } });
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Year not found!",
      });
    }

    if (name !== undefined && name.trim() !== existingItem.name) {
      const duplicate = await Year.findOne({ where: { name: name.trim() } });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Year with this name already exists!",
        });
      }
    }

    const updateData = { updatedBy: userEmail };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    await Year.update(updateData, { where: { id } });
    const updatedItem = await Year.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Year updated successfully!",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Error updating year:", error);
    next(error);
  }
};

//! Delete year
const deleteYear = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Year.findOne({ where: { id } });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Year not found!",
      });
    }

    await Year.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Year deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting year:", error);
    next(error);
  }
};

//! Get active years (for dropdowns)
const getActiveYears = async (req, res, next) => {
  try {
    const items = await Year.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
    });

    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("Error getting active years:", error);
    next(error);
  }
};

module.exports = {
  getAllYears,
  getYearById,
  getYearStats,
  createYear,
  updateYear,
  deleteYear,
  getActiveYears,
};