import { useMemo } from 'react';

interface DailyActivity {
  date: string;
  totalMinutes: number;
}

const CELL = 10;
const GAP = 2;

function getColor(minutes: number): string {
  if (minutes === 0) return '#e5e7eb';
  if (minutes <= 15) return '#a7f3d0';
  if (minutes <= 30) return '#6ee7b7';
  if (minutes <= 60) return '#34d399';
  return '#10b981';
}

export default function ActivityHeatmap({ data }: { data: DailyActivity[] }) {
  const weeks = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data) {
      map.set(d.date.includes('T') ? d.date.split('T')[0] : d.date, d.totalMinutes);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from today, go back 52 weeks, aligned to Monday
    const start = new Date(today);
    start.setDate(start.getDate() - 209); // 30 weeks
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));

    // Calculate exact number of days from start to today (inclusive)
    const totalDays = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;

    const grid: { key: string; color: string; title: string }[][] = [];
    const cursor = new Date(start);
    let cur: typeof grid[0] = [];

    for (let i = 0; i < totalDays; i++) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      const min = map.get(key) || 0;
      const label = min >= 60 ? `${Math.floor(min / 60)}h${min % 60}m` : `${min}m`;
      cur.push({
        key,
        color: getColor(min),
        title: `${key}: ${label} reading`,
      });
      if (cur.length === 7) { grid.push(cur); cur = []; }
      cursor.setDate(cursor.getDate() + 1);
    }
    // Push any remaining days in the last partial week
    if (cur.length > 0) {
      grid.push(cur);
    }

    return grid;
  }, [data]);

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', gap: GAP, minWidth: weeks.length * (CELL + GAP) + 28 }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: 26, flexShrink: 0, paddingRight: 2 }}>
          {['一', '二', '三', '四', '五', '六', '日'].map((l, i) => (
            <span key={i} style={{ height: CELL, fontSize: 9, lineHeight: `${CELL}px`, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
              {l}
            </span>
          ))}
        </div>
        {/* Cells */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            {week.map((c, di) => (
              <div
                key={di}
                title={c.title}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 2,
                  backgroundColor: c.color,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: GAP, marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginRight: 4 }}>Less</span>
        {[0, 15, 30, 60, 61].map((min, i) => (
          <div key={i} style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: getColor(i === 0 ? 0 : min) }} />
        ))}
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 4 }}>More</span>
      </div>
    </div>
  );
}
