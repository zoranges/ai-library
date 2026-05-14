import { useState, useEffect } from 'react';
import { Users, Building, BookOpen, Shield, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const statItems = [
  { key: 'students', label: 'Total Students', icon: Users, color: 'text-accent', bg: 'bg-accent/10' },
  { key: 'schools', label: 'Total Schools', icon: Building, color: 'text-success', bg: 'bg-success/10' },
  { key: 'books', label: 'Total Books', icon: BookOpen, color: 'text-warning', bg: 'bg-warning/10' },
  { key: 'admins', label: 'Total Admins', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-500/10' },
];

const dateRangeOptions = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '60d', label: '60 days' },
  { value: '90d', label: '90 days' },
];

const mockReadingTrend = Array.from({ length: 60 }, (_, i) => ({
  date: `Day ${i + 1}`,
  count: Math.floor(Math.random() * 200) + 100,
}));

const mockCategoryData = [
  { name: 'Science', value: 35 },
  { name: 'Literature', value: 25 },
  { name: 'History', value: 20 },
  { name: 'Art', value: 10 },
  { name: 'Tech', value: 10 },
];

const mockSchools = [
  { name: 'SMK Tunku Abdul Rahman', students: 450, regRate: 87, usageRate: 72 },
  { name: 'SK Bukit Damansara', students: 320, regRate: 92, usageRate: 81 },
  { name: 'SMK Sri Hartamas', students: 280, regRate: 78, usageRate: 65 },
  { name: 'SK Bangsar', students: 510, regRate: 95, usageRate: 88 },
  { name: 'SMK Pantai', students: 190, regRate: 65, usageRate: 52 },
];

export default function Dashboard() {
  const [dateRange, setDateRange] = useState('60d');
  const [stats, setStats] = useState({ students: 2847, schools: 12, books: 1563, admins: 24 });
  const [trends] = useState({ students: 12.5, schools: 8.3, books: -2.1, admins: 5.0 });

  useEffect(() => {
    adminApi.getDashboard().then((res) => {
      if (res.data) {
        setStats((prev) => ({
          students: res.data.totalStudents ?? prev.students,
          schools: res.data.totalSchools ?? prev.schools,
          books: res.data.totalBooks ?? prev.books,
          admins: res.data.totalAdmins ?? prev.admins,
        }));
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          const trend = trends[item.key as keyof typeof trends];
          const isUp = trend >= 0;
          return (
            <div key={item.key} className="flex items-center gap-3 bg-surface border border-border rounded-lg p-4">
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', item.bg)}>
                <Icon className={cn('h-[18px] w-[18px]', item.color)} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-text-primary font-mono tracking-tight">
                    {stats[item.key as keyof typeof stats].toLocaleString()}
                  </span>
                  <span className={cn('flex items-center gap-0.5 text-[11px] font-medium', isUp ? 'text-success' : 'text-error')}>
                    {isUp ? <TrendingUp className="h-3 w-3" strokeWidth={1.5} /> : <TrendingDown className="h-3 w-3" strokeWidth={1.5} />}
                    {Math.abs(trend)}%
                  </span>
                </div>
                <p className="text-[13px] text-text-tertiary mt-0.5">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="none">
          <Card.Header title="Reading Trend" subtitle="Last 60 days" />
          <Card.Body>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mockReadingTrend}>
                <defs>
                  <linearGradient id="accentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" interval={9} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                <Area type="monotone" dataKey="count" stroke="var(--color-accent)" strokeWidth={2} fill="url(#accentGradient)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>

        <Card padding="none">
          <Card.Header title="Book Categories" subtitle="Distribution by genre" />
          <Card.Body className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={mockCategoryData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="value" paddingAngle={3} strokeWidth={0}>
                  {mockCategoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
      </div>

      <Card padding="none">
        <Card.Header
          title="School Comparison"
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
                  <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">School Name</th>
                  <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Students</th>
                  <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Registration Rate</th>
                  <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Usage Rate</th>
                </tr>
              </thead>
              <tbody>
                {mockSchools.map((school, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-raised/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{school.name}</td>
                    <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{school.students}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-mono text-[13px]', school.regRate >= 80 ? 'text-success' : school.regRate >= 60 ? 'text-warning' : 'text-error')}>
                        {school.regRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-mono text-[13px]', school.usageRate >= 70 ? 'text-success' : school.usageRate >= 50 ? 'text-warning' : 'text-error')}>
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
    </div>
  );
}
