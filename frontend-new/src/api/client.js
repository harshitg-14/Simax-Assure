import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('simax_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 — clear session and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('simax_token');
      localStorage.removeItem('simax_user');
      localStorage.removeItem('simax_year');
      window.location.href = '/login';
    }
    console.error('API Error:', err.response?.status, err.response?.data);
    return Promise.reject(err);
  }
);

export default api;
