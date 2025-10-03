import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  senderUsername: {
    type: String,
    required: true
  },
  encryptedContent: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'image', 'video', 'audio', 'stego'],
    default: 'text'
  },
  fileMetadata: {
    fileName: String,
    fileSize: Number,
    mimeType: String,
    encryptedUrl: String
  },
  steganographyEnabled: {
    type: Boolean,
    default: false
  },
  selfDestruct: {
    enabled: {
      type: Boolean,
      default: false
    },
    timer: {
      type: Number, // in seconds
      default: 0
    },
    readAt: {
      type: Date,
      default: null
    },
    destroyAt: {
      type: Date,
      default: null
    }
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  signature: {
    type: String,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 0 // Will be set dynamically for self-destruct messages
  }
}, {
  timestamps: true
});

// Index for efficient querying
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ 'selfDestruct.destroyAt': 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: { 'selfDestruct.enabled': true }
});

// Method to mark message as read
messageSchema.methods.markAsRead = function(userId) {
  const alreadyRead = this.readBy.some(read => read.userId.equals(userId));
  
  if (!alreadyRead) {
    this.readBy.push({ userId, readAt: new Date() });
    
    // Set self-destruct timer if enabled
    if (this.selfDestruct.enabled && !this.selfDestruct.readAt) {
      this.selfDestruct.readAt = new Date();
      this.selfDestruct.destroyAt = new Date(
        Date.now() + this.selfDestruct.timer * 1000
      );
    }
  }
  
  return this.save();
};

const Message = mongoose.model('Message', messageSchema);

export default Message;