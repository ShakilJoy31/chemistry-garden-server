const { Op } = require("sequelize");
const EmailSubscription = require("../../models/Settings/emailSubscription.model");

//! Subscribe email (public)
const subscribeEmail = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Check if email already exists
    let existingSubscription = await EmailSubscription.findOne({
      where: { email: email.toLowerCase() }
    });

    if (existingSubscription) {
      // If email exists but is unsubscribed, reactivate it
      if (!existingSubscription.isSubscribed) {
        await existingSubscription.update({
          isSubscribed: true,
          subscribedAt: new Date(),
          unsubscribedAt: null
        });
        
        return res.status(200).json({
          success: true,
          message: "You have been re-subscribed successfully!",
          data: existingSubscription
        });
      }

      return res.status(400).json({
        success: false,
        message: "This email is already subscribed"
      });
    }

    // Create new subscription
    const newSubscription = await EmailSubscription.create({
      email: email.toLowerCase(),
      isSubscribed: true,
      subscribedAt: new Date()
    });

    return res.status(201).json({
      success: true,
      message: "Subscribed successfully!",
      data: newSubscription
    });
  } catch (error) {
    console.error('Subscribe Email Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to subscribe email",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Unsubscribe email (public)
const unsubscribeEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const subscription = await EmailSubscription.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Email not found in our subscription list"
      });
    }

    if (!subscription.isSubscribed) {
      return res.status(400).json({
        success: false,
        message: "This email is already unsubscribed"
      });
    }

    await subscription.update({
      isSubscribed: false,
      unsubscribedAt: new Date()
    });

    return res.status(200).json({
      success: true,
      message: "Unsubscribed successfully",
      data: subscription
    });
  } catch (error) {
    console.error('Unsubscribe Email Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to unsubscribe email",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get all subscribed emails (admin)
const getAllSubscribedEmails = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "",
      isSubscribed = "true"
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Filter by subscription status
    if (isSubscribed === "true") {
      whereClause.isSubscribed = true;
    } else if (isSubscribed === "false") {
      whereClause.isSubscribed = false;
    }

    // Add search filter if provided
    if (search && search.trim() !== "") {
      whereClause.email = {
        [Op.like]: `%${search.trim()}%`
      };
    }

    // Get total count for pagination
    const totalItems = await EmailSubscription.count({
      where: whereClause
    });

    // Get paginated results
    const subscriptions = await EmailSubscription.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

    return res.status(200).json({
      success: true,
      data: subscriptions,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get All Subscribed Emails Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscribed emails",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Delete email subscription (admin)
const deleteEmailSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await EmailSubscription.findByPk(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Email subscription not found"
      });
    }

    await subscription.destroy();

    return res.status(200).json({
      success: true,
      message: "Email subscription deleted successfully"
    });
  } catch (error) {
    console.error('Delete Email Subscription Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete email subscription",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get subscription statistics (admin)
const getSubscriptionStats = async (req, res) => {
  try {
    const totalSubscribed = await EmailSubscription.count({
      where: { isSubscribed: true }
    });

    const totalUnsubscribed = await EmailSubscription.count({
      where: { isSubscribed: false }
    });

    const total = await EmailSubscription.count();

    // Get recent subscriptions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubscriptions = await EmailSubscription.count({
      where: {
        isSubscribed: true,
        subscribedAt: {
          [Op.gte]: sevenDaysAgo
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        total,
        totalSubscribed,
        totalUnsubscribed,
        recentSubscriptions,
        subscriptionRate: total > 0 ? Math.round((totalSubscribed / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Get Subscription Stats Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription statistics",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  subscribeEmail,
  unsubscribeEmail,
  getAllSubscribedEmails,
  deleteEmailSubscription,
  getSubscriptionStats
};