import { useEffect, useMemo, useState } from 'react';
import { Pencil, Save, Calculator } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { FormField, TextInput, NumberInput, SelectInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PairingBeetleSelects } from '../components/pairing/PairingBeetleSelects';
import { PairingLifecycleTimeline } from '../components/pairing/PairingLifecycleTimeline';
import type { Beetle, Pairing } from '../types';
import { beetleLabel, pairingEmergeRate, pairingFertilityScore, pairingHatchRate } from '../types';
import type { PairingBeetleSelection } from '@/utils/pairingBeetleFilters';
import {
  buildPairingLifecycle,
  createPairingRecord,
  formatOutcomeCell,
  mergePairingUpdate,
} from '@/utils/pairingLifecycle';
import {
  isPairingOutcomesValid,
  validatePairingOutcomes,
  type PairingOutcomesErrors,
} from '@/utils/pairingOutcomesValidation';

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

const emptyCreateForm = (): Pick<PairingFormState, 'maleBeetleId' | 'femaleBeetleId' | 'pairingDate'> => ({
  maleBeetleId: '',
  femaleBeetleId: '',
  pairingDate: '',
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

function previewPairingFromForm(base: Pairing, form: PairingFormState): Pairing {
  return mergePairingUpdate(base, form);
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
          <Calculator className="w-4 h-4 text-teal-400" />
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
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [saved, setSaved] = useState(false);
  const [editPairingId, setEditPairingId] = useState('');
  const [editForm, setEditForm] = useState<PairingFormState | null>(null);
  const [editSaved, setEditSaved] = useState(false);

  const nextId = `P-${String(pairings.length + 1).padStart(3, '0')}`;
  const editingPairing = pairings.find((pairing) => pairing.id === editPairingId);

  const pairingSelectOptions = pairings.map((pairing) => ({
    value: pairing.id,
    label: `${pairing.id} — ${beetleLabel(beetles, pairing.maleBeetleId)} × ${beetleLabel(beetles, pairing.femaleBeetleId)}`,
  }));

  const editOutcomeErrors = useMemo(
    () => (editForm ? validatePairingOutcomes(editForm) : {}),
    [editForm]
  );

  const canSaveCreate = Boolean(createForm.maleBeetleId && createForm.femaleBeetleId && createForm.pairingDate);
  const canSaveEdit =
    editForm != null &&
    Boolean(editForm.maleBeetleId && editForm.femaleBeetleId && editForm.pairingDate) &&
    isPairingOutcomesValid(editForm);

  const editLifecycle = useMemo(() => {
    if (!editingPairing || !editForm) return [];
    return buildPairingLifecycle(previewPairingFromForm(editingPairing, editForm));
  }, [editingPairing, editForm]);

  useEffect(() => {
    if (!editPairingId) {
      setEditForm(null);
      return;
    }
    const pairing = pairings.find((item) => item.id === editPairingId);
    if (pairing) {
      setEditForm(pairingToForm(pairing));
    }
  }, [editPairingId, pairings]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSaveCreate) return;

    onAdd(
      createPairingRecord(nextId, {
        maleBeetleId: createForm.maleBeetleId,
        femaleBeetleId: createForm.femaleBeetleId,
        pairingDate: createForm.pairingDate,
      })
    );
    setCreateForm(emptyCreateForm());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPairing || !editForm || !canSaveEdit) return;

    onUpdate(mergePairingUpdate(editingPairing, editForm));
    setEditSaved(true);
    setTimeout(() => setEditSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Pairing & Fertility</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Log pairings first, then add breeding outcomes over time like a paper breeding record
        </p>
      </div>

      <form onSubmit={handleCreateSubmit}>
        <Card>
          <CardHeader
            title="New Pairing"
            subtitle={`Record ID: ${nextId} — save now, add eggs and hatch data later`}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PairingBeetleSelects
              beetles={beetles}
              selection={createForm}
              onChange={(selection) => setCreateForm((prev) => ({ ...prev, ...selection }))}
            />

            <FormField label="Pairing Date" required>
              <TextInput
                type="date"
                value={createForm.pairingDate}
                onChange={(v) => setCreateForm((prev) => ({ ...prev, pairingDate: v }))}
                required
              />
            </FormField>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <div>{saved && <Badge variant="success">Pairing saved!</Badge>}</div>
            <Button type="submit" variant="primary" disabled={!canSaveCreate}>
              <Save className="w-4 h-4" />
              Save Pairing
            </Button>
          </div>
        </Card>
      </form>

      {pairings.length > 0 && (
        <Card>
          <CardHeader
            title="Update Breeding Record"
            subtitle="Add or revise outcome counts as your breeding cycle progresses"
          />
          <form onSubmit={handleEditSave}>
            <FormField label="Select pairing">
              <SelectInput
                value={editPairingId}
                onChange={(id) => {
                  setEditPairingId(id);
                  setEditSaved(false);
                }}
                options={pairingSelectOptions}
                placeholder="Choose a pairing to edit…"
              />
            </FormField>

            {editForm && editingPairing && (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                    Breeding Timeline
                  </p>
                  <PairingLifecycleTimeline milestones={editLifecycle} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PairingBeetleSelects
                    beetles={beetles}
                    selection={editForm}
                    onChange={(selection) => setEditForm((prev) => (prev ? { ...prev, ...selection } : prev))}
                  />

                  <FormField label="Pairing Date" required>
                    <TextInput
                      type="date"
                      value={editForm.pairingDate}
                      onChange={(v) => setEditForm((prev) => (prev ? { ...prev, pairingDate: v } : prev))}
                      required
                    />
                  </FormField>

                  <PairingOutcomeFields
                    form={editForm}
                    errors={editOutcomeErrors}
                    onChange={(key, value) =>
                      setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev))
                    }
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <div>{editSaved && <Badge variant="success">Breeding record updated</Badge>}</div>
                  <Button type="submit" variant="primary" disabled={!canSaveEdit}>
                    <Pencil className="w-4 h-4" />
                    Save changes
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Card>
      )}

      {pairings.length > 0 && (
        <Card>
          <CardHeader title="Pairing History" subtitle={`${pairings.length} total`} />
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
                  const lifecycle = buildPairingLifecycle(pairing);
                  return (
                    <tr key={pairing.id} className="border-b border-gray-800/50 align-top">
                      <td className="py-2 text-gray-300">
                        <p>
                          {beetleLabel(beetles, pairing.maleBeetleId)} ×{' '}
                          {beetleLabel(beetles, pairing.femaleBeetleId)}
                        </p>
                        {lifecycle.length > 1 && (
                          <p className="text-[10px] text-gray-600 mt-1">
                            {lifecycle.length - 1} outcome{lifecycle.length - 1 === 1 ? '' : 's'} logged
                          </p>
                        )}
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
