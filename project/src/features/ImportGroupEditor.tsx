import { AlertTriangle, Sparkles } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { FormField, TextInput, NumberInput } from '../components/ui/FormField';
import type { EditableImportGroup } from '@/types/hybridImport';
import { rememberCorrection } from '@/utils/importCorrectionMemory';
import { recalculateGroupTotal } from '@/utils/hybridImportPipeline';

interface ImportGroupEditorProps {
  groups: EditableImportGroup[];
  userId?: string;
  onChange: (groups: EditableImportGroup[]) => void;
}

function confidenceLabel(level: EditableImportGroup['confidence']): string {
  if (level === 'high') return 'High confidence — likely correct';
  if (level === 'medium') return 'Medium — check recommended';
  return 'Low — needs review';
}

function confidenceVariant(level: EditableImportGroup['confidence']): 'success' | 'warning' | 'danger' {
  if (level === 'high') return 'success';
  if (level === 'medium') return 'warning';
  return 'danger';
}

export function ImportGroupEditor({ groups, userId, onChange }: ImportGroupEditorProps) {
  const updateGroup = (
    id: string,
    patch: Partial<EditableImportGroup>,
    rememberField?: 'species' | 'lineName' | 'origin' | 'generation'
  ) => {
    onChange(
      groups.map((group) => {
        if (group.id !== id) return group;
        const previous = group;
        let next = recalculateGroupTotal({
          ...group,
          ...patch,
          parseSource: patch.parseSource ?? 'user-edited',
        });

        if (rememberField && userId && patch[rememberField] !== undefined) {
          const oldValue = String(previous[rememberField] ?? '');
          const newValue = String(patch[rememberField] ?? '');
          if (oldValue !== newValue) {
            rememberCorrection(userId, previous, rememberField, newValue);
          }
        }

        if (next.parseSource === 'user-edited') {
          next = { ...next, confidenceScore: Math.min(next.confidenceScore + 5, 95) };
        }

        return next;
      })
    );
  };

  const updateCount = (id: string, field: keyof EditableImportGroup, value: number) => {
    updateGroup(id, { [field]: value } as Partial<EditableImportGroup>);
  };

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No population groups detected. Check your spreadsheet layout or use Advanced row mapping below.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div
          key={group.id}
          className={`rounded-xl border p-4 ${
            group.included ? 'border-gray-800 bg-gray-900/50' : 'border-gray-800/50 bg-gray-950/40 opacity-60'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-gray-100">Population Group</p>
                <Badge variant={confidenceVariant(group.confidence)}>
                  {confidenceLabel(group.confidence)} ({group.confidenceScore}%)
                </Badge>
                {group.parseSource === 'llm' && (
                  <Badge variant="info">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    LLM assisted
                  </Badge>
                )}
                {group.parseSource === 'user-edited' && <Badge variant="neutral">Edited</Badge>}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Rows {group.startRow}–{group.endRow}
                {group.sourceSheet ? ` · Sheet: ${group.sourceSheet}` : ''}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={group.included}
                onChange={(e) => updateGroup(group.id, { included: e.target.checked })}
                className="rounded border-gray-600 bg-gray-800"
              />
              Include in import
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <FormField label="Species / Line">
              <TextInput
                value={group.lineName || group.species}
                onChange={(v) => updateGroup(group.id, { lineName: v, species: v }, 'lineName')}
              />
            </FormField>
            <FormField label="Origin">
              <TextInput
                value={group.origin}
                onChange={(v) => updateGroup(group.id, { origin: v }, 'origin')}
                placeholder="CB, WC, WD"
              />
            </FormField>
            <FormField label="Generation">
              <TextInput
                value={group.generation}
                onChange={(v) => updateGroup(group.id, { generation: v }, 'generation')}
                placeholder="F4, F4+"
              />
            </FormField>
            <FormField label="Notes">
              <TextInput
                value={group.notes}
                onChange={(v) => updateGroup(group.id, { notes: v })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {(
              [
                ['eggs', 'Eggs'],
                ['l1', 'L1'],
                ['l2', 'L2'],
                ['l3', 'L3'],
                ['prePupa', 'Pre-pupa'],
                ['pupa', 'Pupa'],
                ['adult', 'Adult'],
              ] as const
            ).map(([key, label]) => (
              <FormField key={key} label={label}>
                <NumberInput
                  value={group[key]}
                  onChange={(v) => updateCount(group.id, key, v)}
                />
              </FormField>
            ))}
            <FormField label="Total">
              <div className="h-10 flex items-center px-3 rounded-lg bg-gray-800/80 border border-gray-700 text-sm font-semibold text-gray-100">
                {group.total}
              </div>
            </FormField>
          </div>

          {group.validationWarnings.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs font-medium text-amber-300 flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Validation
              </p>
              <ul className="text-[11px] text-amber-200/90 list-disc list-inside space-y-0.5">
                {group.validationWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
