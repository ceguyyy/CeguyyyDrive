import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set) => ({
    token: localStorage.getItem('token') || null,
    user: null,
    totalMemory: 0,
    setAuth: (token, user) => {
        localStorage.setItem('token', token);
        set({ token, user });
    },
    logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null, totalMemory: 0 });
    },
    fetchMe: async () => {
        try {
            const res = await api.get('/auth/me');
            if (res.data.status === 'success') {
                set({ 
                    user: res.data.data.user,
                    totalMemory: res.data.data.total_memory
                });
            }
        } catch (err) {
            console.error('Failed to fetch user', err);
            // If unauthorized, token is probably invalid, maybe logout?
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                set({ token: null, user: null, totalMemory: 0 });
            }
        }
    }
}));
