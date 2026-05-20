import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';
import EpubReader from './EpubReader';

import {
  ArrowLeft, ZoomIn, ZoomOut, Sparkles, ChevronLeft, ChevronRight,
  Highlighter, Pencil, Heart, X, Sun, Moon, BookOpen, List,
  Maximize2, Minimize2, RotateCw, MessageSquare, Bookmark,
  Settings2, ChevronDown, Volume2
} from 'lucide-react';
import AIAssistant from './AIAssistant';
import { useReadingStore } from '@/stores/readingStore';
import { useAiStore } from '@/stores/aiStore';
import { useBookStore } from '@/stores/bookStore';
import { favoriteApi } from '@/utils/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

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
}

interface PageHighlight {
  id: string;
  text: string;
  color: string;
  note?: string;
  page: number;
  rects?: Array<{ top: number; left: number; width: number; height: number }>;
}

export default function Reader() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentBook, fetchBookById } = useBookStore();
  const { currentProgress, fetchProgress, saveProgress, startSession, endSession, highlights, fetchHighlights, addHighlight } = useReadingStore();
  const { isOpen: aiOpen, toggleOpen: toggleAi } = useAiStore();

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [rendering, setRendering] = useState(false);
  const [pageText, setPageText] = useState('');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showOutline, setShowOutline] = useState(false);
  const [outline, setOutline] = useState<any[]>([]);
  const [showHighlighter, setShowHighlighter] = useState(false);
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerDivRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<TextLayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const currentPageRef = useRef(currentPage);

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
    if (currentBook.fileType === 'epub') {
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

    const loadingTask = pdfjsLib.getDocument(url);
    loadingTaskRef.current = loadingTask;

    loadingTask.promise.then(
      (pdf) => {
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
  }, [currentBook?.fileUrl, currentBook?.fileType]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    if (textLayerRef.current) {
      textLayerRef.current.cancel();
      textLayerRef.current = null;
    }

    setRendering(true);
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d')!;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.scale(dpr, dpr);

      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;

      if (textLayerDivRef.current) {
        const textLayerDiv = textLayerDivRef.current;
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.setProperty('--scale-factor', `${scale}`);

        const textContent = await page.getTextContent();
        const pageTextStr = textContent.items
          .map((item: any) => item.str)
          .filter((s: string) => s.trim())
          .join(' ');
        setPageText(pageTextStr);

        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport,
        });
        textLayerRef.current = textLayer;
        await textLayer.render();
      }

      setRendering(false);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Render error:', err);
      }
      setRendering(false);
    }
  }, [pdfDoc, scale]);

  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setShowPageJump(false);
    }
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
    setSelection({ text, rect });
    setSelectionPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
    setShowSelectionMenu(true);
  }

  function handleSelectionAction(action: 'highlight' | 'define' | 'translate' | 'explain') {
    if (!selection) return;
    const { text } = selection;
    const { defineWord, translateText, explainText, sendMessage } = useAiStore.getState();

    if (action === 'highlight') {
      addHighlight({
        bookId: id || '',
        text,
        color: highlightColor,
        page: currentPage,
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

  // Resolve theme labels via t()
  const themeLabelMap: Record<ThemeMode, string> = {
    light: t('reader.dayTheme'),
    sepia: t('reader.eyeCareTheme'),
    dark: t('reader.nightTheme'),
  };

  // Resolve highlight color labels via t()
  const highlightColorLabelMap: Record<string, string> = {
    yellow: t('common.yellow'),
    green: t('common.green'),
    blue: t('common.blue'),
    pink: t('common.pink'),
    purple: t('common.purple'),
  };

  if (currentBook?.fileType === 'epub' && currentBook?.fileUrl) {
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
          className="h-11 flex items-center px-3 shrink-0 border-b"
          style={{ background: theme.toolbar, borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 rounded-md transition-colors duration-150 hover:opacity-70"
            style={{ color: theme.text }}
          >
            <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
          <div className="flex-1 min-w-0 text-center px-3">
            <h1 className="text-[13px] font-medium truncate" style={{ color: theme.text, opacity: 0.85 }}>
              {currentBook?.title || t('common.loading')}
            </h1>
          </div>
          <div className="w-[60px]" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center animate-fade-in max-w-md px-6">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
              style={{ background: 'rgba(239,68,68,0.08)' }}
            >
              <BookOpen className="w-10 h-10" style={{ color: '#ef4444' }} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: theme.text }}>
              {t('common.error', { defaultValue: 'Cannot open file' })}
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: theme.text, opacity: 0.5 }}>
              {pdfError}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: theme.text, background: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                {t('common.back')}
              </button>
              {currentBook && (
                <button
                  onClick={() => toggleAi()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ color: '#fff', background: '#6366f1' }}
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
            className="fixed right-0 top-11 bottom-0 w-[360px] border-l animate-fade-in flex flex-col"
            style={{
              background: themeMode === 'dark' ? '#1e1e36' : '#fafafe',
              borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
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
      <header
        className="h-11 flex items-center px-3 shrink-0 border-b transition-colors duration-200 select-none"
        style={{ background: theme.toolbar, borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1 rounded-md transition-colors duration-150 hover:opacity-70"
          style={{ color: theme.text }}
        >
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
        </button>

        <div className="flex-1 min-w-0 text-center px-3">
          <h1 className="text-[13px] font-medium truncate" style={{ color: theme.text, opacity: 0.85 }}>
            {currentBook?.title || t('common.loading')}
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
            onClick={toggleBookmark}
            className="p-1.5 rounded-md transition-colors duration-150 hover:opacity-70"
            style={{ color: bookmarks.includes(currentPage) ? '#facc15' : theme.text, opacity: bookmarks.includes(currentPage) ? 1 : 0.6 }}
            title={t('reader.bookmarks')}
          >
            <Bookmark className="w-4 h-4" strokeWidth={1.5} fill={bookmarks.includes(currentPage) ? 'currentColor' : 'none'} />
          </button>
          <div className="w-px h-4 mx-1" style={{ background: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
          <button
            onClick={() => handleZoom(-0.25)}
            className="p-1.5 rounded-md transition-colors duration-150 hover:opacity-70"
            style={{ color: theme.text, opacity: 0.6 }}
            title={t('reader.zoomOut')}
          >
            <ZoomOut className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-[11px] font-mono tabular-nums w-10 text-center" style={{ color: theme.text, opacity: 0.5 }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.25)}
            className="p-1.5 rounded-md transition-colors duration-150 hover:opacity-70"
            style={{ color: theme.text, opacity: 0.6 }}
            title={t('reader.zoomIn')}
          >
            <ZoomIn className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <div className="w-px h-4 mx-1" style={{ background: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
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
            className="w-64 shrink-0 border-r overflow-y-auto animate-fade-in select-none"
            style={{ background: theme.toolbar, borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center gap-1 p-2 border-b" style={{ borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
              {(['outline', 'bookmarks'] as const).map((tab) => (
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
                  {tab === 'outline' ? t('reader.tableOfContents') : t('reader.bookmarks')}
                </button>
              ))}
            </div>
            <div className="p-2">
              {sidebarTab === 'outline' && (
                outline.length > 0 ? (
                  <OutlineItems items={outline} onNavigate={navigateOutline} depth={0} theme={themeMode} />
                ) : (
                  <p className="text-xs text-center py-8" style={{ color: theme.text, opacity: 0.4 }}>{t('reader.noSearchResults')}</p>
                )
              )}
              {sidebarTab === 'bookmarks' && (
                bookmarks.length > 0 ? (
                  <div className="space-y-0.5">
                    {bookmarks.sort((a, b) => a - b).map((page) => (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className="w-full text-left px-3 py-2 rounded-md text-xs transition-colors duration-150 hover:opacity-80"
                        style={{ background: themeMode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', color: theme.text }}
                      >
                        <Bookmark className="w-3 h-3 inline mr-2" fill="currentColor" style={{ color: '#facc15' }} />
                        {t('common.page')} {page}
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
          className="flex-1 overflow-auto flex justify-center"
          style={{ background: theme.bg }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.pdf-text-layer')) {
              setShowSelectionMenu(false);
              setShowOutline(false);
            }
          }}
        >
          <div className="py-6 px-4 inline-flex flex-col items-center">
            {pdfLoading ? (
              <div className="flex flex-col items-center justify-center h-[70vh]">
                <div className="w-10 h-10 border-2 rounded-full animate-spin mb-4" style={{ borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', borderTopColor: '#6366f1' }} />
                <p className="text-sm" style={{ color: theme.text, opacity: 0.5 }}>{t('common.loading')}</p>
              </div>
            ) : !pdfDoc ? (
              <div className="flex flex-col items-center justify-center h-[70vh] max-w-lg text-center animate-fade-in">
                <div
                  className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
                  style={{ background: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                >
                  <BookOpen className="w-10 h-10" style={{ color: theme.text, opacity: 0.25 }} strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: theme.text }}>
                  {currentBook?.title}
                </h2>
                <p className="text-sm mb-1" style={{ color: theme.text, opacity: 0.5 }}>
                  {currentBook?.author}
                </p>
                {currentBook?.description && (
                  <p className="text-sm leading-relaxed mt-4 mb-8" style={{ color: theme.text, opacity: 0.4 }}>
                    {currentBook.description}
                  </p>
                )}
                <p className="text-xs mb-6" style={{ color: theme.text, opacity: 0.3 }}>
                  {t('books.description')}
                </p>
                <button
                  onClick={() => { if (!aiOpen) toggleAi(); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ color: '#fff', background: '#6366f1' }}
                >
                  <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                  {t('reader.aiAssistant')}
                </button>
              </div>
            ) : (
              <div className="relative" style={{ boxShadow: themeMode === 'dark' ? '0 4px 40px rgba(0,0,0,0.5)' : '0 4px 40px rgba(0,0,0,0.12)', borderRadius: '2px' }}>
                <canvas
                  ref={canvasRef}
                  className="block rounded-sm"
                  style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}
                />
                <div
                  ref={textLayerDivRef}
                  className="pdf-text-layer"
                />
                {rendering && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 3 }}>
                    <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', borderTopColor: '#6366f1' }} />
                  </div>
                )}
              </div>
            )}

            {pageHighlights.length > 0 && (
              <div className="w-full max-w-[720px] mt-6 space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.text, opacity: 0.4 }}>
                  {t('reader.notes')}
                </h3>
                {pageHighlights.map((h: any) => (
                  <div
                    key={h.id}
                    className="p-3 rounded-lg border"
                    style={{
                      background: themeMode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                      borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: theme.text }}>{h.text}</p>
                    {h.note && (
                      <p className="text-xs mt-1.5 italic" style={{ color: theme.text, opacity: 0.5 }}>{h.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none hover:scale-105"
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
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none hover:scale-105"
          style={{
            background: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
            color: theme.text,
            boxShadow: themeMode === 'dark' ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.1)',
            opacity: 0.7,
          }}
        >
          <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {aiOpen && (
          <div
            className="w-[360px] border-l shrink-0 animate-fade-in flex flex-col"
            style={{
              background: themeMode === 'dark' ? '#1e1e36' : '#fafafe',
              borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <AIAssistant bookId={id || ''} currentPage={currentPage} pageText={pageText} />
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
            <button
              onClick={handleReadSelectionAloud}
              className="p-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150 hover:opacity-80"
              style={{ color: theme.text, background: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
              title={t('ai.readAloud')}
            >
              <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      <footer
        className="h-11 flex items-center justify-between px-4 shrink-0 border-t transition-colors duration-200 select-none"
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
                onClick={() => {
                  if (id) addHighlight({ bookId: id, text: `${t('common.page')}${currentPage}${t('reader.highlight')}`, color: highlightColor, page: currentPage });
                  setShowHighlighter(false);
                }}
                className="text-[11px] font-medium px-2 py-1 rounded-md transition-colors duration-150"
                style={{ color: '#6366f1', background: 'rgba(99,102,241,0.1)' }}
              >
                {t('reader.highlight')}
              </button>
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
                  if (!id) return;
                  try {
                    if (isFavorite) {
                      await favoriteApi.removeFavorite(id);
                      setIsFavorite(false);
                    } else {
                      await favoriteApi.addFavorite(id);
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
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 rounded-md transition-colors duration-150 disabled:opacity-30 hover:opacity-80"
            style={{ color: theme.text, opacity: 0.5 }}
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowPageJump(!showPageJump)}
              className="text-[12px] font-mono tabular-nums px-2 py-0.5 rounded-md transition-colors duration-150 hover:opacity-80"
              style={{ color: theme.text, opacity: 0.7, background: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
            >
              {currentPage} / {totalPages}
            </button>
            {showPageJump && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-3 animate-scale-in"
                style={{ background: themeMode === 'dark' ? '#2a2a48' : '#fff', border: themeMode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)' }}
              >
                <input
                  type="number"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePageJump()}
                  className="w-14 text-[12px] font-mono text-center bg-transparent focus:outline-none"
                  style={{ color: theme.text }}
                  autoFocus
                  min={1}
                  max={totalPages}
                />
                <span className="text-[11px]" style={{ color: theme.text, opacity: 0.4 }}>/ {totalPages}</span>
                <button
                  onClick={handlePageJump}
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                  style={{ color: '#6366f1', background: 'rgba(99,102,241,0.1)' }}
                >
                  {t('common.submit')}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 rounded-md transition-colors duration-150 disabled:opacity-30 hover:opacity-80"
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
                width: totalPages > 0 ? `${(currentPage / totalPages) * 100}%` : '0%',
                background: '#6366f1',
              }}
            />
          </div>
          <span className="text-[10px] font-mono tabular-nums ml-2" style={{ color: theme.text, opacity: 0.35 }}>
            {totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0}%
          </span>
        </div>
      </footer>

      {/* Quiz prompt modal */}
      {quizPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setQuizPrompt(false)}>
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
    </div>
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
