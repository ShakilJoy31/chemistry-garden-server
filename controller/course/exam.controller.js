const crypto = require("crypto"); // APPLY SET: used for deterministic per-student shuffle
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Student = require("../../models/students/student.model");
const Course = require("../../models/Course/course.model");
const Exam = require("../../models/Course/exam.model");
const Question = require("../../models/Course/question.model");
const Result = require("../../models/Course/result.model");

// Helper function to generate unique exam ID
const generateExamId = async () => {
  const year = new Date().getFullYear();
  let isUnique = false;
  let examId;
  let counter = 1;

  while (!isUnique) {
    const sequence = String(counter).padStart(4, "0");
    examId = `EXM-${year}-${sequence}`;

    const existingExam = await Exam.findOne({ where: { examId } });
    if (!existingExam) {
      isUnique = true;
    } else {
      counter++;
    }
  }

  return examId;
};

// Helper to get questions for an exam (with parsed JSON)
const getQuestionsForExam = async (examId) => {
  const questions = await Question.findAll({
    where: { examId },
    order: [["order", "ASC"]],
  });

  // Parse JSON fields for each question
  return questions.map((q) => {
    const qData = q.toJSON();

    // Parse options if it's a string
    if (typeof qData.options === "string") {
      try {
        qData.options = JSON.parse(qData.options);
      } catch (e) {
        qData.options = [];
      }
    }

    // Parse correctAnswers if it's a string
    if (typeof qData.correctAnswers === "string") {
      try {
        qData.correctAnswers = JSON.parse(qData.correctAnswers);
      } catch (e) {
        qData.correctAnswers = [];
      }
    }

    // Ensure options is always an array
    if (!Array.isArray(qData.options)) {
      qData.options = [];
    }

    // Ensure correctAnswers is always an array
    if (!Array.isArray(qData.correctAnswers)) {
      qData.correctAnswers = [];
    }

    return qData;
  });
};

// ==================== APPLY SET HELPERS ====================

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

// Pick `count` questions for one student, keeping original display order
const pickQuestionSet = (questions, count, seed) => {
  if (!count || count >= questions.length) return questions;
  const sortedById = [...questions].sort((a, b) => a.id - b.id); // stable input order
  return seededShuffle(sortedById, seed)
    .slice(0, count)
    .sort((a, b) => a.order - b.order);
};

// Returns what a given student should see for an exam
const applySetForStudent = (examRaw, questions, studentId) => {
  if (!examRaw.applySet || !examRaw.setQuestionCount) {
    return {
      questions,
      totalQuestions: examRaw.totalQuestions,
      totalMarks: examRaw.totalMarks,
    };
  }
  const picked = pickQuestionSet(
    questions,
    examRaw.setQuestionCount,
    `${examRaw.id}:${studentId}`
  );
  return {
    questions: picked,
    totalQuestions: picked.length,
    totalMarks: picked.reduce((s, q) => s + (q.marks || 1), 0),
  };
};

// Shared validation for apply set config. Returns error string or null.
const validateSetConfig = (applySet, setQuestionCount, totalQuestions) => {
  if (!applySet) return null;
  const n = parseInt(setQuestionCount, 10);
  if (!Number.isInteger(n) || n < 1) {
    return "Set question count must be at least 1";
  }
  if (n >= totalQuestions) {
    return `Set question count must be less than total questions (${totalQuestions})`;
  }
  return null;
};

// ===========================================================

