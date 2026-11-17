const { Op } = require("sequelize");
const Class = require("../../models/academic/class.model");


//! Get all classes with pagination and filters
const getAllClasses = async (req, res, next) => {
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

    const { count, rows } = await Class.findAndCountAll({
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
    console.error("Error getting classes:", error);
    next(error);
  }
};

//! Get class by ID
const getClassById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Class.findOne({ where: { id } });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Class not found!",
      });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Error getting class by ID:", error);
    next(error);
  }
};

//! Get class statistics
const getClassStats = async (req, res, next) => {
  try {
    const totalItems = await Class.count();
    const activeItems = await Class.count({ where: { isActive: true } });
    const inactiveItems = await Class.count({ where: { isActive: false } });

    return res.status(200).json({
      success: true,
      data: { totalItems, activeItems, inactiveItems },
    });
  } catch (error) {
    console.error("Error getting class stats:", error);
    next(error);
  }
};

//! Create new class
const createClass = async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Name is required!",
      });
    }

    // Check for duplicate name
    const existing = await Class.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Class with this name already exists!",
      });
    }

    const newItem = await Class.create({
      name: name.trim(),
      description: description || "",
      isActive: isActive !== undefined ? isActive : true,
      createdBy: userEmail,
      updatedBy: userEmail,
    });

    return res.status(201).json({
      success: true,
      message: "Class created successfully!",
      data: newItem,
    });
  } catch (error) {
    console.error("Error creating class:", error);
    next(error);
  }
};

//! Update class
const updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    const existingItem = await Class.findOne({ where: { id } });
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Class not found!",
      });
    }

    // Duplicate name check (only if name changing)
    if (name !== undefined && name.trim() !== existingItem.name) {
      const duplicate = await Class.findOne({ where: { name: name.trim() } });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Class with this name already exists!",
        });
      }
    }

    const updateData = { updatedBy: userEmail };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    await Class.update(updateData, { where: { id } });
    const updatedItem = await Class.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Class updated successfully!",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Error updating class:", error);
    next(error);
  }
};

//! Delete class
const deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Class.findOne({ where: { id } });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Class not found!",
      });
    }

    await Class.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Class deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting class:", error);
    next(error);
  }
};

//! Get active classes (for dropdowns)
const getActiveClasses = async (req, res, next) => {
  try {
    const items = await Class.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
    });

    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("Error getting active classes:", error);
    next(error);
  }
};

module.exports = {
  getAllClasses,
  getClassById,
  getClassStats,
  createClass,
  updateClass,
  deleteClass,
  getActiveClasses,
};