import Message from '../models/Message.js';
import Room from '../models/Room.js';
import User from '../models/User.js';

export const chatHandler = (io, socket) => {
  // Join room
  socket.on('join-room', async ({ roomId, userId }) => {
    try {
      const room = await Room.findOne({
        _id: roomId,
        'participants.userId': userId
      });

      if (!room) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      socket.join(roomId);
      
      // Update user status
      await User.findByIdAndUpdate(userId, { isOnline: true });

      // Notify others
      socket.to(roomId).emit('user-joined', {
        userId,
        timestamp: new Date()
      });

      // Send room info
      socket.emit('room-joined', {
        roomId,
        participants: room.participants
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Leave room
  socket.on('leave-room', async ({ roomId, userId }) => {
    try {
      socket.leave(roomId);
      
      socket.to(roomId).emit('user-left', {
        userId,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Send message
  socket.on('send-message', async ({ roomId, userId, encryptedContent, iv, type, metadata }) => {
    try {
      const room = await Room.findOne({
        _id: roomId,
        'participants.userId': userId
      });

      if (!room) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const message = new Message({
        roomId,
        senderId: userId,
        encryptedContent,
        iv,
        type: type || 'text',
        metadata: metadata || {}
      });

      await message.save();

      // Broadcast to room
      io.to(roomId).emit('new-message', {
        messageId: message._id,
        roomId,
        senderId: userId,
        encryptedContent,
        iv,
        type: message.type,
        metadata: message.metadata,
        timestamp: message.createdAt
      });

      // Handle self-destruct
      if (metadata?.selfDestruct) {
        setTimeout(async () => {
          await Message.findByIdAndDelete(message._id);
          io.to(roomId).emit('message-deleted', {
            messageId: message._id,
            roomId
          });
        }, metadata.selfDestructTime * 1000);
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Delete message
  socket.on('delete-message', async ({ messageId, roomId, userId }) => {
    try {
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
  socket.on('typing', ({ roomId, userId, username }) => {
    socket.to(roomId).emit('user-typing', {
      userId,
      username
    });
  });

  socket.on('stop-typing', ({ roomId, userId }) => {
    socket.to(roomId).emit('user-stop-typing', {
      userId
    });
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