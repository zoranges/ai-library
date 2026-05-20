import { useEffect, useState, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { readingApi } from '@/utils/api';

export default function ReadingHistory() {
  const { t } = useTranslation();
  const [range, setRange] = useState('7');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const RANGE_OPTIONS = [
    { value: '7', label: t('profile.last7Days') },
    { value: '30', label: t('profile.last30Days') },
    { value: 'all', label: t('profile.allTime') },
  ];

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await readingApi.getHistory({ page: 1, pageSize: 50 });
        const data = res.data?.data || [];
        // Filter by date range client-side
        const filtered = filterByRange(data, range);
        setHistory(filtered);
      } catch {} finally {
        setIsLoading(false);
      }
    }
    load();
  }, [range]);

  function filterByRange(items: any[], range: string) {
    if (range === 'all') return items;
    const days = parseInt(range);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return items.filter((item) => {
      const date = item.endedAt || item.startedAt;
      return date && new Date(date) >= cutoff;
    });
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  function formatDuration(seconds: number) {
    if (!seconds) return '0m';
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-1 bg-surface-raised rounded-lg p-1 mb-6 w-fit">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-micro ease-out-quart ${
              range === opt.value
                ? 'bg-surface text-text-primary shadow-1'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-10 h-10 text-border mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-text-tertiary">{t('profile.noRecentReads')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3.5 bg-surface rounded-lg border border-border p-3.5 hover:shadow-1 transition-shadow duration-micro ease-out-quart"
            >
              <div className="w-10 h-14 rounded-md bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                {item.coverUrl ? (
                  <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-4 h-4 text-accent/50" strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-text-primary truncate">{item.title || t('books.title')}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] font-mono text-text-tertiary tabular-nums">{formatDate(item.endedAt)}</span>
                  <span className="text-[11px] font-mono text-text-tertiary tabular-nums">{formatDuration(item.duration)}</span>
                  {item.author && <span className="text-[11px] text-text-tertiary truncate">{item.author}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
