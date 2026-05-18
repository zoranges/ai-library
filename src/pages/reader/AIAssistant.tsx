import { useState, useRef, useEffect } from 'react';
import { Send, Mic, X, BookOpen, Languages, Volume2, HelpCircle } from 'lucide-react';
import { useAiStore } from '@/stores/aiStore';

const QUICK_ACTIONS = [
  { key: 'explain', label: '解释', icon: HelpCircle, prompt: '请帮我解释当前阅读内容中的重点和难点' },
  { key: 'define', label: '释义', icon: BookOpen, prompt: '请帮我解释当前阅读内容中出现的生词和术语' },
  { key: 'translate', label: '翻译', icon: Languages, prompt: '请帮我翻译当前阅读内容中的关键段落' },
  { key: 'summarize', label: '总结', icon: Volume2, prompt: '请帮我总结当前阅读内容的主要观点' },
];

interface AIAssistantProps {
  bookId: string;
  currentPage: number;
  pageText?: string;
}

export default function AIAssistant({ bookId, currentPage, pageText }: AIAssistantProps) {
  const { messages, isLoading, error, sendMessage, toggleOpen } = useAiStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage(text, bookId, currentPage, pageText);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleQuickAction(key: string) {
    const action = QUICK_ACTIONS.find(a => a.key === key);
    if (!action || isLoading) return;
    sendMessage(action.prompt, bookId, currentPage, pageText);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 h-12 flex items-center justify-between border-b border-border shrink-0">
        <span className="text-sm font-semibold text-text-primary font-heading">AI 阅读助手</span>
        <button
          onClick={toggleOpen}
          className="p-1.5 -mr-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors duration-micro ease-out-quart"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => handleQuickAction(action.key)}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-text-secondary bg-bg-tertiary rounded-md hover:bg-accent-subtle hover:text-accent transition-colors duration-micro ease-out-quart"
              >
                <Icon className="w-3 h-3" strokeWidth={1.5} />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-[12px] text-red-700 dark:text-red-400 animate-fade-in">
            {error}
          </div>
        )}
        {messages.length === 0 && !error && (
          <div className="text-center py-12 animate-fade-in">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent-subtle rounded-lg mb-3">
              <HelpCircle className="w-5 h-5 text-accent" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-text-tertiary leading-relaxed">
              问我任何关于<br />你正在阅读的内容
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent-subtle text-accent-dark rounded-br-sm'
                  : 'bg-surface-raised text-text-primary rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-surface-raised rounded-lg rounded-bl-sm px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
              <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '600ms' }} />
              <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-bg-tertiary rounded-lg border border-border px-3 py-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-colors duration-micro ease-out-quart">
            <input
              ref={inputRef}
              type="text"
              placeholder="输入问题..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-accent text-surface rounded-lg hover:bg-accent-hover transition-colors duration-micro ease-out-quart disabled:opacity-40 disabled:pointer-events-none"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button className="p-2 text-text-tertiary hover:text-accent hover:bg-bg-tertiary rounded-lg transition-colors duration-micro ease-out-quart">
            <Mic className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
