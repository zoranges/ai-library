import { useEffect, useState, useRef } from 'react';
import { BookOpen } from 'lucide-react';

const coverCache = new Map<string, string>();

interface BookCoverProps {
  book: {
    id: string;
    fileUrl?: string | null;
    fileType?: string | null;
    coverUrl?: string | null;
  };
  className?: string;
  iconClassName?: string;
}

export default function BookCover({ book, className, iconClassName }: BookCoverProps) {
  const [coverSrc, setCoverSrc] = useState<string | null>(() => {
    if (book.coverUrl) return book.coverUrl;
    return coverCache.get(book.id) || null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const renderRef = useRef(false);

  useEffect(() => {
    if (coverSrc || error) return;
    if (!book.fileUrl || !book.fileType) {
      setError(true);
      return;
    }
    if (renderRef.current) return;
    renderRef.current = true;
    setLoading(true);

    const cacheKey = book.id;
    const cached = coverCache.get(cacheKey);
    if (cached) {
      setCoverSrc(cached);
      setLoading(false);
      return;
    }

    if (book.fileType === 'pdf') {
      renderPdfCover(book.fileUrl)
        .then((dataUrl) => {
          coverCache.set(cacheKey, dataUrl);
          setCoverSrc(dataUrl);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    } else if (book.fileType === 'epub') {
      renderEpubCover(book.fileUrl)
        .then((dataUrl) => {
          if (dataUrl) {
            coverCache.set(cacheKey, dataUrl);
            setCoverSrc(dataUrl);
          } else {
            setError(true);
          }
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    } else {
      setError(true);
      setLoading(false);
    }
  }, [book.fileUrl, book.fileType, book.id, coverSrc, error]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-bg-tertiary/50 ${className || ''}`}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin border-accent/20 border-t-accent" />
      </div>
    );
  }

  if (coverSrc) {
    return (
      <img
        src={coverSrc}
        alt="封面"
        className={`object-cover ${className || ''}`}
        loading="lazy"
      />
    );
  }

  return (
    <div className={`flex items-center justify-center bg-accent/5 ${className || ''}`}>
      <BookOpen className={iconClassName || 'w-8 h-8 text-text-tertiary/40'} strokeWidth={1.5} />
    </div>
  );
}

async function renderPdfCover(url: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  const loadingTask = pdfjsLib.getDocument(encodeURI(url));
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(200 / viewport.width, 300 / viewport.height) * dpr;
    const scaledViewport = page.getViewport({ scale: scale / dpr });
    canvas.width = Math.floor(scaledViewport.width * dpr);
    canvas.height = Math.floor(scaledViewport.height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    pdf.destroy();
  }
}

async function renderEpubCover(url: string): Promise<string | null> {
  try {
    const epubjs = await import('epubjs');
    const book = epubjs.default(url);
    const cover = await book.coverUrl();
    if (cover) return cover;
    return null;
  } catch {
    return null;
  }
}
