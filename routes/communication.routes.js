const { subscribeEmail, unsubscribeEmail, getAllSubscribedEmails, deleteEmailSubscription, getSubscriptionStats } = require("../controller/settings/emailSubscription.controller");
const { createPublicSms, getAllPublicSms, getPublicSmsById, updatePublicSms, deletePublicSms, getPublicSmsStats } = require("../controller/settings/publicSms.controller");
const { getAllWhatsAppNumbers, getActiveWhatsAppNumber, getActiveWhatsAppNumberForFrontend, createWhatsAppNumber, updateWhatsAppNumber, deleteWhatsAppNumber, setActiveWhatsAppNumber } = require("../controller/settings/whatsappNumber.controller");


const router = require("express").Router();

//! ============= WHATSAPP NUMBER ROUTES =============
// Get all WhatsApp numbers
router.get("/whatsapp-numbers/", getAllWhatsAppNumbers);

// Get active WhatsApp number (for admin)
router.get("/whatsapp-numbers/active", getActiveWhatsAppNumber);

// Get active WhatsApp number for frontend (public)
router.get("/whatsapp-numbers/active-public", getActiveWhatsAppNumberForFrontend);

// Create a new WhatsApp number
router.post("/whatsapp-numbers/", createWhatsAppNumber);

// Update a WhatsApp number
router.put("/whatsapp-numbers/:id", updateWhatsAppNumber);

// Delete a WhatsApp number
router.delete("/whatsapp-numbers/:id", deleteWhatsAppNumber);

// Set a WhatsApp number as active
router.patch("/whatsapp-numbers/:id/activate", setActiveWhatsAppNumber);


//! ============= EMAIL SUBSCRIPTION ROUTES =============
// Subscribe email (public)
router.post("/email-subscribe", subscribeEmail);

// Unsubscribe email (public)
router.post("/email-unsubscribe", unsubscribeEmail);

// Get all subscribed emails (admin)
router.get("/email-subscriptions", getAllSubscribedEmails);

// Delete email subscription (admin)
router.delete("/email-subscriptions/:id", deleteEmailSubscription);

// Get subscription statistics (admin)
router.get("/email-subscriptions/stats", getSubscriptionStats);




//! ============= PUBLIC SMS ROUTES =============
// Create public SMS (public)
router.post("/public-sms", createPublicSms);

// Get all public SMS (admin)
router.get("/public-sms", getAllPublicSms);

// Get single public SMS (admin)
router.get("/public-sms/:id", getPublicSmsById);

// Update public SMS (admin)
router.put("/public-sms/:id", updatePublicSms);

// Delete public SMS (admin)
router.delete("/public-sms/:id", deletePublicSms);

// Get public SMS statistics (admin)
router.get("/public-sms/stats", getPublicSmsStats);



module.exports = router;