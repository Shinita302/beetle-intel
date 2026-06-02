/** True when real Supabase credentials are present (not placeholders). */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  if (!url || !key) return false;
  if (url.includes('your-project') || url.includes('YOUR_PROJECT_REF') || key === 'your-anon-key') {
    return false;
  }
  if (!url.startsWith('https://') || !url.includes('supabase')) return false;
  if (key.length < 20) return false;
  const validKey =
    key.startsWith('eyJ') || key.startsWith('sb_publishable_') || key.startsWith('sbp_');
  if (!validKey) return false;

  return true;
}

export const SUPABASE_SETUP_MESSAGE =
  'Missing Supabase credentials. Copy .env.example to .env.local and add your project URL and anon key.';
