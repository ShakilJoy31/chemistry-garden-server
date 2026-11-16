// routes/academic/result.route.js
const express = require("express");
const { getDistinctClassBatch, getStudentsForResult, getResults, saveResults, deleteResult, getClassBatchSummary, getResultsByClassBatch } = require("../controller/students/result.controller");
const verifyJWT = require("../middleware/verifyJWT");
const router = express.Router();


router.get("/distinct-class-batch", verifyJWT, getDistinctClassBatch);
router.get("/students", verifyJWT, getStudentsForResult);
router.get("/", verifyJWT, getResults);
router.post("/save", verifyJWT, saveResults);
router.delete("/:id", verifyJWT, deleteResult);
router.get("/class-batch-summary", verifyJWT, getClassBatchSummary);
router.get("/by-class-batch", verifyJWT, getResultsByClassBatch);

module.exports = router;