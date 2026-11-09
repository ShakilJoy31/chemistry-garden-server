// routes/service/serviceRoutes.js
const express = require("express");
const { getPublicServices, getServiceBySlug, createService, getAllServices, getServiceStats, getServiceById, updateService, deleteService, toggleServiceActive, assignStudentsToService, createSubService, getAllSubServices, getSubServiceById, updateSubService, deleteSubService, toggleSubServiceActive, assignStudentsToSubService } = require("../controller/service/service.controller");
const verifyJWT = require("../middleware/verifyJWT");
const { getPublicDetailBySlug, getDetailBySubServiceId, upsertDetail, togglePublish, deleteDetail } = require("../controller/service/subServiceDetail.controller");

const router = express.Router();

/* ============================================================
   PUBLIC ROUTES (no auth)
============================================================ */
router.get("/public/all", getPublicServices);
router.get("/public/slug/:slug", getServiceBySlug);

/* ============================================================
   PROTECTED — SERVICE
============================================================ */
router.post("/create", verifyJWT, createService);
router.get("/get-all", getAllServices);
router.get("/stats", verifyJWT, getServiceStats);
router.get("/get/:id", verifyJWT, getServiceById);
router.put("/update/:id", verifyJWT, updateService);
router.delete("/delete/:id", verifyJWT, deleteService);
router.put("/toggle-active/:id", verifyJWT, toggleServiceActive);
router.put("/assign-students/:id", verifyJWT, assignStudentsToService);

/* ============================================================
   PROTECTED — SUB-SERVICE
============================================================ */
router.post("/sub/create", verifyJWT, createSubService);
router.get("/sub/get-all", getAllSubServices);
router.get("/sub/get/:id", verifyJWT, getSubServiceById);
router.put("/sub/update/:id", verifyJWT, updateSubService);
router.delete("/sub/delete/:id", verifyJWT, deleteSubService);
router.put("/sub/toggle-active/:id", verifyJWT, toggleSubServiceActive);
router.put("/sub/assign-students/:id", verifyJWT, assignStudentsToSubService);









/* ============================================================
   PUBLIC — SUB-SERVICE DETAIL
============================================================ */
router.get("/sub/public/detail/:slug", getPublicDetailBySlug);

/* ============================================================
   PROTECTED — SUB-SERVICE DETAIL
============================================================ */
router.get("/sub/detail/:subServiceId", verifyJWT, getDetailBySubServiceId);
router.put("/sub/detail/:subServiceId", verifyJWT, upsertDetail);
router.put("/sub/detail/:subServiceId/toggle-publish", verifyJWT, togglePublish);
router.delete("/sub/detail/:subServiceId", verifyJWT, deleteDetail);

module.exports = router;