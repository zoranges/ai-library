import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, Lock, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { authApi } from '@/utils/api';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError(t('auth.pleaseEnterEmail'));
      return;
    }
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      setIsSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.failedToSend');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
      <div className="w-full max-w-[420px] animate-fade-in">
        <div className="bg-bg-primary rounded-xl border border-border shadow-1 p-8">
          {isSent ? (
            <div className="text-center animate-fade-in">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-success/10 rounded-full mb-4">
                <Check className="w-8 h-8 text-success" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-bold text-text-primary font-heading">{t('auth.checkYourEmail')}</h2>
              <p className="text-[13px] text-text-tertiary mt-2 mb-6 leading-relaxed">
                {t('auth.resetLinkSentTo')} <span className="text-text-primary font-bold">{email}</span>
              </p>
              <Link to="/login">
                <Button variant="primary" fullWidth className="h-11 rounded-lg font-semibold">{t('auth.backToLogin')}</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <Lock className="w-6 h-6 text-accent" strokeWidth={1.5} />
                </div>
              </div>
              <h2 className="text-lg font-extrabold text-text-primary font-heading text-center">{t('auth.resetPassword')}</h2>
              <p className="text-[13px] text-text-tertiary mt-1.5 mb-6 text-center">{t('auth.enterEmailForReset')}</p>

              {error && (
                <div className="mb-4 px-3 py-2.5 bg-error/5 border border-error/15 rounded-lg text-[13px] text-error">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label={t('auth.emailAddress')}
                  type="text"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
                  error={error && !email ? error : undefined}
                  required
                />
                <Button type="submit" fullWidth size="lg" loading={isLoading} className="h-11 rounded-lg font-semibold">
                  {t('auth.sendResetLink')}
                </Button>
              </form>
            </>
          )}

          {!isSent && (
            <Link
              to="/login"
              className="mt-5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-text-tertiary hover:text-accent transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('auth.backToLogin')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
