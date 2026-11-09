// controller/settings/faq.controller.js
const sequelize = require("../../database/connection");
const { Op } = require("sequelize");
const FAQ = require("../../models/Settings/faq.model");

//! Get all FAQs with pagination, filters, and sorting
const getAllFAQs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      category = "",
      status = "",
      sortBy = "order",
      sortOrder = "ASC",
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { question: { [Op.like]: `%${search}%` } },
        { answer: { [Op.like]: `%${search}%` } },
      ];
    }

    // Category filter
    if (category) {
      whereClause.category = category;
    }

    // Status filter
    if (status) {
      whereClause.isActive = status === "active";
    }

    // Validate sort fields to prevent SQL injection
    const allowedSortFields = ["id", "question", "category", "order", "isActive", "createdAt", "updatedAt"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "order";
    const sortDirection = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    const { count, rows } = await FAQ.findAndCountAll({
      where: whereClause,
      order: [[sortField, sortDirection]],
      limit: parseInt(limit),
      offset: offset,
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    const transformedFAQs = rows.map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order: faq.order,
      isActive: faq.isActive,
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
      createdBy: faq.createdBy,
      updatedBy: faq.updatedBy,
    }));

    return res.status(200).json({
      success: true,
      data: transformedFAQs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalItems: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting FAQs:", error);
    next(error);
  }
};

//! Get FAQ by ID
const getFAQById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const faq = await FAQ.findOne({
      where: { id },
    });

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found!",
      });
    }

    const transformedFAQ = {
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order: faq.order,
      isActive: faq.isActive,
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
      createdBy: faq.createdBy,
      updatedBy: faq.updatedBy,
    };

    return res.status(200).json({
      success: true,
      message: "FAQ retrieved successfully!",
      data: transformedFAQ,
    });
  } catch (error) {
    console.error("Error getting FAQ by ID:", error);
    next(error);
  }
};

//! Get FAQ statistics
const getFAQStats = async (req, res, next) => {
  try {
    const totalFAQs = await FAQ.count();
    const activeFAQs = await FAQ.count({ where: { isActive: true } });
    const inactiveFAQs = await FAQ.count({ where: { isActive: false } });

    // Get categories with counts
    const categories = await FAQ.findAll({
      attributes: [
        "category",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["category"],
      where: { isActive: true },
      raw: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        totalFAQs,
        activeFAQs,
        inactiveFAQs,
        categories: categories.map(cat => ({
          category: cat.category,
          count: parseInt(cat.count),
        })),
      },
    });
  } catch (error) {
    console.error("Error getting FAQ stats:", error);
    next(error);
  }
};

//! Create new FAQ
const createFAQ = async (req, res, next) => {
  try {
    const { question, answer, category, order, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    // Validate required fields
    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "Question and answer are required!",
      });
    }

    // Check if question already exists
    const existingFAQ = await FAQ.findOne({
      where: { 
        question: question,
      },
    });

    if (existingFAQ) {
      return res.status(400).json({
        success: false,
        message: "FAQ with this question already exists!",
      });
    }

    // Get the maximum order value if no order is provided
    let orderValue = order;
    if (orderValue === undefined || orderValue === null) {
      const maxOrder = await FAQ.max("order");
      orderValue = (maxOrder || 0) + 1;
    } else {
      // If order is provided, increment order of existing FAQs to make room
      await FAQ.increment("order", {
        by: 1,
        where: {
          order: { [Op.gte]: orderValue },
        },
      });
    }

    const faqData = {
      question,
      answer,
      category: category || "General",
      order: orderValue,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: userEmail,
      updatedBy: userEmail,
    };

    const newFAQ = await FAQ.create(faqData);

    const transformedFAQ = {
      id: newFAQ.id,
      question: newFAQ.question,
      answer: newFAQ.answer,
      category: newFAQ.category,
      order: newFAQ.order,
      isActive: newFAQ.isActive,
      createdAt: newFAQ.createdAt,
      updatedAt: newFAQ.updatedAt,
    };

    return res.status(201).json({
      success: true,
      message: "FAQ created successfully!",
      data: transformedFAQ,
    });
  } catch (error) {
    console.error("Error creating FAQ:", error);
    next(error);
  }
};

