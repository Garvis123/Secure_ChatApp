// server/routes/auth.js
import express from 'express';
import passport from '../config/passport.js';
import { generateTokenPair } from '../config/jwt.js';
import {
  register,
  login,
  logout,
  refreshToken,
  enable2FA,
  verify2FA,
  disable2FA,
  sendEmailOTP,
  verifyEmailOTP,
  getProfile,
  updateProfile,
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPassword,
  searchUsers
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/send-email-otp', sendEmailOTP);
router.post('/verify-email-otp', verifyEmailOTP);
router.post('/request-password-reset', requestPasswordReset);
router.post('/verify-reset-otp', verifyPasswordResetOTP);
router.post('/reset-password', resetPassword);

// Protected routes
router.post('/logout', authenticateToken, logout);
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.get('/search-users', authenticateToken, searchUsers);

// 2FA routes
router.post('/2fa/enable', authenticateToken, enable2FA);
router.post('/2fa/verify', verify2FA);
router.post('/2fa/disable', authenticateToken, disable2FA);

// Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const tokens = generateTokenPair(req.user._id, req.user.username);
      
      req.user.refreshTokens.push({
        token: tokens.refreshToken,
        createdAt: new Date()
      });
      req.user.lastLogin = new Date();
      req.user.isOnline = true;
      await req.user.save();

      // Redirect to frontend with token
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
    } catch (error) {
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`);
    }
  }
);

export default router;
