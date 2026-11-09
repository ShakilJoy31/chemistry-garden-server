const { createChat, getAllChats, getChatStats, getChatById, sendMessage, markAllAsRead, updateChatStatus, deleteChat } = require("../controller/settings/chat.controller");


const router = require("express").Router();

//! ============= CHAT ROUTES =============

// Create a new chat session (public - from frontend form)
router.post("/", createChat); // Changed from "/chats" to "/"

// Get all chat sessions with pagination (admin)
router.get("/", getAllChats); // Changed from "/chats" to "/"

// Get chat statistics (admin)
router.get("/stats", getChatStats); // This stays as "/stats"

// Get single chat by ID (admin)
router.get("/:id", getChatById); // Changed from "/chats/:id" to "/:id"

// Send a message in a chat (admin & user)
router.post("/:id/messages", sendMessage); // Changed from "/chats/:id/messages" to "/:id/messages"

// Mark all messages as read (admin)
router.patch("/:id/read", markAllAsRead); // Changed from "/chats/:id/read" to "/:id/read"

// Update chat status (admin)
router.patch("/:id/status", updateChatStatus); // Changed from "/chats/:id/status" to "/:id/status"

// Delete chat session (admin)
router.delete("/:id", deleteChat); // Changed from "/chats/:id" to "/:id"

module.exports = router;
