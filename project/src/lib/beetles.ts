import type { SupabaseClient } from '@supabase/supabase-js';
import type { Beetle } from '@/types';
import type { DbBeetle } from '@/types/database';
import { beetleToDbInsert } from '@/lib/beetleDbMapper';

export async function fetchUserBeetles(client: SupabaseClient, userId: string): Promise<DbBeetle[]> {
  const { data, error } = await client
    .from('beetles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DbBeetle[];
}

export async function insertBeetlesForUser(
  client: SupabaseClient,
  userId: string,
  beetles: Beetle[]
): Promise<DbBeetle[]> {
  if (beetles.length === 0) return [];

  const rows = beetles.map((beetle) => beetleToDbInsert(beetle, userId));

  const { data, error } = await client.from('beetles').insert(rows).select('*');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DbBeetle[];
}

export async function deleteBeetleForUser(client: SupabaseClient, userId: string, beetleId: string): Promise<void> {
  const { error } = await client.from('beetles').delete().eq('id', beetleId).eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOut(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}
