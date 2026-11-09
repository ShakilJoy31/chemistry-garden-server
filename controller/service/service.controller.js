// controller/service/service.controller.js
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Service = require("../../models/service/service.model");
const SubService = require("../../models/service/sub-service.model");
const Student = require("../../models/students/student.model");

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

/* ---------- CODE GENERATION ----------
   Derives the next code from the HIGHEST existing code for the current
   year, not from count(). This survives deletions and gaps.
   A retry loop at the call site handles the rare race condition when
   two requests compute the same next value simultaneously. */

const nextCode = async (Model, field, prefix) => {
  const last = await Model.findOne({
    where: { [field]: { [Op.like]: `${prefix}%` } },
    order: [[field, "DESC"]],
    attributes: [field],
  });

  let next = 1;
  if (last && last[field]) {
    const n = parseInt(String(last[field]).replace(prefix, ""), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
};

const generateServiceCode = async () => {
  const year = new Date().getFullYear();
  return nextCode(Service, "serviceCode", `SVC-${year}-`);
};

const generateSubServiceCode = async () => {
  const year = new Date().getFullYear();
  return nextCode(SubService, "subServiceCode", `SUB-${year}-`);
};

/* ---------- INSERT WITH RETRY ----------
   Attempts the insert up to N times. Only retries when MySQL rejects
   with a unique-constraint violation on the code field. Any other
   error propagates immediately. */

const CODE_RETRY_MAX = 5;
const CODE_RETRY_JITTER_MS = 40;

const createWithCodeRetry = async ({
  Model,
  codeField,
  generateCode,
  payload,
  maxAttempts = CODE_RETRY_MAX,
}) => {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const code = await generateCode();
      return await Model.create({ ...payload, [codeField]: code });
    } catch (err) {
      const isCodeCollision =
        err?.name === "SequelizeUniqueConstraintError" &&
        Array.isArray(err?.errors) &&
        err.errors.some((e) => e.path === codeField);

      if (!isCodeCollision) throw err;

      lastErr = err;
      // Jitter so parallel callers don't all retry on the same tick.
      await new Promise((r) =>
        setTimeout(r, 20 + Math.random() * CODE_RETRY_JITTER_MS)
      );
    }
  }
  throw lastErr || new Error(`Failed to generate unique ${codeField} after retries`);
};

const parseAssignedStudents = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((x) => !isNaN(x));
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((x) => Number(x)).filter((x) => !isNaN(x))
        : [];
    } catch {
      return [];
    }
  }
  return [];
};

/* ============================================================
   SERVICE — CRUD
============================================================ */

const createService = async (req, res, next) => {
  try {
    const {
      title,
      description,
      shortDescription,
      image,
      icon,
      isActive = true,
      displayOrder = 0,
      assignedStudents = [],
      metaTitle,
      metaDescription,
    } = req.body;

    if (!title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Service title is required!" });
    }

    const slug = await generateUniqueSlug(title, Service);

    const payload = {
      title: title.trim(),
      slug,
      description: description || null,
      shortDescription: shortDescription || null,
      image: image || null,
      icon: icon || null,
      isActive,
      displayOrder: parseInt(displayOrder) || 0,
      assignedStudents: parseAssignedStudents(assignedStudents),
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      createdBy: req.user?.id || null,
    };

    const service = await createWithCodeRetry({
      Model: Service,
      codeField: "serviceCode",
      generateCode: generateServiceCode,
      payload,
    });

    return res.status(201).json({
      success: true,
      message: "Service created successfully!",
      data: service,
    });
  } catch (error) {
    console.error("Error creating service:", error);
    next(error);
  }
};

