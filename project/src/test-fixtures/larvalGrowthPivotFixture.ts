/** Breeder layout: larva ID per row, measurement dates as column headers. */
export const LARVAL_GROWTH_WIDE_SHEET = {
  name: 'Larval Growth',
  rows: [
    ['ID', '10/03/2025', '14/06/2025'],
    ['B-1', '10g', '25g'],
    ['B-2', '12g', '28g'],
    ['B-3', '11g', '26g'],
    ['B-35', '', ''],
    ['B-36', '', ''],
  ],
};

/** Pivot larval growth layout: dates in rows, B-1…B-N as column headers. */
export const LARVAL_GROWTH_PIVOT_SHEET = {
  name: 'Larval Growth',
  rows: [
    ['Date', 'B-1', 'B-2', 'B-3', 'B-4', 'B-5'],
    ['2025-06-01', '10g', '12g', '11g', '', '15g'],
    ['2025-06-15', '25g', '28g', '26g', '20g', '30g'],
    ['2025-07-01', '40g', '42g', '', '38g', '45g'],
  ],
};

/** Subset simulating B-35…B-40 block from breeder workbook. */
export const LARVAL_GROWTH_PARTIAL_PIVOT = {
  name: 'Larval Growth',
  rows: [
    ['Date', 'B-35', 'B-36', 'B-37', 'B-38', 'B-39', 'B-40'],
    ['2025-06-01', '80g', '75g', '82g', '78g', '81g', '79g'],
    ['2025-06-15', '95g', '90g', '98g', '92g', '96g', '94g'],
  ],
};

/** Long format with explicit beetle ID column. */
export const LARVAL_GROWTH_LONG_SHEET = {
  name: 'DHH',
  rows: [
    ['Date', 'Beetle ID', 'Weight (g)', 'Stage'],
    ['2026-05-19', 'B-40', '35g', 'L3'],
    ['2026-06-01', 'B-40', '42g', 'L3'],
    ['2026-05-20', 'B-1', '12g', 'L2'],
    ['2026-06-02', 'B-1', '18g', 'L3'],
  ],
};
