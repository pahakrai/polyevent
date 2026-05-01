import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('polydom-admin-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
