# Setup Guide - Secure Chat Platform

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/secure-chat

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Session Configuration
SESSION_SECRET=your-session-secret-key-change-this-in-production

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-app-password
```

4. Start the backend server:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

## Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Features Verification Checklist

### ✅ Core Features Implemented

1. **End-to-End Encryption (E2EE)**
   - ✅ AES-256-GCM encryption
   - ✅ Client-side key generation
   - ✅ Key exchange via Diffie-Hellman
   - Location: `backend/utils/crypto.js`, `frontend/src/utils/crypto.js`

2. **Zero-Knowledge Proofs (ZKP)**
   - ✅ Schnorr signature-based ZKP
   - ✅ Proof generation and verification
   - ✅ Endpoints: `/api/encryption/zkp/generate`, `/api/encryption/zkp/verify`
   - Location: `backend/utils/crypto.js` (generateZKProof, verifyZKProof)

3. **Forward Secrecy**
   - ✅ Session-based key rotation
   - ✅ Key versioning
   - ✅ Automatic key expiration
   - Location: `backend/models/Session.js`, `backend/socket/keyExchange.js`

4. **Self-Destructing Messages**
   - ✅ Timer-based deletion
   - ✅ Read-triggered deletion
   - ✅ MongoDB TTL indexes
   - Location: `backend/models/Message.js`, `frontend/src/components/chat/SelfDestructMessage.jsx`

5. **Steganography**
   - ✅ LSB (Least Significant Bit) image steganography
   - ✅ Message embedding/extraction
   - ✅ Image capacity checking
   - Location: `backend/utils/steganography.js`, `frontend/src/utils/steganography.js`

6. **Two-Factor Authentication**
   - ✅ TOTP (Google Authenticator)
   - ✅ Email OTP
   - ✅ QR code generation
   - Location: `backend/utils/twoFactor.js`

7. **File Encryption & Secure Sharing**
   - ✅ File encryption before upload
   - ✅ Encrypted file storage
   - ✅ Secure download
   - Location: `backend/controllers/fileController.js`, `backend/utils/crypto.js`

8. **Anti-Screenshot Detection**
   - ✅ Keyboard shortcut detection
   - ✅ DevTools detection
   - ✅ Context menu blocking
   - Location: `frontend/src/utils/screenCapture.js`

9. **Decentralized Identity**
   - ✅ RSA key pair generation
   - ✅ Public/private key storage
   - ✅ Digital signatures
   - Location: `backend/models/User.js`, `backend/utils/crypto.js`

10. **Admin Dashboard & Audit Logs**
    - ✅ Dashboard statistics
    - ✅ Audit log viewing
    - ✅ Anomaly detection
    - ✅ User activity monitoring
    - Location: `backend/controllers/adminController.js`, `frontend/src/pages/AdminDashboard.jsx`

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/2fa/enable` - Enable 2FA
- `POST /api/auth/2fa/verify` - Verify 2FA

### Encryption
- `POST /api/encryption/key-exchange/initiate` - Initiate key exchange
- `POST /api/encryption/keys/rotate` - Rotate keys for forward secrecy
- `POST /api/encryption/zkp/generate` - Generate ZKP
- `POST /api/encryption/zkp/verify` - Verify ZKP

### Chat
- `GET /api/chat/rooms` - Get user rooms
- `POST /api/chat/rooms` - Create room
- `GET /api/chat/messages/:roomId` - Get messages
- `POST /api/chat/messages` - Send message

### Files
- `POST /api/file/upload` - Upload encrypted file
- `GET /api/file/download/:fileId` - Download file

### Admin
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/audit-logs` - Get audit logs
- `GET /api/admin/anomalies` - Get detected anomalies
- `GET /api/admin/users/:userId/activity` - User activity

## Testing Features

1. **Test E2EE**: Send a message and verify it's encrypted in database
2. **Test ZKP**: Generate proof and verify it
3. **Test Self-Destruct**: Send message with timer, verify deletion
4. **Test Steganography**: Hide message in image, extract it
5. **Test 2FA**: Enable 2FA, login with TOTP code
6. **Test Admin Dashboard**: Access `/admin` route

## Troubleshooting

1. **MongoDB Connection Error**: Ensure MongoDB is running
2. **Port Already in Use**: Change PORT in `.env`
3. **CORS Errors**: Check FRONTEND_URL in backend `.env`
4. **Email Not Sending**: Configure email credentials in `.env`

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong, random secrets for JWT and session
3. Enable HTTPS
4. Configure proper MongoDB connection string
5. Set up reverse proxy (Nginx)
6. Configure firewall rules

## Optional: Libsodium Support

For enhanced encryption, you can optionally add libsodium:

```bash
cd backend
npm install sodium
```

Then update `backend/utils/crypto.js` to use libsodium for additional encryption algorithms.

