'use client';

import Link from 'next/link';
import {
  LayoutDashboard,
  Bug,
  Sprout,
  HeartHandshake,
  ShieldAlert,
  FileSpreadsheet,
  Settings,
  Menu,
  X,
  Package,
} from 'lucide-react';
import { PAGE_ROUTES, pathnameToPage } from '@/lib/dashboardRoutes';
import { useLanguage } from '@/contexts/LanguageContext';

export { pathnameToPage };

export type Page =
  | 'dashboard'
  | 'add-beetle'
  | 'inventory'
  | 'import-spreadsheet'
  | 'larval-growth'
  | 'pairing'
  | 'pest-risk'
  | 'settings';

const navItems: { id: Page; labelKey: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'add-beetle', labelKey: 'nav.addBeetle', icon: Bug },
  { id: 'inventory', labelKey: 'nav.inventory', icon: Package },
  { id: 'import-spreadsheet', labelKey: 'nav.importSpreadsheet', icon: FileSpreadsheet },
  { id: 'larval-growth', labelKey: 'nav.larvalGrowth', icon: Sprout },
  { id: 'pairing', labelKey: 'nav.pairing', icon: HeartHandshake },
  { id: 'pest-risk', labelKey: 'nav.pestRisk', icon: ShieldAlert },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings },
];

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ currentPage, onNavigate, mobileOpen, onCloseMobile }: SidebarProps) {
  const { t } = useLanguage();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-gray-950 border-r border-gray-800 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-teal-500 rounded-lg flex items-center justify-center">
              <Bug className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-100 tracking-tight">{t('brand.name')}</h1>
              <p className="text-[10px] text-gray-500 font-medium">{t('brand.tagline')}</p>
            </div>
          </div>
          <button className="lg:hidden text-gray-500 hover:text-gray-300" onClick={onCloseMobile}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = currentPage === item.id;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={PAGE_ROUTES[item.id]}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-gray-800">
          <p className="text-[10px] text-gray-600">v1.1</p>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="lg:hidden p-2 text-gray-400 hover:text-gray-200 transition-colors"
      onClick={onClick}
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
