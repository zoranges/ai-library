import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, BookOpen, Shield } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      const { user } = useAuthStore.getState();
      if (user?.role === 'super_admin' || user?.role === 'school_admin' || user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
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
            Start Your<br />Reading Journey
          </h1>
          <p className="mt-5 text-[15px] text-white/70 leading-relaxed max-w-[280px] font-medium">
            Discover amazing stories and explore wonderful worlds with your AI reading assistant!
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

          <h2 className="text-[22px] font-extrabold text-text-primary font-heading">Welcome Back</h2>
          <p className="text-[14px] text-text-tertiary mt-1.5 mb-7">Continue your reading journey</p>

          {error && (
            <div className="mb-5 px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
              required
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
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
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/20"
                />
                <span className="text-[13px] text-text-secondary">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-[13px] text-accent hover:text-accent-dark transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" fullWidth size="lg" loading={isLoading} className="h-12 rounded-lg text-[15px] font-semibold">
              Login
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="px-3 bg-bg-primary text-text-tertiary">or</span>
              </div>
            </div>

            <button
              type="button"
              className="mt-4 w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-border rounded-lg text-[13px] font-medium text-text-secondary hover:bg-bg-tertiary/50 transition-colors duration-150"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </div>

          <p className="mt-7 text-center text-[13px] text-text-tertiary">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent hover:text-accent-dark font-medium transition-colors">
              Sign up
            </Link>
          </p>

          <div className="mt-4 pt-4 border-t border-border text-center">
            <Link to="/admin/login" className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary hover:text-accent transition-colors">
              <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
              Admin Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
