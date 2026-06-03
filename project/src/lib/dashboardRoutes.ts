import type { Page } from '@/components/layout/Sidebar';

export const PAGE_ROUTES: Record<Page, string> = {
  dashboard: '/dashboard',
  'add-beetle': '/dashboard/add-beetle',
  'import-spreadsheet': '/dashboard/import',
  'larval-growth': '/dashboard/larval-growth',
  pairing: '/dashboard/pairing',
  'pest-risk': '/dashboard/pest-risk',
  settings: '/dashboard/settings',
};

export function pathnameToPage(pathname: string): Page {
  const entry = Object.entries(PAGE_ROUTES).find(([, path]) => path === pathname);
  return (entry?.[0] as Page | undefined) ?? 'dashboard';
}

export function pageToPath(page: string): string {
  return PAGE_ROUTES[page as Page] ?? '/dashboard';
}
