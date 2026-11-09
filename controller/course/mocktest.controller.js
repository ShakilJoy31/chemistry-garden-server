// controller/course/mocktest.controller.js
const crypto = require("crypto"); // APPLY SET: used for deterministic per-student shuffle
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Student = require("../../models/students/student.model");
const Course = require("../../models/Course/course.model");
const MockTest = require("../../models/Course/mocktest.model");
const MockTestQuestion = require("../../models/Course/mocktest-question.model");
const MockTestResult = require("../../models/Course/mocktest-result.model");

// Helper function to generate unique mock test ID
const generateMockTestId = async () => {
  const year = new Date().getFullYear();
  let isUnique = false;
  let mockTestId;
  let counter = 1;

  while (!isUnique) {
    const sequence = String(counter).padStart(4, "0");
    mockTestId = `MKT-${year}-${sequence}`;

    const existingMockTest = await MockTest.findOne({ where: { mockTestId } });
    if (!existingMockTest) {
      isUnique = true;
    } else {
      counter++;
    }
  }

  return mockTestId;
};

// Helper to get questions for a mock test (with parsed JSON)
const getQuestionsForMockTest = async (mockTestId) => {
  const questions = await MockTestQuestion.findAll({
    where: { mockTestId },
    order: [["order", "ASC"]],
  });

  return questions.map((q) => {
    const qData = q.toJSON();

    if (typeof qData.options === "string") {
      try {
        qData.options = JSON.parse(qData.options);
      } catch (e) {
        qData.options = [];
      }
    }

    if (typeof qData.correctAnswers === "string") {
      try {
        qData.correctAnswers = JSON.parse(qData.correctAnswers);
      } catch (e) {
        qData.correctAnswers = [];
      }
    }

    if (!Array.isArray(qData.options)) {
      qData.options = [];
    }

    if (!Array.isArray(qData.correctAnswers)) {
      qData.correctAnswers = [];
    }

    return qData;
  });
};

// ==================== APPLY SET HELPERS ====================

// Deterministic shuffle: same seed => same order (mulberry32 PRNG)
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

// Pick `count` questions for one student, keeping original display order
const pickQuestionSet = (questions, count, seed) => {
  if (!count || count >= questions.length) return questions;
  const sortedById = [...questions].sort((a, b) => a.id - b.id); // stable input order
  return seededShuffle(sortedById, seed)
    .slice(0, count)
    .sort((a, b) => a.order - b.order);
};

