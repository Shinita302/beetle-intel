'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthButton, AuthError, AuthField, AuthShell } from '@/components/auth/AuthShell';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAuthCallbackUrl } from '@/lib/authRedirect';
import { createClient } from '@/lib/supabase/client';

export default function SignupClient() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push('/dashboard');
      router.refresh();
      return;
    }

    setSuccess(t('auth.accountCreated'));
  };

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <AuthShell
        title={t('auth.signupTitle')}
        subtitle={t('auth.signupSubtitle')}
        footer={
          <>
            {t('auth.haveAccount')}{' '}
            <Link href="/login" className="text-sky-400 hover:text-sky-300">
              {t('auth.logInLink')}
            </Link>
          </>
        }
      >
        <AuthError message={error} />
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <AuthField
            label={t('auth.email')}
            id="signup-email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <AuthField
            label={t('auth.password')}
            id="signup-password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <AuthField
            label={t('auth.confirmPassword')}
            id="signup-confirm"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />

          <AuthButton disabled={loading}>
            {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
          </AuthButton>
        </form>
      </AuthShell>
    </div>
  );
}
