// middleware/ensureOwnStudent.js
const ensureOwnStudent = (req, res, next) => {
  if (Number(req.params.studentId) !== Number(req.user?.id)) {
    return res.status(403).json({
      success: false,
      message: "You can only access your own notices.",
    });
  }
  next();
};

module.exports = ensureOwnStudent;