export interface GrowthImportSkippedRow {
  sourceRow: number;
  sourceSheet?: string;
  reason: string;
  rawText?: string;
}

export interface GrowthImportAudit {
  sheetsProcessed: string[];
  expectedBeetleIds: string[];
  importedBeetleIds: string[];
  missingBeetleIds: string[];
  excelGrowthRecordCount: number;
  importedGrowthRecordCount: number;
  skippedRows: GrowthImportSkippedRow[];
  warnings: string[];
}
