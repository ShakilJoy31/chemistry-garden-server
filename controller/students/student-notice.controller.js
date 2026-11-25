// controller/notice/student-notice.controller.js
const { Op } = require("sequelize");
const Student = require("../../models/students/student.model");
const { buildNoticeSmsMessage, sendResultSms, buildLoginCredentialSmsMessage } = require("../../utils/helper/resultSmsHelper");
const StudentNotice = require("../../models/students/student-notice.model");


// ─── helpers ───
const str = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** Parse a JSON column that may be double-encoded. */
const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      let p = JSON.parse(value);
      if (typeof p === "string") p = JSON.parse(p);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Resolve the recipient list from class/batch selectors.
 *  - classVal & batch empty     → everyone (active students)
 *  - classVal set, batch empty  → all active students of that class
 *  - both set                   → active students of that class + batch
 */
const resolveRecipients = async (classVal, batchVal) => {
  const where = { status: "active" };
  if (classVal) where.class = classVal;
  if (batchVal) where.batch = batchVal;

  const students = await Student.findAll({
    where,
    attributes: ["id", "studentId", "fullName", "phoneNo", "class", "batch"],
  });
  return students;
};

// controller/notice/student-notice.controller.js

const createNotice = async (req, res, next) => {
  try {
    const {
      title,
      description,
      class: classRaw,
      batch: batchRaw,
      selectedStudentIds = [],   // NEW — optional array of student PK ids
      sendSms,
      smsTemplate,
    } = req.body || {};

    const titleClean = str(title);
    const descClean = str(description);
    if (!titleClean || !descClean) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required.",
      });
    }

    const isAll = (v) =>
      !v || ["all", "everyone", "all-classes"].includes(String(v).toLowerCase());
    const classVal = isAll(classRaw) ? null : String(classRaw).trim();
    const batchVal = isAll(batchRaw) ? null : String(batchRaw).trim();

    if (batchVal && !classVal) {
      return res.status(400).json({
        success: false,
        message: "Please select a class when a batch is chosen.",
      });
    }

    // Base query: active students matching class/batch
    const where = { status: "active" };
    if (classVal) where.class = classVal;
    if (batchVal) where.batch = batchVal;

    // Optional whitelist of ids
    const ids = Array.isArray(selectedStudentIds)
      ? selectedStudentIds.map(Number).filter((n) => !Number.isNaN(n))
      : [];
    if (ids.length > 0) where.id = { [Op.in]: ids };

    const students = await Student.findAll({
      where,
      attributes: ["id", "studentId", "fullName", "phoneNo", "class", "batch"],
    });

    if (students.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          ids.length > 0
            ? "None of the selected students match the chosen class/batch."
            : "No active students found for the selected class/batch.",
      });
    }

    const studentsSnapshot = students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      fullName: s.fullName,
      phoneNo: s.phoneNo,
      class: s.class || null,
      batch: s.batch || null,
      seen: false,
      seenAt: null,
    }));

    const notice = await StudentNotice.create({
      title: titleClean,
      description: descClean,
      class: classVal,
      batch: batchVal,
      students: studentsSnapshot,
      recipientCount: studentsSnapshot.length,
      seenCount: 0,
      sendSms: Boolean(sendSms),
      smsTemplate: str(smsTemplate),
      createdBy: req.user?.id ? String(req.user.id) : null,
      isActive: true,
    });

    let smsSummary = null;
    if (sendSms) {
      const results = await Promise.all(
        students.map(async (s) => {
          const message = buildNoticeSmsMessage({
            studentName: s.fullName,
            description: descClean,
            template: str(smsTemplate) || undefined,
          });
          const r = await sendResultSms({ phone: s.phoneNo, message });
          return { studentId: s.id, name: s.fullName, ...r };
        })
      );

      let sent = 0,
        failed = 0;
      const errors = [];
      results.forEach((r) => {
        if (r.success) sent++;
        else {
          failed++;
          errors.push({
            studentId: r.studentId,
            name: r.name,
            message: r.message,
          });
        }
      });
      smsSummary = {
        queued: students.length,
        sent,
        failed,
        skipped: 0,
        errors,
      };
      await notice.update({ smsSummary });
    }

    return res.status(201).json({
      success: true,
      message: "Notice published successfully.",
      data: notice,
    });
  } catch (error) {
    console.error("createNotice error:", error);
    next(error);
  }
};
// ─── List notices (admin) with filters ───
const getAllNotices = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      class: classFilter = "",
      batch = "",
      dateFrom = "",
      dateTo = "",
      month = "", // "YYYY-MM"
      isActive = "",
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 200);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (classFilter) where.class = classFilter;
    if (batch) where.batch = batch;
    if (isActive !== "" && isActive !== undefined) {
      where.isActive = isActive === "true" || isActive === true;
    }

    // Date filtering
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) where.createdAt[Op.lte] = new Date(`${dateTo}T23:59:59.999Z`);
    } else if (month) {
      const [y, m] = month.split("-").map(Number);
      if (y && m) {
        const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
        where.createdAt = { [Op.gte]: start, [Op.lt]: end };
      }
    }

    const allowedSort = ["createdAt", "updatedAt", "title", "seenCount"];
    const orderField = allowedSort.includes(sortBy) ? sortBy : "createdAt";
    const orderDir = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows } = await StudentNotice.findAndCountAll({
      where,
      limit: limitNumber,
      offset,
      order: [[orderField, orderDir]],
    });

    // Normalise JSON column + trim heavy payload for the list view
    const data = rows.map((n) => {
      const json = n.toJSON();
      json.students = parseJsonArray(json.students);
      return json;
    });

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(count / limitNumber) || 1,
        totalItems: count,
        limit: limitNumber,
      },
    });
  } catch (error) {
    console.error("getAllNotices error:", error);
    next(error);
  }
};

