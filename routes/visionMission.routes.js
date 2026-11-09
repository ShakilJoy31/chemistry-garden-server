const express = require("express");
const { getPublicVisionMission, getVisionMission, upsertVisionMission, updateVisionMissionStatus, deleteVisionMission } = require("../controller/settings/visionMission.controller");


const router = express.Router();

// Public route — used by home page
router.get("/public", getPublicVisionMission);

// Admin routes
router.get("/get-vision-mission", getVisionMission);
router.post("/upsert-vision-mission", upsertVisionMission);
router.patch("/update-vision-mission-status/:id", updateVisionMissionStatus);
router.delete("/delete-vision-mission/:id", deleteVisionMission);

module.exports = router;