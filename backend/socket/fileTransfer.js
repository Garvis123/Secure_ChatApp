import crypto from 'crypto';
import Message from '../models/Message.js';
import Room from '../models/Room.js';

// Store active file transfers
const activeTransfers = new Map();

const handleFileTransfer = (io, socket) => {
  
  // Initiate file transfer
  socket.on('file:start', async (data) => {
    try {
      const { roomId, fileName, fileSize, fileType, recipientId, encryptedKey } = data;
      
      // Validate file size (max 50MB)
      if (fileSize > 50 * 1024 * 1024) {
        socket.emit('file:error', { message: 'File size exceeds 50MB limit' });
        return;
      }

      // Generate transfer ID
      const transferId = crypto.randomBytes(16).toString('hex');
      
      // Store transfer metadata
      activeTransfers.set(transferId, {
        roomId,
        fileName,
        fileSize,
        fileType,
        senderId: socket.userId,
        recipientId,
        encryptedKey,
        chunks: [],
        receivedSize: 0,
        startTime: Date.now()
      });

      // Notify recipient about incoming file
      io.to(roomId).emit('file:incoming', {
        transferId,
        fileName,
        fileSize,
        fileType,
        senderId: socket.userId,
        timestamp: new Date()
      });

      // Send transfer ID back to sender
      socket.emit('file:ready', { transferId });
      
    } catch (error) {
      console.error('File transfer start error:', error);
      socket.emit('file:error', { message: 'Failed to initiate file transfer' });
    }
  });

  // Receive file chunk
  socket.on('file:chunk', async (data) => {
    try {
      const { transferId, chunk, chunkIndex, isLastChunk } = data;
      
      const transfer = activeTransfers.get(transferId);
      
      if (!transfer) {
        socket.emit('file:error', { message: 'Invalid transfer ID' });
        return;
      }

      // Verify sender
      if (transfer.senderId !== socket.userId) {
        socket.emit('file:error', { message: 'Unauthorized transfer' });
        return;
      }

      // Store chunk
      transfer.chunks[chunkIndex] = chunk;
      transfer.receivedSize += chunk.length;

      // Calculate progress
      const progress = Math.round((transfer.receivedSize / transfer.fileSize) * 100);

      // Emit progress to room
      io.to(transfer.roomId).emit('file:progress', {
        transferId,
        progress,
        receivedSize: transfer.receivedSize,
        totalSize: transfer.fileSize
      });

      // If last chunk, process complete file
      if (isLastChunk) {
        await completeFileTransfer(io, transferId, transfer);
      }
      
    } catch (error) {
      console.error('File chunk error:', error);
      socket.emit('file:error', { message: 'Failed to process file chunk' });
    }
  });

  // Cancel file transfer
  socket.on('file:cancel', async (data) => {
    try {
      const { transferId } = data;
      const transfer = activeTransfers.get(transferId);
      
      if (transfer && transfer.senderId === socket.userId) {
        activeTransfers.delete(transferId);
        io.to(transfer.roomId).emit('file:cancelled', { transferId });
      }
      
    } catch (error) {
      console.error('File cancel error:', error);
    }
  });

  // Request file download
  socket.on('file:download', async (data) => {
    try {
      const { messageId } = data;
      
      // Find message with file
      const message = await Message.findById(messageId)
        .populate('sender', 'username');
      
      if (!message || !message.fileData) {
        socket.emit('file:error', { message: 'File not found' });
        return;
      }

      // Verify user is in the room
      const room = await Room.findById(message.room);
      if (!room || !room.participants.includes(socket.userId)) {
        socket.emit('file:error', { message: 'Unauthorized access' });
        return;
      }

      // Send file data
      socket.emit('file:data', {
        messageId,
        fileName: message.fileName,
        fileType: message.fileType,
        fileData: message.fileData,
        encryptedKey: message.encryptedKey
      });
      
    } catch (error) {
      console.error('File download error:', error);
      socket.emit('file:error', { message: 'Failed to download file' });
    }
  });

  // Handle disconnection - cleanup active transfers
  socket.on('disconnect', () => {
    // Cancel all transfers from this user
    for (const [transferId, transfer] of activeTransfers.entries()) {
      if (transfer.senderId === socket.userId) {
        activeTransfers.delete(transferId);
        io.to(transfer.roomId).emit('file:cancelled', { 
          transferId,
          reason: 'Sender disconnected' 
        });
      }
    }
  });
};

// Complete file transfer and save to database
async function completeFileTransfer(io, transferId, transfer) {
  try {
    // Combine all chunks
    const fileBuffer = Buffer.concat(transfer.chunks);
    
    // Verify file size
    if (fileBuffer.length !== transfer.fileSize) {
      throw new Error('File size mismatch');
    }

    // Create message with file
    const message = new Message({
      room: transfer.roomId,
      sender: transfer.senderId,
      content: `📎 Shared file: ${transfer.fileName}`,
      messageType: 'file',
      fileName: transfer.fileName,
      fileType: transfer.fileType,
      fileSize: transfer.fileSize,
      fileData: fileBuffer.toString('base64'), // Store as base64
      encryptedKey: transfer.encryptedKey,
      timestamp: new Date()
    });

    await message.save();

    // Populate sender info
    await message.populate('sender', 'username avatar');

    // Notify room
    io.to(transfer.roomId).emit('file:complete', {
      transferId,
      message: message.toObject(),
      duration: Date.now() - transfer.startTime
    });

    // Cleanup
    activeTransfers.delete(transferId);
    
  } catch (error) {
    console.error('Complete file transfer error:', error);
    
    io.to(transfer.roomId).emit('file:error', {
      transferId,
      message: 'Failed to complete file transfer'
    });
    
    activeTransfers.delete(transferId);
  }
}

export default handleFileTransfer;