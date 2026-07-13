import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, BookOpen, Clock, Star, Award, Target, Zap, Globe, Heart, Users,
  Flame, Timer, CheckCircle, BrainCircuit, CalendarDays,
} from 'lucide-react';
import { readingApi } from '@/utils/api';

interface ReportData {
  user: { username: string; email: string; points: number; level: number };
  overview: {
    totalBooks: number; completedBooks: number; completionRate: number;
    totalReadingMinutes: number; totalPages: number; totalQuizzes: number;
    avgQuizScore: number; totalHighlights: number; totalNotes: number;
    totalAchievements: number; readingStreak: number; readingSpeed: number;
  };
  languageDistribution: Array<{ language: string; count: number }>;
  categoryPreferences: Array<{ name: string; icon: string; color: string; count: number }>;
  difficultyDistribution: Array<{ difficulty: string; count: number }>;
  topAuthors: Array<{ author: string; count: number }>;
  monthlyTrend: Array<{ month: string; books: number; minutes: number }>;
  weeklyMinutes: number[];
  preferenceProfile: string;
  readingStreak: number;
  longestStreak: number;
  readingSpeed: number;
  quizAccuracy: number;
  quizTotalCorrect: number;
  quizTotalQuestions: number;
}

export default function ReadingGrowth() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);

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

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64 text-text-tertiary">
        {t('common.noData')}
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-accent/5 to-transparent px-5 py-4 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary font-heading">{t('growth.title')}</h2>
          <p className="text-xs text-text-tertiary mt-0.5">{generateSummary(report, t)}</p>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <StatCards report={report} t={t} />

      {/* Detailed Summary */}
      <SummaryCard report={report} t={t} />

      {/* Secondary Stats Row */}
      <SecondaryStats report={report} t={t} />

      {/* Monthly Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title={t('growth.booksPerMonth')} icon={<BookOpen className="w-4 h-4" />}>
          <EnhancedBarChart data={report.monthlyTrend.map(m => m.books)} labels={report.monthlyTrend.map(m => m.month)} color="accent" />
        </ChartCard>
        <ChartCard title={t('growth.minutesPerMonth')} icon={<Clock className="w-4 h-4" />}>
          <EnhancedBarChart data={report.monthlyTrend.map(m => m.minutes)} labels={report.monthlyTrend.map(m => m.month)} color="success" />
        </ChartCard>
      </div>

      {/* Weekly Heatmap */}
      {report.weeklyMinutes?.length > 0 && <WeeklyHeatmap data={report.weeklyMinutes} t={t} />}

      {/* Streak + Quiz Performance (2-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StreakCard streak={report.readingStreak} longestStreak={report.longestStreak} t={t} />
        <QuizPerformanceCard
          accuracy={report.quizAccuracy}
          totalQuizzes={report.overview.totalQuizzes}
          totalCorrect={report.quizTotalCorrect}
          totalQuestions={report.quizTotalQuestions}
          avgScore={report.overview.avgQuizScore}
          t={t}
        />
      </div>

      {/* Reading Speed Gauge */}
      <SpeedGaugeCard speed={report.readingSpeed} t={t} />

      {/* Language Distribution */}
      {report.languageDistribution?.length > 0 && (
        <LanguageCard languages={report.languageDistribution} t={t} />
      )}

      {/* Category Preferences + Top Authors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {report.categoryPreferences?.length > 0 && (
          <CategoryCard categories={report.categoryPreferences} t={t} />
        )}
        {report.topAuthors?.length > 0 && (
          <AuthorsCard authors={report.topAuthors} t={t} />
        )}
      </div>

      {/* Difficulty Distribution */}
      {report.difficultyDistribution?.length > 0 && (
        <DifficultyCard difficulties={report.difficultyDistribution} t={t} />
      )}
    </div>
  );
}

/* ───────── Sub-components ───────── */

function generateSummary(report: ReportData, t: any): string {
  const parts: string[] = [];

  if (report.preferenceProfile === 'specialized' && report.categoryPreferences?.[0]) {
    parts.push(t('growth.readingSummarySpecialized', { category: report.categoryPreferences[0].name }));
  } else {
    parts.push(t('growth.readingSummaryBalanced'));
  }

  if ((report.readingStreak ?? 0) > 0) {
    parts.push(t('growth.readingSummaryStreak', { days: report.readingStreak }));
  }

  parts.push(t('growth.readingSummaryKeepItUp'));
  return parts.join(' ');
}

