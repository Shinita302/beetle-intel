import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Save } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { FormField, TextInput, SelectInput, NumberInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { Beetle, BeetleOrigin, BeetleSex, BeetleStatus, GrowthEntry, LarvalInstar } from '../types';
import { formatBeetleBodyMetric } from '../utils/beetleProfileValidation';
import {
  BEETLE_ORIGIN_OPTIONS,
  beetleBodyMetricError,
  beetleColorError,
  beetleGenerationError,
  beetleOriginError,
  beetleUsesWeightMetric,
  normalizeBeetleColor,
  normalizeBeetleGeneration,
  normalizeBeetleSizeMm,
} from '../utils/beetleProfileValidation';
import { latestLarvalInstarFromGrowth } from '../utils/growthFromBodyMetric';
import { useLanguage } from '@/contexts/LanguageContext';

interface AddBeetleProps {
  beetles: Beetle[];
  growthEntries?: GrowthEntry[];
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

const instarOptions: { value: LarvalInstar; label: string }[] = [
  { value: 'L1', label: 'L1' },
  { value: 'L2', label: 'L2' },
  { value: 'L3', label: 'L3' },
];

const emptyForm = {
  name: '',
  species: '',
  sex: 'unknown' as BeetleSex,
  status: 'larva' as BeetleStatus,
  instarStage: 'L3' as LarvalInstar,
  generation: '',
  origin: '' as BeetleOrigin | '',
  sizeMm: 0,
  color: '',
  notes: '',
  source: '',
  bloodline: '',
};

type FormState = typeof emptyForm;
type FormErrors = Partial<Record<'species' | 'generation' | 'origin' | 'sizeMm' | 'color', string>>;

function beetleToForm(beetle: Beetle, growthEntries: GrowthEntry[]): FormState {
  return {
    name: beetle.name,
    species: beetle.species,
    sex: beetle.sex,
    status: beetle.status,
    instarStage:
      beetle.instarStage ??
      latestLarvalInstarFromGrowth(beetle.id, growthEntries) ??
      'L3',
    generation: beetle.generation,
    origin: beetle.origin,
    sizeMm: beetle.sizeMm,
    color: beetle.color,
    notes: beetle.notes,
    source: beetle.source,
    bloodline: beetle.bloodline,
  };
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

function buildBeetleFromForm(form: FormState, id: string, createdAt: string): Beetle {
  const species = form.species.trim();
  return {
    id,
    name: form.name.trim() || species || 'Unnamed',
    species,
    sex: form.sex,
    status: form.status,
    instarStage: form.status === 'larva' ? form.instarStage : undefined,
    generation: normalizeBeetleGeneration(form.generation),
    origin: form.origin as BeetleOrigin,
    sizeMm: normalizeBeetleSizeMm(form.sizeMm),
    color: normalizeBeetleColor(form.color),
    notes: form.notes.trim(),
    source: form.source.trim(),
    bloodline: form.bloodline.trim(),
    createdAt,
  };
}

function LarvalInstarField({
  value,
  onChange,
}: {
  value: LarvalInstar;
  onChange: (value: LarvalInstar) => void;
}) {
  return (
    <FormField
      label="Instar"
      required
      hint="Same L1 / L2 / L3 stages as Inventory."
    >
      <SelectInput
        value={value}
        onChange={(v) => onChange(v as LarvalInstar)}
        options={instarOptions}
      />
    </FormField>
  );
}

function statusLabel(beetle: Beetle): string {
  if (beetle.status === 'larva' && beetle.instarStage) {
    return `${beetle.instarStage} Larva`;
  }
  return beetle.status.charAt(0).toUpperCase() + beetle.status.slice(1);
}

function BeetleBodyMetricField({
  status,
  value,
  error,
  onChange,
}: {
  status: BeetleStatus;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  const usesWeight = beetleUsesWeightMetric(status);

  return (
    <FormField
      label={usesWeight ? 'Weight (g)' : 'Size (mm)'}
      error={error}
      hint={
        usesWeight
          ? 'Current body weight in grams — most useful for larvae and pupae.'
          : 'Body length in millimeters for adult beetles.'
      }
    >
      <NumberInput
        value={value}
        onChange={onChange}
        placeholder={usesWeight ? '35' : '68'}
        min={0}
        max={usesWeight ? 500 : 300}
        step={0.1}
      />
    </FormField>
  );
}

function AdvancedSection({
  form,
  onChange,
}: {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 pt-5 border-t border-gray-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-gray-200"
      >
        Advanced Details
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label="Source / Seller">
            <TextInput
              value={form.source}
              onChange={(v) => onChange('source', v)}
              placeholder="e.g. BeetleKing JP"
            />
          </FormField>
          <FormField label="Bloodline">
            <TextInput
              value={form.bloodline}
              onChange={(v) => onChange('bloodline', v)}
              placeholder="e.g. Gold Ridge"
            />
          </FormField>
        </div>
      )}
    </div>
  );
}

export function AddBeetle({ beetles, growthEntries = [], onAdd, onUpdate }: AddBeetleProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saved, setSaved] = useState(false);
  const [editBeetleId, setEditBeetleId] = useState('');
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [editSaved, setEditSaved] = useState(false);

  const nextId = `B-${String(beetles.length + 1).padStart(3, '0')}`;
  const editingBeetle = beetles.find((b) => b.id === editBeetleId);

  const validate = (state: FormState): FormErrors => {
    const next: FormErrors = {};
    if (!state.species.trim()) {
      next.species = 'Species is required.';
    }
    const generationError = beetleGenerationError(state.generation);
    if (generationError) {
      next.generation = generationError;
    }
    const originError = beetleOriginError(state.origin);
    if (originError) {
      next.origin = originError;
    }
    const sizeError = beetleBodyMetricError(state.sizeMm, state.status);
    if (sizeError) {
      next.sizeMm = sizeError;
    }
    const colorError = beetleColorError(state.color);
    if (colorError) {
      next.color = colorError;
    }
    return next;
  };

  const clearFieldError = (
    key: keyof FormErrors,
    setErrorState: React.Dispatch<React.SetStateAction<FormErrors>>
  ) => {
    setErrorState((prev) => ({ ...prev, [key]: undefined }));
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'status' && value === 'larva' && prev.status !== 'larva') {
        next.instarStage = prev.instarStage || 'L3';
      }
      return next;
    });
    if (key === 'status' && errors.sizeMm) clearFieldError('sizeMm', setErrors);
    if (key === 'species' && errors.species) clearFieldError('species', setErrors);
    if (key === 'generation' && errors.generation) clearFieldError('generation', setErrors);
    if (key === 'origin' && errors.origin) clearFieldError('origin', setErrors);
    if (key === 'sizeMm' && errors.sizeMm) clearFieldError('sizeMm', setErrors);
    if (key === 'color' && errors.color) clearFieldError('color', setErrors);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    onAdd(buildBeetleFromForm(form, nextId, new Date().toISOString().slice(0, 10)));
    setForm(emptyForm);
    setErrors({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    if (!editBeetleId) {
      setEditForm(null);
      return;
    }
    const beetle = beetles.find((b) => b.id === editBeetleId);
    if (beetle) {
      setEditForm(beetleToForm(beetle, growthEntries));
    }
  }, [editBeetleId, beetles, growthEntries]);

  const beetleSelectOptions = beetles.map((b) => ({
    value: b.id,
    label: `${b.id} — ${b.name}`,
  }));

  const updateEdit = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (key === 'status' && value === 'larva' && prev.status !== 'larva') {
        next.instarStage = prev.instarStage || 'L3';
      }
      return next;
    });
    if (key === 'status' && editErrors.sizeMm) clearFieldError('sizeMm', setEditErrors);
    if (key === 'species' && editErrors.species) clearFieldError('species', setEditErrors);
    if (key === 'generation' && editErrors.generation) clearFieldError('generation', setEditErrors);
    if (key === 'origin' && editErrors.origin) clearFieldError('origin', setEditErrors);
    if (key === 'sizeMm' && editErrors.sizeMm) clearFieldError('sizeMm', setEditErrors);
    if (key === 'color' && editErrors.color) clearFieldError('color', setEditErrors);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBeetle || !editForm) return;

    const validationErrors = validate(editForm);
    if (Object.keys(validationErrors).length > 0) {
      setEditErrors(validationErrors);
      return;
    }

    onUpdate({
      ...buildBeetleFromForm(editForm, editingBeetle.id, editingBeetle.createdAt),
    });
    setEditErrors({});
    setEditSaved(true);
    setTimeout(() => setEditSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">{t('pages.addBeetleTitle')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('pages.addBeetleSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardHeader title="Beetle Profile" subtitle={`ID: ${nextId}`} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Species" required error={errors.species}>
              <TextInput
                value={form.species}
                onChange={(v) => update('species', v)}
                placeholder="e.g. Dorcus titanus palawanicus"
                invalid={Boolean(errors.species)}
              />
            </FormField>

            <FormField label="Status" required>
              <SelectInput
                value={form.status}
                onChange={(v) => update('status', v as BeetleStatus)}
                options={statusOptions}
              />
            </FormField>

            {form.status === 'larva' && (
              <LarvalInstarField
                value={form.instarStage}
                onChange={(v) => update('instarStage', v)}
              />
            )}

            <FormField label="Name / Nickname">
              <TextInput
                value={form.name}
                onChange={(v) => update('name', v)}
                placeholder="e.g. Titan (optional)"
              />
            </FormField>

            <FormField label="Sex">
              <SelectInput
                value={form.sex}
                onChange={(v) => update('sex', v as BeetleSex)}
                options={sexOptions}
              />
            </FormField>

            <FormField label="Generation" error={errors.generation}>
              <TextInput
                value={form.generation}
                onChange={(v) => update('generation', v)}
                placeholder="e.g. F1, F2, F20"
                invalid={Boolean(errors.generation)}
              />
            </FormField>

            <FormField label="Origin" required error={errors.origin}>
              <SelectInput
                value={form.origin}
                onChange={(v) => update('origin', v as BeetleOrigin)}
                options={BEETLE_ORIGIN_OPTIONS}
                placeholder="Select origin…"
                invalid={Boolean(errors.origin)}
              />
            </FormField>

            <BeetleBodyMetricField
              status={form.status}
              value={form.sizeMm}
              error={errors.sizeMm}
              onChange={(v) => update('sizeMm', v)}
            />

            <FormField label="Color" error={errors.color}>
              <TextInput
                value={form.color}
                onChange={(v) => update('color', v)}
                placeholder="e.g. Metallic Green, Rainbow, Blue, Red"
                invalid={Boolean(errors.color)}
              />
            </FormField>

            <FormField label="Notes" className="md:col-span-2">
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="General observations about this beetle…"
                rows={3}
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none"
              />
            </FormField>
          </div>

          <AdvancedSection form={form} onChange={update} />

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <div>{saved && <Badge variant="success">Beetle added!</Badge>}</div>
            <Button type="submit" variant="primary">
              <Save className="w-4 h-4" />
              Save Beetle
            </Button>
          </div>
        </Card>
      </form>

      {beetles.length > 0 && (
        <Card>
          <CardHeader title="Edit Beetle Profile" subtitle="Update an existing beetle" />
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
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Species" required error={editErrors.species}>
                    <TextInput
                      value={editForm.species}
                      onChange={(v) => updateEdit('species', v)}
                      invalid={Boolean(editErrors.species)}
                    />
                  </FormField>
                  <FormField label="Status" required>
                    <SelectInput
                      value={editForm.status}
                      onChange={(v) => updateEdit('status', v as BeetleStatus)}
                      options={statusOptions}
                    />
                  </FormField>
                  {editForm.status === 'larva' && (
                    <LarvalInstarField
                      value={editForm.instarStage}
                      onChange={(v) => updateEdit('instarStage', v)}
                    />
                  )}
                  <FormField label="Name / Nickname">
                    <TextInput value={editForm.name} onChange={(v) => updateEdit('name', v)} />
                  </FormField>
                  <FormField label="Sex">
                    <SelectInput
                      value={editForm.sex}
                      onChange={(v) => updateEdit('sex', v as BeetleSex)}
                      options={sexOptions}
                    />
                  </FormField>
                  <FormField label="Generation" error={editErrors.generation}>
                    <TextInput
                      value={editForm.generation}
                      onChange={(v) => updateEdit('generation', v)}
                      placeholder="e.g. F1, F2, F20"
                      invalid={Boolean(editErrors.generation)}
                    />
                  </FormField>
                  <FormField label="Origin" required error={editErrors.origin}>
                    <SelectInput
                      value={editForm.origin}
                      onChange={(v) => updateEdit('origin', v as BeetleOrigin)}
                      options={BEETLE_ORIGIN_OPTIONS}
                      placeholder="Select origin…"
                      invalid={Boolean(editErrors.origin)}
                    />
                  </FormField>
                  <BeetleBodyMetricField
                    status={editForm.status}
                    value={editForm.sizeMm}
                    error={editErrors.sizeMm}
                    onChange={(v) => updateEdit('sizeMm', v)}
                  />
                  <FormField label="Color" error={editErrors.color}>
                    <TextInput
                      value={editForm.color}
                      onChange={(v) => updateEdit('color', v)}
                      placeholder="e.g. Metallic Green, Rainbow, Blue, Red"
                      invalid={Boolean(editErrors.color)}
                    />
                  </FormField>
                  <FormField label="Notes" className="md:col-span-2">
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => updateEdit('notes', e.target.value)}
                      rows={3}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 resize-none"
                    />
                  </FormField>
                </div>
                <AdvancedSection form={editForm} onChange={updateEdit} />
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 text-gray-500 font-medium">ID</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Species</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Sex</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Gen</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Origin</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Size / Weight</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Color</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {beetles.slice(-10).reverse().map((b) => (
                  <tr key={b.id} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-500 font-mono">{b.id}</td>
                    <td className="py-2 text-gray-300 font-medium">{b.name}</td>
                    <td className="py-2 text-gray-500 max-w-[180px] truncate">{b.species}</td>
                    <td className="py-2">
                      <Badge variant={sexBadgeVariant(b.sex)}>{sexLabel(b.sex)}</Badge>
                    </td>
                    <td className="py-2 text-gray-400">{b.generation || '—'}</td>
                    <td className="py-2 text-gray-400">{b.origin || '—'}</td>
                    <td className="py-2 text-gray-400">{formatBeetleBodyMetric(b)}</td>
                    <td className="py-2 text-gray-400 max-w-[120px] truncate">{b.color || '—'}</td>
                    <td className="py-2">
                      <Badge
                        variant={
                          b.status === 'adult'
                            ? 'success'
                            : b.status === 'larva'
                              ? 'info'
                              : b.status === 'pupa'
                                ? 'warning'
                                : b.status === 'dead'
                                  ? 'danger'
                                  : 'neutral'
                        }
                      >
                        {statusLabel(b)}
                      </Badge>
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
