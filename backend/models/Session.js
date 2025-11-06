import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  sessionKey: {
    type: String,
    required: true
  },
  sessionIV: {
    type: String,
    required: true
  },
  publicKey: {
    type: String,
    required: true
  },
  keyVersion: {
    type: Number,
    default: 1
  },
  dhParameters: {
    prime: String,
    generator: String,
    privateKey: String,
    publicKey: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Auto-delete after 24 hours
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rotationCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
sessionSchema.index({ userId: 1, roomId: 1, isActive: 1 });

// Method to rotate keys
sessionSchema.methods.rotateKeys = async function(newSessionKey, newPublicKey) {
  this.sessionKey = newSessionKey;
  this.publicKey = newPublicKey;
  this.keyVersion += 1;
  this.rotationCount += 1;
  this.expiresAt = new Date(Date.now() + 86400000); // Extend by 24 hours
  return this.save();
};

// Method to deactivate session
sessionSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

const Session = mongoose.model('Session', sessionSchema);

export default Session;