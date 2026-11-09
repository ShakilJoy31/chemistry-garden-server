const crypto = require("crypto");
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Student = require("../../models/students/student.model");
const Course = require("../../models/Course/course.model");
const IsoExam = require("../../models/Course/isoexam.model");
const IsoQuestion = require("../../models/Course/isoquestion.model");
const IsoResult = require("../../models/Course/isoresult.model");

// ==================== BASIC HELPERS ====================

const generateIsoExamId = async () => {
  const year = new Date().getFullYear();
  let isUnique = false;
  let isoExamId;
  let counter = 1;

  while (!isUnique) {
    const sequence = String(counter).padStart(4, "0");
    isoExamId = `ISO-${year}-${sequence}`;
    const existingIsoExam = await IsoExam.findOne({ where: { isoExamId } });
    if (!existingIsoExam) isUnique = true;
    else counter++;
  }
  return isoExamId;
};

const parseArr = (value) => {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (e) {
      value = [];
    }
  }
  return Array.isArray(value) ? value : [];
};

const getQuestionsForIsoExam = async (isoExamId) => {
  const questions = await IsoQuestion.findAll({
    where: { isoExamId },
    order: [["section", "ASC"], ["order", "ASC"]],
  });

  return questions.map((q) => {
    const qData = q.toJSON();
    qData.options = parseArr(qData.options);
    qData.correctAnswers = parseArr(qData.correctAnswers);
    qData.subQuestions = parseArr(qData.subQuestions);
    qData.keywords = parseArr(qData.keywords);
    return qData;
  });
};

const groupQuestionsBySection = (questions) => ({
  mcq: questions.filter((q) => q.section === "mcq"),
  short: questions.filter((q) => q.section === "short"),
  long: questions.filter((q) => q.section === "long"),
});

const countSections = (questions) => {
  const totals = { mcq: 0, short: 0, long: 0 };
  const marks = { mcq: 0, short: 0, long: 0 };
  questions.forEach((q) => {
    const s = q.section || "mcq";
    if (totals[s] !== undefined) {
      totals[s]++;
      marks[s] += q.marks || 1;
    }
  });
  return { totals, marks };
};

// ==================== APPLY SET HELPERS ====================

const SECTIONS = ["mcq", "short", "long"];
const SECTION_CFG = {
  mcq: { applyKey: "applyMcqSet", countKey: "mcqSetCount", label: "MCQ" },
  short: { applyKey: "applyShortSet", countKey: "shortSetCount", label: "Short" },
  long: { applyKey: "applyLongSet", countKey: "longSetCount", label: "Long" },
};

