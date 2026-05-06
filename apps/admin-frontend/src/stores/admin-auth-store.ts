'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isVendor: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (dto: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAdminAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isVendor: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        const user = data.user || { id: '', email, firstName: '', lastName: '', role: 'VENDOR' };
        localStorage.setItem('authToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        set({
          token: data.accessToken,
          user,
          isAuthenticated: true,
          isVendor: user.role === 'VENDOR' || user.role === 'ADMIN',
        });
      },

      register: async (dto) => {
        const { data } = await api.post('/auth/register', { ...dto, role: 'VENDOR' });
        localStorage.setItem('authToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        set({
          token: data.accessToken,
          user: data.user,
          isAuthenticated: true,
          isVendor: true,
        });
      },

      logout: async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            await api.post('/auth/logout', { refreshToken });
          } catch {
            // Server may be unreachable — clear local state anyway
          }
        }
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('polydom-admin-auth');
        set({ token: null, user: null, isAuthenticated: false, isVendor: false });
      },
    }),
    {
      name: 'polydom-admin-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isVendor: state.isVendor,
      }),
    },
  ),
);
