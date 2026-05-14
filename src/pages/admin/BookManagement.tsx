import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Upload, Check, XCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

const categoryOptions = [
  { value: '', label: 'All Categories' },
  { value: 'science', label: 'Science' },
  { value: 'literature', label: 'Literature' },
  { value: 'history', label: 'History' },
  { value: 'art', label: 'Art' },
  { value: 'tech', label: 'Technology' },
];

const languageOptions = [
  { value: '', label: 'All Languages' },
  { value: 'ms', label: 'Malay' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ta', label: 'Tamil' },
];

const formatOptions = [
  { value: 'pdf', label: 'PDF' },
  { value: 'epub', label: 'EPUB' },
  { value: 'mobi', label: 'MOBI' },
];

const mockBooks = [
  { id: '1', title: 'The Magic Tree House', author: 'Mary Pope Osborne', category: 'Literature', language: 'English', format: 'PDF', copyright: 'compliant', coverUrl: '' },
  { id: '2', title: 'Science Explorer Vol.1', author: 'Dr. Ahmad', category: 'Science', language: 'Malay', format: 'EPUB', copyright: 'compliant', coverUrl: '' },
  { id: '3', title: 'Malaysian Folk Tales', author: 'Siti Hassan', category: 'Literature', language: 'Malay', format: 'PDF', copyright: 'pending', coverUrl: '' },
  { id: '4', title: 'Digital World', author: 'Lim Wei', category: 'Technology', language: 'English', format: 'PDF', copyright: 'expired', coverUrl: '' },
  { id: '5', title: 'Art Through Ages', author: 'Rajesh Kumar', category: 'Art', language: 'English', format: 'EPUB', copyright: 'compliant', coverUrl: '' },
];

export default function BookManagement() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', author: '', isbn: '', publisher: '', description: '',
    category: '', language: '', format: 'pdf', copyrightCompliant: true,
  });

  const filtered = mockBooks.filter((b) => {
    if (category && b.category.toLowerCase() !== category) return false;
    if (language && b.language.toLowerCase() !== language) return false;
    if (search && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function openAdd() {
    setEditId(null);
    setForm({ title: '', author: '', isbn: '', publisher: '', description: '', category: '', language: '', format: 'pdf', copyrightCompliant: true });
    setPanelOpen(true);
  }

  function openEdit(id: string) {
    const b = mockBooks.find((x) => x.id === id);
    if (b) {
      setEditId(id);
      setForm({ title: b.title, author: b.author, isbn: '', publisher: '', description: '', category: b.category.toLowerCase(), language: b.language.toLowerCase(), format: b.format.toLowerCase(), copyrightCompliant: b.copyright === 'compliant' });
      setPanelOpen(true);
    }
  }

  function handleSave() {
    setPanelOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">Book Management</h2>
        <Button variant="secondary" icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={openAdd}>Add Book</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-60"><Input placeholder="Search books..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} /></div>
        <div className="w-36"><Select options={categoryOptions} value={category} onChange={setCategory} /></div>
        <div className="w-36"><Select options={languageOptions} value={language} onChange={setLanguage} /></div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-16">Cover</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Title</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Author</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Category</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Language</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Format</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Copyright</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((book) => {
                return (
                  <tr key={book.id} className="border-b border-border hover:bg-surface-raised/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="h-[56px] w-[40px] bg-surface-raised rounded-md flex items-center justify-center text-text-tertiary text-[10px] shrink-0">N/A</div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-text-primary">{book.title}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{book.author}</td>
                    <td className="px-4 py-2.5"><Badge variant="default" size="sm">{book.category}</Badge></td>
                    <td className="px-4 py-2.5"><Badge variant="outline" size="sm">{book.language}</Badge></td>
                    <td className="px-4 py-2.5"><Badge variant="outline" size="sm">{book.format}</Badge></td>
                    <td className="px-4 py-2.5 text-center">
                      {book.copyright === 'compliant' ? (
                        <Check className="h-4 w-4 text-success mx-auto" strokeWidth={1.5} />
                      ) : (
                        <XCircle className={cn('h-4 w-4 mx-auto', book.copyright === 'expired' ? 'text-error' : 'text-warning')} strokeWidth={1.5} />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => openEdit(book.id)} className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors"><Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                        <button className="p-1.5 rounded-md text-text-tertiary hover:text-error hover:bg-error/5 transition-colors"><Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setPanelOpen(false)} />
          <div className="relative w-full max-w-[480px] bg-surface shadow-3 overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-surface border-b border-border px-5 py-3 flex items-center justify-between z-10">
              <h3 className="text-sm font-semibold text-text-primary">{editId ? 'Edit Book' : 'Add Book'}</h3>
              <button onClick={() => setPanelOpen(false)} className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"><X className="h-4 w-4" strokeWidth={1.5} /></button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <h4 className="text-[13px] font-medium text-text-primary mb-3">Basic Info</h4>
                <div className="space-y-3">
                  <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <Input label="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="ISBN" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
                    <Input label="Publisher" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-text mb-1.5 block">Description</label>
                    <textarea
                      className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent min-h-[72px] resize-y transition-[border-color,box-shadow] duration-micro ease-out-quart"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[13px] font-medium text-text-primary mb-3">Classification</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Category" options={categoryOptions.filter((o) => o.value)} value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
                    <Select label="Language" options={languageOptions.filter((o) => o.value)} value={form.language} onChange={(v) => setForm({ ...form, language: v })} />
                  </div>
                  <Select label="Format" options={formatOptions} value={form.format} onChange={(v) => setForm({ ...form, format: v })} />
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={form.copyrightCompliant} onChange={(e) => setForm({ ...form, copyrightCompliant: e.target.checked })} className="h-4 w-4 rounded border-border text-accent focus:ring-accent" />
                    <span className="text-[13px] text-text-secondary">Copyright compliance verified</span>
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-[13px] font-medium text-text-primary mb-3">File Upload</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">Cover Image</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-5 text-center hover:border-accent/40 transition-colors cursor-pointer">
                      <Upload className="h-5 w-5 mx-auto text-text-tertiary mb-1" strokeWidth={1.5} />
                      <p className="text-[12px] text-text-tertiary">Click or drag to upload</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">Book File</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-5 text-center hover:border-accent/40 transition-colors cursor-pointer">
                      <Upload className="h-5 w-5 mx-auto text-text-tertiary mb-1" strokeWidth={1.5} />
                      <p className="text-[12px] text-text-tertiary">Click or drag to upload</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button variant="ghost" onClick={() => setPanelOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>{editId ? 'Save' : 'Create'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
