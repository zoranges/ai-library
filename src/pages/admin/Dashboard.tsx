import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Building, BookOpen, Shield, TrendingUp, TrendingDown, Clock, Target, BarChart3, Settings, Key } from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Line, BarChart, Legend,
} from 'recharts';
import Card from '@/components/ui/Card';
import CascadingFilter from '@/components/ui/CascadingFilter';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function trendPct(current: number, previous: number): { pct: number; up: boolean | null } {
  if (!previous || previous === 0) return { pct: 0, up: null };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

function TrendBadge({ current, previous, format }: { current: number; previous: number; format?: (v: number) => string }) {
  const { t } = useTranslation();
  const { pct, up } = trendPct(current, previous);
  if (up === null) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium ml-1.5 px-1 py-0.5 rounded-full',
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
    <div className="absolute bottom-0 left-0 right-0 h-8 opacity-40">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#spark-${dataKey})`} dot={false} />
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

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [dateRange, setDateRange] = useState('60');
  const [filters, setFilters] = useState({ country: '', state: '', district: '', schoolId: '' });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, any> = { dateRange };
    if (isSuper && filters.schoolId) params.schoolId = filters.schoolId;
    adminApi.getDashboard(params).then((res) => {
      if (res.data) setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [dateRange, filters, isSuper]);

  const prev = data?.previousPeriod || {};
  const readingTrend = data?.readingTrend || [];
  const categoryDistribution = (data?.categoryDistribution || []).filter((c: any) => c.count > 0);
  const schoolComparison = data?.schoolComparison || [];
  const topBooks = data?.topBooks || [];
  const topSchools = data?.topSchools || [];
  const readingByHour = useMemo(() => {
    const raw = data?.readingByHour || [];
    const filled: { hour: number; sessions: number; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
      const found = raw.find((r: any) => Number(r.hour) === h);
      filled.push({ hour: h, sessions: found ? Number(found.sessions) : 0, label: `${h}:00` });
    }
    return filled;
  }, [data?.readingByHour]);
  const readingByDayOfWeek = useMemo(() => {
    const raw = data?.readingByDayOfWeek || [];
    return DAY_LABELS.map((label, i) => {
      const found = raw.find((r: any) => Number(r.dayOfWeek) === i + 1);
      return { day: label, sessions: found ? Number(found.sessions) : 0, completions: found ? Number(found.completions || 0) : 0 };
    });
  }, [data?.readingByDayOfWeek]);

  // Last 7 days for sparklines
  const sparkData = readingTrend.slice(-7);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-accent/20 border-t-accent" />
      </div>
    );
  }

  const maxSchoolSessions = Math.max(1, ...topSchools.map((s: any) => Number(s.totalSessions) || 0));
  const maxSchoolComp = Math.max(1, ...schoolComparison.map((s: any) => Number(s.completions) || 0));

  const dateRangeOptions = [
    { value: '7', label: `7 ${t('admin.days')}` },
    { value: '30', label: `30 ${t('admin.days')}` },
    { value: '60', label: `60 ${t('admin.days')}` },
    { value: '90', label: `90 ${t('admin.days')}` },
  ];

  const statItems = [
    { key: 'totalStudents', label: t('admin.totalStudents'), icon: Users, color: '#3b82f6', bg: 'bg-blue-500/10', path: '/admin/students' },
    { key: 'totalSchools', label: t('admin.totalSchools'), icon: Building, color: '#10b981', bg: 'bg-emerald-500/10', path: '/admin/schools' },
    { key: 'totalBooks', label: t('admin.totalBooks'), icon: BookOpen, color: '#f59e0b', bg: 'bg-amber-500/10', path: '/admin/books' },
    { key: 'totalAdmins', label: t('admin.totalAdmins'), icon: Shield, color: '#8b5cf6', bg: 'bg-purple-500/10', path: '/admin/admins' },
  ];

  const kpiItems = [
    { key: 'readingSessionsCount', label: t('admin.readingSessions'), icon: BarChart3, color: '#3b82f6', prevKey: 'readingSessionsCount' },
    { key: 'activeUsers', label: t('admin.activeUsers'), icon: Users, color: '#10b981', prevKey: 'activeUsers' },
    { key: 'totalReadingMinutes', label: t('admin.totalReadingTime'), icon: Clock, color: '#f59e0b', prevKey: 'totalReadingMinutes', format: (v: number) => `${Math.round(v / 60)}h ${v % 60}m` },
    { key: 'bookReadingRate', label: t('admin.bookReadingRate'), icon: Target, color: '#8b5cf6', format: (v: number) => `${v}%` },
    { key: 'complianceRate', label: t('admin.complianceRate'), icon: Shield, color: '#06b6d4', format: (v: number) => `${v}%` },
    { key: 'averageQuizScore', label: t('admin.avgQuizScore'), icon: Target, color: '#ec4899', format: (v: number) => `${v}%` },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top bar: quick actions + date range */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('/admin/account')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface border border-border rounded-lg text-text-secondary hover:text-accent hover:border-accent/30 transition-colors">
            <Settings className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('admin.accountSettings')}
          </button>
          <button onClick={() => navigate('/admin/account')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface border border-border rounded-lg text-text-secondary hover:text-accent hover:border-accent/30 transition-colors">
            <Key className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('admin.updatePassword')}
          </button>
        </div>
        <div className="flex bg-surface-raised rounded-md p-0.5 gap-0.5">
          {dateRangeOptions.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                'px-2.5 py-1 text-[11px] font-medium rounded-[4px] transition-all duration-150',
                dateRange === opt.value ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary',
              )}
              onClick={() => setDateRange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hierarchy Filter */}
      {isSuper && <CascadingFilter values={filters} onChange={setFilters} />}

      {/* Row 1: Stat Cards with sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          const value = data?.[item.key] ?? 0;
          return (
            <div
              key={item.key}
              className="relative overflow-hidden flex items-center gap-3 bg-surface border border-border rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-accent/20 transition-all duration-200 group"
              onClick={() => navigate(item.path)}
            >
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', item.bg)}>
                <Icon className="h-5 w-5" style={{ color: item.color }} strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1 relative z-10">
                <span className="text-2xl font-bold text-text-primary font-mono tracking-tight">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </span>
                <p className="text-[12px] text-text-tertiary mt-0.5">{item.label}</p>
              </div>
              <Sparkline data={sparkData} dataKey="sessions" color={item.color} />
            </div>
          );
        })}
      </div>

      {/* Row 2: KPI Metrics with trend comparison */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {kpiItems.map((item) => {
          const Icon = item.icon;
          const rawValue = data?.[item.key] ?? 0;
          const displayValue = item.format ? item.format(rawValue) : rawValue.toLocaleString();
          const prevValue = prev[item.prevKey] ?? 0;
          return (
            <div key={item.key} className="bg-surface border border-border rounded-xl p-3 text-center hover:shadow-md transition-all duration-200">
              <Icon className="h-4 w-4 mx-auto mb-1.5" style={{ color: item.color }} strokeWidth={1.5} />
              <div className="flex items-center justify-center gap-0">
                <p className="text-lg font-bold text-text-primary font-mono">{displayValue}</p>
              </div>
              <p className="text-[11px] text-text-tertiary leading-tight mt-0.5">{item.label}</p>
              {item.prevKey && <div className="flex justify-center mt-0.5"><TrendBadge current={Number(rawValue)} previous={Number(prevValue)} /></div>}
            </div>
          );
        })}
      </div>

      {/* Row 3: Composed Chart + Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Reading Trend: Composed bar + line */}
        <Card padding="none">
          <Card.Header title={t('admin.readingTrend')} subtitle={`${t('admin.last')} ${dateRange} ${t('admin.days')}`} />
          <Card.Body>
            {readingTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={readingTrend}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" interval="preserveStartEnd" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="sessions" name={t('admin.sessions')} fill="url(#barGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                  <Line type="monotone" dataKey="completions" name={t('admin.completions')} stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>

        {/* Category Donut with center text */}
        <Card padding="none">
          <Card.Header title={t('admin.bookCategories')} subtitle={t('admin.distributionByGenre')} />
          <Card.Body className="flex items-center justify-center relative">
            {categoryDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={categoryDistribution} cx="50%" cy="50%" innerRadius={70} outerRadius={105} dataKey="count" nameKey="name" paddingAngle={4} strokeWidth={0} cornerRadius={4}>
                      {categoryDistribution.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: '4px' }}>
                  <span className="text-2xl font-bold text-text-primary font-mono">{data?.totalBooks || 0}</span>
                  <span className="text-[11px] text-text-tertiary">{t('admin.totalBooksInCategory')}</span>
                </div>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Row 4: Top Schools + Reading by Hour */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Schools Horizontal Bar */}
        <Card padding="none">
          <Card.Header title={t('admin.topSchoolsByReading')} subtitle={t('admin.sessions')} />
          <Card.Body>
            {topSchools.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topSchools} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  <Bar dataKey="totalSessions" name={t('admin.sessions')} radius={[0, 6, 6, 0]} barSize={20} cursor="pointer" onClick={(data: any) => navigate(`/admin/schools/${data.id}`)}>
                    {topSchools.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>

        {/* Reading by Hour */}
        <Card padding="none">
          <Card.Header title={t('admin.readingHeatmap')} subtitle={t('admin.readingByHour')} />
          <Card.Body>
            {readingByHour.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={readingByHour}>
                  <defs>
                    <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="var(--color-text-tertiary)" interval={3} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} labelFormatter={(h) => `${h}:00`} />
                  <Bar dataKey="sessions" name={t('admin.sessions')} fill="url(#hourGrad)" radius={[3, 3, 0, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Row 5: Top Books + School Comparison Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Books */}
        <Card padding="none">
          <Card.Header title={t('books.mostPopular')} subtitle={t('admin.books')} />
          <Card.Body>
            {topBooks.length > 0 ? (
              <div className="space-y-3">
                {topBooks.map((book: any, i: number) => (
                  <div key={book.id} className="flex items-center gap-3 group">
                    <span className="text-xs font-bold w-5 text-text-tertiary">{i + 1}</span>
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt="" className="w-7 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-10 rounded bg-surface-raised shrink-0 flex items-center justify-center">
                        <BookOpen className="w-3 h-3 text-text-tertiary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate font-medium">{book.title}</div>
                      <div className="text-xs text-text-tertiary">{book.author}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-text-primary font-mono">{(book.readCount || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-text-tertiary">{t('admin.sessions')}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>

        {/* School Comparison with progress bars */}
        {schoolComparison.length > 0 && (
          <Card padding="none">
            <Card.Header title={t('admin.schoolComparison')} subtitle={t('admin.completions')} />
            <Card.Body>
              <div className="space-y-3">
                {schoolComparison.map((school: any) => (
                  <div key={school.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <button
                        className="text-sm text-text-primary font-medium truncate hover:text-accent transition-colors text-left"
                        onClick={() => navigate(`/admin/schools/${school.id}`)}
                      >
                        {school.name}
                      </button>
                      <span className="text-xs text-text-tertiary font-mono ml-2 shrink-0">
                        {school.completions || 0} {t('admin.completions').toLowerCase()}
                      </span>
                    </div>
                    <ProgressBar value={Number(school.completions) || 0} max={maxSchoolComp} color={COLORS[0]} />
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                        <span>{school.studentCount} {t('admin.students').toLowerCase()}</span>
                        <span className={cn(Number(school.usageRate) >= 70 ? 'text-emerald-500' : Number(school.usageRate) >= 50 ? 'text-amber-500' : 'text-red-500')}>
                          {school.usageRate}% {t('admin.usageRate').toLowerCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-tertiary">
                        {Math.round((Number(school.totalReadingMinutes) || 0) / 60)}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        )}
      </div>
    </div>
  );
}
