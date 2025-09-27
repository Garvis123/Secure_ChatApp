// Client-side encryption utilities
export class CryptoUtils {
  static async generateKeyPair() {
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
  }

  static async generateAESKey() {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async encryptMessage(message, key) {
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
      encrypted: Array.from(new Uint8Array(encryptedData)),
      iv: Array.from(iv),
    };
  }

  static async decryptMessage(encryptedData, key, iv) {
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      key,
      new Uint8Array(encryptedData)
    );

    return new TextDecoder().decode(decryptedData);
  }
}