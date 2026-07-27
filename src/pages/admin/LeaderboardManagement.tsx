import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import DateRangePicker from '@/components/ui/DateRangePicker';
import CascadingFilter from '@/components/ui/CascadingFilter';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';

const medalColors: Record<number, string> = { 1: 'bg-amber-400', 2: 'bg-slate-400', 3: 'bg-orange-400' };

function getRankDisplay(rank: number) {
  if (rank <= 3) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full', medalColors[rank])} />
        <span className="text-sm font-semibold text-text-primary font-mono w-5 text-center">{rank}</span>
      </div>
    );
  }
  return <span className="text-sm text-text-tertiary font-mono w-5 text-center">{rank}</span>;
}

export default function LeaderboardManagement() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [filters, setFilters] = useState({ country: '', state: '', district: '', schoolId: '' });
  const [metric, setMetric] = useState('points');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const metricOptions = [
    { value: 'points', label: t('leaderboard.totalPoints') },
    { value: 'monthlyPoints', label: t('leaderboard.monthlyPoints') },
    { value: 'yearlyPoints', label: t('leaderboard.yearlyPoints') },
    { value: 'books', label: t('leaderboard.booksRead') },
    { value: 'quizzes', label: t('leaderboard.quizzesCompleted') },
    { value: 'readingTime', label: t('admin.totalReadingTime') },
  ];

  useEffect(() => {
    setLoading(true);
    const params: Record<string, any> = { type: metric, limit: 50 };
    if (filters.country) params.country = filters.country;
    if (filters.state) params.state = filters.state;
    if (filters.district) params.district = filters.district;
    if (filters.schoolId) params.schoolId = filters.schoolId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    adminApi.getLeaderboard(params).then((res) => {
      if (Array.isArray(res.data)) setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [startDate, endDate, filters, metric]);

  const filtered = data.filter((e) => {
    if (search && !e.username?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const formatReadingTime = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0m';
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.leaderboardManagement')}</h2>

      <div className="flex flex-wrap items-center gap-3">
        {isSuper && <CascadingFilter values={filters} onChange={setFilters} />}
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        <div className="w-36"><Select options={metricOptions} value={metric} onChange={setMetric} /></div>
        <div className="w-56"><Input placeholder={t('admin.searchStudentName')} value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} /></div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-16">{t('leaderboard.rank')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.name')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('leaderboard.school')}</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('leaderboard.totalPoints')}</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('leaderboard.monthlyPoints')}</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('leaderboard.yearlyPoints')}</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('leaderboard.booksRead')}</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.totalReadingTime')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry: any) => (
                <tr
                  key={entry.rank}
                  className={cn('border-b border-border transition-colors cursor-pointer', entry.rank <= 3 ? 'bg-accent/[0.02]' : 'hover:bg-surface-raised/30')}
                  onClick={() => entry.userId && navigate(`/admin/students`)}
                >
                  <td className="px-4 py-3 text-center">{getRankDisplay(entry.rank)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 bg-accent/10 rounded-full flex items-center justify-center text-accent text-[11px] font-semibold shrink-0">{(entry.username || '?').charAt(0)}</div>
                      <span className="font-medium text-text-primary">{entry.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{entry.school?.name || entry.schoolName || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-text-primary font-mono text-[13px]">{(entry.totalPoints ?? entry.points)?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{entry.monthlyPoints?.toLocaleString() ?? '0'}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{entry.yearlyPoints?.toLocaleString() ?? '0'}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{entry.booksRead}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{formatReadingTime(entry.readingTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
