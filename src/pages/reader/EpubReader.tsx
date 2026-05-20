import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ePub, { Book, Rendition, NavItem } from 'epubjs';
import {
  ChevronLeft, ChevronRight, List, Bookmark,
  Sun, Moon, BookOpen, Maximize2, Minimize2,
  Type, Highlighter, Pencil, Heart, X, Sparkles, MessageSquare
} from 'lucide-react';
import { useReadingStore } from '@/stores/readingStore';
import { useAiStore } from '@/stores/aiStore';
import { favoriteApi } from '@/utils/api';

import AIAssistant from './AIAssistant';

const THEME_MODES = {
  light: { label: '日间', icon: Sun, bg: '#ffffff', text: '#1a1a2e', toolbar: '#f8f9fc', readerBg: '#ffffff', readerText: '#1a1a2e' },
  sepia: { label: '护眼', icon: BookOpen, bg: '#f4ecd8', text: '#5b4636', toolbar: '#ede4cc', readerBg: '#f4ecd8', readerText: '#5b4636' },
  dark: { label: '夜间', icon: Moon, bg: '#1a1a2e', text: '#e2e8f0', toolbar: '#252540', readerBg: '#1a1a2e', readerText: '#e2e8f0' },
};

type ThemeMode = keyof typeof THEME_MODES;

const FONT_SIZES = [
  { key: 'sm', label: '小', size: '14px' },
  { key: 'md', label: '中', size: '16px' },
  { key: 'lg', label: '大', size: '20px' },
  { key: 'xl', label: '特大', size: '24px' },
];

const HIGHLIGHT_COLORS = [
  { key: 'yellow', bg: 'rgba(250, 204, 21, 0.35)', border: '#facc15', label: '黄色' },
  { key: 'green', bg: 'rgba(52, 211, 153, 0.35)', border: '#34d399', label: '绿色' },
  { key: 'blue', bg: 'rgba(96, 165, 250, 0.35)', border: '#60a5fa', label: '蓝色' },
  { key: 'pink', bg: 'rgba(251, 113, 133, 0.35)', border: '#fb7185', label: '粉色' },
  { key: 'purple', bg: 'rgba(192, 132, 252, 0.35)', border: '#c084fc', label: '紫色' },
];

interface EpubReaderProps {
  url: string;
  bookId: string;
  bookTitle?: string;
  onProgressChange?: (cfi: string, percentage: number) => void;
  onNavigateBack?: () => void;
  onQuizAvailable?: () => void;
}

