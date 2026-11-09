const sequelize = require("../../database/connection");
const { Op } = require("sequelize");
const fs = require("fs");
const path = require("path");
const StoreItem = require("../../models/Settings/store.model");
const { URL } = require("url"); 

//! Get all store items with pagination and filters
const getAllStoreItems = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      category = "",
      isActive,
      isFeatured,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
      ];
    }

    // Category filter
    if (category) {
      whereClause.category = category;
    }

    // Active status filter - check if isActive exists and is not 'undefined' string
    if (isActive !== undefined && isActive !== 'undefined' && isActive !== '') {
      whereClause.isActive = isActive === "true";
    }

    // Featured filter - check if isFeatured exists and is not 'undefined' string
    if (isFeatured !== undefined && isFeatured !== 'undefined' && isFeatured !== '') {
      whereClause.isFeatured = isFeatured === "true";
    }

    const { count, rows } = await StoreItem.findAndCountAll({
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
    console.error("Error getting store items:", error);
    next(error);
  }
};

//! Get store item by ID
const getStoreItemById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await StoreItem.findOne({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Store item not found!",
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Error getting store item by ID:", error);
    next(error);
  }
};

//! Get store statistics
const getStoreStats = async (req, res, next) => {
  try {
    const totalItems = await StoreItem.count();
    const activeItems = await StoreItem.count({ where: { isActive: true } });
    const inactiveItems = await StoreItem.count({ where: { isActive: false } });
    const featuredItems = await StoreItem.count({ where: { isFeatured: true } });

    // Get unique categories
    const categories = await StoreItem.findAll({
      attributes: [
        "category",
        [sequelize.fn("COUNT", sequelize.col("category")), "count"],
      ],
      where: { isActive: true },
      group: ["category"],
    });

    // Get total downloads
    const totalDownloads = await StoreItem.sum("downloadCount");

    return res.status(200).json({
      success: true,
      data: {
        totalItems,
        activeItems,
        inactiveItems,
        featuredItems,
        totalDownloads: totalDownloads || 0,
        categories: categories.map((cat) => ({
          name: cat.category,
          count: parseInt(cat.dataValues.count),
        })),
      },
    });
  } catch (error) {
    console.error("Error getting store stats:", error);
    next(error);
  }
};

//! Create new store item
const createStoreItem = async (req, res, next) => {
  try {
    const {
      title,
      description,
      price,
      discountPrice,
      category,
      documentUrl,
      documentName,
      documentSize,
      coverImage,
      isActive,
      isFeatured,
    } = req.body;

    const userEmail = req.user?.email || "system";

    // Validate required fields
    if (!title || !price || !category || !documentUrl || !documentName) {
      return res.status(400).json({
        success: false,
        message: "Title, price, category, document URL, and document name are required!",
      });
    }

    // Validate price
    if (parseFloat(price) < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative!",
      });
    }

    // Validate discount price
    if (discountPrice && parseFloat(discountPrice) > parseFloat(price)) {
      return res.status(400).json({
        success: false,
        message: "Discount price cannot be greater than original price!",
      });
    }

    const itemData = {
      title,
      description: description || "",
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      category,
      documentUrl,
      documentName,
      documentSize: documentSize || 0,
      coverImage: coverImage || null,
      isActive: isActive !== undefined ? isActive : true,
      isFeatured: isFeatured || false,
      createdBy: userEmail,
      updatedBy: userEmail,
    };

    const newItem = await StoreItem.create(itemData);

    return res.status(201).json({
      success: true,
      message: "Store item created successfully!",
      data: newItem,
    });
  } catch (error) {
    console.error("Error creating store item:", error);
    next(error);
  }
};

