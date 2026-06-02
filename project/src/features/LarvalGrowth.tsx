import { useState } from 'react';
import { Save, Camera } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { FormField, TextInput, SelectInput, NumberInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SubstrateTypeField } from '../components/forms/SubstrateTypeField';
import { ContainerSizeField } from '../components/forms/ContainerSizeField';
import { formatContainerSize } from '../constants/containerSize';
import { parseSubstrateType, resolveSubstrateType } from '../constants/substrate';
import { GrowthTrackPanel } from '../components/larval/GrowthTrackPanel';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import type { GrowthTrackOverrides } from '../types/lifecycle';
import type { Beetle, LarvalRecord, InstarStage, ContainerSizeUnit } from '../types';

interface LarvalGrowthProps {
  beetles: Beetle[];
  larvalRecords: LarvalRecord[];
  onAdd: (record: LarvalRecord) => void;
  onAddMany?: (records: LarvalRecord[]) => void;
}

const instarOptions: { value: InstarStage; label: string }[] = [
  { value: 'L1', label: 'L1' },
  { value: 'L2', label: 'L2' },
  { value: 'L3', label: 'L3' },
];

const defaultSubstrate = parseSubstrateType('Flake Soil');

const emptyForm = {
  bottleId: '',
  beetleId: '',
  dateChecked: new Date().toISOString().slice(0, 10),
  weight: 0,
  instarStage: 'L1' as InstarStage,
  substrateSelection: defaultSubstrate.selection,
  substrateCustom: defaultSubstrate.customValue,
  containerSizeValue: 500,
  containerSizeUnit: 'mL' as ContainerSizeUnit,
  temperature: 0,
  humidity: 0,
  notes: '',
  photoUrl: '',
  nextCheckDate: '',
};

