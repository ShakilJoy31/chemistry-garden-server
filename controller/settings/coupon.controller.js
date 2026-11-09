// controller/settings/coupon.controller.js
const { Op } = require("sequelize");
const Coupon = require("../../models/Settings/coupon.model");
const sequelize = require("../../database/connection");

//! Get all coupons with search and pagination
const getAllCoupons = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive = "",
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Add search filter
    if (search && search.trim() !== "") {
      whereClause[Op.or] = [
        { couponCode: { [Op.like]: `%${search.trim()}%` } },
        { description: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    // Add status filter
    if (isActive !== "") {
      whereClause.isActive = isActive === "true";
    }

    // Get total count for pagination
    const totalItems = await Coupon.count({
      where: whereClause
    });

    // Get paginated results
    const coupons = await Coupon.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

    // Calculate stats
    const stats = {
      total: await Coupon.count(),
      active: await Coupon.count({ where: { isActive: true } }),
      inactive: await Coupon.count({ where: { isActive: false } }),
    };

    return res.status(200).json({
      success: true,
      data: coupons,
      stats,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get All Coupons Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get single coupon by ID
const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findByPk(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: coupon
    });
  } catch (error) {
    console.error('Get Coupon By ID Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupon",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get coupon by code (public) - MySQL compatible
const getCouponByCode = async (req, res) => {
  try {
    const { code } = req.params;

    // MySQL/MariaDB doesn't support ILIKE, use LIKE with case-insensitive approach
    // Option 1: Use LOWER() for case-insensitive comparison
    const coupon = await Coupon.findOne({
      where: {
        [Op.and]: [
          sequelize.where(
            sequelize.fn('LOWER', sequelize.col('couponCode')),
            code.toLowerCase()
          ),
          { isActive: true }
        ]
      }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid or inactive coupon code"
      });
    }

    return res.status(200).json({
      success: true,
      data: coupon,
      isValid: true,
      message: "Coupon is valid"
    });
  } catch (error) {
    console.error('Get Coupon By Code Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Create a new coupon
const createCoupon = async (req, res) => {
  try {
    const { couponCode, discountPercentage, isActive, description } = req.body;

    // Validate input
    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required"
      });
    }

    if (discountPercentage === undefined || discountPercentage === null) {
      return res.status(400).json({
        success: false,
        message: "Discount percentage is required"
      });
    }

    if (discountPercentage < 0 || discountPercentage > 100) {
      return res.status(400).json({
        success: false,
        message: "Discount percentage must be between 0 and 100"
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({
      where: { couponCode: couponCode.toUpperCase() }
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists"
      });
    }

    // Create new coupon
    const newCoupon = await Coupon.create({
      couponCode: couponCode.toUpperCase(),
      discountPercentage: parseInt(discountPercentage),
      isActive: isActive !== undefined ? isActive : true,
      description: description || null
    });

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: newCoupon
    });
  } catch (error) {
    console.error('Create Coupon Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to create coupon",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Update coupon
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { couponCode, discountPercentage, isActive, description } = req.body;

    // Find the coupon
    const coupon = await Coupon.findByPk(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found"
      });
    }

    // Check if coupon code already exists (excluding current)
    if (couponCode && couponCode.toUpperCase() !== coupon.couponCode) {
      const existingCoupon = await Coupon.findOne({
        where: {
          couponCode: couponCode.toUpperCase(),
          id: { [Op.ne]: id }
        }
      });

      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists"
        });
      }
    }

    // Update the coupon
    await coupon.update({
      couponCode: couponCode ? couponCode.toUpperCase() : coupon.couponCode,
      discountPercentage: discountPercentage !== undefined ? parseInt(discountPercentage) : coupon.discountPercentage,
      isActive: isActive !== undefined ? isActive : coupon.isActive,
      description: description !== undefined ? description : coupon.description
    });

    return res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon
    });
  } catch (error) {
    console.error('Update Coupon Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to update coupon",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findByPk(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found"
      });
    }

    await coupon.destroy();

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully"
    });
  } catch (error) {
    console.error('Delete Coupon Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Toggle coupon status
const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findByPk(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found"
      });
    }

    await coupon.update({
      isActive: !coupon.isActive
    });

    return res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      data: coupon
    });
  } catch (error) {
    console.error('Toggle Coupon Status Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle coupon status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Validate coupon (public) - Alternative using LIKE
const validateCoupon = async (req, res) => {
  try {
    const { code, totalAmount, applicableTo } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required"
      });
    }

    // Using LIKE for MySQL - case insensitive by default with most collations
    const coupon = await Coupon.findOne({
      where: {
        couponCode: { [Op.like]: code },
        isActive: true
      }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid or inactive coupon code"
      });
    }

    // Calculate discount
    let discountAmount = 0;
    let finalAmount = totalAmount || 0;

    if (totalAmount && totalAmount > 0) {
      discountAmount = totalAmount * (coupon.discountPercentage / 100);
      finalAmount = totalAmount - discountAmount;
    }

    return res.status(200).json({
      success: true,
      message: "Coupon is valid",
      data: {
        coupon: coupon,
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalAmount: Math.round(finalAmount * 100) / 100,
        isValid: true
      }
    });
  } catch (error) {
    console.error('Validate Coupon Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllCoupons,
  getCouponById,
  getCouponByCode,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  validateCoupon,
};

