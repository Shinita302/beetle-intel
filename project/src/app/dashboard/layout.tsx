import { redirect } from 'next/navigation';
import { BeetleAppProvider } from '@/contexts/BeetleAppContext';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { fetchUserBeetles } from '@/lib/beetles';
import { fetchUserBreedingData } from '@/lib/userBreedingData';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const dbBeetles = await fetchUserBeetles(supabase, user.id);
  const initialBreedingData = await fetchUserBreedingData(supabase, user.id);

  return (
    <BeetleAppProvider
      userId={user.id}
      userEmail={user.email}
      initialDbBeetles={dbBeetles}
      initialBreedingData={initialBreedingData}
    >
      <DashboardShell>{children}</DashboardShell>
    </BeetleAppProvider>
  );
}
