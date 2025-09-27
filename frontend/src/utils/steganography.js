/**
 * Steganography utility functions for hiding and extracting messages in images
 */

/**
 * Hide a text message in an image using LSB steganography
 * @param {HTMLCanvasElement} canvas - Canvas element with the image
 * @param {string} message - Message to hide
 * @returns {string} - Data URL of the modified image
 */
export const hideMessageInImage = (canvas, message) => {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Convert message to binary with delimiter
  const delimiter = '1111111111111110'; // 16-bit delimiter
  const binaryMessage = stringToBinary(message) + delimiter;
  
  let messageIndex = 0;
  
  // Hide message in LSB of red channel
  for (let i = 0; i < data.length && messageIndex < binaryMessage.length; i += 4) {
    if (messageIndex < binaryMessage.length) {
      // Modify LSB of red channel
      data[i] = (data[i] & 0xFE) | parseInt(binaryMessage[messageIndex]);
      messageIndex++;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * Extract hidden message from an image
 * @param {HTMLCanvasElement} canvas - Canvas element with the image
 * @returns {string} - Extracted message or empty string if no message found
 */
export const extractMessageFromImage = (canvas) => {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let binaryMessage = '';
  const delimiter = '1111111111111110';
  
  // Extract LSB from red channel
  for (let i = 0; i < data.length; i += 4) {
    binaryMessage += (data[i] & 1).toString();
    
    // Check for delimiter
    if (binaryMessage.length >= delimiter.length) {
      const lastBits = binaryMessage.slice(-delimiter.length);
      if (lastBits === delimiter) {
        // Found delimiter, extract message
        const messageBits = binaryMessage.slice(0, -delimiter.length);
        return binaryToString(messageBits);
      }
    }
    
    // Prevent infinite loop
    if (binaryMessage.length > data.length / 4) {
      break;
    }
  }
  
  return '';
};

/**
 * Convert string to binary representation
 * @param {string} str - Input string
 * @returns {string} - Binary representation
 */
const stringToBinary = (str) => {
  return str.split('').map(char => {
    const binary = char.charCodeAt(0).toString(2);
    return binary.padStart(8, '0');
  }).join('');
};

/**
 * Convert binary representation to string
 * @param {string} binary - Binary string
 * @returns {string} - Decoded string
 */
const binaryToString = (binary) => {
  const chunks = binary.match(/.{8}/g) || [];
  return chunks.map(chunk => {
    const charCode = parseInt(chunk, 2);
    return charCode > 0 && charCode < 256 ? String.fromCharCode(charCode) : '';
  }).join('');
};

/**
 * Check if an image can hold a message of given length
 * @param {number} imageWidth - Image width
 * @param {number} imageHeight - Image height
 * @param {string} message - Message to hide
 * @returns {boolean} - Whether image can hold the message
 */
export const canImageHoldMessage = (imageWidth, imageHeight, message) => {
  const totalPixels = imageWidth * imageHeight;
  const binaryMessage = stringToBinary(message);
  const requiredBits = binaryMessage.length + 16; // +16 for delimiter
  
  return totalPixels >= requiredBits;
};

/**
 * Load image from file and return canvas
 * @param {File} file - Image file
 * @returns {Promise<HTMLCanvasElement>} - Canvas with loaded image
 */
export const loadImageToCanvas = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};