// ─── Single notice (admin) ───
const getNoticeById = async (req, res, next) => {
  try {
    const notice = await StudentNotice.findByPk(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found." });
    }
    const json = notice.toJSON();
    json.students = parseJsonArray(json.students);
    return res.status(200).json({ success: true, data: json });
  } catch (error) {
    next(error);
  }
};

//! ─── Update notice ───
const updateNotice = async (req, res, next) => {
  try {
    const notice = await StudentNotice.findByPk(req.params.id);
    if (!notice) {
      return res
        .status(404)
        .json({ success: false, message: "Notice not found." });
    }

    const payload = {};
    if (req.body.title !== undefined) payload.title = str(req.body.title);
    if (req.body.description !== undefined)
      payload.description = str(req.body.description);
    if (req.body.isActive !== undefined)
      payload.isActive = Boolean(req.body.isActive);

    const classChanged = req.body.class !== undefined;
    const batchChanged = req.body.batch !== undefined;
    const studentsChanged = req.body.selectedStudentIds !== undefined;

    if (classChanged || batchChanged || studentsChanged) {
      const isAll = (v) =>
        !v ||
        ["all", "everyone", "all-classes"].includes(String(v).toLowerCase());

      const classVal = classChanged
        ? isAll(req.body.class)
          ? null
          : String(req.body.class).trim()
        : notice.class;
      const batchVal = batchChanged
        ? isAll(req.body.batch)
          ? null
          : String(req.body.batch).trim()
        : notice.batch;

      if (batchVal && !classVal) {
        return res.status(400).json({
          success: false,
          message: "Please select a class when a batch is chosen.",
        });
      }

      // Recipient query — mirrors createNotice
      const where = { status: "active" };
      if (classVal) where.class = classVal;
      if (batchVal) where.batch = batchVal;

      const ids = Array.isArray(req.body.selectedStudentIds)
        ? req.body.selectedStudentIds
            .map(Number)
            .filter((n) => !Number.isNaN(n))
        : [];
      if (ids.length > 0) where.id = { [Op.in]: ids };

      // Preserve seen state for students that stay
      const existing = parseJsonArray(notice.students);
      const seenMap = new Map(existing.map((s) => [s.id, s]));

      const recipients = await Student.findAll({
        where,
        attributes: [
          "id",
          "studentId",
          "fullName",
          "phoneNo",
          "class",
          "batch",
        ],
      });

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            ids.length > 0
              ? "None of the selected students match the chosen class/batch."
              : "No active students found for the selected class/batch.",
        });
      }

      const nextStudents = recipients.map((s) => {
        const prev = seenMap.get(s.id);
        return {
          id: s.id,
          studentId: s.studentId,
          fullName: s.fullName,
          phoneNo: s.phoneNo,
          class: s.class || null,
          batch: s.batch || null,
          seen: prev?.seen || false,
          seenAt: prev?.seenAt || null,
        };
      });

      payload.class = classVal;
      payload.batch = batchVal;
      payload.students = nextStudents;
      payload.recipientCount = nextStudents.length;
      payload.seenCount = nextStudents.filter((s) => s.seen).length;
    }

    payload.updatedBy = req.user?.id ? String(req.user.id) : null;

    await notice.update(payload);
    const json = notice.toJSON();
    json.students = parseJsonArray(json.students);

    return res.status(200).json({
      success: true,
      message: "Notice updated successfully.",
      data: json,
    });
  } catch (error) {
    console.error("updateNotice error:", error);
    next(error);
  }
};

