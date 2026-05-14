import { useState } from 'react';
import { Download, BookOpen, Clock, Users, Target } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { cn } from '@/lib/utils';

const periodOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

const stateOptions = [
  { value: '', label: 'All States' },
  { value: 'Selangor', label: 'Selangor' },
  { value: 'Kuala Lumpur', label: 'Kuala Lumpur' },
  { value: 'Penang', label: 'Penang' },
];

const cityOptions = [
  { value: '', label: 'All Cities' },
  { value: 'Petaling Jaya', label: 'Petaling Jaya' },
  { value: 'Shah Alam', label: 'Shah Alam' },
  { value: 'Bangsar', label: 'Bangsar' },
];

const schoolOptions = [
  { value: '', label: 'All Schools' },
  { value: '1', label: 'SMK Tunku Abdul Rahman' },
  { value: '2', label: 'SK Bukit Damansara' },
];

const mockTrend = Array.from({ length: 30 }, (_, i) => ({
  date: `${i + 1}`,
  sessions: Math.floor(Math.random() * 300) + 150,
  readers: Math.floor(Math.random() * 150) + 80,
}));

const mockLangDist = [
  { language: 'Malay', count: 420 },
  { language: 'English', count: 350 },
  { language: 'Chinese', count: 180 },
  { language: 'Tamil', count: 90 },
];

const mockTopBooks = [
  { title: 'The Magic Tree House', reads: 245 },
  { title: 'Science Explorer', reads: 198 },
  { title: 'Malaysian Folk Tales', reads: 167 },
  { title: 'Digital World', reads: 134 },
  { title: 'Art Through Ages', reads: 112 },
  { title: 'History of Malaysia', reads: 98 },
  { title: 'Math Adventures', reads: 87 },
  { title: 'Nature Discovery', reads: 76 },
];

export default function Statistics() {
  const [period, setPeriod] = useState('month');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [school, setSchool] = useState('');

  const stats = [
    { icon: BookOpen, label: 'Total Sessions', value: '12,847', color: 'text-accent', bg: 'bg-accent/10' },
    { icon: Clock, label: 'Total Time', value: '3,240h', color: 'text-success', bg: 'bg-success/10' },
    { icon: Target, label: 'Avg Duration', value: '24m', color: 'text-warning', bg: 'bg-warning/10' },
    { icon: Users, label: 'Active Readers', value: '1,523', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">Data Statistics</h2>
        <Button icon={<Download className="h-4 w-4" strokeWidth={1.5} />} variant="outline" size="sm">Export</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-surface-raised rounded-md p-0.5 gap-0.5">
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                'px-2.5 py-1 text-[12px] font-medium rounded-[4px] transition-all duration-micro ease-out-quart',
                period === opt.value
                  ? 'bg-surface text-text-primary shadow-1'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="w-36"><Select options={stateOptions} value={state} onChange={setState} placeholder="State" /></div>
        <div className="w-36"><Select options={cityOptions} value={city} onChange={setCity} placeholder="City" /></div>
        <div className="w-44"><Select options={schoolOptions} value={school} onChange={setSchool} placeholder="School" /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-3 bg-surface border border-border rounded-lg p-3.5">
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', s.bg)}>
                <Icon className={cn('h-4 w-4', s.color)} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-lg font-semibold text-text-primary font-mono tracking-tight">{s.value}</p>
                <p className="text-[12px] text-text-tertiary">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Card padding="none">
        <Card.Header title="Reading Trend" subtitle="Sessions over time" />
        <Card.Body>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={mockTrend}>
              <defs>
                <linearGradient id="statsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
              <Area type="monotone" dataKey="sessions" stroke="var(--color-accent)" strokeWidth={2} fill="url(#statsGradient)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="none">
          <Card.Header title="Language Distribution" />
          <Card.Body>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mockLangDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="language" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>

        <Card padding="none">
          <Card.Header title="Top Books" subtitle="By total reads" />
          <Card.Body>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mockTopBooks} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="title" tick={{ fontSize: 11 }} stroke="var(--color-text-tertiary)" width={110} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', boxShadow: 'var(--shadow-2)' }} />
                <Bar dataKey="reads" fill="var(--color-success)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
