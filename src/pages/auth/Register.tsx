import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, CreditCard, BookOpen, ChevronRight, ChevronLeft, Info } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAuthStore } from '@/stores/authStore';

const STEPS = [
  { key: 'account', label: '账号' },
  { key: 'identity', label: '身份' },
  { key: 'preference', label: '语言' },
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
    if (!form.username.trim()) errs.username = '请输入用户名';
    if (!form.email.trim()) errs.email = '请输入邮箱';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = '邮箱格式不正确';
    if (!form.password) errs.password = '请输入密码';
    else if (form.password.length < 6) errs.password = '密码至少6个字符';
    if (form.password !== form.confirmPassword) errs.confirmPassword = '两次密码不一致';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!form.icNumber.trim()) errs.icNumber = '请输入IC号码';
    else if (!/^\d{6}-\d{2}-\d{4}$/.test(form.icNumber) && !/^\d{12}$/.test(form.icNumber.replace(/-/g, ''))) {
      errs.icNumber = '格式：010101-01-1234';
    }
    if (!form.schoolId) errs.schoolId = '请选择学校';
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
      <div className="hidden lg:flex lg:w-[480px] xl:lg:w-[520px] relative items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(160deg, oklch(0.80 0.14 155), oklch(0.78 0.16 30), oklch(0.82 0.14 240))' }}>
        <div className="absolute top-16 left-16 w-32 h-16 bg-white/10 rounded-full animate-cloud" />
        <div className="absolute top-28 right-24 w-24 h-10 bg-white/10 rounded-full animate-cloud" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-32 left-20 w-28 h-12 bg-white/10 rounded-full animate-cloud" style={{ animationDelay: '4s' }} />
        <div className="absolute top-8 right-12 text-3xl animate-star" style={{ animationDelay: '0.5s' }}>🎉</div>
        <div className="absolute bottom-20 right-16 text-2xl animate-star" style={{ animationDelay: '1.2s' }}>⭐</div>
        <div className="absolute top-1/2 left-8 text-2xl animate-float" style={{ animationDelay: '0.8s' }}>📚</div>
        <div className="relative z-10 px-12 animate-bounce-in">
          <div className="flex items-center gap-2.5 mb-10">
            <span className="text-3xl">🌟</span>
            <span className="text-xl font-black text-white/90 font-heading tracking-tight">AI 小书屋</span>
          </div>
          <h1 className="text-[40px] font-black text-white font-heading leading-[1.15] tracking-tight drop-shadow-lg">
            加入<br />阅读大家庭 🎈
          </h1>
          <p className="mt-5 text-[15px] text-white/60 leading-relaxed max-w-[280px] font-semibold">
            注册账号，和 AI 小助手一起开启奇妙的阅读之旅！
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-bg-primary">
        <div className="w-full max-w-[380px] animate-slide-up">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <BookOpen className="h-5 w-5 text-accent" strokeWidth={1.5} />
            <span className="text-lg font-extrabold text-text-primary font-heading tracking-tight">🌟 AI 小书屋</span>
          </div>

          <h2 className="text-[22px] font-extrabold text-text-primary font-heading">创建账号 ✨</h2>
          <p className="text-[14px] text-text-tertiary mt-1.5 mb-6">填写信息，开始你的阅读之旅</p>

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
                  label="用户名"
                  placeholder="选一个好听的名字"
                  value={form.username}
                  onChange={(e) => updateForm('username', e.target.value)}
                  icon={<User className="h-4 w-4" strokeWidth={1.5} />}
                  error={errors.username}
                />
                <Input
                  label="邮箱"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
                  error={errors.email}
                />
                <Input
                  label="密码"
                  type="password"
                  placeholder="至少6个字符"
                  value={form.password}
                  onChange={(e) => updateForm('password', e.target.value)}
                  icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
                  error={errors.password}
                />
                <Input
                  label="确认密码"
                  type="password"
                  placeholder="再输入一次密码"
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
                    label="IC 号码"
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
                        马来西亚身份证号码 (MyKad)
                      </div>
                    )}
                  </div>
                </div>
                <Select
                  label="学校"
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
                  <label className="text-sm font-medium text-text-primary mb-2 block">偏好语言</label>
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
                  <p className="text-[11px] text-text-tertiary mt-2">之后可以在设置中修改</p>
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
                  返回
                </Button>
              )}
              <div className="flex-1" />
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={handleNext} icon={<ChevronRight className="h-4 w-4" strokeWidth={1.5} />} iconPosition="right">
                  继续
                </Button>
              ) : (
                <Button type="submit" loading={isLoading} className="h-12 rounded-2xl text-[15px] font-bold">🎉 创建账号</Button>
              )}
            </div>
          </form>

          <p className="mt-7 text-center text-[13px] text-text-tertiary">
            已有账号？{' '}
            <Link to="/login" className="text-accent hover:text-accent-dark font-medium transition-colors">
              去登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
