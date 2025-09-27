import { createContext, useContext, useReducer, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

const initialState = {
  rooms: [],
  activeRoom: null,
  messages: {},
  users: [],
  isConnected: false,
  typingUsers: {},
  encryptionStatus: {},
  selfDestructMessages: {},
};

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload };
    case 'SET_ACTIVE_ROOM':
      return { ...state, activeRoom: action.payload };
    case 'SET_MESSAGES':
      return { 
        ...state, 
        messages: { 
          ...state.messages, 
          [action.roomId]: action.payload 
        } 
      };
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.roomId]: [
            ...(state.messages[action.roomId] || []),
            action.payload
          ]
        }
      };
    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.roomId]: state.messages[action.roomId]?.filter(
            msg => msg.id !== action.messageId
          ) || []
        }
      };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
    case 'SET_TYPING_USER':
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.roomId]: action.payload
        }
      };
    case 'SET_ENCRYPTION_STATUS':
      return {
        ...state,
        encryptionStatus: {
          ...state.encryptionStatus,
          [action.roomId]: action.payload
        }
      };
    case 'ADD_SELF_DESTRUCT':
      return {
        ...state,
        selfDestructMessages: {
          ...state.selfDestructMessages,
          [action.messageId]: action.timer
        }
      };
    case 'REMOVE_SELF_DESTRUCT':
      const { [action.messageId]: removed, ...rest } = state.selfDestructMessages;
      return { ...state, selfDestructMessages: rest };
    default:
      return state;
  }
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize WebSocket connection
      initializeSocket();
    }
  }, [isAuthenticated, user]);

  const initializeSocket = () => {
    // WebSocket connection logic will be handled by useSocket hook
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
  };

  const joinRoom = (roomId) => {
    dispatch({ type: 'SET_ACTIVE_ROOM', payload: roomId });
  };

  const sendMessage = async (roomId, message, options = {}) => {
    try {
      // Encrypt message before sending
      const encryptedMessage = await encryptMessage(message);
      
      const messageData = {
        id: Date.now().toString(),
        roomId,
        senderId: user.id,
        content: encryptedMessage,
        timestamp: new Date().toISOString(),
        type: options.type || 'text',
        selfDestruct: options.selfDestruct || null,
      };

      // Add to local state immediately
      dispatch({ 
        type: 'ADD_MESSAGE', 
        roomId, 
        payload: messageData 
      });

      // Send via WebSocket
      // socket.emit('send_message', messageData);

      // Handle self-destruct
      if (options.selfDestruct) {
        dispatch({
          type: 'ADD_SELF_DESTRUCT',
          messageId: messageData.id,
          timer: setTimeout(() => {
            dispatch({ type: 'REMOVE_MESSAGE', roomId, messageId: messageData.id });
            dispatch({ type: 'REMOVE_SELF_DESTRUCT', messageId: messageData.id });
          }, options.selfDestruct * 1000)
        });
      }

    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const encryptMessage = async (message) => {
    // Placeholder for encryption logic
    return btoa(message); // Base64 encoding as placeholder
  };

  const decryptMessage = async (encryptedMessage) => {
    // Placeholder for decryption logic
    return atob(encryptedMessage); // Base64 decoding as placeholder
  };

  const setTyping = (roomId, isTyping) => {
    dispatch({ 
      type: 'SET_TYPING_USER', 
      roomId, 
      payload: isTyping ? user.id : null 
    });
  };

  return (
    <ChatContext.Provider value={{
      ...state,
      joinRoom,
      sendMessage,
      setTyping,
      encryptMessage,
      decryptMessage,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};