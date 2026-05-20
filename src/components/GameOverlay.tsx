import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';

interface Drop {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
}

export default function GameOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 40, y: window.innerHeight / 2 - 60 });
  const [scale, setScale] = useState(1);
  const [score, setScore] = useState(0);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const dropId = useRef(0);
  const robotRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const ROBOT_W = 64;
  const ROBOT_H = 80;
  const SPEED = 6;

  // Keyboard handling
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        setKeys((prev) => new Set(prev).add(e.key));
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      setKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.key);
        return next;
      });
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Movement
  useEffect(() => {
    const interval = setInterval(() => {
      setPosition((prev) => ({
        x: Math.max(0, Math.min(window.innerWidth - ROBOT_W * scale, prev.x + (keys.has('ArrowRight') ? SPEED : 0) - (keys.has('ArrowLeft') ? SPEED : 0))),
        y: Math.max(0, Math.min(window.innerHeight - ROBOT_H * scale, prev.y + (keys.has('ArrowDown') ? SPEED : 0) - (keys.has('ArrowUp') ? SPEED : 0))),
      }));
    }, 16);
    return () => clearInterval(interval);
  }, [keys, scale]);

  // Spawn raindrops
  useEffect(() => {
    const interval = setInterval(() => {
      const id = dropId.current++;
      setDrops((prev) => {
        const active = prev.filter((d) => d.y < window.innerHeight + 20);
        return [...active, {
          id,
          x: Math.random() * window.innerWidth,
          y: -20,
          speed: 2 + Math.random() * 3,
          size: 4 + Math.random() * 6,
          opacity: 0.3 + Math.random() * 0.5,
        }];
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Game loop: move drops + collision detection
  useEffect(() => {
    function loop() {
      setDrops((prev) => {
        const robotCX = position.x + (ROBOT_W * scale) / 2;
        const robotCY = position.y + (ROBOT_H * scale) / 2;
        const collectRadius = 50 * scale;

        const remaining: Drop[] = [];
        let collected = 0;

        for (const d of prev) {
          const dy = d.y + d.speed;
          const dx = d.x - robotCX;
          const dist = Math.sqrt(dx * dx + (dy - robotCY) * (dy - robotCY));

          if (dist < collectRadius) {
            collected++;
          } else if (dy < window.innerHeight + 20) {
            remaining.push({ ...d, y: dy });
          }
        }

        if (collected > 0) {
          setScore((s) => s + collected);
          setScale((s) => Math.min(4, s + collected * 0.02));
        }

        return remaining;
      });
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [position, scale]);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Raindrops */}
      {drops.map((d) => (
        <div
          key={d.id}
          className="absolute rounded-full bg-gradient-to-b from-blue-300 to-blue-500"
          style={{
            left: d.x,
            top: d.y,
            width: d.size,
            height: d.size * 2.5,
            opacity: d.opacity,
            borderRadius: '50% 50% 50% 50% / 30% 30% 70% 70%',
          }}
        />
      ))}

      {/* Robot */}
      <div
        ref={robotRef}
        className="absolute pointer-events-auto"
        style={{
          left: position.x,
          top: position.y,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          transition: 'transform 0.15s ease',
        }}
      >
        {/* Glow */}
        <div className="absolute -inset-2 rounded-full bg-accent/15 blur-xl animate-pulse" />

        <div className="relative flex flex-col items-center">
          {/* Head */}
          <div className="relative w-12 h-11 bg-gradient-to-b from-accent to-blue-600 rounded-t-2xl rounded-b-lg shadow-lg shadow-accent/20 z-10 flex items-center justify-center">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-1 h-3 bg-accent/40 rounded-full">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-sm shadow-yellow-400/50" />
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2.5 h-2.5 bg-white rounded-full relative shadow-inner">
                <div className="absolute w-1.5 h-1.5 bg-gray-800 rounded-full top-0.5 left-0.5" />
                <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-0.5 left-0.5" />
              </div>
              <div className="w-2.5 h-2.5 bg-white rounded-full relative shadow-inner">
                <div className="absolute w-1.5 h-1.5 bg-gray-800 rounded-full top-0.5 left-0.5" />
                <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-0.5 left-0.5" />
              </div>
            </div>
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-1 border-b-[1.5px] border-white/60 rounded-b-full" />
            <div className="absolute bottom-1.5 left-2 w-1.5 h-1 bg-pink-400/30 rounded-full" />
            <div className="absolute bottom-1.5 right-2 w-1.5 h-1 bg-pink-400/30 rounded-full" />
          </div>

          {/* Body */}
          <div className="relative w-10 h-8 bg-gradient-to-b from-blue-500 to-blue-700 rounded-lg shadow-md shadow-accent/15 -mt-0.5 z-[5] flex items-center justify-center">
            <div className="w-3.5 h-3.5 bg-accent/30 rounded-full flex items-center justify-center">
              <Sparkles className="w-2 h-2 text-white/70" strokeWidth={1.5} />
            </div>
          </div>

          {/* Arms */}
          <div className="absolute top-[38px] left-1/2 -translate-x-1/2 w-16 z-0">
            <div className="absolute -left-3 top-0 w-2.5 h-7 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full animate-wave" style={{ transformOrigin: 'top center' }} />
            <div className="absolute -right-3 top-0 w-2.5 h-7 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full animate-wave-delayed" style={{ transformOrigin: 'top center' }} />
          </div>

          {/* Legs */}
          <div className="flex gap-2 -mt-0.5 z-[5]">
            <div className="w-3.5 h-4 bg-gradient-to-b from-blue-600 to-blue-800 rounded-b-lg" />
            <div className="w-3.5 h-4 bg-gradient-to-b from-blue-600 to-blue-800 rounded-b-lg" />
          </div>

          <div className="w-10 h-1.5 bg-black/10 rounded-full mt-0.5 blur-[2px]" />
        </div>
      </div>

      {/* HUD */}
      <div className="fixed top-4 right-4 z-10 pointer-events-auto flex items-center gap-3">
        <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-xl px-4 py-2 shadow-2 flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">{t('game.rain', 'Rain')}</p>
            <p className="text-lg font-black text-accent font-heading leading-none">{score}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">{t('game.size', 'Size')}</p>
            <p className="text-lg font-black text-accent font-heading leading-none">x{scale.toFixed(1)}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-10 w-10 bg-surface/90 backdrop-blur-sm border border-border rounded-xl shadow-2 flex items-center justify-center text-text-secondary hover:text-error transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Tips */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <p className="text-[11px] text-text-tertiary bg-surface/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border shadow-1">
          {t('game.instructions', 'Use <kbd>Arrow Keys</kbd> to move · Collect raindrops to grow!')}
        </p>
      </div>
    </div>
  );
}
