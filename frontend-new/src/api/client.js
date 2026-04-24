import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000', // ✅ FIXED
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('API Error:', err.response?.status, err.response?.data);
    return Promise.reject(err);
  }
);

export default api;