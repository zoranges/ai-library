import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Send, Sparkles, Loader2, Volume2, StopCircle } from 'lucide-react';
import { useAiStore } from '@/stores/aiStore';
import Markdown from '@/components/ui/Markdown';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export default function FloatingAiAssistant() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, isLoading, sendMessage, clearMessages } = useAiStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const pidRef = useRef(0);

  // Spring physics state
  const posRef = useRef({ x: window.innerWidth - 100, y: window.innerHeight / 2 - 80 });
  const velRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: window.innerWidth - 100, y: window.innerHeight / 2 - 80 });
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
  const [idleOffset, setIdleOffset] = useState(0);
  const [expression, setExpression] = useState<'normal' | 'happy' | 'surprised' | 'dizzy'>('normal');
  const [squish, setSquish] = useState({ sx: 1, sy: 1, rotate: 0 });
  const [randomSpin, setRandomSpin] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();

  // TTS
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Particles
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Mouse tracking for eyes
  useEffect(() => {
    function onMouse(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener('mousemove', onMouse);
    return () => window.removeEventListener('mousemove', onMouse);
  }, []);

  // Spring physics loop
  useEffect(() => {
    const SPRING = 0.08;
    const DAMPING = 0.82;
    const MASS = 1;

    function step() {
      const { x, y } = posRef.current;
      const tx = targetRef.current.x;
      const ty = targetRef.current.y;

      // Spring force
      const fx = (tx - x) * SPRING;
      const fy = (ty - y) * SPRING;

      // Add gravity/buoyancy when idle
      const buoyancy = !dragging ? Math.sin(Date.now() * 0.002) * 0.15 : 0;

      velRef.current.x = (velRef.current.x + fx / MASS) * DAMPING;
      velRef.current.y = (velRef.current.y + fy / MASS + buoyancy) * DAMPING;

      posRef.current.x += velRef.current.x;
      posRef.current.y += velRef.current.y;

      // Bounce off edges
      const w = 80;
      if (posRef.current.x < 0) { posRef.current.x = 0; velRef.current.x *= -0.5; }
      if (posRef.current.x > window.innerWidth - w) { posRef.current.x = window.innerWidth - w; velRef.current.x *= -0.5; }
      if (posRef.current.y < 0) { posRef.current.y = 0; velRef.current.y *= -0.5; }
      if (posRef.current.y > window.innerHeight - w) { posRef.current.y = window.innerHeight - w; velRef.current.y *= -0.5; }

      setRenderPos({ x: posRef.current.x, y: posRef.current.y });

      // Eye tracking
      if (!dragging && mascotRef.current) {
        const rect = mascotRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const baseDx = (mouseRef.current.x - cx) / (window.innerWidth * 0.35);
        const baseDy = (mouseRef.current.y - cy) / (window.innerHeight * 0.35);
        const clamp = (v: number) => Math.max(-3.5, Math.min(3.5, v));
        const dx = clamp(baseDx);
        const dy = clamp(baseDy);
        // Slight convergence when close — eyes cross a bit
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

  // Random idle actions
  useEffect(() => {
    function schedule() {
      const delay = 2000 + Math.random() * 4000;
      idleTimer.current = setTimeout(() => {
        if (dragging || open) { schedule(); return; }

        const r = Math.random();
        if (r < 0.3) {
          // Jump
          velRef.current.y = -5 - Math.random() * 3;
          setExpression('surprised');
          setSquish({ sx: 0.85, sy: 1.2, rotate: 0 });
          setTimeout(() => { setExpression('normal'); setSquish({ sx: 1, sy: 1, rotate: 0 }); }, 400);
        } else if (r < 0.55) {
          // Spin
          setRandomSpin(360);
          setExpression('happy');
          setTimeout(() => { setRandomSpin(0); setExpression('normal'); }, 600);
        } else if (r < 0.75) {
          // Wiggle
          setSquish({ sx: 1.1, sy: 0.9, rotate: 8 });
          setTimeout(() => setSquish({ sx: 0.95, sy: 1.05, rotate: -5 }), 150);
          setTimeout(() => setSquish({ sx: 1, sy: 1, rotate: 0 }), 300);
        } else {
          // Short hop
          velRef.current.x = (Math.random() - 0.5) * 4;
          velRef.current.y = -2 - Math.random() * 3;
        }
        schedule();
      }, delay);
    }
    schedule();
    return () => clearTimeout(idleTimer.current);
  }, [dragging, open]);

  // Spawn particles on drag
  const spawnParticle = useCallback((x: number, y: number) => {
    const id = pidRef.current++;
    setParticles((prev) => [
      ...prev.slice(-30),
      { id, x, y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2 - 1, life: 1, size: 2 + Math.random() * 4 },
    ]);
  }, []);

  // Update particles
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

    // Set velocity for momentum
    velRef.current.x = (dx / dt) * 16;
    velRef.current.y = (dy / dt) * 16;

    targetRef.current = { x: nx, y: ny };
    posRef.current = { x: nx, y: ny };

    // Spawn particles while dragging
    if (Math.abs(velRef.current.x) > 2 || Math.abs(velRef.current.y) > 2) {
      spawnParticle(nx + 32, ny + 40);
    }
  }, [dragging, spawnParticle]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    setGrabbed(false);
    setExpression('happy');
    setSquish({ sx: 1.15, sy: 0.85, rotate: 0 });

    // Apply momentum on release
    setTimeout(() => {
      setExpression('normal');
      setSquish({ sx: 1, sy: 1, rotate: 0 });
    }, 250);

    if (!hasMoved.current) {
      // It was a click, not a drag
      velRef.current = { x: 0, y: 0 };
      setOpen(true);
      clearMessages();
    }
    // Otherwise momentum continues via spring physics
  }, []);

  const stripMarkdown = useCallback((text: string): string => {
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

  const idleBob = !dragging ? Math.sin(Date.now() * 0.003) * 3 : 0;

  return (
    <>
      {/* Mascot */}
      <div
        ref={mascotRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="fixed z-50 select-none touch-none"
        style={{
          left: renderPos.x,
          top: renderPos.y,
          transition: dragging ? 'none' : 'none',
        }}
      >
        {/* Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute pointer-events-none rounded-full bg-accent/40"
            style={{
              left: p.x - renderPos.x,
              top: p.y - renderPos.y,
              width: p.size,
              height: p.size,
              opacity: p.life,
              transform: `scale(${p.life})`,
            }}
          />
        ))}

        <div
          className={`
            ${open ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100'}
            transition-all duration-300 cursor-grab active:cursor-grabbing
          `}
          style={{
            transform: `scaleX(${squish.sx}) scaleY(${squish.sy}) rotate(${squish.rotate + randomSpin}deg) translateY(${idleBob}px)`,
            transition: dragging ? 'transform 0.1s ease' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            filter: grabbed
              ? 'drop-shadow(0 0 12px rgba(99, 102, 241, 0.5))'
              : 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
          }}
        >
          {/* Glow ring */}
          <div className={`absolute -inset-3 rounded-full blur-xl transition-opacity duration-300 ${
            grabbed ? 'bg-accent/25 animate-pulse' : 'bg-accent/12'
          }`} />
          <div className={`absolute -inset-1 rounded-full blur-md transition-opacity duration-500 ${
            grabbed ? 'bg-yellow-400/15' : 'bg-transparent'
          }`} />

          {/* Mascot with body */}
          <div className="relative flex flex-col items-center">
            {/* Head */}
            <div className="relative w-13 h-12 bg-gradient-to-b from-accent to-blue-600 rounded-t-2xl rounded-b-lg shadow-lg shadow-accent/25 z-10 flex items-center justify-center">
              {/* Antenna */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-1 h-4 bg-accent/40 rounded-full">
                <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-300 ${
                  expression === 'happy' ? 'bg-green-400 shadow-green-400/50 scale-125' :
                  expression === 'surprised' ? 'bg-yellow-300 shadow-yellow-300/50 scale-110' :
                  'bg-yellow-400 shadow-yellow-400/50'
                }`} />
              </div>

              {/* Eyes with tracking */}
              <div className="flex items-center gap-2 mt-1">
                <div className="w-4 h-4 bg-white rounded-full relative shadow-inner overflow-hidden">
                  <div
                    className="absolute w-2 h-2 bg-gray-800 rounded-full transition-none"
                    style={{
                      left: `calc(50% + ${eyeOffset.lx * 2.5}px - 4px)`,
                      top: `calc(50% + ${eyeOffset.ly * 2.5}px - 4px)`,
                    }}
                  />
                  <div
                    className="absolute w-1 h-1 bg-white rounded-full transition-none"
                    style={{
                      left: `calc(50% + ${eyeOffset.lx * 3}px - 2px)`,
                      top: `calc(50% + ${eyeOffset.ly * 3}px - 2px)`,
                    }}
                  />
                </div>
                <div className="w-4 h-4 bg-white rounded-full relative shadow-inner overflow-hidden">
                  <div
                    className="absolute w-2 h-2 bg-gray-800 rounded-full transition-none"
                    style={{
                      left: `calc(50% + ${eyeOffset.rx * 2.5}px - 4px)`,
                      top: `calc(50% + ${eyeOffset.ry * 2.5}px - 4px)`,
                    }}
                  />
                  <div
                    className="absolute w-1 h-1 bg-white rounded-full transition-none"
                    style={{
                      left: `calc(50% + ${eyeOffset.rx * 3}px - 2px)`,
                      top: `calc(50% + ${eyeOffset.ry * 3}px - 2px)`,
                    }}
                  />
                </div>
              </div>

              {/* Mouth */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 transition-all duration-200">
                {expression === 'happy' ? (
                  <div className="w-3 h-1.5 border-b-2 border-white/70 rounded-b-full" />
                ) : expression === 'surprised' ? (
                  <div className="w-2 h-2 bg-white/60 rounded-full" />
                ) : expression === 'dizzy' ? (
                  <div className="w-3 h-1 border-b-2 border-white/50 rounded-b-full -rotate-12" />
                ) : (
                  <div className="w-2.5 h-1 border-b-[1.5px] border-white/60 rounded-b-full" />
                )}
              </div>

              {/* Blush */}
              <div className={`absolute bottom-1.5 left-1.5 w-1.5 h-1 bg-pink-400/30 rounded-full transition-all duration-300 ${
                expression === 'happy' ? 'bg-pink-400/50 scale-125' : ''
              }`} />
              <div className={`absolute bottom-1.5 right-1.5 w-1.5 h-1 bg-pink-400/30 rounded-full transition-all duration-300 ${
                expression === 'happy' ? 'bg-pink-400/50 scale-125' : ''
              }`} />
            </div>

            {/* Body */}
            <div className="relative w-11 h-9 bg-gradient-to-b from-blue-500 to-blue-700 rounded-lg shadow-md shadow-accent/15 -mt-0.5 z-[5] flex items-center justify-center">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 ${
                grabbed ? 'bg-accent/50 scale-125' : 'bg-accent/30'
              }`}>
                <Sparkles className={`w-2.5 h-2.5 transition-all duration-300 ${
                  grabbed ? 'text-white scale-110' : 'text-white/70'
                }`} strokeWidth={1.5} />
              </div>
            </div>

            {/* Arms */}
            <div className="absolute top-[42px] left-1/2 -translate-x-1/2 w-18 z-0">
              <div
                className={`absolute -left-4 top-0 w-2.5 h-7 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full transition-all duration-150 ${
                  grabbed ? '-rotate-45 -translate-x-0.5 origin-top' : 'animate-wave'
                }`}
                style={{ transformOrigin: 'top center' }}
              />
              <div
                className={`absolute -right-4 top-0 w-2.5 h-7 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full transition-all duration-150 ${
                  grabbed ? 'rotate-45 translate-x-0.5 origin-top' : 'animate-wave-delayed'
                }`}
                style={{ transformOrigin: 'top center' }}
              />
            </div>

            {/* Legs */}
            <div className="flex gap-2.5 -mt-0.5 z-[5]">
              <div
                className="w-3.5 h-5 bg-gradient-to-b from-blue-600 to-blue-800 rounded-b-lg transition-all duration-150"
                style={{ transform: squish.sx !== 1 ? `scaleY(${1/squish.sy})` : 'none', transformOrigin: 'top center' }}
              />
              <div
                className="w-3.5 h-5 bg-gradient-to-b from-blue-600 to-blue-800 rounded-b-lg transition-all duration-150"
                style={{ transform: squish.sx !== 1 ? `scaleY(${1/squish.sy})` : 'none', transformOrigin: 'top center' }}
              />
            </div>

            {/* Shadow */}
            <div
              className="w-10 h-1.5 bg-black/10 rounded-full mt-1 blur-[2px] transition-all duration-300"
              style={{
                transform: `scaleX(${squish.sx})`,
                opacity: grabbed ? 0.3 : 0.1,
              }}
            />
          </div>

          {/* Chat bubble */}
          {!open && (
            <div className="absolute -right-4 -top-10 bg-white dark:bg-gray-800 text-text-primary text-[10px] font-medium px-2.5 py-1.5 rounded-xl shadow-lg animate-fade-in whitespace-nowrap">
              <div className="absolute -bottom-1 right-6 w-2 h-2 bg-white dark:bg-gray-800 rotate-45" />
              {expression === 'happy' ? '✨ Hey!' : expression === 'surprised' ? '😮 Woah!' : t('ai.placeholder')}
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 w-[400px] max-w-[100vw] h-[560px] max-h-[100vh] bg-surface border border-border rounded-t-2xl sm:rounded-2xl sm:bottom-6 sm:right-6 shadow-3 flex flex-col overflow-hidden animate-[scale-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)]">
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
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
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
