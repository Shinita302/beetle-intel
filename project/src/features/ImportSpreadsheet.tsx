import { Fragment, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FormField, SelectInput, TextInput } from '../components/ui/FormField';
import type { Beetle, GrowthEntry } from '../types';
import {
  parseSpreadsheet,
  interpretRawRows,
  generateRecordsFromConfirmed,
  isDevelopmentalStageLabel,
  ROW_MEANING_OPTIONS,
  FIELD_KEYS,
  rowMeaningLabel,
  type InterpretedRow,
  type ParsedSpreadsheet,
  type RowFieldDraft,
  type RowMeaning,
  type StructuredImportBuild,
} from '../utils/importSpreadsheet';

interface ImportSpreadsheetProps {
  beetles: Beetle[];
  growthEntries: GrowthEntry[];
  onImportConfirmed: (payload: {
    beetles: Beetle[];
    growthEntries: GrowthEntry[];
    speciesInventory?: import('../types').SpeciesInventory[];
  }) => void | Promise<void>;
}

type ImportStep = 'interpret' | 'generate' | 'import';

function confidenceBadgeVariant(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success';
  if (score >= 45) return 'warning';
  return 'danger';
}

function meaningBadgeVariant(meaning: RowMeaning): 'info' | 'warning' | 'neutral' | 'success' | 'danger' {
  if (meaning === 'individual-beetle') return 'success';
  if (meaning === 'group-header') return 'info';
  if (meaning === 'stage-count') return 'warning';
  if (meaning === 'empty') return 'neutral';
  if (meaning === 'uncertain') return 'danger';
  return 'neutral';
}

