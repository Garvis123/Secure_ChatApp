import { verifyAccessToken } from './jwt.js';
import { chatHandler } from '../socket/chatHandler.js';
import { keyExchangeHandler } from '../socket/keyExchange.js';
import fileTransferHandler from '../socket/fileTransfer.js';

const userSocketMap = new Map(); // userId -> socketId mapping
let socketInstance = null; // Store io instance

export const initializeSocket = (io) => {
  socketInstance = io;
  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      console.error('Socket authentication failed: No token provided');
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      console.log(`Socket authentication successful for user: ${decoded.username} (${decoded.userId})`);
      next();
    } catch (error) {
      console.error('Socket authentication failed:', error.message);
      // Provide more specific error message
      if (error.message.includes('expired')) {
        return next(new Error('Authentication token expired. Please refresh your session.'));
      } else if (error.message.includes('invalid')) {
        return next(new Error('Invalid authentication token. Please log in again.'));
      }
      return next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.username} (${socket.userId})`);
    
    // Store user socket mapping
    userSocketMap.set(socket.userId, socket.id);
    socket.join(socket.userId); // Join personal room
    
    // Notify others about online status
    socket.broadcast.emit('user:online', {
      userId: socket.userId,
      username: socket.username
    });

    // Register event handlers
    chatHandler(io, socket);
    keyExchangeHandler(io, socket);
    fileTransferHandler(io, socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.username}`);
      userSocketMap.delete(socket.userId);
      
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
        username: socket.username
      });
    });

    // Handle typing indicators
    socket.on('typing:start', ({ roomId, username }) => {
      socket.to(roomId).emit('typing:start', { username });
    });

    socket.on('typing:stop', ({ roomId, username }) => {
      socket.to(roomId).emit('typing:stop', { username });
    });
  });

  return io;
};

export const getSocketId = (userId) => {
  return userSocketMap.get(userId);
};

export const getSocketInstance = () => {
  return socketInstance;
};

export { userSocketMap };