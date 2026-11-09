const { Op } = require("sequelize");
const WhatsAppNumber = require("../../models/Settings/whatsappNumber.model");


//! Get all WhatsApp numbers with search and pagination
const getAllWhatsAppNumbers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "" 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Add search filter if provided
    if (search && search.trim() !== "") {
      whereClause.whatsappNumber = {
        [Op.like]: `%${search.trim()}%`
      };
    }

    // Get total count for pagination
    const totalItems = await WhatsAppNumber.count({
      where: whereClause
    });

    // Get paginated results
    const numbers = await WhatsAppNumber.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

    return res.status(200).json({
      success: true,
      data: numbers,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get All WhatsApp Numbers Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch WhatsApp numbers",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get active WhatsApp number
const getActiveWhatsAppNumber = async (req, res) => {
  try {
    const activeNumber = await WhatsAppNumber.findOne({
      where: { isActive: true }
    });

    return res.status(200).json({
      success: true,
      data: activeNumber || null
    });
  } catch (error) {
    console.error('Get Active WhatsApp Number Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active WhatsApp number",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Create a new WhatsApp number
const createWhatsAppNumber = async (req, res) => {
  try {
    const { whatsappNumber, message, isActive } = req.body;

    // Validate input
    if (!whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp number is required"
      });
    }

    // Check if number already exists
    const existingNumber = await WhatsAppNumber.findOne({
      where: { whatsappNumber }
    });

    if (existingNumber) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp number already exists"
      });
    }

    // If setting this number as active, deactivate all others
    if (isActive) {
      await WhatsAppNumber.update(
        { isActive: false },
        { where: {} }
      );
    }

    // Create new number
    const newNumber = await WhatsAppNumber.create({
      whatsappNumber,
      message: message || 'Hello! I would like to get more information about ISAB accreditation services.',
      isActive: isActive || false
    });

    return res.status(201).json({
      success: true,
      message: "WhatsApp number created successfully",
      data: newNumber
    });
  } catch (error) {
    console.error('Create WhatsApp Number Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to create WhatsApp number",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Update WhatsApp number
const updateWhatsAppNumber = async (req, res) => {
  try {
    const { id } = req.params;
    const { whatsappNumber, message, isActive } = req.body;

    // Find the number
    const number = await WhatsAppNumber.findByPk(id);
    if (!number) {
      return res.status(404).json({
        success: false,
        message: "WhatsApp number not found"
      });
    }

    // If updating number and it already exists in another record
    if (whatsappNumber && whatsappNumber !== number.whatsappNumber) {
      const existingNumber = await WhatsAppNumber.findOne({
        where: { 
          whatsappNumber,
          id: { [Op.ne]: id }
        }
      });

      if (existingNumber) {
        return res.status(400).json({
          success: false,
          message: "WhatsApp number already exists"
        });
      }
    }

    // If setting this number as active, deactivate all others
    if (isActive) {
      await WhatsAppNumber.update(
        { isActive: false },
        { where: { id: { [Op.ne]: id } } }
      );
    }

    // Update the number
    await number.update({
      whatsappNumber: whatsappNumber || number.whatsappNumber,
      message: message !== undefined ? message : number.message,
      isActive: isActive !== undefined ? isActive : number.isActive
    });

    return res.status(200).json({
      success: true,
      message: "WhatsApp number updated successfully",
      data: number
    });
  } catch (error) {
    console.error('Update WhatsApp Number Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to update WhatsApp number",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Delete WhatsApp number
const deleteWhatsAppNumber = async (req, res) => {
  try {
    const { id } = req.params;

    const number = await WhatsAppNumber.findByPk(id);
    if (!number) {
      return res.status(404).json({
        success: false,
        message: "WhatsApp number not found"
      });
    }

    // If this is the active number, find another to make active
    if (number.isActive) {
      const anotherNumber = await WhatsAppNumber.findOne({
        where: { id: { [Op.ne]: id } },
        order: [['createdAt', 'DESC']]
      });

      if (anotherNumber) {
        await anotherNumber.update({ isActive: true });
      }
    }

    await number.destroy();

    return res.status(200).json({
      success: true,
      message: "WhatsApp number deleted successfully"
    });
  } catch (error) {
    console.error('Delete WhatsApp Number Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete WhatsApp number",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Set a WhatsApp number as active (toggle)
const setActiveWhatsAppNumber = async (req, res) => {
  try {
    const { id } = req.params;

    const number = await WhatsAppNumber.findByPk(id);
    if (!number) {
      return res.status(404).json({
        success: false,
        message: "WhatsApp number not found"
      });
    }

    // Deactivate all numbers
    await WhatsAppNumber.update(
      { isActive: false },
      { where: {} }
    );

    // Activate the selected number
    await number.update({ isActive: true });

    return res.status(200).json({
      success: true,
      message: "WhatsApp number set as active successfully",
      data: number
    });
  } catch (error) {
    console.error('Set Active WhatsApp Number Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to set active WhatsApp number",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get active WhatsApp number with message for frontend
const getActiveWhatsAppNumberForFrontend = async (req, res) => {
  try {
    const activeNumber = await WhatsAppNumber.findOne({
      where: { isActive: true },
      attributes: ['whatsappNumber', 'message']
    });

    if (!activeNumber) {
      return res.status(404).json({
        success: false,
        message: "No active WhatsApp number found"
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        whatsappNumber: activeNumber.whatsappNumber,
        message: activeNumber.message || 'Hello! I would like to get more information about ISAB accreditation services.'
      }
    });
  } catch (error) {
    console.error('Get Active WhatsApp Number For Frontend Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active WhatsApp number",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Middleware to get active WhatsApp number for other routes
const getActiveNumberMiddleware = async (req, res, next) => {
  try {
    const activeNumber = await WhatsAppNumber.findOne({
      where: { isActive: true }
    });

    if (!activeNumber) {
      return res.status(404).json({
        success: false,
        message: "No active WhatsApp number found"
      });
    }

    req.activeWhatsAppNumber = activeNumber;
    next();
  } catch (error) {
    console.error('Get Active WhatsApp Number Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active WhatsApp number"
    });
  }
};

module.exports = {
  getAllWhatsAppNumbers,
  getActiveWhatsAppNumber,
  createWhatsAppNumber,
  updateWhatsAppNumber,
  deleteWhatsAppNumber,
  setActiveWhatsAppNumber,
  getActiveNumberMiddleware,
  getActiveWhatsAppNumberForFrontend
};