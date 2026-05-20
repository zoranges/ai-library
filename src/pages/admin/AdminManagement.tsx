import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, RefreshCw, Ban } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';

const mockAdmins = [
  { id: '1', name: 'Ahmad bin Ali', email: 'ahmad@library.my', school: 'SMK Tunku Abdul Rahman', role: 'admin', isActive: true },
  { id: '2', name: 'Siti binti Hassan', email: 'siti@library.my', school: 'SK Bukit Damansara', role: 'admin', isActive: true },
  { id: '3', name: 'System Admin', email: 'sysadmin@library.my', school: '-', role: 'super_admin', isActive: true },
  { id: '4', name: 'Rajesh Kumar', email: 'rajesh@library.my', school: 'SMK Sri Hartamas', role: 'admin', isActive: false },
  { id: '5', name: 'Lim Wei Ming', email: 'lim@library.my', school: 'SK Bangsar', role: 'admin', isActive: true },
];

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function AdminManagement() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [admins, setAdmins] = useState(mockAdmins);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin', schoolId: '' });

  useEffect(() => {
    adminApi.getAdmins().then((res) => {
      if (res.data) setAdmins(res.data);
    }).catch(() => {});
  }, []);

  const schoolOptions = [
    { value: '', label: t('admin.selectSchool') },
    { value: '1', label: 'SMK Tunku Abdul Rahman' },
    { value: '2', label: 'SK Bukit Damansara' },
    { value: '3', label: 'SMK Sri Hartamas' },
    { value: '4', label: 'SK Bangsar' },
    { value: '5', label: 'SMK Pantai' },
  ];

  const roles = [
    { value: 'admin', label: t('admin.schoolAdmin') },
    { value: 'super_admin', label: t('admin.superAdmin') },
  ];

  function openAdd() {
    setEditId(null);
    setForm({ name: '', email: '', password: '', role: 'admin', schoolId: '' });
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const a = admins.find((x) => x.id === id);
    if (a) {
      setEditId(id);
      setForm({ name: a.name, email: a.email, password: '', role: a.role, schoolId: '' });
      setModalOpen(true);
    }
  }

  async function handleSave() {
    if (editId) {
      await adminApi.updateAdmin(editId, form).catch(() => {});
      setAdmins((prev) => prev.map((a) => a.id === editId ? { ...a, name: form.name, email: form.email, role: form.role as 'admin' | 'super_admin' } : a));
    } else {
      const res = await adminApi.createAdmin(form).catch(() => null);
      if (res?.data) setAdmins((prev) => [...prev, res.data]);
      else setAdmins((prev) => [...prev, { id: String(Date.now()), name: form.name, email: form.email, school: form.schoolId ? schoolOptions.find((o) => o.value === form.schoolId)?.label || '-' : '-', role: form.role as 'admin' | 'super_admin', isActive: true }]);
    }
    setModalOpen(false);
  }

  async function handleDelete(id: string) {
    await adminApi.deleteAdmin(id).catch(() => {});
    setAdmins((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.adminManagement')}</h2>
        {isSuper && <Button icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={openAdd}>{t('admin.addAdmin')}</Button>}
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.name')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.email')}</th>
                <th className="text-left px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('auth.school')}</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('admin.role')}</th>
                <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium">{t('common.status')}</th>
                {isSuper && <th className="text-center px-4 py-2.5 text-[12px] text-text-tertiary font-medium w-20">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-border hover:bg-surface-raised/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{admin.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{admin.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{admin.school}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={admin.role === 'super_admin' ? 'accent' : 'default'} size="sm">
                      {admin.role === 'super_admin' ? t('admin.superAdmin') : t('admin.schoolAdmin')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={admin.isActive ? 'success' : 'error'} dot size="sm">
                      {admin.isActive ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </td>
                  {isSuper && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => openEdit(admin.id)} className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors"><Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                        <button onClick={async () => { await adminApi.updateAdmin(admin.id, { isActive: !admin.isActive }).catch(() => {}); setAdmins((prev) => prev.map((a) => a.id === admin.id ? { ...a, isActive: !a.isActive } : a)); }} className="p-1.5 rounded-md text-text-tertiary hover:text-warning hover:bg-warning/5 transition-colors"><Ban className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                        <button onClick={() => handleDelete(admin.id)} className="p-1.5 rounded-md text-text-tertiary hover:text-error hover:bg-error/5 transition-colors"><Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? t('admin.editAdmin') : t('admin.addAdmin')} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={handleSave}>{editId ? t('common.save') : t('common.create')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('admin.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t('admin.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {!editId && (
            <div>
              <label className="text-[13px] font-medium text-text mb-1.5 block">{t('admin.password')}</label>
              <div className="flex gap-2">
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('admin.enterOrGenerate')} fullWidth />
                <Button variant="outline" size="md" onClick={() => setForm({ ...form, password: generatePassword() })} className="!shrink-0">
                  <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          )}
          <div>
            <label className="text-[13px] font-medium text-text mb-1.5 block">{t('admin.role')}</label>
            <div className="flex bg-surface-raised rounded-md p-0.5 gap-0.5">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={cn(
                    'flex-1 py-1.5 text-[13px] font-medium rounded-[4px] transition-all duration-micro ease-out-quart',
                    form.role === r.value
                      ? 'bg-surface text-text-primary shadow-1'
                      : 'text-text-tertiary hover:text-text-secondary'
                  )}
                  onClick={() => setForm({ ...form, role: r.value })}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {form.role === 'admin' && (
            <Select label={t('auth.school')} options={schoolOptions} value={form.schoolId} onChange={(v) => setForm({ ...form, schoolId: v })} />
          )}
        </div>
      </Modal>
    </div>
  );
}
