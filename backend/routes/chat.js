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

const router = express.Router();

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

router.get('/rooms/:roomId',
  [param('roomId').isMongoId()],
  validate,
  getRoom
);

router.post('/rooms/:roomId/participants',
  [
    param('roomId').isMongoId(),
    body('userId').isMongoId(),
    body('username').notEmpty(),
    body('publicKey').notEmpty()
  ],
  validate,
  addParticipant
);

router.delete('/rooms/:roomId/participants/:userId',
  [
    param('roomId').isMongoId(),
    param('userId').isMongoId()
  ],
  validate,
  removeParticipant
);

router.post('/rooms/:roomId/leave',
  [param('roomId').isMongoId()],
  validate,
  leaveRoom
);

router.delete('/rooms/:roomId',
  [param('roomId').isMongoId()],
  validate,
  deleteRoom
);

// Message Management
router.get('/rooms/:roomId/messages',
  [
    param('roomId').isMongoId(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  getMessages
);

router.post('/rooms/:roomId/messages',
  messageLimiter,
  [
    param('roomId').isMongoId(),
    body('encryptedContent').notEmpty(),
    body('iv').notEmpty(),
    body('messageType').optional().isIn(['text', 'file', 'image', 'video', 'audio', 'stego'])
  ],
  validate,
  sendMessage
);

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