//! Update FAQ
const updateFAQ = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { question, answer, category, order, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    const existingFAQ = await FAQ.findOne({
      where: { id },
    });

    if (!existingFAQ) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found!",
      });
    }

    // Check if question already exists (excluding current FAQ)
    if (question) {
      const questionExists = await FAQ.findOne({
        where: {
          question,
          id: { [Op.ne]: id },
        },
      });

      if (questionExists) {
        return res.status(400).json({
          success: false,
          message: "FAQ with this question already exists!",
        });
      }
    }

    const updateData = {
      updatedBy: userEmail,
    };

    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Handle order update
    if (order !== undefined && order !== existingFAQ.order) {
      const oldOrder = existingFAQ.order;
      const newOrder = order;

      // If moving to a lower position (higher priority), increment items in between
      if (newOrder < oldOrder) {
        await FAQ.increment("order", {
          by: 1,
          where: {
            order: { [Op.gte]: newOrder, [Op.lt]: oldOrder },
            id: { [Op.ne]: id },
          },
        });
      }
      // If moving to a higher position (lower priority), decrement items in between
      else if (newOrder > oldOrder) {
        await FAQ.decrement("order", {
          by: 1,
          where: {
            order: { [Op.gt]: oldOrder, [Op.lte]: newOrder },
            id: { [Op.ne]: id },
          },
        });
      }

      updateData.order = newOrder;
    }

    await FAQ.update(updateData, {
      where: { id },
    });

    const updatedFAQ = await FAQ.findOne({
      where: { id },
    });

    const transformedFAQ = {
      id: updatedFAQ.id,
      question: updatedFAQ.question,
      answer: updatedFAQ.answer,
      category: updatedFAQ.category,
      order: updatedFAQ.order,
      isActive: updatedFAQ.isActive,
      createdAt: updatedFAQ.createdAt,
      updatedAt: updatedFAQ.updatedAt,
      createdBy: updatedFAQ.createdBy,
      updatedBy: updatedFAQ.updatedBy,
    };

    return res.status(200).json({
      success: true,
      message: "FAQ updated successfully!",
      data: transformedFAQ,
    });
  } catch (error) {
    console.error("Error updating FAQ:", error);
    next(error);
  }
};

//! Update FAQ status (activate/deactivate)
const updateFAQStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const userEmail = req.user?.email || "system";

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "isActive status is required!",
      });
    }

    const existingFAQ = await FAQ.findOne({
      where: { id },
    });

    if (!existingFAQ) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found!",
      });
    }

    await FAQ.update(
      {
        isActive,
        updatedBy: userEmail,
      },
      {
        where: { id },
      }
    );

    const updatedFAQ = await FAQ.findOne({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: `FAQ ${isActive ? "activated" : "deactivated"} successfully!`,
      data: {
        id: updatedFAQ.id,
        isActive: updatedFAQ.isActive,
        updatedAt: updatedFAQ.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating FAQ status:", error);
    next(error);
  }
};

//! Delete FAQ
const deleteFAQ = async (req, res, next) => {
  try {
    const { id } = req.params;

    const faq = await FAQ.findOne({
      where: { id },
    });

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found!",
      });
    }

    // Reorder remaining FAQs to fill the gap
    await FAQ.decrement("order", {
      by: 1,
      where: {
        order: { [Op.gt]: faq.order },
      },
    });

    await FAQ.destroy({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "FAQ deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    next(error);
  }
};

//! Bulk delete FAQs
const bulkDeleteFAQs = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of FAQ IDs to delete!",
      });
    }

    const deletedCount = await FAQ.destroy({
      where: {
        id: { [Op.in]: ids },
      },
    });

    return res.status(200).json({
      success: true,
      message: `${deletedCount} FAQ(s) deleted successfully!`,
      data: {
        deletedCount,
      },
    });
  } catch (error) {
    console.error("Error bulk deleting FAQs:", error);
    next(error);
  }
};

//! Reorder FAQs
const reorderFAQs = async (req, res, next) => {
  try {
    const { faqs } = req.body; // Array of { id, order }
    const userEmail = req.user?.email || "system";

    if (!faqs || !Array.isArray(faqs) || faqs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of FAQ order updates!",
      });
    }

    // Use a transaction for consistency
    const transaction = await sequelize.transaction();

    try {
      // Update each FAQ's order
      for (const faq of faqs) {
        if (!faq.id || faq.order === undefined) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: "Each FAQ must have id and order fields!",
          });
        }

        await FAQ.update(
          {
            order: faq.order,
            updatedBy: userEmail,
          },
          {
            where: { id: faq.id },
            transaction,
          }
        );
      }

      await transaction.commit();

      // Fetch updated FAQs
      const updatedFAQs = await FAQ.findAll({
        order: [["order", "ASC"]],
      });

      const transformedFAQs = updatedFAQs.map((faq) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        order: faq.order,
        isActive: faq.isActive,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
      }));

      return res.status(200).json({
        success: true,
        message: "FAQs reordered successfully!",
        data: transformedFAQs,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error reordering FAQs:", error);
    next(error);
  }
};

//! Get FAQs by category
const getFAQsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { activeOnly = "true" } = req.query;

    const whereClause = {
      category,
    };

    if (activeOnly === "true") {
      whereClause.isActive = true;
    }

    const faqs = await FAQ.findAll({
      where: whereClause,
      order: [["order", "ASC"], ["createdAt", "DESC"]],
    });

    const transformedFAQs = faqs.map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order: faq.order,
      isActive: faq.isActive,
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: transformedFAQs,
      count: transformedFAQs.length,
    });
  } catch (error) {
    console.error("Error getting FAQs by category:", error);
    next(error);
  }
};

//! Get all categories
const getAllCategories = async (req, res, next) => {
  try {
    const categories = await FAQ.findAll({
      attributes: [
        [sequelize.fn("DISTINCT", sequelize.col("category")), "category"],
      ],
      where: { isActive: true },
      raw: true,
    });

    return res.status(200).json({
      success: true,
      data: categories.map(cat => cat.category),
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    next(error);
  }
};

module.exports = {
  getAllFAQs,
  getFAQById,
  getFAQStats,
  createFAQ,
  updateFAQ,
  updateFAQStatus,
  deleteFAQ,
  bulkDeleteFAQs,
  reorderFAQs,
  getFAQsByCategory,
  getAllCategories,
};