'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthButton, AuthError, AuthField, AuthShell } from '@/components/auth/AuthShell';
import { getAuthCallbackUrl } from '@/lib/authRedirect';
import { createClient } from '@/lib/supabase/client';

export default function SignupClient() {
  const router = useRouter();
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
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
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

    setSuccess('Account created. Check your email to confirm your address, then log in.');
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Start tracking your beetle breeding program"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="text-sky-400 hover:text-sky-300">
            Log in
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
          label="Email"
          id="signup-email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <AuthField
          label="Password"
          id="signup-password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <AuthField
          label="Confirm password"
          id="signup-confirm"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />

        <AuthButton disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</AuthButton>
      </form>
    </AuthShell>
  );
}
