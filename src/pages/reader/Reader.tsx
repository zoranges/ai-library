import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EpubReader from './EpubReader';
import PdfFlipBook from './PdfFlipBook';

let pdfjsLib: any = null;
async function getPdfjsLib() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  return pdfjsLib;
}

import {
  ArrowLeft, ZoomIn, ZoomOut, Sparkles, ChevronLeft, ChevronRight,
  Highlighter, Pencil, Heart, X, Sun, Moon, BookOpen, List,
  Maximize2, Minimize2, MessageSquare, Bookmark,
  Volume2
} from 'lucide-react';
import AIAssistant from './AIAssistant';
import ReaderSprite3D from '@/components/ReaderSprite3D';
import { useReadingStore } from '@/stores/readingStore';
import { useAiStore } from '@/stores/aiStore';
import { useBookStore } from '@/stores/bookStore';
import { favoriteApi } from '@/utils/api';

const HIGHLIGHT_COLORS = [
  { key: 'yellow', bg: 'rgba(250, 204, 21, 0.35)', border: '#facc15', label: '黄色' },
  { key: 'green', bg: 'rgba(52, 211, 153, 0.35)', border: '#34d399', label: '绿色' },
  { key: 'blue', bg: 'rgba(96, 165, 250, 0.35)', border: '#60a5fa', label: '蓝色' },
  { key: 'pink', bg: 'rgba(251, 113, 133, 0.35)', border: '#fb7185', label: '粉色' },
  { key: 'purple', bg: 'rgba(192, 132, 252, 0.35)', border: '#c084fc', label: '紫色' },
];

const THEME_MODES = {
  light: { label: '日间', icon: Sun, bg: '#ffffff', text: '#1a1a2e', toolbar: '#f8f9fc' },
  sepia: { label: '护眼', icon: BookOpen, bg: '#f4ecd8', text: '#5b4636', toolbar: '#ede4cc' },
  dark: { label: '夜间', icon: Moon, bg: '#1a1a2e', text: '#e2e8f0', toolbar: '#252540' },
};

type ThemeMode = keyof typeof THEME_MODES;

interface TextSelection {
  text: string;
  rect: DOMRect | null;
  startOffset?: number;
}

interface PageHighlight {
  id: string;
  text: string;
  color: string;
  note?: string;
  page: number;
  startOffset?: number;
  rects?: Array<{ top: number; left: number; width: number; height: number }>;
}

function resolveFileType(book: { fileUrl?: string | null; fileType?: string | null } | null): string | null {
  if (!book?.fileUrl) return book?.fileType ?? null;
  const ext = book.fileUrl.split('.').pop()?.toLowerCase();
  if (ext === 'epub') return 'epub';
  if (ext === 'pdf') return 'pdf';
  return book.fileType ?? null;
}

