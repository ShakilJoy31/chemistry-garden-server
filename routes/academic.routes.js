const express = require("express");
const { getAllClasses, getClassById, getClassStats, getActiveClasses, createClass, updateClass, deleteClass } = require("../controller/academic/class.controller");
const { getAllBatches, getBatchById, getBatchStats, getActiveBatches, createBatch, updateBatch, deleteBatch } = require("../controller/academic/batch.controller");
const { getAllYears, getYearById, getYearStats, getActiveYears, createYear, updateYear, deleteYear } = require("../controller/academic/year.controller");
const { getAllExamNames, getExamNameById, getExamNameStats, getActiveExamNames, createExamName, updateExamName, deleteExamName } = require("../controller/academic/examName.controller");

const router = express.Router();

// Public routes
router.get("/get-classes", getAllClasses);
router.get("/get-class/:id", getClassById);
router.get("/stats", getClassStats);
router.get("/active", getActiveClasses);

// Admin routes
router.post("/create-class", createClass);
router.put("/update-class/:id", updateClass);
router.delete("/delete-class/:id", deleteClass);








// Public routes
router.get("/get-batches", getAllBatches);
router.get("/get-batch/:id", getBatchById);
router.get("/stats", getBatchStats);
router.get("/active", getActiveBatches);

// Admin routes
router.post("/create-batch", createBatch);
router.put("/update-batch/:id", updateBatch);
router.delete("/delete-batch/:id", deleteBatch);













// Public routes
router.get("/get-years", getAllYears);
router.get("/get-year/:id", getYearById);
router.get("/stats", getYearStats);
router.get("/active", getActiveYears);

// Admin routes
router.post("/create-year", createYear);
router.put("/update-year/:id", updateYear);
router.delete("/delete-year/:id", deleteYear);



// Public routes
router.get("/get-exam-names", getAllExamNames);
router.get("/get-exam-name/:id", getExamNameById);
router.get("/stats", getExamNameStats);
router.get("/active", getActiveExamNames);

// Admin routes
router.post("/create-exam-name", createExamName);
router.put("/update-exam-name/:id", updateExamName);
router.delete("/delete-exam-name/:id", deleteExamName);


module.exports = router;