// Returns what a given student should see for a mock test
const applySetForStudent = (mockTestRaw, questions, studentId) => {
  if (!mockTestRaw.applySet || !mockTestRaw.setQuestionCount) {
    return {
      questions,
      totalQuestions: mockTestRaw.totalQuestions,
      totalMarks: mockTestRaw.totalMarks,
    };
  }
  const picked = pickQuestionSet(
    questions,
    mockTestRaw.setQuestionCount,
    `${mockTestRaw.id}:${studentId}`,
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

//! Create a new mock test
const createMockTest = async (req, res, next) => {
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
      mockTestCost,
      applySet, // APPLY SET
      setQuestionCount, // APPLY SET
    } = req.body;

    if (!title || !courseId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Title and course ID are required!",
      });
    }

    if (isPaid) {
      if (!mockTestCost || parseFloat(mockTestCost) <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Please provide a valid mock test cost for paid mock test",
        });
      }
    }

    // APPLY SET: validate set size against total questions
    const setError = validateSetConfig(
      applySet,
      setQuestionCount,
      Array.isArray(questions) ? questions.length : 0,
    );
    if (setError) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: setError,
      });
    }

    const course = await Course.findOne({ where: { id: courseId } });
    if (!course) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    let totalMarks = 0;
    if (questions && Array.isArray(questions)) {
      totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    }

    let assignedStudentDetails = [];
    if (
      assignedStudents &&
      Array.isArray(assignedStudents) &&
      assignedStudents.length > 0
    ) {
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

    const mockTestId = await generateMockTestId();

    const mockTest = await MockTest.create(
      {
        mockTestId,
        title,
        description: description || null,
        courseId,
        courseName: courseName || course.courseName,
        totalQuestions: questions ? questions.length : 0,
        totalMarks,
        passingMarks: passingMarks || Math.ceil(totalMarks * 0.4),
        duration: duration || null,
        instructions: instructions || null,
        assignedStudents: assignedStudents || [],
        assignedStudentDetails: assignedStudentDetails,
        createdBy: req.user?.id || null,
        isPaid: isPaid || false,
        mockTestCost: isPaid ? parseFloat(mockTestCost) : 0.0,
        // APPLY SET
        applySet: !!applySet,
        setQuestionCount: applySet ? parseInt(setQuestionCount, 10) : null,
      },
      { transaction },
    );

    if (questions && Array.isArray(questions) && questions.length > 0) {
      const questionPromises = questions.map((q, index) =>
        MockTestQuestion.create(
          {
            mockTestId: mockTest.id,
            questionText: q.questionText,
            questionType: q.questionType || "single",
            options: q.options,
            correctAnswers: q.correctAnswers,
            marks: q.marks || 1,
            order: index + 1,
            explanation: q.explanation || null,
          },
          { transaction },
        ),
      );
      await Promise.all(questionPromises);
    }

    await transaction.commit();

    const mockTestQuestions = await getQuestionsForMockTest(mockTest.id);

    return res.status(201).json({
      success: true,
      message: "Mock test created successfully!",
      data: {
        ...mockTest.toJSON(),
        questions: mockTestQuestions,
      },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error creating mock test:", error);
    next(error);
  }
};

//! Get all mock tests with filters
const getAllMockTests = async (req, res, next) => {
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
        { mockTestId: { [Op.like]: `%${search}%` } },
        { courseName: { [Op.like]: `%${search}%` } },
      ];
    }

    if (courseId) {
      whereClause.courseId = parseInt(courseId);
    }

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: mockTests } = await MockTest.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    // Check if the requester is a student
    const isStudent = req.forStudent || req.user?.role === "student";

    const mockTestsWithData = [];

    for (const mockTest of mockTests) {
      const allQuestions = await getQuestionsForMockTest(mockTest.id);
      const mockTestRaw = mockTest.toJSON();

      // APPLY SET
      const view = isStudent
        ? applySetForStudent(mockTestRaw, allQuestions, req.user?.id)
        : {
            questions: allQuestions,
            totalQuestions: mockTestRaw.totalQuestions,
            totalMarks: mockTestRaw.totalMarks,
          };

      let assignedStudents = mockTestRaw.assignedStudents;
      let assignedStudentDetails = mockTestRaw.assignedStudentDetails;

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

      mockTestsWithData.push({
        id: mockTestRaw.id,
        mockTestId: mockTestRaw.mockTestId,
        title: mockTestRaw.title,
        description: mockTestRaw.description,
        courseId: mockTestRaw.courseId,
        courseName: mockTestRaw.courseName,
        totalQuestions: view.totalQuestions, // APPLY SET
        totalMarks: view.totalMarks, // APPLY SET
        passingMarks: mockTestRaw.passingMarks,
        duration: mockTestRaw.duration,
        status: mockTestRaw.status,
        assignedStudents: assignedStudents,
        assignedStudentDetails: assignedStudentDetails,
        instructions: mockTestRaw.instructions,
        createdBy: mockTestRaw.createdBy,
        publishedAt: mockTestRaw.publishedAt,
        createdAt: mockTestRaw.createdAt,
        updatedAt: mockTestRaw.updatedAt,
        questions: view.questions, // APPLY SET
        allowSubmission: mockTestRaw.allowSubmission,
        isPaid: mockTestRaw.isPaid || false,
        mockTestCost: mockTestRaw.mockTestCost
          ? parseFloat(mockTestRaw.mockTestCost)
          : 0.0,
        // APPLY SET
        applySet: mockTestRaw.applySet || false,
        setQuestionCount: mockTestRaw.setQuestionCount || null,
      });
    }

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Mock tests retrieved successfully!",
      data: mockTestsWithData,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting mock tests:", error);
    next(error);
  }
};

