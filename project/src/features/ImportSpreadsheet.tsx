import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import type { Beetle, GrowthEntry, SpeciesInventory } from '../types';
import type { EditableImportGroup, HybridImportResult } from '@/types/hybridImport';
import { ImportGroupEditor } from './ImportGroupEditor';
import {
  parseSpreadsheet,
  generateRecordsFromConfirmed,
  rowMeaningLabel,
  type InterpretedRow,
  type ParsedSpreadsheet,
  type RowMeaning,
} from '../utils/importSpreadsheet';
import {
  editableGroupsToSpeciesInventory,
  runHybridImportPipeline,
} from '../utils/hybridImportPipeline';
import { totalPopulationInventory } from '@/types';

interface ImportSpreadsheetProps {
  beetles: Beetle[];
  growthEntries: GrowthEntry[];
  userId?: string;
  onImportConfirmed: (payload: {
    beetles: Beetle[];
    growthEntries: GrowthEntry[];
    speciesInventory?: SpeciesInventory[];
  }) => void | Promise<void>;
}

type ImportStep = 'parse' | 'review' | 'done';

function meaningBadgeVariant(meaning: RowMeaning): 'info' | 'warning' | 'neutral' | 'success' | 'danger' {
  if (meaning === 'individual-beetle') return 'success';
  if (meaning === 'group-header') return 'info';
  if (meaning === 'stage-count') return 'warning';
  if (meaning === 'empty') return 'neutral';
  if (meaning === 'uncertain') return 'danger';
  return 'neutral';
}

