import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, BookOpen, Clock, Users, Target, Timer } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { useAuthStore } from '@/stores/authStore';
import { adminApi } from '@/utils/api';
import { exportToCSV } from '@/utils/export';
import { cn } from '@/lib/utils';

export default function Statistics() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [period, setPeriod] = useState('7d');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);

  const periodOptions = [
    { value: '7d', label: `7 ${t('admin.days')}` },
    { value: '30d', label: `30 ${t('admin.days')}` },
    { value: '90d', label: `90 ${t('admin.days')}` },
    { value: '1y', label: `1 ${t('leaderboard.year')}` },
  ];

  const stateOptions = [
    { value: '', label: t('admin.allStates') },
    { value: 'Selangor', label: 'Selangor' },
    { value: 'Kuala Lumpur', label: 'Kuala Lumpur' },
    { value: 'Penang', label: 'Penang' },
    { value: 'Johor', label: 'Johor' },
  ];

  useEffect(() => {
    if (isSuper) {
      adminApi.getSchools({ pageSize: 500 }).then((res) => setSchools(res.data?.data || [])).catch(() => {});
    }
  }, [isSuper]);

  useEffect(() => {
    loadStats();
  }, [period, state, city, schoolId]);

  async function loadStats() {
    setLoading(true);
    try {
      const params: Record<string, any> = { period };
      if (isSuper && state) params.state = state;
      if (isSuper && city) params.city = city;
      if (isSuper && schoolId) params.schoolId = schoolId;
      const res = await adminApi.getStatistics(params);
      setStats(res.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  const overview = stats?.overview || {};
  const readingByDay = stats?.readingByDay || [];
  const topBooks = stats?.topBooks || [];
  const schoolStats = stats?.schoolStats || [];

  const statCards = [
    { icon: Users, label: t('admin.totalStudents'), value: overview.totalStudents || 0, color: 'text-blue-400' },
    { icon: BookOpen, label: t('admin.totalBooks'), value: overview.totalBooks || 0, color: 'text-emerald-400' },
    { icon: Clock, label: t('admin.readingSessions'), value: overview.totalReadingSessions || 0, color: 'text-amber-400' },
    { icon: Target, label: t('admin.avgQuizScore'), value: `${Math.round(overview.avgQuizScore || 0)}%`, color: 'text-purple-400' },
    { icon: Timer, label: t('admin.totalReadingTime'), value: `${Math.round((overview.totalReadingMinutes || 0) / 60)}h`, color: 'text-cyan-400' },
  ];

  async function handleExport() {
    if (!stats) return;
    const rows = readingByDay.map((d: any) => ({ Date: d.date, Sessions: d.sessions, Completions: d.completions }));
    exportToCSV(rows, `statistics-${period}-${new Date().toISOString().split('T')[0]}`);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.statistics')}</h2>
        <div className="flex items-center gap-3">
          {isSuper && (
            <>
              <div className="w-28"><Select options={stateOptions} value={state} onChange={(v) => { setState(v); setCity(''); setSchoolId(''); }} /></div>
              <div className="w-32"><Select options={[{ value: '', label: t('admin.allSchools') }, ...schools.map((s: any) => ({ value: s.id, label: s.name }))]} value={schoolId} onChange={setSchoolId} /></div>
            </>
          )}
          <div className="w-28"><Select options={periodOptions} value={period} onChange={setPeriod} /></div>
          {isSuper && (
            <Button icon={<Download className="h-4 w-4" />} variant="outline" size="sm" onClick={handleExport}>{t('common.export')}</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((s, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-2 text-text-tertiary text-xs mb-2">
              <s.icon className={cn('w-4 h-4', s.color)} />
              {s.label}
            </div>
            <div className="text-2xl font-bold text-text-primary">{loading ? '-' : s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">{t('admin.readingTrend')}</h3>
        {readingByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={readingByDay}>
              <defs>
                <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="oklch(0.62 0.19 255)" stopOpacity={0.3} /><stop offset="95%" stopColor="oklch(0.62 0.19 255)" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'oklch(1 0 0 / 0.4)' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 12, fill: 'oklch(1 0 0 / 0.4)' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'oklch(0.18 0.015 255)', border: '1px solid oklch(1 0 0 / 0.1)', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="sessions" stroke="oklch(0.62 0.19 255)" fill="url(#colorSessions)" strokeWidth={2} name={t('admin.readingSessions')} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">{t('books.mostPopular')}</h3>
          <div className="space-y-3">
            {topBooks.length > 0 ? topBooks.map((b: any, i: number) => (
              <div key={b.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-text-tertiary w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{b.title}</div>
                  <div className="text-xs text-text-tertiary">{b.author} · {b.readCount} reads</div>
                </div>
              </div>
            )) : <div className="text-center py-8 text-text-tertiary">{t('common.noData')}</div>}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">{t('admin.schoolPerformance')}</h3>
          <div className="space-y-3">
            {schoolStats.length > 0 ? schoolStats.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{s.name}</div>
                  <div className="text-xs text-text-tertiary">{s.studentCount} {t('admin.students').toLowerCase()} · {s.completedBooks} completions</div>
                </div>
                <div className="text-sm font-medium text-text-primary">{s.totalSessions} sessions</div>
              </div>
            )) : <div className="text-center py-8 text-text-tertiary">{t('common.noData')}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