//! Create a new exam
const createExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      title,
      description,
      courseId,
      courseName,
      passingMarks,
      duration,
      instructions,
      questions,
      assignedStudents,
      isPaid,
      examCost,
      applySet,          // APPLY SET
      setQuestionCount,  // APPLY SET
    } = req.body;

    if (!title || !courseId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Title and course ID are required!",
      });
    }

    // Validate exam cost if exam is paid
    if (isPaid) {
      if (!examCost || parseFloat(examCost) <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Please provide a valid exam cost for paid exam",
        });
      }
    }

    // APPLY SET: validate set size against total questions
    const setError = validateSetConfig(
      applySet,
      setQuestionCount,
      Array.isArray(questions) ? questions.length : 0
    );
    if (setError) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: setError,
      });
    }

    // Check if course exists
    const course = await Course.findOne({ where: { id: courseId } });
    if (!course) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    // Calculate total marks
    let totalMarks = 0;
    if (questions && Array.isArray(questions)) {
      totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    }

    // Get assigned student details if any
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

    // Generate exam ID
    const examId = await generateExamId();

    // Create exam - Use the model's getters/setters
    const exam = await Exam.create(
      {
        examId,
        title,
        description: description || null,
        courseId,
        courseName: courseName || course.courseName,
        totalQuestions: questions ? questions.length : 0,
        totalMarks,
        passingMarks: passingMarks || Math.ceil(totalMarks * 0.4),
        duration: duration || null,
        instructions: instructions || null,
        assignedStudents: assignedStudents || [], // Let model handle JSON
        assignedStudentDetails: assignedStudentDetails, // Let model handle JSON
        createdBy: req.user?.id || null,
        // NEW FIELDS
        isPaid: isPaid || false,
        examCost: isPaid ? parseFloat(examCost) : 0.0,
        // APPLY SET
        applySet: !!applySet,
        setQuestionCount: applySet ? parseInt(setQuestionCount, 10) : null,
      },
      { transaction }
    );

    // Create questions - Let model handle JSON serialization
    if (questions && Array.isArray(questions) && questions.length > 0) {
      const questionPromises = questions.map((q, index) =>
        Question.create(
          {
            examId: exam.id,
            questionText: q.questionText,
            questionType: q.questionType || "single",
            options: q.options, // Model handles JSON.stringify
            correctAnswers: q.correctAnswers, // Model handles JSON.stringify
            marks: q.marks || 1,
            order: index + 1,
            explanation: q.explanation || null,
          },
          { transaction }
        )
      );
      await Promise.all(questionPromises);
    }

    await transaction.commit();

    // Fetch questions
    const examQuestions = await getQuestionsForExam(exam.id);

    return res.status(201).json({
      success: true,
      message: "Exam created successfully!",
      data: {
        ...exam.toJSON(),
        questions: examQuestions,
      },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error creating exam:", error);
    next(error);
  }
};

//! Get all exams with filters - COMPLETELY REWRITTEN
// NOTE: when the route sets req.forStudent = true, each student gets only
// their own random set of questions (if the exam has applySet enabled).
const getAllExams = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      courseId = "",
      status = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { examId: { [Op.like]: `%${search}%` } },
        { courseName: { [Op.like]: `%${search}%` } },
      ];
    }

    if (courseId) {
      whereClause.courseId = parseInt(courseId);
    }

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: exams } = await Exam.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    // Check if the requester is a student (either set by route middleware or role check)
    const isStudent = req.forStudent || req.user?.role === "student";

    // Process each exam
    const examsWithData = [];

    for (const exam of exams) {
      const allQuestions = await getQuestionsForExam(exam.id);
      const examRaw = exam.toJSON();

      // APPLY SET: students only see their own set; admins see everything
      const view = isStudent
        ? applySetForStudent(examRaw, allQuestions, req.user?.id)
        : {
            questions: allQuestions,
            totalQuestions: examRaw.totalQuestions,
            totalMarks: examRaw.totalMarks,
          };

      // Parse assignedStudents - this is the key fix
      let assignedStudents = examRaw.assignedStudents;
      let assignedStudentDetails = examRaw.assignedStudentDetails;

      // Parse if it's a string
      if (typeof assignedStudents === "string") {
        try {
          assignedStudents = JSON.parse(assignedStudents);
        } catch (e) {
          console.error(`Parse error for assignedStudents on exam ${exam.id}:`, e);
          assignedStudents = [];
        }
      }

      if (typeof assignedStudentDetails === "string") {
        try {
          assignedStudentDetails = JSON.parse(assignedStudentDetails);
        } catch (e) {
          assignedStudentDetails = [];
        }
      }

      // Ensure arrays
      if (!Array.isArray(assignedStudents)) assignedStudents = [];
      if (!Array.isArray(assignedStudentDetails)) assignedStudentDetails = [];

      examsWithData.push({
        id: examRaw.id,
        examId: examRaw.examId,
        title: examRaw.title,
        description: examRaw.description,
        courseId: examRaw.courseId,
        courseName: examRaw.courseName,
        totalQuestions: view.totalQuestions, // APPLY SET
        totalMarks: view.totalMarks, // APPLY SET
        passingMarks: examRaw.passingMarks,
        duration: examRaw.duration,
        status: examRaw.status,
        assignedStudents: assignedStudents,
        assignedStudentDetails: assignedStudentDetails,
        instructions: examRaw.instructions,
        createdBy: examRaw.createdBy,
        publishedAt: examRaw.publishedAt,
        createdAt: examRaw.createdAt,
        updatedAt: examRaw.updatedAt,
        questions: view.questions, // APPLY SET
        allowSubmission: examRaw.allowSubmission,
        // NEW FIELDS FOR PAYMENT
        isPaid: examRaw.isPaid || false,
        examCost: examRaw.examCost ? parseFloat(examRaw.examCost) : 0.0,
        // APPLY SET
        applySet: examRaw.applySet || false,
        setQuestionCount: examRaw.setQuestionCount || null,
      });
    }

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Exams retrieved successfully!",
      data: examsWithData,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting exams:", error);
    next(error);
  }
};





