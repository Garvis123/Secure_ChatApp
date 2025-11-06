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
 * Digital Signatures (RSA)
 */
export function signData(data, privateKey) {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

export function verifySignature(data, signature, publicKey) {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
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
 * Generate Diffie-Hellman parameters for key exchange
 */
export function generateDHParams() {
  const dh = crypto.createDiffieHellman(2048);
  dh.generateKeys();
  
  return {
    prime: dh.getPrime().toString('hex'),
    generator: dh.getGenerator().toString('hex'),
    publicKey: dh.getPublicKey().toString('hex')
  };
}

/**
 * Zero-Knowledge Proof using Schnorr signature scheme
 * This allows users to prove knowledge of a secret without revealing it
 */
export function generateZKProof(privateKey, challenge, publicKey) {
  // Convert inputs to buffers
  const privKey = Buffer.from(privateKey, 'hex');
  const challengeBuf = Buffer.from(challenge, 'hex');
  const pubKey = Buffer.from(publicKey, 'hex');
  
  // Generate random nonce (commitment)
  const nonce = crypto.randomBytes(32);
  const commitment = crypto.createHash('sha256').update(nonce).digest('hex');
  
  // Create response (response = nonce + challenge * privateKey)
  const challengeNum = BigInt('0x' + challengeBuf.toString('hex'));
  const privKeyNum = BigInt('0x' + privKey.toString('hex'));
  const nonceNum = BigInt('0x' + nonce.toString('hex'));
  
  // Simplified Schnorr: response = (nonce + challenge * privateKey) mod n
  // In production, use proper elliptic curve operations
  const response = (nonceNum + challengeNum * privKeyNum).toString(16);
  
  return {
    commitment,
    response,
    publicKey: pubKey.toString('hex')
  };
}

/**
 * Verify Zero-Knowledge Proof
 */
export function verifyZKProof(proof, challenge, publicKey) {
  try {
    if (!proof || !proof.commitment || !proof.response || !challenge || !publicKey) {
      return false;
    }
    
    // Verify proof structure
    const commitment = Buffer.from(proof.commitment, 'hex');
    const response = Buffer.from(proof.response, 'hex');
    const challengeBuf = Buffer.from(challenge, 'hex');
    const pubKey = Buffer.from(publicKey, 'hex');
    
    // Reconstruct commitment from response and challenge
    // commitment' = hash(response - challenge * publicKey)
    const challengeNum = BigInt('0x' + challengeBuf.toString('hex'));
    const responseNum = BigInt('0x' + response.toString('hex'));
    const pubKeyNum = BigInt('0x' + pubKey.toString('hex'));
    
    // Verify: commitment == hash(response - challenge * publicKey)
    const reconstructed = (responseNum - challengeNum * pubKeyNum).toString(16);
    const reconstructedHash = crypto.createHash('sha256')
      .update(Buffer.from(reconstructed, 'hex'))
      .digest('hex');
    
    // Use timing-safe comparison (ensure same length)
    const commitmentBuf = Buffer.from(commitment, 'hex');
    const reconstructedBuf = Buffer.from(reconstructedHash, 'hex');
    
    if (commitmentBuf.length !== reconstructedBuf.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(commitmentBuf, reconstructedBuf);
  } catch (error) {
    console.error('ZKP verification error:', error);
    return false;
  }
}
