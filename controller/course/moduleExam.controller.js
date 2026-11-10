const crypto = require("crypto");
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Student = require("../../models/students/student.model");
const Course = require("../../models/Course/course.model");
const ModuleExam = require("../../models/Course/moduleExam.model");
const ModuleExamQuestion = require("../../models/Course/moduleExamQuestion.model");
const ModuleExamAttempt = require("../../models/Course/moduleExamAttempt.model");

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const generateExamCode = async () => {
  const year = new Date().getFullYear();
  let counter = 1;
  while (true) {
    const code = `MEX-${year}-${String(counter).padStart(4, "0")}`;
    const existing = await ModuleExam.findOne({ where: { examCode: code } });
    if (!existing) return code;
    counter++;
  }
};

/** Read the student's enrolled modules (courseId list) — handles double-encoded JSON. */
const getStudentEnrolledCourseIds = async (studentId) => {
  const student = await Student.findOne({
    where: { id: studentId },
    attributes: ["enrolledCourses"],
  });
  if (!student || !student.enrolledCourses) return [];

  let raw = student.enrolledCourses;
  try {
    if (typeof raw === "string") raw = JSON.parse(raw);
    if (typeof raw === "string") raw = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(
      raw
        .map((c) => Number(c?.courseId))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  );
};

/** Seeded shuffle — same seed → same order. */
const seededShuffle = (arr, seedStr) => {
  let state = crypto
    .createHash("sha256")
    .update(seedStr)
    .digest()
    .readUInt32LE(0);
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

/** Pick `count` questions for a student (stable per student+exam). */
const pickQuestionSet = (questions, count, seed) => {
  if (!count || count >= questions.length) return questions;
  const sorted = [...questions].sort((a, b) => a.id - b.id);
  return seededShuffle(sorted, seed)
    .slice(0, count)
    .sort((a, b) => a.order - b.order);
};

const validateSetConfig = (applySet, setQuestionCount, totalQuestions) => {
  if (!applySet) return null;
  const n = parseInt(setQuestionCount, 10);
  if (!Number.isInteger(n) || n < 1) return "Set question count must be at least 1";
  if (n >= totalQuestions)
    return `Set question count must be less than total questions (${totalQuestions})`;
  return null;
};

/* ------------------------------------------------------------------ */
/* ADMIN — exam CRUD                                                   */
/* ------------------------------------------------------------------ */

// POST /module-exam/admin/create
const createExam = async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const {
      courseId,
      title,
      description,
      instructions,
      passingMarks,
      duration,
      isPaid,
      examCost,
      applySet,
      setQuestionCount,
      questions,
      status,
    } = req.body;

    if (!courseId || !title) {
      await tx.rollback();
      return res
        .status(400)
        .json({ success: false, message: "courseId and title are required" });
    }

    const course = await Course.findOne({ where: { id: courseId }, transaction: tx });
    if (!course) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (isPaid && (!examCost || parseFloat(examCost) <= 0)) {
      await tx.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Provide a valid exam cost for paid exam" });
    }

    const qs = Array.isArray(questions) ? questions : [];
    const setError = validateSetConfig(applySet, setQuestionCount, qs.length);
    if (setError) {
      await tx.rollback();
      return res.status(400).json({ success: false, message: setError });
    }

    const totalMarks = qs.reduce((s, q) => s + (q.marks || 1), 0);
    const examCode = await generateExamCode();

    const exam = await ModuleExam.create(
      {
        examCode,
        courseId,
        title,
        description: description || null,
        instructions: instructions || null,
        totalQuestions: qs.length,
        totalMarks,
        passingMarks: passingMarks ?? Math.ceil(totalMarks * 0.4),
        duration: duration || null,
        isPaid: !!isPaid,
        examCost: isPaid ? parseFloat(examCost) : 0,
        applySet: !!applySet,
        setQuestionCount: applySet ? parseInt(setQuestionCount, 10) : null,
        allowSubmission: false,
        status: status || "published",
        createdBy: req.user?.email || "system",
      },
      { transaction: tx }
    );

    if (qs.length > 0) {
      await Promise.all(
        qs.map((q, i) =>
          ModuleExamQuestion.create(
            {
              moduleExamId: exam.id,
              questionText: q.questionText,
              questionType: q.questionType || "single",
              options: q.options || [],
              correctAnswers: q.correctAnswers || [],
              marks: q.marks || 1,
              order: i + 1,
              explanation: q.explanation || null,
            },
            { transaction: tx }
          )
        )
      );
    }

    await tx.commit();
    return res.status(201).json({
      success: true,
      message: "Exam created",
      data: exam,
    });
  } catch (error) {
    if (tx && tx.finished !== "commit") await tx.rollback();
    console.error("createExam:", error);
    next(error);
  }
};