// Deterministic shuffle: same seed => same order (mulberry32 PRNG)
const seededShuffle = (arr, seedStr) => {
  let state = crypto.createHash("sha256").update(seedStr).digest().readUInt32LE(0);
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Returns the questions of ONE section that this student should get
const pickSectionQuestions = (examRaw, sectionQuestions, section, studentId) => {
  const cfg = SECTION_CFG[section];
  const count = examRaw[cfg.countKey];
  if (!examRaw[cfg.applyKey] || !count || count >= sectionQuestions.length) {
    return sectionQuestions;
  }
  const sortedById = [...sectionQuestions].sort((a, b) => a.id - b.id);
  return seededShuffle(sortedById, `${examRaw.id}:${section}:${studentId}`).slice(0, count);
};

// All questions (original order) a student should see across the 3 sections
const getStudentQuestionSet = (examRaw, allQuestions, studentId) => {
  const pickedIds = new Set();
  SECTIONS.forEach((section) => {
    const sectionQs = allQuestions.filter((q) => (q.section || "mcq") === section);
    pickSectionQuestions(examRaw, sectionQs, section, studentId).forEach((q) =>
      pickedIds.add(q.id)
    );
  });
  return allQuestions.filter((q) => pickedIds.has(q.id));
};

const buildView = (questions) => {
  const { totals, marks } = countSections(questions);
  return {
    questions,
    totalMcqQuestions: totals.mcq,
    totalShortQuestions: totals.short,
    totalLongQuestions: totals.long,
    totalQuestions: questions.length,
    mcqMarks: marks.mcq,
    shortMarks: marks.short,
    longMarks: marks.long,
    totalMarks: marks.mcq + marks.short + marks.long,
  };
};

// What an admin sees: the full pool with stored totals
const adminView = (raw, questions) => ({
  questions,
  totalMcqQuestions: raw.totalMcqQuestions,
  totalShortQuestions: raw.totalShortQuestions,
  totalLongQuestions: raw.totalLongQuestions,
  totalQuestions: raw.totalQuestions,
  mcqMarks: raw.mcqMarks,
  shortMarks: raw.shortMarks,
  longMarks: raw.longMarks,
  totalMarks: raw.totalMarks,
});

const getViewFor = (req, raw, questions) => {
  const isStudent = req.forStudent || req.user?.role === "student";
  return isStudent
    ? buildView(getStudentQuestionSet(raw, questions, req.user?.id))
    : adminView(raw, questions);
};

// Returns an error string or null
const validateSetConfig = (cfg, sectionTotals) => {
  for (const section of SECTIONS) {
    const { applyKey, countKey, label } = SECTION_CFG[section];
    if (!cfg[applyKey]) continue;
    const n = parseInt(cfg[countKey], 10);
    if (!Number.isInteger(n) || n < 1) {
      return `${label} set question count must be at least 1`;
    }
    if (n >= sectionTotals[section]) {
      return `${label} set question count must be less than total ${label} questions (${sectionTotals[section]})`;
    }
  }
  return null;
};

// Shapes one exam for API responses
const buildExamResponse = (raw, view) => {
  const { mcq, short, long } = groupQuestionsBySection(view.questions);
  return {
    ...raw,
    assignedStudents: parseArr(raw.assignedStudents),
    assignedStudentDetails: parseArr(raw.assignedStudentDetails),
    totalMcqQuestions: view.totalMcqQuestions,
    totalShortQuestions: view.totalShortQuestions,
    totalLongQuestions: view.totalLongQuestions,
    totalQuestions: view.totalQuestions,
    mcqMarks: view.mcqMarks,
    shortMarks: view.shortMarks,
    longMarks: view.longMarks,
    totalMarks: view.totalMarks,
    questions: view.questions,
    mcqQuestions: mcq,
    shortQuestions: short,
    longQuestions: long,
    isPaid: raw.isPaid || false,
    isoExamCost: raw.isoExamCost ? parseFloat(raw.isoExamCost) : 0.0,
    applyMcqSet: !!raw.applyMcqSet,
    mcqSetCount: raw.mcqSetCount || null,
    applyShortSet: !!raw.applyShortSet,
    shortSetCount: raw.shortSetCount || null,
    applyLongSet: !!raw.applyLongSet,
    longSetCount: raw.longSetCount || null,
  };
};

const mapQuestionForCreate = (q, isoExamPk, index) => ({
  isoExamId: isoExamPk,
  questionText: q.questionText,
  questionType: q.questionType || "mcq",
  section: q.section || "mcq",
  options: q.options || [],
  correctAnswers: q.correctAnswers || [],
  modelAnswer: q.modelAnswer || null,
  marks: q.marks || 1,
  order: index + 1,
  caseStudyText: q.caseStudyText || null,
  subQuestions: q.subQuestions || [],
  keywords: q.keywords || [],
  difficulty: q.difficulty || "medium",
  explanation: q.explanation || null,
});

// ==================== CONTROLLERS ====================

//! Create a new ISO exam
const createIsoExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      title, description, courseId, courseName, passingMarks, duration,
      instructions, questions, assignedStudents, isPaid, isoExamCost,
      applyMcqSet, mcqSetCount,
      applyShortSet, shortSetCount,
      applyLongSet, longSetCount,
    } = req.body;

    if (!title || !courseId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Title and course ID are required!" });
    }

    if (isPaid) {
      if (!isoExamCost || parseFloat(isoExamCost) <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Please provide a valid ISO exam cost for paid exam",
        });
      }
    }

    const course = await Course.findOne({ where: { id: courseId } });
    if (!course) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Course not found!" });
    }

    const questionList = Array.isArray(questions) ? questions : [];
    const { totals, marks } = countSections(questionList);
    const totalMarks = marks.mcq + marks.short + marks.long;

    // APPLY SET validation
    const setError = validateSetConfig(
      { applyMcqSet, mcqSetCount, applyShortSet, shortSetCount, applyLongSet, longSetCount },
      totals
    );
    if (setError) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: setError });
    }

    let assignedStudentDetails = [];
    if (assignedStudents && Array.isArray(assignedStudents) && assignedStudents.length > 0) {
      const students = await Student.findAll({
        where: { id: assignedStudents },
        attributes: ["id", "studentId", "fullName", "email", "phoneNo"],
        transaction,
      });
      assignedStudentDetails = students.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        fullName: s.fullName,
        email: s.email,
        phoneNo: s.phoneNo,
        assignedAt: new Date(),
      }));
    }

    const isoExamId = await generateIsoExamId();

    const isoExam = await IsoExam.create(
      {
        isoExamId,
        title,
        description: description || null,
        courseId,
        courseName: courseName || course.courseName,
        totalMcqQuestions: totals.mcq,
        totalShortQuestions: totals.short,
        totalLongQuestions: totals.long,
        totalQuestions: questionList.length,
        totalMarks,
        mcqMarks: marks.mcq,
        shortMarks: marks.short,
        longMarks: marks.long,
        passingMarks: passingMarks || Math.ceil(totalMarks * 0.4),
        duration: duration || null,
        instructions: instructions || null,
        assignedStudents: assignedStudents || [],
        assignedStudentDetails,
        createdBy: req.user?.id || null,
        isPaid: isPaid || false,
        isoExamCost: isPaid ? parseFloat(isoExamCost) : 0.0,
        // APPLY SET
        applyMcqSet: !!applyMcqSet,
        mcqSetCount: applyMcqSet ? parseInt(mcqSetCount, 10) : null,
        applyShortSet: !!applyShortSet,
        shortSetCount: applyShortSet ? parseInt(shortSetCount, 10) : null,
        applyLongSet: !!applyLongSet,
        longSetCount: applyLongSet ? parseInt(longSetCount, 10) : null,
      },
      { transaction }
    );

    if (questionList.length > 0) {
      await Promise.all(
        questionList.map((q, index) =>
          IsoQuestion.create(mapQuestionForCreate(q, isoExam.id, index), { transaction })
        )
      );
    }

    await transaction.commit();

    const isoQuestions = await getQuestionsForIsoExam(isoExam.id);

    return res.status(201).json({
      success: true,
      message: "ISO Exam created successfully!",
      data: { ...isoExam.toJSON(), questions: isoQuestions },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") await transaction.rollback();
    console.error("Error creating ISO exam:", error);
    next(error);
  }
};

