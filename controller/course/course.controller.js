// controllers/course/course.controller.js
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Course = require("../../models/Course/course.model");
const Student = require("../../models/students/student.model");

// Helper function to transform course response
const transformCourseResponse = (course) => {
  const courseData = course.toJSON ? course.toJSON() : course;
  return courseData;
};

// Helper function to safely parse enrolledCourses
const parseEnrolledCourses = (enrolledCourses) => {
  if (!enrolledCourses) return [];
  if (Array.isArray(enrolledCourses)) return enrolledCourses;
  if (typeof enrolledCourses === 'string') {
    try {
      // Handle double or triple encoded JSON
      let parsed = enrolledCourses;
      // If it's a string that starts with quote, it might be double encoded
      if (parsed.startsWith('"') && parsed.endsWith('"')) {
        parsed = JSON.parse(parsed);
      }
      // If it's still a string but starts with [, parse it
      if (typeof parsed === 'string' && parsed.startsWith('[')) {
        parsed = JSON.parse(parsed);
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Error parsing enrolledCourses:', e);
      return [];
    }
  }
  return [];
};

// Helper function to get students for a course
const getStudentsForCourse = async (courseId) => {
  try {
    // First, try to find students with enrolledCourseId
    const studentsWithCourseId = await Student.findAll({
      where: { enrolledCourseId: courseId },
      attributes: ['id', 'studentId', 'fullName', 'email', 'phoneNo', 'status']
    });
    
    let allStudents = [...studentsWithCourseId];
    
    // Also find students who have this course in their enrolledCourses JSON array
    try {
      // Get all students and filter by enrolledCourses
      const allStudentsList = await Student.findAll({
        attributes: ['id', 'studentId', 'fullName', 'email', 'phoneNo', 'status', 'enrolledCourses']
      });
      
      for (const student of allStudentsList) {
        // Skip if already in the list
        if (allStudents.some(s => s.id === student.id)) continue;
        
        const courses = parseEnrolledCourses(student.enrolledCourses);
        const isEnrolled = courses.some(c => c.courseId === courseId && c.status !== 'dropped');
        
        if (isEnrolled) {
          allStudents.push({
            id: student.id,
            studentId: student.studentId,
            fullName: student.fullName,
            email: student.email,
            phoneNo: student.phoneNo,
            status: student.status
          });
        }
      }
    } catch (error) {
      console.error(`Error filtering enrolledCourses for course ${courseId}:`, error);
    }
    
    return allStudents;
  } catch (error) {
    console.error(`Error getting students for course ${courseId}:`, error);
    return [];
  }
};

// Helper function to generate unique course ID
const generateUniqueCourseId = async () => {
  const year = new Date().getFullYear();
  let isUnique = false;
  let courseId;
  let counter = 1;
  
  while (!isUnique) {
    const sequence = String(counter).padStart(4, '0');
    courseId = `CRS-${year}-${sequence}`;
    
    const existingCourse = await Course.findOne({ where: { courseId } });
    if (!existingCourse) {
      isUnique = true;
    } else {
      counter++;
    }
  }
  
  return courseId;
};

//! Get all courses with pagination, filters, and student counts
const getAllCourses = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      category = "",
      level = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { courseName: { [Op.like]: `%${search}%` } },
        { courseId: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { instructor: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    if (category) {
      whereClause.category = category;
    }

    if (level) {
      whereClause.level = level;
    }

    const { count, rows: courses } = await Course.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    // Get student counts for each course
    const coursesWithStudents = await Promise.all(
      courses.map(async (course) => {
        const courseData = transformCourseResponse(course);
        
        // Get students for this course
        const students = await getStudentsForCourse(course.id);
        
        // Ensure students is an array
        const studentList = Array.isArray(students) ? students : [];
        
        // Extract student IDs safely
        const studentIds = studentList.map(s => s.id).filter(id => id !== undefined);
        
        return {
          ...courseData,
          assignedStudentIds: studentIds,
          assignedStudents: studentList,
          assignedStudentCount: studentIds.length
        };
      })
    );

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Courses retrieved successfully!",
      data: coursesWithStudents,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting courses:", error);
    next(error);
  }
};

//! Get course by ID with student information
const getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findOne({ where: { id } });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }
    
    // Get students for this course
    const students = await getStudentsForCourse(course.id);
    
    // Ensure students is an array
    const studentList = Array.isArray(students) ? students : [];
    
    const courseData = transformCourseResponse(course);
    
    return res.status(200).json({
      success: true,
      message: "Course retrieved successfully!",
      data: {
        ...courseData,
        assignedStudentIds: studentList.map(s => s.id).filter(id => id !== undefined),
        assignedStudents: studentList,
        assignedStudentCount: studentList.length
      },
    });
  } catch (error) {
    console.error("Error getting course:", error);
    next(error);
  }
};

//! Get available courses (active only for assignment)
const getAvailableCourses = async (req, res, next) => {
  try {
    const { search = "" } = req.query;
    
    const whereClause = { status: "active" };
    
    if (search) {
      whereClause[Op.or] = [
        { courseName: { [Op.like]: `%${search}%` } },
        { courseId: { [Op.like]: `%${search}%` } },
      ];
    }
    
    const courses = await Course.findAll({
      where: whereClause,
      order: [["courseName", "ASC"]],
    });
    
    return res.status(200).json({
      success: true,
      message: "Available courses retrieved successfully!",
      data: courses,
    });
  } catch (error) {
    console.error("Error getting available courses:", error);
    next(error);
  }
};

