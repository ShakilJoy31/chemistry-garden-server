const sequelize = require("../../database/connection");
const { Op } = require("sequelize");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const Video = require("../../models/Course/video.model");

//! Get all videos for a course with pagination and filters
const getVideosByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const {
      page = 1,
      limit = 20,
      search = "",
      isActive,
      sortBy = "order",
      sortOrder = "ASC",
    } = req.query;

    if (!courseId) {
      return res.status(400).json({ success: false, message: "courseId is required!" });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = { courseId: parseInt(courseId) };

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isActive !== undefined && isActive !== "undefined" && isActive !== "") {
      whereClause.isActive = isActive === "true";
    }

    const { count, rows } = await Video.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalItems: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting videos:", error);
    next(error);
  }
};

//! Get single video by ID
const getVideoById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const video = await Video.findOne({ where: { id } });

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found!" });
    }

    return res.status(200).json({ success: true, data: video });
  } catch (error) {
    console.error("Error getting video:", error);
    next(error);
  }
};

//! Get video stats for a course
const getVideoStats = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const whereBase = { courseId: parseInt(courseId) };

    const total = await Video.count({ where: whereBase });
    const active = await Video.count({ where: { ...whereBase, isActive: true } });
    const inactive = await Video.count({ where: { ...whereBase, isActive: false } });
    const totalViews = await Video.sum("viewCount", { where: whereBase });

    return res.status(200).json({
      success: true,
      data: { total, active, inactive, totalViews: totalViews || 0 },
    });
  } catch (error) {
    console.error("Error getting video stats:", error);
    next(error);
  }
};

//! Create video
const createVideo = async (req, res, next) => {
  try {
    const {
      courseId,
      title,
      description,
      videoUrl,
      videoName,
      videoSize,
      thumbnail,
      duration,
      order,
      isFree,
      isActive,
    } = req.body;

    const userEmail = req.user?.email || "system";

    if (!courseId || !title || !videoUrl) {
      return res.status(400).json({
        success: false,
        message: "courseId, title, and videoUrl are required!",
      });
    }

    const newVideo = await Video.create({
      courseId: parseInt(courseId),
      title,
      description: description || "",
      videoUrl,
      videoName: videoName || "",
      videoSize: videoSize || 0,
      thumbnail: thumbnail || null,
      duration: duration ? parseInt(duration) : null,
      order: order !== undefined ? parseInt(order) : 0,
      isFree: isFree === true || isFree === "true",
      isActive: isActive === undefined ? true : isActive === true || isActive === "true",
      createdBy: userEmail,
      updatedBy: userEmail,
    });

    return res.status(201).json({
      success: true,
      message: "Video created successfully!",
      data: newVideo,
    });
  } catch (error) {
    console.error("Error creating video:", error);
    next(error);
  }
};

//! Update video
const updateVideo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      videoUrl,
      videoName,
      videoSize,
      thumbnail,
      duration,
      order,
      isFree,
      isActive,
    } = req.body;

    const userEmail = req.user?.email || "system";

    const existing = await Video.findOne({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Video not found!" });
    }

    const updateData = { updatedBy: userEmail };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (videoName !== undefined) updateData.videoName = videoName;
    if (videoSize !== undefined) updateData.videoSize = videoSize;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (duration !== undefined) updateData.duration = duration ? parseInt(duration) : null;
    if (order !== undefined) updateData.order = parseInt(order);
    if (isFree !== undefined) updateData.isFree = isFree === true || isFree === "true";
    if (isActive !== undefined) updateData.isActive = isActive === true || isActive === "true";

    await Video.update(updateData, { where: { id } });
    const updated = await Video.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Video updated successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating video:", error);
    next(error);
  }
};

//! Delete video (also removes the file from disk if local)
const deleteVideo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const video = await Video.findOne({ where: { id } });

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found!" });
    }

    // Delete the video file if it's stored in /uploads/documents/
    if (video.videoUrl) {
      let relativePath = video.videoUrl;
      if (/^https?:\/\//i.test(relativePath)) {
        try {
          relativePath = new URL(relativePath).pathname;
        } catch (_) { /* ignore malformed URL */ }
      }

      if (relativePath.startsWith("/uploads/")) {
        const projectRoot = path.join(__dirname, "../..");
        const uploadsRoot = path.join(projectRoot, "uploads");
        const filePath = path.join(projectRoot, relativePath);

        if (filePath.startsWith(uploadsRoot) && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error("Error deleting video file:", err);
          }
        }
      }
    }

    await Video.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting video:", error);
    next(error);
  }
};

//! Increment view count
const incrementViewCount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const video = await Video.findOne({ where: { id } });

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found!" });
    }

    await Video.increment("viewCount", { by: 1, where: { id } });
    const updated = await Video.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "View count updated!",
      data: updated,
    });
  } catch (error) {
    console.error("Error incrementing view count:", error);
    next(error);
  }
};

//! Stream / download the video file
const streamVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findOne({ where: { id } });

    if (!video || !video.isActive) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    let relativePath = video.videoUrl;
    if (/^https?:\/\//i.test(relativePath)) {
      relativePath = new URL(relativePath).pathname;
    }

    const projectRoot = path.join(__dirname, "../..");
    const uploadsRoot = path.join(projectRoot, "uploads");
    const filePath = path.join(projectRoot, relativePath);

    if (!filePath.startsWith(uploadsRoot)) {
      return res.status(400).json({ success: false, message: "Invalid file path" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found on server" });
    }

    // Stream with range support (browsers need it for <video>)
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4",
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error("Stream error:", err);
    res.status(500).json({ success: false, message: "Stream failed" });
  }
};

module.exports = {
  getVideosByCourse,
  getVideoById,
  getVideoStats,
  createVideo,
  updateVideo,
  deleteVideo,
  incrementViewCount,
  streamVideo,
};