// GET /module-exam/admin/all?courseId=&search=&page=&limit=
const adminGetExams = async (req, res, next) => {
  try {
    const { courseId, search = "", status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (courseId) where.courseId = parseInt(courseId);
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { examCode: { [Op.like]: `%${search}%` } },
      ];
    }

    const pageN = parseInt(page, 10);
    const limitN = parseInt(limit, 10);

    const { count, rows } = await ModuleExam.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: limitN,
      offset: (pageN - 1) * limitN,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitN),
        currentPage: pageN,
        itemsPerPage: limitN,
      },
    });
  } catch (error) {
    console.error("adminGetExams:", error);
    next(error);
  }
};

// GET /module-exam/admin/:id  (full detail with questions)
const adminGetExamById = async (req, res, next) => {
  try {
    const exam = await ModuleExam.findOne({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const questions = await ModuleExamQuestion.findAll({
      where: { moduleExamId: exam.id },
      order: [["order", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: { ...exam.toJSON(), questions: questions.map((q) => q.toJSON()) },
    });
  } catch (error) {
    console.error("adminGetExamById:", error);
    next(error);
  }
};

// PUT /module-exam/admin/:id
const updateExam = async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const exam = await ModuleExam.findOne({
      where: { id: req.params.id },
      transaction: tx,
    });
    if (!exam) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    const {
      title,
      description,
      instructions,
      passingMarks,
      duration,
      isPaid,
      examCost,
      applySet,
      setQuestionCount,
      questions,
      status,
      allowSubmission,
    } = req.body;

    const nextApplySet = applySet !== undefined ? !!applySet : !!exam.applySet;
    const nextSetCount =
      setQuestionCount !== undefined ? setQuestionCount : exam.setQuestionCount;
    const nextTotalQuestions = Array.isArray(questions)
      ? questions.length
      : exam.totalQuestions;

    const setError = validateSetConfig(nextApplySet, nextSetCount, nextTotalQuestions);
    if (setError) {
      await tx.rollback();
      return res.status(400).json({ success: false, message: setError });
    }

    const updateData = {
      title: title ?? exam.title,
      description: description !== undefined ? description : exam.description,
      instructions: instructions !== undefined ? instructions : exam.instructions,
      passingMarks: passingMarks ?? exam.passingMarks,
      duration: duration !== undefined ? duration : exam.duration,
      isPaid: isPaid !== undefined ? !!isPaid : exam.isPaid,
      examCost:
        isPaid !== undefined
          ? isPaid
            ? parseFloat(examCost || 0)
            : 0
          : exam.examCost,
      applySet: nextApplySet,
      setQuestionCount: nextApplySet ? parseInt(nextSetCount, 10) : null,
      status: status ?? exam.status,
      allowSubmission:
        allowSubmission !== undefined ? !!allowSubmission : exam.allowSubmission,
    };

    await exam.update(updateData, { transaction: tx });

    if (Array.isArray(questions)) {
      await ModuleExamQuestion.destroy({
        where: { moduleExamId: exam.id },
        transaction: tx,
      });
      const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);
      await Promise.all(
        questions.map((q, i) =>
          ModuleExamQuestion.create(
            {
              moduleExamId: exam.id,
              questionText: q.questionText,
              questionType: q.questionType || "single",
              options: q.options || [],
              correctAnswers: q.correctAnswers || [],
              marks: q.marks || 1,
              order: i + 1,
              explanation: q.explanation || null,
            },
            { transaction: tx }
          )
        )
      );
      await exam.update(
        { totalQuestions: questions.length, totalMarks },
        { transaction: tx }
      );
    }

    await tx.commit();
    return res.status(200).json({ success: true, message: "Exam updated", data: exam });
  } catch (error) {
    if (tx && tx.finished !== "commit") await tx.rollback();
    console.error("updateExam:", error);
    next(error);
  }
};

// PATCH /module-exam/admin/:id/toggle-submission
const toggleSubmission = async (req, res, next) => {
  try {
    const exam = await ModuleExam.findOne({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    const { allowSubmission } = req.body;
    await exam.update({
      allowSubmission:
        allowSubmission !== undefined ? !!allowSubmission : !exam.allowSubmission,
    });
    return res.status(200).json({ success: true, data: exam });
  } catch (error) {
    console.error("toggleSubmission:", error);
    next(error);
  }
};

// DELETE /module-exam/admin/:id
const deleteExam = async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const exam = await ModuleExam.findOne({
      where: { id: req.params.id },
      transaction: tx,
    });
    if (!exam) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: "Exam not found" });
    }
    await ModuleExamQuestion.destroy({
      where: { moduleExamId: exam.id },
      transaction: tx,
    });
    await ModuleExamAttempt.destroy({
      where: { moduleExamId: exam.id },
      transaction: tx,
    });
    await exam.destroy({ transaction: tx });
    await tx.commit();
    return res.status(200).json({ success: true, message: "Exam deleted" });
  } catch (error) {
    if (tx && tx.finished !== "commit") await tx.rollback();
    console.error("deleteExam:", error);
    next(error);
  }
};

