import { useEffect, useState } from 'react';
import { Star, BookOpen, Clock, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Tabs from '@/components/ui/Tabs';
import Select from '@/components/ui/Select';
import { leaderboardApi } from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import type { LeaderboardEntry } from '@/types';

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function getScoreValue(entry: LeaderboardEntry, metric: string) {
  if (metric === 'books') return entry.booksRead;
  if (metric === 'readingTime') return `${Math.round((entry as any).totalReadingMinutes || entry.points / 10)}m`;
  return entry.points;
}

export default function Leaderboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [period, setPeriod] = useState('month');
  const [region, setRegion] = useState('school');
  const [metric, setMetric] = useState('points');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const PERIOD_TABS = [
    { key: 'month', label: t('leaderboard.month') },
    { key: 'year', label: t('leaderboard.year') },
  ];

  const METRIC_TABS = [
    { key: 'points', label: t('leaderboard.points'), icon: <Star className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { key: 'books', label: t('leaderboard.byBooks'), icon: <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { key: 'readingTime', label: t('profile.totalMinutes'), icon: <Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  ];

  const REGION_OPTIONS = [
    { value: 'school', label: t('leaderboard.schoolRegion') },
    { value: 'district', label: t('leaderboard.districtRegion') },
    { value: 'state', label: t('leaderboard.stateRegion') },
    { value: 'country', label: t('leaderboard.countryRegion') },
  ];

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      try {
        const res = await leaderboardApi.getLeaderboard({
          period: period as any,
          type: metric,
          region: region,
          pageSize: 50,
        });
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-text-primary font-heading">{t('leaderboard.title')}</h1>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
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
                const medals = ['', 'gold', 'silver', 'bronze'];
                const crownColors = ['', 'text-amber-400', 'text-slate-400', 'text-amber-600'];
                return (
                  <div
                    key={entry.userId}
                    className={`flex flex-col items-center ${isFirst ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'}`}
                  >
                    <div className="relative">
                      <div
                        className={`rounded-full flex items-center justify-center text-white font-bold ${
                          isFirst
                            ? 'w-16 h-16 text-lg bg-gradient-to-br from-accent to-brand-600 ring-2 ring-accent/30 ring-offset-2 ring-offset-bg-primary'
                            : 'w-12 h-12 text-sm bg-gradient-to-br from-brand-400 to-brand-600/80'
                        }`}
                      >
                        {getInitials(entry.user?.username || 'U')}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        rank === 1 ? 'bg-accent text-white' : 'bg-surface border border-border text-text-tertiary'
                      }`}>
                        {rank}
                      </div>
                      {isFirst && (
                        <Crown className={`w-5 h-5 ${crownColors[rank]} absolute -top-7 left-1/2 -translate-x-1/2`} strokeWidth={1.5} />
                      )}
                    </div>
                    <div className={`mt-3 text-center ${isFirst ? 'mt-4' : 'mt-2'}`}>
                      <p className={`font-bold text-text-primary ${isFirst ? 'text-sm' : 'text-xs'}`}>
                        {entry.user?.username || t('leaderboard.student')}
                      </p>
                      <p className="text-[11px] text-text-tertiary mt-0.5">{entry.school?.name || ''}</p>
                      <p className={`font-bold mt-1 text-sm ${rank === 1 ? 'text-accent' : 'text-text-secondary'}`}>
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
                    isCurrentUser ? 'bg-accent/5' : ''
                  }`}
                >
                  <span className="w-6 text-center text-xs font-mono font-medium text-text-tertiary tabular-nums">
                    {entry.rank}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-accent/70 flex items-center justify-center text-white text-[10px] font-semibold">
                    {getInitials(entry.user?.username || 'U')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-accent' : 'text-text-primary'}`}>
                      {isCurrentUser ? t('leaderboard.student') : entry.user?.username || t('leaderboard.student')}
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
              <div className="flex items-center gap-3 px-4 py-3 bg-accent/5">
                <span className="w-6 text-center text-xs font-mono font-medium text-accent tabular-nums">
                  {currentUserEntry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-[10px] font-semibold">
                  {getInitials(user?.username || 'U')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-accent">{t('leaderboard.student')}</p>
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
