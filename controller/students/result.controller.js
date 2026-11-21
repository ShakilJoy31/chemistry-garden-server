// controller/academic/result.controller.js
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Student = require("../../models/students/student.model");
const Result = require("../../models/students/result.model");
const { sendResultSms, buildResultSmsMessage } = require("../../utils/helper/resultSmsHelper");
const ExamName = require("../../models/academic/examName.model");

// Utility: recalc total whenever we save
const calcTotal = (cq, mcq) => {
  const c = parseFloat(cq) || 0;
  const m = parseFloat(mcq) || 0;
  return parseFloat((c + m).toFixed(2));
};

// Whether the Result model has a `studentCode` attribute (defensive)
const HAS_STUDENT_CODE = Object.prototype.hasOwnProperty.call(
  Result.rawAttributes || {},
  "studentCode"
);

/**
 * GET /results/students?class=X&batch=Y[&search=...]
 * Load students filtered by class + batch for the result entry grid.
 */
const getStudentsForResult = async (req, res, next) => {
  try {
    const { class: classFilter = "", batch = "", search = "" } = req.query;

    if (!classFilter || !batch) {
      return res.status(400).json({
        success: false,
        message: "Both 'class' and 'batch' query params are required.",
      });
    }

    const where = {
      class: classFilter,
      batch: batch,
    };

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { studentId: { [Op.like]: `%${search}%` } },
      ];
    }

    const students = await Student.findAll({
      where,
      attributes: ["id", "studentId", "fullName", "class", "batch"],
      order: [["fullName", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Students fetched successfully.",
      data: students,
    });
  } catch (error) {
    console.error("Error in getStudentsForResult:", error);
    next(error);
  }
};

/**
 * POST /results/save
 * Body: {
 *   class, batch,
 *   results: [ { studentId, cq, mcq }, ... ]
 * }
 *
 * Rules:
 *  - New student row (no previous result)         → save + SMS
 *  - Existing row with CHANGED marks              → update + SMS
 *  - Existing row with IDENTICAL marks            → skip update, no SMS
 */
