/**
 * API Client for Subscription Waste Manager
 */
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

export function backendOrigin(): string {
  return API_BASE_URL.replace(/\/api\/v1\/?$/, '');
}

export function socialLoginUrl(provider: 'google' | 'microsoft'): string {
  const backend = provider === 'google' ? 'google-oauth2' : 'microsoft-graph';
  return `${backendOrigin()}/social/login/${backend}/`;
}

export function persistAuthTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return;
  let parsed: { state?: Record<string, unknown>; version?: number } = { state: {}, version: 0 };
  try {
    const raw = localStorage.getItem('swm-auth');
    if (raw) parsed = JSON.parse(raw);
  } catch {
    parsed = { state: {}, version: 0 };
  }
  parsed.state = {
    ...(parsed.state || {}),
    accessToken: access,
    refreshToken: refresh,
    isAuthenticated: true,
  };
  localStorage.setItem('swm-auth', JSON.stringify(parsed));
}

// ==================== Axios Client Setup ====================

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

type RefreshedTokens = { access: string; refresh: string };
let refreshInFlight: Promise<RefreshedTokens> | null = null;
let authRefreshListener: ((access: string, refresh: string) => void) | undefined;

export function setAuthRefreshListener(listener: (access: string, refresh: string) => void) {
  authRefreshListener = listener;
}

function refreshTokens(refresh: string): Promise<RefreshedTokens> {
  if (!refreshInFlight) {
    refreshInFlight = axios.post<RefreshedTokens>(`${API_BASE_URL}/auth/token/refresh/`, { refresh })
      .then(({ data }) => {
        const nextRefresh = data.refresh || refresh;
        persistAuthTokens(data.access, nextRefresh);
        authRefreshListener?.(data.access, nextRefresh);
        return { access: data.access, refresh: nextRefresh };
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

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
        } catch {
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

    const responseData = error.response?.data as { error?: { details?: { code?: string } }; code?: string } | undefined;
    if (error.response?.status === 403 && (responseData?.error?.details?.code === 'email_verification_required' || responseData?.code === 'email_verification_required')) {
      // Axios runs outside React; discard the stale protected view.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (typeof window !== 'undefined' && window.location.pathname !== '/verify-email') window.location.assign(`${window.location.origin}/verify-email`);
      return Promise.reject(error);
    }
    if (error.response?.status === 403 && (responseData?.error?.details?.code === 'agreements_required' || responseData?.code === 'agreements_required')) {
      // Axios runs outside React; a full navigation also clears stale protected-page state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (typeof window !== 'undefined' && window.location.pathname !== '/agreements') window.location.assign(`${window.location.origin}/agreements`);
      return Promise.reject(error);
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = (error.response.data as Record<string, unknown>)?.retry_after || 60;
      return Promise.reject({
        ...error,
        isRateLimit: true,
        retryAfter,
        message: 'Too many requests. Please try again later.',
      });
    }

    // Handle 401 - attempt token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url?.includes('/auth/token/')) {
      originalRequest._retry = true;

      try {
        const authStorage = localStorage.getItem('swm-auth');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          const refreshToken = parsed?.state?.refreshToken;
          
          if (refreshToken) {
            const { access } = await refreshTokens(refreshToken);

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
          // Interceptor is outside React; Next router is not available here.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`${window.location.origin}/login`);
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
  headers?: Record<string, string | undefined>;
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
  get wsUrl() {
    if (WS_BASE_URL.startsWith('/') && typeof window !== 'undefined') {
      const url = new URL(WS_BASE_URL, window.location.origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return url.toString().replace(/\/$/, '');
    }
    return WS_BASE_URL;
  },
};

export default api;
