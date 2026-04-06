import axios from 'axios';
import ENV from '../config/environment';

// Create axios instance with environment-based config
const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    // const token = getAuthToken(); // Implement this when you add auth
    // if (token) {
    //   config.headers.Authorization = `Token ${token}`;
    // }
    
    if (ENV.DEBUG) {
      console.log('🚀 API Request:', config.method?.toUpperCase(), config.url);
    }
    
    return config;
  },
  (error) => {
    if (ENV.DEBUG) {
      console.error('❌ API Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    if (ENV.DEBUG) {
      console.log('✅ API Response:', response.status, response.config.url);
    }
    return response;
  },
  (error) => {
    if (ENV.DEBUG) {
      console.error('❌ API Response Error:', error.response?.status, error.config?.url);
    }
    
    // Handle common errors
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      console.log('Unauthorized access - redirecting to login');
    } else if (error.response?.status >= 500) {
      // Handle server errors
      console.log('Server error - showing error message');
    }
    
    return Promise.reject(error);
  }
);

// API endpoints organized by feature
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login/', credentials),
  logout: () => apiClient.post('/auth/logout/'),
  register: (userData) => apiClient.post('/auth/register/', userData),
  getProfile: () => apiClient.get('/auth/profile/'),
};

export const friendsAPI = {
  getFriends: () => apiClient.get('/friends/'),
  addFriend: (friendData) => apiClient.post('/friends/', friendData),
  updateFriend: (id, friendData) => apiClient.patch(`/friends/${id}/`, friendData),
  deleteFriend: (id) => apiClient.delete(`/friends/${id}/`),
};

export const utilityAPI = {
  healthCheck: () => apiClient.get('/health/'),
  getApiRoot: () => apiClient.get('/'),
};

export default apiClient;