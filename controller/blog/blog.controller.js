// controller/blog/blog.controller.js
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const BlogCategory = require("../../models/blog/blog-category.model");
const Blog = require("../../models/blog/blog.model");

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

const generateUniqueSlug = async (title, Model, excludeId = null) => {
  const base = slugify(title);
  let slug = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const where = { slug };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const existing = await Model.findOne({ where });
    if (!existing) return slug;
    slug = `${base}-${counter++}`;
  }
};

const generateCategoryCode = async () => {
  const year = new Date().getFullYear();
  const count = await BlogCategory.count();
  return `BCAT-${year}-${String(count + 1).padStart(4, "0")}`;
};

const generateBlogCode = async () => {
  const year = new Date().getFullYear();
  const count = await Blog.count();
  return `BLOG-${year}-${String(count + 1).padStart(4, "0")}`;
};

const parseTags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((t) => String(t).trim()).filter(Boolean)
        : [];
    } catch {
      // comma-separated fallback: "react, node, next"
      return raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return [];
};

/* ============================================================
   BLOG CATEGORY — CRUD
============================================================ */

const createBlogCategory = async (req, res, next) => {
  try {
    const {
      title,
      description,
      shortDescription,
      image,
      icon,
      isActive = true,
      displayOrder = 0,
      metaTitle,
      metaDescription,
    } = req.body;

    if (!title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Category title is required!" });
    }

    const categoryCode = await generateCategoryCode();
    const slug = await generateUniqueSlug(title, BlogCategory);

    const category = await BlogCategory.create({
      categoryCode,
      title: title.trim(),
      slug,
      description: description || null,
      shortDescription: shortDescription || null,
      image: image || null,
      icon: icon || null,
      isActive,
      displayOrder: parseInt(displayOrder) || 0,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      createdBy: req.user?.id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Blog category created successfully!",
      data: category,
    });
  } catch (error) {
    console.error("Error creating blog category:", error);
    next(error);
  }
};

const getAllBlogCategories = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { categoryCode: { [Op.like]: `%${search}%` } },
      ];
    }
    if (isActive !== "" && isActive !== undefined) {
      where.isActive = isActive === "true" || isActive === true;
    }

    const { count, rows } = await BlogCategory.findAndCountAll({
      where,
      limit: limitNumber,
      offset,
      order: [
        ["displayOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    // Manually enrich with blog count per category
    const enriched = await Promise.all(
      rows.map(async (cat) => {
        const data = cat.toJSON();
        data.blogsCount = await Blog.count({
          where: { categoryId: cat.id },
        });
        return data;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Blog categories retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting blog categories:", error);
    next(error);
  }
};

const getBlogCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await BlogCategory.findOne({ where: { id } });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Blog category not found!" });
    }

    const data = category.toJSON();
    data.blogsCount = await Blog.count({ where: { categoryId: category.id } });

    return res.status(200).json({
      success: true,
      message: "Blog category retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting blog category:", error);
    next(error);
  }
};

const getBlogCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const category = await BlogCategory.findOne({
      where: { slug, isActive: true },
    });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Blog category not found!" });
    }

    return res.status(200).json({
      success: true,
      message: "Blog category retrieved successfully!",
      data: category,
    });
  } catch (error) {
    console.error("Error getting blog category by slug:", error);
    next(error);
  }
};

const updateBlogCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existing = await BlogCategory.findOne({ where: { id } });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Blog category not found!" });
    }

    if (updateData.title && updateData.title !== existing.title) {
      updateData.slug = await generateUniqueSlug(
        updateData.title,
        BlogCategory,
        parseInt(id)
      );
    }
    if (updateData.displayOrder !== undefined) {
      updateData.displayOrder = parseInt(updateData.displayOrder) || 0;
    }
    updateData.updatedBy = req.user?.id || null;

    await BlogCategory.update(updateData, { where: { id } });
    const updated = await BlogCategory.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Blog category updated successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating blog category:", error);
    next(error);
  }
};