// GET /module-exam/admin/:id/attempts
const adminGetAttempts = async (req, res, next) => {
  try {
    const attempts = await ModuleExamAttempt.findAll({
      where: { moduleExamId: req.params.id, status: "completed" },
      order: [["submittedAt", "DESC"]],
    });
    return res.status(200).json({ success: true, data: attempts });
  } catch (error) {
    console.error("adminGetAttempts:", error);
    next(error);
  }
};

/* ------------------------------------------------------------------ */
/* STUDENT — enrollment-based access                                   */
/* ------------------------------------------------------------------ */

// GET /module-exam/student/by-course/:courseId
const studentGetExamsByCourse = async (req, res, next) => {
  try {
    const studentId = req.user?.id;
    const courseId = Number(req.params.courseId);

    const enrolled = await getStudentEnrolledCourseIds(studentId);
    if (!enrolled.includes(courseId)) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this module.",
      });
    }

    const exams = await ModuleExam.findAll({
      where: { courseId, status: "published" },
      order: [["createdAt", "DESC"]],
    });

    const examIds = exams.map((e) => e.id);
    const attempts = examIds.length
      ? await ModuleExamAttempt.findAll({
          where: { moduleExamId: { [Op.in]: examIds }, studentId },
        })
      : [];
    const attemptByExam = new Map(attempts.map((a) => [a.moduleExamId, a]));

    const data = exams.map((e) => {
      const a = attemptByExam.get(e.id);
      return {
        id: e.id,
        examCode: e.examCode,
        title: e.title,
        description: e.description,
        courseId: e.courseId,
        totalQuestions: e.totalQuestions,
        totalMarks: e.totalMarks,
        passingMarks: e.passingMarks,
        duration: e.duration,
        isPaid: e.isPaid,
        examCost: parseFloat(e.examCost || 0),
        allowSubmission: e.allowSubmission,
        applySet: e.applySet,
        setQuestionCount: e.setQuestionCount,
        myAttempt: a
          ? {
              status: a.status,
              startedAt: a.startedAt,
              submittedAt: a.submittedAt,
              obtainedMarks: a.obtainedMarks,
              totalMarks: a.totalMarks,
              percentage: a.percentage,
              isPassed: a.isPassed,
            }
          : null,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("studentGetExamsByCourse:", error);
    next(error);
  }
};

// GET /module-exam/student/:id  (WITHOUT correct answers)
const studentGetExamById = async (req, res, next) => {
  try {
    const studentId = req.user?.id;
    const exam = await ModuleExam.findOne({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const enrolled = await getStudentEnrolledCourseIds(studentId);
    if (!enrolled.includes(Number(exam.courseId))) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this module.",
      });
    }

    const allQuestions = await ModuleExamQuestion.findAll({
      where: { moduleExamId: exam.id },
      order: [["order", "ASC"]],
    });
    const plainQuestions = allQuestions.map((q) => q.toJSON());

    let visible = plainQuestions;
    if (exam.applySet && exam.setQuestionCount) {
      visible = pickQuestionSet(
        plainQuestions,
        exam.setQuestionCount,
        `${exam.id}:${studentId}`
      );
    }

    const safe = visible.map((q, i) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      options: (q.options || []).map((o) => ({ id: o.id, text: o.text })),
      marks: q.marks,
      order: q.order ?? i + 1,
    }));

    const attempt = await ModuleExamAttempt.findOne({
      where: { moduleExamId: exam.id, studentId },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: exam.id,
        examCode: exam.examCode,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        courseId: exam.courseId,
        duration: exam.duration,
        allowSubmission: exam.allowSubmission,
        passingMarks: exam.passingMarks,
        totalQuestions: safe.length,
        totalMarks: safe.reduce((s, q) => s + (q.marks || 1), 0),
        questions: safe,
        attempt: attempt
          ? {
              status: attempt.status,
              startedAt: attempt.startedAt,
              submittedAt: attempt.submittedAt,
              obtainedMarks: attempt.obtainedMarks,
              totalMarks: attempt.totalMarks,
              percentage: attempt.percentage,
              isPassed: attempt.isPassed,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("studentGetExamById:", error);
    next(error);
  }
};

// POST /module-exam/student/:id/start
const studentStartExam = async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const studentId = req.user?.id;
    const exam = await ModuleExam.findOne({
      where: { id: req.params.id },
      transaction: tx,
    });
    if (!exam) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: "Exam not found" });
    }
    if (!exam.allowSubmission) {
      await tx.rollback();
      return res.status(403).json({
        success: false,
        message: "This exam is not open for submission right now.",
      });
    }

    const enrolled = await getStudentEnrolledCourseIds(studentId);
    if (!enrolled.includes(Number(exam.courseId))) {
      await tx.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this module.",
      });
    }

    const existing = await ModuleExamAttempt.findOne({
      where: { moduleExamId: exam.id, studentId },
      transaction: tx,
    });

    if (existing && existing.status === "completed") {
      await tx.rollback();
      return res.status(400).json({
        success: false,
        message: "You have already completed this exam.",
      });
    }
    if (existing && existing.status === "in-progress") {
      await tx.commit();
      return res.status(200).json({ success: true, data: existing });
    }

    const student = await Student.findOne({
      where: { id: studentId },
      attributes: ["studentId", "fullName"],
      transaction: tx,
    });

    const attempt = await ModuleExamAttempt.create(
      {
        moduleExamId: exam.id,
        studentId,
        studentName: student?.fullName,
        studentStudentId: student?.studentId,
        startedAt: new Date(),
        status: "in-progress",
      },
      { transaction: tx }
    );

    await tx.commit();
    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    if (tx && tx.finished !== "commit") await tx.rollback();
    console.error("studentStartExam:", error);
    next(error);
  }
};