// ─── Delete notice ───
const deleteNotice = async (req, res, next) => {
  try {
    const deleted = await StudentNotice.destroy({ where: { id: req.params.id } });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Notice not found." });
    }
    return res
      .status(200)
      .json({ success: true, message: "Notice deleted successfully." });
  } catch (error) {
    next(error);
  }
};

// ─── Seen tracker (student) ───
const markNoticeSeen = async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Invalid studentId." });
    }

    const notices = await StudentNotice.findAll({ where: { isActive: true } });
    let updated = 0;

    for (const notice of notices) {
      const list = parseJsonArray(notice.students);
      const idx = list.findIndex((s) => Number(s.id) === studentId);
      if (idx === -1 || list[idx].seen) continue;

      list[idx] = { ...list[idx], seen: true, seenAt: new Date().toISOString() };
      const seenCount = list.filter((s) => s.seen).length;
      await notice.update({ students: list, seenCount });
      updated++;
    }

    return res.status(200).json({
      success: true,
      message: `${updated} notice(s) marked as seen.`,
      updated,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Student feed ───
// Returns every active notice whose snapshot contains this student.
const getStudentNotices = async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Invalid studentId." });
    }

    const all = await StudentNotice.findAll({
      where: { isActive: true },
      order: [["createdAt", "DESC"]],
    });

    const feed = [];
    for (const notice of all) {
      const list = parseJsonArray(notice.students);
      const me = list.find((s) => Number(s.id) === studentId);
      if (!me) continue;

      feed.push({
        id: notice.id,
        title: notice.title,
        description: notice.description,
        class: notice.class,
        batch: notice.batch,
        createdAt: notice.createdAt,
        seen: me.seen,
        seenAt: me.seenAt,
      });
    }

    return res.status(200).json({ success: true, data: feed });
  } catch (error) {
    next(error);
  }
};

// ─── Stats (admin dashboard) ───
const getNoticeStats = async (req, res, next) => {
  try {
    const totalItems = await StudentNotice.count();
    const activeItems = await StudentNotice.count({ where: { isActive: true } });
    const inactiveItems = totalItems - activeItems;
    return res.status(200).json({
      success: true,
      data: { totalItems, activeItems, inactiveItems },
    });
  } catch (error) {
    next(error);
  }
};



// controller/notice/student-notice.controller.js

