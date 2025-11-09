import Message from '../models/Message.js';
import Room from '../models/Room.js';
import User from '../models/User.js';

export const chatHandler = (io, socket) => {
  // Join room
  socket.on('join-room', async ({ roomId }) => {
    try {
      // Use userId from socket authentication (secure - not from client)
      const userId = socket.userId;
      
      if (!userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      if (!roomId) {
        socket.emit('error', { message: 'Room ID required' });
        return;
      }

      const room = await Room.findOne({
        _id: roomId,
        'participants.userId': userId
      });

      if (!room) {
        socket.emit('error', { message: 'Access denied: You are not a participant of this room' });
        return;
      }

      socket.join(roomId);
      
      // Update user status
      await User.findByIdAndUpdate(userId, { isOnline: true });

      // Notify others
      socket.to(roomId).emit('user-joined', {
        userId,
        username: socket.username,
        timestamp: new Date()
      });

      // Send room info
      socket.emit('room-joined', {
        roomId,
        participants: room.participants
      });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: error.message || 'Failed to join room' });
    }
  });

  // Leave room
  socket.on('leave-room', async ({ roomId }) => {
    try {
      const userId = socket.userId;
      
      if (!userId || !roomId) {
        socket.emit('error', { message: 'Invalid request' });
        return;
      }

      socket.leave(roomId);
      
      socket.to(roomId).emit('user-left', {
        userId,
        username: socket.username,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error leaving room:', error);
      socket.emit('error', { message: error.message || 'Failed to leave room' });
    }
  });

  // Send message
  socket.on('send-message', async ({ roomId, encryptedContent, iv, type, metadata }) => {
    try {
      // Use userId from socket authentication (secure - not from client)
      const userId = socket.userId;
      
      if (!userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      if (!roomId || !encryptedContent || !iv) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      const room = await Room.findOne({
        _id: roomId,
        'participants.userId': userId
      });

      if (!room) {
        socket.emit('error', { message: 'Access denied: You are not a participant of this room' });
        return;
      }

      // Get username from socket or fetch from database
      let senderUsername = socket.username;
      if (!senderUsername) {
        const user = await User.findById(userId);
        senderUsername = user?.username || 'Unknown';
      }

      // Create message with all metadata properly structured
      const message = new Message({
        roomId,
        senderId: userId,
        senderUsername: senderUsername,
        encryptedContent,
        iv,
        messageType: type || 'text',
        fileMetadata: metadata?.fileMetadata || undefined,
        steganographyEnabled: metadata?.steganographyEnabled || false,
        selfDestruct: metadata?.selfDestruct || { enabled: false },
        signature: metadata?.signature || undefined
      });

      await message.save();

      // Broadcast to room
      io.to(roomId).emit('new-message', {
        messageId: message._id,
        roomId,
        senderId: userId,
        senderUsername: senderUsername,
        encryptedContent,
        iv,
        type: message.messageType || type || 'text',
        fileMetadata: message.fileMetadata,
        steganographyEnabled: message.steganographyEnabled,
        selfDestruct: message.selfDestruct,
        signature: message.signature,
        timestamp: message.createdAt || new Date()
      });

      // Handle self-destruct timer
      if (metadata?.selfDestruct?.enabled && metadata?.selfDestruct?.timer) {
        const timerSeconds = metadata.selfDestruct.timer;
        setTimeout(async () => {
          try {
            const msg = await Message.findById(message._id);
            if (msg) {
              await Message.findByIdAndDelete(message._id);
              io.to(roomId).emit('message-deleted', {
                messageId: message._id,
                roomId
              });
            }
          } catch (error) {
            console.error('Error deleting self-destruct message:', error);
          }
        }, timerSeconds * 1000);
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Delete message
  socket.on('delete-message', async ({ messageId, roomId }) => {
    try {
      const userId = socket.userId;
      if (!userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      const message = await Message.findOne({
        _id: messageId,
        senderId: userId
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found or unauthorized' });
        return;
      }

      await Message.findByIdAndDelete(messageId);

      io.to(roomId).emit('message-deleted', {
        messageId,
        roomId
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Typing indicator
  socket.on('typing', ({ roomId, username }) => {
    const userId = socket.userId;
    if (!userId || !roomId) return;
    
    socket.to(roomId).emit('user-typing', {
      userId,
      username: username || socket.username
    });
  });

  socket.on('stop-typing', ({ roomId }) => {
    const userId = socket.userId;
    if (!userId || !roomId) return;
    
    socket.to(roomId).emit('user-stop-typing', {
      userId
    });
  });

  // Screenshot detection handler
  socket.on('screenshot-detected', async ({ roomId, threatType, timestamp }) => {
    try {
      const userId = socket.userId;
      
      if (!userId || !roomId) {
        return;
      }

      // Verify user is in room
      const room = await Room.findOne({
        _id: roomId,
        'participants.userId': userId
      });

      if (!room) {
        return;
      }

      // Check if screenshot alerts are enabled for this room
      if (room.settings?.screenshotAlert !== false) {
        // Log screenshot attempt (you can extend this to save to database)
        console.warn(`⚠️ Screenshot detected: User ${userId} (${socket.username}) in room ${roomId}, Type: ${threatType}`);
        
        // Notify room participants (except the one who triggered it)
        socket.to(roomId).emit('screenshot-alert', {
          userId,
          username: socket.username,
          threatType,
          timestamp: timestamp || new Date(),
          message: 'A screenshot attempt was detected in this secure chat'
        });

        // Log to anomaly detection if available
        try {
          const { logActivity } = await import('../utils/anomalyDetection.js');
          logActivity(userId, 'screenshot_detected', {
            roomId,
            threatType,
            timestamp: timestamp || new Date()
          });
        } catch (err) {
          // Anomaly detection not critical, continue
        }
      }
    } catch (error) {
      console.error('Screenshot detection logging error:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      const userId = socket.userId;
      if (userId) {
        await User.findByIdAndUpdate(userId, { 
          isOnline: false,
          lastSeen: new Date()
        });

        // Notify all rooms
        socket.rooms.forEach(roomId => {
          socket.to(roomId).emit('user-offline', {
            userId,
            timestamp: new Date()
          });
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  });
};