//! Create new course
const createCourse = async (req, res, next) => {
  try {
    const {
      courseName,
      description,
      duration,
      durationUnit,
      totalFee,
      status,
      thumbnail,
      syllabus,
      prerequisites,
      category,
      level,
      instructor,
      maxStudents,
      startDate,
      endDate,
      classSchedule,
      materials,
    } = req.body;
    
    const courseId = await generateUniqueCourseId();
    
    const newCourse = await Course.create({
      courseId: courseId,
      courseName: courseName || null,
      description: description || null,
      duration: duration || null,
      durationUnit: durationUnit || null,
      totalFee: totalFee || null,
      status: status || "active",
      thumbnail: thumbnail || null,
      syllabus: syllabus || null,
      prerequisites: prerequisites || null,
      category: category || null,
      level: level || null,
      instructor: instructor || null,
      maxStudents: maxStudents || null,
      startDate: startDate || null,
      endDate: endDate || null,
      classSchedule: classSchedule || null,
      materials: materials || null,
      createdBy: req.user?.id || null,
    });
    
    return res.status(201).json({
      success: true,
      message: "Course created successfully!",
      data: transformCourseResponse(newCourse),
    });
  } catch (error) {
    console.error("Error creating course:", error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      try {
        const newCourseId = await generateUniqueCourseId();
        const {
          courseName,
          description,
          duration,
          durationUnit,
          totalFee,
          status,
          thumbnail,
          syllabus,
          prerequisites,
          category,
          level,
          instructor,
          maxStudents,
          startDate,
          endDate,
          classSchedule,
          materials,
        } = req.body;
        
        const newCourse = await Course.create({
          courseId: newCourseId,
          courseName: courseName || null,
          description: description || null,
          duration: duration || null,
          durationUnit: durationUnit || null,
          totalFee: totalFee || null,
          status: status || "active",
          thumbnail: thumbnail || null,
          syllabus: syllabus || null,
          prerequisites: prerequisites || null,
          category: category || null,
          level: level || null,
          instructor: instructor || null,
          maxStudents: maxStudents || null,
          startDate: startDate || null,
          endDate: endDate || null,
          classSchedule: classSchedule || null,
          materials: materials || null,
          createdBy: req.user?.id || null,
        });
        
        return res.status(201).json({
          success: true,
          message: "Course created successfully!",
          data: transformCourseResponse(newCourse),
        });
      } catch (retryError) {
        console.error("Error creating course on retry:", retryError);
        return res.status(500).json({
          success: false,
          message: "Failed to create course due to duplicate ID. Please try again.",
        });
      }
    }
    
    next(error);
  }
};

//! Update course
const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const course = await Course.findOne({ where: { id } });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }
    
    delete updateData.courseId;
    
    await Course.update(updateData, { where: { id } });
    
    const updatedCourse = await Course.findOne({ where: { id } });
    
    return res.status(200).json({
      success: true,
      message: "Course updated successfully!",
      data: transformCourseResponse(updatedCourse),
    });
  } catch (error) {
    console.error("Error updating course:", error);
    next(error);
  }
};

//! Delete course
const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findOne({ where: { id } });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }
    
    // Get all students with this course
    const allStudents = await Student.findAll({
      attributes: ['id', 'enrolledCourseId', 'enrolledCourses']
    });
    
    for (const student of allStudents) {
      let updated = false;
      
      // Check enrolledCourseId
      if (student.enrolledCourseId === parseInt(id)) {
        student.enrolledCourseId = null;
        updated = true;
      }
      
      // Check enrolledCourses JSON
      const courses = parseEnrolledCourses(student.enrolledCourses);
      const courseIndex = courses.findIndex(c => c.courseId === parseInt(id));
      if (courseIndex !== -1) {
        courses.splice(courseIndex, 1);
        student.enrolledCourses = JSON.stringify(courses);
        updated = true;
      }
      
      if (updated) {
        await student.save();
      }
    }
    
    await Course.destroy({ where: { id } });
    
    return res.status(200).json({
      success: true,
      message: "Course deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    next(error);
  }
};

//! Get course statistics
const getCourseStats = async (req, res, next) => {
  try {
    const totalCourses = await Course.count();
    const activeCourses = await Course.count({ where: { status: "active" } });
    const inactiveCourses = await Course.count({ where: { status: "inactive" } });
    
    const categoryStats = await Course.findAll({
      attributes: [
        "category",
        [sequelize.fn("COUNT", sequelize.col("category")), "count"],
      ],
      where: { category: { [Op.ne]: null } },
      group: ["category"],
    });
    
    const levelStats = await Course.findAll({
      attributes: [
        "level",
        [sequelize.fn("COUNT", sequelize.col("level")), "count"],
      ],
      where: { level: { [Op.ne]: null } },
      group: ["level"],
    });
    
    return res.status(200).json({
      success: true,
      message: "Course statistics retrieved successfully!",
      data: {
        total: totalCourses,
        active: activeCourses,
        inactive: inactiveCourses,
        byCategory: categoryStats,
        byLevel: levelStats,
      },
    });
  } catch (error) {
    console.error("Error getting course stats:", error);
    next(error);
  }
};

//! Get students for a specific course
const getCourseStudents = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findOne({ where: { id } });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }
    
    // Get students for this course
    const students = await getStudentsForCourse(course.id);
    
    // Ensure students is an array
    const studentList = Array.isArray(students) ? students : [];
    
    return res.status(200).json({
      success: true,
      message: "Course students retrieved successfully!",
      data: studentList,
      count: studentList.length
    });
  } catch (error) {
    console.error("Error getting course students:", error);
    next(error);
  }
};

module.exports = {
  getAllCourses,
  getAvailableCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStats,
  getCourseStudents,
};