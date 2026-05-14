import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Ban, ChevronDown, ChevronUp, Download } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { adminApi } from '@/utils/api';

const stateOptions = [
  { value: '', label: 'All States' },
  { value: 'Selangor', label: 'Selangor' },
  { value: 'Kuala Lumpur', label: 'Kuala Lumpur' },
  { value: 'Penang', label: 'Penang' },
  { value: 'Johor', label: 'Johor' },
];

const cityOptions: Record<string, { value: string; label: string }[]> = {
  '': [{ value: '', label: 'All Cities' }],
  Selangor: [{ value: '', label: 'All Cities' }, { value: 'Petaling Jaya', label: 'Petaling Jaya' }, { value: 'Shah Alam', label: 'Shah Alam' }],
  'Kuala Lumpur': [{ value: '', label: 'All Cities' }, { value: 'KL Central', label: 'KL Central' }, { value: 'Bangsar', label: 'Bangsar' }],
  Penang: [{ value: '', label: 'All Cities' }, { value: 'Georgetown', label: 'Georgetown' }],
  Johor: [{ value: '', label: 'All Cities' }, { value: 'Johor Bahru', label: 'Johor Bahru' }],
};

const mockSchools = [
  { id: '1', name: 'SMK Tunku Abdul Rahman', state: 'Selangor', city: 'Petaling Jaya', address: 'Jalan SS2/72', studentCount: 450, admin: 'Ahmad bin Ali', isActive: true },
  { id: '2', name: 'SK Bukit Damansara', state: 'Kuala Lumpur', city: 'Bangsar', address: 'Jalan Bukit Damansara', studentCount: 320, admin: 'Siti binti Hassan', isActive: true },
  { id: '3', name: 'SMK Sri Hartamas', state: 'Kuala Lumpur', city: 'KL Central', address: 'Jalan Sri Hartamas', studentCount: 280, admin: 'Rajesh Kumar', isActive: false },
  { id: '4', name: 'SK Bangsar', state: 'Kuala Lumpur', city: 'Bangsar', address: 'Jalan Bangsar', studentCount: 510, admin: 'Lim Wei Ming', isActive: true },
  { id: '5', name: 'SMK Pantai', state: 'Selangor', city: 'Shah Alam', address: 'Seksyen 7', studentCount: 190, admin: 'Nurul Aisyah', isActive: true },
];

const mockStudents = [
  { name: 'Ahmad Razif', booksRead: 12, totalTime: '24h 30m' },
  { name: 'Siti Aminah', booksRead: 8, totalTime: '18h 15m' },
  { name: 'Rajesh Nair', booksRead: 15, totalTime: '32h 45m' },
];

export default function SchoolManagement() {
  const [schools, setSchools] = useState(mockSchools);
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', state: '', city: '', address: '' });

  useEffect(() => {
    adminApi.getSchools().then((res) => {
      if (res.data?.data) setSchools(res.data.data);
    }).catch(() => {});
  }, []);

  const filtered = schools.filter((s) => {
    if (state && s.state !== state) return false;
    if (city && s.city !== city) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function openAdd() {
    setEditId(null);
    setForm({ name: '', state: '', city: '', address: '' });
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const s = schools.find((x) => x.id === id);
    if (s) {
      setEditId(id);
      setForm({ name: s.name, state: s.state, city: s.city, address: s.address });
      setModalOpen(true);
    }
  }

  async function handleSave() {
    if (editId) {
      await adminApi.updateSchool(editId, form).catch(() => {});
      setSchools((prev) => prev.map((s) => s.id === editId ? { ...s, ...form } : s));
    } else {
      const res = await adminApi.createSchool(form).catch(() => null);
      if (res?.data) setSchools((prev) => [...prev, res.data]);
      else setSchools((prev) => [...prev, { id: String(Date.now()), ...form, studentCount: 0, admin: '-', isActive: true }]);
    }
    setModalOpen(false);
  }

  function toggleStatus(id: string) {
    setSchools((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !s.isActive } : s));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">School Management</h2>
        <Button variant="secondary" icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={openAdd}>Add School</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-36">
          <Select options={stateOptions} value={state} onChange={(v) => { setState(v); setCity(''); }} />
        </div>
        <div className="w-36">
          <Select options={cityOptions[state] || cityOptions['']} value={city} onChange={setCity} />
        </div>
        <div className="w-60">
          <Input placeholder="Search schools..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" strokeWidth={1.5} />} />
        </div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">School Name</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">State / City</th>
                <th className="text-right px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Students</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium">Status</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((school) => (
                <SchoolRow
                  key={school.id}
                  school={school}
                  expanded={expandedId === school.id}
                  onToggle={() => setExpandedId(expandedId === school.id ? null : school.id)}
                  onEdit={() => openEdit(school.id)}
                  onToggleStatus={() => toggleStatus(school.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit School' : 'Add School'} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave}>{editId ? 'Save' : 'Create'}</Button></>}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="State" options={stateOptions.filter((o) => o.value)} value={form.state} onChange={(v) => setForm({ ...form, state: v, city: '' })} />
            <Select label="City" options={(cityOptions[form.state] || cityOptions['']).filter((o) => o.value || !form.state)} value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

function SchoolRow({ school, expanded, onToggle, onEdit, onToggleStatus }: { school: typeof mockSchools[number]; expanded: boolean; onToggle: () => void; onEdit: () => void; onToggleStatus: () => void }) {
  return (
    <>
      <tr className="border-b border-border hover:bg-surface-raised/30 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} /> : <ChevronDown className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />}
            <span className="font-medium text-text-primary">{school.name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-text-secondary">{school.state} / {school.city}</td>
        <td className="px-4 py-3 text-right text-text-secondary font-mono text-[13px]">{school.studentCount}</td>
        <td className="px-4 py-3 text-center">
          <Badge variant={school.isActive ? 'success' : 'error'} dot size="sm">{school.isActive ? 'Active' : 'Inactive'}</Badge>
        </td>
        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-0.5">
            <button onClick={onEdit} className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors"><Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
            <button onClick={onToggleStatus} className="p-1.5 rounded-md text-text-tertiary hover:text-warning hover:bg-warning/5 transition-colors"><Ban className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-surface-raised/20 px-8 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[13px] font-medium text-text-primary">Student Reading Reports</h4>
              <Button size="sm" variant="ghost" icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} />}>Export</Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-[12px] text-text-tertiary font-medium">Name</th>
                  <th className="text-right py-2 text-[12px] text-text-tertiary font-medium">Books Read</th>
                  <th className="text-right py-2 text-[12px] text-text-tertiary font-medium">Total Time</th>
                </tr>
              </thead>
              <tbody>
                {mockStudents.map((s, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 text-text-primary">{s.name}</td>
                    <td className="py-2 text-right text-text-secondary font-mono text-[13px]">{s.booksRead}</td>
                    <td className="py-2 text-right text-text-secondary">{s.totalTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
