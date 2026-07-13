import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, User, Eye, EyeOff, BookOpen, CreditCard, MapPin, CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { getPublicConfig } from '@/utils/api';
import { getAllStates, getDistrictsByState } from '@/data/malaysiaLocations';

const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'zh', label: '中文' },
  { value: 'ta', label: 'தமிழ்' },
];

interface SchoolOption { value: string; label: string; }

async function fetchSchools(state: string, district?: string): Promise<SchoolOption[]> {
  const params = new URLSearchParams({ country: 'Malaysia', state });
  if (district) params.set('district', district);
  const res = await fetch(`/api/public/schools?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).map((d: any) => ({ value: d.value, label: d.label }));
}

export default function Register() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '',
    icNumber: '', state: '', district: '', schoolId: '', grade: '',
    language: 'en',
  });
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [bgImage, setBgImage] = useState('/首页拿督新.png');

  const allStates = getAllStates();
  const stateOptions = [
    { value: '', label: t('auth.selectState') },
    ...allStates.map((s) => ({ value: s.value, label: s.label })),
  ];
  const districtOptions = [
    { value: '', label: t('auth.selectDistrict') },
    ...getDistrictsByState(form.state).map((d) => ({ value: d.value, label: d.label })),
  ];
  const schoolOptions = [
    { value: '', label: t('auth.selectSchool') },
    ...schools,
  ];

  useEffect(() => {
    getPublicConfig().then((cfg) => {
      if (cfg.register_page_image) setBgImage(cfg.register_page_image);
    }).catch(() => {});
  }, []);

  // Fetch schools when state or district changes
  const fetchSchoolList = useCallback(async (stateVal: string, districtVal?: string) => {
    setSchools([]);
    if (!stateVal) return;
    setSchoolsLoading(true);
    try {
      const list = await fetchSchools(stateVal, districtVal);
      setSchools(list);
    } finally {
      setSchoolsLoading(false);
    }
  }, []);

  const STEPS = [
    { key: 'account', label: t('auth.stepAccount') },
    { key: 'identity', label: t('auth.stepIdentity') },
    { key: 'preferences', label: t('auth.stepPreferences') },
  ];

  function updateForm(field: string, value: string) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'state') {
        next.district = '';
        next.schoolId = '';
        fetchSchoolList(value);
      }
      if (field === 'district') {
        next.schoolId = '';
        if (value) {
          fetchSchoolList(next.state, value);
        }
      }
      return next;
    });
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
    if (!form.icNumber) errs.icNumber = t('auth.pleaseEnterIcNumber');
    if (!form.state) errs.state = t('auth.pleaseSelectState');
    if (!form.district) errs.district = t('auth.pleaseSelectDistrict');
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
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          schoolId: form.schoolId,
          icNumber: form.icNumber.replace(/-/g, ''),
          grade: form.grade || undefined,
          preferredLanguage: form.language || 'en',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
        <div className="w-full max-w-[440px] text-center animate-fade-in">
          <div className="bg-bg-primary rounded-xl border border-border shadow-1 p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-5">
              <CheckCircle className="w-10 h-10 text-success" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-extrabold text-text-primary font-heading">Registration Successful</h2>
            <p className="text-[14px] text-text-secondary mt-3 mb-6 leading-relaxed">
              Your account has been created successfully. You can now log in and start reading.
            </p>
            <Link to="/login">
              <Button variant="primary" fullWidth className="h-11 rounded-lg font-semibold">Go to Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
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
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <Input label={t('auth.icNumber')} placeholder="010101-01-1234" value={form.icNumber} onChange={(e) => updateForm('icNumber', e.target.value)} icon={<CreditCard className="h-4 w-4" strokeWidth={1.5} />} error={errors.icNumber} required />
                  <Select label={t('admin.state')} options={stateOptions.filter((o) => o.value)} value={form.state} onChange={(v) => updateForm('state', v)} placeholder={t('auth.selectState')} error={errors.state} />
                  <Select label={t('admin.district')} options={districtOptions.filter((o) => o.value)} value={form.district} onChange={(v) => updateForm('district', v)} placeholder={t('auth.selectDistrict')} error={errors.district} disabled={!form.state} />
                  <Select label={t('auth.school')} options={schoolOptions} value={form.schoolId} onChange={(v) => updateForm('schoolId', v)} placeholder={schoolsLoading ? t('common.loading') : t('auth.selectSchool')} error={errors.schoolId} disabled={!form.district} />
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

      <div className="hidden lg:block lg:w-3/5 bg-contain bg-no-repeat bg-center" style={{ backgroundImage: `url(${bgImage})` }} />
    </div>
  );
}
