const express = require("express");
const { getPublicContactSection, getContactSection, upsertContactSection, updateContactSectionStatus, deleteContactSection } = require("../controller/settings/contactSection.controller");


const router = express.Router();

// Public — used by home page footer/contact section
router.get("/public", getPublicContactSection);

// Admin
router.get("/get-contact-section", getContactSection);
router.post("/upsert-contact-section", upsertContactSection);
router.patch("/update-contact-section-status/:id", updateContactSectionStatus);
router.delete("/delete-contact-section/:id", deleteContactSection);

module.exports = router; 