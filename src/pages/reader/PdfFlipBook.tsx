import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

const HIGHLIGHT_BG: Record<string, string> = {
  yellow: 'rgba(250,204,21,0.35)',
  green: 'rgba(52,211,153,0.35)',
  blue: 'rgba(96,165,250,0.35)',
  pink: 'rgba(251,113,133,0.35)',
  purple: 'rgba(192,132,252,0.35)',
};

interface HighlightData {
  text: string;
  color: string;
  startOffset?: number;
}

interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
  bg: string;
}

interface PdfFlipBookProps {
  pdfDoc: any;
  currentPage: number;
  scale: number;
  themeMode: 'light' | 'sepia' | 'dark';
  onPageChange: (page: number) => void;
  highlights?: HighlightData[];
}

const RENDER_WINDOW = 5;
const PAGE_CACHE_LIMIT = 30;

export interface PdfFlipBookHandle {
  flipNext: () => void;
  flipPrev: () => void;
}

function computeHighlightRects(
  textLayer: HTMLElement,
  highlights: HighlightData[]
): HighlightRect[] {
  const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[];
  if (!spans.length) return [];

  // Build character-offset map
  const spanRanges: { span: HTMLSpanElement; start: number; end: number }[] = [];
  const parts: string[] = [];
  for (const span of spans) {
    const text = span.textContent || '';
    parts.push(text);
    spanRanges.push({ span, start: parts.join('').length - text.length, end: parts.join('').length });
  }
  const fullText = parts.join('');
  const containerRect = textLayer.getBoundingClientRect();

  const result: HighlightRect[] = [];

  for (const hl of highlights) {
    const rawText = hl.text;
    const bg = HIGHLIGHT_BG[hl.color] || HIGHLIGHT_BG.yellow;

    // Use saved offset for precise positioning, fallback to text search
    let startIdx = hl.startOffset !== undefined && hl.startOffset + rawText.length <= fullText.length
      ? fullText.indexOf(rawText, Math.max(0, hl.startOffset - 5))
      : fullText.indexOf(rawText);
    if (startIdx === -1) {
      const normFull = fullText.replace(/\s+/g, ' ');
      const normHl = rawText.replace(/\s+/g, ' ');
      startIdx = normFull.indexOf(normHl);
      if (startIdx !== -1) {
        let origPos = 0, normPos = 0;
        while (normPos < startIdx && origPos < fullText.length) {
          if (fullText[origPos] === ' ' && normFull[normPos] !== ' ') { origPos++; continue; }
          origPos++; normPos++;
        }
        startIdx = origPos;
      }
    }
    if (startIdx === -1) {
      const compact = rawText.replace(/\s+/g, '');
      if (compact.length >= 2) {
        const compactFull = fullText.replace(/\s+/g, '');
        const compactIdx = compactFull.indexOf(compact);
        if (compactIdx !== -1) {
          let origPos = 0, compactPos = 0;
          while (compactPos < compactIdx && origPos < fullText.length) {
            if (/\s/.test(fullText[origPos])) { origPos++; continue; }
            origPos++; compactPos++;
          }
          startIdx = origPos;
        }
      }
    }
    if (startIdx === -1) continue;

    const endIdx = startIdx + rawText.length;

    const matchedSpans = spanRanges.filter(
      ({ start, end }) => start < endIdx && end > startIdx
    );

    for (const { span, start: spanStart } of matchedSpans) {
      const textNode = span.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        // Fallback to full span rect for non-text spans
        const sr = span.getBoundingClientRect();
        if (sr.width > 0 && sr.height > 0) {
          result.push({ left: sr.left - containerRect.left, top: sr.top - containerRect.top, width: sr.width, height: sr.height, bg });
        }
        continue;
      }

      // Calculate character offsets within this span's text
      const localStart = Math.max(0, startIdx - spanStart);
      const localEnd = Math.min(textNode.textContent?.length || 0, endIdx - spanStart);
      if (localStart >= localEnd) continue;

      // Create a precise Range for just the selected characters
      const range = document.createRange();
      range.setStart(textNode, localStart);
      range.setEnd(textNode, localEnd);

      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (r.width > 0 && r.height > 0) {
          result.push({
            left: r.left - containerRect.left,
            top: r.top - containerRect.top,
            width: r.width,
            height: r.height,
            bg,
          });
        }
      }
    }
  }

  return result;
}

