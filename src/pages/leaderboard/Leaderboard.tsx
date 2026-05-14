import { useEffect, useState } from 'react';
import { Trophy, BookOpen, Clock, Star, Crown } from 'lucide-react';
import Tabs from '@/components/ui/Tabs';
import Select from '@/components/ui/Select';
import { leaderboardApi } from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import type { LeaderboardEntry } from '@/types';

const PERIOD_TABS = [
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
];

const METRIC_TABS = [
  { key: 'points', label: 'Points', icon: <Star className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  { key: 'books', label: 'Books', icon: <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  { key: 'time', label: 'Time', icon: <Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> },
];

const REGION_OPTIONS = [
  { value: 'school', label: '本校' },
  { value: 'district', label: '全区' },
  { value: 'state', label: '全州' },
  { value: 'country', label: '全国' },
];

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function getScoreValue(entry: LeaderboardEntry, metric: string) {
  if (metric === 'books') return entry.booksRead;
  if (metric === 'time') return `${Math.round(entry.points / 10)}m`;
  return entry.points;
}

export default function Leaderboard() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState('month');
  const [region, setRegion] = useState('school');
  const [metric, setMetric] = useState('points');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      try {
        const res = await leaderboardApi.getLeaderboard({ period: period as any, pageSize: 50 });
        const rawData = res.data;
        if (Array.isArray(rawData)) {
          setEntries(rawData as any);
        } else if (rawData && Array.isArray((rawData as any).data)) {
          setEntries((rawData as any).data);
        } else {
          setEntries([]);
        }
      } catch {
        setEntries([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
  }, [period, region]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const currentUserEntry = entries.find((e) => e.userId === user?.id);
  const currentUserInList = currentUserEntry && currentUserEntry.rank <= 3;

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-text-primary font-heading">Leaderboard</h1>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8">
        <Tabs tabs={PERIOD_TABS} activeKey={period} onChange={setPeriod} variant="pill" size="sm" />
        <Select options={REGION_OPTIONS} value={region} onChange={setRegion} fullWidth={false} className="w-32" />
        <div className="sm:ml-auto">
          <Tabs tabs={METRIC_TABS} activeKey={metric} onChange={setMetric} variant="pill" size="sm" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-card" />)}
        </div>
      ) : (
        <>
          {top3.length >= 3 && (
            <div className="flex items-end justify-center gap-4 mb-8">
              {[1, 0, 2].map((idx) => {
                const entry = top3[idx];
                if (!entry) return null;
                const rank = idx + 1;
                const isFirst = rank === 1;
                return (
                  <div
                    key={entry.userId}
                    className={`flex flex-col items-center ${isFirst ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'}`}
                  >
                    <div className="relative">
                      <div
                        className={`rounded-full flex items-center justify-center text-surface font-semibold ${
                          isFirst
                            ? 'w-16 h-16 text-lg bg-accent ring-2 ring-accent/20 ring-offset-2 ring-offset-bg-primary'
                            : 'w-12 h-12 text-sm bg-accent/80'
                        }`}
                      >
                        {getInitials(entry.user?.username || 'U')}
                      </div>
                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        rank === 1 ? 'bg-warning text-surface' : 'bg-surface border border-border text-text-tertiary'
                      }`}>
                        {rank}
                      </div>
                      {isFirst && (
                        <Crown className="w-4 h-4 text-warning absolute -top-4 left-1/2 -translate-x-1/2" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className={`mt-3 text-center ${isFirst ? 'mt-4' : 'mt-2'}`}>
                      <p className={`font-semibold text-text-primary ${isFirst ? 'text-sm' : 'text-xs'}`}>
                        {entry.user?.username || '用户'}
                      </p>
                      <p className="text-[11px] text-text-tertiary mt-0.5">{entry.school?.name || ''}</p>
                      <p className={`font-mono font-medium mt-1 text-sm ${rank === 1 ? 'text-warning' : 'text-text-secondary'}`}>
                        {getScoreValue(entry, metric)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {rest.map((entry) => {
              const isCurrentUser = entry.userId === user?.id;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${
                    isCurrentUser ? 'bg-accent-subtle' : ''
                  }`}
                >
                  <span className="w-6 text-center text-xs font-mono font-medium text-text-tertiary tabular-nums">
                    {entry.rank}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-accent/70 flex items-center justify-center text-surface text-[10px] font-semibold">
                    {getInitials(entry.user?.username || 'U')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-accent' : 'text-text-primary'}`}>
                      {isCurrentUser ? '我' : entry.user?.username || '用户'}
                    </p>
                    <p className="text-[11px] text-text-tertiary">{entry.school?.name || ''}</p>
                  </div>
                  <span className={`text-sm font-mono font-medium tabular-nums ${isCurrentUser ? 'text-accent' : 'text-text-primary'}`}>
                    {getScoreValue(entry, metric)}
                  </span>
                </div>
              );
            })}
          </div>

          {currentUserEntry && !currentUserInList && (
            <div className="mt-3 bg-surface rounded-xl border border-accent/20 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-accent-subtle">
                <span className="w-6 text-center text-xs font-mono font-medium text-accent tabular-nums">
                  {currentUserEntry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-surface text-[10px] font-semibold">
                  {getInitials(user?.username || 'U')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-accent">我</p>
                  <p className="text-[11px] text-text-tertiary">{currentUserEntry.school?.name || ''}</p>
                </div>
                <span className="text-sm font-mono font-medium text-accent tabular-nums">
                  {getScoreValue(currentUserEntry, metric)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
