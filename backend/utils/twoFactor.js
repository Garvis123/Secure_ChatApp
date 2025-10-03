import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * Generate 2FA secret for user
 */
async function generateSecret(username, appName = 'Secure Chat Platform') {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${username})`,
    length: 32,
    issuer: appName
  });
  
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url
  };
}

/**
 * Generate QR code for 2FA setup
 */
export async function generateQRCode(otpauthUrl) {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return qrCodeDataUrl;
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify TOTP token
 */
function verifyToken(secret, token) {
  try {
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps before/after for clock drift
    });
    
    return verified;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

/**
 * Generate backup codes
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = speakeasy.generateSecret({ length: 10 }).base32.substring(0, 8);
    codes.push(code);
  }
  return codes;
}

/**
 * Verify backup code
 */
function verifyBackupCode(backupCodes, code) {
  const index = backupCodes.findIndex(c => c === code.toUpperCase());
  
  if (index === -1) {
    return { valid: false, message: 'Invalid backup code' };
  }
  
  // Remove used backup code
  backupCodes.splice(index, 1);
  
  return {
    valid: true,
    message: 'Backup code verified',
    remainingCodes: backupCodes.length,
    updatedCodes: backupCodes
  };
}

/**
 * Generate current TOTP token (for testing)
 */
function generateToken(secret) {
  return speakeasy.totp({
    secret: secret,
    encoding: 'base32'
  });
}

/**
 * Setup 2FA for user
 */
async function setup2FA(username) {
  try {
    const { secret, otpauthUrl } = await generateSecret(username);
    const qrCode = await generateQRCode(otpauthUrl);
    const backupCodes = generateBackupCodes();
    
    return {
      secret,
      qrCode,
      backupCodes,
      otpauthUrl
    };
  } catch (error) {
    console.error('2FA setup error:', error);
    throw new Error('Failed to setup 2FA');
  }
}

/**
 * Validate 2FA token with enhanced security
 */
function validate2FAToken(secret, token, options = {}) {
  const {
    allowPreviousToken = true,
    maxAttempts = 5,
    lockoutDuration = 15 * 60 * 1000 // 15 minutes
  } = options;
  
  // Verify token format
  if (!/^\d{6}$/.test(token)) {
    return {
      valid: false,
      message: 'Invalid token format. Must be 6 digits.'
    };
  }
  
  // Verify TOTP token
  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: allowPreviousToken ? 1 : 0
  });
  
  return {
    valid: verified,
    message: verified ? 'Token verified successfully' : 'Invalid token'
  };
}

/**
 * Check if 2FA is required for user
 */
function require2FA(user) {
  return user.twoFactorEnabled === true && user.twoFactorSecret;
}

/**
 * Disable 2FA for user
 */
function disable2FA() {
  return {
    twoFactorEnabled: false,
    twoFactorSecret: null,
    backupCodes: []
  };
}

/**
 * Get remaining time until token changes
 */
function getTokenTimeRemaining() {
  const epoch = Math.round(new Date().getTime() / 1000.0);
  const countDown = 30 - (epoch % 30);
  return countDown;
}

/**
 * Format backup codes for display
 */
function formatBackupCodes(codes) {
  return codes.map((code, index) => ({
    id: index + 1,
    code: code.match(/.{1,4}/g).join('-'), // Format as XXXX-XXXX
    used: false
  }));
}

// Aliases to match controller imports
export const generateTOTPSecret = generateSecret;
export const verifyTOTP = verifyToken;
export {
  generateSecret,
  verifyToken,
  generateBackupCodes,
  verifyBackupCode,
  generateToken,
  setup2FA,
  validate2FAToken,
  require2FA,
  disable2FA,
  getTokenTimeRemaining,
  formatBackupCodes
};