export interface RawSheetRow {
  source_row: number;
  source_sheet?: string;
  cells: string[];
  raw_text: string;
}
