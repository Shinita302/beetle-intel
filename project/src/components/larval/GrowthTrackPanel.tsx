import { useMemo, useState } from 'react';
import { AlertTriangle, Check, RefreshCw, Save } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FormField, SelectInput } from '../ui/FormField';
import type { Beetle, LarvalRecord } from '../../types';
import { hasAnyInventoryCounts } from '../../types';
import type { GrowthTrackOverrides, LifecycleStage, LifecycleStageSnapshot } from '../../types/lifecycle';
import { LIFECYCLE_LABELS } from '../../types/lifecycle';
import { buildGrowthTrack, formatStageStatus, growthTrackToLarvalRecords } from '../../utils/buildGrowthTrack';
import { InventoryCountsPanel } from './InventoryCountsPanel';

interface GrowthTrackPanelProps {
  beetles: Beetle[];
  larvalRecords: LarvalRecord[];
  overrides: GrowthTrackOverrides;
  onOverridesChange: (next: GrowthTrackOverrides) => void;
  onAddRecords: (records: LarvalRecord[]) => void;
}

const stageOptions = (Object.keys(LIFECYCLE_LABELS) as LifecycleStage[]).map((stage) => ({
  value: stage,
  label: LIFECYCLE_LABELS[stage],
}));

function statusVariant(
  status: LifecycleStageSnapshot['status']
): 'success' | 'info' | 'warning' | 'neutral' | 'danger' {
  if (status === 'completed') return 'success';
  if (status === 'current') return 'info';
  if (status === 'ambiguous') return 'warning';
  return 'neutral';
}

