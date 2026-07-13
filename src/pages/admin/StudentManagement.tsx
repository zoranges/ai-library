import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Download, X, BookOpen, Clock, Target, Award, Loader2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import CascadingFilter from '@/components/ui/CascadingFilter';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';
import { exportToExcel } from '@/utils/export';
import ActivityHeatmap from '@/components/ui/ActivityHeatmap';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function StudentManagement() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ country: '', state: '', district: '', schoolId: '' });
  const [activity, setActivity] = useState('');
  const [regDateFrom, setRegDateFrom] = useState('');
  const [regDateTo, setRegDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [studentReport, setStudentReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const tabItems = [
    { key: 'all', label: t('common.all') },
    { key: 'registered', label: t('admin.registered') },
    { key: 'unregistered', label: t('admin.unregistered') },
  ];

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize };
      if (search) params.search = search;
      if (filters.country) params.country = filters.country;
      if (filters.state) params.state = filters.state;
      if (filters.district) params.district = filters.district;
      if (filters.schoolId) params.schoolId = filters.schoolId;
      if (regDateFrom) params.regDateFrom = regDateFrom;
      if (regDateTo) params.regDateTo = regDateTo;
      if (tab === 'registered') params.isDeregistered = '0';
      else if (tab === 'unregistered') params.isDeregistered = '1';
      else params.isDeregistered = 'all';
      const res = await adminApi.getStudents(params);
      setStudents(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch {} finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filters, tab, regDateFrom, regDateTo]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents, tab]);

  async function loadStudentReport(id: string) {
    setSelectedId(id);
    setReportLoading(true);
    try {
      const params: Record<string, any> = {};
      if (regDateFrom) params.startDate = regDateFrom;
      if (regDateTo) params.endDate = regDateTo;
      const res = await adminApi.getStudentReport(id, params);
      setStudentReport(res.data);
    } catch {
      setStudentReport(null);
    } finally {
      setReportLoading(false);
    }
  }

  async function handleHardDelete(id: string, studentName: string) {
    if (!window.confirm(`Permanently delete "${studentName}" and ALL associated data (reading history, quizzes, notes, etc.)? This action CANNOT be undone.`)) return;
    try {
      await adminApi.hardDeleteStudent(id);
      fetchStudents();
      setSelectedId(null);
    } catch (err: any) {
      alert(err?.message || 'Delete failed');
    }
  }

  async function handleExportAll() {
    try {
      const res = await adminApi.getStudents({ pageSize: 1000 });
      const data = res.data?.data || [];
      exportToExcel(
        data.map((s: any) => ({
          Name: s.username,
          Email: s.email,
          School: s.schoolName,
          Grade: s.grade,
          Points: s.points,
          Level: s.level,
          Status: s.isDeregistered ? 'Deregistered' : 'Active',
        })),
        `all-students-${new Date().toISOString().split('T')[0]}`
      );
    } catch { console.error('Export failed'); }
  }

  const totalPages = Math.ceil(total / pageSize);
  const report = studentReport;
  const studentInfo = report?.student;
  const stats = report?.readingStats || {};
  const readingHistory = report?.readingHistory || [];
  const dailyActivity = report?.dailyActivity || [];
  const langData = report?.languageDistribution;

  const activityOptions = [
    { value: '', label: t('admin.allLevels') },
    { value: 'high', label: t('admin.high') },
    { value: 'medium', label: t('admin.medium') },
    { value: 'low', label: t('admin.low') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.studentManagement')}</h2>
        <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" strokeWidth={1.5} />} onClick={handleExportAll}>
          {t('common.export')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-surface-raised rounded-md p-0.5 gap-0.5">
          {tabItems.map((tItem) => (
            <button
              key={tItem.key}
              className={cn(
                'px-3 py-1 text-[13px] font-medium rounded-[4px] transition-all duration-micro ease-out-quart',
                tab === tItem.key ? 'bg-surface text-text-primary shadow-1' : 'text-text-tertiary hover:text-text-secondary'
              )}
              onClick={() => { setTab(tItem.key); setPage(1); }}
            >
              {tItem.label}
            </button>
          ))}
        </div>
        {isSuper && <CascadingFilter values={filters} onChange={(v) => { setFilters(v); setPage(1); }} />}
        <div className="w-32"><Select options={activityOptions} value={activity} onChange={setActivity} /></div>
        <div className="flex items-center gap-1.5">
          <input type="date" value={regDateFrom} onChange={(e) => { setRegDateFrom(e.target.value); setPage(1); }} className="bg-surface border border-border rounded-md px-2 py-1.5 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
          <span className="text-text-tertiary text-[12px]">-</span>
          <input type="date" value={regDateTo} onChange={(e) => { setRegDateTo(e.target.value); setPage(1); }} className="bg-surface border border-border rounded-md px-2 py-1.5 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
        </div>
        <div className="w-56"><Input placeholder={t('admin.searchStudents')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} /></div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.name')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.email')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('auth.school')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.registered')}</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('common.status')}</th>
                {isSuper && <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-24">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isSuper ? 6 : 5} className="text-center py-12 text-text-tertiary"><Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" strokeWidth={1.5} />{t('common.loading')}</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={isSuper ? 6 : 5} className="text-center py-12 text-text-tertiary">{t('common.noData')}</td></tr>
              ) : (
                students.map((s: any) => (
                  <tr
                    key={s.id}
                    className={cn('border-b border-border cursor-pointer transition-colors', selectedId === s.id ? 'bg-accent/5' : 'hover:bg-surface-raised/30')}
                    onClick={() => loadStudentReport(s.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-semibold shrink-0">
                          {(s.username || s.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-text-primary">{s.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{s.email}</td>
                    <td className="px-4 py-3 text-text-secondary">{s.schoolName || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-[13px]">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={s.isDeregistered ? 'warning' : 'success'} dot size="sm">
                        {s.isDeregistered ? t('admin.deregistered') : t('common.active')}
                      </Badge>
                    </td>
                    {isSuper && (
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleHardDelete(s.id, s.username)}>
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-[12px] text-text-tertiary">{t('common.page')} {page} / {totalPages} ({total} {t('admin.students').toLowerCase()})</span>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />}>{t('admin.previous')}</Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('admin.next')}<ChevronRight className="h-3.5 w-3.5 ml-1" strokeWidth={1.5} /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Student Detail Slide Panel */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setSelectedId(null)} />
          <div className="relative w-full max-w-[440px] bg-surface shadow-3 overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-surface border-b border-border px-5 py-3 flex items-center justify-between z-10">
              <h3 className="text-sm font-semibold text-text-primary">{t('admin.studentDetails')}</h3>
              <button onClick={() => setSelectedId(null)} className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors">
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {reportLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" strokeWidth={1.5} /></div>
              ) : report ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-accent/10 rounded-full flex items-center justify-center text-accent font-bold text-lg shrink-0">
                      {studentInfo?.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary">{studentInfo?.username}</p>
                      <p className="text-[13px] text-text-secondary">{studentInfo?.email}</p>
                      <p className="text-[11px] text-text-tertiary">{studentInfo?.schoolName} · IC: {studentInfo?.icNumber || '-'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { icon: BookOpen, label: t('admin.booksRead'), value: stats?.totalBooks || 0, color: 'text-accent' },
                      { icon: Clock, label: t('admin.totalReadingTime'), value: `${Math.round((stats?.totalMinutes || 0) / 60)}h ${(stats?.totalMinutes || 0) % 60}m`, color: 'text-success' },
                      { icon: Target, label: t('admin.avgQuizScore'), value: `${Math.round(stats?.avgScore || stats?.avgQuizScore || 0)}%`, color: 'text-warning' },
                      { icon: Award, label: t('admin.completedBooks'), value: stats?.completedBooks || 0, color: 'text-purple-500' },
                    ].map((item, i) => (
                      <div key={i} className="bg-surface-raised/50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <item.icon className={cn('h-4 w-4', item.color)} strokeWidth={1.5} />
                          <div>
                            <p className="text-base font-semibold text-text-primary font-mono">{item.value}</p>
                            <p className="text-[11px] text-text-tertiary">{item.label}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border border-border rounded-lg p-3">
                    <h4 className="text-[13px] font-medium text-text-primary mb-2">{t('readingActivity')}</h4>
                    <ActivityHeatmap data={dailyActivity} />
                    <p className="text-[10px] text-text-tertiary mt-1">{dailyActivity.length} days with activity</p>
                  </div>

                  {langData && langData.length > 0 && (
                    <div>
                      <h4 className="text-[13px] font-medium text-text-primary mb-2">{t('admin.languageDistribution')}</h4>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={langData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" nameKey="name" paddingAngle={3} strokeWidth={0}>
                            {langData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div>
                    <h4 className="text-[13px] font-medium text-text-primary mb-2">{t('admin.readBooks')}</h4>
                    <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                      {readingHistory.length > 0 ? readingHistory.slice(0, 10).map((b: any, i: number) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-surface-raised/50 rounded-md">
                          <span className="text-[13px] text-text-primary truncate">{b.bookTitle || b.bookId}</span>
                          <span className="text-[11px] text-text-tertiary font-mono shrink-0 ml-2">{b.percentage || 0}%</span>
                        </div>
                      )) : (
                        <p className="text-[12px] text-text-tertiary text-center py-4">{t('common.noData')}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <Button size="sm" variant="outline" icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} />} onClick={async () => {
                      try {
                        const params: Record<string, any> = {};
                        if (regDateFrom) params.startDate = regDateFrom;
                        if (regDateTo) params.endDate = regDateTo;
                        const expRes = await adminApi.exportStudentReport(selectedId, params);
                        const data = expRes.data;
                        const rows = (data?.readingHistory || []).map((h: any) => ({
                          Book: h.bookTitle,
                          Author: h.bookAuthor,
                          Progress: `${h.percentage || 0}%`,
                          Completed: h.isCompleted ? 'Yes' : 'No',
                          'Last Read': h.lastReadAt ? new Date(h.lastReadAt).toLocaleString() : '',
                        }));
                        exportToExcel(rows, `student-report-${studentInfo?.username || selectedId}-${new Date().toISOString().split('T')[0]}`);
                      } catch { console.error('Export failed'); }
                    }}>
                      {t('admin.exportReport')}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-center py-8 text-text-tertiary">{t('common.noData')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