//! Update store item
const updateStoreItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      price,
      discountPrice,
      category,
      documentUrl,
      documentName,
      documentSize,
      coverImage,
      isActive,
      isFeatured,
    } = req.body;

    const userEmail = req.user?.email || "system";

    const existingItem = await StoreItem.findOne({
      where: { id },
    });

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Store item not found!",
      });
    }

    // Validate price if provided
    if (price !== undefined && parseFloat(price) < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative!",
      });
    }

    // Validate discount price if provided
    const finalPrice = price !== undefined ? parseFloat(price) : existingItem.price;
    const finalDiscountPrice =
      discountPrice !== undefined ? parseFloat(discountPrice) : existingItem.discountPrice;

    if (finalDiscountPrice && finalDiscountPrice > finalPrice) {
      return res.status(400).json({
        success: false,
        message: "Discount price cannot be greater than original price!",
      });
    }

    const updateData = {
      updatedBy: userEmail,
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (discountPrice !== undefined)
      updateData.discountPrice = discountPrice ? parseFloat(discountPrice) : null;
    if (category !== undefined) updateData.category = category;
    if (documentUrl !== undefined) updateData.documentUrl = documentUrl;
    if (documentName !== undefined) updateData.documentName = documentName;
    if (documentSize !== undefined) updateData.documentSize = documentSize;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

    await StoreItem.update(updateData, {
      where: { id },
    });

    const updatedItem = await StoreItem.findOne({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Store item updated successfully!",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Error updating store item:", error);
    next(error);
  }
};

//! Delete store item
const deleteStoreItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await StoreItem.findOne({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Store item not found!",
      });
    }

    // Delete the associated document file
    if (item.documentUrl) {
      const filePath = path.join(__dirname, "../../../public", item.documentUrl);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }
    }

    // Delete cover image if exists
    if (item.coverImage) {
      const coverPath = path.join(__dirname, "../../../public", item.coverImage);
      if (fs.existsSync(coverPath)) {
        try {
          fs.unlinkSync(coverPath);
        } catch (err) {
          console.error("Error deleting cover image:", err);
        }
      }
    }

    await StoreItem.destroy({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Store item deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting store item:", error);
    next(error);
  }
};

//! Increment download count
const incrementDownloadCount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await StoreItem.findOne({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Store item not found!",
      });
    }

    await StoreItem.increment("downloadCount", {
      by: 1,
      where: { id },
    });

    const updatedItem = await StoreItem.findOne({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Download count updated!",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Error incrementing download count:", error);
    next(error);
  }
};

//! Get featured items
const getFeaturedItems = async (req, res, next) => {
  try {
    const { limit = 6 } = req.query;

    const items = await StoreItem.findAll({
      where: {
        isActive: true,
        isFeatured: true,
      },
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
    });

    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("Error getting featured items:", error);
    next(error);
  }
};

//! Get categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await StoreItem.findAll({
      attributes: [
        "category",
        [sequelize.fn("COUNT", sequelize.col("category")), "count"],
      ],
      where: { isActive: true },
      group: ["category"],
      order: [[sequelize.col("category"), "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: categories.map((cat) => ({
        name: cat.category,
        count: parseInt(cat.dataValues.count),
      })),
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    next(error);
  }
};









const downloadStoreItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await StoreItem.findOne({ where: { id } });

    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // documentUrl might be a full URL or a path like "/uploads/documents/xxx.pdf"
    let relativePath = item.documentUrl;
    if (/^https?:\/\//i.test(relativePath)) {
      relativePath = new URL(relativePath).pathname; // -> "/uploads/documents/xxx.pdf"
    }

    // relativePath already starts with "/uploads/...", and uploads/ sits at the
    // project root (sibling of controller/, public/, etc.) — NOT inside public/.
    const projectRoot = path.join(__dirname, "../.."); // controller/settings -> project root
    const uploadsRoot = path.join(projectRoot, "uploads");
    const filePath = path.join(projectRoot, relativePath); // relativePath already has "/uploads/..."

    if (!filePath.startsWith(uploadsRoot)) {
      return res.status(400).json({ success: false, message: "Invalid file path" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found on server" });
    }

    res.download(filePath, item.documentName || path.basename(filePath));
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ success: false, message: "Download failed" });
  }
};



module.exports = {
  getAllStoreItems,
  getStoreItemById,
  getStoreStats,
  createStoreItem,
  updateStoreItem,
  deleteStoreItem,
  incrementDownloadCount,
  getFeaturedItems,
  getCategories,
  downloadStoreItem
};