//! Get all ISO exams with filters
const getAllIsoExams = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = "", courseId = "", status = "" } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { isoExamId: { [Op.like]: `%${search}%` } },
        { courseName: { [Op.like]: `%${search}%` } },
      ];
    }
    if (courseId) whereClause.courseId = parseInt(courseId);
    if (status) whereClause.status = status;

    const { count, rows: isoExams } = await IsoExam.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [["createdAt", "DESC"]],
    });

    const isoExamsWithData = [];
    for (const isoExam of isoExams) {
      const allQuestions = await getQuestionsForIsoExam(isoExam.id);
      const raw = isoExam.toJSON();
      isoExamsWithData.push(buildExamResponse(raw, getViewFor(req, raw, allQuestions)));
    }

    return res.status(200).json({
      success: true,
      message: "ISO Exams retrieved successfully!",
      data: isoExamsWithData,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting ISO exams:", error);
    next(error);
  }
};

//! Get all paid ISO exams for students
const getAllPaidIsoExams = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10, search = "", courseId = "", status = "",
      isPaid = "", minPrice = "", maxPrice = "",
      sortBy = "createdAt", sortOrder = "DESC",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { isoExamId: { [Op.like]: `%${search}%` } },
        { courseName: { [Op.like]: `%${search}%` } },
      ];
    }
    if (courseId) whereClause.courseId = parseInt(courseId);
    if (status) whereClause.status = status;
    if (isPaid !== "") whereClause.isPaid = isPaid === "true";

    if (minPrice !== "" || maxPrice !== "") {
      whereClause.isoExamCost = {};
      if (minPrice !== "") whereClause.isoExamCost[Op.gte] = parseFloat(minPrice);
      if (maxPrice !== "") whereClause.isoExamCost[Op.lte] = parseFloat(maxPrice);
    }

    let order = [];
    if (sortBy === "price") order = [["isoExamCost", sortOrder]];
    else if (sortBy === "title") order = [["title", sortOrder]];
    else order = [[sortBy, sortOrder]];

    const { count, rows: isoExams } = await IsoExam.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order,
    });

    const isoExamsWithData = [];
    for (const isoExam of isoExams) {
      const allQuestions = await getQuestionsForIsoExam(isoExam.id);
      const raw = isoExam.toJSON();
      isoExamsWithData.push(buildExamResponse(raw, getViewFor(req, raw, allQuestions)));
    }

    return res.status(200).json({
      success: true,
      message: "ISO Exams retrieved successfully!",
      data: isoExamsWithData,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting ISO exams:", error);
    next(error);
  }
};

//! Get ISO exam by ID
const getIsoExamById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const isoExam = await IsoExam.findOne({ where: { id } });
    if (!isoExam) {
      return res.status(404).json({ success: false, message: "ISO Exam not found!" });
    }

    const allQuestions = await getQuestionsForIsoExam(isoExam.id);
    const raw = isoExam.toJSON();

    return res.status(200).json({
      success: true,
      message: "ISO Exam retrieved successfully!",
      data: {
        ...buildExamResponse(raw, getViewFor(req, raw, allQuestions)),
        allowSubmission: raw.allowSubmission,
      },
    });
  } catch (error) {
    console.error("Error getting ISO exam:", error);
    next(error);
  }
};

