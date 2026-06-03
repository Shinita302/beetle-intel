import { useEffect, useState } from 'react';
import { Pencil, Save, Star } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { FormField, TextInput, SelectInput, NumberInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { Beetle, BeetleInstarWeights, BeetleSex, BeetleStageNotes, BeetleStatus } from '../types';
import {
  emptyInstarWeights,
  emptyInventoryCounts,
  emptyStageNotes,
  latestInstarWeight,
} from '../types';
import type { BeetleInventoryCounts } from '../types';

interface AddBeetleProps {
  beetles: Beetle[];
  onAdd: (beetle: Beetle) => void | Promise<void>;
  onUpdate: (beetle: Beetle) => void | Promise<void>;
}

const statusOptions: { value: BeetleStatus; label: string }[] = [
  { value: 'larva', label: 'Larva' },
  { value: 'pupa', label: 'Pupa' },
  { value: 'adult', label: 'Adult' },
  { value: 'dead', label: 'Dead' },
  { value: 'sold', label: 'Sold' },
];

const sexOptions: { value: BeetleSex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unknown', label: 'Unknown / Unsexed' },
];

const emptyForm = {
  name: '',
  species: '',
  sex: '' as '' | BeetleSex,
  source: '',
  generation: '',
  emergenceDate: '',
  instarWeights: emptyInstarWeights(),
  inventoryCounts: emptyInventoryCounts(),
  adultSize: 0,
  adultWeight: 0,
  bloodline: '',
  stageNotes: emptyStageNotes(),
  fatherParent: '',
  motherParent: '',
  status: 'larva' as BeetleStatus,
  isBigHitter: false,
};

type FormState = typeof emptyForm;
type FormErrors = Partial<Record<'name' | 'sex', string>>;

function formatParentPair(father: string, mother: string): string {
  if (!father && !mother) return '—';
  if (father && mother) return `${father} × ${mother}`;
  return father || mother;
}

function sexLabel(sex: BeetleSex): string {
  if (sex === 'unknown') return 'Unsexed';
  return sex.charAt(0).toUpperCase() + sex.slice(1);
}

function sexBadgeVariant(sex: BeetleSex): 'info' | 'neutral' | 'warning' {
  if (sex === 'male') return 'info';
  if (sex === 'female') return 'neutral';
  return 'warning';
}

const larvalInstarFields: { key: keyof BeetleInstarWeights; label: string }[] = [
  { key: 'l1', label: 'L1' },
  { key: 'l2', label: 'L2' },
  { key: 'l3', label: 'L3' },
];

const inventoryFields: { key: keyof BeetleInventoryCounts; label: string }[] = [
  { key: 'egg', label: 'Egg' },
  { key: 'l1', label: 'L1' },
  { key: 'l2', label: 'L2' },
  { key: 'l3', label: 'L3' },
  { key: 'pupa', label: 'Pupa' },
  { key: 'adult', label: 'Adult' },
];

function hasStageNotes(notes: BeetleStageNotes): boolean {
  return Boolean(notes.egg || notes.l1 || notes.l2 || notes.l3 || notes.pupa || notes.adult);
}

function beetleToForm(beetle: Beetle): FormState {
  return {
    name: beetle.name,
    species: beetle.species,
    sex: beetle.sex,
    source: beetle.source,
    generation: beetle.generation,
    emergenceDate: beetle.emergenceDate,
    instarWeights: { ...beetle.instarWeights },
    inventoryCounts: { ...beetle.inventoryCounts },
    adultSize: beetle.adultSize,
    adultWeight: beetle.adultWeight,
    bloodline: beetle.bloodline,
    stageNotes: { ...beetle.stageNotes },
    fatherParent: beetle.fatherParent,
    motherParent: beetle.motherParent,
    status: beetle.status,
    isBigHitter: beetle.isBigHitter,
  };
}

function formatStageNotesPreview(notes: BeetleStageNotes, weights: BeetleInstarWeights): string {
  return larvalInstarFields
    .map(({ key, label }) => {
      const parts: string[] = [];
      if (weights[key] > 0) parts.push(`${weights[key]} g`);
      if (notes[key].trim()) parts.push(notes[key].trim());
      return parts.length ? `${label}: ${parts.join(' — ')}` : '';
    })
    .filter(Boolean)
    .concat(notes.adult.trim() ? [`Adult: ${notes.adult.trim()}`] : [])
    .join(' · ');
}

export function AddBeetle({ beetles, onAdd, onUpdate }: AddBeetleProps) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saved, setSaved] = useState(false);
  const [editBeetleId, setEditBeetleId] = useState('');
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [editSaved, setEditSaved] = useState(false);

  const nextId = `B-${String(beetles.length + 1).padStart(3, '0')}`;
  const isAdult = form.status === 'adult';

  const maleBeetleOptions = beetles
    .filter((b) => b.sex === 'male')
    .map((b) => ({ value: b.id, label: `${b.id} — ${b.name}` }));

  const femaleBeetleOptions = beetles
    .filter((b) => b.sex === 'female')
    .map((b) => ({ value: b.id, label: `${b.id} — ${b.name}` }));

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!form.name.trim()) {
      next.name = 'Beetle name is required.';
    }
    if (!form.sex) {
      next.sex = 'Sex is required.';
    }
    return next;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const beetle: Beetle = {
      id: nextId,
      name: form.name.trim(),
      species: form.species.trim(),
      sex: form.sex as BeetleSex,
      source: form.source.trim(),
      generation: form.generation.trim(),
      emergenceDate: isAdult ? form.emergenceDate : '',
      instarWeights: { ...form.instarWeights },
      inventoryCounts: { ...form.inventoryCounts },
      larvalWeight: latestInstarWeight(form.instarWeights),
      adultSize: isAdult ? form.adultSize : 0,
      adultWeight: isAdult ? form.adultWeight : 0,
      bloodline: form.bloodline.trim(),
      stageNotes: {
        egg: form.stageNotes.egg.trim(),
        l1: form.stageNotes.l1.trim(),
        l2: form.stageNotes.l2.trim(),
        l3: form.stageNotes.l3.trim(),
        pupa: form.stageNotes.pupa.trim(),
        adult: form.stageNotes.adult.trim(),
      },
      fatherParent: form.fatherParent.trim(),
      motherParent: form.motherParent.trim(),
      status: form.status,
      isBigHitter: form.isBigHitter,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    onAdd(beetle);
    setForm(emptyForm);
    setErrors({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'name' && errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
    if (key === 'sex' && errors.sex) {
      setErrors((prev) => ({ ...prev, sex: undefined }));
    }
  };

  const updateStageNote = (key: keyof BeetleStageNotes, value: string) => {
    setForm((prev) => ({
      ...prev,
      stageNotes: { ...prev.stageNotes, [key]: value },
    }));
  };

  const updateInstarWeight = (key: keyof BeetleInstarWeights, value: number) => {
    setForm((prev) => ({
      ...prev,
      instarWeights: { ...prev.instarWeights, [key]: value },
    }));
  };

  const updateInventoryCount = (key: keyof BeetleInventoryCounts, value: number) => {
    setForm((prev) => ({
      ...prev,
      inventoryCounts: { ...prev.inventoryCounts, [key]: value },
    }));
  };

  const editingBeetle = beetles.find((b) => b.id === editBeetleId);

  useEffect(() => {
    if (!editBeetleId) {
      setEditForm(null);
      return;
    }
    const beetle = beetles.find((b) => b.id === editBeetleId);
    if (beetle) {
      setEditForm(beetleToForm(beetle));
    }
  }, [editBeetleId]);

  const beetleSelectOptions = beetles.map((b) => ({
    value: b.id,
    label: `${b.id} — ${b.name}`,
  }));

  const updateEdit = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (key === 'name' && editErrors.name) {
      setEditErrors((prev) => ({ ...prev, name: undefined }));
    }
    if (key === 'sex' && editErrors.sex) {
      setEditErrors((prev) => ({ ...prev, sex: undefined }));
    }
  };

  const validateEdit = (): FormErrors => {
    if (!editForm) return {};
    const next: FormErrors = {};
    if (!editForm.name.trim()) {
      next.name = 'Beetle name is required.';
    }
    if (!editForm.sex) {
      next.sex = 'Sex is required.';
    }
    return next;
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBeetle || !editForm) return;

    const validationErrors = validateEdit();
    if (Object.keys(validationErrors).length > 0) {
      setEditErrors(validationErrors);
      return;
    }

    const isAdultEdit = editForm.status === 'adult';
    const updated: Beetle = {
      ...editingBeetle,
      name: editForm.name.trim(),
      species: editForm.species.trim(),
      sex: editForm.sex as BeetleSex,
      source: editForm.source.trim(),
      generation: editForm.generation.trim(),
      fatherParent: editForm.fatherParent.trim(),
      motherParent: editForm.motherParent.trim(),
      instarWeights: { ...editForm.instarWeights },
      inventoryCounts: { ...editForm.inventoryCounts },
      larvalWeight: latestInstarWeight(editForm.instarWeights),
      stageNotes: {
        egg: editForm.stageNotes.egg.trim(),
        l1: editForm.stageNotes.l1.trim(),
        l2: editForm.stageNotes.l2.trim(),
        l3: editForm.stageNotes.l3.trim(),
        pupa: editForm.stageNotes.pupa.trim(),
        adult: editForm.stageNotes.adult.trim(),
      },
      emergenceDate: isAdultEdit ? editForm.emergenceDate : '',
      adultSize: isAdultEdit ? editForm.adultSize : 0,
      adultWeight: isAdultEdit ? editForm.adultWeight : 0,
      bloodline: editForm.bloodline.trim(),
      status: editForm.status,
      isBigHitter: editForm.isBigHitter,
    };

    onUpdate(updated);
    setEditErrors({});
    setEditSaved(true);
    setTimeout(() => setEditSaved(false), 2000);
  };

  const pickEditParentFromBeetle = (beetleId: string, role: 'father' | 'mother') => {
    const beetle = beetles.find((b) => b.id === beetleId);
    if (!beetle) return;
    const label = `${beetle.id} — ${beetle.name}`;
    if (role === 'father') {
      updateEdit('fatherParent', label);
    } else {
      updateEdit('motherParent', label);
    }
  };

  const updateEditStageNote = (key: keyof BeetleStageNotes, value: string) => {
    setEditForm((prev) =>
      prev ? { ...prev, stageNotes: { ...prev.stageNotes, [key]: value } } : prev
    );
  };

  const updateEditInstarWeight = (key: keyof BeetleInstarWeights, value: number) => {
    setEditForm((prev) =>
      prev ? { ...prev, instarWeights: { ...prev.instarWeights, [key]: value } } : prev
    );
  };

  const updateEditInventoryCount = (key: keyof BeetleInventoryCounts, value: number) => {
    setEditForm((prev) =>
      prev ? { ...prev, inventoryCounts: { ...prev.inventoryCounts, [key]: value } } : prev
    );
  };

  const pickParentFromBeetle = (beetleId: string, role: 'father' | 'mother') => {
    const beetle = beetles.find((b) => b.id === beetleId);
    if (!beetle) return;
    const label = `${beetle.id} — ${beetle.name}`;
    if (role === 'father') {
      update('fatherParent', label);
    } else {
      update('motherParent', label);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Add Beetle</h1>
        <p className="text-sm text-gray-500 mt-0.5">Register a new beetle into your breeding program</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardHeader title="Beetle Profile" subtitle={`ID: ${nextId}`} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Beetle Name" required error={errors.name}>
              <TextInput
                value={form.name}
                onChange={(v) => update('name', v)}
                placeholder="e.g. Titan"
                invalid={Boolean(errors.name)}
              />
            </FormField>

            <FormField label="Species">
              <TextInput
                value={form.species}
                onChange={(v) => update('species', v)}
                placeholder="e.g. Dorcus titanus palawanicus"
              />
            </FormField>

            <FormField label="Sex" required error={errors.sex}>
              <SelectInput
                value={form.sex}
                onChange={(v) => update('sex', v as BeetleSex)}
                options={sexOptions}
                placeholder="Select sex…"
                invalid={Boolean(errors.sex)}
              />
            </FormField>

            <FormField label="Source / Seller">
              <TextInput value={form.source} onChange={(v) => update('source', v)} placeholder="e.g. BeetleKing JP" />
            </FormField>

            <FormField label="Generation">
              <TextInput
                value={form.generation}
                onChange={(v) => update('generation', v)}
                placeholder="e.g. F1, F2, F10+, CB, WC"
              />
            </FormField>

            <FormField label="Status">
              <SelectInput
                value={form.status}
                onChange={(v) => update('status', v as BeetleStatus)}
                options={statusOptions}
              />
            </FormField>

            {isAdult && (
              <>
                <FormField
                  label="Emergence Date"
                  hint="Date when the beetle emerged from pupa to adult."
                >
                  <TextInput
                    type="date"
                    value={form.emergenceDate}
                    onChange={(v) => update('emergenceDate', v)}
                  />
                </FormField>

                <FormField label="Adult Size (mm)">
                  <NumberInput value={form.adultSize} onChange={(v) => update('adultSize', v)} step={1} min={0} />
                </FormField>

                <FormField label="Adult Weight (g)">
                  <NumberInput value={form.adultWeight} onChange={(v) => update('adultWeight', v)} step={0.5} min={0} />
                </FormField>
              </>
            )}

            <FormField label="Bloodline" className="md:col-span-2">
              <TextInput value={form.bloodline} onChange={(v) => update('bloodline', v)} placeholder="e.g. Gold Ridge" />
            </FormField>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-gray-200 mb-1">Parent Pair</h3>
            <p className="text-xs text-gray-500 mb-4">Record the male and female parents for this beetle.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Father / Male Parent">
                {maleBeetleOptions.length > 0 && (
                  <div className="mb-2">
                    <SelectInput
                      value=""
                      onChange={(v) => pickParentFromBeetle(v, 'father')}
                      options={maleBeetleOptions}
                      placeholder="Pick from collection (optional)"
                    />
                  </div>
                )}
                <TextInput
                  value={form.fatherParent}
                  onChange={(v) => update('fatherParent', v)}
                  placeholder="e.g. B-001 — Titan or wild male"
                />
              </FormField>

              <FormField label="Mother / Female Parent">
                {femaleBeetleOptions.length > 0 && (
                  <div className="mb-2">
                    <SelectInput
                      value=""
                      onChange={(v) => pickParentFromBeetle(v, 'mother')}
                      options={femaleBeetleOptions}
                      placeholder="Pick from collection (optional)"
                    />
                  </div>
                )}
                <TextInput
                  value={form.motherParent}
                  onChange={(v) => update('motherParent', v)}
                  placeholder="e.g. B-003 — Valkyrie or wild female"
                />
              </FormField>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-gray-200 mb-1">Inventory counts</h3>
            <p className="text-xs text-gray-500 mb-4">
              Head counts per stage (e.g. spreadsheet row L1 106). Plain numbers without g/mm stay here.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
              {inventoryFields.map(({ key, label }) => (
                <FormField key={key} label={label}>
                  <NumberInput
                    value={form.inventoryCounts[key]}
                    onChange={(v) => updateInventoryCount(key, v)}
                    step={1}
                    min={0}
                  />
                </FormField>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-gray-200 mb-1">Larval growth weights (L1 – L3)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Gram weights only (e.g. from L1 8g). Not the same as inventory counts above.
            </p>

            <div className="space-y-4">
              {larvalInstarFields.map(({ key, label }) => (
                <div
                  key={key}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-gray-800/80 bg-gray-900/30 p-3"
                >
                  <FormField label={`${label} weight (g)`}>
                    <NumberInput
                      value={form.instarWeights[key]}
                      onChange={(v) => updateInstarWeight(key, v)}
                      step={0.5}
                      min={0}
                    />
                  </FormField>
                  <FormField label={`${label} notes`} hint="Counts, substrate, health, etc.">
                    <textarea
                      value={form.stageNotes[key]}
                      onChange={(e) => updateStageNote(key, e.target.value)}
                      placeholder={`e.g. 12g on May 1, Count: 8`}
                      rows={2}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none"
                    />
                  </FormField>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <FormField label="Egg notes" hint="Lay date, clutch size, incubator.">
                <textarea
                  value={form.stageNotes.egg}
                  onChange={(e) => updateStageNote('egg', e.target.value)}
                  placeholder="e.g. 12 eggs laid May 1"
                  rows={2}
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none"
                />
              </FormField>
              <FormField label="Pupa notes" hint="Chamber formed, pre-emergence.">
                <textarea
                  value={form.stageNotes.pupa}
                  onChange={(e) => updateStageNote('pupa', e.target.value)}
                  placeholder="e.g. Pupa cell formed June 15"
                  rows={2}
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none"
                />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Adult notes" className="md:col-span-2" hint="Breeding, size, emergence — not larval weight.">
                <textarea
                  value={form.stageNotes.adult}
                  onChange={(e) => updateStageNote('adult', e.target.value)}
                  placeholder="Adult observations…"
                  rows={3}
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none"
                />
              </FormField>
            </div>
          </div>

          <div className="mt-4">
            <FormField label="Big Hitter">
              <div className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={() => update('isBigHitter', !form.isBigHitter)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    form.isBigHitter
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-gray-800/50 border-gray-700 text-gray-500'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  {form.isBigHitter ? 'Featured' : 'Mark as Big Hitter'}
                </button>
              </div>
            </FormField>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <div>
              {saved && (
                <Badge variant="success">Beetle added successfully!</Badge>
              )}
            </div>
            <Button type="submit" variant="primary">
              <Save className="w-4 h-4" />
              Save Beetle
            </Button>
          </div>
        </Card>
      </form>

      {beetles.length > 0 && (
        <Card>
          <CardHeader
            title="Edit beetle profile"
            subtitle="Update name, sex, species, parents, counts, weights, and notes"
          />
          <form onSubmit={handleEditSave} noValidate>
            <FormField label="Select beetle">
              <SelectInput
                value={editBeetleId}
                onChange={(id) => {
                  setEditBeetleId(id);
                  setEditErrors({});
                }}
                options={beetleSelectOptions}
                placeholder="Choose a beetle to edit…"
              />
            </FormField>

            {editForm && editingBeetle && (
              <div className="mt-5 space-y-6">
                <p className="text-xs text-gray-500">
                  Editing <span className="text-gray-300 font-medium">{editingBeetle.name}</span>{' '}
                  <span className="font-mono">({editingBeetle.id})</span>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Beetle Name" required error={editErrors.name}>
                    <TextInput
                      value={editForm.name}
                      onChange={(v) => updateEdit('name', v)}
                      placeholder="e.g. Titan"
                      invalid={Boolean(editErrors.name)}
                    />
                  </FormField>

                  <FormField label="Species">
                    <TextInput
                      value={editForm.species}
                      onChange={(v) => updateEdit('species', v)}
                      placeholder="e.g. Dorcus titanus palawanicus"
                    />
                  </FormField>

                  <FormField label="Sex" required error={editErrors.sex}>
                    <SelectInput
                      value={editForm.sex}
                      onChange={(v) => updateEdit('sex', v as BeetleSex)}
                      options={sexOptions}
                      placeholder="Select sex…"
                      invalid={Boolean(editErrors.sex)}
                    />
                  </FormField>

                  <FormField label="Source / Seller">
                    <TextInput
                      value={editForm.source}
                      onChange={(v) => updateEdit('source', v)}
                      placeholder="e.g. BeetleKing JP"
                    />
                  </FormField>

                  <FormField label="Generation">
                    <TextInput
                      value={editForm.generation}
                      onChange={(v) => updateEdit('generation', v)}
                      placeholder="e.g. F1, F2, F10+, CB, WC"
                    />
                  </FormField>

                  <FormField label="Status">
                    <SelectInput
                      value={editForm.status}
                      onChange={(v) => updateEdit('status', v as BeetleStatus)}
                      options={statusOptions}
                    />
                  </FormField>

                  {editForm.status === 'adult' && (
                    <>
                      <FormField label="Emergence Date" hint="Date when the beetle emerged from pupa to adult.">
                        <TextInput
                          type="date"
                          value={editForm.emergenceDate}
                          onChange={(v) => updateEdit('emergenceDate', v)}
                        />
                      </FormField>

                      <FormField label="Adult Size (mm)">
                        <NumberInput
                          value={editForm.adultSize}
                          onChange={(v) => updateEdit('adultSize', v)}
                          step={1}
                          min={0}
                        />
                      </FormField>

                      <FormField label="Adult Weight (g)">
                        <NumberInput
                          value={editForm.adultWeight}
                          onChange={(v) => updateEdit('adultWeight', v)}
                          step={0.5}
                          min={0}
                        />
                      </FormField>
                    </>
                  )}

                  <FormField label="Bloodline" className="md:col-span-2">
                    <TextInput
                      value={editForm.bloodline}
                      onChange={(v) => updateEdit('bloodline', v)}
                      placeholder="e.g. Gold Ridge"
                    />
                  </FormField>
                </div>

                <div className="pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-200 mb-1">Parent Pair</h3>
                  <p className="text-xs text-gray-500 mb-4">Record the male and female parents for this beetle.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Father / Male Parent">
                      {maleBeetleOptions.length > 0 && (
                        <div className="mb-2">
                          <SelectInput
                            value=""
                            onChange={(v) => pickEditParentFromBeetle(v, 'father')}
                            options={maleBeetleOptions}
                            placeholder="Pick from collection (optional)"
                          />
                        </div>
                      )}
                      <TextInput
                        value={editForm.fatherParent}
                        onChange={(v) => updateEdit('fatherParent', v)}
                        placeholder="e.g. B-001 — Titan or wild male"
                      />
                    </FormField>

                    <FormField label="Mother / Female Parent">
                      {femaleBeetleOptions.length > 0 && (
                        <div className="mb-2">
                          <SelectInput
                            value=""
                            onChange={(v) => pickEditParentFromBeetle(v, 'mother')}
                            options={femaleBeetleOptions}
                            placeholder="Pick from collection (optional)"
                          />
                        </div>
                      )}
                      <TextInput
                        value={editForm.motherParent}
                        onChange={(v) => updateEdit('motherParent', v)}
                        placeholder="e.g. B-003 — Valkyrie or wild female"
                      />
                    </FormField>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-800">
                  <FormField label="Featured breeder">
                    <button
                      type="button"
                      onClick={() => updateEdit('isBigHitter', !editForm.isBigHitter)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        editForm.isBigHitter
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          : 'bg-gray-800/50 border-gray-700 text-gray-500'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" />
                      {editForm.isBigHitter ? 'Featured' : 'Mark as Big Hitter'}
                    </button>
                  </FormField>
                </div>

                <div className="pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-200 mb-1">Inventory counts</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Head counts per stage (e.g. spreadsheet row L1 106). Plain numbers without g/mm stay here.
                  </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {inventoryFields.map(({ key, label }) => (
                    <FormField key={key} label={`${label} count`}>
                      <NumberInput
                        value={editForm.inventoryCounts[key]}
                        onChange={(v) => updateEditInventoryCount(key, v)}
                        step={1}
                        min={0}
                      />
                    </FormField>
                  ))}
                </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-200">Larval weights & notes</h3>
                  {larvalInstarFields.map(({ key, label }) => (
                    <div
                      key={key}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-gray-800/80 bg-gray-900/30 p-3"
                    >
                      <FormField label={`${label} weight (g)`}>
                        <NumberInput
                          value={editForm.instarWeights[key]}
                          onChange={(v) => updateEditInstarWeight(key, v)}
                          step={0.5}
                          min={0}
                        />
                      </FormField>
                      <FormField label={`${label} notes`} hint="Counts, dates, substrate — or a lone number as grams">
                        <textarea
                          value={editForm.stageNotes[key]}
                          onChange={(e) => updateEditStageNote(key, e.target.value)}
                          rows={2}
                          className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none"
                        />
                      </FormField>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Egg notes">
                    <textarea
                      value={editForm.stageNotes.egg}
                      onChange={(e) => updateEditStageNote('egg', e.target.value)}
                      rows={2}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 resize-none"
                    />
                  </FormField>
                  <FormField label="Pupa notes">
                    <textarea
                      value={editForm.stageNotes.pupa}
                      onChange={(e) => updateEditStageNote('pupa', e.target.value)}
                      rows={2}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 resize-none"
                    />
                  </FormField>
                </div>

                <FormField label="Adult notes">
                  <textarea
                    value={editForm.stageNotes.adult}
                    onChange={(e) => updateEditStageNote('adult', e.target.value)}
                    rows={2}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 resize-none"
                  />
                </FormField>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <div>{editSaved && <Badge variant="success">Profile updated</Badge>}</div>
                  <Button type="submit" variant="primary">
                    <Pencil className="w-4 h-4" />
                    Save changes
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Card>
      )}

      {beetles.length > 0 && (
        <Card>
          <CardHeader title="Registered Beetles" subtitle={`${beetles.length} total`} />
          <div className="space-y-3 md:hidden">
            {beetles.slice(-10).reverse().map((b) => (
              <div key={b.id} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{b.name}</p>
                    <p className="text-[11px] text-gray-500 font-mono">{b.id}</p>
                  </div>
                  <Badge
                    variant={
                      b.status === 'adult' ? 'success' :
                      b.status === 'larva' ? 'info' :
                      b.status === 'pupa' ? 'warning' :
                      b.status === 'dead' ? 'danger' : 'neutral'
                    }
                  >
                    {b.status}
                  </Badge>
                </div>
                {b.species && <p className="text-xs text-gray-500 truncate">{b.species}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={sexBadgeVariant(b.sex)}>{sexLabel(b.sex)}</Badge>
                  {b.generation && <span className="text-gray-400">Gen: {b.generation}</span>}
                  {b.isBigHitter && <Star className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <p className="text-xs text-gray-400">
                  <span className="text-gray-500">Parents: </span>
                  {formatParentPair(b.fatherParent, b.motherParent)}
                </p>
                {b.status === 'adult' && (b.emergenceDate || b.adultSize > 0 || b.adultWeight > 0) && (
                  <p className="text-[11px] text-gray-500">
                    {b.emergenceDate && <>Emergence: {b.emergenceDate}</>}
                    {b.emergenceDate && (b.adultSize > 0 || b.adultWeight > 0) && ' · '}
                    {b.adultSize > 0 && <>{b.adultSize} mm</>}
                    {b.adultSize > 0 && b.adultWeight > 0 && ' · '}
                    {b.adultWeight > 0 && <>{b.adultWeight} g</>}
                  </p>
                )}
                {(hasStageNotes(b.stageNotes) || b.instarWeights.l1 || b.instarWeights.l2 || b.instarWeights.l3) && (
                  <p className="text-[11px] text-gray-500 line-clamp-2" title={formatStageNotesPreview(b.stageNotes, b.instarWeights)}>
                    <span className="text-gray-600">Larvae: </span>
                    {formatStageNotesPreview(b.stageNotes, b.instarWeights)}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 text-gray-500 font-medium">ID</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Species</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Sex</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Gen</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Parents</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Stage Notes</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Big</th>
                </tr>
              </thead>
              <tbody>
                {beetles.slice(-10).reverse().map((b) => (
                  <tr key={b.id} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-500 font-mono">{b.id}</td>
                    <td className="py-2 text-gray-300 font-medium">{b.name}</td>
                    <td className="py-2 text-gray-500 max-w-[140px] truncate">{b.species || '—'}</td>
                    <td className="py-2">
                      <Badge variant={sexBadgeVariant(b.sex)}>{sexLabel(b.sex)}</Badge>
                    </td>
                    <td className="py-2 text-gray-400">{b.generation || '—'}</td>
                    <td className="py-2 text-gray-400 max-w-[160px] truncate" title={formatParentPair(b.fatherParent, b.motherParent)}>
                      {formatParentPair(b.fatherParent, b.motherParent)}
                    </td>
                    <td className="py-2 text-gray-500 max-w-[180px] truncate" title={formatStageNotesPreview(b.stageNotes, b.instarWeights)}>
                      {hasStageNotes(b.stageNotes) || b.instarWeights.l3
                        ? formatStageNotesPreview(b.stageNotes, b.instarWeights)
                        : '—'}
                    </td>
                    <td className="py-2">
                      <Badge
                        variant={
                          b.status === 'adult' ? 'success' :
                          b.status === 'larva' ? 'info' :
                          b.status === 'pupa' ? 'warning' :
                          b.status === 'dead' ? 'danger' : 'neutral'
                        }
                      >
                        {b.status}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {b.isBigHitter ? <Star className="w-3.5 h-3.5 text-amber-400" /> : <span className="text-gray-700">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
