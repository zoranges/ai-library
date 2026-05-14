import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Lock, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { authApi } from '@/utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      setIsSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
      <div className="w-full max-w-[420px] animate-slide-up">
        <div className="bg-bg-primary rounded-2xl border border-border shadow-card p-8">
          {isSent ? (
            <div className="text-center animate-fade-in">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-success/10 rounded-full mb-4">
                <div className="relative">
                  <Check className="w-5 h-5 text-success" strokeWidth={2} style={{
                    strokeDasharray: 24,
                    animation: 'checkmark-draw 0.4s ease-out forwards',
                  }} />
                </div>
              </div>
              <h2 className="text-lg font-bold text-text-primary font-heading">Check your email</h2>
              <p className="text-[13px] text-text-tertiary mt-2 mb-6 leading-relaxed">
                We&apos;ve sent a reset link to <span className="text-text-primary font-medium">{email}</span>
              </p>
              <Link to="/login">
                <Button variant="primary" fullWidth className="h-11 rounded-lg">Back to sign in</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-10 h-10 bg-bg-tertiary rounded-xl flex items-center justify-center">
                  <Lock className="w-4.5 h-4.5 text-text-tertiary" strokeWidth={1.5} />
                </div>
              </div>
              <h2 className="text-lg font-bold text-text-primary font-heading text-center">Reset password</h2>
              <p className="text-[13px] text-text-tertiary mt-1.5 mb-6 text-center">Enter your email and we&apos;ll send you a reset link</p>

              {error && (
                <div className="mb-4 px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
                  error={error && !email ? error : undefined}
                  required
                />
                <Button type="submit" fullWidth size="lg" loading={isLoading} className="h-11 rounded-lg">
                  Send reset link
                </Button>
              </form>
            </>
          )}

          {!isSent && (
            <Link
              to="/login"
              className="mt-5 flex items-center justify-center gap-1.5 text-[13px] text-text-tertiary hover:text-accent transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
              Back to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
