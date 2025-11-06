// client/src/hooks/useSocket.js - NEW FILE
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token available for socket connection');
        return;
      }

      // Use environment variable or default to localhost:5000
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
      console.log('Connecting to socket server:', serverUrl);

      const newSocket = io(serverUrl, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'], // Allow both transports
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        console.log('✅ Socket connected successfully');
      });

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false);
        console.log('❌ Socket disconnected:', reason);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('✅ Socket reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
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
    } else {
      // If not authenticated, ensure socket is closed
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [isAuthenticated, user]);

  return { socket, isConnected };
};