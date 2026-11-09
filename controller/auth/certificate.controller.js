// controller/certificate/certificate.controller.js
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Certificate = require("../../models/Authentication/certificate.model");

//! Helper function to transform certificate response
const transformCertificateResponse = (certificate) => {
  const certificateData = certificate.toJSON ? certificate.toJSON() : certificate;
  
  // Check if certificate is expired
  const currentDate = new Date();
  const expiryDate = new Date(certificateData.expiryDate);
  
  if (expiryDate < currentDate && certificateData.status === "active") {
    certificateData.status = "expired";
  }
  
  // Add days remaining
  const daysRemaining = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
  certificateData.daysRemaining = daysRemaining > 0 ? daysRemaining : 0;
  certificateData.isExpired = expiryDate < currentDate;
  
  // Format dates
  if (certificateData.issueDate) {
    certificateData.formattedIssueDate = new Date(certificateData.issueDate).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  if (certificateData.expiryDate) {
    certificateData.formattedExpiryDate = new Date(certificateData.expiryDate).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  if (certificateData.registrationDate) {
    certificateData.formattedRegistrationDate = new Date(certificateData.registrationDate).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  return certificateData;
};

//! Create new certificate
const createCertificate = async (req, res, next) => {
  try {
    const {
      name,
      address,
      standard,
      accreditationBody,
      certificationBody,
      country,
      scope,
      certificateNumber,
      issueDate,
      registrationDate,
      expiryDate,
      certificateFile,
      logo,
      status = "active",
      notes,
    } = req.body;

    // Validate required fields
    if (!name || !address || !standard || !accreditationBody || !certificationBody || 
        !country || !scope || !certificateNumber || !issueDate || !registrationDate || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled!",
      });
    }

    // Check if certificate number already exists
    const certExists = await Certificate.findOne({ where: { certificateNumber } });
    if (certExists) {
      return res.status(409).json({
        success: false,
        message: "Certificate number already exists!",
      });
    }

    // Create new certificate
    const newCertificate = await Certificate.create({
      name,
      address,
      standard,
      accreditationBody,
      certificationBody,
      country,
      scope,
      certificateNumber,
      issueDate,
      registrationDate,
      expiryDate,
      certificateFile: certificateFile || null,
      logo: logo || null,
      status,
      createdBy: req.user?.id || null,
      notes: notes || null,
    });

    // Transform response
    const certificateData = transformCertificateResponse(newCertificate);

    return res.status(201).json({
      success: true,
      message: "Certificate created successfully!",
      data: certificateData,
    });
  } catch (error) {
    console.error("Error creating certificate:", error);
    next(error);
  }
};

//! Get all certificates with pagination and filtering
const getAllCertificates = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      country = "",
      isExpired = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { certificateNumber: { [Op.like]: `%${search}%` } },
        { standard: { [Op.like]: `%${search}%` } },
        { accreditationBody: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    // Add country filter
    if (country) {
      whereClause.country = { [Op.like]: `%${country}%` };
    }

    // Add expiry filter
    if (isExpired === "true") {
      whereClause.expiryDate = { [Op.lt]: new Date() };
    } else if (isExpired === "false") {
      whereClause.expiryDate = { [Op.gte]: new Date() };
    }

    const { count, rows: certificates } = await Certificate.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    // Transform each certificate
    const transformedCertificates = certificates.map(certificate => 
      transformCertificateResponse(certificate)
    );

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Certificates retrieved successfully!",
      data: transformedCertificates,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting certificates:", error);
    next(error);
  }
};

//! Get certificate by ID
const getCertificateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const certificate = await Certificate.findOne({ where: { id } });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found!",
      });
    }

    // Transform response
    const certificateData = transformCertificateResponse(certificate);

    return res.status(200).json({
      success: true,
      message: "Certificate retrieved successfully!",
      data: certificateData,
    });
  } catch (error) {
    console.error("Error getting certificate by ID:", error);
    next(error);
  }
};

//! Get certificate by certificate number (public verification)
const getCertificateByNumber = async (req, res, next) => {
  try {
    const { certificateNumber } = req.params;
    const certificate = await Certificate.findOne({ where: { certificateNumber } });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found!",
        isValid: false,
      });
    }

    // Transform response
    const certificateData = transformCertificateResponse(certificate);
    
    // Check if certificate is valid
    const isValid = certificateData.status === "active" && !certificateData.isExpired;

    return res.status(200).json({
      success: true,
      message: isValid ? "Certificate is valid" : "Certificate is invalid or expired",
      isValid,
      data: certificateData,
    });
  } catch (error) {
    console.error("Error getting certificate by number:", error);
    next(error);
  }
};