//! Update ISO exam
const updateIsoExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      title, description, passingMarks, duration, instructions, status,
      assignedStudents, questions, allowSubmission, isPaid, isoExamCost,
      applyMcqSet, mcqSetCount,
      applyShortSet, shortSetCount,
      applyLongSet, longSetCount,
    } = req.body;

    const isoExam = await IsoExam.findOne({ where: { id }, transaction });
    if (!isoExam) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "ISO Exam not found!" });
    }

    if (isPaid !== undefined && isPaid === true) {
      if (!isoExamCost || parseFloat(isoExamCost) <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Please provide a valid ISO exam cost for paid exam",
        });
      }
    }

    // APPLY SET: merge incoming values with stored ones, then validate
    const questionsProvided = Array.isArray(questions);
    const sectionTotals = questionsProvided
      ? countSections(questions).totals
      : {
          mcq: isoExam.totalMcqQuestions,
          short: isoExam.totalShortQuestions,
          long: isoExam.totalLongQuestions,
        };

    const next_ = {
      applyMcqSet: applyMcqSet !== undefined ? !!applyMcqSet : !!isoExam.applyMcqSet,
      mcqSetCount: mcqSetCount !== undefined ? mcqSetCount : isoExam.mcqSetCount,
      applyShortSet: applyShortSet !== undefined ? !!applyShortSet : !!isoExam.applyShortSet,
      shortSetCount: shortSetCount !== undefined ? shortSetCount : isoExam.shortSetCount,
      applyLongSet: applyLongSet !== undefined ? !!applyLongSet : !!isoExam.applyLongSet,
      longSetCount: longSetCount !== undefined ? longSetCount : isoExam.longSetCount,
    };

    const setError = validateSetConfig(next_, sectionTotals);
    if (setError) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: setError });
    }

    const existingAssignedStudents = isoExam.assignedStudents;
    const existingAssignedStudentDetails = isoExam.assignedStudentDetails;

    let assignedStudentDetails = [];
    if (assignedStudents && Array.isArray(assignedStudents)) {
      const students = await Student.findAll({
        where: { id: assignedStudents },
        attributes: ["id", "studentId", "fullName", "email", "phoneNo"],
        transaction,
      });
      assignedStudentDetails = students.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        fullName: s.fullName,
        email: s.email,
        phoneNo: s.phoneNo,
        assignedAt: new Date(),
      }));
    } else {
      assignedStudentDetails = existingAssignedStudentDetails;
    }

    await isoExam.update(
      {
        title: title || isoExam.title,
        description: description !== undefined ? description : isoExam.description,
        passingMarks: passingMarks || isoExam.passingMarks,
        duration: duration !== undefined ? duration : isoExam.duration,
        instructions: instructions !== undefined ? instructions : isoExam.instructions,
        status: status || isoExam.status,
        assignedStudents: assignedStudents || existingAssignedStudents,
        assignedStudentDetails,
        publishedAt:
          status === "published" && isoExam.status !== "published"
            ? new Date()
            : isoExam.publishedAt,
        allowSubmission:
          allowSubmission !== undefined ? allowSubmission : isoExam.allowSubmission,
        isPaid: isPaid !== undefined ? isPaid : isoExam.isPaid,
        isoExamCost: isPaid
          ? parseFloat(isoExamCost)
          : isoExamCost !== undefined
            ? parseFloat(isoExamCost)
            : isoExam.isoExamCost,
        // APPLY SET
        applyMcqSet: next_.applyMcqSet,
        mcqSetCount: next_.applyMcqSet ? parseInt(next_.mcqSetCount, 10) : null,
        applyShortSet: next_.applyShortSet,
        shortSetCount: next_.applyShortSet ? parseInt(next_.shortSetCount, 10) : null,
        applyLongSet: next_.applyLongSet,
        longSetCount: next_.applyLongSet ? parseInt(next_.longSetCount, 10) : null,
      },
      { transaction }
    );

    if (questionsProvided) {
      await IsoQuestion.destroy({ where: { isoExamId: isoExam.id }, transaction });

      const { totals, marks } = countSections(questions);

      await Promise.all(
        questions.map((q, index) =>
          IsoQuestion.create(mapQuestionForCreate(q, isoExam.id, index), { transaction })
        )
      );

      await isoExam.update(
        {
          totalMcqQuestions: totals.mcq,
          totalShortQuestions: totals.short,
          totalLongQuestions: totals.long,
          totalQuestions: questions.length,
          totalMarks: marks.mcq + marks.short + marks.long,
          mcqMarks: marks.mcq,
          shortMarks: marks.short,
          longMarks: marks.long,
        },
        { transaction }
      );
    }

    await transaction.commit();

    const updatedQuestions = await getQuestionsForIsoExam(isoExam.id);
    const raw = isoExam.toJSON();

    return res.status(200).json({
      success: true,
      message: "ISO Exam updated successfully!",
      data: buildExamResponse(raw, adminView(raw, updatedQuestions)),
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") await transaction.rollback();
    console.error("Error updating ISO exam:", error);
    next(error);
  }
};

//! Delete ISO exam
const deleteIsoExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const isoExam = await IsoExam.findOne({ where: { id }, transaction });
    if (!isoExam) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "ISO Exam not found!" });
    }

    await IsoQuestion.destroy({ where: { isoExamId: id }, transaction });
    await IsoResult.destroy({ where: { isoExamId: id }, transaction });
    await isoExam.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({ success: true, message: "ISO Exam deleted successfully!" });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") await transaction.rollback();
    console.error("Error deleting ISO exam:", error);
    next(error);
  }
};

