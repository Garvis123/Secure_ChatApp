// client/src/hooks/useSocket.js - NEW FILE
import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, isAuthenticated, refreshAccessToken } = useAuth();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  // Helper function to get a valid token (refresh if needed)
  const getValidToken = async () => {
    let token = localStorage.getItem('token');
    
    if (!token) {
      console.warn('No token available for socket connection');
      return null;
    }

    // Check if token is expired by trying to decode it (without verification)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      
      // If token expires in less than 5 minutes, refresh it
      if (expirationTime - now < 5 * 60 * 1000) {
        console.log('Token expiring soon, refreshing...');
        if (refreshAccessToken) {
          try {
            await refreshAccessToken();
            token = localStorage.getItem('token');
          } catch (error) {
            console.error('Failed to refresh token:', error);
            return null;
          }
        }
      }
    } catch (error) {
      // If we can't decode the token, try refreshing it
      console.warn('Token decode error, attempting refresh:', error);
      if (refreshAccessToken) {
        try {
          await refreshAccessToken();
          token = localStorage.getItem('token');
        } catch (error) {
          console.error('Failed to refresh token:', error);
          return null;
        }
      }
    }

    return token;
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      const connectSocket = async () => {
        const token = await getValidToken();
        if (!token) {
          console.warn('No valid token available for socket connection');
          return;
        }

        // Use environment variable or default to localhost:5000
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
        console.log('Connecting to socket server:', serverUrl);

        const newSocket = io(serverUrl, {
          auth: {
            token: token
          },
          transports: ['websocket', 'polling'], // Prefer websocket for zero delay
          upgrade: true, // Allow transport upgrade
          rememberUpgrade: true, // Remember websocket preference
          reconnection: true,
          reconnectionDelay: 500, // Faster reconnection
          reconnectionDelayMax: 2000,
          reconnectionAttempts: Infinity, // Keep trying to reconnect
          timeout: 10000, // Connection timeout
          forceNew: false, // Reuse connection if available
          // Optimize for real-time performance
          pingTimeout: 60000,
          pingInterval: 25025
        });

        newSocket.on('connect', () => {
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;
          console.log('✅ Socket connected successfully');
        });

        newSocket.on('disconnect', (reason) => {
          setIsConnected(false);
          console.log('❌ Socket disconnected:', reason);
        });

        newSocket.on('connect_error', async (error) => {
          console.error('Socket connection error:', error.message || error);
          setIsConnected(false);
          
          // If authentication error, try refreshing token and reconnecting
          if (error.message && error.message.includes('authentication')) {
            if (reconnectAttemptsRef.current < maxReconnectAttempts && refreshAccessToken) {
              reconnectAttemptsRef.current++;
              console.log(`Attempting to refresh token and reconnect (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
              
              try {
                await refreshAccessToken();
                const newToken = localStorage.getItem('token');
                if (newToken) {
                  // Disconnect and reconnect with new token
                  newSocket.disconnect();
                  newSocket.auth.token = newToken;
                  newSocket.connect();
                }
              } catch (refreshError) {
                console.error('Failed to refresh token for socket:', refreshError);
              }
            } else {
              console.error('Max reconnection attempts reached or no refresh function available');
            }
          }
        });

        newSocket.on('reconnect', (attemptNumber) => {
          console.log('✅ Socket reconnected after', attemptNumber, 'attempts');
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;
        });

        newSocket.on('reconnect_error', async (error) => {
          console.error('Socket reconnection error:', error.message || error);
          
          // If authentication error during reconnect, try refreshing token
          if (error.message && error.message.includes('authentication')) {
            if (reconnectAttemptsRef.current < maxReconnectAttempts && refreshAccessToken) {
              reconnectAttemptsRef.current++;
              console.log(`Attempting to refresh token during reconnect (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
              
              try {
                await refreshAccessToken();
                const newToken = localStorage.getItem('token');
                if (newToken) {
                  newSocket.auth.token = newToken;
                }
              } catch (refreshError) {
                console.error('Failed to refresh token during reconnect:', refreshError);
              }
            }
          }
        });

        newSocket.on('reconnect_failed', () => {
          console.error('❌ Socket reconnection failed');
          setIsConnected(false);
        });

        setSocket(newSocket);

        return () => {
          console.log('Cleaning up socket connection');
          newSocket.close();
        };
      };

      connectSocket();
    } else {
      // If not authenticated, ensure socket is closed
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  return { socket, isConnected };
};