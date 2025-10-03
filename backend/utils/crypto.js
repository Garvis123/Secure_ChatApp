import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Encryption algorithm constants
export const ALGORITHM = 'aes-256-gcm';
export const KEY_LENGTH = 32;
export const IV_LENGTH = 16;
export const SALT_LENGTH = 64;
export const TAG_LENGTH = 16;

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate random encryption key
 */
export function generateKey() {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Generate random IV
 */
export function generateIV() {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Derive key from password using PBKDF2
 */
export function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt data with AES-256-GCM
 */
export function encrypt(text, key) {
  const iv = generateIV();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt data with AES-256-GCM
 */
export function decrypt(encryptedData, key, iv, authTag) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypt file buffer
 */
export function encryptFile(buffer, key) {
  const iv = generateIV();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted.toString('base64'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt file buffer
 */
export function decryptFile(encryptedData, key, iv, authTag) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'base64')), decipher.final()]);
  return decrypted;
}

/**
 * Generate RSA key pair
 */
export function generateRSAKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

/**
 * RSA encrypt/decrypt
 */
export function rsaEncrypt(data, publicKey) {
  const buffer = Buffer.from(data, 'utf8');
  const encrypted = crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    buffer
  );
  return encrypted.toString('base64');
}

export function rsaDecrypt(encryptedData, privateKey) {
  const buffer = Buffer.from(encryptedData, 'base64');
  const decrypted = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    buffer
  );
  return decrypted.toString('utf8');
}

/**
 * HMAC
 */
export function generateHMAC(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifyHMAC(data, signature, secret) {
  const expected = generateHMAC(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

/**
 * Token, hash, salt utilities
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

export function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH);
}

/**
 * Encrypt/decrypt messages with timestamp
 */
export function encryptMessage(message, key) {
  const timestamp = Date.now().toString();
  const dataToEncrypt = JSON.stringify({ message, timestamp });
  return encrypt(dataToEncrypt, key);
}

export function decryptMessage(encryptedData, key, iv, authTag) {
  const decrypted = decrypt(encryptedData, key, iv, authTag);
  const parsed = JSON.parse(decrypted);
  const age = Date.now() - parseInt(parsed.timestamp);
  if (age > 24 * 60 * 60 * 1000) throw new Error('Message expired');
  return parsed.message;
}

/**
 * Placeholder for DH params and ZK proof (implement your logic)
 */
export function generateDHParams() {
  // TODO: implement Diffie-Hellman param generation
  return { p: '...', g: '...' };
}

export function verifyZKProof(proof) {
  // TODO: implement zero-knowledge proof verification
  return true;
}
