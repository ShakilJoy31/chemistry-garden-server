// controllers/category/category.controller.js
const { Op } = require("sequelize");
const Category = require("../../models/Settings/category.model");

/* ============================================================
   HELPERS
============================================================ */

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateUniqueSlug = async (name, excludeId = null) => {
  const base = slugify(name) || "category";
  let slug = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const where = { slug };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const existing = await Category.findOne({ where });
    if (!existing) return slug;
    slug = `${base}-${counter++}`;
  }
};

/* ============================================================
   CREATE
============================================================ */

const createCategory = async (req, res, next) => {
  try {
    const { name, description, isActive = true } = req.body;

    if (!name?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required!" });
    }

    // Duplicate name check (case-insensitive)
    const existing = await Category.findOne({
      where: { name: name.trim() },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists!",
        data: existing,
      });
    }

    const slug = await generateUniqueSlug(name);

    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      isActive: Boolean(isActive),
      createdBy: req.user?.id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully!",
      data: category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    next(error);
  }
};

/* ============================================================
   READ — LIST
============================================================ */

const getAllCategories = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive = "",
      sortBy = "name",
      sortOrder = "ASC",
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.min(1000, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (isActive !== "" && isActive !== undefined) {
      where.isActive = isActive === "true" || isActive === true;
    }

    const SORTABLE = ["name", "createdAt", "updatedAt", "isActive"];
    const sortField = SORTABLE.includes(sortBy) ? sortBy : "name";
    const sortDir = String(sortOrder).toUpperCase() === "DESC" ? "DESC" : "ASC";

    const { count, rows } = await Category.findAndCountAll({
      where,
      limit: limitNumber,
      offset,
      order: [[sortField, sortDir]],
    });

    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully!",
      data: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    next(error);
  }
};

/* ============================================================
   READ — SINGLE
============================================================ */

const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({ where: { id } });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found!" });
    }

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully!",
      data: category,
    });
  } catch (error) {
    console.error("Error getting category:", error);
    next(error);
  }
};

const getCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({
      where: { slug, isActive: true },
    });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found!" });
    }

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully!",
      data: category,
    });
  } catch (error) {
    console.error("Error getting category by slug:", error);
    next(error);
  }
};

/* ============================================================
   UPDATE
============================================================ */

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const category = await Category.findOne({ where: { id } });
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found!" });
    }

    const updateData = {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res
          .status(400)
          .json({ success: false, message: "Category name cannot be empty!" });
      }

      // Duplicate check (case-insensitive, excluding this row)
      const duplicate = await Category.findOne({
        where: {
          name: trimmed,
          id: { [Op.ne]: id },
        },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Another category with this name already exists!",
          data: duplicate,
        });
      }

      // Regenerate slug only if the name actually changed
      if (trimmed !== category.name) {
        updateData.slug = await generateUniqueSlug(trimmed, parseInt(id));
      }
      updateData.name = trimmed;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    await category.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Category updated successfully!",
      data: category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    next(error);
  }
};

/* ============================================================
   TOGGLE ACTIVE
============================================================ */

const toggleCategoryActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({ where: { id } });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found!" });
    }

    category.isActive = !category.isActive;
    await category.save();

    return res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? "activated" : "deactivated"} successfully!`,
      data: category,
    });
  } catch (error) {
    console.error("Error toggling category:", error);
    next(error);
  }
};

/* ============================================================
   DELETE
============================================================ */

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({ where: { id } });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found!" });
    }

    await category.destroy();

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    next(error);
  }
};

/* ============================================================
   STATS
============================================================ */

const getCategoryStats = async (req, res, next) => {
  try {
    const total = await Category.count();
    const active = await Category.count({ where: { isActive: true } });
    const inactive = await Category.count({ where: { isActive: false } });

    return res.status(200).json({
      success: true,
      message: "Category stats retrieved successfully!",
      data: { total, active, inactive },
    });
  } catch (error) {
    console.error("Error getting category stats:", error);
    next(error);
  }
};

/* ============================================================
   PUBLIC — active only, no pagination (for dropdowns)
============================================================ */

const getPublicCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
      attributes: ["id", "name", "slug", "description"],
    });

    return res.status(200).json({
      success: true,
      message: "Public categories retrieved successfully!",
      data: categories,
    });
  } catch (error) {
    console.error("Error getting public categories:", error);
    next(error);
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
  getCategoryStats,
  getPublicCategories,
};