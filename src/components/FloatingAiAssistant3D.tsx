import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X, Send, Sparkles, Loader2, Volume2, StopCircle, Star, BookOpen } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { useAiStore } from '@/stores/aiStore';
import Markdown from '@/components/ui/Markdown';
import BookCover from '@/components/BookCover';
import RobotModel from '@/components/pet3d/RobotModel';
import type { RobotModelHandle } from '@/components/pet3d/RobotModel';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

// ──── Main Component ────
export default function FloatingAiAssistant3D() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, isLoading, sendMessage, clearMessages } = useAiStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const pidRef = useRef(0);

  // Spring physics
  const posRef = useRef({ x: window.innerWidth - 200, y: window.innerHeight / 2 - 150 });
  const velRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: window.innerWidth - 200, y: window.innerHeight / 2 - 150 });
  const [renderPos, setRenderPos] = useState(posRef.current);

  // Interaction state
  const [dragging, setDragging] = useState(false);
  const [grabbed, setGrabbed] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const lastDragPos = useRef({ x: 0, y: 0, time: 0 });
  const hasMoved = useRef(false);

  // Eye tracking
  const [eyeOffset, setEyeOffset] = useState({ lx: 0, ly: 0, rx: 0, ry: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });

  // Idle & personality
  const [idleBob, setIdleBob] = useState(0);
  const [expression, setExpression] = useState<'normal' | 'happy' | 'surprised' | 'dizzy'>('normal');
  const [squish, setSquish] = useState({ sx: 1, sy: 1, rotate: 0 });
  const [randomSpin, setRandomSpin] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();

  // TTS
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Particles (CSS-based, rendered outside Canvas)
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Mouse tracking
  useEffect(() => {
    function onMouse(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener('mousemove', onMouse);
    return () => window.removeEventListener('mousemove', onMouse);
  }, []);

  // Spring physics + eye tracking loop
  useEffect(() => {
    const SPRING = 0.08;
    const DAMPING = 0.82;

    function step() {
      const { x, y } = posRef.current;
      const tx = targetRef.current.x;
      const ty = targetRef.current.y;

      const fx = (tx - x) * SPRING;
      const fy = (ty - y) * SPRING;
      const buoyancy = !dragging ? Math.sin(Date.now() * 0.002) * 0.15 : 0;

      velRef.current.x = (velRef.current.x + fx) * DAMPING;
      velRef.current.y = (velRef.current.y + fy + buoyancy) * DAMPING;

      posRef.current.x += velRef.current.x;
      posRef.current.y += velRef.current.y;

      // Bounce off edges
      const w = 180;
      if (posRef.current.x < 0) { posRef.current.x = 0; velRef.current.x *= -0.5; }
      if (posRef.current.x > window.innerWidth - w) { posRef.current.x = window.innerWidth - w; velRef.current.x *= -0.5; }
      if (posRef.current.y < 0) { posRef.current.y = 0; velRef.current.y *= -0.5; }
      if (posRef.current.y > window.innerHeight - w) { posRef.current.y = window.innerHeight - w; velRef.current.y *= -0.5; }

      setRenderPos({ x: posRef.current.x, y: posRef.current.y });
      setIdleBob(Math.sin(Date.now() * 0.003) * 3);

      // Eye tracking
      if (!dragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const baseDx = (mouseRef.current.x - cx) / (window.innerWidth * 0.35);
        const baseDy = (mouseRef.current.y - cy) / (window.innerHeight * 0.35);
        const clamp = (v: number) => Math.max(-3.5, Math.min(3.5, v));
        const dx = clamp(baseDx);
        const dy = clamp(baseDy);
        const convergence = Math.max(0, 1 - Math.sqrt(baseDx * baseDx + baseDy * baseDy) / 6);
        setEyeOffset({
          lx: dx + convergence * 0.8,
          ly: dy,
          rx: dx - convergence * 0.8,
          ry: dy,
        });
      }

      animRef.current = requestAnimationFrame(step);
    }
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [dragging]);

  // Random idle actions — 9 different behaviors
  useEffect(() => {
    function resetPose() {
      setExpression('normal');
      setSquish({ sx: 1, sy: 1, rotate: 0 });
      setRandomSpin(0);
    }

    function schedule() {
      const delay = 1800 + Math.random() * 3500;
      idleTimer.current = setTimeout(() => {
        if (dragging || open) { schedule(); return; }
        const r = Math.random();

        if (r < 0.15) {
          // 1. Jump — bounce up with surprised face
          velRef.current.y = -5 - Math.random() * 3;
          setExpression('surprised');
          setSquish({ sx: 0.82, sy: 1.22, rotate: 0 });
          setTimeout(() => { setExpression('normal'); setSquish({ sx: 1, sy: 1, rotate: 0 }); }, 450);

        } else if (r < 0.28) {
          // 2. Spin — happy twirl
          setRandomSpin(360);
          setExpression('happy');
          setTimeout(() => { setRandomSpin(0); setExpression('normal'); }, 650);

        } else if (r < 0.39) {
          // 3. Elastic squish — stretch then compress
          setSquish({ sx: 1.12, sy: 0.88, rotate: 6 });
          setTimeout(() => setSquish({ sx: 0.92, sy: 1.08, rotate: -4 }), 130);
          setTimeout(() => setSquish({ sx: 1.04, sy: 0.96, rotate: 2 }), 260);
          setTimeout(() => resetPose(), 400);

        } else if (r < 0.50) {
          // 4. Drift — slow float to a new random spot
          velRef.current.x = (Math.random() - 0.5) * 5;
          velRef.current.y = -2 - Math.random() * 4;
          setExpression('happy');
          setTimeout(() => setExpression('normal'), 800);

        } else if (r < 0.60) {
          // 5. Peek-a-boo — shrink then pop back
          setSquish({ sx: 0.7, sy: 0.65, rotate: 0 });
          setExpression('dizzy');
          setTimeout(() => {
            setSquish({ sx: 1.2, sy: 1.15, rotate: 0 });
            setExpression('surprised');
            velRef.current.y = -3;
          }, 500);
          setTimeout(() => resetPose(), 800);

        } else if (r < 0.72) {
          // 6. Dance wiggle — side-to-side bopping
          const danceSteps = [
            { sx: 1.06, sy: 0.94, rotate: -10 },
            { sx: 0.94, sy: 1.06, rotate: 10 },
            { sx: 1.06, sy: 0.94, rotate: -8 },
            { sx: 0.94, sy: 1.06, rotate: 8 },
          ];
          setExpression('happy');
          danceSteps.forEach((step, i) => {
            setTimeout(() => setSquish(step), i * 120);
          });
          setTimeout(() => resetPose(), 520);

        } else if (r < 0.83) {
          // 7. Shake — rapid tiny vibration (like shaking off water)
          const shakeCount = 5;
          for (let i = 0; i < shakeCount; i++) {
            setTimeout(() => setSquish({ sx: 1, sy: 1, rotate: (i % 2 === 0 ? 5 : -5) }), i * 40);
          }
          setExpression('dizzy');
          setTimeout(() => resetPose(), shakeCount * 40 + 100);

        } else if (r < 0.92) {
          // 8. Lean/peek — tilt toward a direction then back
          const leanDir = Math.random() > 0.5 ? 14 : -14;
          setSquish({ sx: 0.92, sy: 1.06, rotate: leanDir });
          setExpression('surprised');
          setTimeout(() => setSquish({ sx: 0.92, sy: 1.06, rotate: -leanDir * 0.6 }), 200);
          setTimeout(() => resetPose(), 500);

        } else {
          // 9. Double bounce — two quick hops
          velRef.current.y = -2.5;
          setSquish({ sx: 0.9, sy: 1.1, rotate: 0 });
          setTimeout(() => {
            velRef.current.y = -3.5;
            setSquish({ sx: 0.85, sy: 1.2, rotate: 0 });
          }, 200);
          setTimeout(() => resetPose(), 500);
        }

        schedule();
      }, delay);
    }
    schedule();
    return () => clearTimeout(idleTimer.current);
  }, [dragging, open]);

  // Particles during drag
  const spawnParticle = useCallback((x: number, y: number) => {
    const id = pidRef.current++;
    setParticles((prev) => [
      ...prev.slice(-30),
      { id, x, y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2 - 1, life: 1, size: 3 + Math.random() * 5 },
    ]);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.03 }))
          .filter((p) => p.life > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    setGrabbed(true);
    hasMoved.current = false;
    dragStart.current = { x: posRef.current.x, y: posRef.current.y };
    dragOffset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
    lastDragPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    targetRef.current = { ...posRef.current };
    setExpression('surprised');
    setSquish({ sx: 0.85, sy: 1.2, rotate: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const now = Date.now();
    const dx = e.clientX - lastDragPos.current.x;
    const dy = e.clientY - lastDragPos.current.y;
    const dt = Math.max(now - lastDragPos.current.time, 1);
    lastDragPos.current = { x: e.clientX, y: e.clientY, time: now };

    const absDx = Math.abs(e.clientX - dragStart.current.x - dragOffset.current.x);
    const absDy = Math.abs(e.clientY - dragStart.current.y - dragOffset.current.y);
    if (absDx > 3 || absDy > 3) hasMoved.current = true;

    const nx = e.clientX - dragOffset.current.x;
    const ny = e.clientY - dragOffset.current.y;

    velRef.current.x = (dx / dt) * 16;
    velRef.current.y = (dy / dt) * 16;

    targetRef.current = { x: nx, y: ny };
    posRef.current = { x: nx, y: ny };

    if (Math.abs(velRef.current.x) > 2 || Math.abs(velRef.current.y) > 2) {
      spawnParticle(nx + 90, ny + 110);
    }
  }, [dragging, spawnParticle]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    setGrabbed(false);
    setExpression('happy');
    setSquish({ sx: 1.15, sy: 0.85, rotate: 0 });
    setTimeout(() => {
      setExpression('normal');
      setSquish({ sx: 1, sy: 1, rotate: 0 });
    }, 250);

    if (!hasMoved.current) {
      velRef.current = { x: 0, y: 0 };
      setOpen(true);
      clearMessages();
    }
  }, []);

  // TTS
  const stripMarkdown = useCallback((text: string): string => {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[*-]\s+/gm, '')
      .replace(/>\s+/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }, []);

  const speakText = useCallback((text: string, onStart: () => void, onEnd: () => void) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const plain = stripMarkdown(text);
    if (!plain) { onEnd(); return; }
    const u = new SpeechSynthesisUtterance(plain);
    u.lang = 'zh-CN';
    u.rate = 1.0;
    u.onstart = () => onStart();
    u.onend = () => onEnd();
    u.onerror = () => onEnd();
    window.speechSynthesis.speak(u);
  }, [stripMarkdown]);

  function handleSpeakMessage(msgId: string, content: string) {
    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }
    speakText(content, () => setSpeakingMessageId(msgId), () => setSpeakingMessageId(null));
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage(text);
    setInput('');
  }

  return (
    <>
      {/* 3D Pet Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`fixed z-50 select-none touch-none ${open ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
        style={{
          left: renderPos.x,
          top: renderPos.y,
          width: 180,
          height: 210,
        }}
      >
        {/* Ground glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 130,
            height: 28,
            background: `radial-gradient(ellipse at center, ${grabbed ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.15)'} 0%, transparent 70%)`,
            borderRadius: '50%',
            transition: 'background 0.3s ease',
          }}
        />

        {/* CSS Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: p.x - renderPos.x,
              top: p.y - renderPos.y,
              width: p.size,
              height: p.size,
              opacity: p.life,
              background: `radial-gradient(circle, rgba(99,102,241,0.8), transparent)`,
              transform: `scale(${p.life})`,
            }}
          />
        ))}

        {/* 3D Canvas */}
        <div
          className={open ? 'pointer-events-none' : ''}
          style={{
            width: 180,
            height: 210,
            opacity: open ? 0 : 1,
            transform: open ? 'scale(0.5)' : 'scale(1)',
            transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <Canvas
            camera={{ position: [0, 0.05, 3.2], fov: 45 }}
            style={{ width: 180, height: 210 }}
          >
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 5, 5]} intensity={0.6} />
            <Float speed={2} rotationIntensity={0.08} floatIntensity={0.25}>
              <RobotModel
                eyeOffset={eyeOffset}
                squish={squish}
                grabbed={grabbed}
                expression={expression}
                randomSpin={randomSpin}
                idleBob={idleBob}
              />
            </Float>
          </Canvas>
        </div>

        {/* Chat bubble */}
        {!open && (
          <div className="absolute -right-2 -top-12 bg-white dark:bg-gray-800 text-text-primary text-[10px] font-medium px-2.5 py-1.5 rounded-xl shadow-lg animate-fade-in whitespace-nowrap">
            <div className="absolute -bottom-1 right-5 w-2 h-2 bg-white dark:bg-gray-800 rotate-45" />
            {expression === 'happy' ? '✨ Hey!' : expression === 'surprised' ? '😮 Woah!' : t('ai.placeholder')}
          </div>
        )}
      </div>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-[60] w-[400px] max-w-[100vw] h-[560px] max-h-[100vh] bg-surface border border-border rounded-t-2xl sm:rounded-2xl sm:bottom-6 sm:right-6 shadow-3 flex flex-col overflow-hidden animate-[scale-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)]">
          {/* Header */}
          <div className="h-12 flex items-center gap-2.5 px-4 border-b border-border shrink-0 bg-accent text-white">
            <div className="flex items-center gap-2 flex-1">
              <div className="h-7 w-7 bg-white/20 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-semibold">{t('ai.title')}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-accent/10 rounded-2xl mb-3">
                  <Sparkles className="w-7 h-7 text-accent" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-text-secondary font-medium">{t('home.heroSubtitle')}</p>
                <p className="text-xs text-text-tertiary mt-1">{t('ai.placeholder')}</p>
                <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                  {['Recommend books', "What's popular?", 'Help me find a book'].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      disabled={isLoading}
                      className="px-2.5 py-1 text-[11px] text-text-secondary bg-bg-tertiary rounded-full hover:bg-accent/10 hover:text-accent transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="animate-fade-in">
                <div
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3.5 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-accent text-white rounded-br-sm text-[13px]'
                        : 'bg-bg-secondary text-text-primary rounded-bl-sm text-[13px]'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="leading-relaxed">{msg.content}</p>
                    ) : (
                      <>
                        <Markdown content={msg.content} maxLength={400} />
                        <div className="flex justify-end mt-1.5 -mb-0.5">
                          <button
                            onClick={() => handleSpeakMessage(msg.id, msg.content)}
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                              speakingMessageId === msg.id
                                ? 'text-white bg-accent'
                                : 'text-text-tertiary hover:text-accent hover:bg-accent/10'
                            }`}
                            title={speakingMessageId === msg.id ? t('ai.stopReading') : t('ai.readAloud')}
                          >
                            {speakingMessageId === msg.id ? (
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
                {/* Book recommendation cards */}
                {msg.role === 'assistant' && msg.metadata?.books && msg.metadata.books.length > 0 && (
                  <div className="mt-2.5 space-y-2">
                    {msg.metadata.books.map((book) => (
                      <Link
                        key={book.id}
                        to={`/books/${book.id}`}
                        className="flex items-start gap-3 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-border hover:shadow-md hover:border-accent/30 transition-all group"
                      >
                        <div className="w-10 h-14 rounded-lg overflow-hidden shadow-sm shrink-0 bg-bg-tertiary">
                          <BookCover book={book} className="w-full h-full" iconClassName="w-4 h-4 text-text-tertiary/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-primary line-clamp-1 group-hover:text-accent transition-colors">
                            {book.title}
                          </p>
                          <p className="text-[10px] text-text-tertiary mt-0.5">
                            {book.author}
                            {book.category?.name && <span> · {book.category.name}</span>}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {book.rating > 0 && (
                              <div className="flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                                <span className="text-[10px] text-text-tertiary">{book.rating}</span>
                              </div>
                            )}
                            <span className="text-[10px] text-text-tertiary">
                              {book.pageCount > 0 ? `${book.pageCount}页` : ''}
                              {book.difficulty && <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-bg-tertiary">{book.difficulty}</span>}
                            </span>
                          </div>
                          {book.description && (
                            <p className="text-[10px] text-text-tertiary mt-1 line-clamp-2 leading-relaxed">
                              {book.description}
                            </p>
                          )}
                        </div>
                        <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-white transition-all mt-1">
                          <BookOpen className="w-3 h-3 text-accent group-hover:text-white" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-bg-secondary rounded-lg rounded-bl-sm px-4 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '600ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-border shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder={t('ai.placeholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 h-9 bg-bg-secondary rounded-lg border border-border px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : <Send className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
