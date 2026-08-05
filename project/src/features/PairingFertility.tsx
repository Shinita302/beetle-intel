import { useMemo, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { FormField, TextInput, NumberInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PairingBeetleSelects } from '../components/pairing/PairingBeetleSelects';
import type { Beetle, Pairing } from '../types';
import { beetleLabel, pairingEmergeRate, pairingFertilityScore, pairingHatchRate } from '../types';
import type { PairingBeetleSelection } from '@/utils/pairingBeetleFilters';
import { createPairingRecord, formatOutcomeCell, mergePairingUpdate } from '@/utils/pairingLifecycle';
import {
  isPairingOutcomesValid,
  validatePairingOutcomes,
  type PairingOutcomesErrors,
} from '@/utils/pairingOutcomesValidation';
import { useLanguage } from '@/contexts/LanguageContext';

interface PairingFertilityProps {
  beetles: Beetle[];
  pairings: Pairing[];
  onAdd: (pairing: Pairing) => void;
  onUpdate: (pairing: Pairing) => void;
}

type PairingFormState = PairingBeetleSelection & {
  pairingDate: string;
  eggsProduced: number;
  hatched: number;
  emerged: number;
};

const emptyForm = (): PairingFormState => ({
  maleBeetleId: '',
  femaleBeetleId: '',
  pairingDate: '',
  eggsProduced: 0,
  hatched: 0,
  emerged: 0,
});

function pairingToForm(pairing: Pairing): PairingFormState {
  return {
    maleBeetleId: pairing.maleBeetleId,
    femaleBeetleId: pairing.femaleBeetleId,
    pairingDate: pairing.pairingDate,
    eggsProduced: pairing.eggsProduced,
    hatched: pairing.hatched,
    emerged: pairing.emerged,
  };
}

function scoreVariant(score: number) {
  if (score >= 60) return 'success' as const;
  if (score >= 30) return 'warning' as const;
  return 'danger' as const;
}

function PairingOutcomeFields({
  form,
  errors,
  onChange,
}: {
  form: Pick<PairingFormState, 'eggsProduced' | 'hatched' | 'emerged'>;
  errors: PairingOutcomesErrors;
  onChange: <K extends 'eggsProduced' | 'hatched' | 'emerged'>(key: K, value: PairingFormState[K]) => void;
}) {
  const outcomesValid = isPairingOutcomesValid(form);
  const hasOutcomeData = form.eggsProduced > 0 || form.hatched > 0 || form.emerged > 0;

  const calculations = useMemo(() => {
    const draft: Pairing = {
      id: '',
      maleBeetleId: '',
      femaleBeetleId: '',
      pairingDate: '',
      eggsProduced: form.eggsProduced,
      hatched: form.hatched,
      emerged: form.emerged,
      createdAt: '',
    };
    return {
      hatchRate: pairingHatchRate(draft),
      emergeRate: pairingEmergeRate(draft),
      fertilityScore: pairingFertilityScore(draft),
    };
  }, [form.eggsProduced, form.hatched, form.emerged]);

  return (
    <>
      <div className="md:col-span-2 border-t border-gray-800 pt-4 mt-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Breeding Outcomes</span>
        </div>
        <p className="text-[11px] text-gray-500 mb-4">
          Optional — add eggs, hatch, and emerge counts whenever they become available.
        </p>
      </div>

      <FormField label="Eggs Produced" error={errors.eggsProduced}>
        <NumberInput
          value={form.eggsProduced}
          onChange={(v) => onChange('eggsProduced', v)}
          min={0}
          step={1}
        />
      </FormField>

      <FormField label="Hatched" error={errors.hatched}>
        <NumberInput value={form.hatched} onChange={(v) => onChange('hatched', v)} min={0} step={1} />
      </FormField>

      <FormField label="Emerged" error={errors.emerged}>
        <NumberInput value={form.emerged} onChange={(v) => onChange('emerged', v)} min={0} step={1} />
      </FormField>

      {outcomesValid && hasOutcomeData && (
        <div className="md:col-span-2 mt-2 p-4 rounded-lg bg-gray-800/50 border border-gray-700/50">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Hatch Rate</p>
              <p className="text-lg font-bold text-sky-400">
                {form.eggsProduced > 0 ? `${calculations.hatchRate}%` : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Emerge Rate</p>
              <p className="text-lg font-bold text-emerald-400">
                {form.hatched > 0 ? `${calculations.emergeRate}%` : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Fertility</p>
              {form.eggsProduced > 0 ? (
                <Badge variant={scoreVariant(calculations.fertilityScore)} className="text-base px-3 py-1">
                  {calculations.fertilityScore}
                </Badge>
              ) : (
                <p className="text-lg font-bold text-gray-500">—</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PairingFertility({ beetles, pairings, onAdd, onUpdate }: PairingFertilityProps) {
  const { t } = useLanguage();
  const [activePairingId, setActivePairingId] = useState<string | null>(null);
  const [form, setForm] = useState<PairingFormState>(emptyForm);
  const [saved, setSaved] = useState(false);

  const isEditing = activePairingId != null;
  const activePairing = pairings.find((pairing) => pairing.id === activePairingId);
  const nextId = `P-${String(pairings.length + 1).padStart(3, '0')}`;

  const outcomeErrors = useMemo(() => validatePairingOutcomes(form), [form]);

  const canSave = isEditing
    ? Boolean(activePairing && form.maleBeetleId && form.femaleBeetleId && form.pairingDate) &&
      isPairingOutcomesValid(form)
    : Boolean(form.maleBeetleId && form.femaleBeetleId && form.pairingDate);

  const startNewPairing = () => {
    setActivePairingId(null);
    setForm(emptyForm());
    setSaved(false);
  };

  const openPairingForEdit = (pairing: Pairing) => {
    setActivePairingId(pairing.id);
    setForm(pairingToForm(pairing));
    setSaved(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    if (isEditing && activePairing) {
      onUpdate(mergePairingUpdate(activePairing, form));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }

    const created = createPairingRecord(nextId, {
      maleBeetleId: form.maleBeetleId,
      femaleBeetleId: form.femaleBeetleId,
      pairingDate: form.pairingDate,
    });
    onAdd(created);
    setActivePairingId(created.id);
    setForm(pairingToForm(created));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-100">{t('pages.pairingTitle')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('pages.pairingSubtitle')}</p>
        </div>
        {isEditing && (
          <Button type="button" variant="secondary" size="sm" onClick={startNewPairing}>
            <Plus className="w-4 h-4" />
            New pairing
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader
            title={isEditing ? 'Breeding Record' : 'New Pairing'}
            subtitle={
              isEditing
                ? `${activePairingId} — update outcomes as your breeding cycle progresses`
                : `${nextId} — male, female, and pairing date only`
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PairingBeetleSelects
              beetles={beetles}
              selection={form}
              onChange={(selection) => setForm((prev) => ({ ...prev, ...selection }))}
            />

            <FormField label={t('pairing.pairingDate')} required>
              <TextInput
                type="date"
                value={form.pairingDate}
                onChange={(v) => setForm((prev) => ({ ...prev, pairingDate: v }))}
                required
              />
            </FormField>

            {isEditing && (
              <PairingOutcomeFields
                form={form}
                errors={outcomeErrors}
                onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
              />
            )}
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <div>
              {saved && (
                <Badge variant="success">{isEditing ? 'Record updated' : 'Pairing saved'}</Badge>
              )}
            </div>
            <Button type="submit" variant="primary" disabled={!canSave}>
              <Save className="w-4 h-4" />
              {isEditing ? 'Save changes' : t('pairing.savePairing')}
            </Button>
          </div>
        </Card>
      </form>

      {pairings.length > 0 && (
        <Card>
          <CardHeader
            title="Pairing History"
            subtitle="Select a record to continue adding breeding outcomes"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 text-gray-500 font-medium">Pair</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Paired</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Eggs</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Hatched</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Emerged</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {pairings.slice(-10).reverse().map((pairing) => {
                  const score = pairingFertilityScore(pairing);
                  const isActive = pairing.id === activePairingId;
                  return (
                    <tr
                      key={pairing.id}
                      onClick={() => openPairingForEdit(pairing)}
                      className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                        isActive ? 'bg-sky-500/10' : 'hover:bg-gray-800/40'
                      }`}
                    >
                      <td className="py-2 text-gray-300">
                        <p className="font-medium">
                          {beetleLabel(beetles, pairing.maleBeetleId)} ×{' '}
                          {beetleLabel(beetles, pairing.femaleBeetleId)}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{pairing.id}</p>
                      </td>
                      <td className="py-2 text-gray-500">{pairing.pairingDate || '—'}</td>
                      <td className="py-2 text-right text-gray-400">{formatOutcomeCell(pairing.eggsProduced)}</td>
                      <td className="py-2 text-right text-gray-400">{formatOutcomeCell(pairing.hatched)}</td>
                      <td className="py-2 text-right text-emerald-400 font-medium">
                        {formatOutcomeCell(pairing.emerged)}
                      </td>
                      <td className="py-2 text-right">
                        {pairing.eggsProduced > 0 ? (
                          <Badge variant={scoreVariant(score)}>{score}</Badge>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
