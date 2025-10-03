import Session from '../models/Session.js';
import Room from '../models/Room.js';
import { generateDHParams, verifyZKProof } from '../utils/crypto.js';
import crypto from 'crypto';

// Initiate key exchange
export const initiateKeyExchange = async (req, res) => {
  try {
    const { roomId, publicKey } = req.body;
    const userId = req.user.userId;

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

    const sessionKey = crypto.randomBytes(32).toString('hex');
    const sessionIV = crypto.randomBytes(16).toString('hex');

    let session = await Session.findOne({ userId, roomId, isActive: true });

    if (session) {
      session.sessionKey = sessionKey;
      session.sessionIV = sessionIV;
      session.publicKey = publicKey;
      session.expiresAt = new Date(Date.now() + 86400000);
      await session.save();
    } else {
      session = new Session({
        userId,
        roomId,
        sessionKey,
        sessionIV,
        publicKey,
        expiresAt: new Date(Date.now() + 86400000)
      });
      await session.save();
    }

    res.json({
      success: true,
      message: 'Key exchange initiated',
      data: {
        sessionId: session._id,
        sessionKey,
        sessionIV
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Key exchange initiation failed',
      error: error.message
    });
  }
};

// Complete key exchange
export const completeKeyExchange = async (req, res) => {
  try {
    const { roomId, publicKey, sessionKey } = req.body;
    const userId = req.user.userId;

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

    const sessionIV = crypto.randomBytes(16).toString('hex');

    const session = new Session({
      userId,
      roomId,
      sessionKey,
      sessionIV,
      publicKey,
      expiresAt: new Date(Date.now() + 86400000)
    });

    await session.save();

    res.json({
      success: true,
      message: 'Key exchange completed',
      data: {
        sessionId: session._id,
        sessionIV
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Key exchange completion failed',
      error: error.message
    });
  }
};

// Rotate keys for forward secrecy
export const rotateKeys = async (req, res) => {
  try {
    const { roomId, newSessionKey, newPublicKey } = req.body;
    const userId = req.user.userId;

    const session = await Session.findOne({
      userId,
      roomId,
      isActive: true
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active session found'
      });
    }

    await session.rotateKeys(newSessionKey, newPublicKey);

    res.json({
      success: true,
      message: 'Keys rotated successfully',
      data: {
        keyVersion: session.keyVersion,
        rotationCount: session.rotationCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Key rotation failed',
      error: error.message
    });
  }
};

// Get session key
export const getSessionKey = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    const session = await Session.findOne({
      userId,
      roomId,
      isActive: true
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active session found'
      });
    }

    if (session.expiresAt < new Date()) {
      session.isActive = false;
      await session.save();

      return res.status(401).json({
        success: false,
        message: 'Session expired'
      });
    }

    res.json({
      success: true,
      data: {
        sessionKey: session.sessionKey,
        sessionIV: session.sessionIV,
        publicKey: session.publicKey,
        keyVersion: session.keyVersion,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get session key',
      error: error.message
    });
  }
};

// Generate Diffie-Hellman parameters
export const generateDHParameters = async (req, res) => {
  try {
    const dhParams = generateDHParams();

    res.json({
      success: true,
      data: dhParams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate DH parameters',
      error: error.message
    });
  }
};

// Verify zero-knowledge proof
export const verifyZeroKnowledge = async (req, res) => {
  try {
    const { proof, challenge, publicKey } = req.body;

    const isValid = verifyZKProof(proof, challenge, publicKey);

    res.json({
      success: true,
      data: {
        isValid
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'ZK proof verification failed',
      error: error.message
    });
  }
};

// Get all active sessions for user
export const getUserSessions = async (req, res) => {
  try {
    const userId = req.user.userId;

    const sessions = await Session.find({
      userId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).populate('roomId', 'name type');

    res.json({
      success: true,
      data: {
        sessions: sessions.map(session => ({
          sessionId: session._id,
          roomId: session.roomId,
          keyVersion: session.keyVersion,
          rotationCount: session.rotationCount,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get sessions',
      error: error.message
    });
  }
};

// Revoke session
export const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    const session = await Session.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    session.isActive = false;
    await session.save();

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to revoke session',
      error: error.message
    });
  }
};

// Revoke all sessions for a room
export const revokeRoomSessions = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

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

    await Session.updateMany(
      { roomId, isActive: true },
      { isActive: false }
    );

    res.json({
      success: true,
      message: 'All room sessions revoked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to revoke room sessions',
      error: error.message
    });
  }
};