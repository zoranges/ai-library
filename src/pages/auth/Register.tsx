import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, CreditCard, BookOpen, ChevronRight, ChevronLeft, Info } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAuthStore } from '@/stores/authStore';

const STEPS = [
  { key: 'account', label: 'Account' },
  { key: 'identity', label: 'Identity' },
  { key: 'preference', label: 'Language' },
];

const SCHOOL_OPTIONS = [
  { value: 'school-1', label: 'Sekolah Rendah Kebangsaan 1' },
  { value: 'school-2', label: 'Sekolah Rendah Kebangsaan 2' },
  { value: 'school-3', label: 'Sekolah Rendah Kebangsaan 3' },
  { value: 'school-4', label: 'Sekolah Jenis Kebangsaan (C)' },
  { value: 'school-5', label: 'Sekolah Jenis Kebangsaan (T)' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'ms', label: 'MS' },
  { value: 'zh', label: 'ZH' },
  { value: 'ta', label: 'TA' },
];

export default function Register() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    icNumber: '',
    schoolId: '',
    language: 'en',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showIcTooltip, setShowIcTooltip] = useState(false);
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validateStep0(): boolean {
    const errs: Record<string, string> = {};
    if (!form.username.trim()) errs.username = 'Please enter a username';
    if (!form.email.trim()) errs.email = 'Please enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.password) errs.password = 'Please enter a password';
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!form.icNumber.trim()) errs.icNumber = 'Please enter your IC number';
    else if (!/^\d{6}-\d{2}-\d{4}$/.test(form.icNumber) && !/^\d{12}$/.test(form.icNumber.replace(/-/g, ''))) {
      errs.icNumber = 'Format: 010101-01-1234';
    }
    if (!form.schoolId) errs.schoolId = 'Please select a school';
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
      });
      navigate('/');
    } catch {
      void 0;
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[480px] xl:lg:w-[520px] relative items-center justify-center overflow-hidden hero-gradient">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 px-12 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-10">
            <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <span className="text-xl font-black text-white font-heading tracking-tight">AI Library</span>
          </div>
          <h1 className="text-[40px] font-black text-white font-heading leading-[1.15] tracking-tight drop-shadow-lg">
            Join the<br />Reading Community
          </h1>
          <p className="mt-5 text-[15px] text-white/70 leading-relaxed max-w-[280px] font-medium">
            Create an account and explore wonderful stories with your AI reading assistant!
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-bg-primary">
        <div className="w-full max-w-[380px] animate-slide-up">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="h-8 w-8 bg-accent rounded-lg flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <span className="text-lg font-extrabold text-text-primary font-heading tracking-tight">AI Library</span>
          </div>

          <h2 className="text-[22px] font-extrabold text-text-primary font-heading">Create Account</h2>
          <p className="text-[14px] text-text-tertiary mt-1.5 mb-6">Fill in your details to get started</p>

          <div className="flex items-center gap-1 mb-7">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${
                      i < step ? 'bg-accent' : i === step ? 'bg-accent w-2.5 h-2.5' : 'bg-bg-tertiary'
                    }`}
                  />
                  <span className={`text-[11px] font-medium hidden sm:block ${i === step ? 'text-text-primary' : 'text-text-tertiary'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-2 rounded transition-colors duration-300 ${i < step ? 'bg-accent/50' : 'bg-bg-tertiary'}`} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-5 px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 0 && (
              <div className="space-y-4 animate-fade-in">
                <Input
                  label="Username"
                  placeholder="Choose a username"
                  value={form.username}
                  onChange={(e) => updateForm('username', e.target.value)}
                  icon={<User className="h-4 w-4" strokeWidth={1.5} />}
                  error={errors.username}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
                  error={errors.email}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(e) => updateForm('password', e.target.value)}
                  icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
                  error={errors.password}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Enter password again"
                  value={form.confirmPassword}
                  onChange={(e) => updateForm('confirmPassword', e.target.value)}
                  icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
                  error={errors.confirmPassword}
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="relative">
                  <Input
                    label="IC Number"
                    placeholder="010101-01-1234"
                    value={form.icNumber}
                    onChange={(e) => updateForm('icNumber', e.target.value)}
                    icon={<CreditCard className="h-4 w-4" strokeWidth={1.5} />}
                    error={errors.icNumber}
                  />
                  <div className="absolute right-0 top-0">
                    <button
                      type="button"
                      onMouseEnter={() => setShowIcTooltip(true)}
                      onMouseLeave={() => setShowIcTooltip(false)}
                      className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
                    >
                      <Info className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                    {showIcTooltip && (
                      <div className="absolute right-0 top-6 w-48 px-2.5 py-1.5 bg-text-primary text-[11px] text-white/90 rounded-lg shadow-lg z-10">
                        Malaysian Identity Card Number (MyKad)
                      </div>
                    )}
                  </div>
                </div>
                <Select
                  label="School"
                  options={SCHOOL_OPTIONS}
                  value={form.schoolId}
                  onChange={(v) => updateForm('schoolId', v)}
                  placeholder="选择你的学校"
                  error={errors.schoolId}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">Preferred Language</label>
                  <div className="flex gap-1.5">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => updateForm('language', lang.value)}
                        className={`flex-1 py-2.5 text-[13px] font-mono font-medium rounded-lg transition-all duration-150 ${
                          form.language === lang.value
                            ? 'bg-accent text-white shadow-sm'
                            : 'bg-bg-tertiary/60 text-text-secondary hover:bg-bg-tertiary'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-2">You can change this later in settings</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-7">
              {step > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                  icon={<ChevronLeft className="h-4 w-4" strokeWidth={1.5} />}
                >
                  Back
                </Button>
              )}
              <div className="flex-1" />
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={handleNext} icon={<ChevronRight className="h-4 w-4" strokeWidth={1.5} />} iconPosition="right">
                  Next
                </Button>
              ) : (
                <Button type="submit" loading={isLoading} className="h-12 rounded-lg text-[15px] font-semibold">Create Account</Button>
              )}
            </div>
          </form>

          <p className="mt-7 text-center text-[13px] text-text-tertiary">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:text-accent-dark font-medium transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
