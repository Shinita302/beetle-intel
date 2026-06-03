/** Project API origin only — strips mistaken /auth/v1 suffixes from dashboard copy-paste. */
export function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return raw.replace(/\/auth\/v1\/?$/i, '').replace(/\/+$/, '');
  }
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
}

/** True when real Supabase credentials are present (not placeholders). */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) return false;
  if (url.includes('your-project') || url.includes('YOUR_PROJECT_REF') || key === 'your-anon-key') {
    return false;
  }
  if (!url.startsWith('https://') || !url.includes('supabase.co')) return false;
  if (key.startsWith('sb_secret_') || key.includes('service_role')) return false;
  if (key.length < 20) return false;
  const validKey =
    key.startsWith('eyJ') ||
    key.startsWith('sb_publishable_') ||
    key.startsWith('sbp_') ||
    key.startsWith('sb_');
  if (!validKey) return false;

  return true;
}

export const SUPABASE_SETUP_MESSAGE =
  'Missing Supabase credentials. Copy .env.example to .env.local and add your project URL and anon key.';
