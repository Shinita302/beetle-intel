'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ImportSpreadsheet } from '@/features/ImportSpreadsheet';
import { createClient } from '@/lib/supabase/client';
import { insertBeetlesForUser } from '@/lib/beetles';
import type { Beetle, LarvalRecord } from '@/types';

export default function DashboardImportPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login?redirect=/dashboard/import');
        return;
      }
      setUserId(user.id);
    });
  }, [router]);

  const handleImportConfirmed = async (payload: { beetles: Beetle[]; larvalRecords: LarvalRecord[] }) => {
    if (!userId) return;
    setSaveError('');
    setSaving(true);

    try {
      const supabase = createClient();
      await insertBeetlesForUser(supabase, userId, payload.beetles);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save beetle records.');
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return <div className="min-h-screen bg-gray-950 p-6 text-gray-500 text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Beetles
        </Link>
      </header>

      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        {saveError && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {saveError}
          </div>
        )}
        {saving && (
          <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-300">
            Saving your beetle records…
          </div>
        )}
        <ImportSpreadsheet beetles={[]} larvalRecords={[]} onImportConfirmed={handleImportConfirmed} />
      </div>
    </div>
  );
}
