import type { Json } from './database-json';
import type { BeetleOrigin, LarvalInstar } from './index';

export type { Json };

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

export interface DbUserBreedingData {
  user_id: string;
  growth_entries: Json;
  species_inventory: Json;
  pairings: Json;
  pest_risks: Json;
  updated_at: string;
}

export interface BeetleProfileMeta {
  name: string;
  sex?: string;
  status?: string;
  generation?: string;
  origin?: BeetleOrigin | '';
  instarStage?: LarvalInstar;
  sizeMm?: number;
  color?: string;
  notes?: string;
  source?: string;
  bloodline?: string;
}

/** Legacy inventory blob — migrated to SpeciesInventory on load. */
export interface LegacyBeetleInventoryCounts {
  egg: number;
  l1: number;
  l2: number;
  l3: number;
  pupa: number;
  adult: number;
}

export function parseLegacyInventoryCounts(json: Json): LegacyBeetleInventoryCounts {
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
      user_breeding_data: {
        Row: DbUserBreedingData;
        Insert: {
          user_id: string;
          growth_entries?: Json;
          species_inventory?: Json;
          pairings?: Json;
          pest_risks?: Json;
          updated_at?: string;
        };
        Update: Partial<Omit<DbUserBreedingData, 'user_id'>>;
        Relationships: [
          {
            foreignKeyName: 'user_breeding_data_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
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
