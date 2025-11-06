// src/utils/crypto.js

export const generateAESKey = async () => {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
};

export const generateKeyPair = async () => {
  return await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
};

export const exportKey = async (key) => {
  return await window.crypto.subtle.exportKey('raw', key);
};

export const importAESKey = async (keyData) => {
  return await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

export const encryptMessage = async (message, key) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(message);
  
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedMessage
  );

  return {
    encrypted: encryptedData,
    iv: iv.buffer,
  };
};

export const decryptMessage = async (encryptedData, key, iv) => {
  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
    },
    key,
    new Uint8Array(encryptedData)
  );

  return new TextDecoder().decode(decryptedData);
};

// Optimized Base64 conversion using native methods
export const arrayBufferToBase64 = (buffer) => {
  // Use native btoa with String.fromCharCode for better performance
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // Process in chunks for large buffers
  let binary = '';
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  
  return btoa(binary);
};

export const base64ToArrayBuffer = (base64) => {
  // Optimized base64 to ArrayBuffer
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  
  // Use direct assignment instead of loop for better performance
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  return bytes.buffer;
};