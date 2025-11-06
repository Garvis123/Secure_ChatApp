import User from '../models/User.js';
import Message from '../models/Message.js';
import Room from '../models/Room.js';
import Session from '../models/Session.js';
import {
  logActivity,
  checkAllAnomalies,
  getUserActivitySummary,
  detectMessageRateAnomaly,
  detectFailedLoginAnomaly,
  calculateRiskScore,
  getRiskLevel,
  THRESHOLDS
} from '../utils/anomalyDetection.js';

// Get admin dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Check if user is admin (you can add isAdmin field to User model)
    // For now, we'll allow any authenticated user to view stats
    
    const totalUsers = await User.countDocuments();
    const onlineUsers = await User.countDocuments({ isOnline: true });
    const totalRooms = await Room.countDocuments();
    const activeRooms = await Room.countDocuments({ isActive: true });
    const totalMessages = await Message.countDocuments();
    const activeSessions = await Session.countDocuments({ isActive: true });
    
    // Get messages in last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messagesLast24h = await Message.countDocuments({
      createdAt: { $gte: last24Hours }
    });
    
    // Get new users in last 24 hours
    const newUsersLast24h = await User.countDocuments({
      createdAt: { $gte: last24Hours }
    });
    
    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          online: onlineUsers,
          newLast24h: newUsersLast24h
        },
        rooms: {
          total: totalRooms,
          active: activeRooms
        },
        messages: {
          total: totalMessages,
          last24h: messagesLast24h
        },
        sessions: {
          active: activeSessions
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard stats',
      error: error.message
    });
  }
};

// Get audit logs
export const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, activityType, startDate, endDate } = req.query;
    
    const query = {};
    
    if (userId) {
      query.userId = userId;
    }
    
    if (activityType) {
      query.type = activityType;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }
    
    // In production, use a proper AuditLog model
    // For now, we'll get recent activities from messages and users
    const skip = (page - 1) * limit;
    
    const recentMessages = await Message.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('senderId', 'username email')
      .populate('roomId', 'name type');
    
    const logs = recentMessages.map(msg => ({
      id: msg._id,
      type: 'message_sent',
      userId: msg.senderId?._id,
      username: msg.senderUsername,
      timestamp: msg.createdAt,
      metadata: {
        roomId: msg.roomId?._id,
        roomName: msg.roomId?.name,
        messageType: msg.messageType,
        encrypted: !!msg.encryptedContent
      }
    }));
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: await Message.countDocuments()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get audit logs',
      error: error.message
    });
  }
};

// Get anomaly detection results
export const getAnomalies = async (req, res) => {
  try {
    const { userId, severity, limit = 100 } = req.query;
    
    // Get all users or specific user
    const users = userId 
      ? [await User.findById(userId)]
      : await User.find().limit(100);
    
    const allAnomalies = [];
    
    for (const user of users) {
      if (!user) continue;
      
      // Check message rate anomaly
      const messageAnomaly = detectMessageRateAnomaly(user._id.toString());
      if (messageAnomaly.isAnomaly) {
        allAnomalies.push({
          userId: user._id,
          username: user.username,
          type: 'MESSAGE_RATE',
          anomalies: messageAnomaly.anomalies,
          timestamp: Date.now()
        });
      }
      
      // Check failed login anomaly
      const loginAnomaly = detectFailedLoginAnomaly(user._id.toString());
      if (loginAnomaly.isAnomaly) {
        allAnomalies.push({
          userId: user._id,
          username: user.username,
          type: 'FAILED_LOGIN',
          anomalies: [loginAnomaly],
          timestamp: Date.now()
        });
      }
    }
    
    // Filter by severity if provided
    let filteredAnomalies = allAnomalies;
    if (severity) {
      filteredAnomalies = allAnomalies.filter(anomaly => 
        anomaly.anomalies.some(a => a.severity === severity)
      );
    }
    
    // Sort by timestamp (most recent first)
    filteredAnomalies.sort((a, b) => b.timestamp - a.timestamp);
    
    // Limit results
    const limitedAnomalies = filteredAnomalies.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        anomalies: limitedAnomalies,
        total: filteredAnomalies.length,
        thresholds: THRESHOLDS
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get anomalies',
      error: error.message
    });
  }
};

// Get user activity summary
export const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const summary = getUserActivitySummary(userId);
    
    // Get comprehensive anomaly check
    const anomalyCheck = await checkAllAnomalies(userId, {
      type: 'message'
    });
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isOnline: user.isOnline,
          lastLogin: user.lastLogin
        },
        activity: summary,
        anomalies: anomalyCheck
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user activity',
      error: error.message
    });
  }
};

// Get system health metrics
export const getSystemHealth = async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        database: {
          status: 'connected',
          // Add MongoDB connection status check
        },
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      thresholds: THRESHOLDS
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system health',
      error: error.message
    });
  }
};

