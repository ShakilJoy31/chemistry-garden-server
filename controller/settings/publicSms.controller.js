const { Op } = require("sequelize");
const PublicSms = require("../../models/Settings/publicSms.model");


//! Create public SMS (public)
const createPublicSms = async (req, res) => {
  try {
    const { name, email, phone, country, subject, message } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    // Create new public SMS
    const newSms = await PublicSms.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : null,
      country: country ? country.trim() : null,
      subject: subject ? subject.trim() : null,
      message: message.trim(),
      isRead: false,
      isReplied: false,
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully! We will get back to you soon.",
      data: newSms
    });
  } catch (error) {
    console.error('Create Public SMS Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get all public SMS (admin)
const getAllPublicSms = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "",
      isRead = "all",
      isReplied = "all"
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Filter by read status
    if (isRead === "true") {
      whereClause.isRead = true;
    } else if (isRead === "false") {
      whereClause.isRead = false;
    }

    // Filter by replied status
    if (isReplied === "true") {
      whereClause.isReplied = true;
    } else if (isReplied === "false") {
      whereClause.isReplied = false;
    }

    // Add search filter if provided
    if (search && search.trim() !== "") {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { email: { [Op.like]: `%${search.trim()}%` } },
        { subject: { [Op.like]: `%${search.trim()}%` } },
        { message: { [Op.like]: `%${search.trim()}%` } },
        { phone: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    // Get total count for pagination
    const totalItems = await PublicSms.count({
      where: whereClause
    });

    // Get paginated results
    const smsList = await PublicSms.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

    return res.status(200).json({
      success: true,
      data: smsList,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get All Public SMS Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get single public SMS (admin)
const getPublicSmsById = async (req, res) => {
  try {
    const { id } = req.params;

    const sms = await PublicSms.findByPk(id);
    if (!sms) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    // Mark as read if not already
    if (!sms.isRead) {
      await sms.update({ isRead: true });
    }

    return res.status(200).json({
      success: true,
      data: sms
    });
  } catch (error) {
    console.error('Get Public SMS By ID Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch message",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Update public SMS (admin)
const updatePublicSms = async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead, isReplied, replyMessage } = req.body;

    const sms = await PublicSms.findByPk(id);
    if (!sms) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const updateData = {};
    if (isRead !== undefined) updateData.isRead = isRead;
    if (isReplied !== undefined) {
      updateData.isReplied = isReplied;
      if (isReplied === true) {
        updateData.repliedAt = new Date();
      }
    }
    if (replyMessage !== undefined) updateData.replyMessage = replyMessage;

    await sms.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Message updated successfully",
      data: sms
    });
  } catch (error) {
    console.error('Update Public SMS Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to update message",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Delete public SMS (admin)
const deletePublicSms = async (req, res) => {
  try {
    const { id } = req.params;

    const sms = await PublicSms.findByPk(id);
    if (!sms) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    await sms.destroy();

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully"
    });
  } catch (error) {
    console.error('Delete Public SMS Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete message",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get public SMS statistics (admin)
const getPublicSmsStats = async (req, res) => {
  try {
    const total = await PublicSms.count();
    const unread = await PublicSms.count({ where: { isRead: false } });
    const read = await PublicSms.count({ where: { isRead: true } });
    const replied = await PublicSms.count({ where: { isReplied: true } });
    const unreplied = await PublicSms.count({ where: { isReplied: false } });

    // Get last 7 days stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const last7Days = await PublicSms.count({
      where: {
        createdAt: {
          [Op.gte]: sevenDaysAgo
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        total,
        unread,
        read,
        replied,
        unreplied,
        last7Days,
        responseRate: total > 0 ? Math.round((replied / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Get Public SMS Stats Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createPublicSms,
  getAllPublicSms,
  getPublicSmsById,
  updatePublicSms,
  deletePublicSms,
  getPublicSmsStats
};