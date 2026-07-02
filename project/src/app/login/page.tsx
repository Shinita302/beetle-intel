import { Suspense } from 'react';
import LoginClient from './LoginClient';
import { redirectAuthenticatedToDashboard } from '@/lib/supabase/authRedirects';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  await redirectAuthenticatedToDashboard();

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <LoginClient />
    </Suspense>
  );
}