export default function EpubReader({ url, bookId, bookTitle, onProgressChange, onNavigateBack, onQuizAvailable }: EpubReaderProps) {
  const { t } = useTranslation();
  const { currentProgress, fetchProgress, saveProgress, highlights, fetchHighlights, addHighlight } = useReadingStore();
  const { isOpen: aiOpen, toggleOpen: toggleAi } = useAiStore();

  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [fontSize, setFontSize] = useState('md');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [currentCfi, setCurrentCfi] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [totalLocations, setTotalLocations] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'toc' | 'bookmarks'>('toc');
  const [bookmarks, setBookmarks] = useState<{ id: string; cfi: string; label?: string; page?: number }[]>([]);
  const [showHighlighter, setShowHighlighter] = useState(false);
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showFontSize, setShowFontSize] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [showBrightness, setShowBrightness] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ text: string; cfiRange: string } | null>(null);
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 });
  const [pageText, setPageText] = useState('');

  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const readerAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProgress(bookId);
    fetchHighlights(bookId);
    favoriteApi.checkFavorite(bookId).then((res) => {
      const data = res.data as any;
      setIsFavorite(data?.isFavorite ?? false);
    }).catch(() => {});
    // Load bookmarks from backend
    favoriteApi.getBookmarks(bookId).then((res) => {
      setBookmarks((res.data || []) as any[]);
    }).catch(() => {});
  }, [bookId]);

  useEffect(() => {
    if (!url) return;

    const book = ePub(encodeURI(url));
    bookRef.current = book;

    book.ready.then(() => {
      const rendition = book.renderTo(readerAreaRef.current!, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
      });
      renditionRef.current = rendition;

      rendition.themes.register('light', {
        body: { 'background-color': '#ffffff', 'color': '#1a1a2e', 'font-family': 'Georgia, "Noto Serif SC", serif', 'line-height': '1.8', 'padding': '20px 40px !important' },
        'p, div, span, li, td, th, blockquote, pre': { 'font-family': 'Georgia, "Noto Serif SC", serif' },
        'a': { 'color': '#6366f1' },
      });
      rendition.themes.register('sepia', {
        body: { 'background-color': '#f4ecd8', 'color': '#5b4636', 'font-family': 'Georgia, "Noto Serif SC", serif', 'line-height': '1.8', 'padding': '20px 40px !important' },
        'p, div, span, li, td, th, blockquote, pre': { 'font-family': 'Georgia, "Noto Serif SC", serif' },
        'a': { 'color': '#8b6914' },
      });
      rendition.themes.register('dark', {
        body: { 'background-color': '#1a1a2e', 'color': '#e2e8f0', 'font-family': 'Georgia, "Noto Serif SC", serif', 'line-height': '1.8', 'padding': '20px 40px !important' },
        'p, div, span, li, td, th, blockquote, pre': { 'font-family': 'Georgia, "Noto Serif SC", serif' },
        'a': { 'color': '#818cf8' },
        'img': { 'opacity': '0.9' },
      });
      rendition.themes.select('light');
      rendition.themes.fontSize(FONT_SIZES.find(f => f.key === fontSize)?.size || '16px');

      rendition.on('relocated', (location: any) => {
        setCurrentCfi(location.start.cfi);
        setPercentage(Math.round(location.start.percentage * 100));
        setCurrentLocation(location.start.location);
        if (onProgressChange) {
          onProgressChange(location.start.cfi, location.start.percentage);
        }
        try {
          const contents = (rendition as any).contents;
          if (contents && contents.window && contents.window.document) {
            const body = contents.window.document.body;
            if (body) {
              setPageText((body.textContent || body.innerText || '').replace(/\s+/g, ' ').trim().substring(0, 3000));
            }
          }
        } catch {}
      });

      rendition.on('selected', (cfiRange: string, contents: any) => {
        const text = contents.window.getSelection().toString().trim();
        if (text) {
          const range = contents.window.getSelection().getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const readerRect = readerAreaRef.current?.getBoundingClientRect();
          if (readerRect) {
            setSelectionPos({
              x: rect.left + rect.width / 2,
              y: rect.top - readerRect.top + 44,
            });
          }
          setSelection({ text, cfiRange });
          setShowSelectionMenu(true);
        }
      });

      rendition.on('markClicked', () => {
        setShowSelectionMenu(false);
      });

      book.loaded.navigation.then((nav: any) => {
        setToc(nav.toc || []);
      });

      book.locations.generate(1024).then(() => {
        setTotalLocations(book.locations.length());
        if (currentProgress?.lastPosition) {
          rendition.display(currentProgress.lastPosition);
        } else {
          rendition.display();
        }
        setLoading(false);
      });

      rendition.on('click', () => {
        setShowSelectionMenu(false);
        setShowFontSize(false);
      });
    }).catch((err: any) => {
      console.error('EPUB loading error:', err);
      setError(t('common.loading') + ': ' + (err?.message || ''));
      setLoading(false);
    });

    return () => {
      if (renditionRef.current) {
        renditionRef.current.destroy();
        renditionRef.current = null;
      }
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, [url]);

  const quizPromptShownRef = useRef(false);

  useEffect(() => {
    if (bookId && currentCfi && totalLocations > 0) {
      const timer = setTimeout(async () => {
        const result = await saveProgress(bookId, currentLocation, totalLocations, currentCfi);
        if (result?.quizAvailable && !quizPromptShownRef.current && onQuizAvailable) {
          quizPromptShownRef.current = true;
          onQuizAvailable();
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentCfi, bookId, totalLocations]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    rendition.themes.select(themeMode);
    rendition.themes.fontSize(FONT_SIZES.find(f => f.key === fontSize)?.size || '16px');
  }, [themeMode, fontSize]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  function goPrev() {
    renditionRef.current?.prev();
  }

  function goNext() {
    renditionRef.current?.next();
  }

  function navigateToToc(item: NavItem) {
    renditionRef.current?.display(item.href);
    setShowOutline(false);
  }

  async function addBookmarkAtLocation() {
    if (currentCfi && !bookmarks.some(b => b.cfi === currentCfi)) {
      try {
        const res = await favoriteApi.addBookmark({ bookId, cfi: currentCfi, page: currentLocation });
        const newBookmark = res.data as any;
        setBookmarks(prev => [...prev, newBookmark]);
      } catch { /* bookmark save failure is non-blocking */ }
    }
  }

  function handleSelectionAction(action: 'highlight' | 'define' | 'translate' | 'explain') {
    if (!selection) return;
    const { text, cfiRange } = selection;
    const { defineWord, translateText, explainText } = useAiStore.getState();

    if (action === 'highlight') {
      renditionRef.current?.annotations.highlight(cfiRange, {}, () => {}, 'epub-highlight', {
        fill: HIGHLIGHT_COLORS.find(c => c.key === highlightColor)?.bg || 'rgba(250, 204, 21, 0.35)',
      });
      addHighlight({ bookId, text, color: highlightColor, page: currentLocation });
    } else if (action === 'define') {
      if (!aiOpen) toggleAi();
      defineWord(text, bookId);
    } else if (action === 'translate') {
      if (!aiOpen) toggleAi();
      translateText(text, bookId, currentLocation);
    } else if (action === 'explain') {
      if (!aiOpen) toggleAi();
      explainText(text, bookId, currentLocation);
    }

    setShowSelectionMenu(false);
    setSelection(null);
    (renditionRef.current as any)?.contents?.window?.getSelection()?.removeAllRanges();
  }

  function handleAddNote() {
    if (!noteText.trim()) return;
    addHighlight({ bookId, text: noteText, color: 'yellow', page: currentLocation, note: noteText });
    setNoteText('');
    setShowNote(false);
  }

  function handleKeyNav(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goPrev();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      goNext();
    }
  }

  const theme = THEME_MODES[themeMode];

  const themeLabelMap: Record<ThemeMode, string> = {
    light: t('reader.dayTheme'),
    sepia: t('reader.eyeCareTheme'),
    dark: t('reader.nightTheme'),
  };

  const fontSizeLabelMap: Record<string, string> = {
    sm: t('common.small'),
    md: t('common.medium'),
    lg: t('common.large'),
    xl: t('common.extraLarge'),
  };

  const highlightColorLabelMap: Record<string, string> = {
    yellow: t('common.yellow'),
    green: t('common.green'),
    blue: t('common.blue'),
    pink: t('common.pink'),
    purple: t('common.purple'),
  };

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col z-50" style={{ background: theme.bg, color: theme.text }}>
        <header className="h-11 flex items-center px-3 shrink-0 border-b" style={{ background: theme.toolbar, borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
          {onNavigateBack && (
            <button onClick={onNavigateBack} className="p-1.5 -ml-1 rounded-md transition-colors duration-150 hover:opacity-70" style={{ color: theme.text }}>
              <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>
          )}
          <div className="flex-1 min-w-0 text-center px-3">
            <h1 className="text-[13px] font-medium truncate" style={{ color: theme.text, opacity: 0.85 }}>{bookTitle || t('common.loading')}</h1>
          </div>
          <div className="w-[60px]" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center animate-fade-in max-w-md px-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6" style={{ background: 'rgba(239,68,68,0.08)' }}>
              <BookOpen className="w-10 h-10" style={{ color: '#ef4444' }} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: theme.text }}>{t('common.error', { defaultValue: 'Cannot open file' })}</h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: theme.text, opacity: 0.5 }}>{error}</p>
            <button onClick={onNavigateBack} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors" style={{ color: theme.text, background: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              {t('common.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col z-50 select-none"
      style={{ background: theme.bg, color: theme.text }}
      onKeyDown={handleKeyNav}
      tabIndex={0}
    >
      <header
        className="h-11 flex items-center px-3 shrink-0 border-b transition-colors duration-200"
        style={{ background: theme.toolbar, borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
      >
        {onNavigateBack && (
          <button onClick={onNavigateBack} className="p-1.5 -ml-1 rounded-md transition-colors duration-150 hover:opacity-70" style={{ color: theme.text }}>
            <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
        )}

        <div className="flex-1 min-w-0 text-center px-3">
          <h1 className="text-[13px] font-medium truncate" style={{ color: theme.text, opacity: 0.85 }}>
            {bookTitle || t('common.loading')}
          </h1>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowOutline(!showOutline)}
            className="p-1.5 rounded-md transition-colors duration-150 hover:opacity-70"
            style={{ color: theme.text, opacity: 0.6 }}
            title={t('reader.tableOfContents')}
          >
            <List className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={addBookmarkAtLocation}
            className="p-1.5 rounded-md transition-colors duration-150 hover:opacity-70"
            style={{ color: bookmarks.length > 0 ? '#facc15' : theme.text, opacity: bookmarks.length > 0 ? 1 : 0.6 }}
            title={t('reader.bookmarks')}
          >
            <Bookmark className="w-4 h-4" strokeWidth={1.5} fill={bookmarks.length > 0 ? 'currentColor' : 'none'} />
          </button>
          <div className="w-px h-4 mx-1" style={{ background: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
          <div className="relative">
            <button
              onClick={() => setShowFontSize(!showFontSize)}
              className="p-1.5 rounded-md transition-colors duration-150 hover:opacity-70"
              style={{ color: theme.text, opacity: 0.6 }}
              title={t('reader.fontSize')}
            >
              <Type className="w-4 h-4" strokeWidth={1.5} />
            </button>
            {showFontSize && (
              <div
                className="absolute right-0 top-full mt-1 p-2 rounded-lg shadow-3 animate-scale-in z-50"
                style={{ background: themeMode === 'dark' ? '#2a2a48' : '#fff', border: themeMode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-1">
                  {FONT_SIZES.map(fs => (
                    <button
                      key={fs.key}
                      onClick={() => { setFontSize(fs.key); setShowFontSize(false); }}
                      className="px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-150"
                      style={{
                        background: fontSize === fs.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: fontSize === fs.key ? '#6366f1' : theme.text,
                      }}
                    >
                      {fontSizeLabelMap[fs.key] || fs.key}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="w-px h-4 mx-1" style={{ background: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
          <div className="relative">
            <button
              onClick={() => setShowBrightness(!showBrightness)}
              className="p-1.5 rounded-md transition-colors duration-150 hover:opacity-70"
              style={{ color: theme.text, opacity: 0.6 }}
              title={t('reader.brightness')}
            >
              <Sun className="w-4 h-4" strokeWidth={1.5} />
            </button>
            {showBrightness && (
              <div
                className="absolute right-0 top-full mt-1 p-3 rounded-lg shadow-3 animate-scale-in z-50 flex items-center gap-2"
                style={{ background: themeMode === 'dark' ? '#2a2a48' : '#fff', border: themeMode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)' }}
                onClick={e => e.stopPropagation()}
              >
                <span className="text-[11px] opacity-50" style={{ color: theme.text }}>☀</span>
                <input type="range" min="20" max="100" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-20 h-1 accent-accent" />
                <span className="text-[11px] opacity-50" style={{ color: theme.text }}>☀</span>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              const modes = Object.keys(THEME_MODES) as ThemeMode[];
              const next = modes[(modes.indexOf(themeMode) + 1) % modes.length];
              setThemeMode(next);
            }}
            className="p-1.5 rounded-md transition-colors duration-150 hover:opacity-70"
            style={{ color: theme.text, opacity: 0.6 }}
            title={`${t('reader.theme')}: ${themeLabelMap[themeMode]}`}
          >
            {themeMode === 'light' && <Sun className="w-4 h-4" strokeWidth={1.5} />}
            {themeMode === 'sepia' && <BookOpen className="w-4 h-4" strokeWidth={1.5} />}
            {themeMode === 'dark' && <Moon className="w-4 h-4" strokeWidth={1.5} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md transition-colors duration-150 hover:opacity-70"
            style={{ color: theme.text, opacity: 0.6 }}
            title={isFullscreen ? t('reader.exitFullscreen') : t('reader.fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" strokeWidth={1.5} /> : <Maximize2 className="w-4 h-4" strokeWidth={1.5} />}
          </button>
          <button
            onClick={toggleAi}
            className={`p-1.5 rounded-md transition-colors duration-150 ${aiOpen ? '' : 'hover:opacity-70'}`}
            style={{ color: aiOpen ? '#6366f1' : theme.text, opacity: aiOpen ? 1 : 0.6, background: aiOpen ? 'rgba(99,102,241,0.1)' : undefined }}
            title={t('reader.aiAssistant')}
          >
            <Sparkles className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {showOutline && (
          <div
            className="w-64 shrink-0 border-r overflow-y-auto animate-fade-in"
            style={{ background: theme.toolbar, borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center gap-1 p-2 border-b" style={{ borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
              {(['toc', 'bookmarks'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className="flex-1 text-[11px] font-medium py-1.5 rounded-md transition-colors duration-150"
                  style={{
                    background: sidebarTab === tab ? (themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent',
                    color: theme.text,
                    opacity: sidebarTab === tab ? 1 : 0.5,
                  }}
                >
                  {tab === 'toc' ? t('reader.tableOfContents') : t('reader.bookmarks')}
                </button>
              ))}
            </div>
            <div className="p-2">
              {sidebarTab === 'toc' && (
                toc.length > 0 ? (
                  <TocItems items={toc} onNavigate={navigateToToc} depth={0} theme={themeMode} />
                ) : (
                  <p className="text-xs text-center py-8" style={{ color: theme.text, opacity: 0.4 }}>{t('reader.noSearchResults')}</p>
                )
              )}
              {sidebarTab === 'bookmarks' && (
                bookmarks.length > 0 ? (
                  <div className="space-y-0.5">
                    {bookmarks.map((bm, idx) => (
                      <button
                        key={bm.id || idx}
                        onClick={() => { renditionRef.current?.display(bm.cfi); setShowOutline(false); }}
                        className="w-full text-left px-3 py-2 rounded-md text-xs transition-colors duration-150 hover:opacity-80"
                        style={{ background: themeMode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', color: theme.text }}
                      >
                        <Bookmark className="w-3 h-3 inline mr-2" fill="currentColor" style={{ color: '#facc15' }} />
                        {bm.label || `${t('reader.bookmarks')} ${idx + 1}`}
                        {bm.page ? <span className="ml-2 opacity-40">p.{bm.page}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center py-8" style={{ color: theme.text, opacity: 0.4 }}>{t('reader.bookmarks')}</p>
                )
              )}
            </div>
          </div>
        )}

        <div
          className="flex-1 relative overflow-hidden"
          onClick={() => { setShowSelectionMenu(false); setShowFontSize(false); }}
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ background: theme.bg }}>
              <div className="w-10 h-10 border-2 rounded-full animate-spin mb-4" style={{ borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', borderTopColor: '#6366f1' }} />
              <p className="text-sm" style={{ color: theme.text, opacity: 0.5 }}>{t('common.loading')}</p>
            </div>
          )}

          <div
            ref={readerAreaRef}
            className="w-full h-full select-none"
            style={{ background: theme.readerBg, filter: `brightness(${brightness / 100})`, userSelect: 'none' }}
            onContextMenu={(e) => e.preventDefault()}
          />

          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all duration-200 hover:scale-105"
            style={{
              background: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
              color: theme.text,
              boxShadow: themeMode === 'dark' ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.1)',
              opacity: 0.7,
            }}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all duration-200 hover:scale-105"
            style={{
              background: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
              color: theme.text,
              boxShadow: themeMode === 'dark' ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.1)',
              opacity: 0.7,
            }}
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {aiOpen && (
          <div
            className="w-[360px] border-l shrink-0 animate-fade-in flex flex-col"
            style={{
              background: themeMode === 'dark' ? '#1e1e36' : '#fafafe',
              borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <AIAssistant bookId={bookId} currentPage={currentLocation} pageText={pageText} />
          </div>
        )}
      </div>

      {showSelectionMenu && selection && (
        <div
          className="fixed z-[60] animate-scale-in"
          style={{
            left: `${selectionPos.x}px`,
            top: `${selectionPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center gap-0.5 px-1.5 py-1 rounded-xl shadow-3"
            style={{
              background: themeMode === 'dark' ? '#2a2a48' : '#ffffff',
              border: themeMode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
            }}
          >
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => { setHighlightColor(c.key); handleSelectionAction('highlight'); }}
                className="w-6 h-6 rounded-md transition-transform duration-150 hover:scale-110"
                style={{ background: c.bg, border: `1.5px solid ${c.border}` }}
                title={highlightColorLabelMap[c.key] || c.key}
              />
            ))}
            <div className="w-px h-5 mx-0.5" style={{ background: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }} />
            <button
              onClick={() => handleSelectionAction('explain')}
              className="p-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150 hover:opacity-80"
              style={{ color: theme.text, background: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
              title={t('reader.explain')}
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => handleSelectionAction('translate')}
              className="p-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150 hover:opacity-80"
              style={{ color: theme.text, background: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
              title={t('reader.translate')}
            >
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      <footer
        className="h-11 flex items-center justify-between px-4 shrink-0 border-t transition-colors duration-200"
        style={{ background: theme.toolbar, borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-1">
          {showHighlighter ? (
            <div className="flex items-center gap-2">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setHighlightColor(c.key)}
                  className="w-5 h-5 rounded-full transition-transform duration-150"
                  style={{
                    background: c.bg,
                    border: highlightColor === c.key ? `2px solid ${c.border}` : '1.5px solid transparent',
                    transform: highlightColor === c.key ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
              <button
                onClick={() => setShowHighlighter(false)}
                className="p-1 rounded-md transition-colors duration-150 hover:opacity-70"
                style={{ color: theme.text, opacity: 0.4 }}
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ) : showNote ? (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder={t('reader.askQuestion')}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                className="flex-1 bg-transparent text-sm focus:outline-none"
                style={{ color: theme.text }}
                autoFocus
              />
              <button
                onClick={handleAddNote}
                className="text-[11px] font-medium px-2 py-1 rounded-md transition-colors duration-150"
                style={{ color: '#6366f1', background: 'rgba(99,102,241,0.1)' }}
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => setShowNote(false)}
                className="p-1 rounded-md transition-colors duration-150 hover:opacity-70"
                style={{ color: theme.text, opacity: 0.4 }}
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowHighlighter(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 hover:opacity-80"
                style={{ color: theme.text, opacity: 0.6, background: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
              >
                <Highlighter className="w-3 h-3" strokeWidth={1.5} />
                {t('reader.highlight')}
              </button>
              <button
                onClick={() => setShowNote(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 hover:opacity-80"
                style={{ color: theme.text, opacity: 0.6, background: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
              >
                <Pencil className="w-3 h-3" strokeWidth={1.5} />
                {t('reader.notes')}
              </button>
              <button
                onClick={async () => {
                  try {
                    if (isFavorite) {
                      await favoriteApi.removeFavorite(bookId);
                      setIsFavorite(false);
                    } else {
                      await favoriteApi.addFavorite(bookId);
                      setIsFavorite(true);
                    }
                  } catch {}
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150"
                style={{
                  color: isFavorite ? '#ef4444' : theme.text,
                  opacity: isFavorite ? 1 : 0.6,
                  background: isFavorite ? 'rgba(239,68,68,0.1)' : (themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                }}
              >
                <Heart className="w-3 h-3" strokeWidth={1.5} fill={isFavorite ? 'currentColor' : 'none'} />
                {t('nav.favorites')}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="p-1 rounded-md transition-colors duration-150 hover:opacity-80"
            style={{ color: theme.text, opacity: 0.5 }}
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-[12px] font-mono tabular-nums px-2 py-0.5 rounded-md" style={{ color: theme.text, opacity: 0.7, background: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
            {percentage}%
          </span>
          <button
            onClick={goNext}
            className="p-1 rounded-md transition-colors duration-150 hover:opacity-80"
            style={{ color: theme.text, opacity: 0.5 }}
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center">
          <div
            className="h-1 w-24 rounded-full overflow-hidden"
            style={{ background: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${percentage}%`,
                background: '#6366f1',
              }}
            />
          </div>
          <span className="text-[10px] font-mono tabular-nums ml-2" style={{ color: theme.text, opacity: 0.35 }}>
            {percentage}%
          </span>
        </div>
      </footer>
    </div>
  );
}

function TocItems({ items, onNavigate, depth, theme }: { items: NavItem[]; onNavigate: (item: NavItem) => void; depth: number; theme: string }) {
  return (
    <div className="space-y-0.5">
      {items.map((item, idx) => (
        <div key={idx}>
          <button
            onClick={() => onNavigate(item)}
            className="w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors duration-150 hover:opacity-80"
            style={{
              paddingLeft: `${12 + depth * 16}px`,
              color: theme === 'dark' ? '#e2e8f0' : '#1a1a2e',
              background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              opacity: 0.75,
            }}
          >
            {item.label}
          </button>
          {item.subitems && item.subitems.length > 0 && (
            <TocItems items={item.subitems} onNavigate={onNavigate} depth={depth + 1} theme={theme} />
          )}
        </div>
      ))}
    </div>
  );
}
