// Load environment variables FIRST, before any other imports
import './config/env.js';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import connectDB from './config/database.js';
import { initializeSocket } from './config/socket.js';
import passport from './config/passport.js';

// Route imports
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import fileRoutes from './routes/file.js';
import encryptionRoutes from './routes/encryption.js';
import adminRoutes from './routes/admin.js';

// Middleware imports
import { authenticateToken } from './middleware/auth.js';
import { generalLimiter } from './middleware/rateLimiter.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: 1e8 // 100 MB for file transfers
});

// Connect to MongoDB
connectDB();

// Security & Performance Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use(generalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/file', authenticateToken, fileRoutes);
app.use('/api/encryption', authenticateToken, encryptionRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// Initialize Socket.io
initializeSocket(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});