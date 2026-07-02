import SignupClient from './SignupClient';
import { redirectAuthenticatedToDashboard } from '@/lib/supabase/authRedirects';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  await redirectAuthenticatedToDashboard();

  return <SignupClient />;
}

