import sharp from 'sharp';
import crypto from 'crypto';

/**
 * Hide text message in image using LSB steganography
 */
async function hideMessageInImage(imageBuffer, message, password = null) {
  try {
    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // Convert to raw pixel data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Encrypt message if password provided
    let dataToHide = message;
    if (password) {
      const key = crypto.pbkdf2Sync(password, 'salt', 100000, 32, 'sha512');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      dataToHide = `ENC:${iv.toString('hex')}:${encrypted}`;
    }
    
    // Convert message to binary
    const messageBinary = textToBinary(dataToHide);
    
    // Add length header (32 bits for message length)
    const lengthBinary = (messageBinary.length).toString(2).padStart(32, '0');
    const fullBinary = lengthBinary + messageBinary;
    
    // Check if image has enough capacity
    const maxCapacity = (data.length / info.channels) * 3; // 3 bits per pixel (RGB)
    if (fullBinary.length > maxCapacity) {
      throw new Error('Message too large for this image');
    }
    
    // Hide data in image pixels (LSB)
    let binaryIndex = 0;
    for (let i = 0; i < data.length && binaryIndex < fullBinary.length; i++) {
      // Skip alpha channel
      if (info.channels === 4 && (i + 1) % 4 === 0) continue;
      
      // Modify least significant bit
      const bit = parseInt(fullBinary[binaryIndex]);
      data[i] = (data[i] & 0xFE) | bit;
      binaryIndex++;
    }
    
    // Create new image with hidden message
    const outputImage = await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels
      }
    })
    .png()
    .toBuffer();
    
    return {
      success: true,
      image: outputImage,
      capacity: maxCapacity,
      used: fullBinary.length,
      encrypted: password !== null
    };
    
  } catch (error) {
    console.error('Hide message error:', error);
    throw new Error('Failed to hide message in image');
  }
}

/**
 * Extract hidden message from image
 */
export async function extractMessageFromImage(imageBuffer, password = null) {
  try {
    const image = sharp(imageBuffer);
    
    // Convert to raw pixel data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Extract length header (first 32 bits)
    let binary = '';
    let pixelIndex = 0;
    
    // Get message length
    for (let i = 0; i < 32; i++) {
      // Skip alpha channel
      while (info.channels === 4 && (pixelIndex + 1) % 4 === 0) {
        pixelIndex++;
      }
      binary += (data[pixelIndex] & 1).toString();
      pixelIndex++;
    }
    
    const messageLength = parseInt(binary, 2);
    
    if (messageLength === 0 || messageLength > data.length * 8) {
      throw new Error('No hidden message found or corrupted data');
    }
    
    // Extract message bits
    binary = '';
    for (let i = 0; i < messageLength; i++) {
      // Skip alpha channel
      while (info.channels === 4 && (pixelIndex + 1) % 4 === 0) {
        pixelIndex++;
      }
      binary += (data[pixelIndex] & 1).toString();
      pixelIndex++;
    }
    
    // Convert binary to text
    let message = binaryToText(binary);
    
    // Check if message is encrypted
    if (message.startsWith('ENC:')) {
      if (!password) {
        throw new Error('Message is encrypted. Password required.');
      }
      
      const parts = message.split(':');
      const iv = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const key = crypto.pbkdf2Sync(password, 'salt', 100000, 32, 'sha512');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      message = decrypted;
    }
    
    return {
      success: true,
      message,
      encrypted: message.startsWith('ENC:')
    };
    
  } catch (error) {
    console.error('Extract message error:', error);
    throw new Error('Failed to extract message from image');
  }
}

/**
 * Check image capacity for steganography
 */
// Keep this one (or whichever is correct)
export async function checkImageCapacity(imageBuffer) {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const { info } = await image.raw().toBuffer({ resolveWithObject: true });
  const totalPixels = info.width * info.height;
  const channels = info.channels === 4 ? 3 : info.channels;
  const capacityBits = totalPixels * channels;
  const capacityBytes = Math.floor(capacityBits / 8);
  const capacityChars = capacityBytes;
  const usableCapacity = capacityChars - 4;
  return {
    width: info.width,
    height: info.height,
    channels: info.channels,
    totalPixels,
    capacityBits,
    capacityBytes,
    capacityChars: usableCapacity,
    capacityKB: (usableCapacity / 1024).toFixed(2)
  };
}


/**
 * Validate image for steganography
 */


/**
 * Convert text to binary string
 */
function textToBinary(text) {
  return text
    .split('')
    .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
}

/**
 * Convert binary string to text
 */
function binaryToText(binary) {
  const bytes = binary.match(/.{8}/g) || [];
  return bytes
    .map(byte => String.fromCharCode(parseInt(byte, 2)))
    .join('');
}

/**
 * Generate steganography key
 */
export function generateStegKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Optimize image for steganography
 */
export async function optimizeImageForSteg(imageBuffer) {
  try {
    // Convert to PNG (lossless) and ensure RGB
    const optimized = await sharp(imageBuffer)
      .png({ compressionLevel: 0 }) // No compression for better LSB preservation
      .toBuffer();
    
    return optimized;
    
  } catch (error) {
    console.error('Optimize image error:', error);
    throw new Error('Failed to optimize image');
  }
}

// Alias to match controller import name
export async function embedMessageInImage(imageBuffer, message, password = null) {
  const result = await hideMessageInImage(imageBuffer, message, password);
  return result.image || result; // maintain previous return usage
}



export async function validateImage(imageBuffer) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const validFormats = ['jpeg', 'jpg', 'png', 'webp', 'bmp'];
    const minDimension = 100;
    const maxSize = 10 * 1024 * 1024; // 10MB
    const errors = [];

    if (!validFormats.includes(metadata.format.toLowerCase())) {
      errors.push('Invalid format. Supported: JPEG, PNG, WebP, BMP');
    }

    if (metadata.width < minDimension || metadata.height < minDimension) {
      errors.push(`Image too small. Minimum dimensions: ${minDimension}x${minDimension}px`);
    }

    if (imageBuffer.length > maxSize) {
      errors.push('Image too large. Maximum size: 10MB');
    }

    return {
      valid: errors.length === 0,
      errors,
      metadata: {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: imageBuffer.length
      }
    };
  } catch (error) {
    console.error('Validate image error:', error);
    return { valid: false, errors: ['Invalid or corrupted image file'] };
  }
}


export default {
  embedMessageInImage,
  extractMessageFromImage,
  checkImageCapacity,  // only the single declaration
  validateImage,
  generateStegKey,
  optimizeImageForSteg
};