function AnimatedCount({ value, suffix = '', duration = 600 }: { value: number; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else { setDisplay(Math.round(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span className="tabular-nums">{display}{suffix}</span>;
}

function StatCards({ report, t }: { report: ReportData; t: any }) {
  const stats = [
    { icon: BookOpen, label: t('growth.totalBooksRead'), value: report.overview.totalBooks, border: 'border-accent/20', bg: 'bg-accent/5', color: 'text-accent' },
    { icon: Clock, label: t('growth.totalReadingTime'), value: report.overview.totalReadingMinutes, suffix: t('growth.minutes'), border: 'border-success/20', bg: 'bg-success/5', color: 'text-success' },
    { icon: Flame, label: t('growth.readingStreakDays'), value: report.readingStreak, suffix: t('admin.days'), border: 'border-error/20', bg: 'bg-error/5', color: 'text-error' },
    { icon: Star, label: t('growth.totalPointsEarned'), value: report.user.points, border: 'border-warning/20', bg: 'bg-warning/5', color: 'text-warning' },
    { icon: Target, label: t('growth.totalQuizzesTaken'), value: report.overview.totalQuizzes, border: 'border-accent/20', bg: 'bg-accent/5', color: 'text-accent' },
    { icon: Zap, label: t('growth.readingSpeed'), value: report.readingSpeed, suffix: ` ${t('growth.readingSpeedUnit')}`, border: 'border-success/20', bg: 'bg-success/5', color: 'text-success' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {stats.map((stat, i) => (
        <div
          key={i}
          className={`pro-card p-4 ${stat.border} ${stat.bg} animate-slide-in-left`}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
          </div>
          <div className={`text-xl font-bold text-text-primary font-heading`}>
            <AnimatedCount value={stat.value} suffix={stat.suffix || ''} />
          </div>
          <div className="text-[11px] text-text-tertiary mt-0.5 font-medium">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ report, t }: { report: ReportData; t: any }) {
  const topLang = report.languageDistribution?.[0];
  const topCat = report.categoryPreferences?.[0];

  return (
    <div className="pro-card bg-gradient-to-r from-accent/5 to-success/5 border-accent/15 p-5 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
          <BrainCircuit className="w-5 h-5 text-accent" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-primary mb-1.5">{t('growth.readingSummaryTitle')}</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            {generateSummary(report, t)}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-medium">
              <CheckCircle className="w-3 h-3" />
              {t('growth.completionRate', { rate: report.overview.completionRate })}
            </span>
            {topLang && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[11px] font-medium">
                <Globe className="w-3 h-3" />
                {t('books.language')}: {topLang.language}
              </span>
            )}
            {topCat && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[11px] font-medium">
                <Heart className="w-3 h-3" />
                {t('home.categories')}: {topCat.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryStats({ report, t }: { report: ReportData; t: any }) {
  const stats = [
    { icon: BookOpen, label: t('profile.completedBooks'), value: report.overview.completedBooks },
    { icon: Award, label: t('profile.level'), value: report.user.level },
    { icon: Target, label: t('growth.quizAccuracy'), value: `${report.quizAccuracy}%` },
    { icon: Heart, label: t('growth.totalNotes'), value: report.overview.totalNotes },
    { icon: Star, label: t('growth.totalHighlights'), value: report.overview.totalHighlights },
    { icon: Award, label: t('growth.totalAchievements'), value: report.overview.totalAchievements },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="bg-surface border border-border rounded-xl p-3 hover:shadow-1 transition-shadow duration-200 text-center"
        >
          <stat.icon className="w-4 h-4 text-text-tertiary mx-auto mb-1" />
          <div className="text-lg font-bold text-text-primary font-heading tabular-nums">{stat.value}</div>
          <div className="text-[10px] text-text-tertiary leading-tight">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pro-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4 text-text-secondary">
        <div className="w-7 h-7 rounded-lg bg-accent/5 flex items-center justify-center">{icon}</div>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function EnhancedBarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  if (data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-text-tertiary text-xs">No data</div>;
  }

  const maxValue = Math.max(...data, 1);
  const barColors = color === 'accent'
    ? { base: 'bg-accent', hover: 'bg-accent-hover', bg: 'bg-accent/10' }
    : { base: 'bg-success', hover: 'bg-success', bg: 'bg-success/10' };
  const yTicks = [0, Math.round(maxValue * 0.5), maxValue];

  return (
    <div className="flex gap-2 h-40">
      {/* Y-axis */}
      <div className="flex flex-col justify-between items-end pr-2 pb-5 w-10 shrink-0">
        {yTicks.reverse().map((tick, i) => (
          <span key={i} className="text-[9px] text-text-tertiary tabular-nums leading-none">{tick}</span>
        ))}
      </div>

      {/* Bars */}
      <div className="flex-1 relative">
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-dashed border-border"
            style={{ bottom: `${(tick / maxValue) * 100}%` }}
          />
        ))}

        <div className="flex items-end gap-1 h-full">
          {data.map((val, i) => {
            const h = Math.max((val / maxValue) * 100, val > 0 ? 3 : 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 z-10">
                <span className="text-[10px] text-text-tertiary tabular-nums font-medium">{val > 0 ? val : ''}</span>
                <div
                  className={`w-full rounded-t-md ${val > 0 ? barColors.base : 'bg-border/30'} transition-all duration-700 hover:opacity-80 cursor-pointer`}
                  style={{ height: `${h}%` }}
                  title={`${labels[i]}: ${val}`}
                />
                <span className="text-[9px] text-text-tertiary truncate w-full text-center">{labels[i]?.substring(5)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeeklyHeatmap({ data, t }: { data: number[]; t: any }) {
  const maxMin = Math.max(...data, 1);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Align labels to today's actual day
  const today = new Date().getDay();
  const reordered = [...dayNames.slice(today + 1), ...dayNames.slice(0, today + 1)];

  return (
    <div className="pro-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent/5 flex items-center justify-center">
          <CalendarDays className="w-4 h-4 text-accent" />
        </div>
        <span className="text-sm font-semibold text-text-primary">{t('growth.weekReadingHeatmap')}</span>
      </div>
      <div className="flex items-end gap-2 h-32">
        {data.map((val, i) => {
          const h = Math.max((val / maxMin) * 100, val > 0 ? 4 : 2);
          const intensity = val > 0 ? Math.min(val / maxMin, 1) : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-bold text-text-tertiary tabular-nums">{val > 0 ? `${val}m` : ''}</span>
              <div
                className="w-full rounded-t-md transition-all duration-700"
                style={{
                  height: `${h}%`,
                  background: `oklch(${0.55 - intensity * 0.15} ${0.22 - intensity * 0.05} 260)`,
                  opacity: val > 0 ? 0.7 + intensity * 0.3 : 0.2,
                }}
              />
              <span className="text-[10px] text-text-tertiary font-medium">{reordered[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StreakCard({ streak, longestStreak, t }: { streak: number; longestStreak: number; t: any }) {
  return (
    <div className="pro-card p-5 rounded-xl bg-gradient-to-br from-error/5 to-error/10 border-error/20">
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-error/15 flex items-center justify-center">
            <Flame className="w-8 h-8 text-error" style={{ filter: 'drop-shadow(0 0 6px oklch(0.55 0.22 20 / 0.3))' }} />
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">{t('growth.readingStreak')}</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-extrabold text-error font-heading tabular-nums">{streak}</span>
            <span className="text-sm text-text-tertiary font-medium">{t('admin.days')}</span>
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            {t('growth.longestStreak')}: <span className="font-bold text-text-primary tabular-nums">{longestStreak}</span> {t('admin.days')}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizPerformanceCard({ accuracy, totalQuizzes, totalCorrect, totalQuestions, avgScore, t }: {
  accuracy: number; totalQuizzes: number; totalCorrect: number; totalQuestions: number; avgScore: number; t: any;
}) {
  return (
    <div className="pro-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent/5 flex items-center justify-center">
          <BrainCircuit className="w-4 h-4 text-accent" />
        </div>
        <span className="text-sm font-semibold text-text-primary">{t('growth.quizPerformance')}</span>
      </div>
      <div className="flex items-center gap-5">
        <CircularProgress value={accuracy} size={90} strokeWidth={7} />
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wide">{t('leaderboard.quizzesCompleted')}</div>
            <div className="text-lg font-bold text-text-primary tabular-nums">{totalQuizzes}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wide">{t('growth.quizAccuracy')}</div>
            <div className="text-lg font-bold text-text-primary tabular-nums">{accuracy}%</div>
          </div>
          <div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wide">{t('growth.correctAnswered')}</div>
            <div className="text-sm font-semibold text-text-secondary tabular-nums">{totalCorrect} / {totalQuestions}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CircularProgress({ value, size = 80, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  const color = value >= 80 ? 'text-success' : value >= 60 ? 'text-warning' : 'text-error';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor"
          className="text-border" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor"
          className={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <span className="absolute text-sm font-extrabold text-text-primary font-heading tabular-nums">{value}%</span>
    </div>
  );
}

function SpeedGaugeCard({ speed, t }: { speed: number; t: any }) {
  const maxSpeed = 5;
  const ratio = Math.min(speed / maxSpeed, 1);
  const paceDesc = speed > 3 ? t('growth.readingSummaryPaceFast') : speed < 1 ? t('growth.readingSummaryPaceSlow') : t('growth.readingSummaryPaceNormal');

  return (
    <div className="pro-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
          <Timer className="w-4 h-4 text-success" />
        </div>
        <span className="text-sm font-semibold text-text-primary">{t('growth.readingSpeed')}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          {/* Speed bar */}
          <div className="relative h-3 rounded-full bg-bg-tertiary overflow-hidden mb-2">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-success via-warning to-error opacity-20" />
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-success via-warning to-error transition-all duration-700"
              style={{ width: `${ratio * 100}%` }}
            />
            {/* Marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-text shadow-md transition-all duration-700"
              style={{ left: `calc(${ratio * 100}% - 6px)` }}
            />
          </div>
          {/* Labels */}
          <div className="flex items-center justify-between text-[10px] text-text-tertiary">
            <span>{t('growth.readingSummaryPaceSlow')}</span>
            <span>{t('growth.readingSummaryPaceNormal')}</span>
            <span>{t('growth.readingSummaryPaceFast')}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-extrabold text-text-primary font-heading tabular-nums">{speed}</div>
          <div className="text-[11px] text-text-tertiary">{t('growth.readingSpeedUnit')}</div>
          <div className="text-[10px] text-text-secondary mt-0.5 font-medium">{paceDesc}</div>
        </div>
      </div>
    </div>
  );
}

function LanguageCard({ languages, t }: { languages: Array<{ language: string; count: number }>; t: any }) {
  const total = languages.reduce((s, l) => s + l.count, 0) || 1;
  const colors = ['bg-accent', 'bg-success', 'bg-warning', 'bg-error'];

  return (
    <div className="pro-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent/5 flex items-center justify-center">
          <Globe className="w-4 h-4 text-accent" />
        </div>
        <span className="text-sm font-semibold text-text-primary">{t('admin.languageDistribution')}</span>
      </div>
      <div className="flex h-7 rounded-full overflow-hidden bg-bg-tertiary">
        {languages.map((lang, idx) => {
          const pct = Math.round((lang.count / total) * 100);
          return (
            <div
              key={idx}
              className={`${colors[idx % colors.length]} h-full flex items-center justify-center text-[10px] font-bold text-white transition-all duration-700 min-w-[30px]`}
              style={{ width: `${Math.max(pct, 5)}%` }}
            >
              {pct > 12 ? `${lang.language} ${pct}%` : pct > 6 ? `${pct}%` : ''}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        {languages.map((lang, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]}`} />
            <span className="text-xs text-text-primary font-medium">{lang.language}</span>
            <span className="text-[11px] text-text-tertiary tabular-nums">{lang.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ categories, t }: { categories: Array<{ name: string; icon: string; color: string; count: number }>; t: any }) {
  const maxCount = categories[0]?.count || 1;

  return (
    <div className="pro-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent/5 flex items-center justify-center">
          <Heart className="w-4 h-4 text-accent" />
        </div>
        <span className="text-sm font-semibold text-text-primary">{t('home.categories')}</span>
      </div>
      <div className="space-y-3">
        {categories.map((cat, idx) => {
          const barWidth = Math.round((cat.count / maxCount) * 100);
          return (
            <div key={idx} className="flex items-center gap-2 animate-slide-in-left" style={{ animationDelay: `${idx * 60}ms` }}>
              <span className="text-lg">{cat.icon || '📚'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-text-primary">{cat.name}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold tabular-nums">{cat.count}</span>
                </div>
                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${barWidth}%`, backgroundColor: cat.color || '#6366f1' }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuthorsCard({ authors, t }: { authors: Array<{ author: string; count: number }>; t: any }) {
  const maxCount = authors[0]?.count || 1;

  return (
    <div className="pro-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent/5 flex items-center justify-center">
          <Users className="w-4 h-4 text-accent" />
        </div>
        <span className="text-sm font-semibold text-text-primary">{t('books.author')}</span>
      </div>
      <div className="space-y-3">
        {authors.map((author, idx) => {
          const barWidth = Math.round((author.count / maxCount) * 100);
          return (
            <div key={idx} className="flex items-center gap-2 animate-slide-in-left" style={{ animationDelay: `${idx * 60}ms` }}>
              <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-text-primary truncate">{author.author}</span>
                  <span className="text-[11px] text-text-tertiary tabular-nums">{author.count} {t('profile.totalBooks')}</span>
                </div>
                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all duration-700 ease-out" style={{ width: `${barWidth}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DifficultyCard({ difficulties, t }: { difficulties: Array<{ difficulty: string; count: number }>; t: any }) {
  const total = difficulties.reduce((s, d) => s + d.count, 0) || 1;
  const colors: Record<string, string> = { beginner: 'bg-success', intermediate: 'bg-warning', advanced: 'bg-error' };

  return (
    <div className="pro-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent/5 flex items-center justify-center">
          <Zap className="w-4 h-4 text-accent" />
        </div>
        <span className="text-sm font-semibold text-text-primary">{t('books.difficulty')}</span>
      </div>
      <div className="flex items-center gap-4">
        {/* Stacked bar */}
        <div className="flex-1 flex h-7 rounded-full overflow-hidden bg-bg-tertiary">
          {difficulties.map((d, idx) => {
            const pct = Math.round((d.count / total) * 100);
            return (
              <div
                key={idx}
                className={`${colors[d.difficulty] || 'bg-gray-400'} h-full transition-all duration-700 min-w-[40px]`}
                style={{ width: `${Math.max(pct, 10)}%` }}
              />
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 shrink-0">
          {difficulties.map((d, idx) => {
            const pct = Math.round((d.count / total) * 100);
            return (
              <div key={idx} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${colors[d.difficulty] || 'bg-gray-400'}`} />
                <span className="text-xs text-text-primary font-medium capitalize">{d.difficulty}</span>
                <span className="text-[11px] text-text-tertiary tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────── Loading Skeleton ───────── */

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-accent/5 to-transparent px-5 py-4 rounded-xl">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div>
          <div className="skeleton w-40 h-5 rounded-md mb-1" />
          <div className="skeleton w-72 h-3 rounded-md" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="pro-card p-4">
            <div className="skeleton w-8 h-8 rounded-lg mb-2" />
            <div className="skeleton w-16 h-7 rounded-md mb-1" />
            <div className="skeleton w-12 h-3 rounded-md" />
          </div>
        ))}
      </div>

      {/* Summary skeleton */}
      <div className="pro-card p-5">
        <div className="flex items-start gap-3">
          <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton w-24 h-4 rounded-md" />
            <div className="skeleton w-full h-3 rounded-md" />
            <div className="skeleton w-3/4 h-3 rounded-md" />
            <div className="flex gap-2 mt-2">
              <div className="skeleton w-20 h-5 rounded-full" />
              <div className="skeleton w-24 h-5 rounded-full" />
              <div className="skeleton w-20 h-5 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-3 text-center">
            <div className="skeleton w-4 h-4 mx-auto mb-1 rounded" />
            <div className="skeleton w-10 h-6 mx-auto rounded-md mb-0.5" />
            <div className="skeleton w-12 h-2 mx-auto rounded-md" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="pro-card p-5">
          <div className="skeleton w-32 h-4 rounded-md mb-4" />
          <div className="skeleton w-full h-40 rounded-lg" />
        </div>
        <div className="pro-card p-5">
          <div className="skeleton w-32 h-4 rounded-md mb-4" />
          <div className="skeleton w-full h-40 rounded-lg" />
        </div>
      </div>

      {/* Weekly heatmap skeleton */}
      <div className="pro-card p-5">
        <div className="skeleton w-32 h-4 rounded-md mb-4" />
        <div className="skeleton w-full h-32 rounded-lg" />
      </div>

      {/* Streak + Quiz skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="pro-card p-5">
          <div className="skeleton w-20 h-3 rounded-md mb-3" />
          <div className="skeleton w-16 h-10 rounded-md mb-2" />
          <div className="skeleton w-32 h-3 rounded-md" />
        </div>
        <div className="pro-card p-5">
          <div className="skeleton w-20 h-3 rounded-md mb-3" />
          <div className="flex items-center gap-4">
            <div className="skeleton w-20 h-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="skeleton w-24 h-4 rounded-md" />
              <div className="skeleton w-16 h-4 rounded-md" />
              <div className="skeleton w-20 h-4 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
