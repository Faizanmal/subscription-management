/**
 * API Client for Subscription Waste Manager
 */
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

// ==================== Axios Client Setup ====================

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const authStorage = localStorage.getItem('swm-auth');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          const token = parsed?.state?.accessToken;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Failed to parse auth storage:', error);
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh and error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = (error.response.data as Record<string, unknown>)?.retry_after || 60;
      console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
      return Promise.reject({
        ...error,
        isRateLimit: true,
        retryAfter,
        message: 'Too many requests. Please try again later.',
      });
    }

    // Handle 401 - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const authStorage = localStorage.getItem('swm-auth');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          const refreshToken = parsed?.state?.refreshToken;
          
          if (refreshToken) {
            const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
              refresh: refreshToken,
            });

            const { access } = response.data;

            // Update access token in storage
            parsed.state.accessToken = access;
            localStorage.setItem('swm-auth', JSON.stringify(parsed));

            // Retry original request
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${access}`;
            }
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('swm-auth');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ==================== Helper Types ====================

interface RequestOptions {
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// ==================== Generic API Methods ====================

async function get<T>(url: string, options?: RequestOptions): Promise<T> {
  const response = await apiClient.get<T>(url, options);
  return response.data;
}

async function post<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
  const response = await apiClient.post<T>(url, data, options);
  return response.data;
}

async function put<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
  const response = await apiClient.put<T>(url, data, options);
  return response.data;
}

async function patch<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
  const response = await apiClient.patch<T>(url, data, options);
  return response.data;
}

async function del<T = void>(url: string, options?: RequestOptions): Promise<T> {
  const response = await apiClient.delete<T>(url, options);
  return response.data;
}

// ==================== Export API Object ====================

export const api = {
  get,
  post,
  put,
  patch,
  delete: del,
  client: apiClient,
  baseUrl: API_BASE_URL,
  wsUrl: WS_BASE_URL,
};

export default api;
