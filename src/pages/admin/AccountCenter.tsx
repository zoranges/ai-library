import { useState } from 'react';
import { Lock, Trash2, Camera, Pencil, Check, X, Monitor } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';

const tabItems = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
];

const mockDevices = [
  { id: '1', name: 'Chrome on Windows', ip: '192.168.1.100', lastActive: '2024-06-01 14:30', current: true },
  { id: '2', name: 'Safari on MacBook', ip: '192.168.1.55', lastActive: '2024-05-30 09:15', current: false },
  { id: '3', name: 'Firefox on Linux', ip: '10.0.0.25', lastActive: '2024-05-28 16:45', current: false },
];

function EditableField({ label, value, onSave, type = 'text' }: { label: string; value: string; onSave: (v: string) => void; type?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-text-tertiary mb-0.5">{label}</p>
        {editing ? (
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} type={type} />
        ) : (
          <p className="text-[14px] text-text-primary">{value}</p>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleSave} className="p-1.5 rounded-md text-success hover:bg-success/5 transition-colors"><Check className="h-4 w-4" strokeWidth={1.5} /></button>
          <button onClick={handleCancel} className="p-1.5 rounded-md text-text-tertiary hover:bg-surface-raised transition-colors"><X className="h-4 w-4" strokeWidth={1.5} /></button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors shrink-0">
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

export default function AccountCenter() {
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ name: 'System Admin', email: 'admin@library.my', phone: '+60 12-345 6789' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [ipBinding, setIpBinding] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [pwError, setPwError] = useState('');

  async function handleSaveField(field: string, value: string) {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    await adminApi.updateAccount(updated).catch(() => {});
  }

  async function handleChangePassword() {
    setPwError('');
    if (passwords.new !== passwords.confirm) {
      setPwError('Passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      setPwError('Password must be at least 8 characters');
      return;
    }
    try {
      await adminApi.changePassword({ currentPassword: passwords.current, newPassword: passwords.new });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch {
      setPwError('Current password is incorrect');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary font-heading">Account Center</h2>

      <div className="relative flex border-b border-border">
        {tabItems.map((t) => (
          <button
            key={t.key}
            className={cn(
              'px-4 py-2 text-[13px] font-medium transition-colors duration-micro ease-out-quart',
              tab === t.key ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'
            )}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {tab === t.key && <span className="absolute bottom-0 h-0.5 bg-accent rounded-full" style={{ left: t.key === 'profile' ? 0 : undefined }} />}
          </button>
        ))}
        <span
          className="absolute bottom-0 h-0.5 bg-accent rounded-full transition-all duration-standard ease-out-quart"
          style={{
            left: tab === 'profile' ? '0px' : '64px',
            width: tab === 'profile' ? '48px' : '64px',
          }}
        />
      </div>

      {tab === 'profile' && (
        <Card padding="lg">
          <div className="max-w-lg space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 bg-accent/10 rounded-full flex items-center justify-center text-accent text-xl font-bold">
                  {profile.name.charAt(0)}
                </div>
                <button className="absolute -bottom-0.5 -right-0.5 h-6 w-6 bg-accent rounded-full flex items-center justify-center text-white shadow-1 hover:bg-accent-hover transition-colors">
                  <Camera className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
              <div>
                <p className="font-semibold text-text-primary">{profile.name}</p>
                <p className="text-[13px] text-text-tertiary">Super Admin</p>
              </div>
            </div>

            <div>
              <EditableField label="Name" value={profile.name} onSave={(v) => handleSaveField('name', v)} />
              <EditableField label="Email" value={profile.email} onSave={(v) => handleSaveField('email', v)} type="email" />
              <EditableField label="Phone" value={profile.phone} onSave={(v) => handleSaveField('phone', v)} type="tel" />
            </div>
          </div>
        </Card>
      )}

      {tab === 'security' && (
        <div className="space-y-4 max-w-lg">
          <Card padding="lg">
            <h3 className="text-[14px] font-medium text-text-primary mb-4">Change Password</h3>
            <div className="space-y-3">
              <Input label="Current Password" type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} icon={<Lock className="h-4 w-4" strokeWidth={1.5} />} />
              <Input label="New Password" type="password" value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} icon={<Lock className="h-4 w-4" strokeWidth={1.5} />} />
              <Input label="Confirm New Password" type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} icon={<Lock className="h-4 w-4" strokeWidth={1.5} />} />
              {pwError && <p className="text-[12px] text-error">{pwError}</p>}
              <Button onClick={handleChangePassword} size="sm">Update Password</Button>
            </div>
          </Card>

          <Card padding="lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-medium text-text-primary">IP Binding</h3>
                <p className="text-[12px] text-text-tertiary mt-0.5">Restrict login to your current IP address</p>
              </div>
              <button
                onClick={() => setIpBinding(!ipBinding)}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-micro ease-out-quart',
                  ipBinding ? 'bg-accent' : 'bg-border'
                )}
              >
                <span className={cn(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-micro ease-out-quart shadow-1',
                  ipBinding ? 'translate-x-4.5' : 'translate-x-1'
                )} />
              </button>
            </div>
          </Card>

          <Card padding="lg">
            <h3 className="text-[14px] font-medium text-text-primary mb-3">Login Devices</h3>
            <div className="space-y-2">
              {mockDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2.5">
                    <Monitor className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                    <div>
                      <p className="text-[13px] text-text-primary">{device.name}</p>
                      <p className="text-[11px] text-text-tertiary">IP: {device.ip} · {device.lastActive}</p>
                    </div>
                  </div>
                  {device.current ? (
                    <span className="text-[11px] text-success font-medium">Current</span>
                  ) : (
                    <Button size="sm" variant="ghost">Revoke</Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg" className="!border-error/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-medium text-error">Delete Account</h3>
                <p className="text-[12px] text-text-tertiary mt-0.5">Permanently delete your account and all data</p>
              </div>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />} onClick={() => setDeleteModal(true)}>Delete</Button>
            </div>
          </Card>

          <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Account" size="sm" footer={<><Button variant="ghost" onClick={() => setDeleteModal(false)}>Cancel</Button><Button variant="danger" onClick={() => setDeleteModal(false)}>Confirm Delete</Button></>}>
            <p className="text-[13px] text-text-secondary">Are you sure you want to delete your account? This action cannot be undone and all data will be permanently removed.</p>
          </Modal>
        </div>
      )}
    </div>
  );
}
