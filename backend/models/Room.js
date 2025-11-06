import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: String,
    publicKey: String,
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  }],
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  encryptionEnabled: {
    type: Boolean,
    default: true
  },
  forwardSecrecy: {
    enabled: {
      type: Boolean,
      default: true
    },
    keyRotationInterval: {
      type: Number,
      default: 86400000 // 24 hours in milliseconds
    },
    lastKeyRotation: {
      type: Date,
      default: Date.now
    }
  },
  groupKey: {
    type: String,
    default: null
  },
  encryptionKey: {
    type: String,
    default: null
  },
  lastMessage: {
    content: String,
    senderId: mongoose.Schema.Types.ObjectId,
    createdAt: Date
  },
  settings: {
    allowFileSharing: {
      type: Boolean,
      default: true
    },
    maxFileSize: {
      type: Number,
      default: 104857600 // 100 MB
    },
    selfDestructDefault: {
      type: Number,
      default: 0 // 0 means disabled
    },
    screenshotAlert: {
      type: Boolean,
      default: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
roomSchema.index({ 'participants.userId': 1 });
roomSchema.index({ type: 1, isActive: 1 });

// Method to add participant
roomSchema.methods.addParticipant = function(userId, username, publicKey) {
  const exists = this.participants.some(p => p.userId.equals(userId));
  
  if (!exists) {
    this.participants.push({
      userId,
      username,
      publicKey,
      joinedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to remove participant
roomSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(p => !p.userId.equals(userId));
  return this.save();
};

// Method to update last seen
roomSchema.methods.updateLastSeen = function(userId) {
  const participant = this.participants.find(p => p.userId.equals(userId));
  if (participant) {
    participant.lastSeen = new Date();
    return this.save();
  }
};

const Room = mongoose.model('Room', roomSchema);

export default Room;