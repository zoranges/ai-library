import { useEffect, useState, useMemo, useCallback } from 'react';
import { Star, BookOpen, Clock, Crown, School, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Tabs from '@/components/ui/Tabs';
import Select from '@/components/ui/Select';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { leaderboardApi } from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import { getAllStates, getDistrictsByState } from '@/data/malaysiaLocations';
import type { LeaderboardEntry } from '@/types';

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function getScoreValue(entry: LeaderboardEntry, metric: string) {
  if (metric === 'books') return entry.booksRead;
  if (metric === 'readingTime') return `${Math.round(entry.readingTime || (entry as any).totalReadingMinutes || 0)}m`;
  if (metric === 'monthlyPoints') return entry.monthlyPoints ?? 0;
  if (metric === 'yearlyPoints') return entry.yearlyPoints ?? 0;
  return entry.totalPoints ?? entry.points;
}

interface Option {
  value: string;
  label: string;
}

async function fetchSchools(state: string): Promise<Option[]> {
  const token = localStorage.getItem('auth_token');
  const params = new URLSearchParams();
  params.set('country', 'Malaysia');
  if (state) params.set('state', state);
  const res = await fetch(`/api/admin/locations/schools?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).map((d: any) => ({ value: d.value, label: d.label }));
}

type RegionView = 'school' | 'state';

export default function Leaderboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  // Admin-only filter state
  const [selectedCountry] = useState('Malaysia');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schools, setSchools] = useState<Option[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);

  // Student region toggle
  const [studentView, setStudentView] = useState<RegionView>('school');
  const [mySchoolState, setMySchoolState] = useState('');

  const [metric, setMetric] = useState('points');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const allStates = getAllStates();

  const countryOptions = useMemo(() => [
    { value: 'Malaysia', label: 'Malaysia' },
  ], []);

  const stateOptions = useMemo(() => [
    { value: '', label: t('admin.allStates') },
    ...allStates.map((s) => ({ value: s.value, label: s.label })),
  ], [t, allStates]);

  const districtOptions = useMemo(() => [
    { value: '', label: t('admin.allDistricts') },
    ...getDistrictsByState(selectedState).map((d) => ({ value: d.value, label: d.label })),
  ], [t, selectedState]);

  const schoolOptions = useMemo(() => [
    { value: '', label: t('admin.allSchools') },
    ...schools,
  ], [t, schools]);

  // Fetch student's school state on mount
  useEffect(() => {
    if (!isAdmin) {
      leaderboardApi.getMySchool().then(res => {
        if (res.data?.state) {
          setMySchoolState(res.data.state);
        }
      }).catch(() => {});
    }
  }, [isAdmin]);

  // Fetch schools when state/district changes (admin only)
  useEffect(() => {
    setSchools([]);
    setSelectedSchoolId('');
    if (!selectedState || !isAdmin) return;
    setSchoolsLoading(true);
    fetchSchools(selectedState)
      .then(setSchools)
      .finally(() => setSchoolsLoading(false));
  }, [selectedState, selectedDistrict, isAdmin]);

  const METRIC_TABS = [
    { key: 'points', label: t('leaderboard.totalPoints'), icon: <Star className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { key: 'monthlyPoints', label: t('leaderboard.monthlyPoints'), icon: <Star className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { key: 'yearlyPoints', label: t('leaderboard.yearlyPoints'), icon: <Star className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { key: 'books', label: t('leaderboard.byBooks'), icon: <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { key: 'readingTime', label: t('profile.totalMinutes'), icon: <Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  ];

  const REGION_TABS = [
    { key: 'school', label: t('leaderboard.schoolRegion'), icon: <School className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { key: 'state', label: t('leaderboard.stateRegion'), icon: <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  ];

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      try {
        const params: Record<string, any> = {
          type: metric,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        };

        if (isAdmin) {
          // Admin: use cascading filter selection
          if (selectedSchoolId) {
            params.schoolId = selectedSchoolId;
          } else if (selectedDistrict) {
            params.district = selectedDistrict;
          } else if (selectedState) {
            params.state = selectedState;
          }
        } else {
          // Student: only school or own state
          if (studentView === 'state' && mySchoolState) {
            params.state = mySchoolState;
          }
          // For 'school' view, backend already restricts to their own school
        }

        const res = await leaderboardApi.getLeaderboard(params);
        const rawData = res.data;
        if (Array.isArray(rawData)) {
          setEntries(rawData as any);
        } else if (rawData && Array.isArray((rawData as any).data)) {
          setEntries((rawData as any).data);
        } else {
          setEntries([]);
        }
      } catch {
        setEntries([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
  }, [startDate, endDate, metric, selectedState, selectedSchoolId, studentView, mySchoolState, isAdmin]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const currentUserEntry = entries.find((e) => e.userId === user?.id);
  const currentUserInList = currentUserEntry && currentUserEntry.rank <= 3;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-text-primary font-heading">{t('leaderboard.title')}</h1>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />

        {isAdmin ? (
          /* Admin: full cascading location filter */
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-28">
              <Select options={countryOptions} value={selectedCountry} onChange={() => {}} />
            </div>
            <div className="w-36">
              <Select
                options={stateOptions}
                value={selectedState}
                onChange={(v) => { setSelectedState(v); setSelectedDistrict(''); }}
              />
            </div>
            <div className="w-36">
              <Select
                options={districtOptions}
                value={selectedDistrict}
                onChange={(v) => { setSelectedDistrict(v); }}
                disabled={!selectedState}
              />
            </div>
            <div className="w-40">
              <Select
                options={schoolOptions}
                value={selectedSchoolId}
                onChange={setSelectedSchoolId}
                placeholder={schoolsLoading ? t('common.loading') : t('admin.searchSchools')}
              />
            </div>
          </div>
        ) : (
          /* Student: only My School / My State toggle */
          <div className="sm:ml-2">
            <Tabs
              tabs={REGION_TABS}
              activeKey={studentView}
              onChange={(k) => setStudentView(k as RegionView)}
              variant="pill"
              size="sm"
            />
          </div>
        )}

        <div className="sm:ml-auto">
          <Tabs tabs={METRIC_TABS} activeKey={metric} onChange={setMetric} variant="pill" size="sm" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-card" />)}
        </div>
      ) : (
        <>
          {top3.length >= 3 && (
            <div className="flex items-end justify-center gap-4 mb-8">
              {[1, 0, 2].map((idx) => {
                const entry = top3[idx];
                if (!entry) return null;
                const rank = idx + 1;
                const isFirst = rank === 1;
                return (
                  <div
                    key={entry.userId}
                    className={`flex flex-col items-center ${isFirst ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'}`}
                  >
                    <div className="relative">
                      <div
                        className={`rounded-full flex items-center justify-center text-white font-bold ${
                          isFirst
                            ? 'w-16 h-16 text-lg bg-gradient-to-br from-accent to-brand-600 ring-2 ring-accent/30 ring-offset-2 ring-offset-bg-primary'
                            : 'w-12 h-12 text-sm bg-gradient-to-br from-brand-400 to-brand-600/80'
                        }`}
                      >
                        {getInitials(entry.username || entry.user?.username || 'U')}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        rank === 1 ? 'bg-accent text-white' : 'bg-surface border border-border text-text-tertiary'
                      }`}>
                        {rank}
                      </div>
                      {isFirst && (
                        <Crown className="w-5 h-5 text-amber-400 absolute -top-7 left-1/2 -translate-x-1/2" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className={`mt-3 text-center ${isFirst ? 'mt-4' : 'mt-2'}`}>
                      <p className={`font-bold text-text-primary ${isFirst ? 'text-sm' : 'text-xs'}`}>
                        {entry.username || entry.user?.username || t('leaderboard.student')}
                      </p>
                      <p className="text-[11px] text-text-tertiary mt-0.5">{entry.school?.name || ''}</p>
                      <p className={`font-bold mt-1 text-sm ${rank === 1 ? 'text-accent' : 'text-text-secondary'}`}>
                        {getScoreValue(entry, metric)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {rest.map((entry) => {
              const isCurrentUser = entry.userId === user?.id;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${
                    isCurrentUser ? 'bg-accent/5' : ''
                  }`}
                >
                  <span className="w-6 text-center text-xs font-mono font-medium text-text-tertiary tabular-nums">
                    {entry.rank}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-accent/70 flex items-center justify-center text-white text-[10px] font-semibold">
                    {getInitials(entry.username || entry.user?.username || 'U')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-accent' : 'text-text-primary'}`}>
                      {entry.username || entry.user?.username || t('leaderboard.student')}
                    </p>
                    <p className="text-[11px] text-text-tertiary">{entry.school?.name || ''}</p>
                  </div>
                  <span className={`text-sm font-mono font-medium tabular-nums ${isCurrentUser ? 'text-accent' : 'text-text-primary'}`}>
                    {getScoreValue(entry, metric)}
                  </span>
                </div>
              );
            })}
          </div>

          {currentUserEntry && !currentUserInList && (
            <div className="mt-3 bg-surface rounded-xl border border-accent/20 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-accent/5">
                <span className="w-6 text-center text-xs font-mono font-medium text-accent tabular-nums">
                  {currentUserEntry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-[10px] font-semibold">
                  {getInitials(user?.username || 'U')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-accent">{user?.username || t('leaderboard.student')}</p>
                  <p className="text-[11px] text-text-tertiary">{currentUserEntry.school?.name || ''}</p>
                </div>
                <span className="text-sm font-mono font-medium text-accent tabular-nums">
                  {getScoreValue(currentUserEntry, metric)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
