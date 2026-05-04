import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions?: string[];
  vendorId?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token, user) => {
        localStorage.setItem('authToken', token);
        localStorage.setItem('userId', user.id);
        set({ token, user, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'polydom-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
