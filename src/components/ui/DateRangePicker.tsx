import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
  className?: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getYearStart(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface Preset {
  label: string;
  getRange: () => { start: string; end: string };
}

export default function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
  const { t } = useTranslation();

  const PRESETS = useMemo(() => [
    {
      label: t('leaderboard.week'),
      getRange: () => {
        const now = new Date();
        const weekStart = getWeekStart(now);
        return { start: formatDate(weekStart), end: formatDate(now) };
      },
    },
    {
      label: t('leaderboard.month'),
      getRange: () => {
        const now = new Date();
        const monthStart = getMonthStart(now);
        return { start: formatDate(monthStart), end: formatDate(now) };
      },
    },
    {
      label: t('leaderboard.year'),
      getRange: () => {
        const now = new Date();
        const yearStart = getYearStart(now);
        return { start: formatDate(yearStart), end: formatDate(now) };
      },
    },
  ], [t]);

  const WEEKDAYS = useMemo(() => [
    t('leaderboard.sunday', '日'), t('leaderboard.monday', '一'), t('leaderboard.tuesday', '二'),
    t('leaderboard.wednesday', '三'), t('leaderboard.thursday', '四'), t('leaderboard.friday', '五'), t('leaderboard.saturday', '六'),
  ], [t]);

  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleDayClick = useCallback((dateStr: string) => {
    if (selecting === 'start' || (startDate && endDate)) {
      onChange(dateStr, null);
      setSelecting('end');
    } else {
      const start = parseDate(startDate!);
      const clicked = parseDate(dateStr);
      if (clicked < start) {
        onChange(dateStr, null);
        setSelecting('end');
      } else {
        onChange(startDate!, dateStr);
        setSelecting('start');
        setOpen(false);
      }
    }
  }, [selecting, startDate, endDate, onChange]);

  const handlePreset = useCallback((preset: Preset) => {
    const { start, end } = preset.getRange();
    onChange(start, end);
    setSelecting('start');
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null, null);
    setSelecting('start');
    setOpen(false);
  }, [onChange]);

  const displayLabel = startDate && endDate
    ? `${startDate} — ${endDate}`
    : startDate
      ? `${startDate} — ...`
      : t('leaderboard.allTime');

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  function isInRange(date: Date): boolean {
    if (!startDate) return false;
    if (!endDate) return sameDay(date, parseDate(startDate));
    return date >= parseDate(startDate) && date <= parseDate(endDate);
  }

  function isRangeStart(date: Date): boolean {
    if (!startDate) return false;
    return sameDay(date, parseDate(startDate));
  }

  function isRangeEnd(date: Date): boolean {
    if (!endDate) return false;
    return sameDay(date, parseDate(endDate));
  }

  function renderMonth(year: number, month: number) {
    const days = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const today = new Date();
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    }

    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d);
      const dateStr = formatDate(date);
      const inRange = isInRange(date);
      const rangeStart = isRangeStart(date);
      const rangeEnd = isRangeEnd(date);
      const isToday = sameDay(date, today);

      cells.push(
        <button
          key={d}
          type="button"
          className={cn(
            'w-8 h-8 text-[12px] rounded-full flex items-center justify-center transition-colors relative',
            rangeStart && 'bg-accent text-white font-semibold',
            rangeEnd && 'bg-accent text-white font-semibold',
            inRange && !rangeStart && !rangeEnd && 'bg-accent/10 text-accent rounded-none',
            !inRange && !rangeStart && !rangeEnd && 'text-text-secondary hover:bg-surface-raised',
            isToday && !rangeStart && !rangeEnd && !inRange && 'text-accent font-semibold'
          )}
          onClick={() => handleDayClick(dateStr)}
        >
          {d}
        </button>
      );
    }

    return cells;
  }

  return (
    <div className={cn('relative inline-block', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg border transition-colors',
          startDate ? 'border-accent/30 text-accent bg-accent/5' : 'border-border text-text-secondary hover:text-text-primary hover:border-text-tertiary bg-surface'
        )}
      >
        <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span className="max-w-[180px] truncate">{displayLabel}</span>
        {startDate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            className="ml-0.5 p-0.5 rounded hover:bg-accent/10 transition-colors"
          >
            <X className="h-3 w-3" strokeWidth={1.5} />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-surface border border-border rounded-xl shadow-2 p-4" style={{ minWidth: '520px' }}>
          {/* Presets */}
          <div className="flex items-center gap-1.5 mb-3 pb-3 border-b border-border">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePreset(p)}
                className="px-2.5 py-1 text-[12px] font-medium rounded-md text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors"
              >
                {p.label}
              </button>
            ))}
            <div className="flex-1" />
            {startDate && (
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 text-[12px] font-medium rounded-md text-text-tertiary hover:text-error hover:bg-error/5 transition-colors"
              >
                {t('common.clear')}
              </button>
            )}
          </div>

          {/* Two-month calendar */}
          <div className="flex gap-6">
            {[0, 1].map((offset) => {
              const m = viewMonth + offset;
              const year = viewYear + Math.floor(m / 12);
              const month = m % 12;
              return (
                <div key={offset} className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    {offset === 0 && (
                      <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-surface-raised transition-colors text-text-tertiary hover:text-text-primary">
                        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                    <span className="text-[13px] font-medium text-text-primary">{year}年{month + 1}月</span>
                    {offset === 1 && (
                      <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-surface-raised transition-colors text-text-tertiary hover:text-text-primary">
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-7 gap-0">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="w-8 h-8 flex items-center justify-center text-[11px] text-text-tertiary font-medium">
                        {d}
                      </div>
                    ))}
                    {renderMonth(year, month)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
