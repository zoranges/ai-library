import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { userApi } from '@/utils/api';
import type { ReadingProgress } from '@/types';

const RANGE_OPTIONS = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: 'all', label: 'All' },
];

export default function ReadingHistory() {
  const [range, setRange] = useState('7');
  const [history, setHistory] = useState<ReadingProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await userApi.getReadingHistory({ page: 1, pageSize: 50 });
        setHistory(res.data?.data || []);
      } catch {} finally {
        setIsLoading(false);
      }
    }
    load();
  }, [range]);

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
          <p className="text-sm text-text-tertiary">暂无阅读记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3.5 bg-surface rounded-lg border border-border p-3.5 hover:shadow-1 transition-shadow duration-micro ease-out-quart"
            >
              <div className="w-10 h-14 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-accent/50" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-text-primary truncate">{item.book?.title || '未知图书'}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] font-mono text-text-tertiary tabular-nums">{formatDate(item.lastReadAt)}</span>
                  <span className="text-[11px] font-mono text-text-tertiary tabular-nums">{formatDuration(0)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-emphasized ease-out-quart"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-accent tabular-nums">{item.percentage}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
