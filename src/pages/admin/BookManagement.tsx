import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, X, Upload, Loader2, FileText, MoveHorizontal } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { useAuthStore } from '@/stores/authStore';

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  description: string;
  categoryId: string;
  categoryName?: string;
  language: string;
  fileType: string;
  coverUrl: string;
  fileUrl: string;
  difficulty: string;
  pageCount: number;
  rating: number;
  readCount: number;
  favoriteCount: number;
  isActive: number;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

export default function BookManagement() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [language, setLanguage] = useState('');
  const [format, setFormat] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveTargetCategory, setMoveTargetCategory] = useState('');
  const [moving, setMoving] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '', author: '', isbn: '', publisher: '', description: '',
    categoryId: '', language: 'zh', fileType: 'pdf', coverUrl: '', fileUrl: '',
    difficulty: 'intermediate', pageCount: 0, copyright: '', publishDate: '',
  });

  const formatOptions = [
    { value: '', label: t('books.allFormats') },
    { value: 'pdf', label: 'PDF' },
    { value: 'epub', label: 'EPUB' },
    { value: 'mobi', label: 'MOBI' },
    { value: 'video', label: 'Video' },
  ];

  const languageOptions = [
    { value: '', label: t('admin.allLanguages') },
    { value: 'ms', label: 'Malay' },
    { value: 'en', label: 'English' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ta', label: 'Tamil' },
  ];

  const difficultyOptions = [
    { value: 'beginner', label: t('books.beginner') },
    { value: 'intermediate', label: t('books.intermediate') },
    { value: 'advanced', label: t('books.advanced') },
  ];

  const api = useCallback(async (url: string, options?: RequestInit & { isFormData?: boolean }) => {
    const { isFormData, ...fetchOptions } = options || {};
    const res = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
        ...fetchOptions?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }, [token]);

  const fetchBooks = useCallback(async (overrides?: { page?: number; search?: string; categoryId?: string; language?: string; format?: string }) => {
    setLoading(true);
    try {
      const p = overrides?.page ?? page;
      const s = overrides?.search ?? search;
      const c = overrides?.categoryId ?? categoryId;
      const l = overrides?.language ?? language;
      const f = overrides?.format ?? format;
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('pageSize', '20');
      if (s) params.set('search', s);
      if (c) params.set('categoryId', c);
      if (l) params.set('language', l);
      if (f) params.set('format', f);

      const result = await api(`/api/admin/books?${params}`);
      setBooks(result.data.data);
      setTotal(result.data.total);
    } catch (err) {
      console.error('Failed to fetch books', err);
    } finally {
      setLoading(false);
    }
  }, [api, page, search, categoryId, language, format]);

  const fetchCategories = useCallback(async () => {
    try {
      const result = await api('/api/admin/books/categories');
      setCategories(result.data);
    } catch { /* ignore */ }
  }, [api]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function openAdd() {
    setEditId(null);
    setForm({ title: '', author: '', isbn: '', publisher: '', description: '', categoryId: categories[0]?.id || '', language: 'zh', fileType: 'pdf', coverUrl: '', fileUrl: '', difficulty: 'intermediate', pageCount: 0, copyright: '', publishDate: '' });
    setBookFile(null);
    setCoverFile(null);
    setUploadProgress(0);
    setPanelOpen(true);
  }

  function openEdit(book: Book) {
    setEditId(book.id);
    setForm({
      title: book.title, author: book.author, isbn: book.isbn || '', publisher: book.publisher || '',
      description: book.description || '', categoryId: book.categoryId, language: book.language,
      fileType: book.fileType || 'pdf', coverUrl: book.coverUrl || '', fileUrl: book.fileUrl || '',
      difficulty: book.difficulty || 'intermediate', pageCount: book.pageCount || 0,
      copyright: (book as any).copyright || '', publishDate: (book as any).publishDate || '',
    });
    setPanelOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.author.trim() || !form.categoryId) return;
    if (!editId && !bookFile) return;
    setSaving(true);
    setUploadProgress(0);
    try {
      if (editId) {
        await api(`/api/admin/books/${editId}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        const fd = new FormData();
        fd.append('file', bookFile!);
        if (coverFile) fd.append('cover', coverFile);
        fd.append('title', form.title);
        fd.append('author', form.author);
        fd.append('isbn', form.isbn);
        fd.append('publisher', form.publisher);
        fd.append('description', form.description);
        fd.append('categoryId', form.categoryId);
        fd.append('language', form.language);
        fd.append('difficulty', form.difficulty);
        fd.append('pageCount', String(form.pageCount));
        fd.append('copyright', form.copyright);
        fd.append('publishDate', form.publishDate);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(JSON.parse(xhr.responseText)?.error || `Upload failed: ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.open('POST', '/api/admin/books/upload');
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(fd);
        });
      }
      setPanelOpen(false);
      if (editId) {
        // Edit: stay on current page with current filters
        fetchBooks();
      } else {
        // New book: reset to page 1 so the new entry is visible
        setSearch('');
        setCategoryId('');
        setLanguage('');
        setFormat('');
        setPage(1);
        fetchBooks({ page: 1, search: '', categoryId: '', language: '', format: '' });
      }
    } catch (err) {
      console.error('Failed to save book', err);
      alert(err instanceof Error ? err.message : 'Failed to save book');
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('admin.deleteThisBook'))) return;
    try {
      await api(`/api/admin/books/${id}`, { method: 'DELETE' });
      fetchBooks();
    } catch (err) {
      console.error('Failed to delete book', err);
    }
  }

  async function handleBatchMove() {
    if (selectedIds.size === 0 || !moveTargetCategory) return;
    if (!confirm(`Move ${selectedIds.size} selected book(s) to the chosen category?`)) return;
    setMoving(true);
    try {
      await api('/api/admin/books/batch-move', {
        method: 'PUT',
        body: JSON.stringify({ bookIds: [...selectedIds], categoryId: moveTargetCategory }),
      });
      setSelectedIds(new Set());
      setMoveTargetCategory('');
      fetchBooks();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to move books');
    } finally {
      setMoving(false);
    }
  }

  const [coverUploading, setCoverUploading] = useState(false);

  function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Add mode: bundle with book upload later
    if (!editId) {
      setCoverFile(file);
      return;
    }

    // Edit mode: upload immediately
    setCoverFile(file);
    setCoverUploading(true);
    const fd = new FormData();
    fd.append('cover', file);
    api(`/api/admin/books/${editId}/cover`, { method: 'PUT', body: fd, isFormData: true })
      .then((res) => {
        setForm((f) => ({ ...f, coverUrl: res.data.coverUrl }));
        setCoverFile(null);
      })
      .catch((err) => {
        console.error('Cover upload failed:', err);
        alert('Cover upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
        setCoverFile(null);
      })
      .finally(() => setCoverUploading(false));
  }

  async function handleRemoveCover() {
    if (!editId) { setCoverFile(null); return; }
    if (!confirm('Remove the cover image?')) return;
    try {
      await api(`/api/admin/books/${editId}/cover`, { method: 'DELETE' });
      setForm((f) => ({ ...f, coverUrl: '' }));
      setCoverFile(null);
    } catch (err) {
      console.error('Failed to remove cover', err);
    }
  }

  function handleBookFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBookFile(file);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    setForm((f) => ({ ...f, fileType: ext, fileUrl: '' }));
    // Auto-fill title from filename if empty
    if (!form.title) {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      setForm((f) => ({ ...f, title: nameWithoutExt }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.bookManagement')}</h2>
          <p className="text-[12px] text-text-tertiary mt-0.5">{total} {t('admin.booksTotal')}</p>
        </div>
        <Button variant="secondary" icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={openAdd}>{t('admin.addBook')}</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-56"><Input placeholder={t('admin.searchBooks')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} /></div>
        <div className="w-40">
          <Select options={[{ value: '', label: t('admin.allCategories') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} value={categoryId} onChange={(v) => { setCategoryId(v); setPage(1); }} />
        </div>
        <div className="w-36"><Select options={languageOptions} value={language} onChange={(v) => { setLanguage(v); setPage(1); }} /></div>
        <div className="w-32"><Select options={formatOptions} value={format} onChange={(v) => { setFormat(v); setPage(1); }} /></div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-accent/5 border border-accent/20 rounded-xl">
          <span className="text-sm font-semibold text-accent">{selectedIds.size} {t('admin.selected')}</span>
          <div className="flex items-center gap-2 ml-auto">
            <Select
              options={[{ value: '', label: t('admin.moveToCategory') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              value={moveTargetCategory}
              onChange={setMoveTargetCategory}
              className="w-48 h-9"
            />
            <Button
              onClick={handleBatchMove}
              loading={moving}
              disabled={!moveTargetCategory}
              icon={<MoveHorizontal className="h-4 w-4" />}
            >
              {t('admin.move')}
            </Button>
            <Button variant="ghost" onClick={() => { setSelectedIds(new Set()); setMoveTargetCategory(''); }}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-8">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={books.length > 0 && selectedIds.size === books.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(books.map(b => b.id)));
                      else setSelectedIds(new Set());
                    }}
                  />
                </th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-16">{t('admin.cover')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.title')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.author')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.category')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.language')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.format')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.difficulty')}</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-20">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-text-tertiary">
                    <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" strokeWidth={1.5} />
                    {t('common.loading')}
                  </td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-text-tertiary">{t('admin.noBooksFound')}</td>
                </tr>
              ) : (
                books.map((book) => (
                  <tr key={book.id} className="border-b border-border hover:bg-surface-raised/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={selectedIds.has(book.id)}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(book.id);
                          else next.delete(book.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {book.coverUrl ? (
                        <img src={book.coverUrl} alt={book.title} className="h-[56px] w-[40px] rounded object-cover" />
                      ) : (
                        <div className="h-[56px] w-[40px] bg-surface-raised rounded-md flex items-center justify-center text-text-tertiary text-[10px] shrink-0">N/A</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-text-primary max-w-[200px] truncate">{book.title}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{book.author}</td>
                    <td className="px-4 py-2.5"><Badge variant="default" size="sm">{book.categoryName || book.categoryId}</Badge></td>
                    <td className="px-4 py-2.5"><Badge variant="outline" size="sm">{book.language?.toUpperCase()}</Badge></td>
                    <td className="px-4 py-2.5"><Badge variant="outline" size="sm">{book.fileType?.toUpperCase() || 'PDF'}</Badge></td>
                    <td className="px-4 py-2.5"><Badge variant="outline" size="sm">{book.difficulty}</Badge></td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => openEdit(book)} className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors"><Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                        <button onClick={() => handleDelete(book.id)} className="p-1.5 rounded-md text-text-tertiary hover:text-error hover:bg-error/5 transition-colors"><Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-[12px] text-text-tertiary">{t('common.page')} {page} {t('reader.pageOf')} {Math.ceil(total / 20)}</span>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('admin.previous')}</Button>
              <Button variant="ghost" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)}>{t('admin.next')}</Button>
            </div>
          </div>
        )}
      </Card>

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setPanelOpen(false)} />
          <div className="relative w-full max-w-[520px] bg-surface shadow-3 overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-surface border-b border-border px-5 py-3 flex items-center justify-between z-10">
              <h3 className="text-sm font-semibold text-text-primary">{editId ? t('admin.editBook') : t('admin.addBook')}</h3>
              <button onClick={() => setPanelOpen(false)} className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"><X className="h-4 w-4" strokeWidth={1.5} /></button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <h4 className="text-[13px] font-medium text-text-primary mb-3">{t('admin.basicInfo')}</h4>
                <div className="space-y-3">
                  <Input label={t('books.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <Input label={t('books.author')} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t('admin.isbn')} value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
                    <Input label={t('books.publisher')} value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t('books.publishDate')} value={form.publishDate} onChange={(e) => setForm({ ...form, publishDate: e.target.value })} placeholder="YYYY-MM-DD" />
                    <Input label={t('admin.copyright')} value={form.copyright} onChange={(e) => setForm({ ...form, copyright: e.target.value })} placeholder={t('admin.copyrightPlaceholder')} />
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-text-primary mb-1.5 block">{t('books.description')}</label>
                    <textarea
                      className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent min-h-[72px] resize-y transition-[border-color,box-shadow] duration-micro ease-out-quart"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[13px] font-medium text-text-primary mb-3">{t('admin.classification')}</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label={t('books.category')} options={categories.map((c) => ({ value: c.id, label: c.name }))} value={form.categoryId} onChange={(v) => setForm({ ...form, categoryId: v })} />
                    <Select label={t('books.language')} options={languageOptions.filter((o) => o.value)} value={form.language} onChange={(v) => setForm({ ...form, language: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select label={t('books.format')} options={formatOptions.filter((o) => o.value)} value={form.fileType} onChange={(v) => setForm({ ...form, fileType: v })} />
                    <Select label={t('books.difficulty')} options={difficultyOptions} value={form.difficulty} onChange={(v) => setForm({ ...form, difficulty: v })} />
                  </div>
                  <Input label={t('admin.pageCount')} type="number" value={String(form.pageCount)} onChange={(e) => setForm({ ...form, pageCount: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div>
                <h4 className="text-[13px] font-medium text-text-primary mb-3">{t('admin.media')}</h4>
                <div className="space-y-3">
                  {/* Book file upload (add mode) or read-only display (edit mode) */}
                  {editId ? (
                    <div>
                      <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">{t('admin.bookFileUrl')}</label>
                      <Input placeholder="https://... or /uploads/..." value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">{t('admin.bookFile')}</label>
                      <label className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer block ${bookFile ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/40'}`}>
                        {bookFile ? (
                          <div className="space-y-1">
                            <FileText className="h-6 w-6 mx-auto text-accent" strokeWidth={1.5} />
                            <p className="text-[13px] text-text-primary font-medium">{bookFile.name}</p>
                            <p className="text-[11px] text-text-tertiary">{t('admin.clickToChange')}</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Upload className="h-6 w-6 mx-auto text-text-tertiary" strokeWidth={1.5} />
                            <p className="text-[13px] text-text-primary">{t('admin.dropBookFile')}</p>
                            <p className="text-[11px] text-text-tertiary">EPUB, PDF, MOBI, TXT (max 200MB)</p>
                          </div>
                        )}
                        <input ref={fileInputRef} type="file" accept=".epub,.pdf,.mobi,.txt" className="hidden" onChange={handleBookFileSelect} />
                      </label>
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="mt-2 bg-surface-raised rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cover */}
                  <div>
                    <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">{t('admin.coverImage')}</label>
                    {/* Current cover preview */}
                    {(form.coverUrl && !coverFile) && (
                      <div className="mb-2 flex items-center gap-2">
                        <img src={form.coverUrl} alt="cover" className="h-20 w-14 rounded object-cover border border-border" />
                        {editId && <Button variant="ghost" size="sm" onClick={handleRemoveCover} className="text-[11px] text-danger">{t('admin.removeCover') || 'Remove'}</Button>}
                      </div>
                    )}
                    {/* New cover file selected */}
                    {coverFile && (
                      <div className="mb-2 flex items-center gap-2">
                        <img src={URL.createObjectURL(coverFile)} alt="new cover" className="h-20 w-14 rounded object-cover border border-accent" />
                        <div>
                          <p className="text-[12px] text-accent">{coverFile.name}</p>
                          {coverUploading ? (
                            <span className="text-[11px] text-text-tertiary flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading...</span>
                          ) : (
                            <button onClick={() => setCoverFile(null)} className="text-[11px] text-text-tertiary hover:text-danger">Cancel</button>
                          )}
                        </div>
                      </div>
                    )}
                    <Input placeholder={editId ? 'https://...' : t('admin.coverOptional')} value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} />
                    <label className={`mt-2 border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer block ${coverFile ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/40'}`}>
                      <Upload className="h-4 w-4 mx-auto text-text-tertiary mb-0.5" strokeWidth={1.5} />
                      <p className="text-[11px] text-text-tertiary">{t('admin.uploadCoverHint')}</p>
                      <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button variant="ghost" onClick={() => setPanelOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={handleSave} loading={saving}>{editId ? t('common.save') : t('common.create')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