export function ImportSpreadsheet({ beetles, growthEntries, onImportConfirmed }: ImportSpreadsheetProps) {
  const [step, setStep] = useState<ImportStep>('interpret');
  const [fileName, setFileName] = useState('');
  const [parsedSheet, setParsedSheet] = useState<ParsedSpreadsheet | null>(null);
  const [interpretedRows, setInterpretedRows] = useState<InterpretedRow[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [generated, setGenerated] = useState<StructuredImportBuild | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [imported, setImported] = useState(false);

  const maxCols = useMemo(() => {
    if (!parsedSheet) return 0;
    return Math.max(...parsedSheet.allRows.map((r) => r.cells.length), 1);
  }, [parsedSheet]);

  const stats = useMemo(() => {
    const needsMapping = interpretedRows.filter((r) => r.needs_user_mapping || r.user_meaning === 'uncertain').length;
    const byMeaning = ROW_MEANING_OPTIONS.reduce(
      (acc, opt) => {
        acc[opt.value] = interpretedRows.filter((r) => r.user_meaning === opt.value).length;
        return acc;
      },
      {} as Record<RowMeaning, number>
    );
    return { needsMapping, byMeaning };
  }, [interpretedRows]);

  const handleFileChange = async (file: File | null) => {
    setImported(false);
    setConfirmed(false);
    setFileError('');
    setParsedSheet(null);
    setInterpretedRows([]);
    setGenerated(null);
    setStep('interpret');
    if (!file) return;

    try {
      setLoading(true);
      const parsed = await parseSpreadsheet(file);
      const interpreted = interpretRawRows(parsed);
      setParsedSheet(parsed);
      setInterpretedRows(interpreted);
      setFileName(file.name);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Could not parse uploaded file.');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (index: number, patch: Partial<InterpretedRow>) => {
    setInterpretedRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      if (patch.user_meaning && patch.user_meaning !== 'uncertain') {
        next[index].needs_user_mapping = false;
      }
      return next;
    });
    setGenerated(null);
  };

  const updateRowField = (index: number, field: keyof RowFieldDraft, value: string) => {
    setInterpretedRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        user_fields: { ...next[index].user_fields, [field]: value },
      };
      return next;
    });
    setGenerated(null);
  };

  const applyInheritGroupDownstream = (fromIndex: number) => {
    const group = interpretedRows[fromIndex]?.user_fields.species_or_group;
    if (!group || isDevelopmentalStageLabel(group)) return;
    setInterpretedRows((prev) =>
      prev.map((row, i) => {
        if (i <= fromIndex) return row;
        if (row.user_meaning === 'empty' || row.user_meaning === 'group-header') return row;
        if (row.user_meaning !== 'stage-count' && row.user_meaning !== 'individual-beetle') return row;
        return {
          ...row,
          inherit_group: true,
          user_fields: { ...row.user_fields, species_or_group: row.user_fields.species_or_group || group },
        };
      })
    );
    setGenerated(null);
  };

  const handleGenerateRecords = () => {
    const result = generateRecordsFromConfirmed({
      interpreted: interpretedRows,
      existingBeetles: beetles,
      existingGrowthEntries: growthEntries,
      growthSheets: parsedSheet?.growthSheets ?? [],
      sourceFileName: fileName,
      sheetNames: parsedSheet?.sheetNames ?? [],
    });
    setGenerated(result);
    setStep('generate');
    setConfirmed(false);
  };

  const canImport =
    generated &&
    (generated.speciesInventory.length > 0 ||
      generated.beetles.length > 0 ||
      generated.growthEntries.length > 0);

  const handleConfirmImport = () => {
    if (!generated || !confirmed || !canImport) return;
    onImportConfirmed({
      beetles: generated.beetles,
      growthEntries: generated.growthEntries,
      speciesInventory: generated.speciesInventory,
    });
    setImported(true);
    setStep('import');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Import Spreadsheet</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Rough notes → assisted interpretation → you fix meaning → import. Numbers are never treated as beetle names.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={step === 'interpret' ? 'info' : 'neutral'}>1. Interpret rows</Badge>
        <Badge variant={step === 'generate' ? 'info' : 'neutral'}>2. Generate records</Badge>
        <Badge variant={step === 'import' ? 'success' : 'neutral'}>3. Confirm import</Badge>
      </div>

      <Card>
        <CardHeader title="Upload" subtitle="CSV or Excel (.xlsx)" />
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
        {loading && <Badge variant="info" className="mt-3">Parsing…</Badge>}
        {fileName && <Badge variant="success" className="mt-3">Loaded: {fileName}</Badge>}
        {parsedSheet && parsedSheet.sheetNames.length > 1 && (
          <Badge variant="neutral" className="mt-3 ml-2">
            {parsedSheet.sheetNames.length} worksheets
          </Badge>
        )}
        {parsedSheet && parsedSheet.growthSheets.length > 0 && (
          <Badge variant="info" className="mt-3 ml-2">
            {parsedSheet.growthSheets.length} growth sheet
            {parsedSheet.growthSheets.length === 1 ? '' : 's'} ({parsedSheet.growthSheets.map((s) => s.name).join(', ')})
          </Badge>
        )}
        {fileError && <Badge variant="danger" className="mt-3">{fileError}</Badge>}
      </Card>

      {interpretedRows.length > 0 && (
        <Card>
          <CardHeader
            title="Step 1 — Raw interpretation preview"
            subtitle="Original cells + detected meaning. Nothing is imported yet."
          />
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="info">{interpretedRows.length} rows</Badge>
            <Badge variant="warning">{stats.needsMapping} need user mapping</Badge>
            <Badge variant="neutral">{stats.byMeaning['group-header']} population groups</Badge>
            <Badge variant="neutral">{stats.byMeaning['stage-count']} stage/count rows</Badge>
            <Badge variant="neutral">{stats.byMeaning['individual-beetle']} individual beetles</Badge>
          </div>

          <div className="overflow-x-auto border border-gray-800 rounded-lg max-h-[520px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium w-10">#</th>
                  {Array.from({ length: Math.min(maxCols, 8) }).map((_, i) => (
                    <th key={i} className="text-left py-2 px-2 text-gray-500 font-medium min-w-[90px]">
                      Col {i + 1}
                    </th>
                  ))}
                  <th className="text-left py-2 px-2 text-gray-500 font-medium min-w-[130px]">Detected</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium min-w-[150px]">You choose</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Confidence</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium w-20">Edit</th>
                </tr>
              </thead>
              <tbody>
                {interpretedRows.map((row, index) => (
                  <Fragment key={row.source_row}>
                    <tr
                      key={row.source_row}
                      className={`border-b border-gray-800/50 ${
                        row.needs_user_mapping || row.user_meaning === 'uncertain' ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-2 px-2 text-gray-500 font-mono">{row.source_row}</td>
                      {Array.from({ length: Math.min(maxCols, 8) }).map((_, ci) => (
                        <td key={ci} className="py-2 px-2 text-gray-300 max-w-[120px] truncate">
                          {row.original_cells[ci] || ''}
                        </td>
                      ))}
                      <td className="py-2 px-2">
                        <Badge variant={meaningBadgeVariant(row.detected_meaning)}>
                          {rowMeaningLabel(row.detected_meaning)}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <SelectInput
                          value={row.user_meaning}
                          onChange={(v) => updateRow(index, { user_meaning: v as RowMeaning })}
                          options={ROW_MEANING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="space-y-1">
                          <Badge variant={confidenceBadgeVariant(row.confidence)}>
                            {row.confidence}%
                          </Badge>
                          {row.needs_user_mapping && (
                            <span className="text-[10px] text-amber-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Needs user mapping
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                          className="text-gray-400 hover:text-gray-200"
                        >
                          {expandedRow === index ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === index && (
                      <tr className="bg-gray-900/60 border-b border-gray-800">
                        <td colSpan={Math.min(maxCols, 8) + 5} className="p-4">
                          <p className="text-[11px] text-gray-500 mb-3">{row.detection_notes}</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {FIELD_KEYS.map((field) => (
                              <FormField key={field} label={field.replace(/_/g, ' ')}>
                                <TextInput
                                  value={row.user_fields[field]}
                                  onChange={(v) => updateRowField(index, field, v)}
                                  placeholder={row.suggested_fields[field] || ''}
                                />
                              </FormField>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => updateRow(index, { user_meaning: 'empty' })}
                            >
                              Ignore row
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                updateRow(index, { user_meaning: 'group-header' });
                                if (
                                  row.user_fields.species_or_group &&
                                  !isDevelopmentalStageLabel(row.user_fields.species_or_group)
                                ) {
                                  applyInheritGroupDownstream(index);
                                }
                              }}
                            >
                              Use as group header
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                updateRow(index, { inherit_group: true });
                                applyInheritGroupDownstream(index);
                              }}
                            >
                              Use group for rows below
                            </Button>
                            <label className="flex items-center gap-2 text-xs text-gray-400 ml-2">
                              <input
                                type="checkbox"
                                checked={row.inherit_group}
                                onChange={(e) => updateRow(index, { inherit_group: e.target.checked })}
                                className="rounded border-gray-600 bg-gray-800"
                              />
                              Inherit previous group/species
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <Button type="button" variant="primary" onClick={handleGenerateRecords}>
              <ArrowRight className="w-4 h-4" />
              Generate structured records
            </Button>
          </div>
        </Card>
      )}

      {generated && (
        <Card>
          <CardHeader
            title="Step 2 — Structured records preview"
            subtitle="Created only from rows you confirmed. Review before final import."
          />
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="success">{generated.summary.inventoryGroupsCreated} population groups</Badge>
            <Badge variant="info">{generated.summary.totalPopulation} total population</Badge>
            <Badge variant="neutral">{generated.summary.importedBeetles} individual beetles</Badge>
            <Badge variant="neutral">{generated.stageRecords.length} stage rows parsed</Badge>
            <Badge variant="info">{generated.summary.importedGrowthEntries} growth entries</Badge>
            <Badge variant="neutral">{generated.summary.skippedRows} rows skipped</Badge>
            {generated.summary.sheetsSkipped.length > 0 && (
              <Badge variant="warning">
                {generated.summary.sheetsSkipped.length} sheet(s) skipped:{' '}
                {generated.summary.sheetsSkipped.join(', ')}
              </Badge>
            )}
            {generated.summary.growthSheetsImported.length > 0 && (
              <Badge variant="info">
                Growth tabs: {generated.summary.growthSheetsImported.join(', ')}
              </Badge>
            )}
          </div>

          {generated.validationWarnings.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
              <p className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Validation warnings
              </p>
              <ul className="text-[11px] text-amber-200/90 list-disc list-inside space-y-0.5">
                {generated.validationWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {generated.stageRecords.length > 0 && (
            <div className="overflow-x-auto border border-gray-800 rounded-lg mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="text-left py-2 px-3 text-gray-500">Row</th>
                    <th className="text-left py-2 px-3 text-gray-500">Attached to</th>
                    <th className="text-left py-2 px-3 text-gray-500">Stage</th>
                    <th className="text-left py-2 px-3 text-gray-500">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {generated.stageRecords.slice(0, 25).map((record) => (
                    <tr key={record.source_row} className="border-b border-gray-800/50">
                      <td className="py-2 px-3 text-gray-500 font-mono">{record.source_row}</td>
                      <td className="py-2 px-3 text-gray-200">{record.attachedToGroup || '—'}</td>
                      <td className="py-2 px-3 text-gray-400">{record.stage}</td>
                      <td className="py-2 px-3 text-gray-400">{record.count || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {generated.populationGroups.length > 0 && (
            <div className="space-y-3 mb-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Population groups</p>
              {generated.populationGroups.map((group, i) => (
                <div
                  key={`${group.lineName}-${group.generation}-${i}`}
                  className="rounded-lg border border-gray-800 bg-gray-900/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-100">Population Group</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Species/Line: {group.lineName || group.species}
                        {group.generation ? ` · Generation: ${group.generation}` : ''}
                        {group.origin ? ` · Origin: ${group.origin}` : ''}
                      </p>
                    </div>
                    <Badge variant="success">Total: {group.total}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-300">
                    {group.l1 > 0 && <span>L1: {group.l1}</span>}
                    {group.l2 > 0 && <span>L2: {group.l2}</span>}
                    {group.l3 > 0 && <span>L3: {group.l3}</span>}
                    {group.adult > 0 && <span>Adult: {group.adult}</span>}
                    {group.eggs > 0 && <span>Eggs: {group.eggs}</span>}
                    {group.pupa > 0 && <span>Pupa: {group.pupa}</span>}
                    {group.prePupa > 0 && <span>Pre-Pupa: {group.prePupa}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {generated.beetles.length > 0 && (
          <div className="overflow-x-auto border border-gray-800 rounded-lg mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-500">ID</th>
                  <th className="text-left py-2 px-3 text-gray-500">Name</th>
                  <th className="text-left py-2 px-3 text-gray-500">Species</th>
                  <th className="text-left py-2 px-3 text-gray-500">Sex</th>
                  <th className="text-left py-2 px-3 text-gray-500">Status</th>
                  <th className="text-left py-2 px-3 text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody>
                {generated.beetles.slice(0, 25).map((b) => (
                  <tr key={b.id} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-gray-500 font-mono">{b.id}</td>
                    <td className="py-2 px-3 text-gray-200">{b.name}</td>
                    <td className="py-2 px-3 text-gray-400">{b.species || '—'}</td>
                    <td className="py-2 px-3 text-gray-400">{b.sex}</td>
                    <td className="py-2 px-3 text-gray-400">{b.status}</td>
                    <td className="py-2 px-3 text-gray-500 max-w-[200px] truncate" title={b.notes}>
                      {b.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {generated.speciesInventory.length > 0 && (
            <div className="overflow-x-auto border border-gray-800 rounded-lg mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="text-left py-2 px-3 text-gray-500">Species</th>
                    <th className="text-right py-2 px-3 text-gray-500">Eggs</th>
                    <th className="text-right py-2 px-3 text-gray-500">L1</th>
                    <th className="text-right py-2 px-3 text-gray-500">L2</th>
                    <th className="text-right py-2 px-3 text-gray-500">L3</th>
                    <th className="text-right py-2 px-3 text-gray-500">Pre-Pupa</th>
                    <th className="text-right py-2 px-3 text-gray-500">Pupa</th>
                    <th className="text-right py-2 px-3 text-gray-500">Adult</th>
                    <th className="text-right py-2 px-3 text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {generated.speciesInventory.map((row) => (
                    <tr key={row.id} className="border-b border-gray-800/50">
                      <td className="py-2 px-3 text-gray-200">
                        {row.lineName || row.species}
                        {row.generation ? ` (${row.generation})` : ''}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-400">{row.eggs || '—'}</td>
                      <td className="py-2 px-3 text-right text-gray-400">{row.l1 || '—'}</td>
                      <td className="py-2 px-3 text-right text-gray-400">{row.l2 || '—'}</td>
                      <td className="py-2 px-3 text-right text-gray-400">{row.l3 || '—'}</td>
                      <td className="py-2 px-3 text-right text-gray-400">{row.prePupa || '—'}</td>
                      <td className="py-2 px-3 text-right text-gray-400">{row.pupa || '—'}</td>
                      <td className="py-2 px-3 text-right text-gray-400">{row.adult || '—'}</td>
                      <td className="py-2 px-3 text-right text-gray-200 font-medium">
                        {row.eggs + row.l1 + row.l2 + row.l3 + row.prePupa + row.pupa + row.adult}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {generated.beetles.length > 25 && (
            <p className="text-[11px] text-gray-500 mb-4">Showing first 25 of {generated.beetles.length} beetles.</p>
          )}

          <CardHeader title="Step 3 — Confirm import" />
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800"
              />
              I reviewed row meanings and structured records. Import into BeetleIntel.
            </label>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmImport}
              disabled={!confirmed || !canImport}
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm import
            </Button>
            {imported && generated && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1">
                <p className="text-sm font-medium text-emerald-300 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Import complete
                </p>
                <ul className="text-xs text-emerald-200/90 space-y-0.5">
                  <li>{generated.summary.inventoryGroupsCreated} population group(s) created</li>
                  <li>{generated.summary.totalPopulation} total population imported</li>
                  <li>{generated.summary.importedBeetles} individual beetle(s) imported</li>
                  <li>{generated.summary.importedGrowthEntries} growth record(s) imported</li>
                  <li>{generated.summary.skippedRows} row(s) skipped</li>
                  {generated.summary.sheetsSkipped.length > 0 && (
                    <li>Sheets skipped: {generated.summary.sheetsSkipped.join(', ')}</li>
                  )}
                  {generated.validationWarnings.length > 0 && (
                    <li>{generated.validationWarnings.length} warning(s) — review above</li>
                  )}
                </ul>
              </div>
            )}
            {imported && !generated && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <FileSpreadsheet className="w-4 h-4" />
                Import complete.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