export function LarvalGrowth({ beetles, larvalRecords, onAdd, onAddMany }: LarvalGrowthProps) {
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [growthOverrides, setGrowthOverrides] = useLocalStorage<GrowthTrackOverrides>(
    STORAGE_KEYS.growthOverrides,
    {}
  );

  const nextId = `LR-${String(larvalRecords.length + 1).padStart(3, '0')}`;
  const beetleOptions = beetles
    .filter((b) => b.status === 'larva' || b.status === 'pupa')
    .map((b) => ({ value: b.id, label: `${b.id} - ${b.name}` }));

  const allBeetleOptions = beetles.map((b) => ({ value: b.id, label: `${b.id} - ${b.name}` }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const record: LarvalRecord = {
      id: nextId,
      bottleId: form.bottleId,
      beetleId: form.beetleId,
      dateChecked: form.dateChecked,
      weight: form.weight,
      instarStage: form.instarStage,
      substrateType: resolveSubstrateType(form.substrateSelection, form.substrateCustom),
      containerSizeValue: form.containerSizeValue,
      containerSizeUnit: form.containerSizeUnit,
      temperature: form.temperature,
      humidity: form.humidity,
      notes: form.notes,
      photoUrl: form.photoUrl,
      nextCheckDate: form.nextCheckDate,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onAdd(record);
    setForm(emptyForm);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const instarVariant = { L1: 'info' as const, L2: 'warning' as const, L3: 'success' as const };

  const handleAddMany = (records: LarvalRecord[]) => {
    if (onAddMany) {
      onAddMany(records);
    } else {
      records.forEach((record) => onAdd(record));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Larval Growth Tracking</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Parse rough L1/L2/L3 notes into a lifecycle track, then log formal check-ins
        </p>
      </div>

      <GrowthTrackPanel
        beetles={beetles}
        larvalRecords={larvalRecords}
        overrides={growthOverrides}
        onOverridesChange={setGrowthOverrides}
        onAddRecords={handleAddMany}
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader title="Growth Entry" subtitle={`Record ID: ${nextId}`} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Bottle ID" required>
              <TextInput value={form.bottleId} onChange={(v) => update('bottleId', v)} placeholder="e.g. BT-A12" required />
            </FormField>

            <FormField label="Beetle" required>
              <SelectInput
                value={form.beetleId}
                onChange={(v) => update('beetleId', v)}
                options={beetleOptions.length > 0 ? beetleOptions : allBeetleOptions}
                placeholder="Select beetle"
                required
              />
            </FormField>

            <FormField label="Date Checked" required>
              <TextInput type="date" value={form.dateChecked} onChange={(v) => update('dateChecked', v)} required />
            </FormField>

            <FormField label="Weight (g)" required>
              <NumberInput value={form.weight} onChange={(v) => update('weight', v)} step={0.1} min={0} required />
            </FormField>

            <FormField label="Instar Stage" required>
              <SelectInput value={form.instarStage} onChange={(v) => update('instarStage', v as InstarStage)} options={instarOptions} />
            </FormField>

            <div className="md:col-span-2">
              <SubstrateTypeField
                selection={form.substrateSelection}
                customValue={form.substrateCustom}
                onSelectionChange={(v) => update('substrateSelection', v)}
                onCustomChange={(v) => update('substrateCustom', v)}
              />
            </div>

            <ContainerSizeField
              value={form.containerSizeValue}
              unit={form.containerSizeUnit}
              onValueChange={(v) => update('containerSizeValue', v)}
              onUnitChange={(v) => update('containerSizeUnit', v)}
              hint="Example: 500 mL"
            />

            <FormField label="Temperature (C)">
              <NumberInput value={form.temperature} onChange={(v) => update('temperature', v)} step={0.5} min={0} max={40} />
            </FormField>

            <FormField label="Humidity (%)">
              <NumberInput value={form.humidity} onChange={(v) => update('humidity', v)} step={1} min={0} max={100} />
            </FormField>

            <FormField label="Next Check Date">
              <TextInput type="date" value={form.nextCheckDate} onChange={(v) => update('nextCheckDate', v)} />
            </FormField>

            <FormField label="Notes" className="md:col-span-2">
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Observations, health notes..."
                rows={3}
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none"
              />
            </FormField>

            <FormField label="Photo Upload">
              <div className="flex items-center gap-3 py-1.5">
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-700 text-gray-500 hover:text-gray-400 hover:border-gray-600 transition-colors text-xs"
                >
                  <Camera className="w-4 h-4" />
                  Choose File
                </button>
                <span className="text-[10px] text-gray-600">Photo storage coming soon</span>
              </div>
            </FormField>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <div>
              {saved && <Badge variant="success">Growth record saved!</Badge>}
            </div>
            <Button type="submit" variant="primary">
              <Save className="w-4 h-4" />
              Save Record
            </Button>
          </div>
        </Card>
      </form>

      {larvalRecords.length > 0 && (
        <Card>
          <CardHeader title="Recent Growth Records" subtitle={`${larvalRecords.length} total`} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 text-gray-500 font-medium">Bottle</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Beetle</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Weight</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Substrate</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Container</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Instar</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Temp</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Humidity</th>
                </tr>
              </thead>
              <tbody>
                {larvalRecords.slice(-10).reverse().map((lr) => (
                  <tr key={lr.id} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-500 font-mono">{lr.bottleId}</td>
                    <td className="py-2 text-gray-400">{lr.beetleId}</td>
                    <td className="py-2 text-gray-500">{lr.dateChecked}</td>
                    <td className="py-2 text-right text-emerald-400 font-medium">{lr.weight}g</td>
                    <td className="py-2 text-gray-400 max-w-[100px] truncate">{lr.substrateType}</td>
                    <td className="py-2 text-gray-400">
                      {formatContainerSize(lr.containerSizeValue, lr.containerSizeUnit)}
                    </td>
                    <td className="py-2">
                      <Badge variant={instarVariant[lr.instarStage]}>{lr.instarStage}</Badge>
                    </td>
                    <td className="py-2 text-right text-gray-400">{lr.temperature}C</td>
                    <td className="py-2 text-right text-gray-400">{lr.humidity}%</td>
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
