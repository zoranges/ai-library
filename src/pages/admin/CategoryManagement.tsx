import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, ArrowLeft, MoveHorizontal, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  bookCount: number;
  parentId: string | null;
  sortOrder: number;
}

const EMOJI_OPTIONS = ['📚', '📖', '📕', '📗', '📘', '📙', '🌟', '⭐', '🔥', '💡', '🎯', '🏆', '🎨', '🎵', '🔬', '🗺️', '🏛️', '🌿', '🧠', '💻', '⚽', '🎭', '🍎', '🌍', '✏️', '📝', '🎪', '🏰', '🦋', '🌈'];
const COLOR_OPTIONS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#e11d48', '#22c55e', '#a855f7', '#64748b'];

export default function CategoryManagement() {
  const { t } = useTranslation();

  const api = useCallback(async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  }, []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: '📚', color: '#6366f1' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryBooks, setCategoryBooks] = useState<any[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [moveTargetCategory, setMoveTargetCategory] = useState('');
  const [moving, setMoving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/admin/books/categories');
      setCategories(res.data || []);
    } catch {
      alert(t('admin.fetchCategoriesFailed', 'Failed to load categories'));
    } finally {
      setLoading(false);
    }
  }, [api, t]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', icon: '📚', color: '#6366f1' });
    setModalOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({ name: cat.name, icon: cat.icon, color: cat.color });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/admin/books/categories/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        const maxOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), 0);
        await api('/api/admin/books/categories', {
          method: 'POST',
          body: JSON.stringify({ ...form, sortOrder: maxOrder + 1 }),
        });
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      alert((err as Error).message || t('admin.saveCategoryFailed', 'Failed to save category'));
    } finally {
      setSaving(false);
    }
  }

  async function handleReorder(cat: Category, direction: 'up' | 'down') {
    try {
      await api('/api/admin/books/categories/reorder', {
        method: 'PUT',
        body: JSON.stringify({ id: cat.id, direction }),
      });
      fetchCategories();
    } catch (err) {
      alert((err as Error).message || t('admin.reorderCategoryFailed', 'Failed to reorder category'));
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      const res = await api(`/api/admin/books/categories/${deleteConfirm.id}`, { method: 'DELETE' });
      if (res.success) {
        setDeleteConfirm(null);
        fetchCategories();
      } else {
        alert(res.error || 'Delete failed');
      }
    } catch (err) {
      alert((err as Error).message || t('admin.deleteCategoryFailed', 'Failed to delete category'));
    }
  }

  async function expandCategory(cat: Category) {
    setExpandedId(cat.id);
    setSelectedBookIds(new Set());
    setMoveTargetCategory('');
    setLoadingBooks(true);
    try {
      const params = new URLSearchParams({ categoryId: cat.id, pageSize: '200' });
      const res = await api(`/api/admin/books?${params}`);
      setCategoryBooks(res.data?.data || []);
    } catch {
      alert('Failed to load books');
    } finally {
      setLoadingBooks(false);
    }
  }

  function collapseCategory() {
    setExpandedId(null);
    setCategoryBooks([]);
    setSelectedBookIds(new Set());
    setMoveTargetCategory('');
  }

  async function handleBatchMove() {
    if (selectedBookIds.size === 0 || !moveTargetCategory) return;
    if (!confirm(`Move ${selectedBookIds.size} selected book(s) to the chosen category?`)) return;
    setMoving(true);
    try {
      await api('/api/admin/books/batch-move', {
        method: 'PUT',
        body: JSON.stringify({ bookIds: [...selectedBookIds], categoryId: moveTargetCategory }),
      });
      setSelectedBookIds(new Set());
      setMoveTargetCategory('');
      // Refresh the category's book list and the category list
      const cat = categories.find(c => c.id === expandedId);
      if (cat) expandCategory(cat);
      fetchCategories();
    } catch (err) {
      alert((err as Error).message || 'Failed to move books');
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary font-heading">{t('admin.bookCategories', '图书分类')}</h1>
          <p className="text-sm text-text-tertiary mt-0.5">{t('admin.bookCategoriesDesc', '管理图书分类，支持自定义图标和颜色')}</p>
        </div>
        <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>{t('common.new')}</Button>
      </div>

      {/* Expanded category: show books */}
      {expandedId ? (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <button onClick={collapseCategory} className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-text-primary">{categories.find(c => c.id === expandedId)?.name}</h2>
              <p className="text-sm text-text-tertiary">{categoryBooks.length} {t('admin.books')}</p>
            </div>
          </div>

          {selectedBookIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-accent/5 border border-accent/20 rounded-xl">
              <span className="text-sm font-semibold text-accent">{selectedBookIds.size} {t('admin.selected')}</span>
              <div className="flex items-center gap-2 ml-auto">
                <Select
                  options={[{ value: '', label: t('admin.moveToCategory') || 'Move to...' }, ...categories.filter(c => c.id !== expandedId).map(c => ({ value: c.id, label: c.name }))]}
                  value={moveTargetCategory}
                  onChange={setMoveTargetCategory}
                  className="w-48 h-9"
                />
                <Button onClick={handleBatchMove} loading={moving} disabled={!moveTargetCategory} icon={<MoveHorizontal className="h-4 w-4" />}>
                  {t('admin.move') || 'Move'}
                </Button>
                <Button variant="ghost" onClick={() => { setSelectedBookIds(new Set()); setMoveTargetCategory(''); }}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          {loadingBooks ? (
            <div className="text-center py-16">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-text-tertiary" />
              <p className="text-sm text-text-tertiary mt-2">{t('common.loading')}</p>
            </div>
          ) : categoryBooks.length === 0 ? (
            <div className="text-center py-16 text-text-tertiary">
              <p>{t('admin.noBooksFound')}</p>
            </div>
          ) : (
            <div className="pro-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/50">
                    <th className="text-left px-4 py-2.5 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={categoryBooks.length > 0 && selectedBookIds.size === categoryBooks.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBookIds(new Set(categoryBooks.map(b => b.id)));
                          else setSelectedBookIds(new Set());
                        }}
                      />
                    </th>
                    <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.title')}</th>
                    <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.author')}</th>
                    <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.language')}</th>
                    <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('books.format')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryBooks.map((book: any) => (
                    <tr key={book.id} className="border-b border-border hover:bg-surface-raised/30 transition-colors">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedBookIds.has(book.id)}
                          onChange={(e) => {
                            const next = new Set(selectedBookIds);
                            if (e.target.checked) next.add(book.id);
                            else next.delete(book.id);
                            setSelectedBookIds(next);
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 font-medium text-text-primary max-w-[300px] truncate">{book.title}</td>
                      <td className="px-4 py-2 text-text-secondary">{book.author}</td>
                      <td className="px-4 py-2"><Badge variant="outline" size="sm">{(book.language || '').toUpperCase()}</Badge></td>
                      <td className="px-4 py-2"><Badge variant="outline" size="sm">{(book.fileType || 'PDF').toUpperCase()}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
        {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary">
          <p>{t('common.noData')}</p>
          <p className="text-xs mt-1">{t('admin.noCategoriesHint', '点击上方按钮创建第一个分类')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              className="pro-card p-4 rounded-xl flex items-center gap-3 group cursor-pointer hover:shadow-2 transition-shadow"
              onClick={() => expandCategory(cat)}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: (cat.color || '#6366f1') + '20', color: cat.color || '#6366f1' }}
              >
                {cat.icon || '📚'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-text-primary truncate">{cat.name}</div>
                <div className="text-[11px] text-text-tertiary">
                  {cat.bookCount || 0} {t('admin.books')}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                <button
                  className="p-1.5 rounded-lg hover:bg-accent/10 text-text-tertiary hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  onClick={(e) => { e.stopPropagation(); handleReorder(cat, 'up'); }}
                  disabled={index === 0}
                  title={t('admin.moveUp', '上移')}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-accent/10 text-text-tertiary hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  onClick={(e) => { e.stopPropagation(); handleReorder(cat, 'down'); }}
                  disabled={index === categories.length - 1}
                  title={t('admin.moveDown', '下移')}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-accent/10 text-text-tertiary hover:text-accent transition-colors"
                  onClick={(e) => { e.stopPropagation(); openEdit(cat); }}
                  title={t('common.edit')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-error/10 text-text-tertiary hover:text-error transition-colors"
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(cat); }}
                  title={t('common.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <div className="p-6">
          <h2 className="text-lg font-bold text-text-primary mb-5">
            {editing ? t('common.edit') : t('common.new')} {t('admin.bookCategories', '分类')}
          </h2>
          <div className="space-y-4">
            <Input
              label={t('admin.name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('admin.categoryNamePlaceholder', '例如: 文学、科学、历史')}
            />
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">{t('admin.categoryIcon', '图标')}</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${form.icon === emoji ? 'bg-accent/20 ring-2 ring-accent scale-110' : 'hover:bg-bg-tertiary'}`}
                    onClick={() => setForm({ ...form, icon: emoji })}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">{t('admin.categoryColor', '颜色')}</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-bg-primary scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-text-tertiary">
              {editing
                ? t('admin.sortOrderHint', '排序通过列表中的上下箭头按钮调整')
                : t('admin.newCategoryHint', '新分类将排在最后，可通过上下箭头调整')}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} size="sm">
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-error/10 rounded-xl mb-4">
            <Trash2 className="w-6 h-6 text-error" />
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">{t('common.delete')} {t('admin.bookCategories', '分类')}</h3>
          <p className="text-sm text-text-tertiary mb-6">
            {t('admin.deleteCategoryConfirm', { name: deleteConfirm?.name || '' })}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDelete}>{t('common.delete')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
