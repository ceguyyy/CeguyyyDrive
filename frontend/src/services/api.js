import axios from 'axios';

const rawBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080/v1';
const baseURL = rawBaseURL.endsWith('/v1') ? rawBaseURL : `${rawBaseURL.replace(/\/$/, '')}/v1`;

const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isPublicShareReq = error.config?.url?.includes('/shares/public/');
        if (error.response?.status === 401 && !isPublicShareReq) {
            localStorage.removeItem('token');
            // If we are not on the login page or public share page, redirect
            if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/s/')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
