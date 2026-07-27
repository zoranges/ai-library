import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Ban, ChevronDown, ChevronUp, Download, Loader2, Check, Upload, FileSpreadsheet, AlertCircle, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import CascadingFilter from '@/components/ui/CascadingFilter';
import { useAuthStore } from '@/stores/authStore';
import { adminApi } from '@/utils/api';
import { exportToExcel } from '@/utils/export';
import { getAllStates, getDistrictsByState } from '@/data/malaysiaLocations';

export default function SchoolManagement() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ country: '', state: '', district: '', schoolId: '' });
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', country: 'Malaysia', state: '', district: '', address: '', contactPhone: '', contactEmail: '' });
  const [adminCredentials, setAdminCredentials] = useState<{ username: string; email: string; password: string } | null>(null);
  const [createdSchoolId, setCreatedSchoolId] = useState<string | null>(null);
  const [studentReports, setStudentReports] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [wlFile, setWlFile] = useState<File | null>(null);
  const [wlUploading, setWlUploading] = useState(false);
  const [wlResult, setWlResult] = useState<{ total: number; inserted: number; skipped: number } | null>(null);
  const [wlError, setWlError] = useState('');
  const [welcomeImage, setWelcomeImage] = useState('');
  const [welcomeImageUploading, setWelcomeImageUploading] = useState(false);
  const [welcomeImageSaved, setWelcomeImageSaved] = useState(false);

  const allStates = getAllStates();

  const COUNTRY_OPTIONS = [
    { value: 'Malaysia', label: 'Malaysia' },
  ];

  const isMalaysia = form.country === 'Malaysia';

  const formStateOptions = useMemo(() => [
    { value: '', label: t('admin.state') },
    ...allStates.map((s) => ({ value: s.value, label: s.label })),
  ], [t, allStates]);

  const formDistrictOptions = useMemo(() => [
    { value: '', label: t('admin.district') },
    ...getDistrictsByState(form.state).map((d) => ({ value: d.value, label: d.label })),
  ], [t, form.state]);

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { pageSize: 500 };
      if (search) params.search = search;
      if (filters.country) params.country = filters.country;
      if (filters.state) params.state = filters.state;
      if (filters.district) params.district = filters.district;
      const res = await adminApi.getSchools(params);
      setSchools(res.data?.data || []);
    } catch {} finally {
      setLoading(false);
    }
  }, [search, filters]);

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
    setAdminCredentials(null);
    setWlFile(null);
    setWlResult(null);
    setWlError('');
    setWelcomeImage('');
    setWelcomeImageSaved(false);
    setForm({ name: '', country: 'Malaysia', state: '', district: '', address: '', contactPhone: '', contactEmail: '' });
    setModalOpen(true);
  }

  function openEdit(school: any) {
    setEditId(school.id);
    setForm({
      name: school.name || '',
      country: school.country || 'Malaysia',
      state: school.state || '',
      district: school.district || '',
      address: school.address || '',
      contactPhone: school.contactPhone || '',
      contactEmail: school.contactEmail || '',
    });
    setWelcomeImage(school.welcomeImage || '');
    setWelcomeImageSaved(false);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.state) return;
    if (editId) {
      await adminApi.updateSchool(editId, { ...form, welcomeImage }).catch(() => {});
      setModalOpen(false);
    } else {
      const res: any = await adminApi.createSchool(form).catch(() => {});
      if (res?.data?.id) {
        setCreatedSchoolId(res.data.id);
      }
      if (res?.data?.admin) {
        setAdminCredentials(res.data.admin);
        return;
      }
      setModalOpen(false);
    }
    fetchSchools();
  }

  async function toggleStatus(school: any) {
    await adminApi.updateSchool(school.id, { ...school, isActive: school.isActive ? 0 : 1 }).catch(() => {});
    fetchSchools();
  }

  async function handleHardDelete(school: any) {
    if (!window.confirm(`Permanently delete "${school.name}" and ALL students, data, and whitelist entries? This CANNOT be undone.`)) return;
    try {
      await adminApi.hardDeleteSchool(school.id);
      fetchSchools();
    } catch (err: any) {
      alert(err?.message || 'Delete failed');
    }
  }

  async function handleWhitelistUpload(schoolId: string) {
    if (!wlFile) return;
    setWlUploading(true);
    setWlError('');
    setWlResult(null);
    try {
      const result = await adminApi.uploadWhitelist(schoolId, wlFile);
      setWlResult(result);
      setWlFile(null);
    } catch (err: unknown) {
      setWlError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setWlUploading(false);
    }
  }

  function resetModal() {
    setModalOpen(false);
    setAdminCredentials(null);
    setCreatedSchoolId(null);
    setWlFile(null);
    setWlResult(null);
    setWlError('');
    setWelcomeImage('');
    setWelcomeImageSaved(false);
  }

  async function handleWelcomeImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setWelcomeImageUploading(true);
    try {
      const result = await adminApi.uploadFile(file);
      setWelcomeImage(result.url);
      setWelcomeImageSaved(true);
      setTimeout(() => setWelcomeImageSaved(false), 2000);
    } catch {} finally {
      setWelcomeImageUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.schools')}</h2>
        {isSuper && <Button variant="secondary" icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={openAdd}>{t('admin.addSchool')}</Button>}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {isSuper && <CascadingFilter values={filters} onChange={setFilters} showSchool={false} />}
        <div className="w-60"><Input placeholder={t('admin.searchSchools')} value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} /></div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.schoolName')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.country')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.state')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.district')}</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.students')}</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('common.status')}</th>
                {isSuper && <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-24">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isSuper ? 7 : 6} className="text-center py-12 text-text-tertiary"><Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" strokeWidth={1.5} />{t('common.loading')}</td></tr>
              ) : schools.length === 0 ? (
                <tr><td colSpan={isSuper ? 7 : 6} className="text-center py-12 text-text-tertiary">{t('common.noData')}</td></tr>
              ) : (
                schools.map((school) => (
                  <SchoolRow
                    key={school.id}
                    school={school}
                    expanded={expandedId === school.id}
                    onToggle={() => loadSchoolReport(school.id)}
                    onEdit={() => openEdit(school)}
                    onToggleStatus={() => toggleStatus(school)}
                    onHardDelete={() => handleHardDelete(school)}
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

      <Modal isOpen={modalOpen} onClose={resetModal} title={editId ? t('admin.editSchool') : t('admin.addSchool')} footer={adminCredentials ? <Button onClick={() => { resetModal(); fetchSchools(); }}>{t('common.close')}</Button> : <><Button variant="ghost" onClick={resetModal}>{t('common.cancel')}</Button><Button onClick={handleSave}>{editId ? t('common.save') : t('common.create')}</Button></>}>
        {adminCredentials ? (
          <div className="space-y-4">
            <div className="p-4 bg-success/5 border border-success/15 rounded-lg">
              <p className="text-[13px] font-medium text-success mb-3">School created successfully! Admin account credentials:</p>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between"><span className="text-text-tertiary">Username:</span><span className="font-mono font-medium text-text-primary">{adminCredentials.username}</span></div>
                <div className="flex justify-between"><span className="text-text-tertiary">Email:</span><span className="font-mono font-medium text-text-primary">{adminCredentials.email}</span></div>
                <div className="flex justify-between"><span className="text-text-tertiary">Password:</span><span className="font-mono font-medium text-text-primary">{adminCredentials.password}</span></div>
              </div>
            </div>
            <p className="text-[12px] text-warning">Please save these credentials. The password cannot be recovered.</p>

            {/* Whitelist Upload Section */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span className="text-[13px] font-medium text-text-primary">{t('admin.uploadWhitelist')}</span>
              </div>
              <p className="text-[11px] text-text-tertiary mb-2">{t('admin.uploadWhitelistHint')}</p>
              <p className="text-[10px] text-text-tertiary mb-3 px-2 py-1.5 bg-surface-raised/50 rounded border border-border">{t('admin.excelFormat')}</p>

              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-border rounded-lg cursor-pointer hover:border-accent/40 hover:bg-accent/[0.02] transition-colors text-[12px] text-text-tertiary">
                  <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="truncate">{wlFile ? wlFile.name : t('admin.dragOrClick')}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      setWlFile(e.target.files?.[0] || null);
                      setWlResult(null);
                      setWlError('');
                    }}
                  />
                </label>
                <Button
                  size="sm"
                  disabled={!wlFile || wlUploading}
                  loading={wlUploading}
                  onClick={() => handleWhitelistUpload(createdSchoolId!)}
                  className="shrink-0"
                >
                  {wlUploading ? t('admin.uploading') : t('admin.uploadWhitelist')}
                </Button>
              </div>

              {wlError && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-error">
                  <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {wlError}
                </div>
              )}

              {wlResult && (
                <div className="mt-2 p-2.5 bg-success/5 border border-success/10 rounded text-[12px] text-success">
                  {t('admin.uploadSuccess').replace('{inserted}', String(wlResult.inserted)).replace('{skipped}', String(wlResult.skipped))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input label={t('admin.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select label={t('admin.country')} options={COUNTRY_OPTIONS} value={form.country} onChange={(v) => setForm({ ...form, country: v, state: '', district: '' })} />
            {isMalaysia ? (
              <div className="grid grid-cols-2 gap-3">
                <Select label={t('admin.state')} options={formStateOptions.filter((o) => o.value)} value={form.state} onChange={(v) => setForm({ ...form, state: v, district: '' })} />
                <Select label={t('admin.district')} options={formDistrictOptions.filter((o) => o.value)} value={form.district} onChange={(v) => setForm({ ...form, district: v })} disabled={!form.state} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('admin.state')} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                <Input label={t('admin.district')} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
              </div>
            )}
            <Input label={t('admin.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('admin.contactPhone')} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              <Input label={t('admin.adminEmail')} type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="admin@school.edu.my" />
            </div>

            {editId && (
              <div className="pt-3 border-t border-border">
                <p className="text-[13px] font-medium text-text-primary mb-2">{t('admin.welcomeImage', 'Welcome Card Image')}</p>
                <div className="flex items-center gap-3">
                  <div className="h-20 w-36 rounded-lg bg-surface-raised border border-border overflow-hidden shrink-0">
                    {welcomeImage ? (
                      <img src={welcomeImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-text-tertiary">
                        <Upload className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-text-tertiary mb-2 truncate">
                      {welcomeImage || 'No custom image set'}
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border cursor-pointer hover:border-accent/40 hover:bg-accent/[0.02] transition-colors text-[12px] text-text-secondary">
                      {welcomeImageUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                      ) : welcomeImageSaved ? (
                        <Check className="h-3.5 w-3.5 text-success" strokeWidth={1.5} />
                      ) : (
                        <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                      {welcomeImageUploading ? 'Uploading...' : welcomeImageSaved ? 'Saved' : 'Replace image'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleWelcomeImageUpload}
                        disabled={welcomeImageUploading}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function SchoolRow({ school, expanded, onToggle, onEdit, onToggleStatus, onHardDelete, studentReports, reportLoading, selectedIds, onToggleStudent, onToggleAll, onExportSelected, reportDateFrom, reportDateTo, onDateFromChange, onDateToChange }: {
  school: any;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onHardDelete: () => void;
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
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  return (
    <>
      <tr className="border-b border-border hover:bg-surface-raised/30 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} /> : <ChevronDown className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />}
            <button className="font-medium text-text-primary hover:text-accent transition-colors text-left" onClick={(e) => { e.stopPropagation(); navigate(`/admin/schools/${school.id}`); }}>{school.name}</button>
          </div>
        </td>
        <td className="px-4 py-3 text-text-secondary text-[13px]">{school.country || '-'}</td>
        <td className="px-4 py-3 text-text-secondary text-[13px]">{school.state || '-'}</td>
        <td className="px-4 py-3 text-text-secondary text-[13px]">{school.district || '-'}</td>
        <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{school.studentCount ?? '-'}</td>
        <td className="px-4 py-3 text-center">
          <Badge variant={school.isActive ? 'success' : 'error'} dot size="sm">{school.isActive ? t('common.active') : t('common.inactive')}</Badge>
        </td>
        {isSuper && (
          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-0.5">
              <button onClick={onEdit} className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors"><Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
              <button onClick={onToggleStatus} className="p-1.5 rounded-md text-text-tertiary hover:text-warning hover:bg-warning/5 transition-colors"><Ban className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
              <button onClick={onHardDelete} className="p-1.5 rounded-md text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={isSuper ? 7 : 6} className="bg-surface-raised/20 px-6 py-4">
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
