import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Ban, ChevronDown, ChevronUp, Download, Loader2, Check } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { adminApi } from '@/utils/api';
import { exportToExcel } from '@/utils/export';

export default function SchoolManagement() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', state: '', city: '', address: '', contactPhone: '', contactEmail: '' });
  const [studentReports, setStudentReports] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const stateOptions = [
    { value: '', label: t('admin.allStates') },
    { value: 'Selangor', label: 'Selangor' },
    { value: 'Kuala Lumpur', label: 'Kuala Lumpur' },
    { value: 'Penang', label: 'Penang' },
    { value: 'Johor', label: 'Johor' },
  ];

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { pageSize: 500 };
      if (search) params.search = search;
      const res = await adminApi.getSchools(params);
      let data = res.data?.data || [];
      if (state) data = data.filter((s: any) => s.state === state);
      if (city) data = data.filter((s: any) => s.city === city);
      setSchools(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [search, state, city]);

  useEffect(() => { fetchSchools(); }, [fetchSchools]);

  async function loadSchoolReport(schoolId: string) {
    setExpandedId(expandedId === schoolId ? null : schoolId);
    if (expandedId === schoolId) return;
    setReportLoading(true);
    setSelectedStudentIds(new Set());
    try {
      const res = await adminApi.exportSchoolReport(schoolId);
      setStudentReports(res.data?.students || []);
    } catch { setStudentReports([]); } finally {
      setReportLoading(false);
    }
  }

  function toggleStudentSelect(id: string) {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedStudentIds(next);
  }

  function toggleAllStudents() {
    if (selectedStudentIds.size === studentReports.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(studentReports.map((s: any) => s.studentId)));
    }
  }

  async function handleExportSelected() {
    const ids = Array.from(selectedStudentIds);
    if (ids.length === 0) return;
    try {
      const res = await adminApi.exportStudentsReport(ids);
      const students = res.data?.students || [];
      const rows = students.map((r: any) => ({
        Name: r.student?.username || '',
        Email: r.student?.email || '',
        'Books Read': r.stats?.totalBooks || 0,
        'Completed Books': r.stats?.completedBooks || 0,
        'Reading Minutes': r.stats?.totalReadingMinutes || 0,
        'Avg Quiz Score': `${Math.round(r.stats?.avgQuizScore || 0)}%`,
      }));
      exportToExcel(rows, `school-report-${new Date().toISOString().split('T')[0]}`);
    } catch { console.error('Export failed'); }
  }

  function openAdd() {
    setEditId(null);
    setForm({ name: '', state: '', city: '', address: '', contactPhone: '', contactEmail: '' });
    setModalOpen(true);
  }

  function openEdit(school: any) {
    setEditId(school.id);
    setForm({
      name: school.name || '',
      state: school.state || '',
      city: school.city || '',
      address: school.address || '',
      contactPhone: school.contactPhone || '',
      contactEmail: school.contactEmail || '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    if (editId) {
      await adminApi.updateSchool(editId, form).catch(() => {});
    } else {
      await adminApi.createSchool(form).catch(() => {});
    }
    setModalOpen(false);
    fetchSchools();
  }

  async function toggleStatus(school: any) {
    await adminApi.updateSchool(school.id, { ...school, isActive: school.isActive ? 0 : 1 }).catch(() => {});
    fetchSchools();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.schools')}</h2>
        {isSuper && <Button variant="secondary" icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={openAdd}>{t('admin.addSchool')}</Button>}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-36"><Select options={stateOptions} value={state} onChange={(v) => { setState(v); setCity(''); }} /></div>
        {state && (
          <div className="w-36">
            <Select
              options={[
                { value: '', label: t('admin.allCities') },
                ...(state === 'Selangor' ? ['Petaling Jaya', 'Shah Alam'] : state === 'Kuala Lumpur' ? ['KL Central', 'Bangsar'] : state === 'Penang' ? ['Georgetown'] : ['Johor Bahru']).map(c => ({ value: c, label: c }))
              ]}
              value={city}
              onChange={setCity}
            />
          </div>
        )}
        <div className="w-60"><Input placeholder={t('admin.searchSchools')} value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} /></div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.schoolName')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.stateCity')}</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.students')}</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('common.status')}</th>
                {isSuper && <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-24">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isSuper ? 5 : 4} className="text-center py-12 text-text-tertiary"><Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" strokeWidth={1.5} />{t('common.loading')}</td></tr>
              ) : schools.length === 0 ? (
                <tr><td colSpan={isSuper ? 5 : 4} className="text-center py-12 text-text-tertiary">{t('common.noData')}</td></tr>
              ) : (
                schools.map((school) => (
                  <SchoolRow
                    key={school.id}
                    school={school}
                    expanded={expandedId === school.id}
                    onToggle={() => loadSchoolReport(school.id)}
                    onEdit={() => openEdit(school)}
                    onToggleStatus={() => toggleStatus(school)}
                    studentReports={studentReports}
                    reportLoading={reportLoading}
                    selectedIds={selectedStudentIds}
                    onToggleStudent={toggleStudentSelect}
                    onToggleAll={toggleAllStudents}
                    onExportSelected={handleExportSelected}
                    reportDateFrom={reportDateFrom}
                    reportDateTo={reportDateTo}
                    onDateFromChange={setReportDateFrom}
                    onDateToChange={setReportDateTo}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? t('admin.editSchool') : t('admin.addSchool')} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={handleSave}>{editId ? t('common.save') : t('common.create')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('admin.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('admin.state')} options={stateOptions.filter((o) => o.value)} value={form.state} onChange={(v) => setForm({ ...form, state: v, city: '' })} />
            <Input label={t('admin.city')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <Input label={t('admin.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('admin.contactPhone')} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            <Input label={t('admin.contactEmail')} type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SchoolRow({ school, expanded, onToggle, onEdit, onToggleStatus, studentReports, reportLoading, selectedIds, onToggleStudent, onToggleAll, onExportSelected, reportDateFrom, reportDateTo, onDateFromChange, onDateToChange }: {
  school: any;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  studentReports: any[];
  reportLoading: boolean;
  selectedIds: Set<string>;
  onToggleStudent: (id: string) => void;
  onToggleAll: () => void;
  onExportSelected: () => void;
  reportDateFrom: string;
  reportDateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  return (
    <>
      <tr className="border-b border-border hover:bg-surface-raised/30 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} /> : <ChevronDown className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />}
            <span className="font-medium text-text-primary">{school.name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-text-secondary">{[school.state, school.city].filter(Boolean).join(' / ') || '-'}</td>
        <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{school.studentCount ?? '-'}</td>
        <td className="px-4 py-3 text-center">
          <Badge variant={school.isActive ? 'success' : 'error'} dot size="sm">{school.isActive ? t('common.active') : t('common.inactive')}</Badge>
        </td>
        {isSuper && (
          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-0.5">
              <button onClick={onEdit} className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors"><Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
              <button onClick={onToggleStatus} className="p-1.5 rounded-md text-text-tertiary hover:text-warning hover:bg-warning/5 transition-colors"><Ban className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={isSuper ? 5 : 4} className="bg-surface-raised/20 px-6 py-4">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h4 className="text-[13px] font-medium text-text-primary">{t('admin.studentReport')}</h4>
                <div className="flex items-center gap-1.5">
                  <input type="date" value={reportDateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="bg-surface border border-border rounded-md px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
                  <span className="text-text-tertiary text-[11px]">-</span>
                  <input type="date" value={reportDateTo} onChange={(e) => onDateToChange(e.target.value)} className="bg-surface border border-border rounded-md px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {studentReports.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={onToggleAll} icon={<Check className="h-3.5 w-3.5" strokeWidth={1.5} />}>
                    {selectedIds.size === studentReports.length ? t('admin.deselectAll') : t('admin.selectAll')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={selectedIds.size === 0} icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} />} onClick={onExportSelected}>
                  {t('admin.exportReport')} {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </Button>
              </div>
            </div>
            {reportLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent" strokeWidth={1.5} /></div>
            ) : studentReports.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-[12px] text-text-tertiary font-medium w-8"></th>
                    <th className="text-left py-2 text-[12px] text-text-tertiary font-medium">{t('admin.name')}</th>
                    <th className="text-left py-2 text-[12px] text-text-tertiary font-medium">{t('admin.email')}</th>
                    <th className="text-right py-2 text-[12px] text-text-tertiary font-medium">{t('admin.booksRead')}</th>
                    <th className="text-right py-2 text-[12px] text-text-tertiary font-medium">{t('admin.totalReadingTime')}</th>
                    <th className="text-right py-2 text-[12px] text-text-tertiary font-medium">{t('admin.avgQuizScore')}</th>
                  </tr>
                </thead>
                <tbody>
                  {studentReports.map((r: any) => (
                    <tr key={r.studentId} className="border-b border-border last:border-0 hover:bg-surface-raised/30 transition-colors cursor-pointer" onClick={() => onToggleStudent(r.studentId)}>
                      <td className="py-2">
                        <input type="checkbox" checked={selectedIds.has(r.studentId)} onChange={() => onToggleStudent(r.studentId)} className="rounded" />
                      </td>
                      <td className="py-2 text-text-primary font-medium">{r.username}</td>
                      <td className="py-2 text-text-secondary text-[13px]">{r.email}</td>
                      <td className="py-2 text-right text-text-secondary font-mono text-[13px]">{r.totalBooks ?? r.completedBooks ?? 0}</td>
                      <td className="py-2 text-right text-text-secondary font-mono text-[13px]">{Math.round((r.totalReadingMinutes || 0) / 60)}h {(r.totalReadingMinutes || 0) % 60}m</td>
                      <td className="py-2 text-right text-text-secondary font-mono text-[13px]">{Math.round(r.avgQuizScore || 0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center py-8 text-text-tertiary text-[13px]">{t('common.noData')}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
