import { useMemo, useState } from 'react';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FormField, SelectInput, NumberInput, TextInput } from '../ui/FormField';
import { SubstrateTypeField } from '../forms/SubstrateTypeField';
import { parseSubstrateType, resolveSubstrateType } from '../../constants/substrate';
import type { Beetle, GrowthEntry, GrowthStage } from '../../types';
import { beetleLabel } from '../../types';
import { beetleImportIdSortKey, beetlesWithGrowthData, growthEntriesForBeetle } from '../../utils/importGrowthSheet';

interface GrowthLogPanelProps {
  beetles: Beetle[];
  growthEntries: GrowthEntry[];
  onAddEntry: (entry: GrowthEntry) => void;
  onUpdateEntry: (entry: GrowthEntry) => void;
  onDeleteEntry: (id: string) => void;
}

const stageOptions: { value: GrowthStage; label: string }[] = [
  { value: 'Egg', label: 'Egg' },
  { value: 'L1', label: 'L1' },
  { value: 'L2', label: 'L2' },
  { value: 'L3', label: 'L3' },
  { value: 'Pre-Pupa', label: 'Pre-Pupa' },
  { value: 'Pupa', label: 'Pupa' },
  { value: 'Adult', label: 'Adult' },
];

type GrowthEntryFormState = {
  date: string;
  stage: GrowthStage;
  weight: number;
  temperature: number;
  humidity: number;
  substrateSelection: string;
  substrateCustom: string;
  notes: string;
};

const defaultSubstrate = parseSubstrateType('Flake Soil');

function emptyForm(): GrowthEntryFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    stage: 'L1',
    weight: 0,
    temperature: 0,
    humidity: 0,
    substrateSelection: defaultSubstrate.selection,
    substrateCustom: defaultSubstrate.customValue,
    notes: '',
  };
}

function entryToForm(entry: GrowthEntry): GrowthEntryFormState {
  const substrate = parseSubstrateType(entry.substrate);
  return {
    date: entry.date,
    stage: entry.stage,
    weight: entry.weight,
    temperature: entry.temperature,
    humidity: entry.humidity,
    substrateSelection: substrate.selection,
    substrateCustom: substrate.customValue,
    notes: entry.notes,
  };
}

function buildEntryFromForm(
  form: GrowthEntryFormState,
  beetleId: string,
  id: string,
  createdAt: string
): GrowthEntry {
  return {
    id,
    beetleId,
    date: form.date,
    stage: form.stage,
    weight: form.weight,
    temperature: form.temperature,
    humidity: form.humidity,
    substrate: resolveSubstrateType(form.substrateSelection, form.substrateCustom),
    notes: form.notes.trim(),
    createdAt,
  };
}

function formatDisplayDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function GrowthEntryFields({
  form,
  onChange,
}: {
  form: GrowthEntryFormState;
  onChange: (next: GrowthEntryFormState) => void;
}) {
  const update = <K extends keyof GrowthEntryFormState>(key: K, value: GrowthEntryFormState[K]) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField label="Date" required>
        <TextInput type="date" value={form.date} onChange={(v) => update('date', v)} required />
      </FormField>
      <FormField label="Stage" required>
        <SelectInput
          value={form.stage}
          onChange={(v) => update('stage', v as GrowthStage)}
          options={stageOptions}
        />
      </FormField>
      <FormField label="Weight (g)" required>
        <NumberInput
          value={form.weight}
          onChange={(v) => update('weight', v)}
          step={0.1}
          min={0}
          required
        />
      </FormField>
      <FormField label="Temperature (°C)">
        <NumberInput
          value={form.temperature}
          onChange={(v) => update('temperature', v)}
          step={0.5}
          min={0}
          max={40}
        />
      </FormField>
      <FormField label="Humidity (%)">
        <NumberInput
          value={form.humidity}
          onChange={(v) => update('humidity', v)}
          step={1}
          min={0}
          max={100}
        />
      </FormField>
      <div className="md:col-span-2">
        <SubstrateTypeField
          selection={form.substrateSelection}
          customValue={form.substrateCustom}
          onSelectionChange={(v) => update('substrateSelection', v)}
          onCustomChange={(v) => update('substrateCustom', v)}
        />
      </div>
      <FormField label="Notes" className="md:col-span-2">
        <textarea
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Observations, health notes…"
          rows={2}
          className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 resize-none"
        />
      </FormField>
    </div>
  );
}

