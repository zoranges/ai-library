import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Users, BookOpen, Clock, Target, Timer, BarChart3, TrendingUp, TrendingDown, GraduationCap } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Line, PieChart, Pie, Cell, BarChart, Legend,
} from 'recharts';
import Card from '@/components/ui/Card';
import { adminApi } from '@/utils/api';
import { cn } from '@/lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 h-7 opacity-30">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sps-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#sps-${dataKey})`} dot={false} />
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

export default function SchoolDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: schoolId } = useParams<{ id: string }>();
  const [dateRange, setDateRange] = useState('30');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    adminApi.getSchoolAnalytics(schoolId, { dateRange })
      .then((res) => { if (res.data) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [schoolId, dateRange]);

  const school = data?.school || {};
  const summary = data?.summary || {};
  const readingTrend = data?.readingTrend || [];
  const topBooks = data?.topBooks || [];
  const topStudents = data?.topStudents || [];
  const categoryDistribution = (data?.categoryDistribution || []).filter((c: any) => c.count > 0);
  const gradeDistribution = data?.gradeDistribution || [];
  const sparkData = readingTrend.slice(-7);

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
      return { day: label, sessions: found ? Number(found.sessions) : 0 };
    });
  }, [data?.readingByDayOfWeek]);

  const maxBookCount = Math.max(1, ...topBooks.map((b: any) => Number(b.readCount) || 0));
  const maxStudentMinutes = Math.max(1, ...topStudents.map((s: any) => Number(s.totalMinutes) || 0));
  const maxGradeCount = Math.max(1, ...gradeDistribution.map((g: any) => Number(g.count) || 0));

  const dateRangeOptions = [
    { value: '7', label: `7 ${t('admin.days')}` },
    { value: '30', label: `30 ${t('admin.days')}` },
    { value: '60', label: `60 ${t('admin.days')}` },
    { value: '90', label: `90 ${t('admin.days')}` },
  ];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-accent/20 border-t-accent" />
      </div>
    );
  }

  const statCards = [
    { icon: Users, label: t('admin.totalStudents'), value: summary.totalStudents || 0, color: '#3b82f6', bg: 'bg-blue-500/10' },
    { icon: BarChart3, label: t('admin.activeUsers'), value: `${summary.activeReaders || 0} (${summary.activityRate || 0}%)`, color: '#10b981', bg: 'bg-emerald-500/10' },
    { icon: BookOpen, label: t('admin.completions'), value: `${summary.totalCompletions || 0} (${summary.completionRate || 0}/stu)`, color: '#f59e0b', bg: 'bg-amber-500/10' },
    { icon: Clock, label: t('admin.totalReadingTime'), value: `${Math.round((summary.totalReadingMinutes || 0) / 60)}h`, color: '#8b5cf6', bg: 'bg-purple-500/10' },
    { icon: Target, label: t('admin.avgQuizScore'), value: `${Math.round(summary.avgQuizScore || 0)}%`, color: '#ec4899', bg: 'bg-pink-500/10' },
    { icon: Timer, label: t('admin.readingSessions'), value: (summary.totalSessions || 0).toLocaleString(), color: '#06b6d4', bg: 'bg-cyan-500/10' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/schools')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface border border-border rounded-lg text-text-secondary hover:text-accent hover:border-accent/30 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('common.back')}
          </button>
          <div>
            <h2 className="text-lg font-semibold text-text-primary font-heading">{school.name || 'School'}</h2>
            <p className="text-xs text-text-tertiary">
              {[school.district, school.state, school.country].filter(Boolean).join(', ')}
              {summary.teacherCount ? ` · ${summary.teacherCount} ${t('admin.teachers').toLowerCase()}` : ''}
            </p>
          </div>
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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="relative overflow-hidden bg-surface border border-border rounded-xl p-3 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', item.bg)}>
                  <Icon className="h-3.5 w-3.5" style={{ color: item.color }} strokeWidth={1.5} />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-lg font-bold text-text-primary font-mono">{item.value}</p>
                <p className="text-[11px] text-text-tertiary">{item.label}</p>
              </div>
              <Sparkline data={sparkData} dataKey="sessions" color={item.color} />
            </div>
          );
        })}
      </div>

      {/* Row 1: Reading Trend + Category Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Reading Trend */}
        <Card padding="none">
          <Card.Header title={t('admin.readingTrend')} subtitle={`${t('admin.last')} ${dateRange} ${t('admin.days')}`} />
          <Card.Body>
            {readingTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={readingTrend}>
                  <defs>
                    <linearGradient id="schBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" interval="preserveStartEnd" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="sessions" name={t('admin.sessions')} fill="url(#schBar)" radius={[4, 4, 0, 0]} barSize={16} />
                  <Line type="monotone" dataKey="completions" name={t('admin.completions')} stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>

        {/* Category Donut */}
        <Card padding="none">
          <Card.Header title={t('admin.bookCategories')} subtitle={t('admin.distributionByGenre')} />
          <Card.Body className="flex items-center justify-center relative">
            {categoryDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={categoryDistribution} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="count" nameKey="name" paddingAngle={3} strokeWidth={0} cornerRadius={3}>
                      {categoryDistribution.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: '4px' }}>
                  <span className="text-xl font-bold text-text-primary font-mono">{topBooks.length}</span>
                  <span className="text-[10px] text-text-tertiary">{t('admin.totalBooksInCategory')}</span>
                </div>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Row 2: Reading by Hour + Day of Week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Reading by Hour */}
        <Card padding="none">
          <Card.Header title={t('admin.readingHeatmap')} subtitle={t('admin.readingByHour')} />
          <Card.Body>
            {readingByHour.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={readingByHour}>
                  <defs>
                    <linearGradient id="schHour" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="var(--color-text-tertiary)" interval={3} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  <Bar dataKey="sessions" name={t('admin.sessions')} fill="url(#schHour)" radius={[3, 3, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>

        {/* Day of Week + Grade Distribution */}
        <Card padding="none">
          <Card.Header title={t('admin.readingByDayOfWeek')} subtitle={t('admin.sessions')} />
          <Card.Body>
            {readingByDayOfWeek.some((d: any) => d.sessions > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={readingByDayOfWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  <Bar dataKey="sessions" name={t('admin.sessions')} radius={[6, 6, 0, 0]} barSize={36}>
                    {readingByDayOfWeek.map((_: any, i: number) => (
                      <Cell key={i} fill={i === 0 || i === 6 ? '#8b5cf6' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Row 3: Top Students + Grade Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Students */}
        <Card padding="none">
          <Card.Header title={t('leaderboard.title')} subtitle={t('admin.totalReadingTime')} />
          <Card.Body>
            {topStudents.length > 0 ? (
              <div className="space-y-2">
                {topStudents.map((s: any, i: number) => (
                  <div key={s.id} className="flex items-center gap-3 group">
                    <span className="text-xs font-bold w-5 text-text-tertiary">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-text-primary font-medium truncate">{s.username}</span>
                        <span className="text-xs text-text-tertiary font-mono ml-2 shrink-0">{Math.round((s.totalMinutes || 0) / 60)}h</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                        <span>{s.booksRead || 0} {t('admin.books').toLowerCase()}</span>
                        <span>{s.completedBooks || 0} {t('admin.completions').toLowerCase()}</span>
                        {s.points ? <span>{(s.points || 0).toLocaleString()} pts</span> : null}
                      </div>
                      <div className="mt-1"><ProgressBar value={s.totalMinutes || 0} max={maxStudentMinutes} color={COLORS[i % COLORS.length]} /></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>

        {/* Grade Distribution */}
        <Card padding="none">
          <Card.Header title={t('admin.gradeDistribution') || 'Grade Distribution'} subtitle={t('admin.students')} />
          <Card.Body>
            {gradeDistribution.length > 0 ? (
              <div className="space-y-3">
                {gradeDistribution.map((g: any, i: number) => (
                  <div key={g.grade}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-primary">{g.grade}</span>
                      <span className="text-sm font-semibold text-text-primary font-mono">{g.count}</span>
                    </div>
                    <ProgressBar value={Number(g.count)} max={maxGradeCount} color={COLORS[i % COLORS.length]} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Row 4: Top Books */}
      {topBooks.length > 0 && (
        <Card padding="none">
          <Card.Header title={t('books.mostPopular')} subtitle={school.name} />
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {topBooks.slice(0, 10).map((book: any, i: number) => (
                <div key={book.id} className="flex items-center gap-3 bg-surface-raised rounded-lg p-3 hover:shadow-sm transition-all">
                  <span className="text-xs font-bold w-4 text-text-tertiary">{i + 1}</span>
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="w-7 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-10 rounded bg-surface shrink-0 flex items-center justify-center">
                      <BookOpen className="w-3 h-3 text-text-tertiary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs text-text-primary truncate font-medium">{book.title}</div>
                    <div className="text-[10px] text-text-tertiary">{book.author}</div>
                    <div className="text-[10px] text-text-tertiary font-mono mt-0.5">{book.readCount || 0} reads</div>
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
