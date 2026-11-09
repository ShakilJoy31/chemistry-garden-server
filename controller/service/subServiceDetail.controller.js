// controller/service/subServiceDetail.controller.js
const SubServiceDetail = require("../../models/service/sub-service-detail.model");
const SubService = require("../../models/service/sub-service.model");

const JSON_FIELDS = [
  "atAGlance",
  "whoNeedsIt",
  "processSteps",
  "deliverables",
  "benefits",
  "faqs",
];

/* ------------------------------------------------------------
   Parse a single JSON field safely into an array
------------------------------------------------------------ */
const parseJsonField = (value, fallback = []) => {
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

/* ------------------------------------------------------------
   Sanitize a detail row for the client — ensures all JSON fields
   are always arrays, never JSON strings.
------------------------------------------------------------ */
const serializeDetail = (detail) => {
  if (!detail) return null;
  const plain = detail.toJSON ? detail.toJSON() : { ...detail };
  for (const f of JSON_FIELDS) {
    plain[f] = parseJsonField(plain[f]);
  }
  return plain;
};

/* ============================================================
   ADMIN — GET by subServiceId
============================================================ */
const getDetailBySubServiceId = async (req, res, next) => {
  try {
    const { subServiceId } = req.params;
    const sub = await SubService.findOne({
      where: { id: subServiceId },
      attributes: ["id", "title", "slug", "serviceId"],
    });
    if (!sub) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-service not found!" });
    }

    const detail = await SubServiceDetail.findOne({
      where: { subServiceId },
    });

    return res.status(200).json({
      success: true,
      message: "Sub-service detail retrieved successfully!",
      data: {
        subService: sub,
        detail: serializeDetail(detail),
      },
    });
  } catch (error) {
    console.error("Error getting sub-service detail:", error);
    next(error);
  }
};

/* ============================================================
   PUBLIC — GET by slug (sub-service slug)
============================================================ */
const getPublicDetailBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const sub = await SubService.findOne({
      where: { slug, isActive: true },
    });
    if (!sub) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-service not found!" });
    }

    const detail = await SubServiceDetail.findOne({
      where: { subServiceId: sub.id, isPublished: true },
    });

    const subData = sub.toJSON();
    return res.status(200).json({
      success: true,
      message: "Sub-service detail retrieved successfully!",
      data: {
        ...subData,
        detail: serializeDetail(detail),
      },
    });
  } catch (error) {
    console.error("Error getting public sub-service detail:", error);
    next(error);
  }
};

/* ============================================================
   UPSERT — Create or update
============================================================ */
const upsertDetail = async (req, res, next) => {
  try {
    const { subServiceId } = req.params;
    const sub = await SubService.findOne({ where: { id: subServiceId } });
    if (!sub) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-service not found!" });
    }

    const body = { ...req.body };
    for (const f of JSON_FIELDS) {
      body[f] = parseJsonField(body[f]);
    }
    body.subServiceId = parseInt(subServiceId);
    body.updatedBy = req.user?.id || null;

    const existing = await SubServiceDetail.findOne({
      where: { subServiceId },
    });

    let detail;
    if (existing) {
      await existing.update(body);
      detail = existing;
    } else {
      body.createdBy = req.user?.id || null;
      detail = await SubServiceDetail.create(body);
    }

    return res.status(200).json({
      success: true,
      message: existing
        ? "Sub-service detail updated successfully!"
        : "Sub-service detail created successfully!",
      data: serializeDetail(detail),
    });
  } catch (error) {
    console.error("Error upserting sub-service detail:", error);
    next(error);
  }
};

/* ============================================================
   TOGGLE PUBLISH
============================================================ */
const togglePublish = async (req, res, next) => {
  try {
    const { subServiceId } = req.params;
    const detail = await SubServiceDetail.findOne({
      where: { subServiceId },
    });
    if (!detail) {
      return res
        .status(404)
        .json({ success: false, message: "Detail not found!" });
    }
    detail.isPublished = !detail.isPublished;
    detail.updatedBy = req.user?.id || null;
    await detail.save();

    return res.status(200).json({
      success: true,
      message: `Detail ${detail.isPublished ? "published" : "unpublished"} successfully!`,
      data: serializeDetail(detail),
    });
  } catch (error) {
    console.error("Error toggling publish:", error);
    next(error);
  }
};

/* ============================================================
   DELETE
============================================================ */
const deleteDetail = async (req, res, next) => {
  try {
    const { subServiceId } = req.params;
    const deleted = await SubServiceDetail.destroy({
      where: { subServiceId },
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Detail not found!" });
    }
    return res
      .status(200)
      .json({ success: true, message: "Detail deleted successfully!" });
  } catch (error) {
    console.error("Error deleting detail:", error);
    next(error);
  }
};

module.exports = {
  getDetailBySubServiceId,
  getPublicDetailBySlug,
  upsertDetail,
  togglePublish,
  deleteDetail,
};