//! Get all paid mock tests for students
const getAllPaidMockTests = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      courseId = "",
      status = "",
      isPaid = "",
      minPrice = "",
      maxPrice = "",
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { mockTestId: { [Op.like]: `%${search}%` } },
        { courseName: { [Op.like]: `%${search}%` } },
      ];
    }

    if (courseId) {
      whereClause.courseId = parseInt(courseId);
    }

    if (status) {
      whereClause.status = status;
    }

    if (isPaid !== "") {
      whereClause.isPaid = isPaid === "true";
    }

    if (minPrice !== "" || maxPrice !== "") {
      whereClause.mockTestCost = {};
      if (minPrice !== "") {
        whereClause.mockTestCost[Op.gte] = parseFloat(minPrice);
      }
      if (maxPrice !== "") {
        whereClause.mockTestCost[Op.lte] = parseFloat(maxPrice);
      }
    }

    let order = [];
    if (sortBy === "price") {
      order = [["mockTestCost", sortOrder]];
    } else if (sortBy === "title") {
      order = [["title", sortOrder]];
    } else {
      order = [[sortBy, sortOrder]];
    }

    const { count, rows: mockTests } = await MockTest.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: order,
    });

    // Check if the requester is a student
    const isStudent = req.forStudent || req.user?.role === "student";

    const mockTestsWithData = [];

    for (const mockTest of mockTests) {
      const allQuestions = await getQuestionsForMockTest(mockTest.id);
      const mockTestRaw = mockTest.toJSON();

      // APPLY SET
      const view = isStudent
        ? applySetForStudent(mockTestRaw, allQuestions, req.user?.id)
        : {
            questions: allQuestions,
            totalQuestions: mockTestRaw.totalQuestions,
            totalMarks: mockTestRaw.totalMarks,
          };

      let assignedStudents = mockTestRaw.assignedStudents;
      let assignedStudentDetails = mockTestRaw.assignedStudentDetails;

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

      mockTestsWithData.push({
        id: mockTestRaw.id,
        mockTestId: mockTestRaw.mockTestId,
        title: mockTestRaw.title,
        description: mockTestRaw.description,
        courseId: mockTestRaw.courseId,
        courseName: mockTestRaw.courseName,
        totalQuestions: view.totalQuestions, // APPLY SET
        totalMarks: view.totalMarks, // APPLY SET
        passingMarks: mockTestRaw.passingMarks,
        duration: mockTestRaw.duration,
        status: mockTestRaw.status,
        assignedStudents: assignedStudents,
        assignedStudentDetails: assignedStudentDetails,
        instructions: mockTestRaw.instructions,
        createdBy: mockTestRaw.createdBy,
        publishedAt: mockTestRaw.publishedAt,
        createdAt: mockTestRaw.createdAt,
        updatedAt: mockTestRaw.updatedAt,
        questions: view.questions, // APPLY SET
        allowSubmission: mockTestRaw.allowSubmission,
        isPaid: mockTestRaw.isPaid || false,
        mockTestCost: mockTestRaw.mockTestCost
          ? parseFloat(mockTestRaw.mockTestCost)
          : 0.0,
        // APPLY SET
        applySet: mockTestRaw.applySet || false,
        setQuestionCount: mockTestRaw.setQuestionCount || null,
      });
    }

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Mock tests retrieved successfully!",
      data: mockTestsWithData,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting mock tests:", error);
    next(error);
  }
};

