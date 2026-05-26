import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Mail, Lock, Shield, Info, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

export default function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [role, setRole] = useState('super_admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ipBinding, setIpBinding] = useState(false);
  const [error, setError] = useState('');

  const roles = [
    { value: 'super_admin', label: t('admin.superAdmin') },
    { value: 'admin', label: t('admin.schoolAdmin') },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        navigate('/admin');
      } else {
        setError(t('admin.noAdminPermission'));
        useAuthStore.getState().logout();
      }
    } catch {
      setError(t('auth.errorInvalidCredentials'));
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="w-2/5 flex items-center justify-center px-6 py-8 sm:px-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-10 w-10 bg-accent rounded-lg flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <span className="text-lg font-black text-text-primary font-heading tracking-tight">AI Library</span>
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-accent/10 text-accent rounded">{t('admin.adminPanel')}</span>
            </div>
            <h1 className="text-[38px] font-black text-text-primary font-heading leading-[1.1] tracking-tight">
              {t('auth.adminLogin')}
            </h1>
            <p className="mt-4 text-[15px] text-text-tertiary leading-relaxed max-w-[320px]">
              {t('admin.authorizedAccess')}
            </p>
          </div>

          <div className="animate-slide-up bg-bg-primary rounded-xl px-6 py-7 shadow-2">
            <h2 className="text-[20px] font-extrabold text-text-primary font-heading">{t('admin.signIn')}</h2>
            <p className="text-[13px] text-text-tertiary mt-1 mb-6">{t('admin.restrictedAccess')}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-text-primary mb-1.5 block">{t('admin.role')}</label>
                <div className="flex bg-surface-raised rounded-md p-1 gap-0.5">
                  {roles.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      className={cn(
                        'flex-1 py-1.5 text-[13px] font-medium rounded-[6px] transition-all duration-micro ease-out-quart',
                        role === r.value
                          ? 'bg-surface text-text-primary shadow-1'
                          : 'text-text-tertiary hover:text-text-secondary'
                      )}
                      onClick={() => setRole(r.value)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label={t('auth.email')}
                type="email"
                placeholder="admin@library.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
                required
              />

              <Input
                label={t('auth.password')}
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
                required
              />

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={ipBinding}
                    onChange={(e) => setIpBinding(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="h-[18px] w-[18px] rounded-[4px] border border-border peer-checked:bg-accent peer-checked:border-accent transition-all flex items-center justify-center">
                    {ipBinding && <span className="text-white text-[10px]">&#10003;</span>}
                  </div>
                </div>
                <span className="text-[13px] text-text-secondary group-hover:text-text-primary transition-colors">{t('admin.bindCurrentIp')}</span>
                <Info className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
              </label>

              {error && (
                <div className="flex items-center gap-2 text-error text-[13px] bg-error/5 px-3 py-2 rounded-md">
                  <Shield className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                fullWidth
                loading={isLoading}
                className="h-12 rounded-lg text-[15px] font-semibold"
              >
                {t('auth.login')}
              </Button>
            </form>

            <p className="text-center text-[11px] text-text-tertiary mt-5">
              {t('admin.secureAccess')}
            </p>

            <div className="mt-4 pt-4 border-t border-border text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary hover:text-accent transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t('admin.studentLogin')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Dato */}
      <div
        className="hidden lg:block lg:w-3/5 bg-contain bg-no-repeat bg-center"
        style={{ backgroundImage: 'url(/首页拿督新.png)' }}
      />
    </div>
  );
}