const deleteBlogCategory = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const existing = await BlogCategory.findOne({
      where: { id },
      transaction,
    });
    if (!existing) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Blog category not found!" });
    }

    // Prevent delete if blogs still reference this category
    const blogCount = await Blog.count({
      where: { categoryId: id },
      transaction,
    });
    if (blogCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot delete category — ${blogCount} blog(s) are still assigned to it. Reassign or delete them first.`,
      });
    }

    await BlogCategory.destroy({ where: { id }, transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Blog category deleted successfully!",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting blog category:", error);
    next(error);
  }
};

const toggleBlogCategoryActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await BlogCategory.findOne({ where: { id } });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Blog category not found!" });
    }

    category.isActive = !category.isActive;
    category.updatedBy = req.user?.id || null;
    await category.save();

    return res.status(200).json({
      success: true,
      message: `Blog category ${
        category.isActive ? "activated" : "deactivated"
      } successfully!`,
      data: category,
    });
  } catch (error) {
    console.error("Error toggling blog category:", error);
    next(error);
  }
};

/* ============================================================
   BLOG — CRUD
============================================================ */

const createBlog = async (req, res, next) => {
  try {
    const {
      categoryId,
      title,
      description,
      shortDescription,
      thumbnail,
      author,
      tags = [],
      readTime,
      isFeatured = false,
      isActive = true,
      displayOrder = 0,
      publishedAt,
      metaTitle,
      metaDescription,
    } = req.body;

    if (!categoryId) {
      return res
        .status(400)
        .json({ success: false, message: "categoryId is required!" });
    }
    if (!title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Blog title is required!" });
    }
    if (!description?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Blog description is required!" });
    }
    if (!thumbnail?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Blog thumbnail is required!" });
    }

    const parent = await BlogCategory.findOne({ where: { id: categoryId } });
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent blog category not found!",
      });
    }

    const blogCode = await generateBlogCode();
    const slug = await generateUniqueSlug(title, Blog);

    const blog = await Blog.create({
      blogCode,
      categoryId: parseInt(categoryId),
      title: title.trim(),
      slug,
      description: description.trim(),
      shortDescription: shortDescription || null,
      thumbnail: thumbnail.trim(),
      author: author || null,
      tags: parseTags(tags),
      readTime: readTime ? parseInt(readTime) : null,
      isFeatured,
      isActive,
      displayOrder: parseInt(displayOrder) || 0,
      publishedAt: publishedAt || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      createdBy: req.user?.id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Blog created successfully!",
      data: blog,
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    next(error);
  }
};

const getAllBlogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      categoryId = "",
      isActive = "",
      isFeatured = "",
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { blogCode: { [Op.like]: `%${search}%` } },
        { shortDescription: { [Op.like]: `%${search}%` } },
      ];
    }
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (isActive !== "" && isActive !== undefined) {
      where.isActive = isActive === "true" || isActive === true;
    }
    if (isFeatured !== "" && isFeatured !== undefined) {
      where.isFeatured = isFeatured === "true" || isFeatured === true;
    }

    const validSortFields = [
      "createdAt",
      "updatedAt",
      "publishedAt",
      "views",
      "displayOrder",
      "title",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDir = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows } = await Blog.findAndCountAll({
      where,
      limit: limitNumber,
      offset,
      order: [[sortField, sortDir]],
    });

    // Manually enrich with category info
    const enriched = await Promise.all(
      rows.map(async (blog) => {
        const data = blog.toJSON();
        const cat = await BlogCategory.findOne({
          where: { id: blog.categoryId },
          attributes: ["id", "title", "slug", "categoryCode"],
        });
        data.category = cat;
        return data;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Blogs retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting blogs:", error);
    next(error);
  }
};

const getBlogById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findOne({ where: { id } });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found!" });
    }

    const cat = await BlogCategory.findOne({
      where: { id: blog.categoryId },
      attributes: ["id", "title", "slug", "categoryCode"],
    });

    const data = blog.toJSON();
    data.category = cat;

    return res.status(200).json({
      success: true,
      message: "Blog retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting blog:", error);
    next(error);
  }
};

const getBlogBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({
      where: { slug, isActive: true },
    });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found!" });
    }

    // Increment views (fire-and-forget)
    Blog.update({ views: blog.views + 1 }, { where: { id: blog.id } }).catch(
      (e) => console.error("Error incrementing blog views:", e)
    );

    const cat = await BlogCategory.findOne({
      where: { id: blog.categoryId },
      attributes: ["id", "title", "slug", "categoryCode"],
    });

    const data = blog.toJSON();
    data.category = cat;
    data.views = blog.views + 1;

    return res.status(200).json({
      success: true,
      message: "Blog retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting blog by slug:", error);
    next(error);
  }
};

const updateBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existing = await Blog.findOne({ where: { id } });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found!" });
    }

    // If changing category, verify it exists
    if (
      updateData.categoryId !== undefined &&
      parseInt(updateData.categoryId) !== existing.categoryId
    ) {
      const parent = await BlogCategory.findOne({
        where: { id: updateData.categoryId },
      });
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "New parent category not found!",
        });
      }
      updateData.categoryId = parseInt(updateData.categoryId);
    }

    if (updateData.title && updateData.title !== existing.title) {
      updateData.slug = await generateUniqueSlug(
        updateData.title,
        Blog,
        parseInt(id)
      );
    }
    if (updateData.tags !== undefined) {
      updateData.tags = parseTags(updateData.tags);
    }
    if (updateData.displayOrder !== undefined) {
      updateData.displayOrder = parseInt(updateData.displayOrder) || 0;
    }
    if (updateData.readTime !== undefined) {
      updateData.readTime = updateData.readTime
        ? parseInt(updateData.readTime)
        : null;
    }
    updateData.updatedBy = req.user?.id || null;

    await Blog.update(updateData, { where: { id } });
    const updated = await Blog.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Blog updated successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    next(error);
  }
};

const deleteBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await Blog.findOne({ where: { id } });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found!" });
    }

    await Blog.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Blog deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    next(error);
  }
};

const toggleBlogActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findOne({ where: { id } });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found!" });
    }

    blog.isActive = !blog.isActive;
    blog.updatedBy = req.user?.id || null;
    await blog.save();

    return res.status(200).json({
      success: true,
      message: `Blog ${blog.isActive ? "activated" : "deactivated"} successfully!`,
      data: blog,
    });
  } catch (error) {
    console.error("Error toggling blog:", error);
    next(error);
  }
};

const toggleBlogFeatured = async (req, res, next) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findOne({ where: { id } });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found!" });
    }

    blog.isFeatured = !blog.isFeatured;
    blog.updatedBy = req.user?.id || null;
    await blog.save();

    return res.status(200).json({
      success: true,
      message: `Blog ${
        blog.isFeatured ? "marked as featured" : "unmarked as featured"
      } successfully!`,
      data: blog,
    });
  } catch (error) {
    console.error("Error toggling blog featured status:", error);
    next(error);
  }
};

const getBlogStats = async (req, res, next) => {
  try {
    const total = await Blog.count();
    const active = await Blog.count({ where: { isActive: true } });
    const inactive = await Blog.count({ where: { isActive: false } });
    const featured = await Blog.count({ where: { isFeatured: true } });
    const totalCategories = await BlogCategory.count();
    const activeCategories = await BlogCategory.count({
      where: { isActive: true },
    });

    const totalViewsResult = await Blog.sum("views");
    const totalViews = totalViewsResult || 0;

    return res.status(200).json({
      success: true,
      message: "Blog stats retrieved successfully!",
      data: {
        total,
        active,
        inactive,
        featured,
        totalCategories,
        activeCategories,
        totalViews,
      },
    });
  } catch (error) {
    console.error("Error getting blog stats:", error);
    next(error);
  }
};

/* ============================================================
   PUBLIC
============================================================ */

const getPublicBlogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      categoryId = "",
      categorySlug = "",
      search = "",
      featured = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const where = { isActive: true };

    // Resolve category by slug → id if provided
    if (categorySlug) {
      const cat = await BlogCategory.findOne({
        where: { slug: categorySlug, isActive: true },
      });
      if (!cat) {
        return res.status(200).json({
          success: true,
          message: "Public blogs retrieved successfully!",
          data: [],
          pagination: {
            totalItems: 0,
            totalPages: 0,
            currentPage: pageNumber,
            itemsPerPage: limitNumber,
          },
        });
      }
      where.categoryId = cat.id;
    } else if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { shortDescription: { [Op.like]: `%${search}%` } },
      ];
    }

    if (featured === "true" || featured === true) {
      where.isFeatured = true;
    }

    const { count, rows } = await Blog.findAndCountAll({
      where,
      limit: limitNumber,
      offset,
      order: [
        ["publishedAt", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    const enriched = await Promise.all(
      rows.map(async (blog) => {
        const data = blog.toJSON();
        const cat = await BlogCategory.findOne({
          where: { id: blog.categoryId },
          attributes: ["id", "title", "slug", "categoryCode"],
        });
        data.category = cat;
        return data;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Public blogs retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting public blogs:", error);
    next(error);
  }
};

const getPublicBlogCategories = async (req, res, next) => {
  try {
    const categories = await BlogCategory.findAll({
      where: { isActive: true },
      order: [
        ["displayOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    // Enrich with published blog count only
    const enriched = await Promise.all(
      categories.map(async (cat) => {
        const data = cat.toJSON();
        data.blogsCount = await Blog.count({
          where: { categoryId: cat.id, isActive: true },
        });
        return data;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Public blog categories retrieved successfully!",
      data: enriched,
    });
  } catch (error) {
    console.error("Error getting public blog categories:", error);
    next(error);
  }
};

module.exports = {
  // Blog Category
  createBlogCategory,
  getAllBlogCategories,
  getBlogCategoryById,
  getBlogCategoryBySlug,
  updateBlogCategory,
  deleteBlogCategory,
  toggleBlogCategoryActive,
  // Blog
  createBlog,
  getAllBlogs,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
  toggleBlogActive,
  toggleBlogFeatured,
  getBlogStats,
  // Public
  getPublicBlogs,
  getPublicBlogCategories,
};