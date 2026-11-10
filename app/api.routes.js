const authenticationRoutes = require("../routes/brotherEnterprise.routes");
const studentRoutes = require("../routes/student.routes");
const uploadWithMulter = require("../middleware/uploadWithMulter");
const certificateRoutes = require("../routes/certificate.routes");
const examRoutes = require("../routes/examRoutes");
const paymentMethodRoutes = require("../routes/settings.routes");
const studentPaymentRoutes = require("../routes/studentPayment.routes");
const storeRoutes = require("../routes/store.routes");
const otpRoutes = require("../routes/otp.routes");
const serverStatusRoutes = require("../routes/serverStatus.routes");
const whatsappNumberRoutes = require("../routes/communication.routes");
const chatRoutes = require("../routes/chat.routes");
const mockTestRoutes = require("../routes/mocktest.routes");
const isoExamRoutes = require("../routes/isoexam.routes");
const sliderRoutes = require("../routes/slider.routes");
const visionMissionRoutes = require("../routes/visionMission.routes");
const contactSectionRoutes = require("../routes/contactSection.routes");
const valuedClientsRoutes = require("../routes/valuedClients.routes");
const valuedPartnersRoutes = require("../routes/valuedPartners.routes");
const serviceRoutes = require("../routes/service.routes");
const blogRoutes = require("../routes/blog.routes");
const statsRoutes = require("../routes/stats.routes");
const categoryRoutes = require("../routes/category.routes");
const videoRoutes = require("../routes/video.routes");
const moduleExamRoutes = require("../routes/moduleExam.routes");


const router = require("express").Router();

router.use("/authentication", authenticationRoutes);

router.use("/server-status", serverStatusRoutes);

//! On action
router.use("/certificate", certificateRoutes);

router.use("/students", studentRoutes);

router.use("/exams", examRoutes);

router.use("/mocktests", mockTestRoutes);

router.use("/isoexams", isoExamRoutes); 

router.use("/module-exam", moduleExamRoutes)

router.use("/settings", paymentMethodRoutes);

router.use("/auth/register", otpRoutes);

router.use("/student-payments", studentPaymentRoutes);

router.use("/store", storeRoutes);

router.use("/communication", whatsappNumberRoutes);

router.use("/chats", chatRoutes);

router.use("/slider", sliderRoutes);

router.use("/vision-mission", visionMissionRoutes);

router.use("/contact-section", contactSectionRoutes);

router.use("/valued-clients", valuedClientsRoutes);

router.use("/valued-partners", valuedPartnersRoutes);

router.use("/services", serviceRoutes);

router.use("/blogs", blogRoutes);

router.use("/stats", statsRoutes);

router.use("/categories", categoryRoutes);

router.use("/video", videoRoutes);







//! File upload route
router.post("/file/upload", uploadWithMulter.single("image"), (req, res) => {
  try {
    if (!req.filelink) {
      return res.status(400).json({ 
        success: false,
        message: "File upload failed" 
      });
    }

    res.json({ 
      success: true,
      data: [req.filelink]
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Upload failed"
    });
  }
});



//! Document upload route
router.post("/document/upload", uploadWithMulter.uploadDocument.single("document"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded" 
      });
    }

    res.json({ 
      success: true,
      data: {
        filename: req.file.filename,
        path: `${process.env.BASE_URL}/uploads/documents/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Upload failed"
    });
  }
});

module.exports = router;

