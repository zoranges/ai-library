import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Building, BookOpen, Shield, TrendingUp, TrendingDown, Clock, Target, BarChart3, Settings, Key, Sun, Moon } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('60');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    adminApi.getDashboard({ dateRange }).then((res) => {
      if (res.data) setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [dateRange]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-accent/20 border-t-accent" />
      </div>
    );
  }

  const statItems = [
    { key: 'totalStudents', label: t('admin.totalStudents'), icon: Users, color: 'text-accent', bg: 'bg-accent/10', path: '/admin/students' },
    { key: 'totalSchools', label: t('admin.totalSchools'), icon: Building, color: 'text-success', bg: 'bg-success/10', path: '/admin/schools' },
    { key: 'totalBooks', label: t('admin.totalBooks'), icon: BookOpen, color: 'text-warning', bg: 'bg-warning/10', path: '/admin/books' },
    { key: 'totalAdmins', label: t('admin.totalAdmins'), icon: Shield, color: 'text-purple-500', bg: 'bg-purple-500/10', path: '/admin/admins' },
  ];

  const kpiItems = [
    { key: 'readingSessionsCount', label: t('admin.readingSessions'), icon: BarChart3, color: 'text-blue-500' },
    { key: 'activeUsers', label: t('admin.activeUsers'), icon: Users, color: 'text-emerald-500' },
    { key: 'totalReadingMinutes', label: t('admin.totalReadingTime'), icon: Clock, color: 'text-amber-500', format: (v: number) => `${Math.round(v / 60)}h ${v % 60}m` },
    { key: 'bookReadingRate', label: t('admin.bookReadingRate'), icon: Target, color: 'text-purple-500', format: (v: number) => `${v}%` },
    { key: 'complianceRate', label: t('admin.complianceRate'), icon: Shield, color: 'text-cyan-500', format: (v: number) => `${v}%` },
    { key: 'averageQuizScore', label: t('admin.avgQuizScore'), icon: Target, color: 'text-pink-500', format: (v: number) => `${v}%` },
  ];

  const readingTrend = data?.readingTrend || [];
  const categoryDistribution = (data?.categoryDistribution || []).filter((c: any) => c.count > 0);
  const schoolComparison = data?.schoolComparison || [];

  const dateRangeOptions = [
    { value: '7', label: `7 ${t('admin.days')}` },
    { value: '30', label: `30 ${t('admin.days')}` },
    { value: '60', label: `60 ${t('admin.days')}` },
    { value: '90', label: `90 ${t('admin.days')}` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => navigate('/admin/account')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface border border-border rounded-lg text-text-secondary hover:text-accent hover:border-accent/30 transition-colors">
          <Settings className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('admin.accountSettings')}
        </button>
        <button onClick={() => navigate('/admin/account')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface border border-border rounded-lg text-text-secondary hover:text-accent hover:border-accent/30 transition-colors">
          <Key className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('admin.updatePassword')}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          const value = data?.[item.key] ?? 0;
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 bg-surface border border-border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(item.path)}
            >
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', item.bg)}>
                <Icon className={cn('h-[18px] w-[18px]', item.color)} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <span className="text-2xl font-semibold text-text-primary font-mono tracking-tight">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </span>
                <p className="text-[13px] text-text-tertiary mt-0.5">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {kpiItems.map((item) => {
          const Icon = item.icon;
          const rawValue = data?.[item.key] ?? 0;
          const displayValue = item.format ? item.format(rawValue) : rawValue.toLocaleString();
          return (
            <div key={item.key} className="bg-surface border border-border rounded-lg p-3 text-center">
              <Icon className={cn('h-4 w-4 mx-auto mb-1', item.color)} strokeWidth={1.5} />
              <p className="text-lg font-semibold text-text-primary font-mono">{displayValue}</p>
              <p className="text-[11px] text-text-tertiary leading-tight">{item.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reading Trend */}
        <Card padding="none">
          <Card.Header title={t('admin.readingTrend')} subtitle={`${t('admin.last')} ${dateRange} ${t('admin.days')}`} />
          <Card.Body>
            {readingTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={readingTrend}>
                  <defs>
                    <linearGradient id="accentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" interval="preserveStartEnd" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  <Area type="monotone" dataKey="sessions" stroke="var(--color-accent)" strokeWidth={2} fill="url(#accentGradient)" dot={false} name={t('admin.readingSessions')} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>

        {/* Category Distribution */}
        <Card padding="none">
          <Card.Header title={t('admin.bookCategories')} subtitle={t('admin.distributionByGenre')} />
          <Card.Body className="flex items-center justify-center">
            {categoryDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryDistribution} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="count" nameKey="name" paddingAngle={3} strokeWidth={0}>
                    {categoryDistribution.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary">{t('common.noData')}</div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* School Comparison Table */}
      {schoolComparison.length > 0 && (
        <Card padding="none">
          <Card.Header
            title={t('admin.schoolComparison')}
            action={
              <div className="flex bg-surface-raised rounded-md p-0.5 gap-0.5">
                {dateRangeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-medium rounded-[4px] transition-all duration-micro ease-out-quart',
                      dateRange === opt.value
                        ? 'bg-surface text-text-primary shadow-1'
                        : 'text-text-tertiary hover:text-text-secondary'
                    )}
                    onClick={() => setDateRange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            }
          />
          <Card.Body className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/50">
                    <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.schoolName')}</th>
                    <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.students')}</th>
                    <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.registrationRate')}</th>
                    <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.usageRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolComparison.map((school: any) => (
                    <tr key={school.id} className="border-b border-border last:border-0 hover:bg-surface-raised/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">{school.name}</td>
                      <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{school.studentCount}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('font-mono text-[13px]', Number(school.registrationRate) >= 80 ? 'text-success' : Number(school.registrationRate) >= 60 ? 'text-warning' : 'text-error')}>
                          {school.registrationRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('font-mono text-[13px]', Number(school.usageRate) >= 70 ? 'text-success' : Number(school.usageRate) >= 50 ? 'text-warning' : 'text-error')}>
                          {school.usageRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
