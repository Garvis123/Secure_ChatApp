import { getApiUrl } from '../config/api.js';

class ApiClient {
  constructor() {
    // No baseURL needed - using getApiUrl for all requests
  }

  async request(endpoint, options = {}, retry = true) {
    const url = getApiUrl(endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`);
    const token = localStorage.getItem('token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && retry) {
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            const refreshResponse = await fetch(getApiUrl('/api/auth/refresh-token'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });
            
            const refreshData = await refreshResponse.json();
            
            if (refreshResponse.ok && refreshData.success && refreshData.data) {
              localStorage.setItem('token', refreshData.data.accessToken);
              if (refreshData.data.refreshToken) {
                localStorage.setItem('refreshToken', refreshData.data.refreshToken);
              }
              
              // Retry the original request with new token
              return this.request(endpoint, options, false);
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Clear tokens and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      }
      
      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Auth endpoints
  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Chat endpoints
  async getRooms() {
    return this.request('/chat/rooms');
  }

  async getMessages(roomId) {
    return this.request(`/chat/rooms/${roomId}/messages`);
  }

  // Admin endpoints
  async getDashboardStats() {
    return this.request('/admin/dashboard/stats');
  }

  async getAuditLogs(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/admin/audit-logs${queryString ? `?${queryString}` : ''}`);
  }

  async getAnomalies(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/admin/anomalies${queryString ? `?${queryString}` : ''}`);
  }

  async getUserActivity(userId) {
    return this.request(`/admin/users/${userId}/activity`);
  }

  // Generic methods for flexibility
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// Export both default and named export for compatibility
const api = new ApiClient();
export default api;
export const apiClient = api;