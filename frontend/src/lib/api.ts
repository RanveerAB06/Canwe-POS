import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject bearer auth token dynamically from localStorage
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const tokens = localStorage.getItem('canwe_pos_tokens');
      if (tokens) {
        try {
          const parsed = JSON.parse(tokens);
          if (parsed.accessToken) {
            config.headers.Authorization = `Bearer ${parsed.accessToken}`;
          }
        } catch (e) {
          console.error('Failed to parse tokens from localStorage', e);
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh automatically on 401
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid infinite loop if refresh token request itself fails with 401
    if (originalRequest.url === '/api/auth/refresh') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('canwe_pos_tokens');
        localStorage.removeItem('canwe_pos_user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      if (typeof window !== 'undefined') {
        const tokensStr = localStorage.getItem('canwe_pos_tokens');
        if (tokensStr) {
          try {
            const tokens = JSON.parse(tokensStr);
            if (tokens.refreshToken) {
              // Make call to refresh token
              const res = await axios.post(`${API_URL}/api/auth/refresh`, {
                refreshToken: tokens.refreshToken,
              });

              if (res.data && res.data.success) {
                const { accessToken, refreshToken } = res.data.data;
                const newTokens = { accessToken, refreshToken };
                localStorage.setItem('canwe_pos_tokens', JSON.stringify(newTokens));

                // Process queued requests
                processQueue(null, accessToken);

                // Retry original request
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
              }
            }
          } catch (e) {
            processQueue(e, null);
            localStorage.removeItem('canwe_pos_tokens');
            localStorage.removeItem('canwe_pos_user');
            window.location.href = '/login';
            return Promise.reject(e);
          } finally {
            isRefreshing = false;
          }
        }
      }

      // Default logout/redirect if no token or refresh fails
      if (typeof window !== 'undefined') {
        localStorage.removeItem('canwe_pos_tokens');
        localStorage.removeItem('canwe_pos_user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
