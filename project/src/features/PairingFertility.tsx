import { useEffect, useMemo, useState } from 'react';
import { Pencil, Save, Calculator } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { FormField, TextInput, NumberInput, SelectInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PairingBeetleSelects } from '../components/pairing/PairingBeetleSelects';
import type { Beetle, Pairing } from '../types';
import { beetleLabel, pairingEmergeRate, pairingFertilityScore, pairingHatchRate } from '../types';
import type { PairingBeetleSelection } from '@/utils/pairingBeetleFilters';
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
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Outcomes</span>
        </div>
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

      {outcomesValid && (form.eggsProduced > 0 || form.hatched > 0) && (
        <div className="md:col-span-2 mt-2 p-4 rounded-lg bg-gray-800/50 border border-gray-700/50">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Hatch Rate</p>
              <p className="text-lg font-bold text-sky-400">{calculations.hatchRate}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Emerge Rate</p>
              <p className="text-lg font-bold text-emerald-400">{calculations.emergeRate}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Fertility</p>
              <Badge variant={scoreVariant(calculations.fertilityScore)} className="text-base px-3 py-1">
                {calculations.fertilityScore}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PairingFertility({ beetles, pairings, onAdd, onUpdate }: PairingFertilityProps) {
  const [form, setForm] = useState<PairingFormState>(emptyForm);
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

  const formOutcomeErrors = useMemo(
    () => validatePairingOutcomes(form),
    [form.eggsProduced, form.hatched, form.emerged]
  );
  const editOutcomeErrors = useMemo(
    () => (editForm ? validatePairingOutcomes(editForm) : {}),
    [editForm]
  );

  const canSaveCreate =
    Boolean(form.maleBeetleId && form.femaleBeetleId) && isPairingOutcomesValid(form);
  const canSaveEdit =
    editForm != null &&
    Boolean(editForm.maleBeetleId && editForm.femaleBeetleId) &&
    isPairingOutcomesValid(editForm);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSaveCreate) return;

    const pairing: Pairing = {
      id: nextId,
      maleBeetleId: form.maleBeetleId,
      femaleBeetleId: form.femaleBeetleId,
      pairingDate: form.pairingDate,
      eggsProduced: form.eggsProduced,
      hatched: form.hatched,
      emerged: form.emerged,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onAdd(pairing);
    setForm(emptyForm());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPairing || !editForm || !canSaveEdit) return;

    onUpdate({
      ...editingPairing,
      maleBeetleId: editForm.maleBeetleId,
      femaleBeetleId: editForm.femaleBeetleId,
      pairingDate: editForm.pairingDate,
      eggsProduced: editForm.eggsProduced,
      hatched: editForm.hatched,
      emerged: editForm.emerged,
    });
    setEditSaved(true);
    setTimeout(() => setEditSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Pairing & Fertility</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track breeding pairs and lineage outcomes</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader title="Pairing Record" subtitle={`Record ID: ${nextId}`} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PairingBeetleSelects
              beetles={beetles}
              selection={form}
              onChange={(selection) => setForm((prev) => ({ ...prev, ...selection }))}
            />

            <FormField label="Pairing Date">
              <TextInput type="date" value={form.pairingDate} onChange={(v) => setForm((prev) => ({ ...prev, pairingDate: v }))} />
            </FormField>

            <PairingOutcomeFields
              form={form}
              errors={formOutcomeErrors}
              onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
            />
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
          <CardHeader title="Edit Pairing" subtitle="Update an existing pairing record" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PairingBeetleSelects
                    beetles={beetles}
                    selection={editForm}
                    onChange={(selection) => setEditForm((prev) => (prev ? { ...prev, ...selection } : prev))}
                  />

                  <FormField label="Pairing Date">
                    <TextInput
                      type="date"
                      value={editForm.pairingDate}
                      onChange={(v) => setEditForm((prev) => (prev ? { ...prev, pairingDate: v } : prev))}
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
                  <div>{editSaved && <Badge variant="success">Pairing updated</Badge>}</div>
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
                  <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Eggs</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Hatched</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Emerged</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {pairings.slice(-10).reverse().map((pairing) => {
                  const score = pairingFertilityScore(pairing);
                  return (
                    <tr key={pairing.id} className="border-b border-gray-800/50">
                      <td className="py-2 text-gray-300">
                        {beetleLabel(beetles, pairing.maleBeetleId)} × {beetleLabel(beetles, pairing.femaleBeetleId)}
                      </td>
                      <td className="py-2 text-gray-500">{pairing.pairingDate}</td>
                      <td className="py-2 text-right text-gray-400">{pairing.eggsProduced}</td>
                      <td className="py-2 text-right text-gray-400">{pairing.hatched}</td>
                      <td className="py-2 text-right text-emerald-400 font-medium">{pairing.emerged}</td>
                      <td className="py-2 text-right">
                        <Badge variant={scoreVariant(score)}>{score}</Badge>
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
