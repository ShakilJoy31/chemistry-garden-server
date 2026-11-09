const express = require("express");
const { getAllStoreItems, getStoreItemById, getStoreStats, getFeaturedItems, getCategories, createStoreItem, updateStoreItem, deleteStoreItem, incrementDownloadCount, downloadStoreItem } = require("../controller/settings/store.controller");

const router = express.Router();

//! Store routes
// Public routes
router.get("/get-store-items", getAllStoreItems);
router.get("/get-store-item/:id", getStoreItemById);
router.get("/stats", getStoreStats);
router.get("/featured", getFeaturedItems);
router.get("/categories", getCategories);

// Admin routes
router.post("/create-store-item", createStoreItem);
router.put("/update-store-item/:id", updateStoreItem);
router.delete("/delete-store-item/:id", deleteStoreItem);
router.patch("/increment-download/:id", incrementDownloadCount);

router.get("/download-item/:id", downloadStoreItem);   

module.exports = router;