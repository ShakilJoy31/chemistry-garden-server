const express = require("express");
const { getPublicSliders, getAllSliders, getSliderById, getSliderStats, upsertSlider, updateSliderStatus, reorderSliders, deleteSlider, getSliderSettings, updateSliderSettings } = require("../controller/settings/slider.controller");


const router = express.Router();

//! Public routes
router.get("/public", getPublicSliders);

//! Admin routes
router.get("/get-all-sliders", getAllSliders);
router.get("/get-slider/:id", getSliderById);
router.get("/stats", getSliderStats);

// Upsert slider (create or update)
router.post("/upsert-slider", upsertSlider);

// Update slider status
router.patch("/update-slider-status/:id", updateSliderStatus);

// Reorder sliders
router.post("/reorder-sliders", reorderSliders);

// Delete slider
router.delete("/delete-slider/:id", deleteSlider);

// Slider settings
router.get("/settings", getSliderSettings);
router.post("/update-settings", updateSliderSettings);

module.exports = router;