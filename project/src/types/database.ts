import type { BeetleInventoryCounts, BeetleStageNotes } from '@/types';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface DbBeetle {
  id: string;
  user_id: string;
  species: string;
  inventory_counts: Json;
  larval_growth_track: Json | null;
  notes: string | null;
  created_at: string;
}

export interface DbBeetleInsert {
  user_id: string;
  species: string;
  inventory_counts: Json;
  larval_growth_track: Json | null;
  notes?: string | null;
}

export interface BeetleProfileMeta {
  name: string;
  sex?: string;
  status?: string;
  generation?: string;
  stageNotes?: BeetleStageNotes;
  source?: string;
  emergenceDate?: string;
  bloodline?: string;
  fatherParent?: string;
  motherParent?: string;
  isBigHitter?: boolean;
  adultSize?: number;
  adultWeight?: number;
}

export function parseInventoryCounts(json: Json): BeetleInventoryCounts {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const o = json as Record<string, unknown>;
    return {
      egg: Number(o.egg) || 0,
      l1: Number(o.l1) || 0,
      l2: Number(o.l2) || 0,
      l3: Number(o.l3) || 0,
      pupa: Number(o.pupa) || 0,
      adult: Number(o.adult) || 0,
    };
  }
  return { egg: 0, l1: 0, l2: 0, l3: 0, pupa: 0, adult: 0 };
}

export interface Database {
  public: {
    Tables: {
      beetles: {
        Row: DbBeetle;
        Insert: DbBeetleInsert;
        Update: Partial<Omit<DbBeetleInsert, 'user_id'>>;
        Relationships: [
          {
            foreignKeyName: 'beetles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
