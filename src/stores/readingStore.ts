import { create } from 'zustand';
import type { ReadingProgress, ReadingSession, Highlight } from '@/types';
import { readingApi } from '@/utils/api';

interface ReadingState {
  currentProgress: ReadingProgress | null;
  progressList: ReadingProgress[];
  sessions: ReadingSession[];
  highlights: Highlight[];
  isLoading: boolean;
  error: string | null;
  isReading: boolean;
  sessionStart: string | null;

  fetchProgress: (bookId: string) => Promise<void>;
  fetchProgressList: () => Promise<void>;
  saveProgress: (bookId: string, currentPage: number, totalPages: number, lastPosition?: string) => Promise<any>;
  startSession: (bookId: string) => void;
  endSession: (bookId: string, startPage: number, endPage: number) => Promise<void>;
  fetchHighlights: (bookId: string) => Promise<void>;
  addHighlight: (data: { bookId: string; text: string; color: string; page: number; note?: string; startOffset?: number }) => Promise<void>;
  clearCurrent: () => void;
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  currentProgress: null,
  progressList: [],
  sessions: [],
  highlights: [],
  isLoading: false,
  error: null,
  isReading: false,
  sessionStart: null,

  fetchProgress: async (bookId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await readingApi.getProgress(bookId);
      set({ currentProgress: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || '获取阅读进度失败', isLoading: false });
    }
  },

  fetchProgressList: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await readingApi.getProgressList();
      set({ progressList: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || '获取进度列表失败', isLoading: false });
    }
  },

  saveProgress: async (bookId, currentPage, totalPages, lastPosition?) => {
    try {
      const percentage = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
      const isCompleted = percentage >= 100;
      const res = await readingApi.saveProgress({ bookId, currentPage, totalPages, percentage, isCompleted, lastPosition } as any);
      set({ currentProgress: res.data });
      return res.data;
    } catch (err: any) {
      set({ error: err?.message || '保存进度失败' });
    }
  },

  startSession: (bookId) => {
    set({ isReading: true, sessionStart: new Date().toISOString() });
  },

  endSession: async (bookId, startPage, endPage) => {
    const { sessionStart } = get();
    if (!sessionStart) return;
    const duration = Math.round((Date.now() - new Date(sessionStart).getTime()) / 1000);
    set({ isReading: false, sessionStart: null });
    try {
      await readingApi.createSession({ bookId, startPage, endPage, duration, startedAt: sessionStart, endedAt: new Date().toISOString() });
    } catch { /* non-critical: session tracking failure shouldn't block reading */ }
  },

  fetchHighlights: async (bookId) => {
    try {
      const res = await readingApi.getHighlights(bookId);
      set({ highlights: res.data });
    } catch { /* highlights fetch is non-blocking */ }
  },

  addHighlight: async (data) => {
    try {
      const res = await readingApi.addHighlight(data);
      set((state) => ({ highlights: [...state.highlights, res.data] }));
    } catch (err: any) { console.error('addHighlight failed:', err?.message || err); }
  },

  clearCurrent: () => {
    set({ currentProgress: null, highlights: [], isReading: false, sessionStart: null });
  },
}));
