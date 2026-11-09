const express = require("express");
const { getPublicValuedClients, getValuedClients, upsertValuedClients, updateValuedClientsStatus, deleteValuedClients } = require("../controller/settings/valuedClients.controller");


const router = express.Router();

// Public
router.get("/public", getPublicValuedClients);

// Admin
router.get("/get-valued-clients", getValuedClients);
router.post("/upsert-valued-clients", upsertValuedClients);
router.patch("/update-valued-clients-status/:id", updateValuedClientsStatus);
router.delete("/delete-valued-clients/:id", deleteValuedClients);

module.exports = router;