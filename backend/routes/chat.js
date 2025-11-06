import express from 'express';
import { body, param, query } from 'express-validator';
import {
  createRoom,
  getRooms,
  getRoom,
  addParticipant,
  removeParticipant,
  leaveRoom,
  deleteRoom,
  getMessages,
  sendMessage,
  markMessageAsRead,
  deleteMessage,
  getUnreadCount,
  searchMessages
} from '../controllers/chatController.js';
import { validate } from '../middleware/validation.js';
import { messageLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to ALL chat routes
router.use(authenticateToken);

// Room Management
router.post('/rooms',
  [
    body('name').trim().notEmpty(),
    body('type').isIn(['direct', 'group']),
    body('participantIds').isArray({ min: 1 })
  ],
  validate,
  createRoom
);

router.get('/rooms', getRooms);

// CHANGE: Use isString() instead of isMongoId() for roomId
router.get('/rooms/:roomId',
  [param('roomId').isString().notEmpty()],
  validate,
  getRoom
);

// CHANGE: Use isString() instead of isMongoId() for roomId
router.post('/rooms/:roomId/participants',
  [
    param('roomId').isString().notEmpty(),
    body('userId').isMongoId(),
    body('username').notEmpty(),
    body('publicKey').notEmpty()
  ],
  validate,
  addParticipant
);

// CHANGE: Use isString() instead of isMongoId() for roomId
router.delete('/rooms/:roomId/participants/:userId',
  [
    param('roomId').isString().notEmpty(),
    param('userId').isMongoId()
  ],
  validate,
  removeParticipant
);

// CHANGE: Use isString() instead of isMongoId() for roomId
router.post('/rooms/:roomId/leave',
  [param('roomId').isString().notEmpty()],
  validate,
  leaveRoom
);

// CHANGE: Use isString() instead of isMongoId() for roomId
router.delete('/rooms/:roomId',
  [param('roomId').isString().notEmpty()],
  validate,
  deleteRoom
);

// Message Management
// CHANGE: Use isString() instead of isMongoId() for roomId
router.get('/rooms/:roomId/messages',
  [
    param('roomId').isString().notEmpty(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  getMessages
);

// CHANGE: Use isString() instead of isMongoId() for roomId
router.post('/rooms/:roomId/messages',
  messageLimiter,
  [
    param('roomId').isString().notEmpty(),
    body('encryptedContent').notEmpty(),
    body('iv').notEmpty(),
    body('messageType').optional().isIn(['text', 'file', 'image', 'video', 'audio', 'stego'])
  ],
  validate,
  sendMessage
);

// Keep messageId as MongoId since these should be real database entries
router.put('/messages/:messageId/read',
  [param('messageId').isMongoId()],
  validate,
  markMessageAsRead
);

router.delete('/messages/:messageId',
  [param('messageId').isMongoId()],
  validate,
  deleteMessage
);

router.get('/unread-count', getUnreadCount);

router.get('/search',
  [query('query').trim().notEmpty()],
  validate,
  searchMessages
);

export default router;