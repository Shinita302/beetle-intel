'use client';

import { GrowthLogPanel } from '../components/larval/GrowthLogPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Beetle, GrowthEntry } from '../types';

interface LarvalGrowthProps {
  beetles: Beetle[];
  growthEntries: GrowthEntry[];
  onAdd: (entry: GrowthEntry) => void;
  onUpdate: (entry: GrowthEntry) => void;
  onDelete: (id: string) => void;
}

export function LarvalGrowth({ beetles, growthEntries, onAdd, onUpdate, onDelete }: LarvalGrowthProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">{t('pages.growthTitle')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('pages.growthSubtitle')}</p>
      </div>

      <GrowthLogPanel
        beetles={beetles}
        growthEntries={growthEntries}
        onAddEntry={onAdd}
        onUpdateEntry={onUpdate}
        onDeleteEntry={onDelete}
      />
    </div>
  );
}
