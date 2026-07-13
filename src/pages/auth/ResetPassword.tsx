import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { authApi } from '@/utils/api';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!password || password.length < 6) {
      setError(t('auth.passwordRequirements'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
        <div className="w-full max-w-[420px] text-center animate-fade-in">
          <div className="bg-bg-primary rounded-xl border border-border shadow-1 p-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-warning/10 rounded-full mb-4">
              <ShieldAlert className="w-8 h-8 text-warning" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold text-text-primary font-heading">Invalid Reset Link</h2>
            <p className="text-[13px] text-text-tertiary mt-2 mb-6">
              This password reset link is invalid or missing a token.
            </p>
            <Link to="/forgot-password">
              <Button variant="primary" fullWidth className="h-11 rounded-lg font-semibold">
                Request New Reset Link
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
        <div className="w-full max-w-[420px] text-center animate-fade-in">
          <div className="bg-bg-primary rounded-xl border border-border shadow-1 p-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-success/10 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-success" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold text-text-primary font-heading">Password Reset Complete</h2>
            <p className="text-[13px] text-text-tertiary mt-2 mb-6">
              Your password has been updated. Redirecting to login...
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
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
      <div className="w-full max-w-[420px] animate-fade-in">
        <div className="bg-bg-primary rounded-xl border border-border shadow-1 p-8">
          <div className="flex justify-center mb-5">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6 text-accent" strokeWidth={1.5} />
            </div>
          </div>
          <h2 className="text-lg font-extrabold text-text-primary font-heading text-center">Set New Password</h2>
          <p className="text-[13px] text-text-tertiary mt-1.5 mb-6 text-center">
            Enter your new password below.
          </p>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-text-tertiary hover:text-text-secondary"
              >
                {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
              </button>
            </div>

            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
              required
            />

            <Button type="submit" fullWidth size="lg" loading={isLoading} className="h-11 rounded-lg font-semibold">
              Reset Password
            </Button>
          </form>

          <Link
            to="/login"
            className="mt-5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-text-tertiary hover:text-accent transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
