// controller/payment/monthlyPayment.controller.js
const { Op, fn, col, literal } = require("sequelize");
const sequelize = require("../../database/connection");
const Student = require("../../models/students/student.model");
const MonthlyPayment = require("../../models/students/monthlyPayment.model");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─────────────── helper: transform ───────────────
const transform = (row) => {
  const r = row.toJSON ? row.toJSON() : row;
  return {
    ...r,
    monthName: MONTH_NAMES[r.month - 1] || "",
    amount: Number(r.amount || 0),
    paidAmount: Number(r.paidAmount || 0),
    dueAmount: Number(r.dueAmount || 0),
  };
};

// ─────────────── helper: status from amounts ───────────────
const statusFor = (amount, paid) => {
  if (paid <= 0) return "pending";
  if (paid >= amount) return "paid";
  return "partial";
};

// ─────────────── helper: unicode-safe normalizer ───────────────
// Bangla text can arrive in NFC (ড় = U+09DC) or NFD (ড + ় = U+09A1 U+09BC),
// and MySQL's default collations do NOT treat them as equal. Normalize both 
// sides in JS before comparing so the filter works regardless of how the
// name was stored or how the browser encoded it.
const normalize = (s) =>
  typeof s === "string" ? s.normalize("NFC").trim().toLowerCase() : s;

