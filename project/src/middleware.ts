import { NextResponse, type NextRequest } from 'next/server';

/** Edge-safe env check — do not import Supabase client code here (breaks Vercel Edge build). */
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    '';

  if (!url || !key) return false;
  if (url.includes('your-project') || url.includes('YOUR_PROJECT_REF') || key === 'your-anon-key') {
    return false;
  }
  if (!url.startsWith('https://') || !url.includes('supabase.co')) return false;
  if (key.startsWith('sb_secret_') || key.includes('service_role')) return false;
  if (key.length < 20) return false;

  return true;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!isSupabaseConfigured()) {
    if (pathname.startsWith('/dashboard') || pathname === '/login' || pathname === '/signup') {
      return NextResponse.redirect(new URL('/setup', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/auth/callback'],
};
