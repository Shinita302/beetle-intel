import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
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
import { beetleImportIdSortKey } from '../../utils/importGrowthSheet';

interface GrowthLogPanelProps {
  beetles: Beetle[];
  growthEntries: GrowthEntry[];
  onAddEntry: (entry: GrowthEntry) => void;
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

const defaultSubstrate = parseSubstrateType('Flake Soil');

function formatDisplayDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function GrowthLogPanel({ beetles, growthEntries, onAddEntry }: GrowthLogPanelProps) {
  const [selectedBeetleId, setSelectedBeetleId] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    stage: 'L1' as GrowthStage,
    weight: 0,
    temperature: 0,
    humidity: 0,
    substrateSelection: defaultSubstrate.selection,
    substrateCustom: defaultSubstrate.customValue,
    notes: '',
  });

  const beetleOptions = [...beetles]
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

  const beetleHistory = useMemo(
    () =>
      growthEntries
        .filter((entry) => entry.beetleId === selectedBeetleId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [growthEntries, selectedBeetleId]
  );

  const chartData = useMemo(
    () =>
      beetleHistory.map((entry) => ({
        date: formatDisplayDate(entry.date),
        weight: entry.weight,
      })),
    [beetleHistory]
  );

  const nextId = `GE-${String(growthEntries.length + 1).padStart(3, '0')}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeetleId) return;

    const entry: GrowthEntry = {
      id: nextId,
      beetleId: selectedBeetleId,
      date: form.date,
      stage: form.stage,
      weight: form.weight,
      temperature: form.temperature,
      humidity: form.humidity,
      substrate: resolveSubstrateType(form.substrateSelection, form.substrateCustom),
      notes: form.notes.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    onAddEntry(entry);
    setForm((prev) => ({
      ...prev,
      weight: 0,
      notes: '',
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Growth Log" subtitle="Weight history per beetle — chart-ready" />
        <FormField label="Beetle">
          <SelectInput
            value={selectedBeetleId}
            onChange={setSelectedBeetleId}
            options={beetleOptions}
            placeholder="Select beetle…"
          />
        </FormField>
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
                      </tr>
                    </thead>
                    <tbody>
                      {[...beetleHistory].reverse().map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-800/50">
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

          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader title="Add Growth Entry" subtitle={`Entry ID: ${nextId}`} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Date" required>
                  <TextInput type="date" value={form.date} onChange={(v) => setForm((p) => ({ ...p, date: v }))} required />
                </FormField>
                <FormField label="Stage" required>
                  <SelectInput
                    value={form.stage}
                    onChange={(v) => setForm((p) => ({ ...p, stage: v as GrowthStage }))}
                    options={stageOptions}
                  />
                </FormField>
                <FormField label="Weight (g)" required>
                  <NumberInput
                    value={form.weight}
                    onChange={(v) => setForm((p) => ({ ...p, weight: v }))}
                    step={0.1}
                    min={0}
                    required
                  />
                </FormField>
                <FormField label="Temperature (°C)">
                  <NumberInput
                    value={form.temperature}
                    onChange={(v) => setForm((p) => ({ ...p, temperature: v }))}
                    step={0.5}
                    min={0}
                    max={40}
                  />
                </FormField>
                <FormField label="Humidity (%)">
                  <NumberInput
                    value={form.humidity}
                    onChange={(v) => setForm((p) => ({ ...p, humidity: v }))}
                    step={1}
                    min={0}
                    max={100}
                  />
                </FormField>
                <div className="md:col-span-2">
                  <SubstrateTypeField
                    selection={form.substrateSelection}
                    customValue={form.substrateCustom}
                    onSelectionChange={(v) => setForm((p) => ({ ...p, substrateSelection: v }))}
                    onCustomChange={(v) => setForm((p) => ({ ...p, substrateCustom: v }))}
                  />
                </div>
                <FormField label="Notes" className="md:col-span-2">
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Observations, health notes…"
                    rows={2}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 resize-none"
                  />
                </FormField>
              </div>
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