//! Get mock test by ID
const getMockTestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const mockTest = await MockTest.findOne({ where: { id } });

    if (!mockTest) {
      return res.status(404).json({
        success: false,
        message: "Mock test not found!",
      });
    }

    const allQuestions = await getQuestionsForMockTest(mockTest.id);
    const mockTestRaw = mockTest.toJSON();

    // Check if the requester is a student
    const isStudent = req.forStudent || req.user?.role === "student";

    // APPLY SET
    const view = isStudent
      ? applySetForStudent(mockTestRaw, allQuestions, req.user?.id)
      : {
          questions: allQuestions,
          totalQuestions: mockTestRaw.totalQuestions,
          totalMarks: mockTestRaw.totalMarks,
        };

    let assignedStudents = mockTestRaw.assignedStudents;
    let assignedStudentDetails = mockTestRaw.assignedStudentDetails;

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
      message: "Mock test retrieved successfully!",
      data: {
        ...mockTestRaw,
        assignedStudents: assignedStudents,
        assignedStudentDetails: assignedStudentDetails,
        questions: view.questions, // APPLY SET
        totalQuestions: view.totalQuestions, // APPLY SET
        totalMarks: view.totalMarks, // APPLY SET
        allowSubmission: mockTestRaw.allowSubmission,
      },
    });
  } catch (error) {
    console.error("Error getting mock test:", error);
    next(error);
  }
};

//! Update mock test
const updateMockTest = async (req, res, next) => {
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
      mockTestCost,
      applySet, // APPLY SET
      setQuestionCount, // APPLY SET
    } = req.body;

    const mockTest = await MockTest.findOne({ where: { id }, transaction });

    if (!mockTest) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Mock test not found!",
      });
    }

    if (isPaid !== undefined && isPaid === true) {
      if (!mockTestCost || parseFloat(mockTestCost) <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Please provide a valid mock test cost for paid mock test",
        });
      }
    }

    // APPLY SET: validate set size
    const nextApplySet =
      applySet !== undefined ? !!applySet : !!mockTest.applySet;
    const nextSetCount =
      setQuestionCount !== undefined
        ? setQuestionCount
        : mockTest.setQuestionCount;
    const nextTotalQuestions = Array.isArray(questions)
      ? questions.length
      : mockTest.totalQuestions;

    const setError = validateSetConfig(
      nextApplySet,
      nextSetCount,
      nextTotalQuestions,
    );
    if (setError) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: setError,
      });
    }

    let existingAssignedStudents = mockTest.assignedStudents;
    let existingAssignedStudentDetails = mockTest.assignedStudentDetails;

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

    await mockTest.update(
      {
        title: title || mockTest.title,
        description:
          description !== undefined ? description : mockTest.description,
        passingMarks: passingMarks || mockTest.passingMarks,
        duration: duration !== undefined ? duration : mockTest.duration,
        instructions:
          instructions !== undefined ? instructions : mockTest.instructions,
        status: status || mockTest.status,
        assignedStudents: assignedStudents || existingAssignedStudents,
        assignedStudentDetails: assignedStudentDetails,
        publishedAt:
          status === "published" && mockTest.status !== "published"
            ? new Date()
            : mockTest.publishedAt,
        allowSubmission:
          allowSubmission !== undefined
            ? allowSubmission
            : mockTest.allowSubmission,
        isPaid: isPaid !== undefined ? isPaid : mockTest.isPaid,
        mockTestCost: isPaid
          ? parseFloat(mockTestCost)
          : mockTestCost !== undefined
            ? parseFloat(mockTestCost)
            : mockTest.mockTestCost,
        // APPLY SET
        applySet: nextApplySet,
        setQuestionCount: nextApplySet ? parseInt(nextSetCount, 10) : null,
      },
      { transaction },
    );

    if (questions && Array.isArray(questions)) {
      await MockTestQuestion.destroy({
        where: { mockTestId: mockTest.id },
        transaction,
      });

      const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

      const questionPromises = questions.map((q, index) =>
        MockTestQuestion.create(
          {
            mockTestId: mockTest.id,
            questionText: q.questionText,
            questionType: q.questionType || "single",
            options: q.options,
            correctAnswers: q.correctAnswers,
            marks: q.marks || 1,
            order: index + 1,
            explanation: q.explanation || null,
          },
          { transaction },
        ),
      );
      await Promise.all(questionPromises);

      await mockTest.update(
        {
          totalQuestions: questions.length,
          totalMarks: totalMarks,
        },
        { transaction },
      );
    }

    await transaction.commit();

    const updatedQuestions = await getQuestionsForMockTest(mockTest.id);
    const mockTestRaw = mockTest.toJSON();

    let assignedStudentsParsed = mockTestRaw.assignedStudents;
    let assignedStudentDetailsParsed = mockTestRaw.assignedStudentDetails;

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
      message: "Mock test updated successfully!",
      data: {
        id: mockTestRaw.id,
        mockTestId: mockTestRaw.mockTestId,
        title: mockTestRaw.title,
        description: mockTestRaw.description,
        courseId: mockTestRaw.courseId,
        courseName: mockTestRaw.courseName,
        totalQuestions: mockTestRaw.totalQuestions,
        totalMarks: mockTestRaw.totalMarks,
        passingMarks: mockTestRaw.passingMarks,
        duration: mockTestRaw.duration,
        status: mockTestRaw.status,
        assignedStudents: assignedStudentsParsed,
        assignedStudentDetails: assignedStudentDetailsParsed,
        instructions: mockTestRaw.instructions,
        createdBy: mockTestRaw.createdBy,
        publishedAt: mockTestRaw.publishedAt,
        createdAt: mockTestRaw.createdAt,
        updatedAt: mockTestRaw.updatedAt,
        allowSubmission: mockTestRaw.allowSubmission,
        questions: updatedQuestions,
        isPaid: mockTestRaw.isPaid || false,
        mockTestCost: mockTestRaw.mockTestCost
          ? parseFloat(mockTestRaw.mockTestCost)
          : 0.0,
        // APPLY SET
        applySet: mockTestRaw.applySet || false,
        setQuestionCount: mockTestRaw.setQuestionCount || null,
      },
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error updating mock test:", error);
    next(error);
  }
};

