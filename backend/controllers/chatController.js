import Room from '../models/Room.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { detectAnomaly } from '../utils/anomalyDetection.js';

// Create new room
export const createRoom = async (req, res) => {
  try {
    const { name, type, participantIds, participantUsernames, participantKeys } = req.body;
    const userId = req.user.userId;

    // Verify all participants exist
    const users = await User.find({ _id: { $in: participantIds } });
    if (users.length !== participantIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some participants not found'
      });
    }

    // Build participants array
    const participants = participantIds.map((id, index) => ({
      userId: id,
      username: participantUsernames[index],
      publicKey: participantKeys[index],
      joinedAt: new Date()
    }));

    // Add creator if not in participants
    const creatorExists = participants.some(p => p.userId.toString() === userId);
    if (!creatorExists) {
      const creator = await User.findById(userId);
      participants.push({
        userId,
        username: creator.username,
        publicKey: creator.publicKey,
        joinedAt: new Date()
      });
    }

    const room = new Room({
      name,
      type,
      participants,
      admin: userId,
      encryptionEnabled: true,
      forwardSecrecy: {
        enabled: true,
        keyRotationInterval: 86400000,
        lastKeyRotation: new Date()
      }
    });

    await room.save();

    // Update user rooms
    await User.updateMany(
      { _id: { $in: participantIds.concat(userId) } },
      { $push: { rooms: room._id } }
    );

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: { room }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create room',
      error: error.message
    });
  }
};

// Get all rooms for user
export const getRooms = async (req, res) => {
  try {
    const userId = req.user.userId;

    const rooms = await Room.find({
      'participants.userId': userId,
      isActive: true
    }).sort({ 'lastMessage.createdAt': -1 });

    res.json({
      success: true,
      data: { rooms }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get rooms',
      error: error.message
    });
  }
};

// Get single room details
export const getRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    const room = await Room.findOne({
      _id: roomId,
      'participants.userId': userId
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found or access denied'
      });
    }

    res.json({
      success: true,
      data: { room }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get room',
      error: error.message
    });
  }
};

// Add participant to room
export const addParticipant = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId: newUserId, username, publicKey } = req.body;
    const userId = req.user.userId;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if requester is admin
    if (room.admin.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can add participants'
      });
    }

    // Check if user already in room
    const exists = room.participants.some(p => p.userId.toString() === newUserId);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'User already in room'
      });
    }

    await room.addParticipant(newUserId, username, publicKey);

    res.json({
      success: true,
      message: 'Participant added successfully',
      data: { room }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add participant',
      error: error.message
    });
  }
};

// Remove participant from room
export const removeParticipant = async (req, res) => {
  try {
    const { roomId, userId: targetUserId } = req.params;
    const userId = req.user.userId;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if requester is admin
    if (room.admin.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can remove participants'
      });
    }

    await room.removeParticipant(targetUserId);

    res.json({
      success: true,
      message: 'Participant removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove participant',
      error: error.message
    });
  }
};

// Leave room
export const leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    await room.removeParticipant(userId);

    // Update user rooms
    await User.findByIdAndUpdate(userId, {
      $pull: { rooms: roomId }
    });

    // If admin leaves, assign new admin or delete room
    if (room.admin.toString() === userId) {
      if (room.participants.length > 0) {
        room.admin = room.participants[0].userId;
        await room.save();
      } else {
        room.isActive = false;
        await room.save();
      }
    }

    res.json({
      success: true,
      message: 'Left room successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to leave room',
      error: error.message
    });
  }
};

// Delete room
export const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if requester is admin
    if (room.admin.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can delete room'
      });
    }

    room.isActive = false;
    await room.save();

    // Delete all messages in room
    await Message.updateMany(
      { roomId },
      { isDeleted: true, deletedAt: new Date() }
    );

    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete room',
      error: error.message
    });
  }
};

// Get messages for room
export const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.userId;

    // Verify user is in room
    const room = await Room.findOne({
      _id: roomId,
      'participants.userId': userId
    });

    if (!room) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({
      roomId,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await Message.countDocuments({
      roomId,
      isDeleted: false
    });

    res.json({
      success: true,
      data: {
        messages: messages.reverse(),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalMessages,
          pages: Math.ceil(totalMessages / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get messages',
      error: error.message
    });
  }
};

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const {
      encryptedContent,
      iv,
      messageType = 'text',
      fileMetadata,
      steganographyEnabled = false,
      selfDestruct,
      signature
    } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    // Verify user is in room
    const room = await Room.findOne({
      _id: roomId,
      'participants.userId': userId
    });

    if (!room) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Anomaly detection
    const recentMessages = await Message.find({
      senderId: userId,
      createdAt: { $gte: new Date(Date.now() - 60000) } // Last minute
    });

    const isAnomalous = detectAnomaly(recentMessages.length);
    if (isAnomalous) {
      console.warn(`Anomalous activity detected for user ${userId}`);
    }

    // Create message
    const message = new Message({
      roomId,
      senderId: userId,
      senderUsername: username,
      encryptedContent,
      iv,
      messageType,
      fileMetadata,
      steganographyEnabled,
      selfDestruct: selfDestruct || { enabled: false },
      signature
    });

    await message.save();

    // Update room last message
    room.lastMessage = {
      content: 'Encrypted message',
      senderId: userId,
      createdAt: new Date()
    };
    await room.save();

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Mark message as read
export const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.markAsRead(userId);

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
};

// Delete message
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can delete
    if (message.senderId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only sender can delete message'
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
};

// Get unread message count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const rooms = await Room.find({
      'participants.userId': userId,
      isActive: true
    });

    const roomIds = rooms.map(r => r._id);

    const unreadMessages = await Message.find({
      roomId: { $in: roomIds },
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId },
      isDeleted: false
    });

    const unreadByRoom = {};
    unreadMessages.forEach(msg => {
      const roomId = msg.roomId.toString();
      unreadByRoom[roomId] = (unreadByRoom[roomId] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        total: unreadMessages.length,
        byRoom: unreadByRoom
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
    });
  }
};

// Search messages
export const searchMessages = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.userId;

    // Note: This searches encrypted content, so it won't work perfectly
    // In production, you'd implement client-side search after decryption
    const rooms = await Room.find({
      'participants.userId': userId,
      isActive: true
    });

    const roomIds = rooms.map(r => r._id);

    const messages = await Message.find({
      roomId: { $in: roomIds },
      isDeleted: false
    }).limit(100);

    res.json({
      success: true,
      data: { messages },
      note: 'Search on encrypted content - implement client-side filtering'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
};