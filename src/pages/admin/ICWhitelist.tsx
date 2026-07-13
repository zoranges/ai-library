import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Trash2, Loader2, Plus, FileSpreadsheet, Upload, FileText } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import CascadingFilter from '@/components/ui/CascadingFilter';
import { useAuthStore } from '@/stores/authStore';
import { adminApi } from '@/utils/api';

const PAGE_SIZE = 100;

export default function ICWhitelist() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState({ country: '', state: '', district: '', schoolId: '' });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [newIc, setNewIc] = useState('');
  const [modalFilter, setModalFilter] = useState({ country: '', state: '', district: '', schoolId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Bulk upload state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ total: number; inserted: number; skipped: number } | null>(null);
  const [bulkError, setBulkError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res: any = await adminApi.getWhitelist({ ...filterValues, search, page: 0, pageSize: PAGE_SIZE });
        if (cancelled) return;
        const data = res.data || [];
        setEntries(data);
        setTotal(res.total || data.length);
        setHasMore(PAGE_SIZE < (res.total || 0));
        setPage(0);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filterValues.country, filterValues.state, filterValues.district, filterValues.schoolId, search, refreshKey]);

  async function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    setLoading(true);
    try {
      const res: any = await adminApi.getWhitelist({ ...filterValues, search, page: nextPage, pageSize: PAGE_SIZE });
      setEntries((prev) => [...prev, ...(res.data || [])]);
      setTotal(res.total || 0);
      setHasMore((nextPage + 1) * PAGE_SIZE < (res.total || 0));
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newIc.trim() || !modalFilter.schoolId) return;
    setSaving(true);
    setError('');
    try {
      await adminApi.createWhitelist(newIc.trim(), modalFilter.schoolId);
      setModalOpen(false);
      setNewIc('');
      setModalFilter({ country: '', state: '', district: '', schoolId: '' });
      setFilterValues({ country: '', state: '', district: '', schoolId: '' });
      setSearch('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to add');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminApi.deleteWhitelist(deleteId);
      setDeleteId(null);
      setRefreshKey((k) => k + 1);
    } catch {} finally {
      setDeleting(false);
    }
  }

  async function handleBulkUpload() {
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkError('');
    setBulkResult(null);
    try {
      const result = await adminApi.uploadWhitelistFile(bulkFile);
      setBulkResult(result);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setBulkError(err?.message || 'Upload failed');
    } finally {
      setBulkUploading(false);
    }
  }

  function resetBulkModal() {
    setBulkModalOpen(false);
    setBulkFile(null);
    setBulkResult(null);
    setBulkError('');
  }

  function handleBulkFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setBulkFile(file);
      setBulkResult(null);
      setBulkError('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.icWhitelist')}</h2>
          <p className="text-[12px] text-text-tertiary mt-0.5">{t('admin.icWhitelistDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuper && (
            <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} />} onClick={() => { resetBulkModal(); setBulkModalOpen(true); }}>
              {t('admin.bulkUploadRoster')}
            </Button>
          )}
          {isSuper && (
            <Button variant="primary" icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={() => { setModalOpen(true); setNewIc(''); setModalFilter({ country: '', state: '', district: '', schoolId: '' }); setError(''); }}>
              {t('admin.addIcEntry')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {isSuper && (
          <div className="min-w-[280px]">
            <CascadingFilter
              values={filterValues}
              onChange={(v) => { setFilterValues(v); setPage(0); }}
              showSchool={true}
            />
          </div>
        )}
        <div className="w-40">
          <Input placeholder={t('admin.searchIcNumber')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} />
        </div>
        <span className="text-[12px] text-text-tertiary">{total} {t('admin.entries')}</span>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('auth.icNumber')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.schoolName')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.dateAdded')}</th>
                {isSuper && <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-16">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 ? (
                <tr><td colSpan={isSuper ? 4 : 3} className="text-center py-12 text-text-tertiary"><Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" strokeWidth={1.5} />{t('common.loading')}</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={isSuper ? 4 : 3} className="text-center py-12 text-text-tertiary">{t('common.noData')}</td></tr>
              ) : (
                entries.map((entry: any) => (
                  <tr key={entry.id} className="border-b border-border hover:bg-surface-raised/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-[13px] text-text-primary">{entry.icNumber}</td>
                    <td className="px-4 py-3 text-text-secondary text-[13px]">{entry.schoolName || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary text-[13px]">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '-'}</td>
                    {isSuper && (
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setDeleteId(entry.id)} className="p-1.5 rounded-md text-text-tertiary hover:text-error hover:bg-error/5 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {hasMore && !loading && (
          <div className="flex justify-center py-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={loadMore}>
              {t('common.more')}
            </Button>
          </div>
        )}
        {loading && entries.length > 0 && (
          <div className="flex justify-center py-3 border-t border-border">
            <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" strokeWidth={1.5} />
          </div>
        )}
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('admin.addIcEntry')} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={handleAdd} loading={saving}>{t('common.create')}</Button></>}>
        <div className="space-y-4">
          {error && <div className="px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">{error}</div>}
          <Input label={t('auth.icNumber')} value={newIc} onChange={(e) => setNewIc(e.target.value)} placeholder="010101-01-1234" />
          {isSuper && <CascadingFilter values={modalFilter} onChange={setModalFilter} showSchool={true} />}
        </div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={t('common.confirmDelete')} footer={<><Button variant="ghost" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={handleDelete} loading={deleting}>{t('common.delete')}</Button></>}>
        <p className="text-[14px] text-text-secondary">{t('admin.confirmDeleteWhitelist')}</p>
      </Modal>

      <Modal
        isOpen={bulkModalOpen}
        onClose={resetBulkModal}
        title={t('admin.uploadWhitelist')}
        size="lg"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={resetBulkModal}>{t('common.cancel')}</Button>
            {!bulkResult && (
              <Button onClick={handleBulkUpload} loading={bulkUploading} disabled={!bulkFile}>
                {bulkUploading ? t('admin.uploading') : t('admin.uploadWhitelist')}
              </Button>
            )}
            {bulkResult && (
              <Button variant="primary" onClick={resetBulkModal}>{t('common.close')}</Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* Format hint */}
          <div className="p-3 bg-primary/5 border border-primary/15 rounded-lg">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-[12px] font-medium text-text-primary mb-1">{t('admin.excelFormat')}</p>
                <p className="text-[11px] text-text-tertiary">School_code | School_name | Student_name | IC_number | Birthday | Guardian_name | Guardian_phone</p>
              </div>
            </div>
          </div>

          {/* File drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              bulkFile ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-surface-raised'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleBulkFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {bulkFile ? (
              <div className="flex items-center justify-center gap-2 text-[13px] text-text-primary">
                <FileSpreadsheet className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <span className="font-medium">{bulkFile.name}</span>
                <span className="text-text-tertiary">({(bulkFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div>
                <Upload className="h-6 w-6 mx-auto mb-1.5 text-text-tertiary" strokeWidth={1.5} />
                <p className="text-[13px] text-text-secondary">{t('admin.dragOrClick')}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">.xlsx / .xls</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setBulkFile(file); setBulkResult(null); setBulkError(''); }
              }}
            />
          </div>

          {/* Error */}
          {bulkError && (
            <div className="px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">{bulkError}</div>
          )}

          {/* Success result */}
          {bulkResult && (
            <div className="p-4 bg-success/5 border border-success/15 rounded-lg">
              <p className="text-[13px] font-medium text-success">{t('admin.uploadSuccess', { inserted: bulkResult.inserted, skipped: bulkResult.skipped })}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