export function GrowthLogPanel({
  beetles,
  growthEntries,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
}: GrowthLogPanelProps) {
  const [selectedBeetleId, setSelectedBeetleId] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState<GrowthEntryFormState | null>(null);
  const [saved, setSaved] = useState(false);

  const editingEntry = useMemo(
    () => growthEntries.find((entry) => entry.id === editingEntryId) ?? null,
    [growthEntries, editingEntryId]
  );

  const beetlesWithGrowth = useMemo(
    () => beetlesWithGrowthData(beetles, growthEntries),
    [beetles, growthEntries]
  );

  const selectedBeetle = useMemo(
    () => beetles.find((beetle) => beetle.id === selectedBeetleId) ?? null,
    [beetles, selectedBeetleId]
  );

  const beetleOptions = [...beetlesWithGrowth]
    .sort((a, b) => {
      const aKey = beetleImportIdSortKey(a.name);
      const bKey = beetleImportIdSortKey(b.name);
      if (aKey !== bKey) return aKey - bKey;
      return a.name.localeCompare(b.name);
    })
    .map((b) => ({
      value: b.id,
      label: beetleLabel(beetles, b.id),
    }));

  const beetleHistory = useMemo(() => {
    if (!selectedBeetle) return [];
    return growthEntriesForBeetle(selectedBeetle, growthEntries).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [growthEntries, selectedBeetle]);

  const chartData = useMemo(
    () =>
      beetleHistory.map((entry) => ({
        date: formatDisplayDate(entry.date),
        weight: entry.weight,
      })),
    [beetleHistory]
  );

  const nextId = `GE-${String(growthEntries.length + 1).padStart(3, '0')}`;

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const closeEdit = () => {
    setEditingEntryId(null);
    setEditForm(null);
  };

  const openEdit = (entry: GrowthEntry) => {
    setEditingEntryId(entry.id);
    setEditForm(entryToForm(entry));
    setSaved(false);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeetleId) return;

    onAddEntry(
      buildEntryFromForm(addForm, selectedBeetleId, nextId, new Date().toISOString().slice(0, 10))
    );
    setAddForm((prev) => ({
      ...prev,
      weight: 0,
      notes: '',
    }));
    flashSaved();
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editForm) return;

    onUpdateEntry(buildEntryFromForm(editForm, editingEntry.beetleId, editingEntry.id, editingEntry.createdAt));
    closeEdit();
    flashSaved();
  };

  const handleDelete = (id: string) => {
    onDeleteEntry(id);
    if (editingEntryId === id) {
      closeEdit();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Growth Log" subtitle="Weight history per beetle — chart-ready" />
        <FormField label="Beetle">
          <SelectInput
            value={selectedBeetleId}
            onChange={(value) => {
              setSelectedBeetleId(value);
              closeEdit();
            }}
            options={beetleOptions}
            placeholder="Select beetle…"
          />
        </FormField>
        {beetleOptions.length === 0 && (
          <p className="text-sm text-gray-500 mt-3">
            No larvae with growth data yet. Import your spreadsheet (Larval Growth tab) from{' '}
            <span className="text-gray-400">Import</span>, or add a growth entry manually after
            selecting a beetle profile.
          </p>
        )}
      </Card>

      {selectedBeetleId && (
        <>
          <Card>
            <CardHeader title="Growth History" subtitle={beetleLabel(beetles, selectedBeetleId)} />
            {beetleHistory.length > 0 ? (
              <div className="space-y-4">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickFormatter={(value) => `${value}g`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #1f2937',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value) => [`${value ?? ''}g`, 'Weight']}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#0ea5e9' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                        <th className="text-left py-2 text-gray-500 font-medium">Stage</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Weight</th>
                        <th className="text-right py-2 text-gray-500 font-medium hidden sm:table-cell">Temp</th>
                        <th className="text-right py-2 text-gray-500 font-medium hidden sm:table-cell">Humidity</th>
                        <th className="text-left py-2 text-gray-500 font-medium hidden md:table-cell">Substrate</th>
                        <th className="w-16 py-2 text-right text-gray-500 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...beetleHistory].reverse().map((entry) => (
                        <tr
                          key={entry.id}
                          className={`border-b border-gray-800/50 group ${
                            editingEntryId === entry.id ? 'bg-sky-500/5' : ''
                          }`}
                        >
                          <td className="py-2 text-gray-400">{formatDisplayDate(entry.date)}</td>
                          <td className="py-2">
                            <Badge variant="info">{entry.stage}</Badge>
                          </td>
                          <td className="py-2 text-right text-emerald-400 font-medium">{entry.weight}g</td>
                          <td className="py-2 text-right text-gray-500 hidden sm:table-cell">
                            {entry.temperature ? `${entry.temperature}°C` : '—'}
                          </td>
                          <td className="py-2 text-right text-gray-500 hidden sm:table-cell">
                            {entry.humidity ? `${entry.humidity}%` : '—'}
                          </td>
                          <td className="py-2 text-gray-500 hidden md:table-cell max-w-[120px] truncate">
                            {entry.substrate || '—'}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(entry)}
                                className="p-1.5 rounded-md text-gray-600 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                                title="Edit entry"
                                aria-label={`Edit ${entry.stage} entry from ${formatDisplayDate(entry.date)}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.id)}
                                className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete entry"
                                aria-label={`Delete ${entry.stage} entry from ${formatDisplayDate(entry.date)}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No growth entries yet for this beetle.</p>
            )}
          </Card>

          {editingEntry && editForm && (
            <form onSubmit={handleEditSubmit}>
              <Card>
                <CardHeader
                  title="Edit Growth Entry"
                  subtitle={`Entry ID: ${editingEntry.id}`}
                />
                <GrowthEntryFields form={editForm} onChange={setEditForm} />
                <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-800">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleDelete(editingEntry.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Entry
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" onClick={closeEdit}>
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                      <Save className="w-4 h-4" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </Card>
            </form>
          )}

          <form onSubmit={handleAddSubmit}>
            <Card>
              <CardHeader title="Add Growth Entry" subtitle={`Entry ID: ${nextId}`} />
              <GrowthEntryFields form={addForm} onChange={setAddForm} />
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
                <div>{saved && <Badge variant="success">Growth entry saved!</Badge>}</div>
                <Button type="submit" variant="primary">
                  <Save className="w-4 h-4" />
                  Save Entry
                </Button>
              </div>
            </Card>
          </form>
        </>
      )}
    </div>
  );
}
