import crypto from 'crypto';

// Verify message signature
export const verifySignature = (req, res, next) => {
  try {
    const { signature, publicKey, data } = req.body;

    if (!signature || !publicKey || !data) {
      return res.status(400).json({
        success: false,
        message: 'Missing signature verification parameters'
      });
    }

    const verifier = crypto.createVerify('SHA256');
    verifier.update(data);
    
    const isValid = verifier.verify(publicKey, signature, 'base64');

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Signature verification failed',
      error: error.message
    });
  }
};

// Validate encryption parameters
export const validateEncryption = (req, res, next) => {
  const { encryptedContent, iv } = req.body;

  if (!encryptedContent || !iv) {
    return res.status(400).json({
      success: false,
      message: 'Encrypted content and IV are required'
    });
  }

  // Validate IV format (should be hex string of appropriate length)
  if (!/^[0-9a-f]{32}$/i.test(iv)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid IV format'
    });
  }

  next();
};

// Check if encryption is enabled for room
export const requireEncryption = async (req, res, next) => {
  try {
    const { roomId } = req.params || req.body;
    
    if (!roomId) {
      return next();
    }

    const Room = (await import('../models/Room.js')).default;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (!room.encryptionEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Encryption is required for this room'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Encryption check failed',
      error: error.message
    });
  }
};