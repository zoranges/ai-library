import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';

const periodOptions = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const regionOptions = [
  { value: '', label: 'All Regions' },
  { value: 'Selangor', label: 'Selangor' },
  { value: 'Kuala Lumpur', label: 'Kuala Lumpur' },
  { value: 'Penang', label: 'Penang' },
];

const metricOptions = [
  { value: 'points', label: 'Points' },
  { value: 'books', label: 'Books Read' },
  { value: 'quizzes', label: 'Quizzes' },
  { value: 'streak', label: 'Streak' },
];

const mockLeaderboard = [
  { rank: 1, name: 'Ahmad Razif', school: 'SMK Tunku Abdul Rahman', points: 2450, booksRead: 32, quizzes: 28, streak: 15 },
  { rank: 2, name: 'Siti Aminah', school: 'SK Bukit Damansara', points: 2280, booksRead: 28, quizzes: 25, streak: 12 },
  { rank: 3, name: 'Rajesh Nair', school: 'SMK Sri Hartamas', points: 2150, booksRead: 25, quizzes: 22, streak: 10 },
  { rank: 4, name: 'Lim Wei Ming', school: 'SK Bangsar', points: 1980, booksRead: 22, quizzes: 20, streak: 8 },
  { rank: 5, name: 'Nurul Aisyah', school: 'SMK Pantai', points: 1870, booksRead: 20, quizzes: 18, streak: 7 },
  { rank: 6, name: 'Kumar Selvan', school: 'SMK Tunku Abdul Rahman', points: 1750, booksRead: 18, quizzes: 16, streak: 6 },
  { rank: 7, name: 'Tan Mei Ling', school: 'SK Bukit Damansara', points: 1620, booksRead: 16, quizzes: 14, streak: 5 },
  { rank: 8, name: 'Amirul Hakim', school: 'SMK Sri Hartamas', points: 1540, booksRead: 15, quizzes: 13, streak: 4 },
  { rank: 9, name: 'Priya Devi', school: 'SK Bangsar', points: 1480, booksRead: 14, quizzes: 12, streak: 4 },
  { rank: 10, name: 'Muhammad Faris', school: 'SMK Pantai', points: 1350, booksRead: 12, quizzes: 10, streak: 3 },
];

const medalColors: Record<number, string> = {
  1: 'bg-amber-400',
  2: 'bg-slate-400',
  3: 'bg-orange-400',
};

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
  const [period, setPeriod] = useState('month');
  const [region, setRegion] = useState('');
  const [metric, setMetric] = useState('points');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(mockLeaderboard);

  useEffect(() => {
    adminApi.getLeaderboard({ period, schoolId: region || undefined }).then((res) => {
      if (res.data?.data) setData(res.data.data);
    }).catch(() => {});
  }, [period, region]);

  const filtered = data.filter((e) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary font-heading">Leaderboard Management</h2>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-32"><Select options={periodOptions} value={period} onChange={setPeriod} /></div>
        <div className="w-36"><Select options={regionOptions} value={region} onChange={setRegion} /></div>
        <div className="w-36"><Select options={metricOptions} value={metric} onChange={setMetric} /></div>
        <div className="w-56"><Input placeholder="Search student name..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} /></div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-16">Rank</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Name</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">School</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Points</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Books</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Quizzes</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Streak</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  key={entry.rank}
                  className={cn(
                    'border-b border-border transition-colors',
                    entry.rank <= 3 ? 'bg-accent/[0.02]' : 'hover:bg-surface-raised/30'
                  )}
                >
                  <td className="px-4 py-3 text-center">{getRankDisplay(entry.rank)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 bg-accent/10 rounded-full flex items-center justify-center text-accent text-[11px] font-semibold shrink-0">{entry.name.charAt(0)}</div>
                      <span className="font-medium text-text-primary">{entry.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{entry.school}</td>
                  <td className="px-4 py-3 text-right font-semibold text-text-primary font-mono text-[13px]">{entry.points.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{entry.booksRead}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{entry.quizzes}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={entry.streak >= 10 ? 'success' : entry.streak >= 5 ? 'warning' : 'default'} size="sm">{entry.streak}d</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