//! Get ISO exams by course
const getIsoExamsByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const isoExams = await IsoExam.findAll({
      where: { courseId, status: "published" },
      order: [["createdAt", "DESC"]],
    });

    const isoExamsWithStats = [];
    for (const isoExam of isoExams) {
      const allQuestions = await getQuestionsForIsoExam(isoExam.id);
      const raw = isoExam.toJSON();
      const view = getViewFor(req, raw, allQuestions);
      const assignedStudents = parseArr(raw.assignedStudents);
      const { mcq, short, long } = groupQuestionsBySection(view.questions);

      isoExamsWithStats.push({
        ...raw,
        assignedStudents,
        totalMcqQuestions: view.totalMcqQuestions,
        totalShortQuestions: view.totalShortQuestions,
        totalLongQuestions: view.totalLongQuestions,
        totalQuestions: view.totalQuestions,
        totalMarks: view.totalMarks,
        mcqMarks: view.mcqMarks,
        shortMarks: view.shortMarks,
        longMarks: view.longMarks,
        stats: {
          totalStudents: assignedStudents.length,
          totalMarks: view.totalMarks,
          mcqMarks: view.mcqMarks,
          shortMarks: view.shortMarks,
          longMarks: view.longMarks,
        },
        mcqQuestions: mcq.map((q) => ({ id: q.id, marks: q.marks })),
        shortQuestions: short.map((q) => ({ id: q.id, marks: q.marks })),
        longQuestions: long.map((q) => ({ id: q.id, marks: q.marks })),
        applyMcqSet: !!raw.applyMcqSet,
        mcqSetCount: raw.mcqSetCount || null,
        applyShortSet: !!raw.applyShortSet,
        shortSetCount: raw.shortSetCount || null,
        applyLongSet: !!raw.applyLongSet,
        longSetCount: raw.longSetCount || null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "ISO Exams retrieved successfully!",
      data: isoExamsWithStats,
    });
  } catch (error) {
    console.error("Error getting ISO exams by course:", error);
    next(error);
  }
};

//! Get ISO exam results
const getIsoExamResults = async (req, res, next) => {
  try {
    const { isoExamId } = req.params;

    const results = await IsoResult.findAll({
      where: { isoExamId },
      order: [["percentage", "DESC"]],
    });

    const isoExam = await IsoExam.findOne({
      where: { id: isoExamId },
      attributes: ["title", "totalMarks", "passingMarks", "mcqMarks", "shortMarks", "longMarks"],
    });

    const stats = {
      totalStudents: results.length,
      passed: results.filter((r) => r.isPassed).length,
      failed: results.filter((r) => !r.isPassed).length,
      averagePercentage: results.length
        ? (results.reduce((sum, r) => sum + parseFloat(r.percentage), 0) / results.length).toFixed(2)
        : 0,
      topScore: results.length ? Math.max(...results.map((r) => r.percentage)) : 0,
    };

    return res.status(200).json({
      success: true,
      message: "Results retrieved successfully!",
      data: { isoExam, stats, results },
    });
  } catch (error) {
    console.error("Error getting ISO exam results:", error);
    next(error);
  }
};

//! Assign students to ISO exam
const assignStudentsToIsoExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Please provide at least one student ID!",
      });
    }

    const isoExam = await IsoExam.findOne({ where: { id }, transaction });
    if (!isoExam) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "ISO Exam not found!" });
    }

    const currentAssigned = parseArr(isoExam.assignedStudents);
    const currentAssignedDetails = parseArr(isoExam.assignedStudentDetails);

    const students = await Student.findAll({
      where: { id: studentIds },
      attributes: ["id", "studentId", "fullName", "email", "phoneNo"],
      transaction,
    });

    const newStudentIds = studentIds.filter((sid) => !currentAssigned.includes(sid));
    const newStudentDetails = students
      .filter((s) => newStudentIds.includes(s.id))
      .map((s) => ({
        id: s.id,
        studentId: s.studentId,
        fullName: s.fullName,
        email: s.email,
        phoneNo: s.phoneNo,
        assignedAt: new Date(),
      }));

    const updatedAssigned = [...currentAssigned, ...newStudentIds];
    const updatedAssignedDetails = [...currentAssignedDetails, ...newStudentDetails];

    await isoExam.update(
      {
        assignedStudents: JSON.stringify(updatedAssigned),
        assignedStudentDetails: JSON.stringify(updatedAssignedDetails),
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `${newStudentIds.length} student(s) assigned to ISO exam successfully!`,
      data: {
        isoExamId: isoExam.id,
        isoExamTitle: isoExam.title,
        totalAssigned: updatedAssigned.length,
        newlyAssigned: newStudentIds.length,
        assignedStudents: updatedAssignedDetails,
      },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") await transaction.rollback();
    console.error("Error assigning students:", error);
    next(error);
  }
};

