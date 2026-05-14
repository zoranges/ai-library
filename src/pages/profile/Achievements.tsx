import { useEffect, useState } from 'react';
import { CheckCircle, Lock, Award, Star, BookOpen, Flame, Zap, Users, Sparkles } from 'lucide-react';
import Tabs from '@/components/ui/Tabs';
import { achievementApi, pointApi } from '@/utils/api';

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  reading: BookOpen,
  quiz: Zap,
  streak: Flame,
  social: Users,
  special: Sparkles,
};

const RARITY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  common: { bg: 'bg-bg-tertiary', border: 'border-border', text: 'text-text-tertiary' },
  rare: { bg: 'bg-accent-subtle', border: 'border-accent/20', text: 'text-accent' },
  epic: { bg: 'bg-accent-subtle', border: 'border-accent/30', text: 'text-accent' },
  legendary: { bg: 'bg-warning-subtle', border: 'border-warning/30', text: 'text-warning' },
};

const SECTION_TABS = [
  { key: 'achievements', label: 'Achievements' },
  { key: 'badges', label: 'Badges' },
  { key: 'points', label: 'Points' },
];

export default function Achievements() {
  const [section, setSection] = useState('achievements');
  const [achievements, setAchievements] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [pointRecords, setPointRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [achRes, badgeRes, ptRes] = await Promise.all([
          achievementApi.getAchievements(),
          achievementApi.getBadges(),
          pointApi.getRecords(1, 20),
        ]);
        setAchievements(achRes.data || []);
        setBadges(badgeRes.data || []);
        const ptData = ptRes.data;
        if (Array.isArray(ptData)) {
          setPointRecords(ptData);
        } else if (ptData && Array.isArray((ptData as any).data)) {
          setPointRecords((ptData as any).data);
        } else {
          setPointRecords([]);
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Tabs tabs={SECTION_TABS} activeKey={section} onChange={setSection} variant="pill" size="sm" className="mb-6" />

      {section === 'achievements' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {achievements.map((ach) => {
            const earned = ach.unlocked === true || ach.unlocked === 1;
            const Icon = CATEGORY_ICONS[ach.category] || Star;
            const rarity = RARITY_STYLES[ach.rarity] || RARITY_STYLES.common;
            return (
              <div
                key={ach.id}
                className={`bg-surface rounded-xl border p-4 transition-opacity duration-standard ease-out-quart ${earned ? 'border-border' : 'border-border opacity-50'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    earned ? 'bg-accent-subtle' : 'bg-bg-tertiary'
                  }`}>
                    {earned ? (
                      <Icon className="w-5 h-5 text-accent" strokeWidth={1.5} />
                    ) : (
                      <Lock className="w-4 h-4 text-text-tertiary" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-text-primary truncate">{ach.name}</h4>
                      {earned && <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" strokeWidth={1.5} />}
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{ach.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${rarity.bg} ${rarity.text}`}>
                        {ach.rarity}
                      </span>
                      <span className="text-[11px] font-mono font-medium text-warning tabular-nums">+{ach.points}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {section === 'badges' && (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          {badges.map((badge) => {
            const earned = badge.unlocked === true || badge.unlocked === 1;
            const rarity = RARITY_STYLES[badge.rarity] || RARITY_STYLES.common;
            return (
              <div
                key={badge.id}
                className={`flex flex-col items-center p-4 rounded-xl border shrink-0 w-24 transition-all duration-standard ease-out-quart ${
                  earned ? `${rarity.border} bg-surface` : 'border-border bg-surface opacity-40'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  earned ? 'bg-accent-subtle' : 'bg-bg-tertiary'
                }`}>
                  {earned ? (
                    <Award className={`w-6 h-6 ${rarity.text}`} strokeWidth={1.5} />
                  ) : (
                    <Lock className="w-5 h-5 text-text-tertiary" strokeWidth={1.5} />
                  )}
                </div>
                <p className="text-[11px] font-medium text-text-primary mt-2 text-center truncate w-full">{badge.name}</p>
                <span className={`inline-flex items-center px-1 py-0.5 text-[9px] font-medium rounded mt-1 ${rarity.bg} ${rarity.text}`}>
                  {badge.rarity}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {section === 'points' && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">日期</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">来源</th>
                <th className="text-right px-4 py-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">积分</th>
              </tr>
            </thead>
            <tbody>
              {pointRecords.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-text-tertiary">暂无积分记录</td></tr>
              ) : (
                pointRecords.map((record) => (
                  <tr key={record.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs tabular-nums">
                      {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{record.description}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-warning tabular-nums">+{record.points}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
