import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from '../hooks/useSocket';
import * as CryptoUtils from '../utils/crypto';
import { getApiUrl } from '../config/api';

// Create the context
const ChatContext = createContext();

// Initial state
const initialState = {
  rooms: [],
  messages: {},
  activeRoom: null,
  typingUsers: {},
  roomKeys: {}, // Store encryption keys for each room
  encryptionStatus: {}
};

// Reducer
const chatReducer = (state, action) => {
  switch (action.type) {
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload };
    case 'SET_MESSAGES':
      return { 
        ...state, 
        messages: { ...state.messages, [action.roomId]: action.payload } 
      };
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.roomId]: [...(state.messages[action.roomId] || []), action.payload]
        }
      };
    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.roomId]: (state.messages[action.roomId] || []).filter(
            msg => msg.id !== action.messageId
          )
        }
      };
    case 'SET_ACTIVE_ROOM':
      return { ...state, activeRoom: action.payload };
    case 'SET_TYPING_USER':
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.roomId]: action.userId
        }
      };
    case 'CLEAR_TYPING_USER':
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.roomId]: null
        }
      };
    case 'SET_ROOM_KEY':
      return {
        ...state,
        roomKeys: {
          ...state.roomKeys,
          [action.payload.roomId]: action.payload.key
        },
        encryptionStatus: {
          ...state.encryptionStatus,
          [action.payload.roomId]: { enabled: true }
        }
      };
    default:
      return state;
  }
};

