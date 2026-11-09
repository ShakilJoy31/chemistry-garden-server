// routes/blog/blogRoutes.js
const express = require("express");
const { getPublicBlogs, getBlogBySlug, getPublicBlogCategories, getBlogCategoryBySlug, createBlogCategory, getAllBlogCategories, getBlogCategoryById, updateBlogCategory, deleteBlogCategory, toggleBlogCategoryActive, createBlog, getAllBlogs, getBlogStats, getBlogById, updateBlog, deleteBlog, toggleBlogActive, toggleBlogFeatured } = require("../controller/blog/blog.controller");
const verifyJWT = require("../middleware/verifyJWT");

const router = express.Router();

/* ============================================================
   PUBLIC ROUTES (no auth)
============================================================ */
router.get("/public/blogs", getPublicBlogs);
router.get("/public/blogs/slug/:slug", getBlogBySlug);
router.get("/public/categories", getPublicBlogCategories);
router.get("/public/categories/slug/:slug", getBlogCategoryBySlug);

/* ============================================================
   PROTECTED — BLOG CATEGORY
============================================================ */
router.post("/categories/create", verifyJWT, createBlogCategory);
router.get("/categories/get-all", verifyJWT, getAllBlogCategories);
router.get("/categories/get/:id", verifyJWT, getBlogCategoryById);
router.put("/categories/update/:id", verifyJWT, updateBlogCategory);
router.delete("/categories/delete/:id", verifyJWT, deleteBlogCategory);
router.put("/categories/toggle-active/:id", verifyJWT, toggleBlogCategoryActive);

/* ============================================================
   PROTECTED — BLOG
============================================================ */
router.post("/create", verifyJWT, createBlog);
router.get("/get-all", verifyJWT, getAllBlogs);
router.get("/stats", verifyJWT, getBlogStats);
router.get("/get/:id", verifyJWT, getBlogById);
router.put("/update/:id", verifyJWT, updateBlog);
router.delete("/delete/:id", verifyJWT, deleteBlog);
router.put("/toggle-active/:id", verifyJWT, toggleBlogActive);
router.put("/toggle-featured/:id", verifyJWT, toggleBlogFeatured);

module.exports = router;