//! Get available students for ISO exam
const getAvailableStudentsForIsoExam = async (req, res, next) => {
  try {
    const { id } = req.params;

    const isoExam = await IsoExam.findOne({ where: { id } });
    if (!isoExam) {
      return res.status(404).json({ success: false, message: "ISO Exam not found!" });
    }

    const assignedIds = parseArr(isoExam.assignedStudents);
    const whereCondition = { status: "active" };
    if (assignedIds.length > 0) whereCondition.id = { [Op.notIn]: assignedIds };

    const students = await Student.findAll({
      where: whereCondition,
      attributes: ["id", "studentId", "fullName", "email", "phoneNo", "enrolledCourseId", "status"],
      order: [["fullName", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Available students retrieved successfully!",
      data: students,
    });
  } catch (error) {
    console.error("Error getting available students:", error);
    next(error);
  }
};

//! Submit ISO exam answers (handles MCQ, Short, Long)
const submitIsoExamAnswers = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { isoExamId } = req.params;
    const { mcqAnswers, shortAnswers, longAnswers, startedAt, submittedAt } = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
      await transaction.rollback();
      return res.status(401).json({ success: false, message: "Unauthorized!" });
    }

    const isoExam = await IsoExam.findOne({ where: { id: isoExamId }, transaction });
    if (!isoExam) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "ISO Exam not found!" });
    }

    if (!isoExam.allowSubmission) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "This ISO exam is not open for submission at this time.",
      });
    }

    const assignedStudents = parseArr(isoExam.assignedStudents);
    if (!assignedStudents.includes(studentId)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this ISO exam!",
      });
    }

    const existingResult = await IsoResult.findOne({
      where: { isoExamId, studentId, status: "completed" },
      transaction,
    });
    if (existingResult) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "You have already submitted this ISO exam!",
      });
    }

    const student = await Student.findOne({
      where: { id: studentId },
      attributes: ["studentId", "fullName"],
      transaction,
    });

    const allQuestionsRaw = await IsoQuestion.findAll({
      where: { isoExamId },
      order: [["section", "ASC"], ["order", "ASC"]],
      transaction,
    });

    // APPLY SET: grade only the questions this student was given
    const examRaw = isoExam.toJSON();
    const studentSet = getStudentQuestionSet(
      examRaw,
      allQuestionsRaw.map((q) => q.toJSON()),
      studentId
    );
    const pickedIds = new Set(studentSet.map((q) => q.id));
    const allQuestions = allQuestionsRaw.filter((q) => pickedIds.has(q.id));

    const mcqQuestions = allQuestions.filter((q) => q.section === "mcq");
    const shortQuestions = allQuestions.filter((q) => q.section === "short");
    const longQuestions = allQuestions.filter((q) => q.section === "long");

    // ---- MCQ ----
    let correctMcqCount = 0;
    let incorrectMcqCount = 0;
    let obtainedMcqMarks = 0;
    let totalMcqMarks = 0;
    const processedMcqAnswers = [];

    for (const question of mcqQuestions) {
      const qData = question.toJSON();
      const correctAnswers = parseArr(qData.correctAnswers);

      const marks = qData.marks || 1;
      totalMcqMarks += marks;

      const studentAnswer = mcqAnswers?.find((a) => a.questionId === qData.id);
      const selectedOptions = studentAnswer ? studentAnswer.selectedOptions : [];

      const isCorrect =
        selectedOptions.length === correctAnswers.length &&
        selectedOptions.every((opt) => correctAnswers.includes(opt));

      const marksObtained = isCorrect ? marks : 0;

      if (isCorrect) {
        obtainedMcqMarks += marksObtained;
        correctMcqCount++;
      } else if (selectedOptions.length > 0) {
        incorrectMcqCount++;
      }

      processedMcqAnswers.push({
        questionId: qData.id,
        questionText: qData.questionText,
        selectedOptions,
        correctAnswers,
        isCorrect,
        marksObtained,
        marks,
      });
    }

    // ---- Short (manual grading) ----
    const obtainedShortMarks = 0;
    let totalShortMarks = 0;
    const processedShortAnswers = [];

    for (const question of shortQuestions) {
      const qData = question.toJSON();
      const marks = qData.marks || 1;
      totalShortMarks += marks;

      const studentAnswer = shortAnswers?.find((a) => a.questionId === qData.id);

      processedShortAnswers.push({
        questionId: qData.id,
        questionText: qData.questionText,
        answerText: studentAnswer ? studentAnswer.answerText : "",
        marksObtained: 0,
        marks,
        modelAnswer: qData.modelAnswer,
        keywords: qData.keywords,
      });
    }

    // ---- Long (manual grading) ----
    const obtainedLongMarks = 0;
    let totalLongMarks = 0;
    const processedLongAnswers = [];

    for (const question of longQuestions) {
      const qData = question.toJSON();
      const marks = qData.marks || 1;
      totalLongMarks += marks;

      const studentAnswer = longAnswers?.find((a) => a.questionId === qData.id);

      processedLongAnswers.push({
        questionId: qData.id,
        questionText: qData.questionText,
        answerText: studentAnswer ? studentAnswer.answerText : "",
        subAnswers: studentAnswer ? studentAnswer.subAnswers : [],
        marksObtained: 0,
        marks,
        modelAnswer: qData.modelAnswer,
        caseStudyText: qData.caseStudyText,
        subQuestions: qData.subQuestions,
        keywords: qData.keywords,
      });
    }

    const totalMarks = totalMcqMarks + totalShortMarks + totalLongMarks;
    const obtainedMarks = obtainedMcqMarks + obtainedShortMarks + obtainedLongMarks;
    const attemptedMcqQuestions = mcqAnswers?.length || 0;
    const attemptedShortQuestions = shortAnswers?.length || 0;
    const attemptedLongQuestions = longAnswers?.length || 0;
    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    const isPassed = percentage >= (isoExam.passingMarks || 40);

    await IsoResult.create(
      {
        isoExamId,
        studentId,
        studentName: student?.fullName,
        studentStudentId: student?.studentId,
        totalMcqQuestions: mcqQuestions.length,
        attemptedMcqQuestions,
        correctMcqAnswers: correctMcqCount,
        incorrectMcqAnswers: incorrectMcqCount,
        obtainedMcqMarks,
        totalMcqMarks,
        totalShortQuestions: shortQuestions.length,
        attemptedShortQuestions,
        obtainedShortMarks,
        totalShortMarks,
        totalLongQuestions: longQuestions.length,
        attemptedLongQuestions,
        obtainedLongMarks,
        totalLongMarks,
        obtainedMarks,
        totalMarks,
        percentage: percentage.toFixed(2),
        isPassed,
        mcqAnswers: processedMcqAnswers,
        shortAnswers: processedShortAnswers,
        longAnswers: processedLongAnswers,
        startedAt: startedAt || new Date(),
        submittedAt: submittedAt || new Date(),
        status: "completed",
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "ISO Exam submitted successfully!",
      data: {
        obtainedMarks,
        totalMarks,
        percentage: percentage.toFixed(2),
        isPassed,
        mcq: {
          correct: correctMcqCount,
          incorrect: incorrectMcqCount,
          total: mcqQuestions.length,
          marks: obtainedMcqMarks,
          totalMarks: totalMcqMarks,
        },
        short: {
          attempted: attemptedShortQuestions,
          total: shortQuestions.length,
          marks: obtainedShortMarks,
          totalMarks: totalShortMarks,
        },
        long: {
          attempted: attemptedLongQuestions,
          total: longQuestions.length,
          marks: obtainedLongMarks,
          totalMarks: totalLongMarks,
        },
      },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") await transaction.rollback();
    console.error("Error submitting ISO exam:", error);
    next(error);
  }
};