//! Get all exams with filters - COMPLETELY REWRITTEN with payment support
const getAllPaidExams = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      courseId = "",
      status = "",
      isPaid = "", // NEW: filter by paid status
      minPrice = "", // NEW: minimum price filter
      maxPrice = "", // NEW: maximum price filter
      sortBy = "createdAt", // NEW: sort field
      sortOrder = "DESC", // NEW: sort order
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { examId: { [Op.like]: `%${search}%` } },
        { courseName: { [Op.like]: `%${search}%` } },
      ];
    }

    if (courseId) {
      whereClause.courseId = parseInt(courseId);
    }

    if (status) {
      whereClause.status = status;
    }

    // NEW: Filter by paid status
    if (isPaid !== "") {
      whereClause.isPaid = isPaid === "true";
    }

    // NEW: Filter by price range
    if (minPrice !== "" || maxPrice !== "") {
      whereClause.examCost = {};
      if (minPrice !== "") {
        whereClause.examCost[Op.gte] = parseFloat(minPrice);
      }
      if (maxPrice !== "") {
        whereClause.examCost[Op.lte] = parseFloat(maxPrice);
      }
    }

    // NEW: Handle sorting
    let order = [];
    if (sortBy === "price") {
      order = [["examCost", sortOrder]];
    } else if (sortBy === "title") {
      order = [["title", sortOrder]];
    } else {
      order = [[sortBy, sortOrder]];
    }

    const { count, rows: exams } = await Exam.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: order,
    });

    // Process each exam
    const examsWithData = [];

    for (const exam of exams) {
      const questions = await getQuestionsForExam(exam.id);
      const examRaw = exam.toJSON();

      // Parse assignedStudents - this is the key fix
      let assignedStudents = examRaw.assignedStudents;
      let assignedStudentDetails = examRaw.assignedStudentDetails;

      // Log the raw values to debug
      console.log(`Raw assignedStudents for exam ${exam.id}:`, assignedStudents);
      console.log(`Type of assignedStudents:`, typeof assignedStudents);

      // Parse if it's a string
      if (typeof assignedStudents === "string") {
        try {
          assignedStudents = JSON.parse(assignedStudents);
          console.log(`Parsed assignedStudents:`, assignedStudents);
        } catch (e) {
          console.error(`Parse error:`, e);
          assignedStudents = [];
        }
      }

      if (typeof assignedStudentDetails === "string") {
        try {
          assignedStudentDetails = JSON.parse(assignedStudentDetails);
        } catch (e) {
          assignedStudentDetails = [];
        }
      }

      // Ensure arrays
      if (!Array.isArray(assignedStudents)) assignedStudents = [];
      if (!Array.isArray(assignedStudentDetails)) assignedStudentDetails = [];

      examsWithData.push({
        id: examRaw.id,
        examId: examRaw.examId,
        title: examRaw.title,
        description: examRaw.description,
        courseId: examRaw.courseId,
        courseName: examRaw.courseName,
        totalQuestions: examRaw.totalQuestions,
        totalMarks: examRaw.totalMarks,
        passingMarks: examRaw.passingMarks,
        duration: examRaw.duration,
        status: examRaw.status,
        assignedStudents: assignedStudents,
        assignedStudentDetails: assignedStudentDetails,
        instructions: examRaw.instructions,
        createdBy: examRaw.createdBy,
        publishedAt: examRaw.publishedAt,
        createdAt: examRaw.createdAt,
        updatedAt: examRaw.updatedAt,
        questions: questions,
        allowSubmission: examRaw.allowSubmission,
        // NEW FIELDS FOR PAYMENT
        isPaid: examRaw.isPaid || false,
        examCost: examRaw.examCost ? parseFloat(examRaw.examCost) : 0.0,
        // APPLY SET
        applySet: examRaw.applySet || false,
        setQuestionCount: examRaw.setQuestionCount || null,
      });
    }

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Exams retrieved successfully!",
      data: examsWithData,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting exams:", error);
    next(error);
  }
};
//! Get exam by ID
// NOTE: when the route sets req.forStudent = true, the student receives only
// their own random set of questions (if the exam has applySet enabled).
const getExamById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findOne({ where: { id } });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found!",
      });
    }

    const allQuestions = await getQuestionsForExam(exam.id);
    const examRaw = exam.toJSON();

    // APPLY SET: students only see their own set; admins see everything.
    // We check req.forStudent (set by route) OR fallback to checking if the user's role is "student".
    // Adjust "student" if your role name is different (e.g., "Student", "STUDENT").
    const isStudent = req.forStudent || req.user?.role === "student"; 

    const view = isStudent
      ? applySetForStudent(examRaw, allQuestions, req.user?.id)
      : {
          questions: allQuestions,
          totalQuestions: examRaw.totalQuestions,
          totalMarks: examRaw.totalMarks,
        };

    // Parse assignedStudents
    let assignedStudents = examRaw.assignedStudents;
    let assignedStudentDetails = examRaw.assignedStudentDetails;

    if (typeof assignedStudents === "string") {
      try {
        assignedStudents = JSON.parse(assignedStudents);
      } catch (e) {
        assignedStudents = [];
      }
    }

    if (typeof assignedStudentDetails === "string") {
      try {
        assignedStudentDetails = JSON.parse(assignedStudentDetails);
      } catch (e) {
        assignedStudentDetails = [];
      }
    }

    if (!Array.isArray(assignedStudents)) assignedStudents = [];
    if (!Array.isArray(assignedStudentDetails)) assignedStudentDetails = [];

    return res.status(200).json({
      success: true,
      message: "Exam retrieved successfully!",
      data: {
        ...examRaw,
        assignedStudents: assignedStudents,
        assignedStudentDetails: assignedStudentDetails,
        questions: view.questions, // APPLY SET
        totalQuestions: view.totalQuestions, // APPLY SET
        totalMarks: view.totalMarks, // APPLY SET
        allowSubmission: examRaw.allowSubmission,
      },
    });
  } catch (error) {
    console.error("Error getting exam:", error);
    next(error);
  }
};




