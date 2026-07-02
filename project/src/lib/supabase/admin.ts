import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getSupabaseUrl } from '@/lib/supabase/config';

export function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
}

export function isAccountDeletionConfigured(): boolean {
  const key = getSupabaseServiceRoleKey();
  return Boolean(getSupabaseUrl() && key && key.length > 20);
}

export function createAdminClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error(
      'Account deletion is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.'
    );
  }

  return createClient<Database>(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