// Export the hook separately
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();
  
  // Cache for imported CryptoKey objects to avoid repeated imports (performance optimization)
  const keyCacheRef = useRef(new Map());


  // Initialize socket listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for incoming messages (backend emits 'new-message')
    socket.on('new-message', (messageData) => {
      console.log('Received new message via socket:', messageData);
      // Handle async function properly to avoid unhandled promise rejections
      handleIncomingMessage(messageData).catch((error) => {
        console.error('Error handling incoming message:', error);
      });
    });

    // Listen for typing indicators
    socket.on('user-typing', ({ roomId, userId, username }) => {
      dispatch({ type: 'SET_TYPING_USER', roomId, userId });
    });

    socket.on('user-stop-typing', ({ roomId, userId }) => {
      dispatch({ type: 'CLEAR_TYPING_USER', roomId });
    });

    // Listen for room updates
    socket.on('room-joined', (roomData) => {
      console.log('Room joined:', roomData);
    });

    socket.on('user-joined', (data) => {
      console.log('User joined room:', data);
    });

    socket.on('user-left', (data) => {
      console.log('User left room:', data);
    });

    // Listen for errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Listen for connection status
    socket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    return () => {
      socket.off('new-message');
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('room-joined');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('error');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket]);

  // Handle incoming encrypted messages
  const handleIncomingMessage = async (messageData) => {
    try {
      const { roomId, encryptedContent, iv, senderId, messageId, timestamp, ...rest } = messageData;
      
      if (!roomId || !encryptedContent || !iv) {
        console.error('Invalid message data received:', messageData);
        return;
      }
      
      // Get room key (cached for performance)
      const roomKey = await getRoomKey(roomId);
      
      // Convert base64 to ArrayBuffer
      const encryptedBuffer = CryptoUtils.base64ToArrayBuffer(encryptedContent);
      const ivBuffer = CryptoUtils.base64ToArrayBuffer(iv);
      
      // Decrypt the message
      const decryptedContent = await CryptoUtils.decryptMessage(
        encryptedBuffer,
        roomKey,
        ivBuffer
      );

      const message = {
        id: messageId || messageData.messageId || `msg-${Date.now()}`,
        roomId,
        senderId: senderId || messageData.senderId,
        senderName: messageData.senderUsername || rest.senderName || 'Unknown',
        content: decryptedContent,
        type: rest.type || messageData.type || 'text',
        fileMetadata: rest.fileMetadata || messageData.fileMetadata,
        steganographyEnabled: rest.steganographyEnabled || messageData.steganographyEnabled || false,
        selfDestruct: rest.selfDestruct || messageData.selfDestruct,
        encryptedContent, // Keep for reference
        iv, // Keep for reference
        timestamp: timestamp || messageData.timestamp || new Date().toISOString(),
        ...rest
      };

      console.log('Adding message to room:', roomId, message);

      dispatch({ 
        type: 'ADD_MESSAGE', 
        roomId, 
        payload: message 
      });

    } catch (error) {
      console.error('Failed to handle incoming message:', error);
      console.error('Message data:', messageData);
    }
  };

  // Room management
  const createRoom = async (participantIds, roomName = 'New Room') => {
    try {
      if (!participantIds || participantIds.length === 0) {
        throw new Error('At least one participant is required');
      }

      // Generate encryption key
      const roomKey = await CryptoUtils.generateAESKey();
      const exportedKey = await CryptoUtils.exportKey(roomKey);
      const keyBase64 = CryptoUtils.arrayBufferToBase64(exportedKey);

      const response = await fetch(getApiUrl('/api/chat/rooms'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: roomName,
          type: participantIds.length > 1 ? 'group' : 'direct',
          participantIds,
          encryptionKey: keyBase64
        })
      });
      
      if (response.status === 401) {
        throw new Error('Authentication required');
      }
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create room');
      }

      if (data.success && data.data.room) {
        const newRoom = {
          ...data.data.room,
          id: data.data.room.id || data.data.room._id,
          name: data.data.room.name || 'New Room',
          type: data.data.room.type || 'direct',
          participants: data.data.room.participants || []
        };
        
        // Store encryption key
        dispatch({ 
          type: 'SET_ROOM_KEY', 
          payload: { roomId: newRoom.id, key: keyBase64 } 
        });

        // Add room to list (avoid duplicates)
        const roomExists = state.rooms.some(r => (r.id || r._id) === newRoom.id);
        if (!roomExists) {
          dispatch({ type: 'SET_ROOMS', payload: [...state.rooms, newRoom] });
        }
        
        // Join the room
        joinRoom(newRoom.id);
        
        return newRoom;
      } else {
        throw new Error(data.message || 'Failed to create room');
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      throw error;
    }
  };

  // Add participant to existing room
  const addParticipantToRoom = async (roomId, participantId) => {
    try {
      // Simple validation - check if IDs are strings and not empty
      if (!roomId || !participantId || typeof roomId !== 'string' || typeof participantId !== 'string') {
        throw new Error('Invalid room or user ID');
      }

      // Get user data to include username and publicKey
      const authToken = localStorage.getItem('token');
      const userResponse = await fetch(
        `/api/auth/search-users?query=${encodeURIComponent(participantId)}`,
        {
          headers: getAuthHeaders()
        }
      );

      let userData = null;
      if (userResponse.ok) {
        const userDataResponse = await userResponse.json();
        if (userDataResponse.success && userDataResponse.data.users.length > 0) {
          userData = userDataResponse.data.users[0];
        }
      }

      // If user not found by search, try using participantId directly as user ID
      if (!userData) {
        // Assume participantId is already a user ID - fetch user directly
        try {
          const directUserResponse = await fetch(`/api/auth/profile`, {
            headers: getAuthHeaders()
          });
          // This won't work for other users, so we'll just use basic data
          userData = { id: participantId, username: 'User', publicKey: null };
        } catch {
          userData = { id: participantId, username: 'User', publicKey: null };
        }
      }

      const response = await fetch(getApiUrl(`/api/chat/rooms/${roomId}/participants`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: participantId,
          username: userData?.username || 'User',
          publicKey: userData?.publicKey || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add participant');
      }

      const data = await response.json();
      if (data.success) {
        // Reload rooms to get updated participant list
        await loadRooms();
        return data.data;
      }
    } catch (error) {
      console.error('Failed to add participant:', error);
      throw error;
    }
  };

  const joinRoom = (roomId) => {
    dispatch({ type: 'SET_ACTIVE_ROOM', payload: roomId });
    if (socket && user && !roomId.startsWith('dm-') && !roomId.startsWith('room-')) {
      // Get user ID (handle both id and _id)
      const userId = user.id || user._id || user.userId;
      if (!userId) {
        console.error('User ID not available for joining room');
        loadMessages(roomId);
        return;
      }

      // Backend expects: { roomId }
      // Note: Backend will use socket.userId from authentication
      socket.emit('join-room', { roomId });
      console.log('Joining room via socket:', { roomId, userId });
    }
    loadMessages(roomId);
  };

  const setTyping = (roomId, isTyping) => {
    if (socket && user && !roomId.startsWith('dm-') && !roomId.startsWith('room-')) {
      // Get user ID and username
      const userId = user.id || user._id || user.userId;
      const username = user.username || user.name || 'User';
      
      if (!userId) {
        console.error('User ID not available for typing indicator');
        return;
      }

      // Backend expects: { roomId, username }
      // Note: Backend will use socket.userId from authentication
      if (isTyping) {
        socket.emit('typing', { roomId, username });
      } else {
        socket.emit('stop-typing', { roomId });
      }
    }
  };

  const sendMessage = async (roomId, message, options = {}) => {
    try {
      if (!message.trim()) return;

      // Skip sending to API for mock/test room IDs
      const isMockRoom = !roomId || roomId.startsWith('dm-') || roomId.startsWith('room-');
      
      // Get room key (now cached for performance)
      const roomKey = await getRoomKey(roomId);
      
      // Encrypt message (optimized)
      const encrypted = await CryptoUtils.encryptMessage(message, roomKey);
      
      // Convert to base64 (synchronous operations, no need for Promise.all)
      const encryptedBase64 = CryptoUtils.arrayBufferToBase64(encrypted.encrypted);
      const ivBase64 = CryptoUtils.arrayBufferToBase64(encrypted.iv);
      
      // Get user ID (handle both id and _id)
      const userId = user.id || user._id || user.userId;
      const username = user.username || user.name || 'User';

      if (!userId) {
        console.error('User ID not available for sending message');
        return;
      }

      const messageData = {
        roomId,
        senderId: userId,
        senderName: username,
        encryptedContent: encryptedBase64,
        iv: ivBase64,
        type: options.type || 'text',
        metadata: {
          selfDestruct: options.selfDestruct ? {
            enabled: true,
            timer: options.selfDestruct
          } : { enabled: false },
          fileMetadata: options.fileMetadata,
          steganographyEnabled: options.steganographyEnabled || false,
          timestamp: Date.now()
        }
      };

      // Send via WebSocket (if available)
      if (socket && !isMockRoom && user) {
        // Backend expects: { roomId, encryptedContent, iv, type, metadata }
        // Note: Backend will use socket.userId from authentication, so we don't need to send userId
        socket.emit('send-message', {
          roomId,
          encryptedContent: encryptedBase64,
          iv: ivBase64,
          type: options.type || 'text',
          metadata: {
            selfDestruct: options.selfDestruct ? {
              enabled: true,
              timer: options.selfDestruct
            } : { enabled: false },
            fileMetadata: options.fileMetadata,
            steganographyEnabled: options.steganographyEnabled || false,
            timestamp: Date.now()
          }
        });
        console.log('Message sent via socket:', { roomId, userId });
      }

      // Only send to API for real rooms (not mock rooms)
      if (!isMockRoom) {
        try {
          const response = await fetch(getApiUrl(`/api/chat/rooms/${roomId}/messages`), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(messageData)
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.warn('Failed to save message to API:', errorData.message);
          }
        } catch (apiError) {
          console.error('Failed to save message to API:', apiError);
        }
      } else {
        // Mock room - skip API call (expected behavior for test/mock rooms)
        // Using debug instead of warn to reduce console noise
        if (process.env.NODE_ENV === 'development') {
          console.debug('Skipping API call for mock room:', roomId);
        }
      }

      // Optimistic update
      const localMessage = {
        id: `local-${Date.now()}`,
        ...messageData,
        content: message,
        timestamp: new Date().toISOString(),
        isLocal: true,
        status: 'sent'
      };

      dispatch({ 
        type: 'ADD_MESSAGE', 
        roomId, 
        payload: localMessage 
      });

      if (options.selfDestruct) {
        setTimeout(() => {
          dispatch({ type: 'REMOVE_MESSAGE', roomId, messageId: localMessage.id });
        }, options.selfDestruct * 1000);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const getRoomKey = async (roomId) => {
    try {
      // Check cache first (fastest path - no async operations)
      if (keyCacheRef.current.has(roomId)) {
        return keyCacheRef.current.get(roomId);
      }

      // Skip for mock/test room IDs - generate a temporary key
      if (!roomId || roomId.startsWith('dm-') || roomId.startsWith('room-')) {
        // Use cached mock key if available
        const mockKeyId = `mock-${roomId}`;
        if (keyCacheRef.current.has(mockKeyId)) {
          return keyCacheRef.current.get(mockKeyId);
        }
        // Mock room - generate temporary key (expected behavior)
        if (process.env.NODE_ENV === 'development') {
          console.debug('Using temporary key for mock room:', roomId);
        }
        const tempKey = await CryptoUtils.generateAESKey();
        keyCacheRef.current.set(mockKeyId, tempKey);
        return tempKey;
      }

      // Check state for key data (base64 string)
      if (state.roomKeys[roomId]) {
        const keyData = CryptoUtils.base64ToArrayBuffer(state.roomKeys[roomId]);
        const importedKey = await CryptoUtils.importAESKey(keyData);
        keyCacheRef.current.set(roomId, importedKey); // Cache the imported key
        return importedKey;
      }
      
      // Try to fetch key from server
      try {
        const response = await fetch(getApiUrl(`/api/chat/rooms/${roomId}`), {
          headers: getAuthHeaders()
        });
        
        if (response.status === 400 || response.status === 404) {
          // Invalid room ID, generate temporary key
          const tempKey = await CryptoUtils.generateAESKey();
          keyCacheRef.current.set(roomId, tempKey);
          return tempKey;
        }
        
        if (response.ok) {
          const data = await response.json();
          const roomKey = data.data?.room?.encryptionKey || data.data?.room?.groupKey;
          if (data.success && roomKey) {
            dispatch({ 
              type: 'SET_ROOM_KEY', 
              payload: { roomId, key: roomKey } 
            });
            const keyData = CryptoUtils.base64ToArrayBuffer(roomKey);
            const importedKey = await CryptoUtils.importAESKey(keyData);
            keyCacheRef.current.set(roomId, importedKey); // Cache the imported key
            return importedKey;
          }
        }
      } catch (fetchError) {
        console.log('No room key found on server, generating new one');
      }
      
      // Generate new key as fallback
      const newKey = await CryptoUtils.generateAESKey();
      const exportedKey = await CryptoUtils.exportKey(newKey);
      const keyBase64 = CryptoUtils.arrayBufferToBase64(exportedKey);
      
      dispatch({ 
        type: 'SET_ROOM_KEY', 
        payload: { roomId, key: keyBase64 } 
      });
      
      keyCacheRef.current.set(roomId, newKey); // Cache the new key
      return newKey;
    } catch (error) {
      console.error('Failed to get room key:', error);
      throw error;
    }
  };

  const loadRooms = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token available');
        return;
      }

      const response = await fetch(getApiUrl('/api/chat/rooms'), {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401 || response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Authentication failed:', errorData.message || 'Invalid or expired token');
        // Clear invalid token
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        // Redirect to login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to load rooms: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.data.rooms) {
        // Normalize room IDs (handle both _id and id)
        const normalizedRooms = data.data.rooms.map(room => ({
          ...room,
          id: room.id || room._id,
          name: room.name || 'Unnamed Room',
          type: room.type || 'direct',
          participants: room.participants || []
        }));
        
        dispatch({ type: 'SET_ROOMS', payload: normalizedRooms });
        
        // Store encryption keys if available
        normalizedRooms.forEach(room => {
          const roomKey = room.encryptionKey || room.groupKey;
          if (roomKey) {
            dispatch({ 
              type: 'SET_ROOM_KEY', 
              payload: { roomId: room.id, key: roomKey } 
            });
          }
        });
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  };

  // Track if initial load has been done to prevent duplicate loads
  const hasLoadedRef = useRef(false);

  // Load rooms and restore active room on mount
  useEffect(() => {
    if (user && isAuthenticated && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadRooms().then(() => {
        // Restore active room from localStorage
        const savedActiveRoom = localStorage.getItem('activeRoom');
        if (savedActiveRoom) {
          dispatch({ type: 'SET_ACTIVE_ROOM', payload: savedActiveRoom });
        }
      });
    }
  }, [user, isAuthenticated]);

  // Save active room to localStorage and load messages when it changes
  useEffect(() => {
    if (state.activeRoom) {
      localStorage.setItem('activeRoom', state.activeRoom);
      // Load messages when active room changes
      if (state.activeRoom && !state.activeRoom.startsWith('dm-') && !state.activeRoom.startsWith('room-')) {
        loadMessages(state.activeRoom);
      }
    } else {
      localStorage.removeItem('activeRoom');
    }
  }, [state.activeRoom]);

  // Load messages for all rooms when rooms are loaded (for persistence on reload)
  useEffect(() => {
    if (state.rooms && state.rooms.length > 0 && user && isAuthenticated) {
      // Load messages for all rooms to ensure persistence
      const roomIds = state.rooms
        .map(room => room.id || room._id)
        .filter(roomId => roomId && !roomId.startsWith('dm-') && !roomId.startsWith('room-'));
      
      // Load messages for each room (always load to ensure fresh data on reload)
      roomIds.forEach(roomId => {
        // Check if messages need to be loaded (empty or not loaded yet)
        const hasMessages = state.messages[roomId] && state.messages[roomId].length > 0;
        if (!hasMessages) {
          // Always load messages on mount/reload to ensure persistence
          loadMessages(roomId).catch(err => {
            console.error(`Failed to load messages for room ${roomId}:`, err);
          });
        }
      });
    }
  }, [state.rooms.length, user, isAuthenticated]); // Trigger when rooms array length changes

  // Also load messages when activeRoom is set but messages aren't loaded yet
  useEffect(() => {
    if (state.activeRoom && user && isAuthenticated) {
      const roomId = state.activeRoom;
      // Only load if it's a real room and messages aren't already loaded
      if (!roomId.startsWith('dm-') && !roomId.startsWith('room-')) {
        const hasMessages = state.messages[roomId] && state.messages[roomId].length > 0;
        if (!hasMessages) {
          loadMessages(roomId).catch(err => {
            console.error(`Failed to load messages for active room ${roomId}:`, err);
          });
        }
      }
    }
  }, [state.activeRoom, user, isAuthenticated]);

  const loadMessages = async (roomId) => {
    try {
      // Skip loading messages for mock/test room IDs
      if (!roomId || roomId.startsWith('dm-') || roomId.startsWith('room-')) {
        // Mock room - skip message load (expected behavior for test/mock rooms)
        // Using debug instead of warn to reduce console noise
        if (process.env.NODE_ENV === 'development') {
          console.debug('Skipping message load for mock room:', roomId);
        }
        return;
      }

      const response = await fetch(getApiUrl(`/api/chat/rooms/${roomId}/messages`), {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        throw new Error('Authentication required');
      }

      if (response.status === 400 || response.status === 404) {
        const data = await response.json();
        console.warn('Room not found or invalid:', data.message);
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        const roomKey = await getRoomKey(roomId);
        
        // Sort messages by timestamp (oldest first)
        const sortedMessages = (data.data.messages || []).sort((a, b) => {
          const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return timeA - timeB;
        });

        const decryptedMessages = await Promise.all(
          sortedMessages.map(async (msg) => {
            try {
              // Validate required fields
              if (!msg.encryptedContent || !msg.iv) {
                console.warn('Message missing encryption data:', msg);
                return { 
                  ...msg, 
                  id: msg._id || msg.id,
                  content: '[Message missing encryption data]',
                  senderId: msg.senderId?._id || msg.senderId,
                  senderName: msg.senderUsername || msg.senderName || 'Unknown',
                  timestamp: msg.createdAt || msg.timestamp || new Date().toISOString()
                };
              }

              // Convert base64 to ArrayBuffer
              const encryptedBuffer = CryptoUtils.base64ToArrayBuffer(msg.encryptedContent);
              const ivBuffer = CryptoUtils.base64ToArrayBuffer(msg.iv);

              // Decrypt the message
              const decrypted = await CryptoUtils.decryptMessage(
                encryptedBuffer,
                roomKey,
                ivBuffer
              );

              return { 
                ...msg, 
                id: msg._id || msg.id,
                content: decrypted,
                senderId: msg.senderId?._id || msg.senderId,
                senderName: msg.senderUsername || msg.senderName || 'Unknown',
                timestamp: msg.createdAt || msg.timestamp || new Date().toISOString()
              };
            } catch (error) {
              console.error('Failed to decrypt message:', error);
              console.error('Message data:', {
                id: msg._id || msg.id,
                hasEncryptedContent: !!msg.encryptedContent,
                hasIv: !!msg.iv,
                encryptedContentLength: msg.encryptedContent?.length,
                ivLength: msg.iv?.length
              });
              // Return message with error indicator but don't break the entire list
              return { 
                ...msg, 
                id: msg._id || msg.id,
                content: '[Unable to decrypt message - key mismatch or corrupted data]',
                senderId: msg.senderId?._id || msg.senderId,
                senderName: msg.senderUsername || msg.senderName || 'Unknown',
                timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
                decryptionError: true
              };
            }
          })
        );
        
        // Always update messages, even if some failed to decrypt
        // This ensures we show what we can and indicate which messages have issues
        dispatch({ type: 'SET_MESSAGES', roomId, payload: decryptedMessages });
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  return (
    <ChatContext.Provider value={{
      ...state,
      joinRoom,
      sendMessage,
      setTyping,
      createRoom,
      loadRooms,
      loadMessages,
      isConnected
    }}>
      {children}
    </ChatContext.Provider>
  );
};