//! Update exam with allow submission.
const updateExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      title,
      description,
      passingMarks,
      duration,
      instructions,
      status,
      assignedStudents,
      questions,
      allowSubmission,
      isPaid,
      examCost,
      applySet,          // APPLY SET
      setQuestionCount,  // APPLY SET
    } = req.body;

    const exam = await Exam.findOne({ where: { id }, transaction });

    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Exam not found!",
      });
    }

    // Validate exam cost if exam is paid
    if (isPaid !== undefined && isPaid === true) {
      if (!examCost || parseFloat(examCost) <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Please provide a valid exam cost for paid exam",
        });
      }
    }

    // APPLY SET: work out the resulting config and validate it.
    // (Partial updates such as the submission toggle keep the existing values.)
    const nextApplySet = applySet !== undefined ? !!applySet : !!exam.applySet;
    const nextSetCount =
      setQuestionCount !== undefined ? setQuestionCount : exam.setQuestionCount;
    const nextTotalQuestions = Array.isArray(questions)
      ? questions.length
      : exam.totalQuestions;

    const setError = validateSetConfig(nextApplySet, nextSetCount, nextTotalQuestions);
    if (setError) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: setError,
      });
    }

    // Parse existing assigned students if they exist
    let existingAssignedStudents = exam.assignedStudents;
    let existingAssignedStudentDetails = exam.assignedStudentDetails;

    // Parse assigned student details if assignedStudents changed
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
      // Keep existing assigned student details if not updating
      assignedStudentDetails = existingAssignedStudentDetails;
    }

    // Update exam - Let model handle JSON
    await exam.update(
      {
        title: title || exam.title,
        description: description !== undefined ? description : exam.description,
        passingMarks: passingMarks || exam.passingMarks,
        duration: duration !== undefined ? duration : exam.duration,
        instructions: instructions !== undefined ? instructions : exam.instructions,
        status: status || exam.status,
        assignedStudents: assignedStudents || existingAssignedStudents,
        assignedStudentDetails: assignedStudentDetails,
        publishedAt:
          status === "published" && exam.status !== "published"
            ? new Date()
            : exam.publishedAt,
        allowSubmission:
          allowSubmission !== undefined ? allowSubmission : exam.allowSubmission,
        // NEW FIELDS FOR PAYMENT
        isPaid: isPaid !== undefined ? isPaid : exam.isPaid,
        examCost: isPaid
          ? parseFloat(examCost)
          : examCost !== undefined
          ? parseFloat(examCost)
          : exam.examCost,
        // APPLY SET
        applySet: nextApplySet,
        setQuestionCount: nextApplySet ? parseInt(nextSetCount, 10) : null,
      },
      { transaction }
    );

    // Update questions if provided
    if (questions && Array.isArray(questions)) {
      // Delete existing questions
      await Question.destroy({ where: { examId: exam.id }, transaction });

      // Calculate total marks
      const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

      // Create new questions - Let model handle JSON serialization
      const questionPromises = questions.map((q, index) =>
        Question.create(
          {
            examId: exam.id,
            questionText: q.questionText,
            questionType: q.questionType || "single",
            options: q.options,
            correctAnswers: q.correctAnswers,
            marks: q.marks || 1,
            order: index + 1,
            explanation: q.explanation || null,
          },
          { transaction }
        )
      );
      await Promise.all(questionPromises);

      // Update exam totals
      await exam.update(
        {
          totalQuestions: questions.length,
          totalMarks: totalMarks,
        },
        { transaction }
      );
    }

    await transaction.commit();

    // Fetch updated questions
    const updatedQuestions = await getQuestionsForExam(exam.id);
    const examRaw = exam.toJSON();

    // Parse assignedStudents if it's a string
    let assignedStudentsParsed = examRaw.assignedStudents;
    let assignedStudentDetailsParsed = examRaw.assignedStudentDetails;

    if (typeof assignedStudentsParsed === "string") {
      try {
        assignedStudentsParsed = JSON.parse(assignedStudentsParsed);
      } catch (e) {
        assignedStudentsParsed = [];
      }
    }

    if (typeof assignedStudentDetailsParsed === "string") {
      try {
        assignedStudentDetailsParsed = JSON.parse(assignedStudentDetailsParsed);
      } catch (e) {
        assignedStudentDetailsParsed = [];
      }
    }

    return res.status(200).json({
      success: true,
      message: "Exam updated successfully!",
      data: {
        id: examRaw.id,
        examId: examRaw.examId,
        title: examRaw.title,
        description: examRaw.description,
        courseId: examRaw.courseId,
        courseName: examRaw.courseName,
        totalQuestions: examRaw.totalQuestions,
        totalMarks: examRaw.totalMarks,
        passingMarks: examRaw.passingMarks,
        duration: examRaw.duration,
        status: examRaw.status,
        assignedStudents: assignedStudentsParsed,
        assignedStudentDetails: assignedStudentDetailsParsed,
        instructions: examRaw.instructions,
        createdBy: examRaw.createdBy,
        publishedAt: examRaw.publishedAt,
        createdAt: examRaw.createdAt,
        updatedAt: examRaw.updatedAt,
        allowSubmission: examRaw.allowSubmission,
        questions: updatedQuestions,
        // NEW FIELDS FOR PAYMENT
        isPaid: examRaw.isPaid || false,
        examCost: examRaw.examCost ? parseFloat(examRaw.examCost) : 0.0,
        // APPLY SET
        applySet: examRaw.applySet || false,
        setQuestionCount: examRaw.setQuestionCount || null,
      },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error updating exam:", error);
    next(error);
  }
};