export default function Reader() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentBook, fetchBookById } = useBookStore();
  const { currentProgress, fetchProgress, saveProgress, startSession, endSession, highlights, fetchHighlights, addHighlight } = useReadingStore();
  const { isOpen: aiOpen, toggleOpen: toggleAi } = useAiStore();

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [pageText, setPageText] = useState('');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showOutline, setShowOutline] = useState(false);
  const [outline, setOutline] = useState<any[]>([]);
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 });
  const [speakingSelection, setSpeakingSelection] = useState(false);
  const [quizPrompt, setQuizPrompt] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const [showPageJump, setShowPageJump] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'outline' | 'notes' | 'bookmarks'>('outline');
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [pageNotes, setPageNotes] = useState<PageHighlight[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(currentPage);
  const flipBookRef = useRef<any>(null);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (id) {
      fetchBookById(id);
      fetchProgress(id);
      fetchHighlights(id);
      startSession(id);
      favoriteApi.checkFavorite(id).then((res) => {
        const data = res.data as any;
        setIsFavorite(data?.isFavorite ?? false);
      }).catch(() => {});
    }
    return () => {
      if (id) endSession(id, currentPageRef.current, currentPageRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (currentProgress) {
      setCurrentPage(currentProgress.currentPage);
      setTotalPages(currentProgress.totalPages);
    } else if (currentBook) {
      setTotalPages(currentBook.pageCount || 0);
    }
  }, [currentProgress, currentBook]);

  const quizPromptShownRef = useRef(false);

  useEffect(() => {
    if (id && currentPage > 0 && totalPages > 0) {
      const timer = setTimeout(async () => {
        const result = await saveProgress(id, currentPage, totalPages);
        if (result?.quizAvailable && !quizPromptShownRef.current) {
          quizPromptShownRef.current = true;
          setQuizPrompt(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentPage, id, totalPages]);

  const loadingTaskRef = useRef<any>(null);

  useEffect(() => {
    if (!currentBook) {
      setPdfLoading(true);
      return;
    }
    if (!currentBook.fileUrl) {
      setPdfLoading(false);
      return;
    }
    if (resolveFileType(currentBook) === 'epub') {
      setPdfLoading(false);
      return;
    }

    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy();
      loadingTaskRef.current = null;
    }

    const url = encodeURI(currentBook.fileUrl);
    setPdfLoading(true);
    setPdfError(null);

    (async () => {
      const lib = await getPdfjsLib();
      const loadingTask = lib.getDocument(url);
      loadingTaskRef.current = loadingTask;

      loadingTask.promise.then(
        (pdf: any) => {
        loadingTaskRef.current = null;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        if (!currentProgress) {
          setCurrentPage(1);
        }
        setPdfLoading(false);
        pdf.getOutline().then((out) => {
          setOutline(out || []);
        });
      },
      (err) => {
        loadingTaskRef.current = null;
        if (err?.name === 'RenderingCancelledException' || err?.message?.includes('destroyed')) return;
        console.error('PDF loading error:', err);
        setPdfError(t('common.loading') + ': ' + (err?.message || ''));
        setPdfLoading(false);
      }
    );
    })();
  }, [currentBook?.fileUrl, currentBook?.fileType]);

  // Extract text for AI assistant
  useEffect(() => {
    if (!pdfDoc || currentPage < 1) return;
    let cancelled = false;
    pdfDoc.getPage(currentPage).then(async (page) => {
      const textContent = await page.getTextContent();
      if (cancelled) return;
      const text = textContent.items
        .map((item: any) => item.str)
        .filter((s: string) => s.trim())
        .join(' ');
      setPageText(text);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    setShowPageJump(false);
  }

  function handlePageJump() {
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      goToPage(num);
    } else {
      setPageInput(String(currentPage));
    }
    setShowPageJump(false);
  }

  function handleZoom(delta: number) {
    setScale((s) => Math.max(0.5, Math.min(4, s + delta)));
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  function handleTextSelect() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setShowSelectionMenu(false);
      setSelection(null);
      return;
    }
    const text = sel.toString().trim();
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Compute character offset within the text layer for precise highlight positioning
    let startOffset: number | undefined;
    const startNode = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) {
      const textLayer = (startNode.parentElement as HTMLElement)?.closest('.pdf-text-layer') as HTMLElement | null;
      if (textLayer) {
        const spans = Array.from(textLayer.querySelectorAll('span'));
        let offset = 0;
        for (const span of spans) {
          if (span === startNode.parentElement) {
            offset += range.startOffset;
            break;
          }
          offset += (span.textContent || '').length;
        }
        startOffset = offset;
      }
    }

    setSelection({ text, rect, startOffset });
    setSelectionPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
    setShowSelectionMenu(true);
  }

  function handleSelectionAction(action: 'highlight' | 'define' | 'translate' | 'explain', overrideColor?: string) {
    if (!selection) return;
    const { text } = selection;
    const { defineWord, translateText, explainText, sendMessage } = useAiStore.getState();

    if (action === 'highlight') {
      addHighlight({
        bookId: id || '',
        text,
        color: overrideColor || highlightColor,
        page: currentPage,
        startOffset: selection.startOffset,
      });
    } else if (action === 'define') {
      if (!aiOpen) toggleAi();
      defineWord(text, id || '');
    } else if (action === 'translate') {
      if (!aiOpen) toggleAi();
      translateText(text, id || '', currentPage);
    } else if (action === 'explain') {
      if (!aiOpen) toggleAi();
      explainText(text, id || '', currentPage);
    }

    window.getSelection()?.removeAllRanges();
    setShowSelectionMenu(false);
    setSelection(null);
  }

  function handleReadSelectionAloud() {
    if (!selection) return;
    if (!('speechSynthesis' in window)) return;

    if (speakingSelection) {
      window.speechSynthesis.cancel();
      setSpeakingSelection(false);
      return;
    }

    const u = new SpeechSynthesisUtterance(selection.text);
    u.lang = 'zh-CN';
    u.rate = 1.0;
    u.onstart = () => setSpeakingSelection(true);
    u.onend = () => setSpeakingSelection(false);
    u.onerror = () => setSpeakingSelection(false);
    window.speechSynthesis.speak(u);

    window.getSelection()?.removeAllRanges();
    setShowSelectionMenu(false);
    setSelection(null);
  }

  function handleAddNote() {
    if (!id || !noteText.trim()) return;
    addHighlight({ bookId: id, text: noteText, color: 'yellow', page: currentPage, note: noteText });
    setNoteText('');
    setShowNote(false);
  }

  function toggleBookmark() {
    setBookmarks((prev) =>
      prev.includes(currentPage)
        ? prev.filter((p) => p !== currentPage)
        : [...prev, currentPage]
    );
  }

  function navigateOutline(item: any) {
    if (item.dest) {
      pdfDoc?.getDestination(item.dest).then((dest) => {
        if (dest) {
          pdfDoc?.getPageIndex(dest[0]).then((pageIndex) => {
            goToPage(pageIndex + 1);
          });
        }
      });
    }
    setShowOutline(false);
  }

  const theme = THEME_MODES[themeMode];
  const pageHighlights = highlights.filter((h: any) => h.page === currentPage);

  const themeLabelMap: Record<ThemeMode, string> = {
    light: t('reader.dayTheme'),
    sepia: t('reader.eyeCareTheme'),
    dark: t('reader.nightTheme'),
  };

  const highlightColorLabelMap: Record<string, string> = {
    yellow: t('common.yellow'),
    green: t('common.green'),
    blue: t('common.blue'),
    pink: t('common.pink'),
    purple: t('common.purple'),
  };

  const progressPercent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const isDark = themeMode === 'dark';

  const headerBg = isDark ? 'rgba(26,26,46,0.85)' : 'rgba(255,255,255,0.85)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const btnHoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const btnActiveBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';

  if (resolveFileType(currentBook) === 'epub' && currentBook?.fileUrl) {
    return (
      <>
        <EpubReader
          url={currentBook.fileUrl}
          bookId={id || ''}
          bookTitle={currentBook.title}
          onNavigateBack={() => navigate(-1)}
          onQuizAvailable={() => setQuizPrompt(true)}
        />
        {quizPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setQuizPrompt(false)}>
            <div className="bg-surface rounded-2xl shadow-3 p-8 max-w-sm mx-4 text-center animate-[scale-in_0.25s_ease-out] z-10" onClick={(e) => e.stopPropagation()}>
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-extrabold text-text-primary mb-2">{t('quiz.title')}</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                {t('home.achievementsHint', 'You finished this book! Test your understanding with a quick quiz.')}
              </p>
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => { setQuizPrompt(false); navigate(`/quiz/${id}`); }}
                  className="px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent-hover transition-colors shadow-sm"
                >
                  {t('quiz.startQuiz')}
                </button>
                <button
                  onClick={() => setQuizPrompt(false)}
                  className="px-5 py-2.5 text-sm font-medium text-text-tertiary hover:text-text-primary transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (pdfError) {
    return (
      <div className="fixed inset-0 flex flex-col z-50" style={{ background: theme.bg, color: theme.text }}>
        <header
          className="flex items-center gap-2 px-4 h-12 shrink-0 border-b select-none backdrop-blur-xl"
          style={{ background: headerBg, borderColor: headerBorder }}
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-2 py-1.5 -ml-2 rounded-lg text-[13px] font-medium transition-all duration-200"
            style={{ color: theme.text, opacity: 0.7 }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = btnHoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent'; }}
          >
            <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
            {t('common.back')}
          </button>
          <div className="flex-1" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center animate-fade-in max-w-md px-6">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6"
              style={{ background: 'rgba(239,68,68,0.06)' }}>
              <BookOpen className="w-12 h-12" style={{ color: '#ef4444', opacity: 0.5 }} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: theme.text }}>
              {t('common.error', { defaultValue: 'Cannot open file' })}
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: theme.text, opacity: 0.45 }}>{pdfError}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={{ color: theme.text, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                {t('common.back')}
              </button>
              {currentBook && (
                <button
                  onClick={() => toggleAi()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 shadow-lg shadow-indigo-500/20"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                  {t('reader.aiAssistant')}
                </button>
              )}
            </div>
          </div>
        </div>
        {aiOpen && (
          <div
            className="fixed right-0 top-12 bottom-0 w-full max-w-[380px] border-l animate-fade-in flex flex-col shadow-2xl"
            style={{ background: isDark ? '#1e1e36' : '#fafafe', borderColor: headerBorder }}
          >
            <AIAssistant bookId={id || ''} currentPage={currentPage} pageText={pageText} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col z-50"
      style={{ background: theme.bg, color: theme.text }}
      onMouseUp={handleTextSelect}
    >
      {/* —— Header —— */}
      <header
        className="flex items-center gap-2 px-4 h-12 shrink-0 border-b select-none backdrop-blur-xl"
        style={{ background: headerBg, borderColor: headerBorder }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-2 py-1.5 -ml-2 rounded-lg text-[13px] font-medium transition-all duration-200"
          style={{ color: theme.text, opacity: 0.7 }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = btnHoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent'; }}
        >
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span className="hidden sm:inline">{t('common.back')}</span>
        </button>

        <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
          <BookOpen className="w-3.5 h-3.5 shrink-0 hidden sm:block" style={{ color: '#6366f1', opacity: 0.6 }} strokeWidth={1.5} />
          <h1 className="text-[13px] font-semibold truncate max-w-[320px]" style={{ color: theme.text, opacity: 0.9 }}>
            {currentBook?.title || t('common.loading')}
          </h1>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Outline */}
          <ToolbarBtn onClick={() => setShowOutline(!showOutline)} active={showOutline} title={t('reader.tableOfContents')} theme={theme} accented>
            <List className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </ToolbarBtn>
          {/* Bookmark */}
          <ToolbarBtn onClick={toggleBookmark} active={bookmarks.includes(currentPage)} title={t('reader.bookmarks')} theme={theme}>
            <Bookmark className="w-[18px] h-[18px]" strokeWidth={1.5} fill={bookmarks.includes(currentPage) ? '#facc15' : 'none'} style={{ color: bookmarks.includes(currentPage) ? '#facc15' : undefined }} />
          </ToolbarBtn>

          <Separator dark={isDark} />

          {/* Zoom controls */}
          <ToolbarBtn onClick={() => handleZoom(-0.25)} title={t('reader.zoomOut')} theme={theme}>
            <ZoomOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </ToolbarBtn>
          <span className="text-[11px] font-mono tabular-nums w-10 text-center select-none" style={{ color: theme.text, opacity: 0.55 }}>
            {Math.round(scale * 100)}%
          </span>
          <ToolbarBtn onClick={() => handleZoom(0.25)} title={t('reader.zoomIn')} theme={theme}>
            <ZoomIn className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </ToolbarBtn>

          <Separator dark={isDark} />

          {/* Theme toggle */}
          <ToolbarBtn
            onClick={() => {
              const modes = Object.keys(THEME_MODES) as ThemeMode[];
              setThemeMode(modes[(modes.indexOf(themeMode) + 1) % modes.length]);
            }}
            title={`${t('reader.theme')}: ${themeLabelMap[themeMode]}`}
            theme={theme}
          >
            {themeMode === 'light' && <Sun className="w-[18px] h-[18px]" strokeWidth={1.5} />}
            {themeMode === 'sepia' && <BookOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />}
            {themeMode === 'dark' && <Moon className="w-[18px] h-[18px]" strokeWidth={1.5} />}
          </ToolbarBtn>

          {/* Fullscreen */}
          <ToolbarBtn onClick={toggleFullscreen} title={isFullscreen ? t('reader.exitFullscreen') : t('reader.fullscreen')} theme={theme}>
            {isFullscreen ? <Minimize2 className="w-[18px] h-[18px]" strokeWidth={1.5} /> : <Maximize2 className="w-[18px] h-[18px]" strokeWidth={1.5} />}
          </ToolbarBtn>

          {/* AI */}
          <button
            onClick={toggleAi}
            className={`relative p-2 rounded-lg transition-all duration-200 ${aiOpen ? 'scale-105' : ''}`}
            style={{
              color: aiOpen ? '#fff' : '#6366f1',
              background: aiOpen ? '#6366f1' : 'rgba(99,102,241,0.1)',
            }}
            title={t('reader.aiAssistant')}
          >
            <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.5} />
            {aiOpen && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 ring-2 ring-white dark:ring-[#1a1a2e]" />
            )}
          </button>
        </div>
      </header>

      {/* —— Content —— */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Outline / Bookmarks sidebar */}
        {showOutline && (
          <div
            className="w-full sm:w-64 shrink-0 border-r overflow-y-auto animate-fade-in select-none backdrop-blur-sm"
            style={{ background: isDark ? 'rgba(26,26,46,0.7)' : 'rgba(255,255,255,0.7)', borderColor: headerBorder }}
          >
            <div className="flex items-center gap-1 p-2 border-b" style={{ borderColor: headerBorder }}>
              {(['outline', 'bookmarks'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className="flex-1 text-[12px] font-medium py-2 rounded-lg transition-all duration-150"
                  style={{
                    background: sidebarTab === tab ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
                    color: theme.text,
                    opacity: sidebarTab === tab ? 1 : 0.5,
                  }}
                >
                  {tab === 'outline' ? t('reader.tableOfContents') : t('reader.bookmarks')}
                </button>
              ))}
            </div>
            <div className="p-2">
              {sidebarTab === 'outline' && (
                outline.length > 0 ? (
                  <OutlineItems items={outline} onNavigate={navigateOutline} depth={0} theme={themeMode} />
                ) : (
                  <p className="text-xs text-center py-8" style={{ color: theme.text, opacity: 0.35 }}>{t('reader.noSearchResults')}</p>
                )
              )}
              {sidebarTab === 'bookmarks' && (
                bookmarks.length > 0 ? (
                  <div className="space-y-0.5">
                    {bookmarks.sort((a, b) => a - b).map((page) => (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-150"
                        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', color: theme.text }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                      >
                        <Bookmark className="w-3 h-3 inline mr-2" fill="currentColor" style={{ color: '#facc15' }} />
                        {t('common.page')} {page}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center py-8" style={{ color: theme.text, opacity: 0.35 }}>{t('reader.bookmarks')}</p>
                )
              )}
            </div>
          </div>
        )}

        {/* Main reading area */}
        <div
          className="flex-1 overflow-auto flex justify-center"
          style={{ background: isDark
            ? 'radial-gradient(ellipse at center, #1e1e36 0%, #1a1a2e 60%)'
            : themeMode === 'sepia'
              ? 'radial-gradient(ellipse at center, #f8f0dd 0%, #f4ecd8 60%)'
              : 'radial-gradient(ellipse at center, #f8f9fc 0%, #eef1f5 60%)'
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.pdf-text-layer')) {
              setShowSelectionMenu(false);
              setShowOutline(false);
            }
          }}
        >
          <div className="py-8 px-6 inline-flex flex-col items-center">
            {pdfLoading ? (
              <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full animate-spin" style={{
                    border: '2px solid transparent',
                    borderTopColor: '#6366f1',
                    borderRightColor: 'rgba(99,102,241,0.2)',
                  }} />
                  <BookOpen className="w-6 h-6 absolute inset-0 m-auto" style={{ color: '#6366f1', opacity: 0.5 }} strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium" style={{ color: theme.text, opacity: 0.4 }}>
                  {currentBook?.title || t('common.loading')}
                </p>
              </div>
            ) : !pdfDoc ? (
              <div className="flex flex-col items-center justify-center h-[70vh] max-w-lg text-center animate-fade-in">
                <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
                  style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                  <BookOpen className="w-12 h-12" style={{ color: '#6366f1', opacity: 0.3 }} strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: theme.text }}>{currentBook?.title}</h2>
                <p className="text-sm mb-1" style={{ color: theme.text, opacity: 0.5 }}>{currentBook?.author}</p>
                {currentBook?.description && (
                  <p className="text-sm leading-relaxed mt-4 mb-8 max-w-md" style={{ color: theme.text, opacity: 0.4 }}>{currentBook.description}</p>
                )}
                <button
                  onClick={() => { if (!aiOpen) toggleAi(); }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 shadow-lg shadow-indigo-500/20"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                  {t('reader.aiAssistant')}
                </button>
              </div>
            ) : (
              <PdfFlipBook
                ref={flipBookRef}
                pdfDoc={pdfDoc}
                currentPage={currentPage}
                scale={scale}
                themeMode={themeMode}
                onPageChange={(page) => setCurrentPage(page)}
                highlights={pageHighlights.map((h: any) => ({ text: h.text, color: h.color, startOffset: h.start_offset }))}
              />
            )}

            {/* Page highlights */}
            {pageHighlights.length > 0 && (
              <div className="w-full max-w-[720px] mt-8 space-y-3 animate-fade-in">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: theme.text, opacity: 0.35 }}>
                  <Highlighter className="w-3 h-3" strokeWidth={1.5} />
                  {t('reader.notes')}
                </h3>
                {pageHighlights.map((h: any) => (
                  <div
                    key={h.id}
                    className="p-4 rounded-xl border transition-colors duration-200"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
                      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      borderLeft: `3px solid ${HIGHLIGHT_COLORS.find(c => c.key === h.color)?.border || '#6366f1'}`,
                    }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: theme.text }}>{h.text}</p>
                    {h.note && (
                      <p className="text-xs mt-2 italic" style={{ color: theme.text, opacity: 0.45 }}>{h.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Floating prev / next buttons — fixed to viewport for mobile zoom */}
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="fixed left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 disabled:opacity-0 disabled:pointer-events-none disabled:scale-75 hover:scale-105 backdrop-blur-md group z-50"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)',
            color: theme.text,
            boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 4px 24px rgba(0,0,0,0.08)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.04)',
          }}
        >
          <ChevronLeft className="w-6 h-6 transition-transform duration-300 group-hover:-translate-x-0.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="fixed right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 disabled:opacity-0 disabled:pointer-events-none disabled:scale-75 hover:scale-105 backdrop-blur-md group z-50"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)',
            color: theme.text,
            boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 4px 24px rgba(0,0,0,0.08)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.04)',
          }}
        >
          <ChevronRight className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.5} />
        </button>

        {/* AI Sidebar */}
        {aiOpen && (
          <div
            className="w-full sm:w-[380px] border-l shrink-0 animate-fade-in flex flex-col shadow-2xl"
            style={{
              background: isDark ? '#1e1e36' : '#fafafe',
              borderColor: headerBorder,
            }}
          >
            <AIAssistant bookId={id || ''} currentPage={currentPage} pageText={pageText} />
          </div>
        )}
      </div>

      {/* —— Selection popup —— */}
      {showSelectionMenu && selection && (
        <div
          className="fixed z-[60] animate-scale-in"
          style={{ left: `${selectionPos.x}px`, top: `${selectionPos.y}px`, transform: 'translate(-50%, -100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex flex-wrap items-center justify-center gap-1 px-2 py-1.5 rounded-2xl shadow-2xl backdrop-blur-xl"
            style={{
              background: isDark ? 'rgba(42,42,72,0.95)' : 'rgba(255,255,255,0.95)',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => { setHighlightColor(c.key); handleSelectionAction('highlight', c.key); }}
                className="w-7 h-7 rounded-lg transition-all duration-150 hover:scale-110 hover:shadow-md"
                style={{ background: c.bg, border: `1.5px solid ${c.border}` }}
                title={highlightColorLabelMap[c.key] || c.key}
              />
            ))}
            <div className="w-px h-6 mx-0.5 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }} />
            <button
              onClick={() => handleSelectionAction('explain')}
              className="p-2 rounded-xl transition-all duration-150 hover:scale-105"
              style={{ color: '#6366f1', background: 'rgba(99,102,241,0.08)' }}
              title={t('reader.explain')}
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => handleSelectionAction('translate')}
              className="p-2 rounded-xl transition-all duration-150 hover:scale-105"
              style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.08)' }}
              title={t('reader.translate')}
            >
              <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={handleReadSelectionAloud}
              className="p-2 rounded-xl transition-all duration-150 hover:scale-105"
              style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }}
              title={t('ai.readAloud')}
            >
              <Volume2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
          {/* Arrow */}
          <div className="w-3 h-3 mx-auto -mt-px rotate-45 rounded-sm"
            style={{ background: isDark ? 'rgba(42,42,72,0.95)' : 'rgba(255,255,255,0.95)' }} />
        </div>
      )}

      {/* —— Footer —— */}
      <footer
        className="flex items-center gap-4 px-5 h-12 shrink-0 border-t select-none backdrop-blur-xl"
        style={{ background: headerBg, borderColor: headerBorder }}
      >
        {/* Left: highlight & note tools */}
        <div className="flex items-center gap-1.5">
          {showNote ? (
            <div className="flex items-center gap-2 animate-scale-in">
              <input
                type="text"
                placeholder={t('reader.askQuestion')}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                className="w-48 bg-transparent text-sm focus:outline-none"
                style={{ color: theme.text }}
                autoFocus
              />
              <button
                onClick={handleAddNote}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition-all duration-150 hover:opacity-90"
                style={{ background: '#6366f1' }}
              >
                {t('common.save')}
              </button>
              <button onClick={() => setShowNote(false)} className="p-1 rounded-lg transition-colors hover:opacity-60" style={{ color: theme.text, opacity: 0.4 }}>
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <>
              <FooterBtn onClick={() => setShowNote(true)} color={theme.text} bg={btnHoverBg} dark={isDark}>
                <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                {t('reader.notes')}
              </FooterBtn>
              <FooterBtn
                onClick={async () => {
                  if (!id) return;
                  try {
                    if (isFavorite) { await favoriteApi.removeFavorite(id); setIsFavorite(false); }
                    else { await favoriteApi.addFavorite(id); setIsFavorite(true); }
                  } catch {}
                }}
                color={isFavorite ? '#ef4444' : theme.text}
                bg={isFavorite ? 'rgba(239,68,68,0.1)' : btnHoverBg}
                dark={isDark}
              >
                <Heart className="w-3.5 h-3.5" strokeWidth={1.5} fill={isFavorite ? 'currentColor' : 'none'} />
                {t('nav.favorites')}
              </FooterBtn>
            </>
          )}
        </div>

        {/* Center: page navigation */}
        <div className="flex-1 flex items-center justify-center gap-1.5">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg transition-all duration-150 disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: theme.text, opacity: 0.6 }}
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowPageJump(!showPageJump)}
              className="text-[13px] font-mono font-semibold tabular-nums px-3 py-1 rounded-lg transition-all duration-150 cursor-pointer"
              style={{ color: theme.text, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
            >
              {currentPage}<span style={{ opacity: 0.35 }}> / {totalPages}</span>
            </button>
            {showPageJump && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-2xl animate-scale-in backdrop-blur-xl"
                style={{ background: isDark ? 'rgba(42,42,72,0.98)' : 'rgba(255,255,255,0.98)', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)' }}
              >
                <input
                  type="number"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePageJump()}
                  className="w-16 text-[13px] font-mono text-center bg-transparent focus:outline-none font-semibold"
                  style={{ color: theme.text }}
                  autoFocus min={1} max={totalPages}
                />
                <span className="text-[11px]" style={{ color: theme.text, opacity: 0.3 }}>/ {totalPages}</span>
                <button
                  onClick={handlePageJump}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white transition-all hover:opacity-90"
                  style={{ background: '#6366f1' }}
                >
                  {t('common.submit')}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg transition-all duration-150 disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: theme.text, opacity: 0.6 }}
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Right: progress bar */}
        <div className="flex items-center gap-2.5 min-w-[120px] justify-end">
          <div className="h-1.5 flex-1 max-w-[100px] rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
            />
          </div>
          <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: theme.text, opacity: 0.35 }}>
            {progressPercent}%
          </span>
        </div>
      </footer>

      {/* Reading Companion Sprite */}
      {pdfDoc && pageText && (
        <ReaderSprite3D
          pageText={pageText}
          currentPage={currentPage}
          bookId={id || ''}
          totalPages={totalPages}
        />
      )}

      {/* Quiz prompt modal */}
      {quizPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setQuizPrompt(false)}>
          <div className="rounded-3xl shadow-2xl p-10 max-w-sm mx-4 text-center animate-[scale-in_0.3s_ease-out] z-10 backdrop-blur-xl"
            style={{ background: isDark ? 'rgba(30,30,54,0.95)' : 'rgba(255,255,255,0.95)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.04)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' }}>
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-xl font-extrabold mb-2" style={{ color: theme.text }}>{t('quiz.title')}</h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: theme.text, opacity: 0.5 }}>
              {t('home.achievementsHint', 'You finished this book! Test your understanding with a quick quiz.')}
            </p>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={() => { setQuizPrompt(false); navigate(`/quiz/${id}`); }}
                className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 hover:opacity-90 shadow-lg shadow-indigo-500/25"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                {t('quiz.startQuiz')}
              </button>
              <button
                onClick={() => setQuizPrompt(false)}
                className="px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: theme.text, opacity: 0.5 }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ onClick, active, title, theme, children, accented }: {
  onClick: () => void;
  active?: boolean;
  title: string;
  theme: { text: string };
  children: React.ReactNode;
  accented?: boolean;
}) {
  const isDark = theme.text === '#e2e8f0';
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg transition-all duration-200 hover:scale-105"
      style={{
        color: active && accented ? '#6366f1' : theme.text,
        opacity: active && !accented ? 1 : 0.55,
        background: active ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? '1' : '0.55'; e.currentTarget.style.background = active ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent'; }}
      title={title}
    >
      {children}
    </button>
  );
}

function Separator({ dark }: { dark: boolean }) {
  return <div className="w-px h-5 mx-1 rounded" style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />;
}

function FooterBtn({ onClick, color, bg, dark: _dark, children }: {
  onClick: () => void;
  color: string;
  bg: string;
  dark: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all duration-150 hover:opacity-80"
      style={{ color, background: bg }}
    >
      {children}
    </button>
  );
}

function OutlineItems({ items, onNavigate, depth, theme }: { items: any[]; onNavigate: (item: any) => void; depth: number; theme: string }) {
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
            {item.title}
          </button>
          {item.items && item.items.length > 0 && (
            <OutlineItems items={item.items} onNavigate={onNavigate} depth={depth + 1} theme={theme} />
          )}
        </div>
      ))}
    </div>
  );
}
