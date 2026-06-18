import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Save, Search } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { FormField, TextInput, NumberInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import {
  activeLarvaeCount,
  emptySpeciesInventory,
  speciesInventoryTotal,
  type SpeciesInventory,
  type SpeciesInventoryStageKey,
} from '../types';
import { Bug, Egg, Sprout, Users } from 'lucide-react';

interface InventoryProps {
  speciesInventory: SpeciesInventory[];
  onUpdate: (rows: SpeciesInventory[]) => void;
  onUpsert: (row: SpeciesInventory) => void;
}

type SortKey = 'species' | SpeciesInventoryStageKey | 'total';
type SortDir = 'asc' | 'desc';

const STAGE_COLUMNS: { key: SpeciesInventoryStageKey; label: string }[] = [
  { key: 'eggs', label: 'Eggs' },
  { key: 'l1', label: 'L1' },
  { key: 'l2', label: 'L2' },
  { key: 'l3', label: 'L3' },
  { key: 'prePupa', label: 'Pre-Pupa' },
  { key: 'pupa', label: 'Pupa' },
  { key: 'adult', label: 'Adult' },
];

const PAGE_SIZE = 8;

({ speciesInventory, onUpdate, onUpsert }: InventoryProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('species');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [newSpecies, setNewSpecies] = useState('');
  const [draft, setDraft] = useState<SpeciesInventory | null>(null);

  const summary = useMemo(() => {
    const totalSpecies = speciesInventory.length;
    const totalPopulation = speciesInventory.reduce((sum, row) => sum + speciesInventoryTotal(row), 0);
    const activeLarvae = speciesInventory.reduce((sum, row) => sum + activeLarvaeCount(row), 0);
    const adults = speciesInventory.reduce((sum, row) => sum + row.adult, 0);
    return { totalSpecies, totalPopulation, activeLarvae, adults };
  }, [speciesInventory]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = query
      ? speciesInventory.filter((row) => row.species.toLowerCase().includes(query))
      : [...speciesInventory];

    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'species') {
        return a.species.localeCompare(b.species) * dir;
      }
      if (sortKey === 'total') {
        return (speciesInventoryTotal(a) - speciesInventoryTotal(b)) * dir;
      }
      return (a[sortKey] - b[sortKey]) * dir;
    });

    return rows;
  }, [speciesInventory, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'species' ? 'asc' : 'desc');
    }
    setPage(0);
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const startAdd = () => {
    setShowAdd(true);
    setNewSpecies('');
    setDraft(null);
  };

  const startEdit = (row: SpeciesInventory) => {
    setDraft({ ...row });
    setShowAdd(false);
  };

  const saveDraft = () => {
    if (!draft) return;
    onUpsert({ ...draft, updatedAt: new Date().toISOString().slice(0, 10) });
    setDraft(null);
  };

  const addSpecies = () => {
    const species = newSpecies.trim();
    if (!species) return;
    const row = emptySpeciesInventory(species, `INV-${Date.now()}`);
    onUpsert(row);
    setNewSpecies('');
    setShowAdd(false);
  };

  const deleteRow = (species: string) => {
    onUpdate(speciesInventory.filter((row) => row.species !== species));
    if (draft?.species === species) setDraft(null);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection-level population counts by species</p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={startAdd}>
          <Plus className="w-4 h-4" />
          Add Species
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Species" value={summary.totalSpecies} icon={Bug} color="bg-sky-500/15 text-sky-400" />
        <StatCard label="Total Population" value={summary.totalPopulation} icon={Users} color="bg-teal-500/15 text-teal-400" />
        <StatCard label="Active Larvae" value={summary.activeLarvae} icon={Sprout} color="bg-emerald-500/15 text-emerald-400" />
        <StatCard label="Adults" value={summary.adults} icon={Egg} color="bg-amber-500/15 text-amber-400" />
      </div>

      {showAdd && (
        <Card>
          <CardHeader title="Add Species" subtitle="Start tracking a new species in your collection" />
          <div className="flex flex-wrap gap-3 items-end">
            <FormField label="Species name" className="flex-1 min-w-[220px]">
              <TextInput
                value={newSpecies}
                onChange={setNewSpecies}
                placeholder="e.g. Dorcus titanus palawanicus"
              />
            </FormField>
            <Button type="button" variant="primary" onClick={addSpecies}>
              <Save className="w-4 h-4" />
              Add
            </Button>
          </div>
        </Card>
      )}

      {draft && (
        <Card>
          <CardHeader title={`Edit: ${draft.species}`} subtitle="Update population counts" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {STAGE_COLUMNS.map(({ key, label }) => (
              <FormField key={key} label={label}>
                <NumberInput
                  value={draft[key]}
                  onChange={(v) => setDraft((prev) => (prev ? { ...prev, [key]: v } : prev))}
                  min={0}
                  step={1}
                />
              </FormField>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button type="button" variant="primary" size="sm" onClick={saveDraft}>
              <Save className="w-4 h-4" />
              Save counts
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <CardHeader title="Population Table" subtitle={`${filtered.length} species`} />
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search species…"
              className="w-full bg-gray-800/80 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 pr-3">
                  <button type="button" className="text-gray-500 font-medium hover:text-gray-300" onClick={() => toggleSort('species')}>
                    Species{sortIndicator('species')}
                  </button>
                </th>
                {STAGE_COLUMNS.map(({ key, label }) => (
                  <th key={key} className="text-right py-2 px-2">
                    <button type="button" className="text-gray-500 font-medium hover:text-gray-300" onClick={() => toggleSort(key)}>
                      {label}{sortIndicator(key)}
                    </button>
                  </th>
                ))}
                <th className="text-right py-2 pl-2">
                  <button type="button" className="text-gray-500 font-medium hover:text-gray-300" onClick={() => toggleSort('total')}>
                    Total{sortIndicator('total')}
                  </button>
                </th>
                <th className="text-right py-2 pl-2 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="border-b border-gray-800/50 hover:bg-gray-900/40">
                  <td className="py-2.5 pr-3 text-gray-200 font-medium max-w-[200px] truncate" title={row.species}>
                    {row.species}
                  </td>
                  {STAGE_COLUMNS.map(({ key }) => (
                    <td key={key} className="py-2.5 px-2 text-right text-gray-400 tabular-nums">
                      {row[key] || '—'}
                    </td>
                  ))}
                  <td className="py-2.5 pl-2 text-right text-sky-400 font-semibold tabular-nums">
                    {speciesInventoryTotal(row)}
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="text-sky-400 hover:text-sky-300" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button type="button" className="text-red-400/80 hover:text-red-300" onClick={() => deleteRow(row.species)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-600">
                    No species inventory yet. Add a species to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500">
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {speciesInventory.length > 0 && (
          <p className="text-[11px] text-gray-600 mt-3">Last updated counts reflect your most recent edits.</p>
        )}
      </Card>
    </div>
  );
}