//! Delete exam
const deleteExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const exam = await Exam.findOne({ where: { id }, transaction });

    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Exam not found!",
      });
    }

    await Question.destroy({ where: { examId: id }, transaction });
    await Result.destroy({ where: { examId: id }, transaction });
    await exam.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Exam deleted successfully!",
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error deleting exam:", error);
    next(error);
  }
};

//! Get exams by course
const getExamsByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const exams = await Exam.findAll({
      where: {
        courseId,
        status: "published",
      },
      order: [["createdAt", "DESC"]],
    });

    const examsWithStats = [];

    for (const exam of exams) {
      const questions = await getQuestionsForExam(exam.id);
      const examRaw = exam.toJSON();

      let assignedStudents = examRaw.assignedStudents;
      if (typeof assignedStudents === "string") {
        try {
          assignedStudents = JSON.parse(assignedStudents);
        } catch (e) {
          assignedStudents = [];
        }
      }

      examsWithStats.push({
        ...examRaw,
        assignedStudents: assignedStudents,
        stats: {
          totalStudents: assignedStudents.length,
          totalMarks: examRaw.totalMarks,
        },
        questions: questions.map((q) => ({ id: q.id, marks: q.marks })),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Exams retrieved successfully!",
      data: examsWithStats,
    });
  } catch (error) {
    console.error("Error getting exams by course:", error);
    next(error);
  }
};

