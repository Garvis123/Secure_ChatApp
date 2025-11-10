import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from '../hooks/useSocket';
import * as CryptoUtils from '../utils/crypto';
import { getApiUrl } from '../config/api';

// Optional notification context import
let useNotifications = null;
try {
  useNotifications = require('./NotificationContext').useNotifications;
} catch (e) {
  // NotificationContext not available
}

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

  // Get notifications context (optional - only if available)
  let notifications = null;
  try {
    if (useNotifications) {
      notifications = useNotifications();
    }
  } catch (e) {
    // NotificationContext not available, continue without it
  }
  const addNotification = notifications?.addNotification;

  // Use ref to access latest messages state without causing re-renders
  const messagesRef = useRef(state.messages);
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  // Handle incoming encrypted messages - using useCallback to avoid closure issues
  const handleIncomingMessage = React.useCallback(async (messageData) => {
    try {
      const { roomId, encryptedContent, iv, senderId, messageId, timestamp, ...rest } = messageData;
      
      if (!roomId || !encryptedContent || !iv) {
        console.error('Invalid message data received:', messageData);
        return;
      }

      // Check if message already exists (deduplication) - use ref for latest state
      const roomMessages = messagesRef.current[roomId] || [];
      
      // First, check if there's an optimistic message with same content to replace it
      const optimisticIndex = roomMessages.findIndex(msg => 
        msg.isOptimistic && 
        msg.encryptedContent === encryptedContent && 
        msg.iv === iv
      );

      // Check if message already exists (by messageId or content)
      const messageExists = roomMessages.some(msg => {
        // Skip optimistic messages in this check
        if (msg.isOptimistic) return false;
        // Check by messageId if available
        if (messageId && (msg.id === messageId || msg._id === messageId)) {
          return true;
        }
        // Check by encrypted content + iv (for deduplication)
        if (msg.encryptedContent === encryptedContent && msg.iv === iv) {
          return true;
        }
        return false;
      });

      if (messageExists && optimisticIndex === -1) {
        console.log('Message already exists, skipping duplicate:', messageId || encryptedContent.substring(0, 20));
        return;
      }

      // If we found an optimistic message, remove it first (will be replaced with real message)
      if (optimisticIndex !== -1) {
        dispatch({
          type: 'REMOVE_MESSAGE',
          roomId,
          messageId: roomMessages[optimisticIndex].id
        });
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
        readBy: messageData.readBy || rest.readBy || [], // Include readBy for read receipts
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
  }, []);

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

    // Listen for message read status updates (real-time read receipts)
    socket.on('message-read', ({ messageId, userId, readAt }) => {
      // Find the message and update its read status
      const roomId = Object.keys(messagesRef.current).find(rid => 
        messagesRef.current[rid]?.some(msg => msg.id === messageId)
      );
      
      if (roomId) {
        const updatedMessages = messagesRef.current[roomId].map(msg => {
          if (msg.id === messageId) {
            const isAlreadyRead = msg.readBy?.some(read => 
              read.userId?.toString() === userId?.toString()
            );
            
            if (!isAlreadyRead) {
              return {
                ...msg,
                readBy: [
                  ...(msg.readBy || []),
                  { userId, readAt: readAt || new Date() }
                ]
              };
            }
          }
          return msg;
        });
        
        dispatch({ 
          type: 'SET_MESSAGES', 
          roomId, 
          payload: updatedMessages 
        });
      }
    });

    // Listen for room-created events (real-time notifications)
    socket.on('room-created', (roomData) => {
      console.log('New room created:', roomData);
      
      // Add room to state immediately (real-time update)
      const newRoom = {
        id: roomData.roomId,
        _id: roomData.roomId,
        name: roomData.roomName,
        type: roomData.roomType,
        participants: roomData.participants || [],
        createdAt: roomData.createdAt,
        encryptionEnabled: roomData.encryptionEnabled
      };

      // Check if room already exists
      const roomExists = state.rooms.some(r => (r.id || r._id) === roomData.roomId);
      if (!roomExists) {
        dispatch({ type: 'SET_ROOMS', payload: [...state.rooms, newRoom] });
      }

      // Show notification
      if (addNotification) {
        const isDirect = roomData.roomType === 'direct';
        const otherParticipant = roomData.participants?.find(
          p => p.userId !== (user?.id || user?._id || user?.userId)
        );
        
        addNotification({
          type: 'room',
          title: isDirect 
            ? `${roomData.creatorName} started a chat with you`
            : `${roomData.creatorName} added you to a group`,
          message: isDirect
            ? `You can now chat with ${roomData.creatorName}`
            : `Group: ${roomData.roomName}`,
          action: () => {
            // Navigate to the room
            dispatch({ type: 'SET_ACTIVE_ROOM', payload: roomData.roomId });
            if (socket && user) {
              socket.emit('join-room', { roomId: roomData.roomId });
            }
          },
          actionLabel: 'Open Chat'
        });
      }
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
      socket.off('message-read');
      socket.off('room-created');
      socket.off('error');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket, handleIncomingMessage]);

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

        // Add room to list (avoid duplicates) or update if exists
        const roomExists = state.rooms.some(r => (r.id || r._id) === newRoom.id);
        if (!roomExists) {
          dispatch({ type: 'SET_ROOMS', payload: [...state.rooms, newRoom] });
        } else {
          // Update existing room with latest data (including participants)
          const updatedRooms = state.rooms.map(r => 
            (r.id || r._id) === newRoom.id ? newRoom : r
          );
          dispatch({ type: 'SET_ROOMS', payload: updatedRooms });
        }
        
        // Save active room to localStorage for persistence across reloads
        localStorage.setItem('activeRoom', newRoom.id);
        
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
        // Reload rooms to get updated participant list (with throttling)
        // Use setTimeout to debounce the reload
        setTimeout(() => {
          loadRooms().catch(err => {
            console.error('Failed to reload rooms after adding participant:', err);
          });
        }, 500); // Small delay to avoid immediate reload
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
      
      // Get room key (cached for performance - very fast)
      const roomKey = await getRoomKey(roomId);
      
      // Encrypt message (optimized - Web Crypto API is hardware-accelerated, typically < 1ms)
      const encrypted = await CryptoUtils.encryptMessage(message, roomKey);
      
      // Convert to base64 (synchronous operations, very fast)
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

      let addedMessageId = null;

      // Send via WebSocket (primary method - it saves to DB and broadcasts)
      if (socket && !isMockRoom && user) {
        // Add optimistic update immediately for instant feedback
        const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
        const optimisticMessage = {
          id: tempMessageId,
          roomId,
          senderId: userId,
          senderName: username,
          content: message,
          encryptedContent: encryptedBase64,
          iv: ivBase64,
          type: options.type || 'text',
          timestamp: new Date().toISOString(),
          isOptimistic: true, // Mark as optimistic
          status: 'sending'
        };

        dispatch({ 
          type: 'ADD_MESSAGE', 
          roomId, 
          payload: optimisticMessage 
        });

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
        
        // The optimistic message will be replaced when WebSocket broadcasts the real message back
        // Deduplication will handle this
      } else {
        // Fallback to API if WebSocket is not available (for mock rooms or when socket is disconnected)
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
              throw new Error(errorData.message || 'Failed to send message');
            }

            const data = await response.json();
            if (data.success && data.data) {
              // Add the message from API response
              const apiMessage = {
                id: data.data._id || data.data.id || `msg-${Date.now()}`,
                roomId,
                senderId: userId,
                senderName: username,
                content: message,
                encryptedContent: encryptedBase64,
                iv: ivBase64,
                type: options.type || 'text',
                timestamp: data.data.createdAt || data.data.timestamp || new Date().toISOString(),
                status: 'sent'
              };

              addedMessageId = apiMessage.id;

              dispatch({ 
                type: 'ADD_MESSAGE', 
                roomId, 
                payload: apiMessage 
              });
            }
          } catch (apiError) {
            console.error('Failed to save message to API:', apiError);
            throw apiError;
          }
        } else {
          // Mock room - add optimistic update only
          const localMessage = {
            id: `local-${Date.now()}`,
            ...messageData,
            content: message,
            timestamp: new Date().toISOString(),
            isLocal: true,
            status: 'sent'
          };

          addedMessageId = localMessage.id;

          dispatch({ 
            type: 'ADD_MESSAGE', 
            roomId, 
            payload: localMessage 
          });
        }
      }

      if (options.selfDestruct && addedMessageId) {
        setTimeout(() => {
          dispatch({ type: 'REMOVE_MESSAGE', roomId, messageId: addedMessageId });
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

  const loadRooms = async (retryCount = 0) => {
    try {
      // Throttle: prevent too frequent calls
      const now = Date.now();
      if (now - lastLoadTimeRef.current < LOAD_ROOMS_THROTTLE_MS && retryCount === 0) {
        console.log('Throttling loadRooms - too soon since last call');
        return;
      }

      if (isLoadingRoomsRef.current && retryCount === 0) {
        console.log('loadRooms already in progress, skipping');
        return;
      }

      isLoadingRoomsRef.current = true;
      lastLoadTimeRef.current = now;

      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token available');
        isLoadingRoomsRef.current = false;
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
        isLoadingRoomsRef.current = false;
        return;
      }
      
      // Handle rate limiting (429) with exponential backoff retry
      if (response.status === 429) {
        isLoadingRoomsRef.current = false;
        if (retryCount < 3) {
          const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.warn(`Rate limited. Retrying in ${backoffDelay}ms... (attempt ${retryCount + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return loadRooms(retryCount + 1);
        } else {
          throw new Error('Too many requests, please try again later');
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        isLoadingRoomsRef.current = false;
        throw new Error(errorData.message || `Failed to load rooms: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.data.rooms) {
        // Normalize room IDs (handle both _id and id) and ensure participants are included
        const normalizedRooms = data.data.rooms.map(room => ({
          ...room,
          id: room.id || room._id,
          name: room.name || 'Unnamed Room',
          type: room.type || 'direct',
          participants: room.participants || [],
          // Ensure all room data is preserved
          createdAt: room.createdAt,
          admin: room.admin,
          encryptionEnabled: room.encryptionEnabled !== undefined ? room.encryptionEnabled : true
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
        
        // Return normalized rooms for use in the promise chain
        return normalizedRooms;
      }
      isLoadingRoomsRef.current = false;
      return [];
    } catch (error) {
      console.error('Failed to load rooms:', error);
      isLoadingRoomsRef.current = false;
      return [];
    }
  };

  // Track loading state (reset on unmount to allow reload on next mount)
  const isLoadingRoomsRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  const LOAD_ROOMS_THROTTLE_MS = 2000; // Minimum 2 seconds between loads

  // Load rooms and restore active room on mount/reload
  useEffect(() => {
    if (user && isAuthenticated) {
      const now = Date.now();
      // Throttle: only load if enough time has passed since last load
      if (now - lastLoadTimeRef.current < LOAD_ROOMS_THROTTLE_MS) {
        // If too soon, still restore active room from localStorage
        const savedActiveRoom = localStorage.getItem('activeRoom');
        if (savedActiveRoom && savedActiveRoom !== state.activeRoom) {
          dispatch({ type: 'SET_ACTIVE_ROOM', payload: savedActiveRoom });
        }
        return;
      }
      lastLoadTimeRef.current = now;
      
      if (isLoadingRoomsRef.current) {
        return; // Already loading, skip
      }
      
      isLoadingRoomsRef.current = true;
      loadRooms().then((loadedRooms) => {
        // Restore active room from localStorage after rooms are loaded
        const savedActiveRoom = localStorage.getItem('activeRoom');
        if (savedActiveRoom) {
          // Use the loaded rooms from the function result or current state
          const currentRooms = loadedRooms || state.rooms;
          // Verify the room exists in loaded rooms before setting as active
          const roomExists = currentRooms && currentRooms.some(r => (r.id || r._id) === savedActiveRoom);
          if (roomExists) {
            dispatch({ type: 'SET_ACTIVE_ROOM', payload: savedActiveRoom });
            // Load messages for the restored room
            if (!savedActiveRoom.startsWith('dm-') && !savedActiveRoom.startsWith('room-')) {
              loadMessages(savedActiveRoom).catch(err => {
                console.error('Failed to load messages for restored room:', err);
              });
            }
          } else {
            // Room doesn't exist, clear it from localStorage
            localStorage.removeItem('activeRoom');
          }
        }
      }).finally(() => {
        isLoadingRoomsRef.current = false;
      });
    }
    
    // Cleanup: reset loading state on unmount to allow reload on next mount
    return () => {
      // Don't reset isLoadingRoomsRef here as it might be in progress
    };
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
                timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
                readBy: msg.readBy || [], // Include readBy information for read receipts
                type: msg.messageType || msg.type || 'text',
                fileMetadata: msg.fileMetadata,
                selfDestruct: msg.selfDestruct
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

  // Mark message as read
  const markMessageAsRead = async (messageId) => {
    try {
      // Skip for mock/test messages
      if (!messageId || messageId.startsWith('local-') || messageId.startsWith('temp-')) {
        return;
      }

      const response = await fetch(getApiUrl(`/api/chat/messages/${messageId}/read`), {
        method: 'PUT',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to mark message as read');
      }

      const data = await response.json();
      if (data.success) {
        // Update message read status in state
        const roomId = Object.keys(state.messages).find(rid => 
          state.messages[rid]?.some(msg => msg.id === messageId)
        );
        
        if (roomId) {
          const updatedMessages = state.messages[roomId].map(msg => {
            if (msg.id === messageId) {
              const userId = user?.id || user?._id || user?.userId;
              const isAlreadyRead = msg.readBy?.some(read => 
                (read.userId?.toString() === userId?.toString())
              );
              
              if (!isAlreadyRead) {
                return {
                  ...msg,
                  readBy: [
                    ...(msg.readBy || []),
                    { userId, readAt: new Date() }
                  ]
                };
              }
            }
            return msg;
          });
          
          dispatch({ 
            type: 'SET_MESSAGES', 
            roomId, 
            payload: updatedMessages 
          });
        }

        // Emit socket event to notify others
        if (socket && user) {
          socket.emit('mark-message-read', { messageId });
        }
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      throw error;
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
      markMessageAsRead,
      isConnected
    }}>
      {children}
    </ChatContext.Provider>
  );
};