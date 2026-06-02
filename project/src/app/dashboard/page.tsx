import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchUserBeetles } from '@/lib/beetles';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const beetles = await fetchUserBeetles(supabase, user.id);

  return <DashboardClient beetles={beetles} userEmail={user.email} />;
}