//! Get exam results
const getExamResults = async (req, res, next) => {
  try {
    const { examId } = req.params;

    const results = await Result.findAll({
      where: { examId },
      order: [["percentage", "DESC"]],
    });

    const exam = await Exam.findOne({
      where: { id: examId },
      attributes: ["title", "totalMarks", "passingMarks"],
    });

    const stats = {
      totalStudents: results.length,
      passed: results.filter((r) => r.isPassed).length,
      failed: results.filter((r) => !r.isPassed).length,
      averagePercentage: results.length
        ? (
            results.reduce((sum, r) => sum + parseFloat(r.percentage), 0) /
            results.length
          ).toFixed(2)
        : 0,
      topScore: results.length ? Math.max(...results.map((r) => r.percentage)) : 0,
    };

    return res.status(200).json({
      success: true,
      message: "Results retrieved successfully!",
      data: {
        exam,
        stats,
        results,
      },
    });
  } catch (error) {
    console.error("Error getting exam results:", error);
    next(error);
  }
};

//! Assign students to exam
const assignStudentsToExam = async (req, res, next) => {
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

    const exam = await Exam.findOne({ where: { id }, transaction });

    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Exam not found!",
      });
    }

    // Parse existing assigned students
    let currentAssigned = exam.assignedStudents;
    let currentAssignedDetails = exam.assignedStudentDetails;

    if (typeof currentAssigned === "string") {
      try {
        currentAssigned = JSON.parse(currentAssigned);
      } catch (e) {
        currentAssigned = [];
      }
    }
    if (!Array.isArray(currentAssigned)) currentAssigned = [];

    if (typeof currentAssignedDetails === "string") {
      try {
        currentAssignedDetails = JSON.parse(currentAssignedDetails);
      } catch (e) {
        currentAssignedDetails = [];
      }
    }
    if (!Array.isArray(currentAssignedDetails)) currentAssignedDetails = [];

    // Get new student details
    const students = await Student.findAll({
      where: { id: studentIds },
      attributes: ["id", "studentId", "fullName", "email", "phoneNo"],
      transaction,
    });

    // Merge new students without duplicates
    const newStudentIds = studentIds.filter((id) => !currentAssigned.includes(id));
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

    // Store as JSON string
    await exam.update(
      {
        assignedStudents: JSON.stringify(updatedAssigned),
        assignedStudentDetails: JSON.stringify(updatedAssignedDetails),
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `${newStudentIds.length} student(s) assigned to exam successfully!`,
      data: {
        examId: exam.id,
        examTitle: exam.title,
        totalAssigned: updatedAssigned.length,
        newlyAssigned: newStudentIds.length,
        assignedStudents: updatedAssignedDetails,
      },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error assigning students:", error);
    next(error);
  }
};

