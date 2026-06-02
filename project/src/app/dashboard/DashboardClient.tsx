'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Upload } from 'lucide-react';
import type { DbBeetle } from '@/types/database';
import { hasAnyInventoryCounts } from '@/types';
import { dbBeetleDisplayName, parseBeetleMeta } from '@/lib/beetleDbMapper';
import { parseInventoryCounts } from '@/types/database';
import { signOut } from '@/lib/beetles';
import { createClient } from '@/lib/supabase/client';

interface DashboardClientProps {
  beetles: DbBeetle[];
  userEmail: string | undefined;
}

export default function DashboardClient({ beetles, userEmail }: DashboardClientProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await signOut(supabase);
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-sky-400/80">BeetleIntel</p>
            <h1 className="text-xl font-bold text-gray-100">My Beetles</h1>
            {userEmail && <p className="text-xs text-gray-500 mt-0.5">{userEmail}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/import"
              className="inline-flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload spreadsheet
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 lg:p-6">
        {beetles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 px-6 py-16 text-center">
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              No beetle records yet. Upload a spreadsheet to begin.
            </p>
            <Link
              href="/dashboard/import"
              className="inline-flex items-center gap-2 mt-6 rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload spreadsheet
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {beetles.map((beetle) => {
              const meta = parseBeetleMeta(beetle.notes);
              const counts = parseInventoryCounts(beetle.inventory_counts);
              const hasInventory = hasAnyInventoryCounts(counts);
              const growthTrack = Array.isArray(beetle.larval_growth_track)
                ? beetle.larval_growth_track
                : null;
              const growthCount = growthTrack?.length ?? 0;

              return (
                <article
                  key={beetle.id}
                  className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 hover:border-gray-700 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <h2 className="text-base font-semibold text-gray-100">{dbBeetleDisplayName(beetle)}</h2>
                      <p className="text-sm text-gray-500">{beetle.species || '—'}</p>
                    </div>
                    <time className="text-[11px] text-gray-600 font-mono">
                      {new Date(beetle.created_at).toLocaleDateString()}
                    </time>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {hasInventory && (
                      <>
                        {counts.l1 > 0 && (
                          <div>
                            <p className="text-gray-600">L1 count</p>
                            <p className="text-gray-200 font-medium tabular-nums">{counts.l1}</p>
                          </div>
                        )}
                        {counts.l2 > 0 && (
                          <div>
                            <p className="text-gray-600">L2 count</p>
                            <p className="text-gray-200 font-medium tabular-nums">{counts.l2}</p>
                          </div>
                        )}
                        {counts.l3 > 0 && (
                          <div>
                            <p className="text-gray-600">L3 count</p>
                            <p className="text-gray-200 font-medium tabular-nums">{counts.l3}</p>
                          </div>
                        )}
                        {counts.adult > 0 && (
                          <div>
                            <p className="text-gray-600">Adult count</p>
                            <p className="text-gray-200 font-medium tabular-nums">{counts.adult}</p>
                          </div>
                        )}
                      </>
                    )}
                    {growthCount > 0 && (
                      <div>
                        <p className="text-gray-600">Growth entries</p>
                        <p className="text-gray-200 font-medium">{growthCount}</p>
                      </div>
                    )}
                    {meta?.status && (
                      <div>
                        <p className="text-gray-600">Status</p>
                        <p className="text-gray-200 font-medium capitalize">{meta.status}</p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
