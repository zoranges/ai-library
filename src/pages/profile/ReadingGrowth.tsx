import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, BookOpen, Clock, Star, Award, Target, Zap, Globe, Heart, Users } from 'lucide-react';
import { readingApi } from '@/utils/api';

export default function ReadingGrowth() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      const res = await readingApi.getReport();
      setReport(res.data || null);
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  }

  const overviewStats = [
    { icon: BookOpen, label: t('growth.totalBooksRead'), value: report?.overview?.totalBooks || 0, color: 'text-blue-400' },
    { icon: Clock, label: t('growth.totalReadingTime'), value: `${report?.overview?.totalReadingMinutes || 0}m`, color: 'text-emerald-400' },
    { icon: Star, label: t('growth.totalPointsEarned'), value: report?.user?.points || 0, color: 'text-amber-400' },
    { icon: Target, label: t('growth.totalQuizzesTaken'), value: report?.overview?.totalQuizzes || 0, color: 'text-purple-400' },
  ];

  const monthlyTrend = report?.monthlyTrend || [];
  const months = monthlyTrend.map((m: any) => m.month);
  const booksPerMonth = monthlyTrend.map((m: any) => m.books);
  const minutesPerMonth = monthlyTrend.map((m: any) => m.minutes);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-accent" />
        <h2 className="text-xl font-bold text-text-primary">{t('growth.title')}</h2>
      </div>

      {report?.preferenceProfile && (
        <div className="bg-accent/5 border border-accent/15 rounded-xl px-4 py-3 text-sm text-text-secondary">
          <span className="font-semibold text-accent">{t('growth.overview')}: </span>
          {report.preferenceProfile === 'specialized'
            ? 'You have a focused reading style, diving deep into your favorite genres.'
            : 'You have a balanced reading style, exploring a wide variety of genres.'}
          {' · '}{t('growth.completionRate', { rate: report.overview?.completionRate || 0 })}
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewStats.map((stat, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-xs text-text-tertiary">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">{loading ? '-' : stat.value}</div>
          </div>
        ))}
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { icon: BookOpen, label: t('profile.completedBooks'), value: report?.overview?.completedBooks || 0 },
          { icon: Star, label: t('profile.level'), value: report?.user?.level || 1 },
          { icon: Award, label: t('leaderboard.quizzesCompleted'), value: `${report?.overview?.avgQuizScore || 0}%` },
          { icon: Heart, label: t('profile.notes'), value: report?.overview?.totalNotes || 0 },
          { icon: Award, label: t('profile.achievements'), value: report?.overview?.totalAchievements || 0 },
        ].map((stat, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-3">
            <stat.icon className="w-4 h-4 text-text-tertiary mb-1" />
            <div className="text-lg font-bold text-text-primary">{loading ? '-' : stat.value}</div>
            <div className="text-[11px] text-text-tertiary">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Monthly Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('growth.booksPerMonth')} icon={<BookOpen className="w-4 h-4" />}>
          {!loading && <BarChart data={booksPerMonth} labels={months} color="bg-blue-400" maxValue={Math.max(...booksPerMonth, 1)} />}
        </ChartCard>
        <ChartCard title={t('growth.minutesPerMonth')} icon={<Clock className="w-4 h-4" />}>
          {!loading && <BarChart data={minutesPerMonth} labels={months} color="bg-emerald-400" maxValue={Math.max(...minutesPerMonth, 1)} />}
        </ChartCard>
      </div>

      {/* Language Distribution */}
      {report?.languageDistribution?.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-bold text-text-primary">{t('admin.languageDistribution')}</h3>
          </div>
          <div className="flex items-center gap-2 h-6 rounded-full overflow-hidden bg-bg-tertiary">
            {report.languageDistribution.map((lang: any, idx: number) => {
              const total = report.languageDistribution.reduce((s: number, l: any) => s + l.count, 0) || 1;
              const pct = Math.round((lang.count / total) * 100);
              const colors = ['bg-blue-400', 'bg-red-400', 'bg-emerald-400', 'bg-amber-400'];
              return (
                <div
                  key={idx}
                  className={`${colors[idx % colors.length]} h-full flex items-center justify-center text-[10px] font-medium text-white min-w-[40px]`}
                  style={{ width: `${pct}%` }}
                >
                  {pct > 10 ? `${lang.language} ${pct}%` : pct > 5 ? `${pct}%` : ''}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Preferences + Top Authors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {report?.categoryPreferences?.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-bold text-text-primary">{t('home.categories')}</h3>
            </div>
            <div className="space-y-2">
              {report.categoryPreferences.map((cat: any, idx: number) => {
                const maxCount = report.categoryPreferences[0].count || 1;
                const barWidth = Math.round((cat.count / maxCount) * 100);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon || '📚'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-medium text-text-primary">{cat.name}</span>
                        <span className="text-text-tertiary tabular-nums">{cat.count}</span>
                      </div>
                      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: cat.color || '#6366f1' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {report?.topAuthors?.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-bold text-text-primary">{t('books.author')}</h3>
            </div>
            <div className="space-y-2">
              {report.topAuthors.map((author: any, idx: number) => {
                const maxCount = report.topAuthors[0].count || 1;
                const barWidth = Math.round((author.count / maxCount) * 100);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-medium text-text-primary truncate">{author.author}</span>
                        <span className="text-text-tertiary tabular-nums">{author.count}</span>
                      </div>
                      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Difficulty Distribution */}
      {report?.difficultyDistribution?.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-bold text-text-primary">{t('books.difficulty')}</h3>
          </div>
          <div className="flex items-center gap-3">
            {report.difficultyDistribution.map((d: any, idx: number) => {
              const total = report.difficultyDistribution.reduce((s: number, x: any) => s + x.count, 0) || 1;
              const pct = Math.round((d.count / total) * 100);
              const colors: Record<string, string> = { beginner: 'bg-emerald-400', intermediate: 'bg-amber-400', advanced: 'bg-red-400' };
              return (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${colors[d.difficulty] || 'bg-gray-400'}`} />
                  <span className="text-xs text-text-primary font-medium">{d.difficulty}</span>
                  <span className="text-[11px] text-text-tertiary tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4 text-text-secondary">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

function BarChart({ data, labels, color, maxValue }: { data: number[]; labels: string[]; color: string; maxValue: number }) {
  if (data.length === 0) return <div className="h-32 flex items-center justify-center text-text-tertiary text-xs">No data</div>;
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[10px] text-text-tertiary">{val || ''}</span>
          <div
            className={`w-full rounded-t-sm ${color} transition-all duration-300`}
            style={{ height: `${Math.max((val / maxValue) * 100, 2)}%`, minHeight: val > 0 ? '4px' : '1px', opacity: val > 0 ? 0.8 : 0.2 }}
          />
          <span className="text-[9px] text-text-tertiary truncate w-full text-center">{labels[i]?.substring(5)}</span>
        </div>
      ))}
    </div>
  );
}
