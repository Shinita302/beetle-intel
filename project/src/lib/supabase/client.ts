import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
  SUPABASE_SETUP_MESSAGE,
} from '@/lib/supabase/config';

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(SUPABASE_SETUP_MESSAGE);
  }

  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
