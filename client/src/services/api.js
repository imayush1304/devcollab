import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // Crucial for sending and receiving HttpOnly cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach Authorization Bearer header if a token exists in localStorage (dual cookie/header resilience)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('devcollab_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors cleanly
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    const code = error.response?.data?.error?.code || 'NETWORK_ERROR';
    const details = error.response?.data?.error?.details || null;

    return Promise.reject({
      status: error.response?.status,
      code,
      message,
      details,
      raw: error
    });
  }
);

export default api;
