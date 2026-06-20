import { describe, expect, it } from 'vitest';
import {
  detectDevelopmentalStage,
  generateRecordsFromConfirmed,
  interpretRawRows,
  type InterpretedRow,
  type ParsedSpreadsheet,
} from './importSpreadsheet';
import {
  parseGenerationFromStageLabel,
  parseStageLabelToLifecycle,
} from './spreadsheetMetrics';
import { totalInstarLarvaeInventory, totalPopulationInventory } from '@/types';
import { beetleCountTrend, larvalActivityTrend } from './dashboardMetrics';
import { clearAllAppDataFromStorage } from './clearAppData';
import { STORAGE_KEYS, userStorageKey } from '@/constants/storageKeys';

function mockParsed(rows: string[][], sheet = 'Inventory'): ParsedSpreadsheet {
  const allRows = rows.map((cells, i) => ({
    source_row: i + 1,
    source_sheet: sheet,
    cells,
    raw_text: cells.filter(Boolean).join(' | '),
  }));
  return {
    headers: rows[0] ?? [],
    rows: allRows,
    allRows,
    style: 'block-notes',
    growthSheets: [],
    sheetNames: [sheet],
  };
}

function herculesBlock(): InterpretedRow[] {
  return interpretRawRows(
    mockParsed([
      ['Hercules Hercules', 'headcount', 'adult(F4)', 'Unknown Origin', 'CB'],
      ['L1', '106'],
      ['L2', '87'],
      ['L3', '34'],
      ['adult(F4)', '24'],
    ])
  );
}

describe('stage mapping', () => {
  it('maps adult(F4) to adult lifecycle stage', () => {
    expect(parseStageLabelToLifecycle('adult(F4)')).toBe('adult');
  });

  it('extracts generation F4 from adult(F4)', () => {
    expect(parseGenerationFromStageLabel('adult(F4)')).toBe('F4');
    expect(parseGenerationFromStageLabel('adult(F4+)')).toBe('F4+');
  });

  it('detectDevelopmentalStage treats adult(F4) as adult not larva', () => {
    const stage = detectDevelopmentalStage('adult(F4)');
    expect(stage?.beetleStatus).toBe('adult');
    expect(stage?.generation).toBe('F4');
    expect(stage?.instar).toBe('');
  });

  it('maps L1/L2/L3 labels to instar stages', () => {
    expect(detectDevelopmentalStage('L1')?.instar).toBe('L1');
    expect(detectDevelopmentalStage('L2')?.instar).toBe('L2');
    expect(detectDevelopmentalStage('L3')?.instar).toBe('L3');
  });
});

describe('row classification', () => {
  it('classifies headcount species header as population group, not individual beetle', () => {
    const interpreted = herculesBlock();
    expect(interpreted[0].user_meaning).toBe('group-header');
    expect(interpreted[0].user_meaning).not.toBe('individual-beetle');
    expect(interpreted[1].user_meaning).toBe('stage-count');
  });
});

describe('generateRecordsFromConfirmed', () => {
  it('imports L1/L2/L3 and adult counts into inventory group without creating 251 beetles', () => {
    const interpreted = herculesBlock();
    const result = generateRecordsFromConfirmed({
      interpreted,
      existingBeetles: [],
      existingGrowthEntries: [],
      sourceFileName: 'breeder.xlsx',
      sheetNames: ['Inventory'],
    });

    expect(result.beetles).toHaveLength(0);
    expect(result.summary.inventoryGroupsCreated).toBe(1);
    expect(result.summary.totalPopulation).toBe(251);
    expect(result.speciesInventory[0].l1).toBe(106);
    expect(result.speciesInventory[0].l2).toBe(87);
    expect(result.speciesInventory[0].l3).toBe(34);
    expect(result.speciesInventory[0].adult).toBe(24);
    expect(result.populationGroups[0].generation).toMatch(/F4/);
  });

  it('imports individual beetles only when explicit ID is present', () => {
    const interpreted = interpretRawRows(
      mockParsed([
        ['B-001', 'DHH', 'Male', 'Adult', 'Titan'],
      ])
    );
    expect(interpreted[0].user_meaning).toBe('individual-beetle');

    const result = generateRecordsFromConfirmed({
      interpreted,
      existingBeetles: [],
      existingGrowthEntries: [],
    });
    expect(result.beetles).toHaveLength(1);
    expect(result.speciesInventory).toHaveLength(0);
  });

  it('imports growth sheets alongside inventory rows', () => {
    const interpreted = herculesBlock();
    const growthRows = [
      { source_row: 1, source_sheet: 'DHH', cells: ['Date', 'Weight (g)', 'Stage'], raw_text: 'Date | Weight (g) | Stage' },
      { source_row: 2, source_sheet: 'DHH', cells: ['2024-01-15', '12g', 'L2'], raw_text: '2024-01-15 | 12g | L2' },
    ];
    const result = generateRecordsFromConfirmed({
      interpreted,
      existingBeetles: [],
      existingGrowthEntries: [],
      growthSheets: [{ name: 'DHH', rows: growthRows }],
      sheetNames: ['Inventory', 'DHH'],
    });

    expect(result.summary.growthSheetsImported).toEqual(['DHH']);
    expect(result.summary.importedGrowthEntries).toBeGreaterThan(0);
    expect(result.summary.totalPopulation).toBe(251);
  });
});

describe('dashboard totals', () => {
  it('matches inventory total population sum', () => {
    const interpreted = herculesBlock();
    const { speciesInventory } = generateRecordsFromConfirmed({
      interpreted,
      existingBeetles: [],
      existingGrowthEntries: [],
    });

    const dashboardTotal = totalPopulationInventory(speciesInventory);
    const activeLarvae = totalInstarLarvaeInventory(speciesInventory);
    expect(dashboardTotal).toBe(251);
    expect(activeLarvae).toBe(227);
    expect(speciesInventory[0].adult).toBe(24);
  });

  it('returns null trends when all data is cleared', () => {
    expect(beetleCountTrend([])).toBeNull();
    expect(larvalActivityTrend([], [])).toBeNull();
  });
});

describe('DELETE ALL storage cleanup', () => {
  it('clears user-scoped inventory and growth keys', () => {
    const userId = 'test-user';
    const store: Record<string, string> = {};
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
      },
    });

    for (const baseKey of Object.values(STORAGE_KEYS)) {
      store[userStorageKey(baseKey, userId)] = 'data';
      store[baseKey] = 'legacy';
    }

    clearAllAppDataFromStorage(userId);

    for (const baseKey of Object.values(STORAGE_KEYS)) {
      expect(store[userStorageKey(baseKey, userId)]).toBeUndefined();
      expect(store[baseKey]).toBeUndefined();
    }

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    });
  });
});
