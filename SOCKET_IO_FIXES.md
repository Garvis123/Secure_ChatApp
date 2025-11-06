# Socket.io Real-Time Chat Fixes

## Issues Fixed

### 1. Event Name Mismatches ✅
**Problem**: Frontend and backend were using different event names.

**Fixed**:
- Backend emits `new-message` → Frontend now listens for `new-message` (was `receive-message`)
- Backend expects `send-message` with `userId` → Frontend now sends correct structure
- Backend expects `join-room` with `{ roomId, userId }` → Frontend now sends correct format
- Typing events now match: `typing` and `stop-typing` with correct parameters

### 2. Socket Connection Configuration ✅
**Problem**: Socket connection URL might not be set, and connection wasn't robust.

**Fixed**:
- Added fallback to `http://localhost:5000` if `VITE_SERVER_URL` not set
- Added multiple transport support (websocket, polling)
- Added reconnection logic with proper error handling
- Added connection status logging for debugging
- Added proper cleanup on unmount

### 3. Message Structure Mismatch ✅
**Problem**: Frontend was sending `senderId` but backend expects `userId`.

**Fixed**:
- Changed `senderId` to `userId` in socket emit
- Aligned message structure with backend expectations
- Added console logs for debugging

### 4. Room Joining ✅
**Problem**: Room join events weren't being sent correctly.

**Fixed**:
- Added proper `join-room` event with `{ roomId, userId }`
- Only sends for real rooms (not mock rooms)
- Added logging for debugging

## How to Test Socket.io Connection

### 1. Check Browser Console
Look for these messages:
- `Connecting to socket server: http://localhost:5000`
- `✅ Socket connected successfully`
- `✅ User connected: [username] ([userId])` (in backend terminal)

### 2. Test Message Sending
1. Open two browser windows/tabs
2. Login with different users
3. Create or join the same room
4. Send a message from one window
5. Check if it appears in the other window

### 3. Check Backend Terminal
You should see:
- `✅ User connected: [username] ([userId])`
- Message save confirmations
- Room join notifications

### 4. Debug Steps
If messages aren't appearing:

1. **Check Socket Connection**:
   ```javascript
   // In browser console
   // Should see: "✅ Socket connected successfully"
   ```

2. **Check Room Join**:
   ```javascript
   // In browser console
   // Should see: "Joining room via socket: { roomId: '...', userId: '...' }"
   ```

3. **Check Message Send**:
   ```javascript
   // In browser console
   // Should see: "Message sent via socket: { roomId: '...', userId: '...' }"
   ```

4. **Check Message Receive**:
   ```javascript
   // In browser console
   // Should see: "Received new message via socket: {...}"
   ```

## Environment Variables

Make sure you have in `frontend/.env`:
```env
VITE_SERVER_URL=http://localhost:5000
VITE_API_URL=/api
```

## Common Issues

### Issue: "Socket connection error"
**Solution**: 
- Check if backend is running on port 5000
- Check CORS settings in `backend/server.js`
- Check if token is valid

### Issue: Messages not appearing
**Solution**:
- Check browser console for errors
- Verify both users are in the same room
- Check backend terminal for errors
- Verify roomId is a valid MongoDB ObjectId (not mock room)

### Issue: "Authentication token required"
**Solution**:
- Make sure user is logged in
- Check if token exists in localStorage
- Verify token is being sent in socket auth

## Files Modified

1. `frontend/src/context/ChatContext.jsx`:
   - Fixed socket event listeners
   - Fixed message sending structure
   - Fixed room joining
   - Fixed typing indicators

2. `frontend/src/hooks/useSocket.js`:
   - Improved connection handling
   - Added reconnection logic
   - Added error handling
   - Added connection status logging

## Next Steps

1. Test with two different users
2. Create a real room (not mock)
3. Send messages between users
4. Verify real-time updates work

