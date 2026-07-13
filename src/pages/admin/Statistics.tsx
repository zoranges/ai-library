import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, BookOpen, Clock, Users, Target, Timer, TrendingUp, TrendingDown } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend,
} from 'recharts';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import CascadingFilter from '@/components/ui/CascadingFilter';
import { useAuthStore } from '@/stores/authStore';
import { adminApi } from '@/utils/api';
import { exportToCSV } from '@/utils/export';
import { cn } from '@/lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const RADAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous === 0) return null;
  const pct = Math.round(Math.abs(((current - previous) / previous) * 100));
  const up = current >= previous;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
      up ? 'text-emerald-600 bg-emerald-500/10' : 'text-red-500 bg-red-500/10',
    )}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {pct}%
    </span>
  );
}

function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 h-7 opacity-30">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spk-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#spk-${dataKey})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function Statistics() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [period, setPeriod] = useState('7d');
  const [filters, setFilters] = useState({ country: '', state: '', district: '', schoolId: '' });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  const periodOptions = [
    { value: '7d', label: `7 ${t('admin.days')}` },
    { value: '30d', label: `30 ${t('admin.days')}` },
    { value: '90d', label: `90 ${t('admin.days')}` },
    { value: '1y', label: `1 ${t('leaderboard.year')}` },
  ];

  useEffect(() => {
    loadStats();
  }, [period, filters]);

  async function loadStats() {
    setLoading(true);
    try {
      const params: Record<string, any> = { period };
      if (isSuper && filters.country) params.country = filters.country;
      if (isSuper && filters.state) params.state = filters.state;
      if (isSuper && filters.district) params.district = filters.district;
      if (isSuper && filters.schoolId) params.schoolId = filters.schoolId;
      const res = await adminApi.getStatistics(params);
      setStats(res.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  const overview = stats?.overview || {};
  const prev = stats?.previousPeriod || {};
  const readingByDay = stats?.readingByDay || [];
  const readingByDayOfWeek = useMemo(() => {
    const raw = stats?.readingByDayOfWeek || [];
    return DAY_LABELS.map((label, i) => {
      const found = raw.find((r: any) => Number(r.dayOfWeek) === i + 1);
      return { day: label, sessions: found ? Number(found.sessions) : 0, completions: found ? Number(found.completions || 0) : 0 };
    });
  }, [stats?.readingByDayOfWeek]);
  const topBooks = stats?.topBooks || [];
  const schoolStats = stats?.schoolStats || [];

  // Radar data: top 5 schools across 3 dimensions
  const radarData = useMemo(() => {
    const top5 = schoolStats.slice(0, 5);
    return [
      { metric: t('admin.students'), ...Object.fromEntries(top5.map((s: any, i: number) => [`s${i}`, Number(s.studentCount) || 0])) },
      { metric: t('admin.sessions'), ...Object.fromEntries(top5.map((s: any, i: number) => [`s${i}`, Number(s.totalSessions) || 0])) },
      { metric: t('admin.completions'), ...Object.fromEntries(top5.map((s: any, i: number) => [`s${i}`, Number(s.completedBooks) || 0])) },
    ];
  }, [schoolStats, t]);

  // Sparkline data for stat cards
  const sparkData = readingByDay.slice(-7);
  const maxBookReadCount = Math.max(1, ...topBooks.map((b: any) => Number(b.readCount) || 0));

  const statCards = [
    { icon: Users, label: t('admin.totalStudents'), value: overview.totalStudents || 0, color: '#3b82f6', prev: prev.totalStudents || 0 },
    { icon: BookOpen, label: t('admin.totalBooks'), value: overview.totalBooks || 0, color: '#10b981', prev: 0, nocompare: true },
    { icon: Clock, label: t('admin.readingSessions'), value: overview.totalReadingSessions || 0, color: '#f59e0b', prev: prev.readingSessionsCount || 0 },
    { icon: Target, label: t('admin.avgQuizScore'), value: `${Math.round(overview.avgQuizScore || 0)}%`, color: '#8b5cf6', prev: 0, nocompare: true },
    { icon: Timer, label: t('admin.totalReadingTime'), value: `${Math.round((overview.totalReadingMinutes || 0) / 60)}h`, color: '#06b6d4', prev: prev.totalReadingMinutes || 0 },
  ];

  async function handleExport() {
    if (!stats) return;
    const rows = readingByDay.map((d: any) => ({ Date: d.date, Sessions: d.sessions, Completions: d.completions }));
    exportToCSV(rows, `statistics-${period}-${new Date().toISOString().split('T')[0]}`);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.statistics')}</h2>
        <div className="flex items-center gap-3">
          {isSuper && <CascadingFilter values={filters} onChange={setFilters} />}
          <div className="w-28"><Select options={periodOptions} value={period} onChange={setPeriod} /></div>
          {isSuper && (
            <Button icon={<Download className="h-4 w-4" />} variant="outline" size="sm" onClick={handleExport}>{t('common.export')}</Button>
          )}
        </div>
      </div>

      {/* Row 1: Stat Cards with sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="relative overflow-hidden bg-surface border border-border rounded-xl p-4 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-2 text-text-tertiary text-xs mb-2">
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
              {s.label}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-text-primary">{loading ? '-' : s.value}</div>
              {!s.nocompare && s.prev > 0 && <TrendBadge current={Number(s.value) || 0} previous={Number(s.prev)} />}
            </div>
            <Sparkline data={sparkData} dataKey="sessions" color={s.color} />
          </div>
        ))}
      </div>

      {/* Row 2: Stacked Area Chart + Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Reading Trend: Stacked Area */}
        <Card padding="none">
          <Card.Header title={t('admin.readingTrend')} subtitle={t('admin.sessions')} />
          <Card.Body>
            {readingByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={readingByDay}>
                  <defs>
                    <linearGradient id="stackSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="stackCompletions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" interval="preserveStartEnd" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="sessions" stroke="#3b82f6" fill="url(#stackSessions)" strokeWidth={2} name={t('admin.sessions')} dot={false} />
                  <Area type="monotone" dataKey="completions" stroke="#10b981" fill="url(#stackCompletions)" strokeWidth={2} name={t('admin.completions')} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>

        {/* Radar: Top 5 Schools comparison */}
        <Card padding="none">
          <Card.Header title={t('admin.schoolPerformance')} subtitle={t('admin.topSchoolsByReading')} />
          <Card.Body className="flex items-center justify-center">
            {schoolStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                  <PolarRadiusAxis tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px' }} />
                  {schoolStats.slice(0, 5).map((_: any, i: number) => (
                    <Radar key={i} name={schoolStats[i].name} dataKey={`s${i}`} stroke={RADAR_COLORS[i]} fill={RADAR_COLORS[i]} fillOpacity={0.08} strokeWidth={2} />
                  ))}
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Row 3: Top Books + Day of Week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Books with progress */}
        <Card padding="none">
          <Card.Header title={t('books.mostPopular')} subtitle={t('admin.books')} />
          <Card.Body>
            {topBooks.length > 0 ? (
              <div className="space-y-3">
                {topBooks.map((b: any, i: number) => (
                  <div key={b.id} className="group">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-xs font-bold w-5 text-text-tertiary">{i + 1}</span>
                      {b.coverUrl ? (
                        <img src={b.coverUrl} alt="" className="w-6 h-9 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-9 rounded bg-surface-raised shrink-0 flex items-center justify-center">
                          <BookOpen className="w-3 h-3 text-text-tertiary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text-primary truncate font-medium">{b.title}</div>
                        <div className="text-xs text-text-tertiary">{b.author}</div>
                      </div>
                      <span className="text-sm font-bold text-text-primary font-mono shrink-0">{(b.readCount || 0).toLocaleString()}</span>
                    </div>
                    <div className="ml-12"><ProgressBar value={Number(b.readCount) || 0} max={maxBookReadCount} color={COLORS[i % COLORS.length]} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>

        {/* Day of Week: RadialBarChart */}
        <Card padding="none">
          <Card.Header title={t('admin.readingByDayOfWeek')} subtitle={t('admin.sessions')} />
          <Card.Body className="flex items-center justify-center">
            {readingByDayOfWeek.some((d: any) => d.sessions > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={readingByDayOfWeek}>
                  <defs>
                    <linearGradient id="dowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  <Bar dataKey="sessions" name={t('admin.sessions')} fill="url(#dowGrad)" radius={[6, 6, 0, 0]} barSize={36}>
                    {readingByDayOfWeek.map((_: any, i: number) => (
                      <Cell key={i} fill={i === 0 || i === 6 ? '#8b5cf6' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Row 4: School Performance Table */}
      <Card padding="none">
        <Card.Header title={t('admin.schoolPerformance')} subtitle={t('admin.sessions')} />
        <Card.Body className="p-0">
          {schoolStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/50">
                    <th className="text-left px-4 py-3 text-[12px] text-text-tertiary font-medium">{t('admin.schoolName')}</th>
                    <th className="text-right px-4 py-3 text-[12px] text-text-tertiary font-medium">{t('admin.students')}</th>
                    <th className="text-right px-4 py-3 text-[12px] text-text-tertiary font-medium">{t('admin.sessions')}</th>
                    <th className="text-right px-4 py-3 text-[12px] text-text-tertiary font-medium">{t('admin.completions')}</th>
                    <th className="text-right px-4 py-3 text-[12px] text-text-tertiary font-medium">{t('admin.totalReadingMinutes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolStats.map((s: any, i: number) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-raised/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-tertiary w-5">{i + 1}</span>
                          <button className="font-medium text-text-primary hover:text-accent transition-colors text-left" onClick={() => navigate(`/admin/schools/${s.id}`)}>{s.name}</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{s.studentCount || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-[13px] text-text-primary">{(s.totalSessions || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-[13px] text-text-primary">{(s.completedBooks || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-[13px] text-text-primary">{Math.round((Number(s.totalReadingMinutes) || 0) / 60)}h</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
