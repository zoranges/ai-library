import { useEffect, useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Clock, Star, Flame, Edit3, BarChart3, History, Heart, FileText, Award } from 'lucide-react';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { statsApi } from '@/utils/api';
import type { ReadingStats } from '@/types';

const NAV_TABS = [
  { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" strokeWidth={1.5} /> },
  { key: 'history', label: 'History', icon: <History className="w-4 h-4" strokeWidth={1.5} /> },
  { key: 'favorites', label: 'Favorites', icon: <Heart className="w-4 h-4" strokeWidth={1.5} /> },
  { key: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" strokeWidth={1.5} /> },
  { key: 'achievements', label: 'Achievements', icon: <Award className="w-4 h-4" strokeWidth={1.5} /> },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Profile() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pathSuffix = location.pathname.replace('/profile', '').replace('/', '') || 'overview';
  const activeTab = NAV_TABS.find((t) => t.key === pathSuffix)?.key || 'overview';

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await statsApi.getReadingStats();
        setStats(res.data || null);
      } catch {
        setStats(null);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function handleTabChange(key: string) {
    if (key === 'overview') navigate('/profile');
    else navigate(`/profile/${key}`);
  }

  const isOverview = activeTab === 'overview';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-surface rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-brand-600 flex items-center justify-center text-white text-lg font-bold shrink-0">
            {user?.username?.slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-text-primary font-heading">{user?.username || 'user'}</h2>
            <p className="text-sm text-text-tertiary mt-0.5">{user?.email || ''}</p>
          </div>
          <Button variant="outline" size="sm" icon={<Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />} className="rounded-xl">
            Edit Profile
          </Button>
        </div>
      </div>

      <Tabs tabs={NAV_TABS} activeKey={activeTab} onChange={handleTabChange} variant="underline" fullWidth className="mb-6" />

      {isOverview ? (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Books Read', value: stats?.totalBooks ?? 0, icon: BookOpen, cardClass: 'border-accent/20', bgClass: 'bg-accent/5', textClass: 'text-accent' },
              { label: 'Reading Time', value: `${stats?.totalMinutes ?? 0}m`, icon: Clock, cardClass: 'border-success/20', bgClass: 'bg-success/5', textClass: 'text-success' },
              { label: 'Total Points', value: stats?.points ?? 0, icon: Star, cardClass: 'border-warning/20', bgClass: 'bg-warning/5', textClass: 'text-warning' },
              { label: 'Streak', value: stats?.streak ?? 0, icon: Flame, cardClass: 'border-error/20', bgClass: 'bg-error/5', textClass: 'text-error' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`bg-surface rounded-xl border p-4 hover:-translate-y-1 transition-all duration-200 ${item.cardClass}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${item.bgClass}`}>
                    <Icon className={`w-4 h-4 ${item.textClass}`} strokeWidth={1.5} />
                  </div>
                  <div className="text-xl font-bold text-text-primary font-heading tabular-nums">
                    {item.value}
                  </div>
                  <div className="text-[12px] text-text-tertiary mt-0.5 font-medium">{item.label}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-surface rounded-xl border border-border mb-6 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-accent/5">
              <h3 className="text-sm font-bold text-text-primary font-heading">Reading Activity (7 Days)</h3>
            </div>
            <div className="p-4">
              <div className="flex items-end gap-2 h-28">
                {(stats?.weeklyMinutes || [0, 0, 0, 0, 0, 0, 0]).map((min, i) => {
                  const maxMin = Math.max(...(stats?.weeklyMinutes || [1]), 1);
                  const height = Math.max((min / maxMin) * 100, 4);
                  const barColors = ['bg-accent/30','bg-accent/40','bg-accent/50','bg-accent/60','bg-accent/70','bg-accent/80','bg-accent/90'];
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-bold text-text-tertiary tabular-nums">{min}m</span>
                      <div className="w-full bg-bg-tertiary rounded-t-lg flex-1 flex items-end overflow-hidden">
                        <div
                          className={`w-full ${barColors[i]} rounded-t-lg transition-all duration-emphasized ease-out-quart`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-text-tertiary">{WEEKDAYS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary font-heading">Recent Reading</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/profile/history')}>
                View All
              </Button>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary text-center py-4">No recent reading records</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