// POST /module-exam/student/:id/submit
const studentSubmitExam = async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const studentId = req.user?.id;
    const { answers, startedAt, submittedAt } = req.body;

    const exam = await ModuleExam.findOne({
      where: { id: req.params.id },
      transaction: tx,
    });
    if (!exam) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: "Exam not found" });
    }
    if (!exam.allowSubmission) {
      await tx.rollback();
      return res.status(403).json({
        success: false,
        message: "This exam is not open for submission.",
      });
    }

    const enrolled = await getStudentEnrolledCourseIds(studentId);
    if (!enrolled.includes(Number(exam.courseId))) {
      await tx.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this module.",
      });
    }

    const existing = await ModuleExamAttempt.findOne({
      where: { moduleExamId: exam.id, studentId },
      transaction: tx,
    });
    if (existing && existing.status === "completed") {
      await tx.rollback();
      return res.status(400).json({
        success: false,
        message: "You have already submitted this exam.",
      });
    }

    const allQuestions = await ModuleExamQuestion.findAll({
      where: { moduleExamId: exam.id },
      order: [["order", "ASC"]],
      transaction: tx,
    });
    const plainAll = allQuestions.map((q) => q.toJSON());

    let visible = plainAll;
    if (exam.applySet && exam.setQuestionCount) {
      visible = pickQuestionSet(
        plainAll,
        exam.setQuestionCount,
        `${exam.id}:${studentId}`
      );
    }

    const providedAnswers = Array.isArray(answers) ? answers : [];

    let totalMarks = 0;
    let obtainedMarks = 0;
    let correct = 0;
    let incorrect = 0;
    const processed = [];

    for (const q of visible) {
      const marks = q.marks || 1;
      totalMarks += marks;

      const ans = providedAnswers.find((a) => Number(a.questionId) === q.id);
      const selected = Array.isArray(ans?.selectedOptions) ? ans.selectedOptions : [];

      const correctSet = new Set(q.correctAnswers || []);
      const selectedSet = new Set(selected);
      const isCorrect =
        selected.length === correctSet.size &&
        [...selectedSet].every((id) => correctSet.has(id));

      const marksObtained = isCorrect ? marks : 0;
      if (isCorrect) {
        obtainedMarks += marksObtained;
        correct++;
      } else if (selected.length > 0) {
        incorrect++;
      }

      processed.push({
        questionId: q.id,
        selectedOptions: selected,
        correctAnswers: q.correctAnswers,
        isCorrect,
        marks,
        marksObtained,
      });
    }

    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    const isPassed = percentage >= (exam.passingMarks || 40);

    const payload = {
      moduleExamId: exam.id,
      studentId,
      totalQuestions: visible.length,
      attemptedQuestions: providedAnswers.length,
      correctAnswers: correct,
      incorrectAnswers: incorrect,
      obtainedMarks,
      totalMarks,
      percentage: Number(percentage.toFixed(2)),
      isPassed,
      answers: processed,
      startedAt: startedAt ? new Date(startedAt) : existing?.startedAt || new Date(),
      submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
      status: "completed",
    };

    if (existing) {
      await existing.update(payload, { transaction: tx });
    } else {
      const student = await Student.findOne({
        where: { id: studentId },
        attributes: ["studentId", "fullName"],
        transaction: tx,
      });
      await ModuleExamAttempt.create(
        {
          ...payload,
          studentName: student?.fullName,
          studentStudentId: student?.studentId,
        },
        { transaction: tx }
      );
    }

    await tx.commit();

    /* ---- Build the review array for the student ---- */
    const review = visible.map((q) => {
      const ans = providedAnswers.find((a) => Number(a.questionId) === q.id);
      const selected = Array.isArray(ans?.selectedOptions) ? ans.selectedOptions : [];
      const correctSet = new Set(q.correctAnswers || []);
      const selectedSet = new Set(selected);
      const isCorrect =
        selected.length === correctSet.size &&
        [...selectedSet].every((id) => correctSet.has(id));
      return {
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: (q.options || []).map((o) => ({ id: o.id, text: o.text })),
        selectedOptions: selected,
        correctAnswers: q.correctAnswers || [],
        isCorrect,
        marks: q.marks || 1,
        marksObtained: isCorrect ? (q.marks || 1) : 0,
        explanation: q.explanation || null,
        order: q.order,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Exam submitted successfully",
      data: {
        examId: exam.id,
        examTitle: exam.title,
        obtainedMarks,
        totalMarks,
        percentage: Number(percentage.toFixed(2)),
        isPassed,
        correctAnswers: correct,
        incorrectAnswers: incorrect,
        totalQuestions: visible.length,
        attemptedQuestions: providedAnswers.length,
        passingMarks: exam.passingMarks || 0,
        review,
      },
    });
  } catch (error) {
    if (tx && tx.finished !== "commit") await tx.rollback();
    console.error("studentSubmitExam:", error);
    next(error);
  }
};