const getAllServices = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive = "",
      includeSubServices = "false",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { serviceCode: { [Op.like]: `%${search}%` } },
      ];
    }
    if (isActive !== "" && isActive !== undefined) {
      where.isActive = isActive === "true" || isActive === true;
    }

    const { count, rows } = await Service.findAndCountAll({
      where,
      limit: limitNumber,
      offset,
      order: [
        ["displayOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    // Manually enrich (no associations)
    const enriched = await Promise.all(
      rows.map(async (svc) => {
        const data = svc.toJSON();
        data.subServicesCount = await SubService.count({
          where: { serviceId: svc.id },
        });
        if (includeSubServices === "true") {
          data.subServices = await SubService.findAll({
            where: { serviceId: svc.id },
            order: [
              ["displayOrder", "ASC"],
              ["createdAt", "DESC"],
            ],
          });
        }
        return data;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Services retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting services:", error);
    next(error);
  }
};

const getServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findOne({ where: { id } });

    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found!" });
    }

    // Manually fetch sub-services
    const subServices = await SubService.findAll({
      where: { serviceId: service.id },
      order: [
        ["displayOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    const data = service.toJSON();
    data.subServices = subServices;

    return res.status(200).json({
      success: true,
      message: "Service retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting service:", error);
    next(error);
  }
};

const getServiceBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const service = await Service.findOne({
      where: { slug, isActive: true },
    });

    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found!" });
    }

    const subServices = await SubService.findAll({
      where: { serviceId: service.id, isActive: true },
      order: [["displayOrder", "ASC"]],
    });

    const data = service.toJSON();
    data.subServices = subServices;

    return res.status(200).json({
      success: true,
      message: "Service retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting service by slug:", error);
    next(error);
  }
};

const updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existing = await Service.findOne({ where: { id } });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found!" });
    }

    if (updateData.title && updateData.title !== existing.title) {
      updateData.slug = await generateUniqueSlug(
        updateData.title,
        Service,
        parseInt(id)
      );
    }
    if (updateData.assignedStudents !== undefined) {
      updateData.assignedStudents = parseAssignedStudents(
        updateData.assignedStudents
      );
    }
    if (updateData.displayOrder !== undefined) {
      updateData.displayOrder = parseInt(updateData.displayOrder) || 0;
    }
    updateData.updatedBy = req.user?.id || null;

    await Service.update(updateData, { where: { id } });
    const updated = await Service.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Service updated successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating service:", error);
    next(error);
  }
};

const deleteService = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const existing = await Service.findOne({ where: { id }, transaction });
    if (!existing) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Service not found!" });
    }

    // Manually cascade delete
    await SubService.destroy({ where: { serviceId: id }, transaction });
    await Service.destroy({ where: { id }, transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Service and its sub-services deleted successfully!",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting service:", error);
    next(error);
  }
};

const toggleServiceActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findOne({ where: { id } });

    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found!" });
    }

    service.isActive = !service.isActive;
    service.updatedBy = req.user?.id || null;
    await service.save();

    return res.status(200).json({
      success: true,
      message: `Service ${service.isActive ? "activated" : "deactivated"} successfully!`,
      data: service,
    });
  } catch (error) {
    console.error("Error toggling service:", error);
    next(error);
  }
};