export function GrowthTrackPanel({
  beetles,
  larvalRecords,
  overrides,
  onOverridesChange,
  onAddRecords,
}: GrowthTrackPanelProps) {
  const [selectedBeetleId, setSelectedBeetleId] = useState('');
  const [savedHint, setSavedHint] = useState('');

  const beetle = beetles.find((b) => b.id === selectedBeetleId);
  const track = useMemo(
    () => (beetle ? buildGrowthTrack(beetle, larvalRecords, overrides) : null),
    [beetle, larvalRecords, overrides]
  );

  const hasGrowthData =
    track?.stages.some(
      (s) =>
        (s.weightGrams != null && s.weightGrams > 0) ||
        (s.sizeMm != null && s.sizeMm > 0) ||
        Boolean(s.dateUpdated)
    ) ?? false;

  const beetleOptions = beetles.map((b) => ({
    value: b.id,
    label: `${b.id} — ${b.name}${b.species ? ` (${b.species})` : ''}`,
  }));

  const confirmStage = (stage: LifecycleStage) => {
    if (!beetle || !track) return;
    const snapshot = track.stages.find((s) => s.stage === stage);
    if (!snapshot) return;
    const key = `${beetle.id}:${stage}`;
    onOverridesChange({
      ...overrides,
      [key]: {
        ...overrides[key],
        stage,
        status: snapshot.status === 'ambiguous' ? 'current' : snapshot.status,
        weightGrams: snapshot.weightGrams,
        sizeMm: snapshot.sizeMm,
        count: snapshot.count,
        notes: snapshot.notes,
        dateUpdated: snapshot.dateUpdated,
        needsConfirmation: false,
        confirmed: true,
      },
    });
  };

  const overrideStage = (fromStage: LifecycleStage, toStage: LifecycleStage) => {
    if (!beetle || !track) return;
    const snapshot = track.stages.find((s) => s.stage === fromStage);
    if (!snapshot) return;
    const key = `${beetle.id}:${toStage}`;
    onOverridesChange({
      ...overrides,
      [key]: {
        stage: toStage,
        weightGrams: snapshot.weightGrams,
        sizeMm: snapshot.sizeMm,
        count: snapshot.count,
        notes: snapshot.notes,
        dateUpdated: snapshot.dateUpdated,
        needsConfirmation: false,
        confirmed: true,
      },
    });
  };

  const handleSyncToGrowthLog = () => {
    if (!track) return;
    const newRecords = growthTrackToLarvalRecords(track, larvalRecords.length);
    if (newRecords.length === 0) {
      setSavedHint('No confirmed larval weights to sync.');
      return;
    }
    onAddRecords(newRecords);
    setSavedHint(`Added ${newRecords.length} growth check-in(s).`);
    setTimeout(() => setSavedHint(''), 3000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Lifecycle data"
          subtitle="Inventory counts and growth track are kept separate"
        />
        <div className="max-w-md">
          <FormField label="Beetle profile">
            <SelectInput
              value={selectedBeetleId}
              onChange={setSelectedBeetleId}
              options={beetleOptions}
              placeholder="Select beetle to analyze…"
            />
          </FormField>
        </div>
        {!beetle && (
          <p className="text-sm text-gray-500 mt-4">Choose a beetle to view inventory and growth data.</p>
        )}
      </Card>

      {beetle && <InventoryCountsPanel beetle={beetle} />}

      <Card>
        <CardHeader
          title="Larval growth track"
          subtitle="Weights/sizes with units (g, mm) and growth log check-ins — not plain inventory counts"
        />

      {beetle && track && !hasGrowthData && hasAnyInventoryCounts(beetle.inventoryCounts) && (
        <p className="text-sm text-amber-200/90 mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          No growth measurements (g, mm, dates) on this profile. Head counts like L1 106 are shown in inventory above — not as larval weights.
        </p>
      )}

      {beetle && track && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="info">Species: {track.species}</Badge>
            <Badge variant="neutral">{beetle.name}</Badge>
            <Badge variant="neutral">Status: {beetle.status}</Badge>
          </div>

          <div className="space-y-3">
            {track.stages.map((snapshot) => (
              <StageRow
                key={snapshot.stage}
                snapshot={snapshot}
                onConfirm={() => confirmStage(snapshot.stage)}
                onReassign={(target) => overrideStage(snapshot.stage, target)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-gray-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!beetle) return;
                onOverridesChange({});
                setSavedHint('Overrides cleared — track refreshed from notes.');
                setTimeout(() => setSavedHint(''), 2500);
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh from notes
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSyncToGrowthLog}>
              <Save className="w-4 h-4" />
              Sync to growth log
            </Button>
            {savedHint && <span className="text-xs text-emerald-400">{savedHint}</span>}
          </div>
        </>
      )}

      {beetle && !track && (
        <p className="text-sm text-gray-500">No growth measurements found for this profile.</p>
      )}
      </Card>
    </div>
  );
}

function StageRow({
  snapshot,
  onConfirm,
  onReassign,
}: {
  snapshot: LifecycleStageSnapshot;
  onConfirm: () => void;
  onReassign: (target: LifecycleStage) => void;
}) {
  const [reassignTo, setReassignTo] = useState(snapshot.stage);

  return (
    <div
      className={`rounded-lg border p-4 ${
        snapshot.status === 'ambiguous'
          ? 'border-amber-500/40 bg-amber-500/5'
          : snapshot.status === 'current'
            ? 'border-sky-500/40 bg-sky-500/5'
            : 'border-gray-800 bg-gray-900/40'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-100">{LIFECYCLE_LABELS[snapshot.stage]}</span>
          <Badge variant={statusVariant(snapshot.status)}>{formatStageStatus(snapshot.status)}</Badge>
          {snapshot.inferred && <Badge variant="neutral">Inferred</Badge>}
        </div>
        {snapshot.confidence > 0 && snapshot.confidence < 100 && (
          <span className="text-[11px] text-gray-500">{snapshot.confidence}% confidence</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-3">
        <div>
          <p className="text-gray-600 mb-0.5">Weight</p>
          <p className="text-gray-200 font-medium">
            {snapshot.weightGrams != null ? `${snapshot.weightGrams} g` : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-600 mb-0.5">Size</p>
          <p className="text-gray-200 font-medium">
            {snapshot.sizeMm != null ? `${snapshot.sizeMm} mm` : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-600 mb-0.5">Updated</p>
          <p className="text-gray-200 font-medium">{snapshot.dateUpdated || '—'}</p>
        </div>
      </div>

      {snapshot.notes && (
        <p className="text-xs text-gray-400 mb-2">
          <span className="text-gray-600">Notes: </span>
          {snapshot.notes}
        </p>
      )}

      {snapshot.needsConfirmation && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 mt-2 space-y-2">
          <p className="text-xs text-amber-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {snapshot.likelyStageLabel ?? 'Please confirm stage'}
            {snapshot.confidence > 0 && ` (${snapshot.confidence}% confidence)`}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <FormField label="Assign to stage" className="min-w-[140px]">
              <SelectInput
                value={reassignTo}
                onChange={(v) => setReassignTo(v as LifecycleStage)}
                options={stageOptions}
              />
            </FormField>
            <Button type="button" variant="secondary" size="sm" onClick={() => onReassign(reassignTo)}>
              Move data
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={onConfirm}>
              <Check className="w-3.5 h-3.5" />
              Confirm {LIFECYCLE_LABELS[snapshot.stage]}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
