const express = require("express");
const { getPublicValuedPartners, getValuedPartners, upsertValuedPartners, updateValuedPartnersStatus, deleteValuedPartners } = require("../controller/settings/valuedPartners.controller");


const router = express.Router();

router.get("/public", getPublicValuedPartners);

router.get("/get-valued-partners", getValuedPartners);
router.post("/upsert-valued-partners", upsertValuedPartners);
router.patch("/update-valued-partners-status/:id", updateValuedPartnersStatus);
router.delete("/delete-valued-partners/:id", deleteValuedPartners);

module.exports = router;