//! Get available students for exam
const getAvailableStudentsForExam = async (req, res, next) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findOne({ where: { id } });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found!",
      });
    }

    // Parse assignedStudents
    let assignedIds = exam.assignedStudents;

    if (typeof assignedIds === "string") {
      try {
        assignedIds = JSON.parse(assignedIds);
      } catch (e) {
        assignedIds = [];
      }
    }

    if (!Array.isArray(assignedIds)) {
      assignedIds = [];
    }

    const whereCondition = { status: "active" };

    if (assignedIds.length > 0) {
      whereCondition.id = { [Op.notIn]: assignedIds };
    }

    const students = await Student.findAll({
      where: whereCondition,
      attributes: [
        "id",
        "studentId",
        "fullName",
        "email",
        "phoneNo",
        "enrolledCourseId",
        "status",
      ],
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

//! Submit exam answers
const submitExamAnswers = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { examId } = req.params;
    const { answers, startedAt, submittedAt } = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    // Check if exam exists
    const exam = await Exam.findOne({ where: { id: examId }, transaction });
    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Exam not found!",
      });
    }

    if (!exam.allowSubmission) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "This exam is not open for submission at this time.",
      });
    }

    // Check if student is assigned to this exam
    let assignedStudents = exam.assignedStudents;
    if (typeof assignedStudents === "string") {
      assignedStudents = JSON.parse(assignedStudents);
    }
    if (!assignedStudents.includes(studentId)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this exam!",
      });
    }

    // Check if already submitted
    const existingResult = await Result.findOne({
      where: { examId, studentId, status: "completed" },
      transaction,
    });
    if (existingResult) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "You have already submitted this exam!",
      });
    }

    // Get student details
    const student = await Student.findOne({
      where: { id: studentId },
      attributes: ["studentId", "fullName"],
      transaction,
    });

    // Get all questions for this exam
    const allQuestions = await Question.findAll({
      where: { examId },
      order: [["order", "ASC"]],
      transaction,
    });

    // APPLY SET: grade only the questions this student was given
    let questions = allQuestions;
    if (exam.applySet && exam.setQuestionCount) {
      const picked = pickQuestionSet(
        allQuestions.map((q) => q.toJSON()),
        exam.setQuestionCount,
        `${exam.id}:${studentId}`
      );
      const pickedIds = new Set(picked.map((q) => q.id));
      questions = allQuestions.filter((q) => pickedIds.has(q.id));
    }

    // Calculate results
    let totalMarks = 0;
    let obtainedMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    const processedAnswers = [];

    for (const question of questions) {
      const qData = question.toJSON();

      // Parse options and correctAnswers
      let options = qData.options;
      let correctAnswers = qData.correctAnswers;

      if (typeof options === "string") options = JSON.parse(options);
      if (typeof correctAnswers === "string") correctAnswers = JSON.parse(correctAnswers);

      const marks = qData.marks;
      totalMarks += marks;

      const studentAnswer = answers.find((a) => a.questionId === qData.id);
      const selectedOptions = studentAnswer ? studentAnswer.selectedOptions : [];

      // Check if answer is correct (compare arrays)
      const isCorrect =
        selectedOptions.length === correctAnswers.length &&
        selectedOptions.every((opt) => correctAnswers.includes(opt));

      const marksObtained = isCorrect ? marks : 0;

      if (isCorrect) {
        obtainedMarks += marksObtained;
        correctCount++;
      } else if (selectedOptions.length > 0) {
        incorrectCount++;
      }

      processedAnswers.push({
        questionId: qData.id,
        questionText: qData.questionText,
        selectedOptions,
        correctAnswers,
        isCorrect,
        marksObtained,
        marks: marks,
      });
    }

    const percentage = (obtainedMarks / totalMarks) * 100;
    const isPassed = percentage >= (exam.passingMarks || 40);

    // Create or update result
    const [result, created] = await Result.findOrCreate({
      where: { examId, studentId },
      defaults: {
        examId,
        studentId,
        studentName: student?.fullName,
        studentStudentId: student?.studentId,
        totalQuestions: questions.length,
        attemptedQuestions: answers.length,
        correctAnswers: correctCount,
        incorrectAnswers: incorrectCount,
        obtainedMarks,
        totalMarks,
        percentage: percentage.toFixed(2),
        isPassed,
        answers: processedAnswers,
        startedAt: startedAt || new Date(),
        submittedAt: submittedAt || new Date(),
        status: "completed",
      },
      transaction,
    });

    if (!created) {
      await result.update(
        {
          totalQuestions: questions.length, // APPLY SET: keep in sync with the student's set
          attemptedQuestions: answers.length,
          correctAnswers: correctCount,
          incorrectAnswers: incorrectCount,
          obtainedMarks,
          totalMarks,
          percentage: percentage.toFixed(2),
          isPassed,
          answers: processedAnswers,
          submittedAt: submittedAt || new Date(),
          status: "completed",
        },
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Exam submitted successfully!",
      data: {
        obtainedMarks,
        totalMarks,
        percentage: percentage.toFixed(2),
        isPassed,
        correctAnswers: correctCount,
        incorrectAnswers: incorrectCount,
        totalQuestions: questions.length,
        attemptedQuestions: answers.length,
      },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error submitting exam:", error);
    next(error);
  }
};

