const sequelize = require("../../database/connection");
const { Op } = require("sequelize");
const Email = require("../../models/Settings/email.model");

//! Get all emails with pagination and filters
const getAllEmails = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "", 
      status = "" 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { appName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    // Status filter
    if (status) {
      whereClause.isActive = status === "active";
    }

    const { count, rows } = await Email.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    const transformedEmails = rows.map((email) => ({
      id: email.id,
      appName: email.appName,
      email: email.email,
      emailAppPassword: email.emailAppPassword,
      isActive: email.isActive,
      createdAt: email.createdAt,
      updatedAt: email.updatedAt,
    }));

    return res.status(200).json({
      data: transformedEmails,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalItems: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting emails:", error);
    next(error);
  }
};

//! Get email by ID
const getEmailById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const email = await Email.findOne({
      where: { id },
    });

    if (!email) {
      return res.status(404).json({
        success: false,
        message: "Email configuration not found!",
      });
    }

    const transformedEmail = {
      id: email.id,
      appName: email.appName,
      email: email.email,
      emailAppPassword: email.emailAppPassword,
      isActive: email.isActive,
      createdAt: email.createdAt,
      updatedAt: email.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: "Email configuration retrieved successfully!",
      data: transformedEmail,
    });
  } catch (error) {
    console.error("Error getting email by ID:", error);
    next(error);
  }
};

//! Get email statistics
const getEmailStats = async (req, res, next) => {
  try {
    const totalEmails = await Email.count();
    const activeEmails = await Email.count({ where: { isActive: true } });
    const inactiveEmails = await Email.count({ where: { isActive: false } });

    return res.status(200).json({
      success: true,
      data: {
        totalEmails,
        activeEmails,
        inactiveEmails,
      },
    });
  } catch (error) {
    console.error("Error getting email stats:", error);
    next(error);
  }
};

//! Create new email configuration
const createEmail = async (req, res, next) => {
  try {
    const { appName, email, emailAppPassword, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    // Validate required fields
    if (!appName || !email || !emailAppPassword) {
      return res.status(400).json({
        success: false,
        message: "App name, email, and app password are required!",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address!",
      });
    }

    // Check if email already exists
    const existingEmail = await Email.findOne({
      where: { email },
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already exists!",
      });
    }

    // Check if app name already exists
    const existingAppName = await Email.findOne({
      where: { appName },
    });

    if (existingAppName) {
      return res.status(400).json({
        success: false,
        message: "App name already exists!",
      });
    }

    let emailData = {
      appName,
      email,
      emailAppPassword,
      isActive: isActive || false,
      createdBy: userEmail,
      updatedBy: userEmail,
    };

    // If activating this email, deactivate all other emails
    if (isActive) {
      // Deactivate all other emails
      await Email.update(
        { isActive: false, updatedBy: userEmail },
        {
          where: {
            id: { [Op.ne]: null },
            isActive: true,
          },
        }
      );
    }

    // Create new email
    const newEmail = await Email.create(emailData);

    const transformedEmail = {
      id: newEmail.id,
      appName: newEmail.appName,
      email: newEmail.email,
      emailAppPassword: newEmail.emailAppPassword,
      isActive: newEmail.isActive,
      createdAt: newEmail.createdAt,
      updatedAt: newEmail.updatedAt,
    };

    return res.status(201).json({
      success: true,
      message: "Email configuration created successfully!",
      data: transformedEmail,
    });
  } catch (error) {
    console.error("Error creating email:", error);
    next(error);
  }
};

//! Update email configuration
const updateEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { appName, email, emailAppPassword, isActive } = req.body;
    const userEmail = req.user?.email || "system";

    const existingEmail = await Email.findOne({
      where: { id },
    });

    if (!existingEmail) {
      return res.status(404).json({
        success: false,
        message: "Email configuration not found!",
      });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address!",
        });
      }

      // Check if email already exists (excluding current email)
      const emailExists = await Email.findOne({
        where: {
          email,
          id: { [Op.ne]: id },
        },
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already exists!",
        });
      }
    }

    // Check if app name already exists (excluding current email)
    if (appName) {
      const appNameExists = await Email.findOne({
        where: {
          appName,
          id: { [Op.ne]: id },
        },
      });

      if (appNameExists) {
        return res.status(400).json({
          success: false,
          message: "App name already exists!",
        });
      }
    }

    const updateData = {
      updatedBy: userEmail,
    };

    if (appName !== undefined) updateData.appName = appName;
    if (email !== undefined) updateData.email = email;
    if (emailAppPassword !== undefined) updateData.emailAppPassword = emailAppPassword;

    // If activating this email, deactivate all other emails
    if (isActive === true) {
      // Deactivate all other emails
      await Email.update(
        { isActive: false, updatedBy: userEmail },
        {
          where: {
            id: { [Op.ne]: id },
            isActive: true,
          },
        }
      );
      updateData.isActive = true;
    } else if (isActive === false) {
      // Check if this is the only active email
      const activeEmailsCount = await Email.count({
        where: {
          isActive: true,
          id: { [Op.ne]: id },
        },
      });

      updateData.isActive = false;
    }

    await Email.update(updateData, {
      where: { id },
    });

    const updatedEmail = await Email.findOne({
      where: { id },
    });

    const transformedEmail = {
      id: updatedEmail.id,
      appName: updatedEmail.appName,
      email: updatedEmail.email,
      emailAppPassword: updatedEmail.emailAppPassword,
      isActive: updatedEmail.isActive,
      createdAt: updatedEmail.createdAt,
      updatedAt: updatedEmail.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: "Email configuration updated successfully!",
      data: transformedEmail,
    });
  } catch (error) {
    console.error("Error updating email:", error);
    next(error);
  }
};

//! Delete email configuration
const deleteEmail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const email = await Email.findOne({
      where: { id },
    });

    if (!email) {
      return res.status(404).json({
        success: false,
        message: "Email configuration not found!",
      });
    }

    // Check if this is the only active email
    if (email.isActive) {
      const activeEmailsCount = await Email.count({
        where: {
          isActive: true,
          id: { [Op.ne]: id },
        },
      });
      
    }

    await Email.destroy({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Email configuration deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting email:", error);
    next(error);
  }
};

module.exports = {
  getAllEmails,
  getEmailById,
  getEmailStats,
  createEmail,
  updateEmail,
  deleteEmail,
};