const { Op, fn, literal } = require("sequelize");
const Batch = require("../../models/academic/batch.model");
const Class = require("../../models/academic/class.model");
const Student = require("../../models/students/student.model");

const norm = (v) => (v ?? "").toString().trim().toLowerCase();

/**
 * Adds `studentCount` to each batch.
 * Students store class + batch as NAMES, so we match on (class name, batch name).
 */
const attachStudentCounts = async (rows) => {
  if (!rows || !rows.length) return [];

  const classIds = [...new Set(rows.map((r) => r.classId))];
  const batchNames = [...new Set(rows.map((r) => r.name))];

  const classes = await Class.findAll({
    where: { id: { [Op.in]: classIds } },
    attributes: ["id", "name"],
    raw: true,
  });
  const classNameById = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  const grouped = await Student.findAll({
    attributes: ["class", "batch", [fn("COUNT", literal("*")), "count"]],
    where: { batch: { [Op.in]: batchNames } },
    group: ["class", "batch"],
    raw: true,
  });

  const countMap = {};
  for (const g of grouped) {
    const key = `${norm(g.class)}||${norm(g.batch)}`;
    countMap[key] = (countMap[key] || 0) + (parseInt(g.count, 10) || 0);
  }

  return rows.map((r) => {
    const plain = typeof r.toJSON === "function" ? r.toJSON() : r;
    const key = `${norm(classNameById[plain.classId])}||${norm(plain.name)}`;
    return { ...plain, studentCount: countMap[key] || 0 };
  });
};

//! Get all batches with pagination and filters
const getAllBatches = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive,
      classId,
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

    if (classId !== undefined && classId !== "undefined" && classId !== "") {
      whereClause.classId = parseInt(classId, 10);
    }

    const { count, rows } = await Batch.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
    });

    const data = await attachStudentCounts(rows);
    const totalPages = Math.ceil(count / parseInt(limit));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting batches:", error);
    next(error);
  }
};

//! Get batch by ID
const getBatchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Batch.findOne({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, message: "Batch not found!" });
    }
    const [withCount] = await attachStudentCounts([item]);
    return res.status(200).json({ success: true, data: withCount });
  } catch (error) {
    console.error("Error getting batch by ID:", error);
    next(error);
  }
};

//! Get batch statistics (optionally by class)
const getBatchStats = async (req, res, next) => {
  try {
    const { classId } = req.query;
    const where = {};
    if (classId !== undefined && classId !== "" && classId !== "undefined") {
      where.classId = parseInt(classId, 10);
    }

    const totalItems = await Batch.count({ where });
    const activeItems = await Batch.count({ where: { ...where, isActive: true } });
    const inactiveItems = await Batch.count({ where: { ...where, isActive: false } });

    return res.status(200).json({
      success: true,
      data: { totalItems, activeItems, inactiveItems },
    });
  } catch (error) {
    console.error("Error getting batch stats:", error);
    next(error);
  }
};

//! Create new batch  — classId is required
const createBatch = async (req, res, next) => {
  try {
    const { name, description, isActive, classId } = req.body;
    const userEmail = req.user?.email || "system";

    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Name is required!" });
    }

    if (classId === undefined || classId === null || classId === "") {
      return res.status(400).json({ success: false, message: "Class is required!" });
    }

    const parsedClassId = parseInt(classId, 10);
    const parentClass = await Class.findOne({ where: { id: parsedClassId } });
    if (!parentClass) {
      return res.status(400).json({ success: false, message: "Selected class does not exist!" });
    }

    // Duplicate name within the same class
    const existing = await Batch.findOne({
      where: { name: name.trim(), classId: parsedClassId },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A batch with this name already exists in the selected class!",
      });
    }

    const newItem = await Batch.create({
      name: name.trim(),
      description: description || "",
      isActive: isActive !== undefined ? isActive : true,
      classId: parsedClassId,
      createdBy: userEmail,
      updatedBy: userEmail,
    });

    return res.status(201).json({
      success: true,
      message: "Batch created successfully!",
      data: newItem,
    });
  } catch (error) {
    console.error("Error creating batch:", error);
    next(error);
  }
};

//! Update batch
const updateBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, classId } = req.body;
    const userEmail = req.user?.email || "system";

    const existingItem = await Batch.findOne({ where: { id } });
    if (!existingItem) {
      return res.status(404).json({ success: false, message: "Batch not found!" });
    }

    // Resolve the target class (defaults to existing one)
    let targetClassId = existingItem.classId;
    if (classId !== undefined && classId !== null && classId !== "") {
      const parsed = parseInt(classId, 10);
      const parentClass = await Class.findOne({ where: { id: parsed } });
      if (!parentClass) {
        return res.status(400).json({ success: false, message: "Selected class does not exist!" });
      }
      targetClassId = parsed;
    }

    // Duplicate name check scoped to the target class
    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed === "") {
        return res.status(400).json({ success: false, message: "Name cannot be empty!" });
      }
      if (trimmed !== existingItem.name || targetClassId !== existingItem.classId) {
        const dup = await Batch.findOne({
          where: { name: trimmed, classId: targetClassId },
        });
        if (dup && dup.id !== existingItem.id) {
          return res.status(400).json({
            success: false,
            message: "A batch with this name already exists in the selected class!",
          });
        }
      }
    }

    const updateData = { updatedBy: userEmail, classId: targetClassId };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    await Batch.update(updateData, { where: { id } });
    const updatedItem = await Batch.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Batch updated successfully!",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Error updating batch:", error);
    next(error);
  }
};

//! Delete batch
const deleteBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Batch.findOne({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, message: "Batch not found!" });
    }
    await Batch.destroy({ where: { id } });
    return res.status(200).json({ success: true, message: "Batch deleted successfully!" });
  } catch (error) {
    console.error("Error deleting batch:", error);
    next(error);
  }
};

//! Get active batches (for dropdowns, optionally filtered by classId)
const getActiveBatches = async (req, res, next) => {
  try {
    const { classId } = req.query;
    const where = { isActive: true };
    if (classId !== undefined && classId !== "" && classId !== "undefined") {
      where.classId = parseInt(classId, 10);
    }
    const items = await Batch.findAll({
      where,
      order: [["name", "ASC"]],
    });
    const data = await attachStudentCounts(items);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error getting active batches:", error);
    next(error);
  }
};

module.exports = {
  getAllBatches,
  getBatchById,
  getBatchStats,
  createBatch,
  updateBatch,
  deleteBatch,
  getActiveBatches,
};