//! Get student's exam attempts
const getStudentExamAttempts = async (req, res, next) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    const results = await Result.findAll({
      where: { studentId, status: "completed" },
      attributes: [
        "examId",
        "id",
        "status",
        "obtainedMarks",
        "totalMarks",
        "percentage",
        "isPassed",
        "submittedAt",
      ],
      order: [["submittedAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error getting student attempts:", error);
    next(error);
  }
};

//! Check if student has attempted exam
const checkExamAttempt = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    const result = await Result.findOne({
      where: { examId, studentId, status: "completed" },
    });

    return res.status(200).json({
      success: true,
      data: {
        hasAttempted: !!result,
        result: result || null,
      },
    });
  } catch (error) {
    console.error("Error checking exam attempt:", error);
    next(error);
  }
};

//! Start exam
const startExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { examId } = req.params;
    const { startedAt } = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    // Check if exam exists
    const exam = await Exam.findOne({ where: { id: examId }, transaction });
    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Exam not found!",
      });
    }

    if (!exam.allowSubmission) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "This exam is not open for attendance at this time.",
      });
    }

    // Check if already started or completed
    const existingResult = await Result.findOne({
      where: { examId, studentId },
      transaction,
    });

    if (existingResult && existingResult.status === "completed") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "You have already completed this exam!",
      });
    }

    if (existingResult && existingResult.status === "in-progress") {
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Exam already in progress",
        data: existingResult,
      });
    }

    // Get student details
    const student = await Student.findOne({
      where: { id: studentId },
      attributes: ["studentId", "fullName"],
      transaction,
    });

    // Create new result record
    const result = await Result.create(
      {
        examId,
        studentId,
        studentName: student?.fullName,
        studentStudentId: student?.studentId,
        startedAt: startedAt || new Date(),
        status: "in-progress",
        answers: [],
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Exam started successfully!",
      data: result,
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error starting exam:", error);
    next(error);
  }
};

module.exports = {
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
  getExamsByCourse,
  getExamResults,
  assignStudentsToExam,
  getAvailableStudentsForExam,

  getAllPaidExams,

  submitExamAnswers,
  getStudentExamAttempts,
  checkExamAttempt,
  startExam,
};