import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
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
  const [period, setPeriod] = useState('month');
  const [region, setRegion] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [metric, setMetric] = useState('points');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const periodOptions = [
    { value: 'week', label: t('leaderboard.week') },
    { value: 'month', label: t('leaderboard.month') },
    { value: 'year', label: t('leaderboard.year') },
    { value: 'all', label: t('leaderboard.allTime') },
  ];

  const regionOptions = [
    { value: '', label: t('admin.allRegions') },
    { value: 'Selangor', label: 'Selangor' },
    { value: 'Kuala Lumpur', label: 'Kuala Lumpur' },
    { value: 'Penang', label: 'Penang' },
  ];

  const metricOptions = [
    { value: 'points', label: t('leaderboard.points') },
    { value: 'books', label: t('leaderboard.booksRead') },
    { value: 'quizzes', label: t('leaderboard.quizzesCompleted') },
    { value: 'readingTime', label: t('admin.totalReadingTime') },
  ];

  useEffect(() => {
    adminApi.getSchools({ pageSize: 500 }).then((res) => setSchools(res.data?.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, any> = { period, type: metric, limit: 50 };
    if (schoolId) params.schoolId = schoolId;
    else if (region) params.state = region;
    adminApi.getLeaderboard(params).then((res) => {
      if (res.data) setData(Array.isArray(res.data) ? res.data : res.data.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [period, region, schoolId, metric]);

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
        <div className="w-28"><Select options={periodOptions} value={period} onChange={setPeriod} /></div>
        <div className="w-32"><Select options={regionOptions} value={region} onChange={(v) => { setRegion(v); setSchoolId(''); }} /></div>
        <div className="w-44">
          <Select
            options={[{ value: '', label: t('admin.allSchools') }, ...schools.map((s: any) => ({ value: s.id, label: s.name }))]}
            value={schoolId}
            onChange={(v) => { setSchoolId(v); if (v) setRegion(''); }}
          />
        </div>
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
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('leaderboard.points')}</th>
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
                  <td className="px-4 py-3 text-right font-semibold text-text-primary font-mono text-[13px]">{entry.points?.toLocaleString()}</td>
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
