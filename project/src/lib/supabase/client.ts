import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from '@/lib/supabase/config';

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(SUPABASE_SETUP_MESSAGE);
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