//! Get student's ISO exam attempts
const getStudentIsoExamAttempts = async (req, res, next) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return res.status(401).json({ success: false, message: "Unauthorized!" });
    }

    const results = await IsoResult.findAll({
      where: { studentId, status: "completed" },
      attributes: ["isoExamId", "id", "status", "obtainedMarks", "totalMarks", "percentage", "isPassed", "submittedAt"],
      order: [["submittedAt", "DESC"]],
    });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error("Error getting student attempts:", error);
    next(error);
  }
};

//! Check if student has attempted ISO exam
const checkIsoExamAttempt = async (req, res, next) => {
  try {
    const { isoExamId } = req.params;
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({ success: false, message: "Unauthorized!" });
    }

    const result = await IsoResult.findOne({
      where: { isoExamId, studentId, status: "completed" },
    });

    return res.status(200).json({
      success: true,
      data: { hasAttempted: !!result, result: result || null },
    });
  } catch (error) {
    console.error("Error checking ISO exam attempt:", error);
    next(error);
  }
};

//! Start ISO exam
const startIsoExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { isoExamId } = req.params;
    const { startedAt } = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
      await transaction.rollback();
      return res.status(401).json({ success: false, message: "Unauthorized!" });
    }

    const isoExam = await IsoExam.findOne({ where: { id: isoExamId }, transaction });
    if (!isoExam) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "ISO Exam not found!" });
    }

    if (!isoExam.allowSubmission) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "This ISO exam is not open for attendance at this time.",
      });
    }

    const existingResult = await IsoResult.findOne({
      where: { isoExamId, studentId },
      transaction,
    });

    if (existingResult && existingResult.status === "completed") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "You have already completed this ISO exam!",
      });
    }

    if (existingResult && existingResult.status === "in-progress") {
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ISO Exam already in progress",
        data: existingResult,
      });
    }

    const student = await Student.findOne({
      where: { id: studentId },
      attributes: ["studentId", "fullName"],
      transaction,
    });

    const result = await IsoResult.create(
      {
        isoExamId,
        studentId,
        studentName: student?.fullName,
        studentStudentId: student?.studentId,
        startedAt: startedAt || new Date(),
        status: "in-progress",
        mcqAnswers: [],
        shortAnswers: [],
        longAnswers: [],
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "ISO Exam started successfully!",
      data: result,
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") await transaction.rollback();
    console.error("Error starting ISO exam:", error);
    next(error);
  }
};