const PdfFlipBook = forwardRef<PdfFlipBookHandle, PdfFlipBookProps>(
  ({ pdfDoc, currentPage, scale, themeMode, onPageChange, highlights = [] }, ref) => {
    const [pageImages, setPageImages] = useState<Map<number, string>>(new Map());
    const [pageTextLayers, setPageTextLayers] = useState<Map<number, string>>(new Map());
    const [pageWidth, setPageWidth] = useState(400);
    const [pageHeight, setPageHeight] = useState(560);
    const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([]);
    const renderingRef = useRef<Set<number>>(new Set());
    const pageCacheRef = useRef<Map<number, string>>(new Map());
    const textLayerCacheRef = useRef<Map<number, string>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);
    const highlightRectsTimeoutRef = useRef<ReturnType<typeof requestAnimationFrame>>();

    useImperativeHandle(ref, () => ({
      flipNext: () => {
        if (currentPage < pdfDoc.numPages) onPageChange(currentPage + 1);
      },
      flipPrev: () => {
        if (currentPage > 1) onPageChange(currentPage - 1);
      },
    }));

    // Measure first page to determine dimensions
    useEffect(() => {
      if (!pdfDoc) return;
      pdfDoc.getPage(1).then((page) => {
        const vp = page.getViewport({ scale: 1 });
        setPageWidth(vp.width * scale);
        setPageHeight(vp.height * scale);
      });
    }, [pdfDoc, scale]);

    // Render a single page to data URL
    const renderPage = useCallback(async (pageNum: number): Promise<{ imageUrl: string; textLayerHTML: string }> => {
      if (pageNum < 1 || pageNum > pdfDoc.numPages) return { imageUrl: '', textLayerHTML: '' };

      const cached = pageCacheRef.current.has(pageNum);
      const cachedText = textLayerCacheRef.current.has(pageNum);
      if (cached && cachedText) {
        return {
          imageUrl: pageCacheRef.current.get(pageNum)!,
          textLayerHTML: textLayerCacheRef.current.get(pageNum)!,
        };
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      let imageUrl: string;
      if (cached) {
        imageUrl = pageCacheRef.current.get(pageNum)!;
      } else {
        const canvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(dpr, dpr);
        await page.render({ canvasContext: ctx, viewport }).promise;
        imageUrl = canvas.toDataURL('image/jpeg', 0.85);
      }

      let textLayerHTML: string;
      if (cachedText) {
        textLayerHTML = textLayerCacheRef.current.get(pageNum)!;
      } else {
        const textContent = await page.getTextContent();
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'pdf-text-layer';
        textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
        textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

        if (textContent.items.length > 0) {
          const { items, styles } = textContent;
          const pageHeight = viewport.height / scale;
          let html = '';
          for (const item of items) {
            if (!('str' in item) || !item.str) continue;
            const tx = item.transform;
            const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]) * scale;
            const fontStyle = styles?.[item.fontName as string];
            const ascentRatio = fontStyle?.ascent ?? 0.75;
            const ascent = fontHeight * ascentRatio;
            const left = tx[4] * scale;
            const top = (pageHeight - tx[5]) * scale - ascent;
            const fontFamily = fontStyle?.fontFamily || 'serif';
            const escaped = item.str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html += `<span style="left:${left}px;top:${top}px;font-size:${fontHeight}px;height:${fontHeight}px;line-height:1;font-family:${fontFamily};">${escaped}</span>`;
          }
          textLayerDiv.innerHTML = html;
        }
        textLayerHTML = textLayerDiv.innerHTML;
      }

      if (!cached && pageCacheRef.current.size >= PAGE_CACHE_LIMIT) {
        const keys = Array.from(pageCacheRef.current.keys());
        const farthest = keys.reduce((a, b) =>
          Math.abs(a - currentPage) > Math.abs(b - currentPage) ? a : b
        );
        pageCacheRef.current.delete(farthest);
        textLayerCacheRef.current.delete(farthest);
      }
      pageCacheRef.current.set(pageNum, imageUrl!);
      textLayerCacheRef.current.set(pageNum, textLayerHTML);
      return { imageUrl: imageUrl!, textLayerHTML };
    }, [pdfDoc, scale, currentPage]);

    // Pre-render window of pages around current position
    useEffect(() => {
      if (!pdfDoc) return;

      const pagesToRender: number[] = [];
      for (
        let i = Math.max(1, currentPage - RENDER_WINDOW);
        i <= Math.min(pdfDoc.numPages, currentPage + RENDER_WINDOW);
        i++
      ) {
        if (!renderingRef.current.has(i)) {
          pagesToRender.push(i);
          renderingRef.current.add(i);
        }
      }

      if (pagesToRender.length === 0) return;

      Promise.all(pagesToRender.map((p) => renderPage(p))).then((results) => {
        setPageImages((prev) => {
          const next = new Map(prev);
          pagesToRender.forEach((p, idx) => {
            if (results[idx].imageUrl) next.set(p, results[idx].imageUrl);
          });
          return next;
        });
        setPageTextLayers((prev) => {
          const next = new Map(prev);
          pagesToRender.forEach((p, idx) => {
            if (results[idx].textLayerHTML) next.set(p, results[idx].textLayerHTML);
          });
          return next;
        });
      });
    }, [currentPage, pdfDoc, renderPage]);

    const imgSrc = pageImages.get(currentPage);
    const textLayerHTML = pageTextLayers.get(currentPage);

    // Recompute highlight rects whenever text layer or highlights change
    useEffect(() => {
      if (highlightRectsTimeoutRef.current) {
        cancelAnimationFrame(highlightRectsTimeoutRef.current);
      }

      if (!highlights.length) {
        setHighlightRects([]);
        return;
      }

      // Double rAF ensures layout is complete before measuring
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          const container = containerRef.current;
          if (!container) return;
          const textLayer = container.querySelector('.pdf-text-layer') as HTMLElement | null;
          if (!textLayer) return;
          setHighlightRects(computeHighlightRects(textLayer, highlights));
        });
        highlightRectsTimeoutRef.current = raf2;
      });
      highlightRectsTimeoutRef.current = raf1;
    }, [textLayerHTML, highlights, currentPage]);

    useEffect(() => {
      return () => {
        if (highlightRectsTimeoutRef.current) cancelAnimationFrame(highlightRectsTimeoutRef.current);
      };
    }, []);

    // Click to flip
    const handleClick = useCallback((e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.pdf-text-layer')) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) {
        if (currentPage > 1) onPageChange(currentPage - 1);
      } else {
        if (currentPage < pdfDoc.numPages) onPageChange(currentPage + 1);
      }
    }, [currentPage, pdfDoc.numPages, onPageChange]);

    const isDark = themeMode === 'dark';
    const pageBg = themeMode === 'sepia' ? '#f4ecd8' : themeMode === 'dark' ? '#1a1a2e' : '#fff';

    if (!imgSrc) {
      return (
        <div className="flex items-center justify-center" style={{ width: pageWidth, height: pageHeight }}>
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', borderTopColor: '#6366f1' }} />
        </div>
      );
    }

    return (
      <div ref={containerRef} className="inline-flex flex-col items-center select-none">
        <div
          className="relative shadow-lg"
          style={{ width: pageWidth, height: pageHeight, background: pageBg, borderRadius: '4px 8px 8px 4px', boxShadow: '0 4px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)' }}
          onClick={handleClick}
        >
          <img
            src={imgSrc}
            alt={`Page ${currentPage}`}
            style={{ width: pageWidth, height: pageHeight, objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
          />
          {textLayerHTML && (
            <div
              className="pdf-text-layer"
              style={{ width: pageWidth, height: pageHeight }}
              dangerouslySetInnerHTML={{ __html: textLayerHTML }}
            />
          )}
          {/* Highlight overlays */}
          {highlightRects.map((r, i) => (
            <div
              key={i}
              className="pointer-events-none"
              style={{
                position: 'absolute',
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height,
                background: r.bg,
                borderRadius: '1px',
              }}
            />
          ))}
        </div>
        <p className="text-[11px] font-mono mt-2 opacity-30 select-none" style={{ color: isDark ? '#fff' : '#000' }}>
          {currentPage} / {pdfDoc.numPages}
        </p>
      </div>
    );
  }
);

PdfFlipBook.displayName = 'PdfFlipBook';
export default PdfFlipBook;
