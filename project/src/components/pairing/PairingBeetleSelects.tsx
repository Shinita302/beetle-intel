import { useMemo } from 'react';
import { FormField } from '../ui/FormField';
import type { Beetle } from '@/types';
import { beetleLabel, beetleProfileDetails } from '@/types';
import {
  filterFemalesForPairing,
  filterMalesForPairing,
  reconcilePairingBeetleSelection,
  type PairingBeetleSelection,
} from '@/utils/pairingBeetleFilters';
import { useLanguage } from '@/contexts/LanguageContext';

const selectClassName =
  'w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-colors appearance-none';

interface PairingBeetleSelectsProps {
  beetles: Beetle[];
  selection: PairingBeetleSelection;
  onChange: (selection: PairingBeetleSelection) => void;
}

function beetleOptionLabel(beetles: Beetle[], beetle: Beetle): string {
  const details = beetleProfileDetails(beetle);
  const label = beetleLabel(beetles, beetle.id);
  return details ? `${label} · ${details}` : label;
}

export function PairingBeetleSelects({ beetles, selection, onChange }: PairingBeetleSelectsProps) {
  const { t } = useLanguage();
  const eligibleMales = useMemo(
    () => filterMalesForPairing(beetles, selection.femaleBeetleId),
    [beetles, selection.femaleBeetleId]
  );
  const eligibleFemales = useMemo(
    () => filterFemalesForPairing(beetles, selection.maleBeetleId),
    [beetles, selection.maleBeetleId]
  );

  const handleMaleChange = (maleBeetleId: string) => {
    onChange(reconcilePairingBeetleSelection(selection, beetles, 'maleBeetleId', maleBeetleId));
  };

  const handleFemaleChange = (femaleBeetleId: string) => {
    onChange(reconcilePairingBeetleSelection(selection, beetles, 'femaleBeetleId', femaleBeetleId));
  };

  return (
    <>
      <FormField label={t('pairing.male')} required>
        <select
          value={selection.maleBeetleId}
          onChange={(e) => handleMaleChange(e.target.value)}
          required
          className={selectClassName}
        >
          <option value="" disabled>
            {selection.femaleBeetleId && eligibleMales.length === 0
              ? 'No males of this species'
              : t('pairing.selectMale')}
          </option>
          {eligibleMales.map((beetle) => (
            <option key={beetle.id} value={beetle.id}>
              {beetleOptionLabel(beetles, beetle)}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label={t('pairing.female')} required>
        <select
          value={selection.femaleBeetleId}
          onChange={(e) => handleFemaleChange(e.target.value)}
          required
          className={selectClassName}
        >
          <option value="" disabled>
            {selection.maleBeetleId && eligibleFemales.length === 0
              ? 'No females of this species'
              : t('pairing.selectFemale')}
          </option>
          {eligibleFemales.map((beetle) => (
            <option key={beetle.id} value={beetle.id}>
              {beetleOptionLabel(beetles, beetle)}
            </option>
          ))}
        </select>
      </FormField>
    </>
  );
}
