// routes/certificate.routes.js
const express = require("express");
const { getCertificateByNumber, getCertificateById, createCertificate, getAllCertificates, updateCertificate, deleteCertificate, updateCertificateStatus, verifyCertificate, getCertificateStats, getCertificatesByCompany } = require("../controller/auth/certificate.controller");
const verifyJWT = require("../middleware/verifyJWT");
const router = express.Router();

//! Public routes (no authentication required)
router.get("/verify/:certificateNumber", getCertificateByNumber);
router.get("/public/:id", getCertificateById);

//! Protected routes (authentication required)
router.post("/create-certificate", verifyJWT, createCertificate);
router.get("/get-certificates", verifyJWT, getAllCertificates);
router.get("/get-certificate/:id", verifyJWT, getCertificateById);
router.put("/update-certificate/:id", verifyJWT, updateCertificate);
router.delete("/delete-certificate/:id", verifyJWT, deleteCertificate);
router.put("/update-certificate-status/:id", verifyJWT, updateCertificateStatus);
router.put("/verify-certificate/:id", verifyJWT, verifyCertificate);
router.get("/get-certificate-stats", verifyJWT, getCertificateStats);
router.get("/get-certificates-by-company/:companyName", verifyJWT, getCertificatesByCompany);

module.exports = router;