//! GET students for the payment grid — takes class / batch / search
// Returns every matching student along with their payment record (if any)
// for the requested year+month, so the admin sees a single editable grid.
const getMonthlyPaymentGrid = async (req, res, next) => {
  try {
    const {
      year,
      month,
      class: classFilter = "",
      batch = "",
      search = "",
      page = 1,
      limit = 500,
    } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "year and month are required.",
      });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid year or month.",
      });
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 1000);
    const offset = (pageNumber - 1) * limitNumber;

    // ── 1. Build student filter (search only — class/batch filtered in JS) ──
    // We do NOT put class/batch into the SQL WHERE clause because Bangla names
    // stored as NFC vs NFD will silently fail `=` and `LIKE` on most MySQL
    // collations. Instead we fetch a broad set and filter in Node after
    // normalizing both sides.
    const searchTerm = (search || "").toString().trim();
    const where = {};
    if (searchTerm) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${searchTerm}%` } },
        { studentId: { [Op.like]: `%${searchTerm}%` } },
        { phoneNo: { [Op.like]: `%${searchTerm}%` } },
        { email: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    const allStudents = await Student.findAll({
      where,
      order: [["fullName", "ASC"]],
      attributes: [
        "id", "studentId", "fullName", "class", "batch",
        "phoneNo", "email", "district",
      ],
    });

    // ── 2. Unicode-safe class / batch filter ──
    const wantClass = normalize(classFilter);
    const wantBatch = normalize(batch);

    const filteredStudents = allStudents.filter((s) => {
      if (wantClass && normalize(s.class) !== wantClass) return false;
      if (wantBatch && normalize(s.batch) !== wantBatch) return false;
      return true;
    });

    // ── 3. Manual pagination (since filtering happened in JS) ──
    const totalItems = filteredStudents.length;
    const totalPages = Math.ceil(totalItems / limitNumber) || 0;
    const students = filteredStudents.slice(offset, offset + limitNumber);

    // ── 4. Fetch existing payment rows for these students ──
    const ids = students.map((s) => s.id);
    const existing = ids.length
      ? await MonthlyPayment.findAll({
          where: { year: y, month: m, studentId: { [Op.in]: ids } },
        })
      : [];
    const paymentByStudent = new Map(existing.map((p) => [p.studentId, p]));

    // ── 5. Merge ──
    const merged = students.map((s) => {
      const p = paymentByStudent.get(s.id);
      return {
        studentId: s.id,
        studentCode: s.studentId,
        studentName: s.fullName,
        class: s.class,
        batch: s.batch,
        phoneNo: s.phoneNo,
        email: s.email,
        district: s.district,

        paymentId: p?.id ?? null,
        amount: p ? Number(p.amount) : 0,
        paidAmount: p ? Number(p.paidAmount) : 0,
        dueAmount: p ? Number(p.dueAmount) : 0,
        status: p?.status ?? null, // null = not set for this month yet
        note: p?.note ?? "",
        paidAt: p?.paidAt ?? null,
        createdAt: p?.createdAt ?? null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Monthly payment grid retrieved.",
      data: merged,
      year: y,
      month: m,
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("getMonthlyPaymentGrid:", error);
    next(error);
  }
};

//! GET a single student's history (last 5 years → next 5 years by default)
const getStudentPaymentHistory = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const currentYear = new Date().getFullYear();
    const from = parseInt(req.query.from, 10) || currentYear - 5;
    const to = parseInt(req.query.to, 10) || currentYear + 5;

    const student = await Student.findOne({
      where: { id: studentId },
      attributes: ["id", "studentId", "fullName", "class", "batch", "phoneNo", "email", "district"],
    });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const rows = await MonthlyPayment.findAll({
      where: {
        studentId,
        year: { [Op.between]: [from, to] },
      },
      order: [["year", "DESC"], ["month", "DESC"]],
    });

    // group by year
    const byYear = {};
    for (let y = from; y <= to; y++) byYear[y] = [];
    rows.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = [];
      byYear[r.year].push(transform(r));
    });

    const totalPaid = rows.reduce((s, r) => s + Number(r.paidAmount), 0);
    const totalDue = rows.reduce((s, r) => s + Number(r.dueAmount), 0);

    return res.status(200).json({
      success: true,
      message: "Payment history retrieved.",
      data: {
        student,
        byYear,
        range: { from, to },
        summary: { totalPaid, totalDue, entries: rows.length },
      },
    });
  } catch (error) {
    console.error("getStudentPaymentHistory:", error);
    next(error);
  }
};

//! UPSERT many monthly payments in one shot (admin bulk-save)
const saveMonthlyPayments = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { year, month, entries } = req.body;
    const userEmail = req.user?.email || "system";

    if (!Array.isArray(entries) || entries.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "No entries to save.",
      });
    }
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Invalid year or month." });
    }

    // Fetch students to denormalise name/code/class/batch
    const ids = entries.map((e) => e.studentId);
    const students = await Student.findAll({ where: { id: { [Op.in]: ids } } });
    const byId = new Map(students.map((s) => [s.id, s]));

    let created = 0;
    let updated = 0;

    for (const e of entries) {
      const student = byId.get(e.studentId);
      if (!student) continue;

      const amount = Math.max(parseFloat(e.amount) || 0, 0);
      const paid = Math.max(parseFloat(e.paidAmount) || 0, 0);
      const due = Math.max(amount - paid, 0);
      const status = statusFor(amount, paid);
      const note = (e.note || "").toString().trim() || null;
      const paidAt = status === "pending" ? null : new Date();

      const [row, wasCreated] = await MonthlyPayment.findOrCreate({
        where: { studentId: e.studentId, year: y, month: m },
        defaults: {
          studentId: e.studentId,
          studentCode: student.studentId,
          studentName: student.fullName,
          class: student.class,
          batch: student.batch,
          year: y,
          month: m,
          amount,
          paidAmount: paid,
          dueAmount: due,
          status,
          note,
          paidAt,
          createdBy: userEmail,
          updatedBy: userEmail,
        },
        transaction: t,
      });

      if (wasCreated) {
        created++;
      } else {
        await row.update(
          {
            amount,
            paidAmount: paid,
            dueAmount: due,
            status,
            note,
            paidAt,
            updatedBy: userEmail,
            // keep denormalised info fresh
            studentName: student.fullName,
            class: student.class,
            batch: student.batch,
          },
          { transaction: t }
        );
        updated++;
      }
    }

    await t.commit();
    return res.status(200).json({
      success: true,
      message: `Saved monthly payments (${created} created, ${updated} updated).`,
      data: { created, updated, year: y, month: m },
    });
  } catch (error) {
    await t.rollback();
    console.error("saveMonthlyPayments:", error);
    next(error);
  }
};

//! Update a single monthly payment (used for correcting a specific row)
const updateMonthlyPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paidAmount, note } = req.body;
    const userEmail = req.user?.email || "system";

    const row = await MonthlyPayment.findByPk(id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    const nextAmount = amount !== undefined ? Math.max(parseFloat(amount) || 0, 0) : Number(row.amount);
    const nextPaid =
      paidAmount !== undefined ? Math.max(parseFloat(paidAmount) || 0, 0) : Number(row.paidAmount);

    const due = Math.max(nextAmount - nextPaid, 0);
    const status = statusFor(nextAmount, nextPaid);

    await row.update({
      amount: nextAmount,
      paidAmount: nextPaid,
      dueAmount: due,
      status,
      note: note !== undefined ? (note || "").toString().trim() || null : row.note,
      paidAt: status === "pending" ? null : (row.paidAt || new Date()),
      updatedBy: userEmail,
    });

    return res.status(200).json({
      success: true,
      message: "Payment updated.",
      data: transform(row),
    });
  } catch (error) {
    console.error("updateMonthlyPayment:", error);
    next(error);
  }
};

//! Yearly overview for a student (small chart-friendly summary)
const getStudentYearlySummary = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const rows = await MonthlyPayment.findAll({
      where: { studentId },
      attributes: [
        "year",
        [fn("SUM", col("amount")), "totalAmount"],
        [fn("SUM", col("paidAmount")), "totalPaid"],
        [fn("SUM", col("dueAmount")), "totalDue"],
        [fn("COUNT", col("id")), "months"],
      ],
      group: ["year"],
      order: [["year", "ASC"]],
      raw: true,
    });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("getStudentYearlySummary:", error);
    next(error);
  }
};

module.exports = {
  getMonthlyPaymentGrid,
  getStudentPaymentHistory,
  saveMonthlyPayments,
  updateMonthlyPayment,
  getStudentYearlySummary,
};