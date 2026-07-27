import { create } from 'zustand';
import type { User } from '@/types';
import { authApi } from '@/utils/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (identifier: string, password: string) => Promise<any>;
  googleLogin: (credential: string) => Promise<any>;
  register: (data: { username: string; email?: string; password: string; schoolId: string; icNumber: string; grade?: string; preferredLanguage?: string }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
  switchRole: (token: string, user: User) => void;
}

const TOKEN_KEY = 'auth_token';

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  isLoading: false,
  error: null,

  login: async (identifier, password) => {
    set({ isLoading: true, error: null });
    try {
      const isEmail = identifier.includes('@');
      const body = isEmail
        ? { email: identifier.trim(), password }
        : { icNumber: identifier.trim().replace(/-/g, ''), password };
      const res = await authApi.login(body);
      const { token, user } = res.data;
      storeToken(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
      return user;
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || '登录失败';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  googleLogin: async (credential) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.googleLogin(credential);
      const { token, user } = res.data;
      storeToken(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
      return user;
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Google login failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.register(data);
      const { token, user } = res.data;
      storeToken(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || '注册失败';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    // Call backend to deactivate sessions (fire-and-forget)
    authApi.logout().catch(() => {});
    storeToken(null);
    sessionStorage.removeItem('welcome_card_shown');
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  fetchMe: async () => {
    const token = get().token;
    if (!token) return;
    set({ isLoading: true });
    try {
      const res = await authApi.me();
      set({ user: res.data, isAuthenticated: true, isLoading: false });
    } catch {
      storeToken(null);
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user }),

  switchRole: (token, user) => {
    storeToken(token);
    set({ token, user, isAuthenticated: true });
  },
}));
