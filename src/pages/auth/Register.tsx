import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, User, Eye, EyeOff, BookOpen, Phone, MapPin } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'zh', label: '中文' },
  { value: 'ta', label: 'தமிழ்' },
];

const SCHOOLS = [
  { value: 'school-001', label: '阳光小学' },
  { value: 'school-002', label: '星辰中学' },
  { value: 'school-003', label: '未来学校' },
];

export default function Register() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '',
    icNumber: '', schoolId: '', grade: '',
    language: 'en',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const STEPS = [
    { key: 'account', label: t('auth.stepAccount') },
    { key: 'identity', label: t('auth.stepIdentity') },
    { key: 'preferences', label: t('auth.stepPreferences') },
  ];

  function updateForm(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  function validateStep0() {
    const errs: Record<string, string> = {};
    if (!form.username) errs.username = t('auth.pleaseEnterUsername');
    if (!form.email) errs.email = t('auth.pleaseEnterEmail');
    if (!form.password || form.password.length < 6) errs.password = t('auth.passwordRequirements');
    if (form.password !== form.confirmPassword) errs.confirmPassword = t('auth.passwordsDoNotMatch');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep1() {
    const errs: Record<string, string> = {};
    if (!form.schoolId) errs.schoolId = t('auth.pleaseSelectSchool');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
        schoolId: form.schoolId,
        grade: form.grade || undefined,
        icNumber: form.icNumber || undefined,
        preferredLanguage: form.language || 'en',
      });
      navigate('/');
    } catch {
      void 0;
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="w-2/5 flex flex-col items-center justify-center px-6 py-8 sm:px-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-10 w-10 bg-accent rounded-lg flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <span className="text-lg font-black text-text-primary font-heading tracking-tight">AI Library</span>
            </div>
            <h1 className="text-[38px] font-black text-text-primary font-heading leading-[1.1] tracking-tight">
              {t('auth.joinReadingCommunity')}
            </h1>
            <p className="mt-4 text-[15px] text-text-tertiary leading-relaxed max-w-[380px]">
              {t('auth.createAccountSubtitle')}
            </p>
          </div>

          <div className="animate-slide-up bg-bg-primary rounded-xl px-6 py-7 shadow-2">
            <h2 className="text-[20px] font-extrabold text-text-primary font-heading">{t('auth.createAccount')}</h2>
            <p className="text-[13px] text-text-tertiary mt-1 mb-4">{t('auth.fillInDetails')}</p>

            <div className="flex items-center gap-1 mb-5">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${
                      i < step ? 'bg-accent' : i === step ? 'bg-accent w-2.5 h-2.5' : 'bg-bg-tertiary'
                    }`} />
                    <span className={`text-[11px] font-medium hidden sm:block ${i === step ? 'text-text-primary' : 'text-text-tertiary'}`}>
                      {s.key === 'account' ? t('auth.stepAccount') : s.key === 'identity' ? t('auth.stepIdentity') : t('auth.stepPreferences')}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-px flex-1 mx-2 rounded transition-colors duration-300 ${i < step ? 'bg-accent/50' : 'bg-bg-tertiary'}`} />}
                </div>
              ))}
            </div>

            {error && <div className="mb-5 px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              {step === 0 && (
                <div className="space-y-4 animate-fade-in">
                  <Input label={t('auth.username')} placeholder={t('auth.usernamePlaceholder')} value={form.username} onChange={(e) => updateForm('username', e.target.value)} icon={<User className="h-4 w-4" strokeWidth={1.5} />} error={errors.username} />
                  <Input label={t('auth.email')} type="email" placeholder={t('auth.emailPlaceholder')} value={form.email} onChange={(e) => updateForm('email', e.target.value)} icon={<Mail className="h-4 w-4" strokeWidth={1.5} />} error={errors.email} />
                  <div className="relative">
                    <Input label={t('auth.password')} type={showPassword ? 'text' : 'password'} placeholder={t('auth.passwordPlaceholder')} value={form.password} onChange={(e) => updateForm('password', e.target.value)} icon={<Lock className="h-4 w-4" strokeWidth={1.5} />} error={errors.password} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[38px] text-text-tertiary hover:text-text-secondary">
                      {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="flex items-center gap-1.5 -mt-2">
                      {[1, 2, 3, 4].map((n) => {
                        const score = form.password.length >= 12 ? 4 : form.password.length >= 8 ? 3 : form.password.length >= 6 ? 2 : 1;
                        const filled = n <= score;
                        const color = score <= 2 ? 'bg-error' : score === 3 ? 'bg-warning' : 'bg-success';
                        return <div key={n} className={cn('h-1 flex-1 rounded-full', filled ? color : 'bg-border')} />;
                      })}
                      <span className="text-[10px] text-text-tertiary ml-1 shrink-0">
                        {form.password.length < 6 ? t('auth.passwordWeak') : form.password.length < 8 ? t('auth.passwordFair') : form.password.length < 12 ? t('auth.passwordGood') : t('auth.passwordStrong')}
                      </span>
                    </div>
                  )}
                  <Input label={t('auth.confirmPassword')} type="password" placeholder={t('auth.confirmPasswordPlaceholder')} value={form.confirmPassword} onChange={(e) => updateForm('confirmPassword', e.target.value)} icon={<Lock className="h-4 w-4" strokeWidth={1.5} />} error={errors.confirmPassword} />
                  <Button type="button" fullWidth size="lg" onClick={handleNext}>{t('auth.next')}</Button>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <Input label={t('auth.icNumber')} placeholder="010101-01-1234" value={form.icNumber} onChange={(e) => updateForm('icNumber', e.target.value)} icon={<Phone className="h-4 w-4" strokeWidth={1.5} />} />
                  <Select label={t('auth.school')} options={SCHOOLS} value={form.schoolId} onChange={(v) => updateForm('schoolId', v)} placeholder={t('auth.selectSchool')} error={errors.schoolId} />
                  <Input label={t('auth.grade')} placeholder={t('auth.grade')} value={form.grade} onChange={(e) => updateForm('grade', e.target.value)} icon={<MapPin className="h-4 w-4" strokeWidth={1.5} />} />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <Select label={t('auth.languagePreference')} options={LANG_OPTIONS} value={form.language} onChange={(v) => updateForm('language', v)} />
                  <p className="text-[11px] text-text-tertiary">{t('auth.languageChangeLater')}</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                {step > 0 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>{t('common.back')}</Button>}
                {step < STEPS.length - 1 ? (
                  <Button type="button" fullWidth onClick={handleNext}>{t('auth.next')}</Button>
                ) : (
                  <Button type="submit" fullWidth loading={isLoading}>{t('auth.createAccount')}</Button>
                )}
              </div>
            </form>

            <p className="mt-5 text-center text-[13px] text-text-tertiary">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-accent hover:text-accent-dark font-medium transition-colors">{t('auth.loginNow')}</Link>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:block lg:w-3/5 bg-contain bg-no-repeat bg-center" style={{ backgroundImage: 'url(/首页拿督新.png)' }} />
    </div>
  );
}
