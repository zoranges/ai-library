import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import { useAuthStore } from '@/stores/authStore';
import { userApi } from '@/utils/api';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGS = [
  { value: 'en', label: 'English' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'zh', label: '中文' },
  { value: 'ta', label: 'தமிழ்' },
];

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();

  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const [form, setForm] = useState({
    username: user?.username || '',
    grade: user?.grade || '',
    preferredLanguage: user?.preferredLanguage || 'en',
    phone: user?.phone || '',
    guardianName: user?.guardianName || '',
    guardianPhone: user?.guardianPhone || '',
    address: user?.address || '',
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Reset avatar state when modal opens/closes
  useEffect(() => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setError('');
    setSuccess('');
    setActiveTab('profile');
  }, [isOpen]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  }

  function handlePwChange(field: string, value: string) {
    setPwForm((prev) => ({ ...prev, [field]: value }));
    setPwError('');
    setPwSuccess('');
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSaveProfile() {
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        setIsUploadingAvatar(true);
        const result = await userApi.uploadAvatar(avatarFile);
        avatarUrl = result.avatar;
        setIsUploadingAvatar(false);
      }

      const payload: Record<string, string> = {
        username: form.username,
        grade: form.grade,
        preferredLanguage: form.preferredLanguage,
        phone: form.phone,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        address: form.address,
      };
      if (avatarUrl) payload.avatar = avatarUrl;

      const res = await userApi.updateProfile(payload);
      setUser(res.data);
      setAvatarFile(null);
      setAvatarPreview(null);
      setSuccess(t('profile.profileUpdated') || 'Profile updated');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to update profile';
      setError(msg);
    } finally {
      setIsSaving(false);
      setIsUploadingAvatar(false);
    }
  }

  async function handleChangePassword() {
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      setPwError(t('profile.fillPasswordFields') || 'Please fill in all password fields');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError(t('admin.passwordsDoNotMatch') || 'Passwords do not match');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError(t('admin.passwordMinLength') || 'Password must be at least 6 characters');
      return;
    }
    setIsChangingPw(true);
    setPwError('');
    setPwSuccess('');
    try {
      await userApi.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess(t('profile.passwordUpdated') || 'Password updated');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPwError(err?.response?.data?.error || err?.message || 'Failed to change password');
    } finally {
      setIsChangingPw(false);
    }
  }

  const tabs = [
    { key: 'profile', label: t('profile.title') || 'Profile' },
    { key: 'security', label: t('admin.security') || 'Security' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('profile.editProfile') || 'Edit Profile'} size="lg">
      <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} variant="pill" size="sm" className="mb-5" />

      {activeTab === 'profile' ? (
        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-brand-600 flex items-center justify-center text-white text-xl font-bold overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : user?.avatar ? (
                  <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  (user?.username?.slice(0, 2).toUpperCase() || 'U')
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-colors shadow-sm"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="text-sm font-medium text-text">{t('auth.username') || 'Username'}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{t('profile.avatarHint') || 'Click the camera to change avatar'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label={t('auth.username') || 'Username'} value={form.username} onChange={(e) => handleChange('username', e.target.value)} />
            <Select
              label={t('auth.grade') || 'Grade'}
              options={[
                { value: '', label: '--' },
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: '4' },
                { value: '5', label: '5' },
                { value: '6', label: '6' },
              ]}
              value={form.grade}
              onChange={(v) => handleChange('grade', v)}
            />
            <Select
              label={t('auth.languagePreference') || 'Language'}
              options={LANGS}
              value={form.preferredLanguage}
              onChange={(v) => handleChange('preferredLanguage', v)}
            />
            <Input label={t('profile.phone') || 'Phone'} value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
          </div>

          <fieldset className="border border-border rounded-lg p-3 space-y-3">
            <legend className="text-xs font-semibold text-text-tertiary px-1">{t('profile.guardianInfo') || 'Guardian Information'}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label={t('profile.guardianName') || 'Guardian Name'} value={form.guardianName} onChange={(e) => handleChange('guardianName', e.target.value)} />
              <Input label={t('profile.guardianPhone') || 'Guardian Phone'} value={form.guardianPhone} onChange={(e) => handleChange('guardianPhone', e.target.value)} />
            </div>
          </fieldset>

          <Input
            label={t('profile.address') || 'Address'}
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
          />

          {error && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-success bg-success/5 rounded-lg px-3 py-2">{success}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel') || 'Cancel'}</Button>
            <Button onClick={handleSaveProfile} loading={isSaving || isUploadingAvatar}>{t('common.save') || 'Save'}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label={t('profile.currentPassword') || 'Current Password'}
            type="password"
            value={pwForm.currentPassword}
            onChange={(e) => handlePwChange('currentPassword', e.target.value)}
          />
          <Input
            label={t('profile.newPassword') || 'New Password'}
            type="password"
            value={pwForm.newPassword}
            onChange={(e) => handlePwChange('newPassword', e.target.value)}
          />
          <Input
            label={t('admin.confirmNewPassword') || 'Confirm New Password'}
            type="password"
            value={pwForm.confirmPassword}
            onChange={(e) => handlePwChange('confirmPassword', e.target.value)}
          />

          {pwError && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-success bg-success/5 rounded-lg px-3 py-2">{pwSuccess}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel') || 'Cancel'}</Button>
            <Button onClick={handleChangePassword} loading={isChangingPw}>{t('profile.changePassword') || 'Change Password'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
