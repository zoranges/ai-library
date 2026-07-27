import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Mic, X, BookOpen, Languages, Volume2, HelpCircle, FileText, StopCircle, Loader2 } from 'lucide-react';
import { useAiStore } from '@/stores/aiStore';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import Markdown from '@/components/ui/Markdown';

const QUICK_ACTIONS = [
  { key: 'explain', icon: HelpCircle, promptKey: 'ai.promptExplain' },
  { key: 'define', icon: BookOpen, promptKey: 'ai.promptDefine' },
  { key: 'translate', icon: Languages, promptKey: 'ai.promptTranslate' },
  { key: 'summarize', icon: FileText, promptKey: 'ai.promptSummarize' },
  { key: 'readaloud', icon: Volume2, promptKey: '__READ_ALOUD__' },
];

const QUICK_ACTION_LABELS: Record<string, string> = {
  explain: 'reader.explain',
  define: 'reader.define',
  translate: 'reader.translate',
  summarize: 'reader.summarize',
  readaloud: 'ai.readAloud',
};

const SPEECH_LANGS: Record<string, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ms: 'ms-MY',
  ta: 'ta-IN',
};

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^[*-]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/>\s+/g, '')
    .replace(/^---+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

interface AIAssistantProps {
  bookId: string;
  currentPage: number;
  pageText?: string;
}

export default function AIAssistant({ bookId, currentPage, pageText }: AIAssistantProps) {
  const { t, i18n } = useTranslation();
  const { messages, isLoading, error, sendMessage, toggleOpen } = useAiStore();
  const [input, setInput] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isSpeakingPage, setIsSpeakingPage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    status: voiceStatus,
    error: voiceError,
    transcript: voiceTranscript,
    duration: voiceDuration,
    startRecording,
    stopRecording,
    clearTranscript,
    isSupported: voiceSupported,
  } = useVoiceInput();

  // Append transcript to input field (NOT auto-send, so user can edit)
  useEffect(() => {
    if (voiceTranscript) {
      setInput((prev) => {
        const separator = prev.trim() ? ' ' : '';
        return prev + separator + voiceTranscript;
      });
      clearTranscript();
    }
  }, [voiceTranscript]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset speaking state when component unmounts (stop any ongoing speech)
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakText = useCallback(
    (text: string, onStart: () => void, onEnd: () => void) => {
      if (!('speechSynthesis' in window)) {
        alert(t('reader.speechNotSupported'));
        return;
      }

      window.speechSynthesis.cancel();

      // Strip markdown for cleaner speech
      const plainText = stripMarkdown(text);
      if (!plainText) {
        onEnd();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.lang = SPEECH_LANGS[(i18n.language || 'zh').split('-')[0]] || 'en-US';
      utterance.rate = 1.0;

      utterance.onstart = () => {
        onStart();
      };

      utterance.onend = () => {
        onEnd();
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        onEnd();
      };

      onStart();
      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  function handleSpeakMessage(messageId: string, content: string) {
    if (speakingMessageId === messageId) {
      // Already speaking this message -- stop
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    // Also reset page-speaking state if active
    if (isSpeakingPage) {
      setIsSpeakingPage(false);
    }

    speakText(
      content,
      () => setSpeakingMessageId(messageId),
      () => setSpeakingMessageId(null),
    );
  }

  function handleReadPageAloud() {
    if (!pageText) return;

    if (isSpeakingPage) {
      // Already reading the page -- stop
      window.speechSynthesis.cancel();
      setIsSpeakingPage(false);
      return;
    }

    // Reset message-speaking state if active
    if (speakingMessageId) {
      setSpeakingMessageId(null);
    }

    speakText(
      pageText,
      () => setIsSpeakingPage(true),
      () => setIsSpeakingPage(false),
    );
  }

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
    if (key === 'readaloud') {
      handleReadPageAloud();
      return;
    }

    if (isLoading) return;
    const action = QUICK_ACTIONS.find((a) => a.key === key);
    if (!action) return;
    sendMessage(t(action.promptKey), bookId, currentPage, pageText);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 h-12 flex items-center justify-between border-b border-border shrink-0">
        <span className="text-sm font-semibold text-text-primary font-heading">{t('ai.title')}</span>
        <button
          onClick={toggleOpen}
          className="p-1.5 -mr-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors duration-micro ease-out-quart"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isActive =
              action.key === 'readaloud' ? isSpeakingPage : false;
            const labelKey = QUICK_ACTION_LABELS[action.key] || '';
            return (
              <button
                key={action.key}
                onClick={() => handleQuickAction(action.key)}
                disabled={isLoading && action.key !== 'readaloud'}
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-micro ease-out-quart ${
                  isActive
                    ? 'text-surface bg-accent'
                    : 'text-text-secondary bg-bg-tertiary hover:bg-accent-subtle hover:text-accent'
                }`}
              >
                {isActive && action.key === 'readaloud' ? (
                  <StopCircle className="w-3 h-3" strokeWidth={1.5} />
                ) : (
                  <Icon className="w-3 h-3" strokeWidth={1.5} />
                )}
                {isActive && action.key === 'readaloud' ? t('ai.stopReading') : t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages area */}
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
              {t('ai.placeholder')}
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isSpeaking = speakingMessageId === msg.id;
          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm relative ${
                  msg.role === 'user'
                    ? 'bg-accent-subtle text-accent-dark rounded-br-sm'
                    : 'bg-surface-raised text-text-primary rounded-bl-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap pr-0">{msg.content}</p>
                ) : (
                  <>
                    <Markdown content={msg.content} maxLength={500} />
                    {/* Speak button for AI messages */}
                    <div className="flex justify-end mt-1.5 -mb-0.5">
                      <button
                        onClick={() => handleSpeakMessage(msg.id, msg.content)}
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors duration-micro ease-out-quart ${
                          isSpeaking
                            ? 'text-surface bg-accent'
                            : 'text-text-tertiary hover:text-accent hover:bg-accent-subtle'
                        }`}
                        title={isSpeaking ? t('ai.stopReading') : t('ai.readAloud')}
                      >
                        {isSpeaking ? (
                          <StopCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

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

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-bg-tertiary rounded-lg border border-border px-3 py-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-colors duration-micro ease-out-quart">
            <input
              ref={inputRef}
              type="text"
              placeholder={voiceStatus === 'recording' ? t('ai.listening') : t('ai.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              disabled={voiceStatus === 'recording'}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-accent text-surface rounded-lg hover:bg-accent-hover transition-colors duration-micro ease-out-quart disabled:opacity-40 disabled:pointer-events-none"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
          </button>
          {voiceSupported && (
            <button
              onMouseDown={(e) => { e.preventDefault(); startRecording(); }}
              onMouseUp={stopRecording}
              onMouseLeave={() => { if (voiceStatus === 'recording') stopRecording(); }}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={stopRecording}
              disabled={voiceStatus === 'processing'}
              className={`p-2 rounded-lg transition-colors duration-micro ease-out-quart ${
                voiceStatus === 'recording'
                  ? 'bg-red-500 text-white animate-pulse'
                  : voiceStatus === 'processing'
                    ? 'bg-bg-tertiary text-text-tertiary'
                    : 'text-text-tertiary hover:text-accent hover:bg-bg-tertiary'
              }`}
              title={
                voiceStatus === 'recording' ? t('ai.stopListening') :
                voiceStatus === 'processing' ? t('ai.processing') :
                t('ai.holdToSpeak')
              }
            >
              {voiceStatus === 'recording' ? (
                <span className="text-xs font-mono font-bold tabular-nums leading-none">
                  {Math.floor(voiceDuration / 60)}:{(voiceDuration % 60).toFixed(0).padStart(2, '0')}
                </span>
              ) : voiceStatus === 'processing' ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <Mic className="w-4 h-4" strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
