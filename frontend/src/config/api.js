// Centralized API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

export const getApiUrl = (endpoint) => {
  // Always use full server URL for API calls to ensure proper authentication
  // Remove leading /api if present to avoid double /api
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  return `${SERVER_URL}${cleanEndpoint}`;
};

export const getServerUrl = (endpoint) => {
  return `${SERVER_URL}${endpoint}`;
};

export { API_BASE_URL, SERVER_URL };

