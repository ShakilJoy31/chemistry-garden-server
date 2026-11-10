const express = require("express");
const { getVideosByCourse, getVideoStats, getVideoById, incrementViewCount, streamVideo, createVideo, updateVideo, deleteVideo } = require("../controller/course/video.controller");


const router = express.Router();

// Public routes
router.get("/course/:courseId", getVideosByCourse);
router.get("/course/:courseId/stats", getVideoStats);
router.get("/:id", getVideoById);
router.patch("/increment-view/:id", incrementViewCount);
router.get("/stream/:id", streamVideo);

// Admin routes
router.post("/create-video", createVideo);
router.put("/update-video/:id", updateVideo);
router.delete("/delete-video/:id", deleteVideo);

module.exports = router;