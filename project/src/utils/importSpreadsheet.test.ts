import { describe, expect, it } from 'vitest';
import {
  detectDevelopmentalStage,
  generateRecordsFromConfirmed,
  interpretRawRows,
  type ParsedSpreadsheet,
} from './importSpreadsheet';
import {
  parseGenerationFromStageLabel,
  parseStageLabelToLifecycle,
} from './spreadsheetMetrics';
import {
  totalAdultsInventory,
  totalInstarLarvaeInventory,
  totalPopulationInventory,
} from '@/types';
import { beetleCountTrend, larvalActivityTrend } from './dashboardMetrics';
import { clearAllAppDataFromStorage } from './clearAppData';
import { STORAGE_KEYS, userStorageKey } from '@/constants/storageKeys';
import {
  GIRAFFE_ADULT_BLOCK,
  GIRAFFE_WITH_OBSERVATION,
  HERCULES_F4_BLOCK,
  TRACKING_NOTE_GROWTH_SHEET,
  TRACKING_NOTE_INVENTORY_ROWS,
} from '@/test-fixtures/trackingNoteFixture';

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

function growthRowsFromFixture() {
  return TRACKING_NOTE_GROWTH_SHEET.rows.map((cells, i) => ({
    source_row: i + 1,
    source_sheet: TRACKING_NOTE_GROWTH_SHEET.name,
    cells,
    raw_text: cells.join(' | '),
  }));
}

describe('stage mapping', () => {
  it('maps adult(F4) to adult lifecycle stage', () => {
    expect(parseStageLabelToLifecycle('adult(F4)')).toBe('adult');
    expect(parseStageLabelToLifecycle('adult')).toBe('adult');
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

  it('maps plain adult label to adult_count key', () => {
    expect(detectDevelopmentalStage('adult')?.beetleStatus).toBe('adult');
  });
});

describe('Tracking note fixture — Giraffe.K adult header', () => {
  it('maps adult header numeric row to adult_count not L1/L3', () => {
    const interpreted = interpretRawRows(mockParsed(GIRAFFE_ADULT_BLOCK));
    expect(interpreted[0].user_meaning).toBe('group-header');
    expect(interpreted[0].user_fields.species_or_group).toBe('Giraffe.K');
    expect(interpreted[0].user_fields.generation).toBe('');
    expect(interpreted[1].user_fields.stage_status).toMatch(/adult/i);
    expect(interpreted[1].user_fields.count).toBe('12');

    const result = generateRecordsFromConfirmed({
      interpreted,
      existingBeetles: [],
      existingGrowthEntries: [],
    });

    expect(result.beetles).toHaveLength(0);
    expect(result.speciesInventory[0].adult).toBe(12);
    expect(result.speciesInventory[0].l1).toBe(45);
    expect(result.speciesInventory[0].l2).toBe(30);
    expect(result.speciesInventory[0].l3).toBe(0);
    expect(result.speciesInventory[0].lineName).toBe('Giraffe.K');
    expect(result.speciesInventory[0].origin).toBe('CB');
    expect(result.speciesInventory[0].generation).toBe('');
  });

  it('treats observation rows as notes, not population groups', () => {
    const interpreted = interpretRawRows(mockParsed(GIRAFFE_WITH_OBSERVATION));
    const observation = interpreted.find((r) => r.original_cells[0]?.includes('May 19th'));
    expect(observation?.user_meaning).toBe('note');

    const result = generateRecordsFromConfirmed({
      interpreted,
      existingBeetles: [],
      existingGrowthEntries: [],
    });
    expect(result.summary.inventoryGroupsCreated).toBe(1);
    expect(result.speciesInventory.some((row) => row.species.includes('May 19th'))).toBe(false);
  });
});

describe('Tracking note fixture — full inventory + growth', () => {
  it('imports inventory and growth without individual beetles', () => {
    const interpreted = interpretRawRows(mockParsed(TRACKING_NOTE_INVENTORY_ROWS));
    const result = generateRecordsFromConfirmed({
      interpreted,
      existingBeetles: [],
      existingGrowthEntries: [],
      growthSheets: [{ name: TRACKING_NOTE_GROWTH_SHEET.name, rows: growthRowsFromFixture() }],
      sheetNames: ['Inventory', TRACKING_NOTE_GROWTH_SHEET.name, 'Notes'],
      sourceFileName: 'Tracking note 2026 May-Jun.xlsx',
    });

    expect(result.beetles).toHaveLength(0);
    expect(result.summary.inventoryGroupsCreated).toBe(2);
    expect(result.summary.importedGrowthEntries).toBeGreaterThan(0);
    expect(result.summary.growthSheetsImported).toEqual(['DHH']);
    expect(result.summary.sheetsSkipped).toContain('Notes');

    const inventoryTotal = totalPopulationInventory(result.speciesInventory);
    expect(result.summary.totalPopulation).toBe(inventoryTotal);
    expect(inventoryTotal).toBe(12 + 45 + 30 + 251);
  });
});

describe('Hercules F4 block', () => {
  it('imports L1/L2/L3 and adult counts without creating individual beetles', () => {
    const interpreted = interpretRawRows(mockParsed(HERCULES_F4_BLOCK));
    const result = generateRecordsFromConfirmed({
      interpreted,
      existingBeetles: [],
      existingGrowthEntries: [],
    });

    expect(result.beetles).toHaveLength(0);
    expect(result.summary.totalPopulation).toBe(251);
    expect(result.speciesInventory[0].l1).toBe(106);
    expect(result.speciesInventory[0].l2).toBe(87);
    expect(result.speciesInventory[0].l3).toBe(34);
    expect(result.speciesInventory[0].adult).toBe(24);
    expect(result.populationGroups[0].generation).toBe('F4');
  });
});

describe('dashboard totals', () => {
  it('matches inventory total, instar larvae, and adults', () => {
    const interpreted = interpretRawRows(mockParsed(TRACKING_NOTE_INVENTORY_ROWS));
    const { speciesInventory } = generateRecordsFromConfirmed({
      interpreted,
      existingBeetles: [],
      existingGrowthEntries: [],
    });

    expect(totalPopulationInventory(speciesInventory)).toBe(12 + 45 + 30 + 251);
    expect(totalInstarLarvaeInventory(speciesInventory)).toBe(45 + 30 + 106 + 87 + 34);
    expect(totalAdultsInventory(speciesInventory)).toBe(12 + 24);
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
