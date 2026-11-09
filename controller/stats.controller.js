// controllers/stats/stats.controller.js
const { Op, fn, col, literal } = require("sequelize");

// ---------------------------------------------------------------------------
// Models — the ones you shared
// ---------------------------------------------------------------------------

const Course = require("../models/Course/course.model");
const Student = require("../models/students/student.model");
const Exam = require("../models/Course/exam.model");
const IsoExam = require("../models/Course/isoexam.model");
const Service = require("../models/service/service.model");
const SubService = require("../models/service/sub-service.model");
const ValuedClients = require("../models/Settings/valuedClients.model");
const ValuedPartners = require("../models/Settings/valuedPartners.model");

/* ============================================================
   Helper — safely run a count/aggregate without breaking the
   whole response if a single table errors (e.g. table missing).
============================================================ */
async function safe(fn, fallback = 0) {
  try {
    const result = await fn();
    return result ?? fallback;
  } catch (err) {
    console.error("[stats] subquery failed:", err.message);
    return fallback;
  }
}

/* ============================================================
   Shared core — computes every stat once.
   Both admin and public endpoints read from this.
============================================================ */
async function computeStats() {
  /* ---------------- COURSES ---------------- */
  const totalCourses = await safe(() => Course.count());
  const activeCourses = await safe(() =>
    Course.count({ where: { status: "active" } })
  );
  const inactiveCourses = await safe(() =>
    Course.count({ where: { status: "inactive" } })
  );

  /* ---------------- STUDENTS ---------------- */
  const totalStudents = await safe(() => Student.count());
  const activeStudents = await safe(() =>
    Student.count({ where: { status: "active" } })
  );
  const completedStudents = await safe(() =>
    Student.count({ where: { status: "completed" } })
  );
  const certifiedStudents = await safe(() =>
    Student.count({ where: { certificateIssued: true } })
  );

  /* ---------------- EXAMS ---------------- */
  const totalExams = await safe(() => Exam.count());
  const publishedExams = await safe(() =>
    Exam.count({ where: { status: "published" } })
  );
  const paidExams = await safe(() => Exam.count({ where: { isPaid: true } }));

  /* ---------------- ISO EXAMS ---------------- */
  const totalIsoExams = await safe(() => IsoExam.count());
  const publishedIsoExams = await safe(() =>
    IsoExam.count({ where: { status: "published" } })
  );
  const paidIsoExams = await safe(() =>
    IsoExam.count({ where: { isPaid: true } })
  );

  /* ---------------- SERVICES ---------------- */
  const totalServices = await safe(() => Service.count());
  const activeServices = await safe(() =>
    Service.count({ where: { isActive: true } })
  );
  const totalSubServices = await safe(() => SubService.count());
  const activeSubServices = await safe(() =>
    SubService.count({ where: { isActive: true } })
  );

  /* ---------------- VALUED CLIENTS / PARTNERS ---------------- */
  // These are "single record" tables; count = 1 when configured, 0 when not.
  const clientsRecord = await safe(() =>
    ValuedClients.findOne({ where: { isActive: true }, order: [["id", "DESC"]] })
  );
  const partnersRecord = await safe(() =>
    ValuedPartners.findOne({ where: { isActive: true }, order: [["id", "DESC"]] })
  );

  const parseArr = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) {
      try {
        const p = JSON.parse(v);
        return Array.isArray(p) ? p : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const clientCount = clientsRecord
    ? parseArr(clientsRecord.clients).length
    : 0;
  const partnerCount = partnersRecord
    ? parseArr(partnersRecord.partners).length
    : 0;

  /* ---------------- REVENUE-ISH AGGREGATES ---------------- */
  // Note: Sums run against columns that exist on the models you shared.
  // If your project keeps payment records elsewhere, swap these for the
  // correct model; the shape of the response stays the same.

  const totalCourseRevenue = await safe(
    () =>
      Student.sum("paidAmount", {
        where: { paymentStatus: { [Op.in]: ["paid", "partial"] } },
      }),
    0
  );

  const totalCourseDue = await safe(
    () =>
      Student.sum("dueAmount", {
        where: { paymentStatus: { [Op.in]: ["pending", "partial"] } },
      }),
    0
  );

  /* ---------------- BREAKDOWNS ---------------- */
  const byCourse = await safe(async () => {
    const rows = await Student.findAll({
      attributes: [
        "enrolledCourseId",
        [fn("COUNT", col("id")), "count"],
      ],
      where: { enrolledCourseId: { [Op.ne]: null } },
      group: ["enrolledCourseId"],
      raw: true,
    });

    // Attach course names
    const courseIds = rows.map((r) => r.enrolledCourseId).filter(Boolean);
    if (courseIds.length === 0) return [];
    const courses = await Course.findAll({
      where: { id: { [Op.in]: courseIds } },
      attributes: ["id", "courseName"],
      raw: true,
    });
    const nameMap = new Map(courses.map((c) => [c.id, c.courseName]));

    return rows.map((r) => ({
      courseId: r.enrolledCourseId,
      courseName: nameMap.get(r.enrolledCourseId) || "Unknown",
      count: Number(r.count),
    }));
  }, []);

  const byStatus = await safe(async () => {
    const rows = await Student.findAll({
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    });
    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  }, []);

  const byPaymentStatus = await safe(async () => {
    const rows = await Student.findAll({
      attributes: ["paymentStatus", [fn("COUNT", col("id")), "count"]],
      group: ["paymentStatus"],
      raw: true,
    });
    return rows.map((r) => ({
      paymentStatus: r.paymentStatus,
      count: Number(r.count),
    }));
  }, []);

  const byServiceCategory = await safe(async () => {
    const rows = await SubService.findAll({
      attributes: ["serviceId", [fn("COUNT", col("id")), "count"]],
      group: ["serviceId"],
      raw: true,
    });

    const serviceIds = rows.map((r) => r.serviceId).filter(Boolean);
    if (serviceIds.length === 0) return [];
    const services = await Service.findAll({
      where: { id: { [Op.in]: serviceIds } },
      attributes: ["id", "title"],
      raw: true,
    });
    const nameMap = new Map(services.map((s) => [s.id, s.title]));

    return rows.map((r) => ({
      serviceId: r.serviceId,
      serviceTitle: nameMap.get(r.serviceId) || "Unknown",
      count: Number(r.count),
    }));
  }, []);

  /* ---------------- RETURN EVERYTHING ---------------- */
  return {
    courses: {
      total: totalCourses,
      active: activeCourses,
      inactive: inactiveCourses,
    },
    students: {
      total: totalStudents,
      active: activeStudents,
      completed: completedStudents,
      certified: certifiedStudents,
    },
    exams: {
      total: totalExams,
      published: publishedExams,
      paid: paidExams,
    },
    isoExams: {
      total: totalIsoExams,
      published: publishedIsoExams,
      paid: paidIsoExams,
    },
    services: {
      total: totalServices,
      active: activeServices,
      totalSubServices,
      activeSubServices,
    },
    valuedClients: {
      total: clientCount,
    },
    valuedPartners: {
      total: partnerCount,
    },
    finance: {
      totalCourseRevenue: Number(totalCourseRevenue) || 0,
      totalCourseDue: Number(totalCourseDue) || 0,
    },
    breakdowns: {
      byCourse,
      byStudentStatus: byStatus,
      byPaymentStatus,
      byServiceCategory,
    },
    generatedAt: new Date().toISOString(),
  };
}

/* ============================================================
   ADMIN — returns everything (detailed)
============================================================ */
const getAdminStats = async (req, res, next) => {
  try {
    const data = await computeStats();
    return res.status(200).json({
      success: true,
      message: "Admin statistics retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting admin stats:", error);
    next(error);
  }
};

/* ============================================================
   PUBLIC — returns a trimmed, public-safe subset
============================================================ */
const getPublicStats = async (req, res, next) => {
  try {
    const s = await computeStats();

    /* Only fields that make sense to advertise publicly.
       No revenue, no per-course breakdown, no status counts. */
    const data = {
      courses: {
        total: s.courses.total,
        active: s.courses.active,
      },
      students: {
        total: s.students.total,
        certified: s.students.certified,
      },
      exams: {
        total: s.exams.total,
      },
      services: {
        total: s.services.total,
        subServices: s.services.totalSubServices,
      },
      valuedClients: {
        total: s.valuedClients.total,
      },
      valuedPartners: {
        total: s.valuedPartners.total,
      },
    };

    return res.status(200).json({
      success: true,
      message: "Public statistics retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting public stats:", error);
    next(error);
  }
};

/* ============================================================
   SUMMARY — single lightweight call for the admin dashboard
   header (fast, no breakdowns).
============================================================ */
const getStatsSummary = async (req, res, next) => {
  try {
    const [
      totalCourses,
      totalStudents,
      totalExams,
      totalIsoExams,
      totalServices,
      totalSubServices,
      certifiedStudents,
    ] = await Promise.all([
      safe(() => Course.count()),
      safe(() => Student.count()),
      safe(() => Exam.count()),
      safe(() => IsoExam.count()),
      safe(() => Service.count()),
      safe(() => SubService.count()),
      safe(() => Student.count({ where: { certificateIssued: true } })),
    ]);

    return res.status(200).json({
      success: true,
      message: "Stats summary retrieved successfully!",
      data: {
        courses: totalCourses,
        students: totalStudents,
        exams: totalExams,
        isoExams: totalIsoExams,
        services: totalServices,
        subServices: totalSubServices,
        certifiedStudents,
      },
    });
  } catch (error) {
    console.error("Error getting stats summary:", error);
    next(error);
  }
};

module.exports = {
  getAdminStats,
  getPublicStats,
  getStatsSummary,
};

