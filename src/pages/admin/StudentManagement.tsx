import { useState } from 'react';
import { Search, Download, X, BookOpen, Clock, Target, Award } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const tabItems = [
  { key: 'all', label: 'All' },
  { key: 'registered', label: 'Registered' },
  { key: 'unregistered', label: 'Unregistered' },
];

const stateOptions = [
  { value: '', label: 'All States' },
  { value: 'Selangor', label: 'Selangor' },
  { value: 'Kuala Lumpur', label: 'Kuala Lumpur' },
];

const schoolOptions = [
  { value: '', label: 'All Schools' },
  { value: '1', label: 'SMK Tunku Abdul Rahman' },
  { value: '2', label: 'SK Bukit Damansara' },
];

const activityOptions = [
  { value: '', label: 'All Levels' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const mockStudents = [
  { id: '1', name: 'Ahmad Razif', email: 'ahmad@school.my', school: 'SMK Tunku Abdul Rahman', regDate: '2024-01-15', booksRead: 12, readingTime: '24h 30m', status: 'active', avatar: '', ic: '050101-10-1234' },
  { id: '2', name: 'Siti Aminah', email: 'siti@school.my', school: 'SK Bukit Damansara', regDate: '2024-02-20', booksRead: 8, readingTime: '18h 15m', status: 'active', avatar: '', ic: '060202-14-5678' },
  { id: '3', name: 'Rajesh Nair', email: 'rajesh@school.my', school: 'SMK Sri Hartamas', regDate: '2024-03-10', booksRead: 15, readingTime: '32h 45m', status: 'active', avatar: '', ic: '050505-08-9012' },
  { id: '4', name: 'Lim Wei Ming', email: 'lim@school.my', school: 'SK Bangsar', regDate: '2024-04-05', booksRead: 3, readingTime: '5h 20m', status: 'inactive', avatar: '', ic: '070707-06-3456' },
  { id: '5', name: 'Nurul Aisyah', email: 'nurul@school.my', school: 'SMK Pantai', regDate: '', booksRead: 0, readingTime: '0h', status: 'unregistered', avatar: '', ic: '080808-02-7890' },
];

const langData = [
  { name: 'Malay', value: 45 },
  { name: 'English', value: 35 },
  { name: 'Chinese', value: 15 },
  { name: 'Tamil', value: 5 },
];

export default function StudentManagement() {
  const [tab, setTab] = useState('all');
  const [state, setState] = useState('');
  const [school, setSchool] = useState('');
  const [activity, setActivity] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = mockStudents.filter((s) => {
    if (tab === 'registered' && s.status === 'unregistered') return false;
    if (tab === 'unregistered' && s.status !== 'unregistered') return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const student = selected ? mockStudents.find((s) => s.id === selected) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">Student Management</h2>
        <Button icon={<Download className="h-4 w-4" strokeWidth={1.5} />} variant="outline" size="sm">Export</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-surface-raised rounded-md p-0.5 gap-0.5">
          {tabItems.map((t) => (
            <button
              key={t.key}
              className={cn(
                'px-3 py-1 text-[13px] font-medium rounded-[4px] transition-all duration-micro ease-out-quart',
                tab === t.key
                  ? 'bg-surface text-text-primary shadow-1'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="w-32"><Select options={stateOptions} value={state} onChange={setState} /></div>
        <div className="w-44"><Select options={schoolOptions} value={school} onChange={setSchool} /></div>
        <div className="w-32"><Select options={activityOptions} value={activity} onChange={setActivity} /></div>
        <div className="w-56"><Input placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} /></div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Name</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Email</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">School</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Registered</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Books</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className={cn(
                    'border-b border-border cursor-pointer transition-colors',
                    selected === s.id ? 'bg-accent/5' : 'hover:bg-surface-raised/30'
                  )}
                  onClick={() => setSelected(s.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-semibold shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <span className="font-medium text-text-primary">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{s.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.school}</td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-[13px]">{s.regDate || '—'}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{s.booksRead}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={s.status === 'active' ? 'success' : s.status === 'inactive' ? 'warning' : 'default'}
                      dot
                      size="sm"
                    >
                      {s.status === 'unregistered' ? 'Unregistered' : s.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {student && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-[400px] bg-surface shadow-3 overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-surface border-b border-border px-5 py-3 flex items-center justify-between z-10">
              <h3 className="text-sm font-semibold text-text-primary">Student Details</h3>
              <button onClick={() => setSelected(null)} className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors">
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-accent/10 rounded-full flex items-center justify-center text-accent font-bold text-lg shrink-0">{student.name.charAt(0)}</div>
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary">{student.name}</p>
                  <p className="text-[13px] text-text-secondary">{student.email}</p>
                  <p className="text-[11px] text-text-tertiary">{student.school} · IC: {student.ic}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: BookOpen, label: 'Books Read', value: student.booksRead, color: 'text-accent' },
                  { icon: Clock, label: 'Total Time', value: student.readingTime, color: 'text-success' },
                  { icon: Target, label: 'Avg Session', value: '45m', color: 'text-warning' },
                  { icon: Award, label: 'Quiz Score', value: '82%', color: 'text-purple-500' },
                ].map((s, i) => (
                  <div key={i} className="bg-surface-raised/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <s.icon className={cn('h-4 w-4', s.color)} strokeWidth={1.5} />
                      <div>
                        <p className="text-base font-semibold text-text-primary font-mono">{s.value}</p>
                        <p className="text-[11px] text-text-tertiary">{s.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-[13px] font-medium text-text-primary mb-2">Language Distribution</h4>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={langData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {langData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-[13px] font-medium text-text-primary mb-2">Read Books</h4>
                <div className="space-y-1.5">
                  {['The Magic Tree House', 'Science Explorer', 'Malaysian Folk Tales'].map((b, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-surface-raised/50 rounded-md">
                      <span className="text-[13px] text-text-primary">{b}</span>
                      <span className="text-[11px] text-text-tertiary font-mono">{100 - i * 15}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