//! Update certificate
const updateCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if certificate exists
    const existingCertificate = await Certificate.findOne({ where: { id } });
    if (!existingCertificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found!",
      });
    }

    // Check if certificate number already exists (if changed)
    if (updateData.certificateNumber && updateData.certificateNumber !== existingCertificate.certificateNumber) {
      const certExists = await Certificate.findOne({ 
        where: { certificateNumber: updateData.certificateNumber } 
      });
      if (certExists) {
        return res.status(409).json({
          success: false,
          message: "Certificate number already exists!",
        });
      }
    }

    // Perform update
    await Certificate.update(updateData, {
      where: { id },
    });

    // Fetch updated certificate
    const updatedCertificate = await Certificate.findOne({ where: { id } });

    // Transform response
    const certificateData = transformCertificateResponse(updatedCertificate);

    return res.status(200).json({
      success: true,
      message: "Certificate updated successfully!",
      data: certificateData,
    });
  } catch (error) {
    console.error("Error updating certificate:", error);
    next(error);
  }
};

//! Delete certificate
const deleteCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingCertificate = await Certificate.findOne({ where: { id } });

    if (!existingCertificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found!",
      });
    }

    await Certificate.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Certificate deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    next(error);
  }
};

//! Update certificate status
const updateCertificateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const certificate = await Certificate.findOne({ where: { id } });
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found!",
      });
    }

    await Certificate.update({ status }, { where: { id } });

    // Fetch updated certificate
    const updatedCertificate = await Certificate.findOne({ where: { id } });

    // Transform response
    const certificateData = transformCertificateResponse(updatedCertificate);

    return res.status(200).json({
      success: true,
      message: `Certificate ${status} successfully!`,
      data: certificateData,
    });
  } catch (error) {
    console.error("Error updating certificate status:", error);
    next(error);
  }
};

//! Verify certificate (mark as verified)
const verifyCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    const certificate = await Certificate.findOne({ where: { id } });
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found!",
      });
    }

    await Certificate.update(
      { 
        isVerified: isVerified || true, 
        verifiedAt: isVerified ? new Date() : null 
      }, 
      { where: { id } }
    );

    // Fetch updated certificate
    const updatedCertificate = await Certificate.findOne({ where: { id } });

    // Transform response
    const certificateData = transformCertificateResponse(updatedCertificate);

    return res.status(200).json({
      success: true,
      message: `Certificate ${isVerified ? "verified" : "unverified"} successfully!`,
      data: certificateData,
    });
  } catch (error) {
    console.error("Error verifying certificate:", error);
    next(error);
  }
};

//! Get certificate statistics
const getCertificateStats = async (req, res, next) => {
  try {
    const totalCertificates = await Certificate.count();
    const activeCertificates = await Certificate.count({
      where: { status: "active" },
    });
    const expiredCertificates = await Certificate.count({
      where: { status: "expired" },
    });
    const suspendedCertificates = await Certificate.count({
      where: { status: "suspended" },
    });
    const verifiedCertificates = await Certificate.count({
      where: { isVerified: true },
    });

    // Count by country
    const byCountry = await Certificate.findAll({
      attributes: [
        "country",
        [sequelize.fn("COUNT", sequelize.col("country")), "count"],
      ],
      group: ["country"],
    });

    // Count by standard
    const byStandard = await Certificate.findAll({
      attributes: [
        "standard",
        [sequelize.fn("COUNT", sequelize.col("standard")), "count"],
      ],
      group: ["standard"],
    });

    // Certificates expiring in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringSoon = await Certificate.count({
      where: {
        expiryDate: {
          [Op.between]: [new Date(), thirtyDaysFromNow],
        },
        status: "active",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Certificate statistics retrieved successfully!",
      data: {
        total: totalCertificates,
        active: activeCertificates,
        expired: expiredCertificates,
        suspended: suspendedCertificates,
        verified: verifiedCertificates,
        expiringSoon,
        byCountry,
        byStandard,
      },
    });
  } catch (error) {
    console.error("Error getting certificate stats:", error);
    next(error);
  }
};

//! Get certificates by company name
const getCertificatesByCompany = async (req, res, next) => {
  try {
    const { companyName } = req.params;
    
    const certificates = await Certificate.findAll({
      where: {
        name: { [Op.like]: `%${companyName}%` },
      },
      order: [["createdAt", "DESC"]],
    });

    const transformedCertificates = certificates.map(certificate => 
      transformCertificateResponse(certificate)
    );

    return res.status(200).json({
      success: true,
      message: "Certificates retrieved successfully!",
      data: transformedCertificates,
    });
  } catch (error) {
    console.error("Error getting certificates by company:", error);
    next(error);
  }
};

module.exports = {
  createCertificate,
  getAllCertificates,
  getCertificateById,
  getCertificateByNumber,
  updateCertificate,
  deleteCertificate,
  updateCertificateStatus,
  verifyCertificate,
  getCertificateStats,
  getCertificatesByCompany,
};