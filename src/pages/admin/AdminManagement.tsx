import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, RefreshCw, Ban } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { adminApi } from '@/utils/api';


function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function AdminManagement() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'super_admin';
  const [admins, setAdmins] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', schoolId: '', role: 'admin' as 'admin' | 'super_admin' });
  const hasSuperAdmin = admins.some((a) => a.role === 'super_admin');

  const fetchAdmins = useCallback(() => {
    setLoading(true);
    adminApi.getAdmins().then((res) => {
      if (res.data) setAdmins(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAdmins();
    adminApi.getSchools({ pageSize: 500 }).then((res) => {
      if (res.data?.data) setSchools(res.data.data);
    }).catch(() => {});
  }, [fetchAdmins]);

  const schoolOptions = [
    { value: '', label: t('admin.selectSchool') },
    ...schools.map((s: any) => ({ value: s.id, label: s.name })),
  ];

  function openAdd() {
    setEditId(null);
    setForm({ name: '', email: '', password: '', schoolId: '', role: 'admin' });
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const a = admins.find((x) => x.id === id);
    if (a) {
      setEditId(id);
      setForm({ name: a.username || a.user?.username || '', email: a.email || a.user?.email || '', password: '', schoolId: a.schoolId || '', role: a.role || 'admin' });
      setModalOpen(true);
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) { alert('请填写用户名和邮箱'); return; }
    if (editId) {
      await adminApi.updateAdmin(editId, { schoolId: form.schoolId || undefined }).catch((e) => alert('更新失败: ' + (e?.message || '未知错误')));
    } else {
      if (!form.password) { alert('请填写密码'); return; }
      if (!form.schoolId) { alert('请选择学校'); return; }
      try {
        const res = await adminApi.createAdmin({ username: form.name, email: form.email, password: form.password, schoolId: form.schoolId, role: form.role });
        console.log('createAdmin response:', res);
      } catch (e: any) {
        alert('创建失败: ' + (e?.message || e?.response?.data?.error || '未知错误'));
        return;
      }
    }
    setModalOpen(false);
    fetchAdmins();
  }

  async function handleDelete(id: string) {
    await adminApi.deleteAdmin(id).catch(() => {});
    fetchAdmins();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.adminManagement')}</h2>
        {isSuper && <Button icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={openAdd}>{t('admin.addAdmin')}</Button>}
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 rounded-full animate-spin border-accent/20 border-t-accent" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-16 text-text-tertiary">{t('common.noData')}</div>
          ) : (
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
                  <td className="px-4 py-3 font-medium text-text-primary">{admin.username || admin.user?.username}</td>
                  <td className="px-4 py-3 text-text-secondary">{admin.email || admin.user?.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{admin.school?.name || '-'}</td>
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
          )}
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
          <Select label={t('auth.school')} options={schoolOptions} value={form.schoolId} onChange={(v) => setForm({ ...form, schoolId: v })} />
          {!editId && (
            <Select
              label={t('admin.role')}
              options={[
                { value: 'admin', label: t('admin.schoolAdmin') },
                { value: 'super_admin', label: t('admin.superAdmin'), disabled: hasSuperAdmin },
              ]}
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v as 'admin' | 'super_admin' })}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
