import Session from '../models/Session.js';
import Room from '../models/Room.js';
import crypto from 'crypto';

export const keyExchangeHandler = (io, socket) => {
  // Initiate key exchange
  socket.on('initiate-key-exchange', async ({ roomId, publicKey }) => {
    try {
      const userId = socket.userId;

      const room = await Room.findOne({
        _id: roomId,
        'participants.userId': userId
      });

      if (!room) {
        socket.emit('key-exchange-error', { message: 'Access denied' });
        return;
      }

      // Generate session key
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

      socket.emit('key-exchange-initiated', {
        sessionId: session._id,
        sessionKey,
        sessionIV
      });

      // Notify other participants
      socket.to(roomId).emit('key-exchange-request', {
        userId,
        publicKey,
        sessionId: session._id
      });
    } catch (error) {
      socket.emit('key-exchange-error', { message: error.message });
    }
  });

  // Accept key exchange
  socket.on('accept-key-exchange', async ({ roomId, sessionId, publicKey }) => {
    try {
      const userId = socket.userId;

      const room = await Room.findOne({
        _id: roomId,
        'participants.userId': userId
      });

      if (!room) {
        socket.emit('key-exchange-error', { message: 'Access denied' });
        return;
      }

      const sessionKey = crypto.randomBytes(32).toString('hex');
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

      socket.emit('key-exchange-completed', {
        sessionId: session._id,
        sessionKey,
        sessionIV
      });

      socket.to(roomId).emit('key-exchange-accepted', {
        userId,
        sessionId: session._id
      });
    } catch (error) {
      socket.emit('key-exchange-error', { message: error.message });
    }
  });

  // Rotate keys
  socket.on('rotate-keys', async ({ roomId, newSessionKey, newPublicKey }) => {
    try {
      const userId = socket.userId;

      const session = await Session.findOne({
        userId,
        roomId,
        isActive: true
      });

      if (!session) {
        socket.emit('key-exchange-error', { message: 'No active session found' });
        return;
      }

      await session.rotateKeys(newSessionKey, newPublicKey);

      socket.emit('keys-rotated', {
        keyVersion: session.keyVersion,
        rotationCount: session.rotationCount
      });

      socket.to(roomId).emit('keys-rotation-notification', {
        userId,
        keyVersion: session.keyVersion
      });
    } catch (error) {
      socket.emit('key-exchange-error', { message: error.message });
    }
  });

  // Request session key
  socket.on('request-session-key', async ({ roomId }) => {
    try {
      const userId = socket.userId;

      const session = await Session.findOne({
        userId,
        roomId,
        isActive: true
      });

      if (!session) {
        socket.emit('key-exchange-error', { message: 'No active session found' });
        return;
      }

      if (session.expiresAt < new Date()) {
        session.isActive = false;
        await session.save();
        socket.emit('key-exchange-error', { message: 'Session expired' });
        return;
      }

      socket.emit('session-key-response', {
        sessionKey: session.sessionKey,
        sessionIV: session.sessionIV,
        publicKey: session.publicKey,
        keyVersion: session.keyVersion,
        expiresAt: session.expiresAt
      });
    } catch (error) {
      socket.emit('key-exchange-error', { message: error.message });
    }
  });
};