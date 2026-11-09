// routes/authentication/categoryRoutes.js
const express = require("express");
const { getPublicCategories, getCategoryBySlug, getCategoryStats, createCategory, getCategoryById, updateCategory, toggleCategoryActive, deleteCategory, getAllCategories } = require("../controller/settings/category.controller");
const verifyJWT = require("../middleware/verifyJWT");



const router = express.Router();

/* ============================================================
   PUBLIC — no auth (for course dropdown, storefront, etc.)
============================================================ */
router.get("/public", getPublicCategories);
router.get("/slug/:slug", getCategoryBySlug);

/* ============================================================
   ADMIN — auth required
   NOTE: specific routes BEFORE dynamic "/:id"
============================================================ */
router.get("/stats", verifyJWT, getCategoryStats);
router.get("/", verifyJWT, getAllCategories);
router.post("/create", verifyJWT, createCategory);
router.get("/:id", verifyJWT, getCategoryById);
router.put("/update/:id", verifyJWT, updateCategory);
router.patch("/toggle-active/:id", verifyJWT, toggleCategoryActive);
router.delete("/delete/:id", verifyJWT, deleteCategory);

module.exports = router;


