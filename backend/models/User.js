import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  publicKey: {
    type: String,
    default: null
  },
  privateKeyEncrypted: {
    type: String,
    default: null
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null
  },
  emailOTPEnabled: {
    type: Boolean,
    default: false
  },
  emailOTP: {
    code: String,
    expiresAt: Date
  },
  biometricEnabled: {
    type: Boolean,
    default: false
  },
  biometricPublicKey: {
    type: String,
    default: null
  },
  passwordResetOTP: {
  code: String,
  expiresAt: Date
},
passwordResetToken: {
  token: String,
  expiresAt: Date
},
googleId: {
  type: String,
  unique: true,
  sparse: true
},
emailVerified: {
  type: Boolean,
  default: false
},
avatar: {
  type: String,
  default: null
},
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastLogin: {
    type: Date,
    default: null
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  rooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data from JSON response
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorSecret;
  delete obj.privateKeyEncrypted;
  delete obj.refreshTokens;
  delete obj.emailOTP;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;