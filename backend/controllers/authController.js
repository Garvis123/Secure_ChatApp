import User from '../models/User.js';
import { generateTokenPair, verifyRefreshToken } from '../config/jwt.js';
import { generateTOTPSecret, verifyTOTP, generateQRCode } from '../utils/twoFactor.js';
import emailService from '../utils/emailService.js';
import crypto from 'crypto';

// Register new user
export const register = async (req, res) => {
  try {
    const { username, email, password, publicKey } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    const user = new User({
      username,
      email,
      password,
      publicKey: publicKey || null
    });

    await user.save();

    const tokens = generateTokenPair(user._id, user.username);

    user.refreshTokens.push({
      token: tokens.refreshToken,
      createdAt: new Date()
    });
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          publicKey: user.publicKey
        },
        ...tokens
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password, twoFactorToken, emailOTP } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorToken) {
        return res.status(200).json({
          success: true,
          requiresTwoFactor: true,
          message: '2FA token required'
        });
      }

      const isTokenValid = verifyTOTP(user.twoFactorSecret, twoFactorToken);
      if (!isTokenValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid 2FA token'
        });
      }
    }

    if (user.emailOTPEnabled) {
      if (!emailOTP) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.emailOTP = {
          code: otp,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        };
        await user.save();
        await emailService.sendOTPEmail(user.email, otp, user.username);

        return res.status(200).json({
          success: true,
          requiresEmailOTP: true,
          message: 'OTP sent to email'
        });
      }

      if (!user.emailOTP || user.emailOTP.code !== emailOTP || user.emailOTP.expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      user.emailOTP = undefined;
    }

    const tokens = generateTokenPair(user._id, user.username);

    user.refreshTokens.push({
      token: tokens.refreshToken,
      createdAt: new Date()
    });
    user.lastLogin = new Date();
    user.isOnline = true;
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          publicKey: user.publicKey,
          twoFactorEnabled: user.twoFactorEnabled,
          emailOTPEnabled: user.emailOTPEnabled
        },
        ...tokens
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// Logout user
export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
      user.isOnline = false;
      await user.save();
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
};

// Refresh access token
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);
    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const tokens = generateTokenPair(user._id, user.username);

    user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    user.refreshTokens.push({
      token: tokens.refreshToken,
      createdAt: new Date()
    });
    await user.save();

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token refresh failed',
      error: error.message
    });
  }
};

// Enable 2FA
export const enable2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA already enabled'
      });
    }

    const { secret, otpauthUrl } = generateTOTPSecret(user.username);
    const qrCode = await generateQRCode(otpauthUrl);

    user.twoFactorSecret = secret;
    await user.save();

    res.json({
      success: true,
      message: '2FA secret generated',
      data: {
        secret,
        qrCode
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '2FA setup failed',
      error: error.message
    });
  }
};

// Verify and activate 2FA
export const verify2FA = async (req, res) => {
  try {
    const { token, userId } = req.body;
    const user = await User.findById(userId || req.user.userId);

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: '2FA not set up'
      });
    }

    const isValid = verifyTOTP(user.twoFactorSecret, token);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA token'
      });
    }

    user.twoFactorEnabled = true;
    await user.save();

    res.json({
      success: true,
      message: '2FA enabled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '2FA verification failed',
      error: error.message
    });
  }
};

// Disable 2FA
export const disable2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA not enabled'
      });
    }

    const isValid = verifyTOTP(user.twoFactorSecret, token);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA token'
      });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '2FA disable failed',
      error: error.message
    });
  }
};

// Enable biometric authentication
export const enableBiometric = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { publicKey } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.biometricEnabled = true;
    user.biometricPublicKey = publicKey;
    await user.save();

    res.json({
      success: true,
      message: 'Biometric authentication enabled'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to enable biometric authentication',
      error: error.message
    });
  }
};

// Verify biometric authentication
export const verifyBiometric = async (req, res) => {
  try {
    const { userId, signature } = req.body;
    const user = await User.findById(userId);

    if (!user || !user.biometricEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Biometric authentication not set up'
      });
    }

    // In production, verify the signature against the stored public key
    const tokens = generateTokenPair(user._id, user.username);

    user.refreshTokens.push({
      token: tokens.refreshToken,
      createdAt: new Date()
    });
    user.lastLogin = new Date();
    user.isOnline = true;
    await user.save();

    res.json({
      success: true,
      message: 'Biometric authentication successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        },
        ...tokens
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Biometric verification failed',
      error: error.message
    });
  }
};

// Send email OTP
export const sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.emailOTP = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    };
    user.emailOTPEnabled = true;
    await user.save();

    await emailService.sendOTPEmail(email, otp);

    res.json({
      success: true,
      message: 'OTP sent to email'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
      error: error.message
    });
  }
};

// Verify email OTP
export const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.emailOTP || user.emailOTP.code !== otp || user.emailOTP.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    user.emailOTP = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'OTP verification failed',
      error: error.message
    });
  }
};

// Get user profile
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('-password -twoFactorSecret -privateKeyEncrypted -refreshTokens -emailOTP');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
};

// Request password reset
// Request password reset
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: true,
        message: 'If email exists, OTP has been sent'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.passwordResetOTP = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    };
    await user.save();

    await emailService.sendOTPEmail(email, otp, user.username);

    res.json({
      success: true,
      message: 'OTP sent to email'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send reset OTP',
      error: error.message
    });
  }
};

// Verify password reset OTP
export const verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.passwordResetOTP) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    if (user.passwordResetOTP.code !== otp || user.passwordResetOTP.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = {
      token: resetToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };
    user.passwordResetOTP = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'OTP verified',
      resetToken
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'OTP verification failed'
    });
  }
};

// Reset password with token
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    
    const user = await User.findOne({
      'passwordResetToken.token': resetToken,
      'passwordResetToken.expiresAt': { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Password reset failed'
    });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { username, email, publicKey } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
      user.username = username;
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
      user.email = email;
    }

    if (publicKey) {
      user.publicKey = publicKey;
    }

    await user.save();

    res.json({
      success: true,  
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          publicKey: user.publicKey
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Profile update failed',
      error: error.message
    });
  }
};