// GET /module-exam/student/my-attempts
const studentGetMyAttempts = async (req, res, next) => {
  try {
    const studentId = req.user?.id;
    const attempts = await ModuleExamAttempt.findAll({
      where: { studentId, status: "completed" },
      order: [["submittedAt", "DESC"]],
    });
    return res.status(200).json({ success: true, data: attempts });
  } catch (error) {
    console.error("studentGetMyAttempts:", error);
    next(error);
  }
};

// GET /module-exam/student/:id/result
const studentGetExamResult = async (req, res, next) => {
  try {
    const studentId = req.user?.id;
    const exam = await ModuleExam.findOne({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const enrolled = await getStudentEnrolledCourseIds(studentId);
    if (!enrolled.includes(Number(exam.courseId))) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this module.",
      });
    }

    const attempt = await ModuleExamAttempt.findOne({
      where: { moduleExamId: exam.id, studentId, status: "completed" },
    });
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "No completed attempt found for this exam.",
      });
    }

    const allQuestions = await ModuleExamQuestion.findAll({
      where: { moduleExamId: exam.id },
      order: [["order", "ASC"]],
    });
    const plainAll = allQuestions.map((q) => q.toJSON());

    let visible = plainAll;
    if (exam.applySet && exam.setQuestionCount) {
      visible = pickQuestionSet(
        plainAll,
        exam.setQuestionCount,
        `${exam.id}:${studentId}`
      );
    }

    const submitted = attempt.answers || [];

    const review = visible.map((q) => {
      const submittedEntry = submitted.find((s) => Number(s.questionId) === q.id);
      const selected = submittedEntry?.selectedOptions || [];
      const correctSet = new Set(q.correctAnswers || []);
      const selectedSet = new Set(selected);
      const isCorrect =
        selected.length === correctSet.size &&
        [...selectedSet].every((id) => correctSet.has(id));
      return {
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: (q.options || []).map((o) => ({ id: o.id, text: o.text })),
        selectedOptions: selected,
        correctAnswers: q.correctAnswers || [],
        isCorrect,
        marks: q.marks || 1,
        marksObtained: isCorrect ? (q.marks || 1) : 0,
        explanation: q.explanation || null,
        order: q.order,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        examId: exam.id,
        examTitle: exam.title,
        obtainedMarks: attempt.obtainedMarks,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
        correctAnswers: attempt.correctAnswers,
        incorrectAnswers: attempt.incorrectAnswers,
        totalQuestions: attempt.totalQuestions,
        attemptedQuestions: attempt.attemptedQuestions,
        passingMarks: exam.passingMarks || 0,
        submittedAt: attempt.submittedAt,
        review,
      },
    });
  } catch (error) {
    console.error("studentGetExamResult:", error);
    next(error);
  }
};

module.exports = {
  // admin
  createExam,
  adminGetExams,
  adminGetExamById,
  updateExam,
  deleteExam,
  toggleSubmission,
  adminGetAttempts,
  // student
  studentGetExamsByCourse,
  studentGetExamById,
  studentStartExam,
  studentSubmitExam,
  studentGetMyAttempts,
  studentGetExamResult,
};