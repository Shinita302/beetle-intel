/** Fixture rows modeled on Tracking note 2026 May-Jun.xlsx breeder inventory sheets. */
export const GIRAFFE_ADULT_BLOCK = [
  ['Giraffe.K', 'headcount', 'adult', 'CB'],
  ['12'],
  ['L1', '45'],
  ['L2', '30'],
];

export const GIRAFFE_WITH_OBSERVATION = [
  ...GIRAFFE_ADULT_BLOCK,
  ['May 19th: 35mm female'],
];

export const HERCULES_F4_BLOCK = [
  ['Hercules Hercules', 'headcount', 'adult(F4)', 'Unknown Origin', 'CB'],
  ['L1', '106'],
  ['L2', '87'],
  ['L3', '34'],
  ['adult(F4)', '24'],
];

export const LAMPRIMA_BLOCK = [
  ['lamprima adolphinae', 'headcount', 'adult', 'CB'],
  ['16'],
];

export const CALCOSOMA_CB_BLOCK = [
  ['Calcosoma.M', 'CB'],
  ['L1', '20'],
  ['adult', '5'],
];

export const HPERRyi_ADULT_ONLY_BLOCK = [
  ['H.Perryi', 'headcount', 'adult', 'WC'],
  ['8'],
];

export const MUSIMON_EGG_PUPA_BLOCK = [
  ['Musimon', 'headcount', 'CB'],
  ['eggs', '12'],
  ['pupa', '4'],
];

/** Six-species fixture matching common Tracking note inventory layouts. */
export const SIX_SPECIES_INVENTORY_ROWS = [
  ...LAMPRIMA_BLOCK,
  ...HERCULES_F4_BLOCK,
  ...GIRAFFE_ADULT_BLOCK,
  ...CALCOSOMA_CB_BLOCK,
  ...HPERRyi_ADULT_ONLY_BLOCK,
  ...MUSIMON_EGG_PUPA_BLOCK,
];

export const TRACKING_NOTE_INVENTORY_ROWS = [
  ...GIRAFFE_WITH_OBSERVATION,
  ...HERCULES_F4_BLOCK,
];

export const TRACKING_NOTE_GROWTH_SHEET = {
  name: 'DHH',
  rows: [
    ['Date', 'Weight (g)', 'Stage'],
    ['2026-05-19', '35g', 'L3'],
    ['2026-06-01', '42g', 'L3'],
  ],
};

export const UNKNOWN_SHEET_ROWS = [['Random notes'], ['Not inventory data']];
