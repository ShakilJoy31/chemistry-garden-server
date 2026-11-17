const { Op } = require("sequelize");
const ExamName = require("../../models/academic/examName.model");


//! Get all exam names with pagination and filters
const getAllExamNames = async (req, res, next) => {
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

    const { count, rows } = await ExamName.findAndCountAll({
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
    console.error("Error getting exam names:", error);
    next(error);
  }
};

//! Get exam name by ID
const getExamNameById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await ExamName.findOne({ where: { id } });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Exam name not found!",
      });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Error getting exam name by ID:", error);
    next(error);
  }
};

//! Get exam name statistics
const getExamNameStats = async (req, res, next) => {
  try {
    const totalItems = await ExamName.count();
    const activeItems = await ExamName.count({ where: { isActive: true } });
    const inactiveItems = await ExamName.count({ where: { isActive: false } });

    return res.status(200).json({
      success: true,
      data: { totalItems, activeItems, inactiveItems },
    });
  } catch (error) {
    console.error("Error getting exam name stats:", error);
    next(error);
  }
};

//! Create new exam name
const createExamName = async (req, res, next) => {
  try {
    const { name, description, passMark, totalMark, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Name is required!",
      });
    }

    if (passMark === undefined || passMark === null || passMark === "") {
      return res.status(400).json({
        success: false,
        message: "Pass mark is required!",
      });
    }

    if (totalMark === undefined || totalMark === null || totalMark === "") {
      return res.status(400).json({
        success: false,
        message: "Total mark is required!",
      });
    }

    const passMarkNum = parseFloat(passMark);
    const totalMarkNum = parseFloat(totalMark);

    if (isNaN(passMarkNum) || passMarkNum < 0) {
      return res.status(400).json({
        success: false,
        message: "Pass mark must be a valid non-negative number!",
      });
    }

    if (isNaN(totalMarkNum) || totalMarkNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Total mark must be a valid positive number!",
      });
    }

    if (passMarkNum > totalMarkNum) {
      return res.status(400).json({
        success: false,
        message: "Pass mark cannot be greater than total mark!",
      });
    }

    const existing = await ExamName.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Exam name with this name already exists!",
      });
    }

    const newItem = await ExamName.create({
      name: name.trim(),
      description: description || "",
      passMark: passMarkNum,
      totalMark: totalMarkNum,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: userEmail,
      updatedBy: userEmail,
    });

    return res.status(201).json({
      success: true,
      message: "Exam name created successfully!",
      data: newItem,
    });
  } catch (error) {
    console.error("Error creating exam name:", error);
    next(error);
  }
};

//! Update exam name
const updateExamName = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, passMark, totalMark, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    const existingItem = await ExamName.findOne({ where: { id } });
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Exam name not found!",
      });
    }

    // Duplicate name check
    if (name !== undefined && name.trim() !== existingItem.name) {
      const duplicate = await ExamName.findOne({ where: { name: name.trim() } });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Exam name with this name already exists!",
        });
      }
    }

    // Resolve final values for pass/total mark validation
    const finalPassMark =
      passMark !== undefined ? parseFloat(passMark) : parseFloat(existingItem.passMark);
    const finalTotalMark =
      totalMark !== undefined ? parseFloat(totalMark) : parseFloat(existingItem.totalMark);

    if (isNaN(finalPassMark) || finalPassMark < 0) {
      return res.status(400).json({
        success: false,
        message: "Pass mark must be a valid non-negative number!",
      });
    }

    if (isNaN(finalTotalMark) || finalTotalMark <= 0) {
      return res.status(400).json({
        success: false,
        message: "Total mark must be a valid positive number!",
      });
    }

    if (finalPassMark > finalTotalMark) {
      return res.status(400).json({
        success: false,
        message: "Pass mark cannot be greater than total mark!",
      });
    }

    const updateData = { updatedBy: userEmail };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (passMark !== undefined) updateData.passMark = finalPassMark;
    if (totalMark !== undefined) updateData.totalMark = finalTotalMark;
    if (isActive !== undefined) updateData.isActive = isActive;

    await ExamName.update(updateData, { where: { id } });
    const updatedItem = await ExamName.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Exam name updated successfully!",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Error updating exam name:", error);
    next(error);
  }
};

//! Delete exam name
const deleteExamName = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await ExamName.findOne({ where: { id } });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Exam name not found!",
      });
    }

    await ExamName.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Exam name deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting exam name:", error);
    next(error);
  }
};

//! Get active exam names (for dropdowns)
const getActiveExamNames = async (req, res, next) => {
  try {
    const items = await ExamName.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
    });

    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("Error getting active exam names:", error);
    next(error);
  }
};

module.exports = {
  getAllExamNames,
  getExamNameById,
  getExamNameStats,
  createExamName,
  updateExamName,
  deleteExamName,
  getActiveExamNames,
};