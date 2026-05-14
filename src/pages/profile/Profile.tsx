import { useEffect, useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Clock, Star, Flame, Edit3, BarChart3, History, Heart, FileText, Award } from 'lucide-react';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { statsApi } from '@/utils/api';
import type { ReadingStats } from '@/types';

const NAV_TABS = [
  { key: 'overview', label: '概览', icon: <BarChart3 className="w-4 h-4" strokeWidth={1.5} /> },
  { key: 'history', label: '历史', icon: <History className="w-4 h-4" strokeWidth={1.5} /> },
  { key: 'favorites', label: '收藏', icon: <Heart className="w-4 h-4" strokeWidth={1.5} /> },
  { key: 'notes', label: '笔记', icon: <FileText className="w-4 h-4" strokeWidth={1.5} /> },
  { key: 'achievements', label: '成就', icon: <Award className="w-4 h-4" strokeWidth={1.5} /> },
];

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

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
    <div className="page-container max-w-4xl mx-auto">
      <div className="bg-surface rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-surface text-lg font-semibold shrink-0">
            {user?.username?.slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text-primary font-heading">{user?.username || '用户'}</h2>
            <p className="text-sm text-text-tertiary mt-0.5">{user?.email || ''}</p>
          </div>
          <Button variant="outline" size="sm" icon={<Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />}>
            编辑资料
          </Button>
        </div>
      </div>

      <Tabs tabs={NAV_TABS} activeKey={activeTab} onChange={handleTabChange} variant="underline" fullWidth className="mb-6" />

      {isOverview ? (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: '已读图书', value: stats?.totalBooks ?? 0, icon: BookOpen, emphasized: true },
              { label: '阅读时长', value: `${stats?.totalMinutes ?? 0}m`, icon: Clock, emphasized: false },
              { label: '总积分', value: stats?.points ?? 0, icon: Star, emphasized: false },
              { label: '连续天数', value: stats?.streak ?? 0, icon: Flame, emphasized: false },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`bg-surface rounded-xl border p-4 ${
                    item.emphasized ? 'border-accent/20' : 'border-border'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${
                    item.emphasized ? 'bg-accent-subtle' : 'bg-bg-tertiary'
                  }`}>
                    <Icon className={`w-4 h-4 ${item.emphasized ? 'text-accent' : 'text-text-tertiary'}`} strokeWidth={1.5} />
                  </div>
                  <div className={`font-mono tabular-nums ${item.emphasized ? 'text-2xl font-medium text-text-primary' : 'text-xl font-medium text-text-primary'}`}>
                    {item.value}
                  </div>
                  <div className="text-[13px] text-text-tertiary mt-0.5">{item.label}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-surface rounded-xl border border-border mb-6">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary font-heading">近7天阅读活动</h3>
            </div>
            <div className="p-4">
              <div className="flex items-end gap-2 h-28">
                {(stats?.weeklyMinutes || [0, 0, 0, 0, 0, 0, 0]).map((min, i) => {
                  const maxMin = Math.max(...(stats?.weeklyMinutes || [1]), 1);
                  const height = Math.max((min / maxMin) * 100, 4);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-mono text-text-tertiary tabular-nums">{min}m</span>
                      <div className="w-full bg-bg-tertiary rounded-sm flex-1 flex items-end">
                        <div
                          className="w-full bg-accent/70 rounded-sm transition-all duration-emphasized ease-out-quart"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-text-tertiary">{WEEKDAYS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary font-heading">最近阅读</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/profile/history')}>
                查看全部
              </Button>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary text-center py-4">暂无最近阅读记录</p>
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
