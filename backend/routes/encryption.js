import express from 'express';
import { body, param } from 'express-validator';
import {
  initiateKeyExchange,
  completeKeyExchange,
  rotateKeys,
  getSessionKey,
  revokeSession,
  generateDHParameters,
  generateZeroKnowledgeProof,
  verifyZeroKnowledge
} from '../controllers/encryptionController.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// Diffie-Hellman Key Exchange
router.post('/key-exchange/initiate',
  [
    body('roomId').isMongoId(),
    body('publicKey').notEmpty()
  ],
  validate,
  initiateKeyExchange
);

router.post('/key-exchange/complete',
  [
    body('roomId').isMongoId(),
    body('publicKey').notEmpty(),
    body('sessionKey').notEmpty()
  ],
  validate,
  completeKeyExchange
);

// Key Rotation for Forward Secrecy
router.post('/keys/rotate',
  [
    body('roomId').isMongoId(),
    body('newSessionKey').notEmpty(),
    body('newPublicKey').notEmpty()
  ],
  validate,
  rotateKeys
);

// Session Key Management
router.get('/session/:roomId',
  [param('roomId').isMongoId()],
  validate,
  getSessionKey
);

router.delete('/session/:roomId',
  [param('roomId').isMongoId()],
  validate,
  revokeSession
);

// Generate DH Parameters
router.post('/dh-parameters', generateDHParameters);

// Zero-Knowledge Proof
router.post('/zkp/generate',
  [
    body('privateKey').notEmpty(),
    body('challenge').notEmpty(),
    body('publicKey').notEmpty()
  ],
  validate,
  generateZeroKnowledgeProof
);

router.post('/zkp/verify',
  [
    body('commitment').notEmpty(),
    body('challenge').notEmpty(),
    body('response').notEmpty(),
    body('publicKey').notEmpty()
  ],
  validate,
  verifyZeroKnowledge
);

export default router;