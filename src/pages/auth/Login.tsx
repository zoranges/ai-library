import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, CreditCard, Lock, Eye, EyeOff, BookOpen, Shield, CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAuthStore } from '@/stores/authStore';
import { getPublicConfig } from '@/utils/api';
import { getAllStates, getDistrictsByState } from '@/data/malaysiaLocations';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: string }) => void;
          prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean; isDismissedMoment: () => boolean }) => void) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '580002643501-th3i30s63ld66sj6qunq0avaj4t73g1v.apps.googleusercontent.com';

interface SchoolOption { value: string; label: string; }

async function fetchSchools(state: string): Promise<SchoolOption[]> {
  const params = new URLSearchParams({ country: 'Malaysia', state });
  const res = await fetch(`/api/admin/locations/schools?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).map((d: any) => ({ value: d.value, label: d.label }));
}

export default function Login() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, googleLogin, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const [bgImage, setBgImage] = useState('/普通用户登录.jpg');

  // Google registration inline flow
  const [googleRegMode, setGoogleRegMode] = useState(false);
  const [googleCredential, setGoogleCredential] = useState('');
  const [googleProfile, setGoogleProfile] = useState<{ email: string; name: string; avatar: string | null } | null>(null);
  const [regIcNumber, setRegIcNumber] = useState('');
  const [regState, setRegState] = useState('');
  const [regDistrict, setRegDistrict] = useState('');
  const [regSchoolId, setRegSchoolId] = useState('');
  const [regSchools, setRegSchools] = useState<SchoolOption[]>([]);
  const [regSchoolsLoading, setRegSchoolsLoading] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSubmitted, setRegSubmitted] = useState(false);

  const allStates = getAllStates();
  const stateOptions = [
    { value: '', label: t('auth.selectState') },
    ...allStates.map((s) => ({ value: s.value, label: s.label })),
  ];
  const districtOptions = [
    { value: '', label: t('auth.selectDistrict') },
    ...getDistrictsByState(regState).map((d) => ({ value: d.value, label: d.label })),
  ];
  const schoolOptions = [
    { value: '', label: t('auth.selectSchool') },
    ...regSchools,
  ];

  useEffect(() => {
    getPublicConfig().then((cfg) => {
      if (cfg.login_page_image) setBgImage(cfg.login_page_image);
    }).catch(() => {});
  }, []);

  // Fetch schools when state/district changes
  const loadSchools = useCallback(async (stateVal: string) => {
    setRegSchools([]);
    if (!stateVal) return;
    setRegSchoolsLoading(true);
    try {
      const list = await fetchSchools(stateVal);
      setRegSchools(list);
    } finally {
      setRegSchoolsLoading(false);
    }
  }, []);

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    clearError();
    try {
      await googleLogin(response.credential);
      const { user } = useAuthStore.getState();
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      const code = err?.response?.data?.code || err?.code;
      if (code === 'GOOGLE_NEEDS_REGISTRATION') {
        const data = err?.response?.data?.data;
        setGoogleCredential(response.credential);
        setGoogleProfile(data || null);
        setGoogleRegMode(true);
        setRegError('');
      }
    }
  }, [googleLogin, clearError, navigate]);

  useEffect(() => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
      });
    }
  }, [handleGoogleCredential]);

  const handleGoogleSignIn = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login(identifier, password);
      const { user } = useAuthStore.getState();
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch {
      void 0;
    }
  }

  async function handleGoogleRegSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegError('');
    if (!regIcNumber.trim()) { setRegError(t('auth.pleaseEnterIcNumber')); return; }
    if (!regState) { setRegError(t('auth.pleaseSelectState')); return; }
    if (!regDistrict) { setRegError(t('auth.pleaseSelectDistrict')); return; }
    if (!regSchoolId) { setRegError(t('auth.pleaseSelectSchool')); return; }

    setRegSubmitting(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: googleCredential,
          icNumber: regIcNumber.trim(),
          schoolId: regSchoolId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed');
      if (json.data?.pending) {
        setRegSubmitted(true);
      }
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setRegSubmitting(false);
    }
  }

  function resetGoogleReg() {
    setGoogleRegMode(false);
    setGoogleCredential('');
    setGoogleProfile(null);
    setRegIcNumber('');
    setRegState('');
    setRegDistrict('');
    setRegSchoolId('');
    setRegSchools([]);
    setRegError('');
    setRegSubmitted(false);
  }

  return (
    <div className="min-h-screen flex">
      <div className="w-full lg:w-2/5 flex flex-col items-center justify-center px-6 py-8 sm:px-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-10 animate-fade-in">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-10 w-10 bg-accent rounded-lg flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <span className="text-lg font-black text-text-primary font-heading tracking-tight">AI Library</span>
            </div>
            <h1 className="text-3xl sm:text-[38px] font-black text-text-primary font-heading leading-[1.1] tracking-tight">
              {t('auth.startReadingJourney')}
            </h1>
            <p className="mt-4 text-[15px] text-text-tertiary leading-relaxed max-w-[380px]">
              {t('auth.discoverStories')}
            </p>
          </div>

          <div className="animate-slide-up bg-bg-primary rounded-xl px-6 py-7 shadow-2">
            {googleRegMode ? (
              regSubmitted ? (
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-5">
                    <CheckCircle className="w-10 h-10 text-success" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-xl font-extrabold text-text-primary font-heading">{t('auth.registrationSubmitted')}</h2>
                  <p className="text-[14px] text-text-secondary mt-3 mb-6 leading-relaxed">
                    {t('auth.registrationPendingMessage')}
                  </p>
                  <p className="text-[13px] text-text-tertiary mb-6">
                    {t('auth.registrationApprovalHint')}
                  </p>
                  <Button variant="primary" fullWidth className="h-11 rounded-lg font-semibold" onClick={resetGoogleReg}>
                    {t('auth.backToLogin')}
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-[20px] font-extrabold text-text-primary font-heading">{t('auth.completeRegistration')}</h2>
                  <p className="text-[13px] text-text-tertiary mt-1 mb-5">
                    {t('auth.completeRegistrationHint')}
                  </p>

                  {googleProfile && (
                    <div className="mb-5 p-3 bg-surface-raised/50 border border-border rounded-lg flex items-center gap-3">
                      {googleProfile.avatar && <img src={googleProfile.avatar} alt="" className="w-10 h-10 rounded-full" />}
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">{googleProfile.name}</p>
                        <p className="text-[12px] text-text-tertiary truncate">{googleProfile.email}</p>
                      </div>
                    </div>
                  )}

                  {regError && (
                    <div className="mb-5 px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">
                      {regError}
                    </div>
                  )}

                  <form onSubmit={handleGoogleRegSubmit} className="space-y-4">
                    <Input
                      label={t('auth.icNumber')}
                      placeholder="010101-01-1234"
                      value={regIcNumber}
                      onChange={(e) => setRegIcNumber(e.target.value)}
                      icon={<CreditCard className="h-4 w-4" strokeWidth={1.5} />}
                      required
                    />
                    <Select
                      label={t('admin.state')}
                      options={stateOptions.filter((o) => o.value)}
                      value={regState}
                      onChange={(v) => { setRegState(v); setRegDistrict(''); setRegSchoolId(''); setRegSchools([]); if (v) loadSchools(v); }}
                      placeholder={t('auth.selectState')}
                    />
                    <Select
                      label={t('admin.district')}
                      options={districtOptions.filter((o) => o.value)}
                      value={regDistrict}
                      onChange={(v) => { setRegDistrict(v); setRegSchoolId(''); }}
                      placeholder={t('auth.selectDistrict')}
                      disabled={!regState}
                    />
                    <Select
                      label={t('auth.school')}
                      options={schoolOptions}
                      value={regSchoolId}
                      onChange={(v) => setRegSchoolId(v)}
                      placeholder={regSchoolsLoading ? t('common.loading') : t('auth.selectSchool')}
                      disabled={!regDistrict}
                    />

                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" onClick={resetGoogleReg} className="flex-1">
                        {t('common.back')}
                      </Button>
                      <Button type="submit" fullWidth loading={regSubmitting} className="h-11 rounded-lg font-semibold">
                        {t('auth.submitRegistration')}
                      </Button>
                    </div>
                  </form>
                </>
              )
            ) : (
              <>
                <h2 className="text-[20px] font-extrabold text-text-primary font-heading">{t('auth.welcomeBack')}</h2>
                <p className="text-[13px] text-text-tertiary mt-1 mb-6">{t('auth.signInSubtitle')}</p>

                {error && (
                  <div className="mb-5 px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label={identifier.includes('@') ? t('auth.email') : t('auth.icNumber')}
                    placeholder={identifier.includes('@') ? t('auth.emailPlaceholder') : '010101-01-1234'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    icon={identifier.includes('@') ? <Mail className="h-4 w-4" strokeWidth={1.5} /> : <CreditCard className="h-4 w-4" strokeWidth={1.5} />}
                    required
                  />
                  <div className="relative">
                    <Input
                      label={t('auth.password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth.passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-[38px] text-text-tertiary hover:text-text-secondary transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/20" />
                      <span className="text-[13px] text-text-secondary">{t('auth.rememberMe')}</span>
                    </label>
                    <Link to="/forgot-password" className="text-[13px] text-accent hover:text-accent-dark transition-colors">
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>

                  <Button type="submit" fullWidth size="lg" loading={isLoading} className="h-12 rounded-lg text-[15px] font-semibold">
                    {t('auth.login')}
                  </Button>
                </form>

                <div className="mt-5">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-[11px]">
                      <span className="px-3 bg-bg-primary text-text-tertiary">{t('auth.or')}</span>
                    </div>
                  </div>

                  <button type="button" onClick={handleGoogleSignIn} disabled={isLoading} className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg text-[13px] font-medium text-text-secondary hover:bg-bg-tertiary/50 transition-colors duration-150 disabled:opacity-50">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {t('auth.loginWithGoogle')}
                  </button>
                </div>

                <p className="mt-5 text-center text-[13px] text-text-tertiary">
                  {t('auth.noAccount')}{' '}
                  <Link to="/register" className="text-accent hover:text-accent-dark font-medium transition-colors">
                    {t('auth.register')}
                  </Link>
                </p>

                <div className="mt-3 pt-3 border-t border-border text-center">
                  <Link to="/admin/login" className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary hover:text-accent transition-colors">
                    <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {t('auth.adminLogin')}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="hidden lg:block lg:w-3/5 bg-contain bg-no-repeat"
        style={{ backgroundImage: `url(${encodeURI(bgImage)})`, backgroundPosition: '55% 50%' }}
      />
    </div>
  );
}