//! Submit mock test answers
const submitMockTestAnswers = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { mockTestId } = req.params;
    const { answers, startedAt, submittedAt } = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    const mockTest = await MockTest.findOne({
      where: { id: mockTestId },
      transaction,
    });
    if (!mockTest) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Mock test not found!",
      });
    }

    if (!mockTest.allowSubmission) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "This mock test is not open for submission at this time.",
      });
    }

    let assignedStudents = mockTest.assignedStudents;
    if (typeof assignedStudents === "string") {
      assignedStudents = JSON.parse(assignedStudents);
    }
    if (!assignedStudents.includes(studentId)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this mock test!",
      });
    }

    const existingResult = await MockTestResult.findOne({
      where: { mockTestId, studentId, status: "completed" },
      transaction,
    });
    if (existingResult) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "You have already submitted this mock test!",
      });
    }

    const student = await Student.findOne({
      where: { id: studentId },
      attributes: ["studentId", "fullName"],
      transaction,
    });

    const allQuestions = await MockTestQuestion.findAll({
      where: { mockTestId },
      order: [["order", "ASC"]],
      transaction,
    });

    // APPLY SET: grade only the questions this student was given
    let questions = allQuestions;
    if (mockTest.applySet && mockTest.setQuestionCount) {
      const picked = pickQuestionSet(
        allQuestions.map((q) => q.toJSON()),
        mockTest.setQuestionCount,
        `${mockTest.id}:${studentId}`,
      );
      const pickedIds = new Set(picked.map((q) => q.id));
      questions = allQuestions.filter((q) => pickedIds.has(q.id));
    }

    let totalMarks = 0;
    let obtainedMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    const processedAnswers = [];

    for (const question of questions) {
      const qData = question.toJSON();

      let options = qData.options;
      let correctAnswers = qData.correctAnswers;

      if (typeof options === "string") options = JSON.parse(options);
      if (typeof correctAnswers === "string")
        correctAnswers = JSON.parse(correctAnswers);

      const marks = qData.marks;
      totalMarks += marks;

      const studentAnswer = answers.find((a) => a.questionId === qData.id);
      const selectedOptions = studentAnswer
        ? studentAnswer.selectedOptions
        : [];

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
    const isPassed = percentage >= (mockTest.passingMarks || 40);

    const [result, created] = await MockTestResult.findOrCreate({
      where: { mockTestId, studentId },
      defaults: {
        mockTestId,
        studentId,
        studentName: student?.fullName,
        studentStudentId: student?.studentId,
        totalQuestions: questions.length, // APPLY SET: keep in sync with the student's set
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
        { transaction },
      );
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Mock test submitted successfully!",
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
    console.error("Error submitting mock test:", error);
    next(error);
  }
};

//! Get mock test results
const getMockTestResults = async (req, res, next) => {
  try {
    const { mockTestId } = req.params;

    const results = await MockTestResult.findAll({
      where: { mockTestId },
      order: [["percentage", "DESC"]],
    });

    const mockTest = await MockTest.findOne({
      where: { id: mockTestId },
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
      topScore: results.length
        ? Math.max(...results.map((r) => r.percentage))
        : 0,
    };

    return res.status(200).json({
      success: true,
      message: "Results retrieved successfully!",
      data: {
        mockTest,
        stats,
        results,
      },
    });
  } catch (error) {
    console.error("Error getting mock test results:", error);
    next(error);
  }
};

//! Assign students to mock test
const assignStudentsToMockTest = async (req, res, next) => {
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

    const mockTest = await MockTest.findOne({ where: { id }, transaction });

    if (!mockTest) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Mock test not found!",
      });
    }

    let currentAssigned = mockTest.assignedStudents;
    let currentAssignedDetails = mockTest.assignedStudentDetails;

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

    const students = await Student.findAll({
      where: { id: studentIds },
      attributes: ["id", "studentId", "fullName", "email", "phoneNo"],
      transaction,
    });

    const newStudentIds = studentIds.filter(
      (id) => !currentAssigned.includes(id),
    );
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
    const updatedAssignedDetails = [
      ...currentAssignedDetails,
      ...newStudentDetails,
    ];

    await mockTest.update(
      {
        assignedStudents: JSON.stringify(updatedAssigned),
        assignedStudentDetails: JSON.stringify(updatedAssignedDetails),
      },
      { transaction },
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `${newStudentIds.length} student(s) assigned to mock test successfully!`,
      data: {
        mockTestId: mockTest.id,
        mockTestTitle: mockTest.title,
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

//! Get available students for mock test
const getAvailableStudentsForMockTest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const mockTest = await MockTest.findOne({ where: { id } });

    if (!mockTest) {
      return res.status(404).json({
        success: false,
        message: "Mock test not found!",
      });
    }

    let assignedIds = mockTest.assignedStudents;

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

//! Get student's mock test attempts
const getStudentMockTestAttempts = async (req, res, next) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    const results = await MockTestResult.findAll({
      where: { studentId, status: "completed" },
      attributes: [
        "mockTestId",
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

//! Check if student has attempted mock test
const checkMockTestAttempt = async (req, res, next) => {
  try {
    const { mockTestId } = req.params;
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    const result = await MockTestResult.findOne({
      where: { mockTestId, studentId, status: "completed" },
    });

    return res.status(200).json({
      success: true,
      data: {
        hasAttempted: !!result,
        result: result || null,
      },
    });
  } catch (error) {
    console.error("Error checking mock test attempt:", error);
    next(error);
  }
};

//! Start mock test
const startMockTest = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { mockTestId } = req.params;
    const { startedAt } = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    const mockTest = await MockTest.findOne({
      where: { id: mockTestId },
      transaction,
    });
    if (!mockTest) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Mock test not found!",
      });
    }

    if (!mockTest.allowSubmission) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "This mock test is not open for attendance at this time.",
      });
    }

    const existingResult = await MockTestResult.findOne({
      where: { mockTestId, studentId },
      transaction,
    });

    if (existingResult && existingResult.status === "completed") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "You have already completed this mock test!",
      });
    }

    if (existingResult && existingResult.status === "in-progress") {
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Mock test already in progress",
        data: existingResult,
      });
    }

    const student = await Student.findOne({
      where: { id: studentId },
      attributes: ["studentId", "fullName"],
      transaction,
    });

    const result = await MockTestResult.create(
      {
        mockTestId,
        studentId,
        studentName: student?.fullName,
        studentStudentId: student?.studentId,
        startedAt: startedAt || new Date(),
        status: "in-progress",
        answers: [],
      },
      { transaction },
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Mock test started successfully!",
      data: result,
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error starting mock test:", error);
    next(error);
  }
};

