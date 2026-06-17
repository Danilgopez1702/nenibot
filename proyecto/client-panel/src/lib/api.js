// lib/api.js — Axios con JWT del panel cliente.
import axios from 'axios';

const api = axios.create({ baseURL: '/api/client' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('client_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('client_token');
      if (!location.pathname.endsWith('/login')) location.href = '/cliente/login';
    }
    return Promise.reject(err);
  }
);

export default api;
