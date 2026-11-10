require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const { notFoundHandler, errorHandler } = require("./error");
const middlewares = require("./middlewares");
const apiRoutes = require("./api.routes");
const { checkServerStatus } = require("../controller/settings/serverStatus.controller");

app.use(middlewares);
app.set("view engine", "ejs");

// ✅ Serve uploaded files (images + videos + documents)
// Resolves to <backend-root>/uploads — same folder multer writes to.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"), {
    setHeaders: (res, filePath) => {
      if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(filePath)) {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Accept-Ranges", "bytes");
      }
    },
  })
);

app.get("/health", (_, res) => res.status(200).json({ message: "ok" }));
app.get("/", (req, res) => {
  res.send("Welcome to Chemistry Garder Server!");
});

//! Server available or not.............
app.use(checkServerStatus);

app.use(apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;