const saveResults = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { class: classVal, batch, examId, results = [] } = req.body || {};

    if (!classVal || !batch || !examId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "'class', 'batch' and 'examId' are required.",
      });
    }
    if (!Array.isArray(results) || results.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "'results' must be a non-empty array.",
      });
    }

    // Get the exam from the database (full mark comes from here, not the browser)
    const exam = await ExamName.findByPk(examId, { transaction: t });
    if (!exam) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Exam not found." });
    }
    const examName = exam.name;
    const totalMark = parseFloat(exam.totalMark);

    // Marks must fit inside the exam's total
    for (const row of results) {
      const cq = parseFloat(row.cq) || 0;
      const mcq = parseFloat(row.mcq) || 0;
      if (cq < 0 || mcq < 0 || cq + mcq > totalMark) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Marks for student ${row.studentId} are above the exam total (${totalMark}).`,
        });
      }
    }

    const publishedBy = req.user?.id || null;

    // 1) Confirm students belong to this class + batch
    const ids = results.map((r) => r.studentId).filter(Boolean);
    const allowed = await Student.findAll({
      where: { id: { [Op.in]: ids }, class: classVal, batch },
      attributes: ["id", "studentId", "fullName", "phoneNo", "class", "batch"],
      transaction: t,
    });

    if (allowed.length !== ids.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Some students do not belong to the selected class/batch or do not exist.",
      });
    }

    const allowedMap = new Map(allowed.map((s) => [s.id, s]));

    // 2) Existing rows — now for THIS EXAM only
    const existingRows = await Result.findAll({
      where: {
        studentId: { [Op.in]: ids },
        class: classVal,
        batch: batch,
        examName: examName,
      },
      transaction: t,
    });
    const existingByStudent = new Map(
      existingRows.map((r) => [r.studentId, r])
    );

    // 3) Save each row and remember who needs an SMS
    const saved = [];
    const smsCandidates = [];

    for (const row of results) {
      const s = allowedMap.get(row.studentId);
      const cq = parseFloat(row.cq) || 0;
      const mcq = parseFloat(row.mcq) || 0;
      const total = calcTotal(cq, mcq);

      const existing = existingByStudent.get(s.id);

      const basePayload = {
        studentId: s.id,
        studentName: s.fullName,
        class: classVal,
        batch,
        examName,
        cq,
        mcq,
        total,
        publishedBy,
      };
      if (HAS_STUDENT_CODE) basePayload.studentCode = s.studentId;

      if (existing) {
        const sameMarks =
          parseFloat(existing.cq) === cq && parseFloat(existing.mcq) === mcq;

        if (sameMarks) {
          saved.push(existing); // unchanged: no update, no SMS
          continue;
        }

        await existing.update(basePayload, { transaction: t });
        saved.push(existing);
        smsCandidates.push({ student: s, cq, mcq, total });
      } else {
        const created = await Result.create(basePayload, { transaction: t });
        saved.push(created);
        smsCandidates.push({ student: s, cq, mcq, total });
      }
    }

    await t.commit();

    // 4) SMS after commit
    let smsSent = 0;
    let smsFailed = 0;
    const smsErrors = [];

    if (smsCandidates.length > 0) {
      const smsResults = await Promise.all(
        smsCandidates.map(async ({ student, cq, mcq, total }) => {
          const message = buildResultSmsMessage({
            studentName: student.fullName,
            examName,
            cq,
            mcq,
            total,
            totalMark,
          });
          const r = await sendResultSms({
            phone: student.phoneNo,
            message,
          });
          return { studentId: student.id, name: student.fullName, ...r };
        })
      );

      smsResults.forEach((r) => {
        if (r.success) smsSent++;
        else {
          smsFailed++;
          smsErrors.push({
            studentId: r.studentId,
            name: r.name,
            message: r.message,
          });
        }
      });
    }

    const smsSkipped = results.length - smsCandidates.length;

    return res.status(200).json({
      success: true,
      message:
        `Saved ${saved.length} result(s) for ${examName}. ` +
        `SMS sent to ${smsSent}, failed ${smsFailed}, skipped ${smsSkipped}.`,
      data: saved,
      smsSummary: {
        totalStudents: results.length,
        smsQueued: smsCandidates.length,
        smsSent,
        smsFailed,
        smsSkipped,
        errors: smsErrors,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Error in saveResults:", error);
    next(error);
  }
};

/**
 * GET /results?class=X&batch=Y[&examName=..]
 * List saved results.
 */
const getResults = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      class: classFilter = "",
      batch = "",
      examName = "",
      search = "",
    } = req.query;

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    if (classFilter) where.class = classFilter;
    if (batch) where.batch = batch;
    if (examName) where.examName = examName;
    if (search) {
      where[Op.or] = [
        { studentName: { [Op.like]: `%${search}%` } },
        { studentCode: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Result.findAndCountAll({
      where,
      offset,
      limit: limitNumber,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Results fetched successfully.",
      data: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error in getResults:", error);
    next(error);
  }
};

/**
 * DELETE /results/:id
 */
const deleteResult = async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await Result.findByPk(id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Result not found.",
      });
    }
    await row.destroy();
    return res.status(200).json({
      success: true,
      message: "Result deleted successfully.",
    });
  } catch (error) {
    console.error("Error in deleteResult:", error);
    next(error);
  }
};

/**
 * GET /results/distinct-class-batch
 * Get all distinct (class, batch) pairs from students - helpful for dropdowns.
 */
const getDistinctClassBatch = async (req, res, next) => {
  try {
    const rows = await Student.findAll({
      attributes: ["class", "batch"],
      where: {
        [Op.and]: [
          { class: { [Op.ne]: null } },
          { batch: { [Op.ne]: null } },
          { class: { [Op.ne]: "" } },
          { batch: { [Op.ne]: "" } },
        ],
      },
      group: ["class", "batch"],
      order: [
        ["class", "ASC"],
        ["batch", "ASC"],
      ],
      raw: true,
    });

    return res.status(200).json({
      success: true,
      message: "Distinct class/batch pairs fetched.",
      data: rows,
    });
  } catch (error) {
    console.error("Error in getDistinctClassBatch:", error);
    next(error);
  }
};

/**
 * GET /results/class-batch-summary
 * Groups students by (class, batch) and includes result coverage.
 */
const getClassBatchSummary = async (req, res, next) => {
  try {
    // Distinct student groups
    const groups = await Student.findAll({
      attributes: [
        "class",
        "batch",
        [sequelize.fn("COUNT", sequelize.col("id")), "studentCount"],
      ],
      where: {
        [Op.and]: [
          { class: { [Op.ne]: null } },
          { batch: { [Op.ne]: null } },
          { class: { [Op.ne]: "" } },
          { batch: { [Op.ne]: "" } },
        ],
      },
      group: ["class", "batch"],
      order: [
        ["class", "ASC"],
        ["batch", "ASC"],
      ],
      raw: true,
    });

    // Result coverage per group
    const resultGroups = await Result.findAll({
      attributes: [
        "class",
        "batch",
        [sequelize.fn("COUNT", sequelize.col("id")), "publishedCount"],
        [sequelize.fn("MAX", sequelize.col("createdAt")), "lastPublishedAt"],
      ],
      group: ["class", "batch"],
      raw: true,
    });

    const resultMap = new Map(
      resultGroups.map((r) => [`${r.class}__${r.batch}`, r])
    );

    const data = groups.map((g) => {
      const r = resultMap.get(`${g.class}__${g.batch}`) || {};
      return {
        class: g.class,
        batch: g.batch,
        studentCount: parseInt(g.studentCount, 10) || 0,
        publishedCount: parseInt(r.publishedCount, 10) || 0,
        lastPublishedAt: r.lastPublishedAt || null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Class/batch summary fetched.",
      data,
    });
  } catch (error) {
    console.error("Error in getClassBatchSummary:", error);
    next(error);
  }
};

/**
 * GET /results/by-class-batch?class=X&batch=Y
 * Returns every student in that class+batch, with their saved result (or null).
 */
const getResultsByClassBatch = async (req, res, next) => {
  try {
    const { class: classFilter = "", batch = "", examName = "" } = req.query;

    if (!classFilter || !batch) {
      return res.status(400).json({
        success: false,
        message: "Both 'class' and 'batch' are required.",
      });
    }

    const students = await Student.findAll({
      where: { class: classFilter, batch },
      attributes: ["id", "studentId", "fullName", "class", "batch"],
      order: [["fullName", "ASC"]],
    });

    // Only this exam's results
    const resultWhere = { class: classFilter, batch };
    if (examName) resultWhere.examName = examName;

    const results = await Result.findAll({ where: resultWhere, raw: true });
    const resultMap = new Map(results.map((r) => [r.studentId, r]));

    const data = students.map((s) => {
      const r = resultMap.get(s.id) || null;
      return {
        studentId: s.id,
        studentCode: s.studentId,
        studentName: s.fullName,
        class: s.class,
        batch: s.batch,
        cq: r ? parseFloat(r.cq) : null,
        mcq: r ? parseFloat(r.mcq) : null,
        total: r ? parseFloat(r.total) : null,
        resultId: r ? r.id : null,
        publishedAt: r ? r.createdAt : null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Class results fetched.",
      data,
    });
  } catch (error) {
    console.error("Error in getResultsByClassBatch:", error);
    next(error);
  }
};

module.exports = {
  getStudentsForResult,
  saveResults,
  getResults,
  deleteResult,
  getDistinctClassBatch,
  getClassBatchSummary,
  getResultsByClassBatch,
};