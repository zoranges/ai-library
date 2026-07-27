import { create } from 'zustand';
import type { ChatMessage } from '@/types';
import { aiApi } from '@/utils/api';
import i18n from '@/i18n';

function genId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}

interface AiState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;

  sendMessage: (content: string, bookId?: string, page?: number, pageText?: string) => Promise<void>;
  explainText: (text: string, bookId: string, page: number) => Promise<void>;
  defineWord: (word: string, bookId: string) => Promise<void>;
  translateText: (text: string, bookId: string, page: number) => Promise<void>;
  addVoiceResult: (transcript: string, reply: string, books?: ChatMessage['metadata']['books']) => void;
  clearMessages: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

export const useAiStore = create<AiState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  isOpen: false,

  sendMessage: async (content, bookId, page, pageText) => {
    const userMessage: ChatMessage = {
      id: genId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      metadata: { bookId, page, type: 'chat' },
    };
    set((state) => ({ messages: [...state.messages, userMessage], isLoading: true, error: null }));
    try {
      const res = await aiApi.chat({ message: content, bookId, page, pageText, language: i18n.language });
      const data = res.data as any;
      const assistantMessage: ChatMessage = {
        id: data.id || genId(),
        role: 'assistant',
        content: data.content || data.message || '',
        timestamp: data.timestamp || new Date().toISOString(),
        metadata: { bookId, page, type: 'chat', books: data.metadata?.books },
      };
      set((state) => ({ messages: [...state.messages, assistantMessage], isLoading: false }));
    } catch (err: any) {
      set({ error: err?.message || 'AI 回复失败', isLoading: false });
    }
  },

  explainText: async (text, bookId, page) => {
    const userMessage: ChatMessage = {
      id: genId(),
      role: 'user',
      content: `${i18n.t('ai.explainPrefix')}${text}`,
      timestamp: new Date().toISOString(),
      metadata: { bookId, page, type: 'explain' },
    };
    set((state) => ({ messages: [...state.messages, userMessage], isLoading: true, error: null }));
    try {
      const res = await aiApi.explain({ text, bookId, page, language: i18n.language });
      const data = res.data as any;
      const assistantMessage: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: data.explanation || data.content || '',
        timestamp: new Date().toISOString(),
        metadata: { bookId, page, type: 'explain' },
      };
      set((state) => ({ messages: [...state.messages, assistantMessage], isLoading: false }));
    } catch (err: any) {
      set({ error: err?.message || '解释失败', isLoading: false });
    }
  },

  defineWord: async (word, bookId) => {
    const userMessage: ChatMessage = {
      id: genId(),
      role: 'user',
      content: `${i18n.t('ai.definePrefix')}${word}`,
      timestamp: new Date().toISOString(),
      metadata: { bookId, type: 'define' },
    };
    set((state) => ({ messages: [...state.messages, userMessage], isLoading: true, error: null }));
    try {
      const res = await aiApi.define({ word, bookId, language: i18n.language });
      const data = res.data as any;
      const defContent = data.word
        ? `${data.word} ${data.phonetic || data.pinyin || ''}\n\n${(data.definitions || []).map((d: any) => `${d.meaning}\n例: ${d.example || ''}`).join('\n\n')}${data.synonyms?.length ? `\n\n同义词: ${data.synonyms.join(', ')}` : ''}`
        : (data.definition || data.content || JSON.stringify(data));
      const assistantMessage: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: defContent,
        timestamp: new Date().toISOString(),
        metadata: { bookId, type: 'define' },
      };
      set((state) => ({ messages: [...state.messages, assistantMessage], isLoading: false }));
    } catch (err: any) {
      set({ error: err?.message || '定义查询失败', isLoading: false });
    }
  },

  translateText: async (text, bookId, page) => {
    const userMessage: ChatMessage = {
      id: genId(),
      role: 'user',
      content: `${i18n.t('ai.translatePrefix')}${text}`,
      timestamp: new Date().toISOString(),
      metadata: { bookId, page, type: 'translate' },
    };
    set((state) => ({ messages: [...state.messages, userMessage], isLoading: true, error: null }));
    try {
      const res = await aiApi.translate({ text, bookId, page, language: i18n.language });
      const data = res.data as any;
      const assistantMessage: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: data.translatedText || data.translation || data.content || '',
        timestamp: new Date().toISOString(),
        metadata: { bookId, page, type: 'translate' },
      };
      set((state) => ({ messages: [...state.messages, assistantMessage], isLoading: false }));
    } catch (err: any) {
      set({ error: err?.message || '翻译失败', isLoading: false });
    }
  },

  // Directly add user transcript + agent reply (voice full pipeline, no extra API call)
  addVoiceResult: (transcript, reply, books) => {
    const userMessage: ChatMessage = {
      id: genId(),
      role: 'user',
      content: transcript,
      timestamp: new Date().toISOString(),
      metadata: { type: 'voice' },
    };
    const assistantMessage: ChatMessage = {
      id: genId(),
      role: 'assistant',
      content: reply || '',
      timestamp: new Date().toISOString(),
      metadata: { type: 'voice', books: books || [] },
    };
    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isLoading: false,
    }));
  },

  clearMessages: () => set({ messages: [], error: null }),

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  setOpen: (open) => set({ isOpen: open }),
}));