//! Delete mock test
const deleteMockTest = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const mockTest = await MockTest.findOne({ where: { id }, transaction });

    if (!mockTest) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Mock test not found!",
      });
    }

    await MockTestQuestion.destroy({ where: { mockTestId: id }, transaction });
    await MockTestResult.destroy({ where: { mockTestId: id }, transaction });
    await mockTest.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Mock test deleted successfully!",
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit") {
      await transaction.rollback();
    }
    console.error("Error deleting mock test:", error);
    next(error);
  }
};

//! Get mock tests by course
const getMockTestsByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const mockTests = await MockTest.findAll({
      where: {
        courseId,
        status: "published",
      },
      order: [["createdAt", "DESC"]],
    });

    // Check if the requester is a student
    const isStudent = req.forStudent || req.user?.role === "student";

    const mockTestsWithStats = [];

    for (const mockTest of mockTests) {
      const allQuestions = await getQuestionsForMockTest(mockTest.id);
      const mockTestRaw = mockTest.toJSON();

      // APPLY SET
      const view = isStudent
        ? applySetForStudent(mockTestRaw, allQuestions, req.user?.id)
        : {
            questions: allQuestions,
            totalQuestions: mockTestRaw.totalQuestions,
            totalMarks: mockTestRaw.totalMarks,
          };

      let assignedStudents = mockTestRaw.assignedStudents;
      if (typeof assignedStudents === "string") {
        try {
          assignedStudents = JSON.parse(assignedStudents);
        } catch (e) {
          assignedStudents = [];
        }
      }
      if (!Array.isArray(assignedStudents)) assignedStudents = [];

      mockTestsWithStats.push({
        ...mockTestRaw,
        assignedStudents: assignedStudents,
        totalQuestions: view.totalQuestions, // APPLY SET
        totalMarks: view.totalMarks, // APPLY SET
        stats: {
          totalStudents: assignedStudents.length,
          totalMarks: view.totalMarks, // APPLY SET
        },
        questions: view.questions.map((q) => ({ id: q.id, marks: q.marks })), // APPLY SET
        // APPLY SET FIELDS
        applySet: mockTestRaw.applySet || false,
        setQuestionCount: mockTestRaw.setQuestionCount || null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mock tests retrieved successfully!",
      data: mockTestsWithStats,
    });
  } catch (error) {
    console.error("Error getting mock tests by course:", error);
    next(error);
  }
};

module.exports = {
  createMockTest,
  getAllMockTests,
  getMockTestById,
  updateMockTest,
  deleteMockTest,
  getMockTestsByCourse,
  getMockTestResults,
  assignStudentsToMockTest,
  getAvailableStudentsForMockTest,
  getAllPaidMockTests,
  submitMockTestAnswers,
  getStudentMockTestAttempts,
  checkMockTestAttempt,
  startMockTest,
};