export function ImportSpreadsheet({ beetles, growthEntries, userId, onImportConfirmed }: ImportSpreadsheetProps) {
  const [step, setStep] = useState<ImportStep>('parse');
  const [fileName, setFileName] = useState('');
  const [parsedSheet, setParsedSheet] = useState<ParsedSpreadsheet | null>(null);
  const [hybridResult, setHybridResult] = useState<HybridImportResult | null>(null);
  const [editableGroups, setEditableGroups] = useState<EditableImportGroup[]>([]);
  const [interpretedRows, setInterpretedRows] = useState<InterpretedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const includedGroups = useMemo(
    () => editableGroups.filter((group) => group.included),
    [editableGroups]
  );

  const previewInventory = useMemo(
    () => editableGroupsToSpeciesInventory(includedGroups, fileName),
    [includedGroups, fileName]
  );

  const totalPopulation = totalPopulationInventory(previewInventory);

  const handleFileChange = async (file: File | null) => {
    setConfirmed(false);
    setFileError('');
    setParsedSheet(null);
    setHybridResult(null);
    setEditableGroups([]);
    setInterpretedRows([]);
    setStep('parse');
    if (!file) return;

    try {
      setLoading(true);
      const parsed = await parseSpreadsheet(file);
      const hybrid = await runHybridImportPipeline({
        parsed,
        fileName: file.name,
        userId,
        useLlmFallback: true,
      });
      setParsedSheet(parsed);
      setHybridResult(hybrid);
      setEditableGroups(hybrid.groups);
      setInterpretedRows(hybrid.interpreted);
      setFileName(file.name);
      setStep('review');
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Could not parse uploaded file.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!confirmed || !parsedSheet) return;
    const hasPayload =
      includedGroups.length > 0 ||
      (hybridResult?.growthEntryCount ?? 0) > 0 ||
      (hybridResult?.individualBeetleCount ?? 0) > 0;
    if (!hasPayload) return;

    const speciesInventory =
      includedGroups.length > 0 ? editableGroupsToSpeciesInventory(includedGroups, fileName) : undefined;
    const sideEffects = generateRecordsFromConfirmed({
      interpreted: interpretedRows.filter((row) => row.user_meaning === 'individual-beetle'),
      existingBeetles: beetles,
      existingGrowthEntries: growthEntries,
      growthSheets: parsedSheet.growthSheets,
      sourceFileName: fileName,
      sheetNames: parsedSheet.sheetNames,
    });

    await onImportConfirmed({
      beetles: sideEffects.beetles,
      growthEntries: sideEffects.growthEntries,
      speciesInventory,
    });
    setStep('done');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge variant={step === 'parse' ? 'info' : 'neutral'}>1. Parse spreadsheet</Badge>
        <Badge variant={step === 'review' ? 'info' : 'neutral'}>2. Review & edit groups</Badge>
        <Badge variant={step === 'done' ? 'success' : 'neutral'}>3. Import</Badge>
      </div>

      <Card>
        <CardHeader
          title="Upload"
          subtitle="Hybrid import: deterministic rules first, optional LLM for messy blocks"
        />
        <label className="block">
          <input
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
          <div className="border border-dashed border-gray-700 rounded-lg p-5 text-center cursor-pointer hover:border-sky-500/40 hover:bg-sky-500/5 transition-colors">
            <Upload className="w-5 h-5 text-sky-400 mx-auto mb-2" />
            <p className="text-sm text-gray-300">Click to choose spreadsheet</p>
          </div>
        </label>
        {loading && <Badge variant="info" className="mt-3">Parsing blocks…</Badge>}
        {fileName && <Badge variant="success" className="mt-3">Loaded: {fileName}</Badge>}
        {fileError && <Badge variant="danger" className="mt-3">{fileError}</Badge>}
      </Card>

      {hybridResult && step !== 'parse' && (
        <>
          <Card>
            <CardHeader title="Import summary" subtitle="Automatic block detection + validation" />
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="success">{includedGroups.length} population groups</Badge>
              <Badge variant="info">{totalPopulation} total population</Badge>
              <Badge variant="neutral">{hybridResult.individualBeetleCount} individual beetles</Badge>
              <Badge variant="info">{hybridResult.growthEntryCount} growth records</Badge>
              <Badge variant="neutral">{hybridResult.skippedNotes.length} notes skipped</Badge>
              {hybridResult.usedLlmFallback && <Badge variant="info">LLM fallback used</Badge>}
              {hybridResult.sheetsSkipped.length > 0 && (
                <Badge variant="warning">Skipped sheets: {hybridResult.sheetsSkipped.join(', ')}</Badge>
              )}
            </div>
            {hybridResult.skippedNotes.length > 0 && (
              <p className="text-xs text-gray-500">
                Observation notes kept out of inventory: {hybridResult.skippedNotes.slice(0, 3).join(' · ')}
                {hybridResult.skippedNotes.length > 3 ? '…' : ''}
              </p>
            )}
            {hybridResult.groupAudit.length > 0 && (
              <div className="mt-4 overflow-x-auto border border-gray-800 rounded-lg max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 px-2 text-gray-500">Species</th>
                      <th className="text-left py-2 px-2 text-gray-500">Counts</th>
                      <th className="text-left py-2 px-2 text-gray-500">Status</th>
                      <th className="text-left py-2 px-2 text-gray-500">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hybridResult.groupAudit.map((entry, index) => (
                      <tr key={`${entry.sourceRow}-${entry.species}-${index}`} className="border-b border-gray-800/50">
                        <td className="py-2 px-2 text-gray-200">
                          {entry.lineName || entry.species}
                          <span className="block text-gray-500 font-mono">row {entry.sourceRow}</span>
                        </td>
                        <td className="py-2 px-2 text-gray-400 font-mono">
                          {entry.total > 0
                            ? `E${entry.eggs} L1${entry.l1} L2${entry.l2} L3${entry.l3} Pp${entry.prePupa} Pu${entry.pupa} A${entry.adult} = ${entry.total}`
                            : '—'}
                        </td>
                        <td className="py-2 px-2">
                          <Badge
                            variant={
                              entry.status === 'imported'
                                ? 'success'
                                : entry.status === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {entry.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-gray-400">{entry.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Population groups"
              subtitle="Edit any field before import — corrections are remembered for future files"
            />
            <ImportGroupEditor groups={editableGroups} userId={userId} onChange={setEditableGroups} />
          </Card>

          <Card>
            <CardHeader title="Confirm import" />
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800"
                />
                I reviewed population groups. Import {totalPopulation} total population into BeetleIntel.
              </label>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmImport}
                disabled={
                  !confirmed ||
                  (includedGroups.length === 0 &&
                    (hybridResult?.growthEntryCount ?? 0) === 0 &&
                    (hybridResult?.individualBeetleCount ?? 0) === 0)
                }
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm import
              </Button>
              {step === 'done' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <FileSpreadsheet className="w-4 h-4" />
                  Import complete — dashboard totals will match inventory ({totalPopulation}).
                </div>
              )}
            </div>
          </Card>

          <Card>
            <button
              type="button"
              className="w-full flex items-center justify-between text-left"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              <CardHeader title="Advanced row mapping" subtitle="Optional — raw parser labels per row" />
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {showAdvanced && (
              <div className="overflow-x-auto border border-gray-800 rounded-lg max-h-80 overflow-y-auto mt-2">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 px-2 text-gray-500">#</th>
                      <th className="text-left py-2 px-2 text-gray-500">Cells</th>
                      <th className="text-left py-2 px-2 text-gray-500">Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interpretedRows.map((row) => (
                      <tr key={row.source_row} className="border-b border-gray-800/50">
                        <td className="py-2 px-2 text-gray-500 font-mono">{row.source_row}</td>
                        <td className="py-2 px-2 text-gray-300 truncate max-w-md">
                          {row.original_cells.filter(Boolean).join(' | ')}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={meaningBadgeVariant(row.user_meaning)}>
                            {rowMeaningLabel(row.user_meaning)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {!hybridResult && !loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowRight className="w-4 h-4" />
          Upload a breeder inventory sheet to begin hybrid import.
        </div>
      )}
    </div>
  );
}
