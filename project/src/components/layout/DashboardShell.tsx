'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Sidebar, MobileMenuButton, pathnameToPage } from '@/components/layout/Sidebar';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { pageToPath } from '@/lib/dashboardRoutes';
import { useBeetleApp } from '@/contexts/BeetleAppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { signOut } from '@/lib/beetles';
import { createClient } from '@/lib/supabase/client';
import type { Page } from '@/components/layout/Sidebar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userEmail, dataError, busy } = useBeetleApp();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPage = pathnameToPage(pathname);

  const handleNavigate = (page: Page) => {
    router.push(pageToPath(page));
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await signOut(supabase);
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <MobileMenuButton onClick={() => setMobileOpen(true)} />
            {userEmail && (
              <p className="text-xs text-gray-500 hidden sm:block truncate">{userEmail}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t('shell.logOut')}
            </button>
          </div>
        </header>

        {(dataError || busy) && (
          <div className="px-4 pt-3 max-w-6xl mx-auto w-full">
            {busy && (
              <p className="text-xs text-sky-400/90 mb-2">{t('common.saving')}</p>
            )}
            {dataError && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  dataError.includes('002_user_breeding_data')
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'border-red-500/40 bg-red-500/10 text-red-300'
                }`}
              >
                {dataError}
              </div>
            )}
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6 max-w-6xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
