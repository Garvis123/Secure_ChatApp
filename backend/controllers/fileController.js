import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Room from '../models/Room.js';
import { embedMessageInImage, extractMessageFromImage } from '../utils/steganography.js';
import { encryptFile, decryptFile, generateKey } from '../utils/crypto.js';

// In-memory file storage (replace with cloud storage in production)
const fileStore = new Map();

// Upload file
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const { roomId } = req.body;
    const userId = req.user.userId;

    // Validate roomId if provided (allow empty string for non-room uploads)
    if (roomId && roomId.trim() !== '' && !mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID format. Please create or join a valid room first.'
      });
    }
    
    // If roomId is empty string, set to null
    const validRoomId = roomId && roomId.trim() !== '' ? roomId : null;

    // Check file size (100MB limit)
    if (size > 100 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 100MB limit'
      });
    }

    // Generate unique file ID
    const fileId = uuidv4();

    // Encrypt file before storage
    const encryptionKey = generateKey();
    const encryptedFile = encryptFile(buffer, encryptionKey);

    // Store encrypted file (in production, upload to S3/cloud storage)
    fileStore.set(fileId, {
      encryptedData: encryptedFile.encryptedData,
      iv: encryptedFile.iv,
      authTag: encryptedFile.authTag,
      encryptionKey: encryptionKey.toString('hex'), // In production, encrypt this key with recipient's public key
      metadata: {
        fileName: originalname,
        mimeType: mimetype,
        fileSize: size,
        uploadedBy: userId,
        roomId: validRoomId,
        uploadedAt: new Date(),
        encrypted: true
      }
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileId,
        fileName: originalname,
        mimeType: mimetype,
        fileSize: size,
        url: `/api/file/download/${fileId}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: error.message
    });
  }
};

// Download file
export const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    const fileData = fileStore.get(fileId);
    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const { metadata } = fileData;

    // Check access (user must be in the room or be the uploader)
    if (metadata.roomId) {
      const room = await Room.findOne({
        _id: metadata.roomId,
        'participants.userId': userId
      });
      
      if (!room && metadata.uploadedBy !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else if (metadata.uploadedBy !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Decrypt file if encrypted
    let buffer;
    if (fileData.encryptedData && fileData.iv && fileData.authTag) {
      const encryptionKey = Buffer.from(fileData.encryptionKey, 'hex');
      buffer = decryptFile(
        fileData.encryptedData,
        encryptionKey,
        fileData.iv,
        fileData.authTag
      );
    } else {
      // Legacy support for unencrypted files
      buffer = fileData.buffer;
    }

    res.set({
      'Content-Type': metadata.mimeType,
      'Content-Disposition': `attachment; filename="${metadata.fileName}"`,
      'Content-Length': buffer.length
    });

    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'File download failed',
      error: error.message
    });
  }
};

// Delete file
export const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    const fileData = fileStore.get(fileId);
    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if user uploaded the file
    if (fileData.metadata.uploadedBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    fileStore.delete(fileId);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'File deletion failed',
      error: error.message
    });
  }
};

// Embed message in image (Steganography)
export const embedSteganography = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const imageBuffer = req.file.buffer;

    // Embed message in image
    const stegoImageBuffer = await embedMessageInImage(imageBuffer, message);

    // Generate unique file ID
    const fileId = uuidv4();

    // Store the stego image
    fileStore.set(fileId, {
      buffer: stegoImageBuffer,
      metadata: {
        fileName: `stego_${req.file.originalname}`,
        mimeType: req.file.mimetype,
        fileSize: stegoImageBuffer.length,
        uploadedBy: req.user.userId,
        isSteganography: true,
        uploadedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Message embedded in image successfully',
      data: {
        fileId,
        fileName: `stego_${req.file.originalname}`,
        url: `/api/file/download/${fileId}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Steganography embedding failed',
      error: error.message
    });
  }
};

// Extract message from image (Steganography)
export const extractSteganography = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }

    const imageBuffer = req.file.buffer;

    // Extract message from image
    const extractedMessage = await extractMessageFromImage(imageBuffer);

    if (!extractedMessage) {
      return res.status(404).json({
        success: false,
        message: 'No hidden message found in image'
      });
    }

    res.json({
      success: true,
      message: 'Message extracted successfully',
      data: {
        extractedMessage
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Steganography extraction failed',
      error: error.message
    });
  }
};