//! Update ISO exam result scores (manual grading of short and long answers)
const updateIsoExamResult = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      resultId, isoExamId, studentId, shortAnswers, longAnswers,
      obtainedMarks, percentage, isPassed,
    } = req.body;

    if (!resultId || !isoExamId || !studentId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Result ID, ISO Exam ID, and Student ID are required!",
      });
    }

    const result = await IsoResult.findOne({
      where: { id: resultId, isoExamId, studentId },
      transaction,
    });

    if (!result) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Result not found!" });
    }

    let currentShortAnswers = parseArr(result.shortAnswers);
    let currentLongAnswers = parseArr(result.longAnswers);

    if (shortAnswers && Array.isArray(shortAnswers)) {
      currentShortAnswers = currentShortAnswers.map((ans) => {
        const update = shortAnswers.find((s) => s.questionId === ans.questionId);
        if (update) {
          const maxMarks = ans.marks || 2;
          const newMarks = Math.min(Math.max(0, update.marksObtained), maxMarks);
          return { ...ans, marksObtained: newMarks };
        }
        return ans;
      });
    }

    if (longAnswers && Array.isArray(longAnswers)) {
      currentLongAnswers = currentLongAnswers.map((ans) => {
        const update = longAnswers.find((l) => l.questionId === ans.questionId);
        if (update) {
          const maxMarks = ans.marks || 4;
          const newMarks = Math.min(Math.max(0, update.marksObtained), maxMarks);
          return { ...ans, marksObtained: newMarks };
        }
        return ans;
      });
    }

    const obtainedShortMarks = currentShortAnswers.reduce((sum, a) => sum + (a.marksObtained || 0), 0);
    const obtainedLongMarks = currentLongAnswers.reduce((sum, a) => sum + (a.marksObtained || 0), 0);

    const newObtainedMarks =
      obtainedMarks !== undefined
        ? obtainedMarks
        : result.obtainedMcqMarks + obtainedShortMarks + obtainedLongMarks;

    const newPercentage =
      percentage !== undefined
        ? percentage
        : ((newObtainedMarks / result.totalMarks) * 100).toFixed(2);

    const newIsPassed =
      isPassed !== undefined ? isPassed : newObtainedMarks >= result.passingMarks;

    await result.update(
      {
        shortAnswers: currentShortAnswers,
        longAnswers: currentLongAnswers,
        obtainedShortMarks,
        obtainedLongMarks,
        obtainedMarks: newObtainedMarks,
        percentage: newPercentage,
        isPassed: newIsPassed,
      },
      { transaction }
    );

    await transaction.commit();

    const updatedResult = await IsoResult.findOne({ where: { id: resultId } });
    if (!updatedResult) {
      return res.status(404).json({ success: false, message: "Updated result not found!" });
    }

    return res.status(200).json({
      success: true,
      message: "Result updated successfully!",
      data: {
        id: updatedResult.id,
        isoExamId: updatedResult.isoExamId,
        studentId: updatedResult.studentId,
        studentName: updatedResult.studentName,
        studentStudentId: updatedResult.studentStudentId,
        obtainedMcqMarks: updatedResult.obtainedMcqMarks,
        totalMcqMarks: updatedResult.totalMcqMarks,
        obtainedShortMarks: updatedResult.obtainedShortMarks,
        totalShortMarks: updatedResult.totalShortMarks,
        obtainedLongMarks: updatedResult.obtainedLongMarks,
        totalLongMarks: updatedResult.totalLongMarks,
        obtainedMarks: updatedResult.obtainedMarks,
        totalMarks: updatedResult.totalMarks,
        percentage: updatedResult.percentage,
        isPassed: updatedResult.isPassed,
        shortAnswers: parseArr(updatedResult.shortAnswers),
        longAnswers: parseArr(updatedResult.longAnswers),
        status: updatedResult.status,
        submittedAt: updatedResult.submittedAt,
      },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") await transaction.rollback();
    console.error("Error updating ISO exam result:", error);
    next(error);
  }
};

module.exports = {
  createIsoExam,
  getAllIsoExams,
  getIsoExamById,
  updateIsoExam,
  deleteIsoExam,
  getIsoExamsByCourse,
  getIsoExamResults,
  assignStudentsToIsoExam,
  getAvailableStudentsForIsoExam,
  getAllPaidIsoExams,
  submitIsoExamAnswers,
  getStudentIsoExamAttempts,
  checkIsoExamAttempt,
  startIsoExam,
  updateIsoExamResult,
};