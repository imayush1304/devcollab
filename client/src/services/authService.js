import api from './api';

export const authService = {
  async register({ name, email, password }) {
    const res = await api.post('/auth/register', { name, email, password });
    if (res.data?.token) {
      localStorage.setItem('devcollab_token', res.data.token);
    }
    return res.data;
  },

  async login({ email, password }) {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.token) {
      localStorage.setItem('devcollab_token', res.data.token);
    }
    return res.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('devcollab_token');
    }
  },

  async getMe() {
    const res = await api.get('/auth/me');
    return res.data;
  }
};
