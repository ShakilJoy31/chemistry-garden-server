const { Op } = require("sequelize");
const Chat = require("../../models/Settings/chat.model");


//! Create a new chat session (when user submits the form)
const createChat = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Validate input
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: name, email, phone"
      });
    }

    // Check if user already has an active chat
    let existingChat = await Chat.findOne({
      where: {
        userEmail: email,
        status: {
          [Op.ne]: 'archived'
        }
      }
    });

    if (existingChat) {
      return res.status(200).json({
        success: true,
        message: "Existing chat session found",
        data: existingChat,
        isExisting: true
      });
    }

    // Create new chat session
    const newChat = await Chat.create({
      userId: `user_${Date.now()}`,
      userName: name,
      userEmail: email,
      userPhone: phone,
      messages: [
        {
          id: `msg_${Date.now()}`,
          type: 'bot',
          text: `Welcome ${name}! 👋\n\nThank you for contacting ISAB. We're always here to help you. How can we assist you today?`,
          timestamp: new Date().toISOString(),
          isRead: true
        }
      ],
      status: 'active',
      isOnline: true,
      lastActivity: new Date(),
      unreadCount: 0
    });

    return res.status(201).json({
      success: true,
      message: "Chat session created successfully",
      data: newChat,
      isExisting: false
    });
  } catch (error) {
    console.error('Create Chat Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to create chat session",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get all chat sessions with pagination and search
const getAllChats = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "active"
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    // Add search filter if provided
    if (search && search.trim() !== "") {
      whereClause[Op.or] = [
        { userName: { [Op.like]: `%${search.trim()}%` } },
        { userEmail: { [Op.like]: `%${search.trim()}%` } },
        { userPhone: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    // Get total count for pagination
    const totalItems = await Chat.count({
      where: whereClause
    });

    // Get paginated results
    const chats = await Chat.findAll({
      where: whereClause,
      order: [['lastActivity', 'DESC']],
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

    return res.status(200).json({
      success: true,
      data: chats,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get All Chats Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch chat sessions",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get single chat by ID
const getChatById = async (req, res) => {
  try {
    const { id } = req.params;

    const chat = await Chat.findByPk(id);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }

    // Ensure messages is an array
    let messages = chat.messages;
    if (typeof messages === 'string') {
      try {
        messages = JSON.parse(messages);
      } catch (e) {
        messages = [];
      }
    }
    if (!Array.isArray(messages)) {
      messages = [];
    }

    // Mark all messages as read when admin views the chat
    if (messages.length > 0) {
      const updatedMessages = messages.map(msg => ({
        ...msg,
        isRead: true
      }));
      
      await chat.update({
        messages: updatedMessages,
        unreadCount: 0
      });
    }

    // Refetch to get updated data
    const updatedChat = await Chat.findByPk(id);
    
    return res.status(200).json({
      success: true,
      data: updatedChat
    });
  } catch (error) {
    console.error('Get Chat By ID Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch chat session",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Send a message in a chat
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, type = 'admin', image } = req.body;

    if (!text && !image) {
      return res.status(400).json({
        success: false,
        message: "Message text or image is required"
      });
    }

    const chat = await Chat.findByPk(id);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }

    // Get current messages - ensure it's an array
    let currentMessages = chat.messages;
    
    // If messages is a string, parse it
    if (typeof currentMessages === 'string') {
      try {
        currentMessages = JSON.parse(currentMessages);
      } catch (e) {
        currentMessages = [];
      }
    }
    
    // Ensure it's an array
    if (!Array.isArray(currentMessages)) {
      currentMessages = [];
    }

    // Create new message
    const newMessage = {
      id: `msg_${Date.now()}`,
      type: type,
      text: text || '',
      image: image || null,
      timestamp: new Date().toISOString(),
      isRead: type === 'admin'
    };

    // Add new message to the array
    const updatedMessages = [...currentMessages, newMessage];
    
    // Calculate unread count
    let unreadCount = chat.unreadCount || 0;
    if (type === 'user') {
      unreadCount += 1;
    } else if (type === 'admin') {
      unreadCount = 0; // Reset unread when admin replies
    }

    // Update chat
    await chat.update({
      messages: updatedMessages,
      lastActivity: new Date(),
      unreadCount: unreadCount,
      status: 'active'
    });

    // Refetch the chat to get the updated data
    const updatedChat = await Chat.findByPk(id);
    
    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: updatedChat
    });
  } catch (error) {
    console.error('Send Message Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Update chat status
const updateChatStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'resolved', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required: active, resolved, or archived"
      });
    }

    const chat = await Chat.findByPk(id);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }

    await chat.update({ status });

    return res.status(200).json({
      success: true,
      message: `Chat status updated to ${status}`,
      data: chat
    });
  } catch (error) {
    console.error('Update Chat Status Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to update chat status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get chat statistics
const getChatStats = async (req, res) => {
  try {
    const total = await Chat.count();
    const active = await Chat.count({ where: { status: 'active' } });
    const resolved = await Chat.count({ where: { status: 'resolved' } });
    const archived = await Chat.count({ where: { status: 'archived' } });
    
    // Get chats with unread messages
    const chatsWithUnread = await Chat.findAll({
      where: {
        unreadCount: {
          [Op.gt]: 0
        }
      }
    });

    const totalUnread = chatsWithUnread.reduce((sum, chat) => sum + chat.unreadCount, 0);

    return res.status(200).json({
      success: true,
      data: {
        total,
        active,
        resolved,
        archived,
        totalUnread,
        chatsWithUnread: chatsWithUnread.length
      }
    });
  } catch (error) {
    console.error('Get Chat Stats Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch chat statistics",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Delete a chat session
const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;

    const chat = await Chat.findByPk(id);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }

    await chat.destroy();

    return res.status(200).json({
      success: true,
      message: "Chat session deleted successfully"
    });
  } catch (error) {
    console.error('Delete Chat Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete chat session",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Mark all messages as read
const markAllAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const chat = await Chat.findByPk(id);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }

    // Ensure messages is an array
    let messages = chat.messages;
    if (typeof messages === 'string') {
      try {
        messages = JSON.parse(messages);
      } catch (e) {
        messages = [];
      }
    }
    if (!Array.isArray(messages)) {
      messages = [];
    }

    if (messages.length > 0) {
      const updatedMessages = messages.map(msg => ({
        ...msg,
        isRead: true
      }));
      
      await chat.update({
        messages: updatedMessages,
        unreadCount: 0
      });
    }

    const updatedChat = await Chat.findByPk(id);
    
    return res.status(200).json({
      success: true,
      message: "All messages marked as read",
      data: updatedChat
    });
  } catch (error) {
    console.error('Mark All As Read Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark messages as read",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createChat,
  getAllChats,
  getChatById,
  sendMessage,
  updateChatStatus,
  getChatStats,
  deleteChat,
  markAllAsRead
};

