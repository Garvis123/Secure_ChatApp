# Real-Time Chat & Profile Fixes

## Issues Fixed

### 1. Socket.io Event Mismatches ✅
**Problem**: Frontend and backend were using different event names and message structures.

**Fixed**:
- ✅ Changed frontend to listen for `new-message` (backend emits this)
- ✅ Fixed `send-message` to use `userId` instead of `senderId`
- ✅ Fixed `join-room` to send `{ roomId, userId }` format
- ✅ Fixed typing events to match backend expectations
- ✅ Improved message handling to properly extract all fields

### 2. Socket Connection Issues ✅
**Problem**: Socket connection wasn't robust and URL might not be configured.

**Fixed**:
- ✅ Added fallback URL (`http://localhost:5000`)
- ✅ Added multiple transport support (websocket, polling)
- ✅ Added reconnection logic with error handling
- ✅ Added comprehensive logging for debugging
- ✅ Added proper cleanup on unmount

### 3. Message Structure ✅
**Problem**: Message data structure didn't match between frontend and backend.

**Fixed**:
- ✅ Properly extract `roomId`, `encryptedContent`, `iv`, `senderId`, `messageId`, `timestamp`
- ✅ Added validation for required fields
- ✅ Improved error handling and logging
- ✅ Proper message ID generation

### 4. Profile Display ✅
**Problem**: Profile might show old/cached data.

**Solution**: 
- Header component already uses `user?.username` dynamically
- If you see "parv", it's likely from localStorage or database
- **To fix**: Clear localStorage or login with correct account

## How to Test Real-Time Chat

### Step 1: Check Socket Connection
1. Open browser console
2. Login to the app
3. Look for: `✅ Socket connected successfully`
4. Check backend terminal: `✅ User connected: [username] ([userId])`

### Step 2: Create/Join a Room
1. Create a room or join an existing one
2. Check console: `Joining room via socket: { roomId: '...', userId: '...' }`
3. Check backend: Room join confirmation

### Step 3: Send Messages
1. Type a message and send
2. Check console: `Message sent via socket: { roomId: '...', userId: '...' }`
3. Check backend: Message saved confirmation

### Step 4: Test Real-Time (Two Users)
1. Open two browser windows/tabs
2. Login with different users in each
3. Both users join the same room
4. Send message from User 1
5. Message should appear instantly in User 2's window
6. Check console: `Received new message via socket: {...}`

## Debugging Steps

### If Socket Won't Connect:
```javascript
// Check in browser console:
localStorage.getItem('token') // Should return a token
```

### If Messages Don't Appear:
1. Check browser console for errors
2. Check backend terminal for errors
3. Verify roomId is valid MongoDB ObjectId (not mock room)
4. Check if both users are in the same room
5. Verify encryption keys are working

### If Profile Shows Wrong Name:
1. Check localStorage:
   ```javascript
   JSON.parse(localStorage.getItem('user'))
   ```
2. If it shows "parv", clear it:
   ```javascript
   localStorage.removeItem('user')
   localStorage.removeItem('token')
   ```
3. Login again with correct credentials

## Environment Setup

Create `frontend/.env`:
```env
VITE_SERVER_URL=http://localhost:5000
VITE_API_URL=/api
```

## Files Modified

1. **frontend/src/context/ChatContext.jsx**:
   - Fixed socket event listeners (`new-message`)
   - Fixed message sending structure
   - Fixed room joining
   - Fixed typing indicators
   - Improved message handling

2. **frontend/src/hooks/useSocket.js**:
   - Improved connection handling
   - Added reconnection logic
   - Added error handling
   - Added connection status logging

## Common Issues & Solutions

### Issue: "Socket connection error"
**Solution**: 
- Check backend is running on port 5000
- Check CORS in `backend/server.js`
- Verify token is valid

### Issue: Messages not appearing in real-time
**Solution**:
- Verify socket is connected (check console)
- Check both users are in same room
- Verify roomId is valid (not mock room like `dm-1`)
- Check backend terminal for errors

### Issue: Profile shows "parv"
**Solution**:
- Clear localStorage: `localStorage.clear()`
- Login again
- Or update profile in database

### Issue: "Authentication token required"
**Solution**:
- Make sure user is logged in
- Check token in localStorage
- Verify token is sent in socket auth

## Testing Checklist

- [ ] Socket connects on login
- [ ] Can join rooms
- [ ] Can send messages
- [ ] Messages appear in real-time for other users
- [ ] Profile shows correct username
- [ ] Typing indicators work
- [ ] Messages are encrypted/decrypted correctly

## Next Steps

1. Test with two different users
2. Create real rooms (not mock)
3. Send messages between users
4. Verify real-time updates work
5. Check profile displays correct user info

