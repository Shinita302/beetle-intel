'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthButton, AuthError, AuthField, AuthShell } from '@/components/auth/AuthShell';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAuthCallbackUrl } from '@/lib/authRedirect';
import { createClient } from '@/lib/supabase/client';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const callbackError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    callbackError === 'auth_callback_failed' ? t('auth.signInFailed') : ''
  );
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  const handleGoogle = async () => {
    setError('');
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthCallbackUrl(),
      },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError(t('auth.enterEmailFirst'));
      return;
    }
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrl(),
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  };

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <AuthShell
        title={t('auth.loginTitle')}
        subtitle={t('auth.loginSubtitle')}
        footer={
          <>
            {t('auth.noAccount')}{' '}
            <Link href="/signup" className="text-sky-400 hover:text-sky-300">
              {t('auth.signUpLink')}
            </Link>
          </>
        }
      >
        <AuthError message={error} />
        {resetSent && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {t('auth.resetSent')}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <AuthField
            label={t('auth.email')}
            id="email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <AuthField
            label={t('auth.password')}
            id="password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          <div className="mb-4 text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-gray-500 hover:text-sky-400 transition-colors"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>

          <AuthButton disabled={loading}>
            {loading ? t('auth.loggingIn') : t('auth.logIn')}
          </AuthButton>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-gray-900/60 px-2 text-gray-600">{t('common.or')}</span>
          </div>
        </div>

        <AuthButton type="button" variant="secondary" disabled={loading} onClick={handleGoogle}>
          {t('auth.continueGoogle')}
        </AuthButton>
      </AuthShell>
    </div>
  );
}