const assignStudentsToService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentIds = [] } = req.body;

    if (!Array.isArray(studentIds)) {
      return res
        .status(400)
        .json({ success: false, message: "studentIds must be an array!" });
    }

    const service = await Service.findOne({ where: { id } });
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found!" });
    }

    if (studentIds.length > 0) {
      const valid = await Student.findAll({
        where: { id: { [Op.in]: studentIds } },
        attributes: ["id"],
      });
      const validIds = valid.map((s) => s.id);
      const invalid = studentIds.filter((sid) => !validIds.includes(sid));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid student IDs: ${invalid.join(", ")}`,
        });
      }
    }

    service.assignedStudents = studentIds;
    service.updatedBy = req.user?.id || null;
    await service.save();

    return res.status(200).json({
      success: true,
      message: `Assigned ${studentIds.length} student(s) to service!`,
      data: service,
    });
  } catch (error) {
    console.error("Error assigning students:", error);
    next(error);
  }
};

const getServiceStats = async (req, res, next) => {
  try {
    const total = await Service.count();
    const active = await Service.count({ where: { isActive: true } });
    const inactive = await Service.count({ where: { isActive: false } });
    const totalSubServices = await SubService.count();

    return res.status(200).json({
      success: true,
      message: "Service stats retrieved successfully!",
      data: { total, active, inactive, totalSubServices },
    });
  } catch (error) {
    console.error("Error getting service stats:", error);
    next(error);
  }
};

/* ============================================================
   PUBLIC
============================================================ */

const getPublicServices = async (req, res, next) => {
  try {
    const services = await Service.findAll({
      where: { isActive: true },
      order: [["displayOrder", "ASC"]],
    });

    // Manually attach active sub-services
    const withSubs = await Promise.all(
      services.map(async (svc) => {
        const data = svc.toJSON();
        data.subServices = await SubService.findAll({
          where: { serviceId: svc.id, isActive: true },
          order: [["displayOrder", "ASC"]],
        });
        return data;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Public services retrieved successfully!",
      data: withSubs,
    });
  } catch (error) {
    console.error("Error getting public services:", error);
    next(error);
  }
};

/* ============================================================
   SUB-SERVICE — CRUD
============================================================ */

const createSubService = async (req, res, next) => {
  try {
    const {
      serviceId,
      title,
      description,
      shortDescription,
      image,
      icon,
      isActive = true,
      displayOrder = 0,
      assignedStudents = [],
      metaTitle,
      metaDescription,
    } = req.body;

    if (!serviceId) {
      return res
        .status(400)
        .json({ success: false, message: "serviceId is required!" });
    }
    if (!title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Sub-service title is required!" });
    }

    const parent = await Service.findOne({ where: { id: serviceId } });
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent service not found!",
      });
    }

    const slug = await generateUniqueSlug(title, SubService);

    const payload = {
      serviceId: parseInt(serviceId),
      title: title.trim(),
      slug,
      description: description || null,
      shortDescription: shortDescription || null,
      image: image || null,
      icon: icon || null,
      isActive,
      displayOrder: parseInt(displayOrder) || 0,
      assignedStudents: parseAssignedStudents(assignedStudents),
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      createdBy: req.user?.id || null,
    };

    const subService = await createWithCodeRetry({
      Model: SubService,
      codeField: "subServiceCode",
      generateCode: generateSubServiceCode,
      payload,
    });

    return res.status(201).json({
      success: true,
      message: "Sub-service created successfully!",
      data: subService,
    });
  } catch (error) {
    console.error("Error creating sub-service:", error);
    next(error);
  }
};

const getAllSubServices = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      serviceId = "",
      isActive = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { subServiceCode: { [Op.like]: `%${search}%` } },
      ];
    }
    if (serviceId) where.serviceId = parseInt(serviceId);
    if (isActive !== "" && isActive !== undefined) {
      where.isActive = isActive === "true" || isActive === true;
    }

    const { count, rows } = await SubService.findAndCountAll({
      where,
      limit: limitNumber,
      offset,
      order: [
        ["displayOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    // Manually fetch parent service for each row
    const enriched = await Promise.all(
      rows.map(async (sub) => {
        const data = sub.toJSON();
        const parent = await Service.findOne({
          where: { id: sub.serviceId },
          attributes: ["id", "title", "serviceCode"],
        });
        data.service = parent;
        return data;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Sub-services retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting sub-services:", error);
    next(error);
  }
};

const getSubServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subService = await SubService.findOne({ where: { id } });

    if (!subService) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-service not found!" });
    }

    const parent = await Service.findOne({
      where: { id: subService.serviceId },
      attributes: ["id", "title", "serviceCode"],
    });

    const data = subService.toJSON();
    data.service = parent;

    return res.status(200).json({
      success: true,
      message: "Sub-service retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting sub-service:", error);
    next(error);
  }
};

const updateSubService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existing = await SubService.findOne({ where: { id } });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-service not found!" });
    }

    if (updateData.title && updateData.title !== existing.title) {
      updateData.slug = await generateUniqueSlug(
        updateData.title,
        SubService,
        parseInt(id)
      );
    }
    if (updateData.assignedStudents !== undefined) {
      updateData.assignedStudents = parseAssignedStudents(
        updateData.assignedStudents
      );
    }
    if (updateData.displayOrder !== undefined) {
      updateData.displayOrder = parseInt(updateData.displayOrder) || 0;
    }
    updateData.updatedBy = req.user?.id || null;

    await SubService.update(updateData, { where: { id } });
    const updated = await SubService.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Sub-service updated successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating sub-service:", error);
    next(error);
  }
};

const deleteSubService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await SubService.findOne({ where: { id } });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-service not found!" });
    }

    await SubService.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Sub-service deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting sub-service:", error);
    next(error);
  }
};

const toggleSubServiceActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subService = await SubService.findOne({ where: { id } });

    if (!subService) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-service not found!" });
    }

    subService.isActive = !subService.isActive;
    subService.updatedBy = req.user?.id || null;
    await subService.save();

    return res.status(200).json({
      success: true,
      message: `Sub-service ${subService.isActive ? "activated" : "deactivated"} successfully!`,
      data: subService,
    });
  } catch (error) {
    console.error("Error toggling sub-service:", error);
    next(error);
  }
};

const assignStudentsToSubService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentIds = [] } = req.body;

    if (!Array.isArray(studentIds)) {
      return res
        .status(400)
        .json({ success: false, message: "studentIds must be an array!" });
    }

    const subService = await SubService.findOne({ where: { id } });
    if (!subService) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-service not found!" });
    }

    if (studentIds.length > 0) {
      const valid = await Student.findAll({
        where: { id: { [Op.in]: studentIds } },
        attributes: ["id"],
      });
      const validIds = valid.map((s) => s.id);
      const invalid = studentIds.filter((sid) => !validIds.includes(sid));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid student IDs: ${invalid.join(", ")}`,
        });
      }
    }

    subService.assignedStudents = studentIds;
    subService.updatedBy = req.user?.id || null;
    await subService.save();

    return res.status(200).json({
      success: true,
      message: `Assigned ${studentIds.length} student(s) to sub-service!`,
      data: subService,
    });
  } catch (error) {
    console.error("Error assigning students to sub-service:", error);
    next(error);
  }
};

module.exports = {
  // Service
  createService,
  getAllServices,
  getServiceById,
  getServiceBySlug,
  updateService,
  deleteService,
  toggleServiceActive,
  assignStudentsToService,
  getServiceStats,
  getPublicServices,
  // Sub-Service
  createSubService,
  getAllSubServices,
  getSubServiceById,
  updateSubService,
  deleteSubService,
  toggleSubServiceActive,
  assignStudentsToSubService,
};