import { create } from 'zustand';
import type { Book, BookCategory, BookFilter, PaginatedResponse } from '@/types';
import { bookApi } from '@/utils/api';

interface BookState {
  books: Book[];
  categories: BookCategory[];
  currentBook: Book | null;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  filters: BookFilter;
  isLoading: boolean;
  error: string | null;

  fetchBooks: (reset?: boolean) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchBookById: (id: string) => Promise<void>;
  searchBooks: (query: string) => Promise<void>;
  setFilters: (filters: Partial<BookFilter>) => void;
  setPage: (page: number) => void;
  clearBooks: () => void;
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  categories: [],
  currentBook: null,
  pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
  filters: { sortBy: 'createdAt', sortOrder: 'desc' },
  isLoading: false,
  error: null,

  fetchBooks: async (reset = true) => {
    set({ isLoading: true, error: null });
    try {
      const { filters, pagination } = get();
      const page = reset ? 1 : pagination.page;
      const res = await bookApi.getBooks({ ...filters, page, pageSize: pagination.pageSize });
      const data = res.data as PaginatedResponse<Book>;
      set((state) => ({
        books: reset ? data.data : [...state.books, ...data.data],
        pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err?.message || '获取图书失败', isLoading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const res = await bookApi.getCategories();
      set({ categories: res.data });
    } catch {}
  },

  fetchBookById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await bookApi.getBookById(id);
      set({ currentBook: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || '获取图书详情失败', isLoading: false });
    }
  },

  searchBooks: async (query) => {
    set({ filters: { ...get().filters, search: query }, isLoading: true, error: null });
    try {
      const res = await bookApi.getBooks({ search: query, page: 1, pageSize: get().pagination.pageSize });
      const data = res.data as PaginatedResponse<Book>;
      set({ books: data.data, pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages }, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || '搜索失败', isLoading: false });
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },

  setPage: (page) => {
    set((state) => ({ pagination: { ...state.pagination, page } }));
  },

  clearBooks: () => {
    set({ books: [], currentBook: null, pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 } });
  },
}));
