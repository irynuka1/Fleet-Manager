import axios from 'axios';

// The access token lives in memory only. The refresh token is an httpOnly
// cookie managed by the API, so it is never readable from JavaScript (XSS-safe).
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Single-flight refresh shared by the interceptor, app bootstrap and the socket.
let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', null, { withCredentials: true })
      .then(({ data }) => {
        accessToken = data.data.accessToken as string;
        return accessToken;
      })
      .catch((err) => {
        accessToken = null;
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  } else {
    config.headers.set('Content-Type', 'application/json');
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthCall = originalRequest?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthCall) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        const { useAuthStore } = await import('@/stores/auth.store');
        useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
