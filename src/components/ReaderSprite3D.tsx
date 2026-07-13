import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { Sparkles, Loader2, X, MessageCircle } from 'lucide-react';
import RobotModel from '@/components/pet3d/RobotModel';
import { aiApi } from '@/utils/api';
import Markdown from '@/components/ui/Markdown';

type SpriteState = 'idle' | 'thinking' | 'speaking';

interface ReaderSprite3DProps {
  pageText: string;
  currentPage: number;
  bookId: string;
  totalPages: number;
}

export default function ReaderSprite3D({ pageText, currentPage, bookId }: ReaderSprite3DProps) {
  const { t } = useTranslation();
  const [spriteState, setSpriteState] = useState<SpriteState>('idle');
  const [message, setMessage] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [eyeOffset] = useState({ lx: 0, ly: 0, rx: 0, ry: 0 });
  const [squish, setSquish] = useState({ sx: 1, sy: 1, rotate: 0 });
  const [idleBob] = useState(0);
  const processedPageRef = useRef(0);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();
  const animRef = useRef<number>(0);

  // Drag physics
  const posRef = useRef({
    x: window.innerWidth - 200,
    y: window.innerHeight - 260,
  });
  const velRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({
    x: window.innerWidth - 200,
    y: window.innerHeight - 260,
  });
  const [renderPos, setRenderPos] = useState(posRef.current);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Spring + idle bob loop
  useEffect(() => {
    const SPRING = 0.06;
    const DAMPING = 0.78;

    function step() {
      const { x, y } = posRef.current;
      const tx = targetRef.current.x;
      const ty = targetRef.current.y;

      const fx = (tx - x) * SPRING;
      const fy = (ty - y) * SPRING;
      const buoyancy = !dragging ? Math.sin(Date.now() * 0.002) * 0.1 : 0;

      velRef.current.x = (velRef.current.x + fx) * DAMPING;
      velRef.current.y = (velRef.current.y + fy + buoyancy) * DAMPING;

      posRef.current.x += velRef.current.x;
      posRef.current.y += velRef.current.y;

      // Bounce off edges
      const w = 140, h = 160;
      if (posRef.current.x < 0) { posRef.current.x = 0; velRef.current.x *= -0.5; }
      if (posRef.current.x > window.innerWidth - w) { posRef.current.x = window.innerWidth - w; velRef.current.x *= -0.5; }
      if (posRef.current.y < 0) { posRef.current.y = 0; velRef.current.y *= -0.5; }
      if (posRef.current.y > window.innerHeight - h) { posRef.current.y = window.innerHeight - h; velRef.current.y *= -0.5; }

      setRenderPos({ x: posRef.current.x, y: posRef.current.y });
      animRef.current = requestAnimationFrame(step);
    }
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [dragging]);

  const analyzePage = useCallback(async (text: string, page: number, force = false) => {
    if (!text || text.length < 50) return;
    if (!force && processedPageRef.current === page) return;
    processedPageRef.current = page;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setSpriteState('thinking');
    setShowBubble(true);

    try {
      const res = await aiApi.chat({
        message: `你是一个友好的阅读伙伴精灵。读者正在读第${page}页。请基于以下页面内容，给出1-2句话的简短建议或提一个有趣的问题来帮助读者思考。用中文回复，像朋友聊天一样自然。\n\n页面内容：\n${text.slice(0, 2000)}`,
        bookId,
        page,
        pageText: text.slice(0, 2000),
      });

      const data = res.data as any;
      const reply = data.content || data.message || '';
      if (reply) {
        setMessage(reply);
        setSpriteState('speaking');
        bubbleTimerRef.current = setTimeout(() => {
          setShowBubble(false);
          setSpriteState('idle');
        }, 10000);
      } else {
        setSpriteState('idle');
        setShowBubble(false);
      }
    } catch {
      setSpriteState('idle');
      setShowBubble(false);
    }
  }, [bookId]);

  // Watch page changes
  useEffect(() => {
    if (!pageText || pageText.length < 50) return;
    if (currentPage === processedPageRef.current) return;

    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setShowBubble(false);

    analyzePage(pageText, currentPage);
  }, [currentPage, pageText, analyzePage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
    targetRef.current = { ...posRef.current };
    setSquish({ sx: 0.85, sy: 1.2, rotate: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const nx = e.clientX - dragOffset.current.x;
    const ny = e.clientY - dragOffset.current.y;
    targetRef.current = { x: nx, y: ny };
    posRef.current = { x: nx, y: ny };
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    setSquish({ sx: 1.15, sy: 0.85, rotate: 0 });
    setTimeout(() => setSquish({ sx: 1, sy: 1, rotate: 0 }), 200);
  }, []);

  const handleClick = () => {
    if (spriteState === 'thinking') return;
    if (showBubble) {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      setShowBubble(false);
      setSpriteState('idle');
    } else {
      analyzePage(pageText, currentPage, true);
    }
  };

  const handleAskAgain = () => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setSpriteState('thinking');
    analyzePage(pageText, currentPage, true);
  };

  const expression = spriteState === 'thinking' ? 'surprised' : showBubble ? 'happy' : 'normal';

  return (
    <>
      {/* Sprite container */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`fixed z-40 select-none touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: renderPos.x,
          top: renderPos.y,
          width: 140,
          height: 160,
        }}
      >
        {/* Speech bubble */}
        {showBubble && (
          <div
            className="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-border animate-scale-in pointer-events-auto"
            style={{
              right: -8,
              bottom: 155,
              width: 260,
            }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #8b7cf6, #6366f1)' }}
                >
                  <Sparkles className="w-3 h-3 text-white" strokeWidth={1.5} />
                </div>
                <span className="text-[11px] font-semibold text-text-primary">
                  {spriteState === 'thinking' ? t('ai.thinking', 'Thinking...') : t('ai.gotIdea', 'Got an idea!')}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                {spriteState === 'speaking' && (
                  <button
                    onClick={handleAskAgain}
                    className="p-1 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                    title={t('common.refresh', 'Refresh')}
                  >
                    <MessageCircle className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                )}
                <button
                  onClick={() => { setShowBubble(false); setSpriteState('idle'); }}
                  className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  <X className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="px-3 py-2.5 max-h-[200px] overflow-y-auto">
              {spriteState === 'thinking' ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" strokeWidth={2} />
                  <span className="text-xs text-text-tertiary">
                    {t('ai.analyzing', 'Reading this page...')}
                  </span>
                </div>
              ) : (
                <div className="text-xs text-text-secondary leading-relaxed">
                  <Markdown content={message} maxLength={300} />
                </div>
              )}
            </div>

            <div
              className="absolute w-3 h-3 bg-white dark:bg-gray-800 border-r border-b border-border rotate-45"
              style={{ bottom: -6, right: 65 }}
            />
          </div>
        )}

        {/* 3D Sprite */}
        <div
          onClick={handleClick}
          className="pointer-events-auto"
          style={{ width: 140, height: 160 }}
        >
          <Canvas
            camera={{ position: [0, 0.05, 4], fov: 45 }}
            style={{ width: 140, height: 160 }}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[5, 5, 5]} intensity={0.5} />
            <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.15}>
              <RobotModel
                eyeOffset={eyeOffset}
                squish={squish}
                grabbed={dragging}
                expression={expression}
                randomSpin={0}
                idleBob={idleBob}
              />
            </Float>
          </Canvas>
        </div>

        {/* Click hint */}
        {!showBubble && spriteState === 'idle' && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 text-text-primary text-[10px] font-medium px-2 py-1 rounded-xl shadow-lg animate-fade-in whitespace-nowrap pointer-events-none">
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-gray-800 rotate-45" />
            {t('ai.tapMe', 'Tap me!')}
          </div>
        )}
      </div>
    </>
  );
}