/** Mark ONE specific notice as seen for ONE student. */
const markSingleNoticeSeen = async (req, res, next) => {
  try {
    const { id, studentId } = req.params;
    const noticeId = Number(id);
    const sid = Number(studentId);

    if (!noticeId || !sid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid notice id or studentId." });
    }

    const notice = await StudentNotice.findByPk(noticeId);
    if (!notice) {
      return res
        .status(404)
        .json({ success: false, message: "Notice not found." });
    }

    const list = parseJsonArray(notice.students);
    const idx = list.findIndex((s) => Number(s.id) === sid);
    if (idx === -1) {
      return res.status(404).json({
        success: false,
        message: "This student is not a recipient of this notice.",
      });
    }

    // Already seen — idempotent no-op
    if (list[idx].seen) {
      return res.status(200).json({
        success: true,
        message: "Notice already marked as seen.",
        data: { noticeId, studentId: sid, seen: true, seenAt: list[idx].seenAt },
      });
    }

    list[idx] = { ...list[idx], seen: true, seenAt: new Date().toISOString() };
    const seenCount = list.filter((s) => s.seen).length;

    await notice.update({ students: list, seenCount });

    return res.status(200).json({
      success: true,
      message: "Notice marked as seen.",
      data: {
        noticeId,
        studentId: sid,
        seen: true,
        seenAt: list[idx].seenAt,
        seenCount,
        recipientCount: notice.recipientCount,
      },
    });
  } catch (error) {
    console.error("markSingleNoticeSeen error:", error);
    next(error);
  }
};



/**
 * POST /student-notices/send-login-credentials
 * Body: { studentIds: number[], loginUrl?: string, smsTemplate?: string }
 *
 * Sends each selected student their phone + password + portal link via SMS.
 * Uses the same BulkSMSBD gateway as the notice send.
 */
const sendLoginCredentials = async (req, res, next) => {
  try {
    const { studentIds, loginUrl, smsTemplate } = req.body || {};

    const ids = Array.isArray(studentIds)
      ? studentIds.map(Number).filter((n) => !Number.isNaN(n))
      : [];

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one student.",
      });
    }

    const students = await Student.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: [
        "id",
        "studentId",
        "fullName",
        "phoneNo",
        "password",
        "status",
      ],
    });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "None of the selected students were found.",
      });
    }

    const portalUrl = str(loginUrl);

    const results = await Promise.all(
      students.map(async (s) => {
        // Guard: skip missing phone, password, or inactive students
        if (!s.phoneNo) {
          return {
            studentId: s.id,
            name: s.fullName,
            success: false,
            message: "Missing phone number.",
          };
        }
        if (!s.password) {
          return {
            studentId: s.id,
            name: s.fullName,
            success: false,
            message: "No password on file — reset required.",
          };
        }

        const message = buildLoginCredentialSmsMessage({
          studentName: s.fullName,
          phone: s.phoneNo,
          password: s.password,
          loginUrl: portalUrl,
          template: str(smsTemplate) || undefined,
        });

        const r = await sendResultSms({ phone: s.phoneNo, message });
        return {
          studentId: s.id,
          name: s.fullName,
          ...r,
        };
      })
    );

    let sent = 0;
    let failed = 0;
    const errors = [];
    results.forEach((r) => {
      if (r.success) sent++;
      else {
        failed++;
        errors.push({
          studentId: r.studentId,
          name: r.name,
          message: r.message,
        });
      }
    });

    return res.status(200).json({
      success: sent > 0,
      message: `Login credentials sent to ${sent} student(s).${
        failed ? ` ${failed} failed.` : ""
      }`,
      data: {
        total: results.length,
        sent,
        failed,
        errors,
        loginUrl: portalUrl,
      },
    });
  } catch (error) {
    console.error("sendLoginCredentials error:", error);
    next(error);
  }
};

module.exports = {
  createNotice,
  getAllNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
  markNoticeSeen,
  getStudentNotices,
  getNoticeStats,
  markSingleNoticeSeen,
  sendLoginCredentials
};