import { useState, useEffect, useRef } from 'react';

interface Bread {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  rotation: number;
  emoji: string;
}

const BREADS = ['🍞', '🥖', '🥐', '🥯', '🧇', '🥨', '🍩', '🧁', '🥧', '🍪'];

export default function BreadRain({ onDone }: { onDone: () => void }) {
  const [breads, setBreads] = useState<Bread[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const spawn = setInterval(() => {
      const id = idRef.current++;
      setBreads((prev) => [
        ...prev.slice(-80),
        {
          id,
          x: Math.random() * window.innerWidth,
          y: -40,
          speed: 1.5 + Math.random() * 3,
          size: 16 + Math.random() * 28,
          rotation: Math.random() * 360,
          emoji: BREADS[Math.floor(Math.random() * BREADS.length)],
        },
      ]);
    }, 120);

    const stop = setTimeout(() => {
      clearInterval(spawn);
    }, 6000);

    return () => {
      clearInterval(spawn);
      clearTimeout(stop);
    };
  }, []);

  useEffect(() => {
    const loop = setInterval(() => {
      setBreads((prev) =>
        prev
          .map((b) => ({ ...b, y: b.y + b.speed, rotation: b.rotation + 1 }))
          .filter((b) => b.y < window.innerHeight + 60)
      );
    }, 16);

    const done = setTimeout(() => {
      clearInterval(loop);
      onDone();
    }, 8000);

    return () => {
      clearInterval(loop);
      clearTimeout(done);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[99] pointer-events-none overflow-hidden">
      {breads.map((b) => (
        <span
          key={b.id}
          className="absolute"
          style={{
            left: b.x,
            top: b.y,
            fontSize: b.size,
            transform: `rotate(${b.rotation}deg)`,
            opacity: 0.85,
          }}
        >
          {b.emoji}
        </span>
      ))}
    </div>
  );
}
