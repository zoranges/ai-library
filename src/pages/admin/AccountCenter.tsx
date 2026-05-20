import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Trash2, Camera, Pencil, Check, X, Monitor, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';

function EditableField({ label, value, onSave, type = 'text' }: { label: string; value: string; onSave: (v: string) => void; type?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleSave() { onSave(draft); setEditing(false); }
  function handleCancel() { setDraft(value); setEditing(false); }

  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-text-tertiary mb-0.5">{label}</p>
        {editing ? <Input value={draft} onChange={(e) => setDraft(e.target.value)} type={type} /> : <p className="text-[14px] text-text-primary">{value}</p>}
      </div>
      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleSave} className="p-1.5 rounded-md text-success hover:bg-success/5 transition-colors"><Check className="h-4 w-4" strokeWidth={1.5} /></button>
          <button onClick={handleCancel} className="p-1.5 rounded-md text-text-tertiary hover:bg-surface-raised transition-colors"><X className="h-4 w-4" strokeWidth={1.5} /></button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors shrink-0"><Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
      )}
    </div>
  );
}

export default function AccountCenter() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [ipBinding, setIpBinding] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [pwError, setPwError] = useState('');
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({ name: user.username || '', email: user.email || '', phone: user.phone || '' });
    }
  }, [user]);

  useEffect(() => {
    if (tab === 'security') loadDevices();
  }, [tab]);

  async function loadDevices() {
    setDevicesLoading(true);
    try {
      const res = await adminApi.getAccountDevices();
      setDevices(res.data || []);
    } catch {} finally { setDevicesLoading(false); }
  }

  async function handleSaveField(field: string, value: string) {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    await adminApi.updateAccount(updated).catch(() => {});
  }

  async function handleAvatarUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      setAvatarLoading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        await adminApi.uploadAvatar({ avatar: reader.result as string }).catch(() => {});
        setAvatarLoading(false);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function handleChangePassword() {
    setPwError('');
    if (passwords.new !== passwords.confirm) { setPwError(t('admin.passwordsDoNotMatch')); return; }
    if (passwords.new.length < 8) { setPwError(t('admin.passwordMinLength')); return; }
    try {
      await adminApi.changePassword({ currentPassword: passwords.current, newPassword: passwords.new });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch { setPwError(t('admin.currentPasswordIncorrect')); }
  }

  async function handleIpBindingToggle() {
    const newValue = !ipBinding;
    setIpBinding(newValue);
    await adminApi.toggleIpBinding({ enabled: newValue }).catch(() => setIpBinding(!newValue));
  }

  async function handleDeleteAccount() {
    await adminApi.deleteAccount().catch(() => {});
    setDeleteModal(false);
  }

  const tabItems = [
    { key: 'profile', label: t('admin.profile') },
    { key: 'security', label: t('admin.security') },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold text-text-primary font-heading">{t('admin.account')}</h2>

      <div className="relative flex border-b border-border">
        {tabItems.map((tItem) => (
          <button key={tItem.key} className={cn('px-4 py-2 text-[13px] font-medium transition-colors duration-micro ease-out-quart', tab === tItem.key ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary')} onClick={() => setTab(tItem.key)}>
            {tItem.label}
          </button>
        ))}
        <span className="absolute bottom-0 h-0.5 bg-accent rounded-full transition-all duration-standard ease-out-quart" style={{ left: tab === 'profile' ? '0px' : '64px', width: tab === 'profile' ? '48px' : '64px' }} />
      </div>

      {tab === 'profile' && (
        <Card padding="lg">
          <div className="max-w-lg space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 bg-gradient-to-br from-accent to-brand-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {avatarLoading ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} /> : (profile.name || 'A').charAt(0).toUpperCase()}
                </div>
                <button onClick={handleAvatarUpload} className="absolute -bottom-0.5 -right-0.5 h-6 w-6 bg-accent rounded-full flex items-center justify-center text-white shadow-1 hover:bg-accent-hover hover:scale-110 transition-all duration-200">
                  <Camera className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
              <div>
                <p className="font-semibold text-text-primary">{profile.name}</p>
                <p className="text-[13px] text-text-tertiary">{user?.role === 'super_admin' ? t('admin.superAdmin') : t('admin.schoolAdmin')}</p>
              </div>
            </div>

            <div>
              <EditableField label={t('admin.name')} value={profile.name} onSave={(v) => handleSaveField('name', v)} />
              <EditableField label={t('admin.email')} value={profile.email} onSave={(v) => handleSaveField('email', v)} type="email" />
              <EditableField label={t('admin.phone')} value={profile.phone} onSave={(v) => handleSaveField('phone', v)} type="tel" />
            </div>
          </div>
        </Card>
      )}

      {tab === 'security' && (
        <div className="space-y-4 max-w-lg">
          <Card padding="lg">
            <h3 className="text-[14px] font-medium text-text-primary mb-4">{t('profile.changePassword')}</h3>
            <div className="space-y-3">
              <Input label={t('profile.currentPassword')} type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} icon={<Lock className="h-4 w-4" strokeWidth={1.5} />} />
              <Input label={t('profile.newPassword')} type="password" value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} icon={<Lock className="h-4 w-4" strokeWidth={1.5} />} />
              <Input label={t('admin.confirmNewPassword')} type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} icon={<Lock className="h-4 w-4" strokeWidth={1.5} />} />
              {pwError && <p className="text-[12px] text-error">{pwError}</p>}
              <Button onClick={handleChangePassword} size="sm">{t('admin.updatePassword')}</Button>
            </div>
          </Card>

          <Card padding="lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-medium text-text-primary">{t('admin.ipBinding')}</h3>
                <p className="text-[12px] text-text-tertiary mt-0.5">{t('admin.ipBindingDesc')}</p>
              </div>
              <button onClick={handleIpBindingToggle} className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-micro ease-out-quart', ipBinding ? 'bg-accent' : 'bg-border')}>
                <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-micro ease-out-quart shadow-1', ipBinding ? 'translate-x-4.5' : 'translate-x-1')} />
              </button>
            </div>
          </Card>

          <Card padding="lg">
            <h3 className="text-[14px] font-medium text-text-primary mb-3">{t('admin.loginDevices')}</h3>
            {devicesLoading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-accent" strokeWidth={1.5} /></div>
            ) : devices.length > 0 ? (
              <div className="space-y-2">
                {devices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2.5">
                      <Monitor className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                      <div>
                        <p className="text-[13px] text-text-primary">{device.name}</p>
                        <p className="text-[11px] text-text-tertiary">IP: {device.ip} · {device.lastActive ? new Date(device.lastActive).toLocaleString() : ''}</p>
                      </div>
                    </div>
                    {device.current ? <span className="text-[11px] text-success font-medium">{t('admin.currentDevice')}</span> : <Button size="sm" variant="ghost">{t('admin.revoke')}</Button>}
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-4 text-text-tertiary text-[13px]">{t('common.noData')}</p>}
          </Card>

          <Card padding="lg" className="!border-error/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-medium text-error">{t('admin.deleteAccount')}</h3>
                <p className="text-[12px] text-text-tertiary mt-0.5">{t('admin.deleteAccountDesc')}</p>
              </div>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />} onClick={() => setDeleteModal(true)}>{t('common.delete')}</Button>
            </div>
          </Card>

          <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title={t('admin.deleteAccount')} size="sm" footer={<><Button variant="ghost" onClick={() => setDeleteModal(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={handleDeleteAccount}>{t('admin.confirmDelete')}</Button></>}>
            <p className="text-[13px] text-text-secondary">{t('admin.deleteAccountConfirmText')}</p>
          </Modal>
        </div>
      )}
    </div>
  );
}
