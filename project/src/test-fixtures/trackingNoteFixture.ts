/** Fixture rows modeled on Tracking note 2026 May-Jun.xlsx breeder inventory sheets. */
export const GIRAFFE_ADULT_BLOCK = [
  ['Giraffe.K', 'headcount', 'adult', 'CB'],
  ['L1', '0', '4', '', 'Jun 17th: 80mm male'],
  ['L2', '0', '', '', 'Jun 20th: 60mm male'],
  ['L3', '8', '', '', 'Jun 20th: 39mm female'],
];

export const GIRAFFE_WITH_OBSERVATION = [
  ...GIRAFFE_ADULT_BLOCK,
  ['', '', '', '', 'May 19th: 35mm female'],
];

export const HERCULES_F4_BLOCK = [
  ['Hercules Hercules', 'headcount', 'adult(F4)', 'CB'],
  ['L1', '0', '1', '', '28th December 2025: Male'],
  ['L2', '0', '', ''],
  ['L3', '0', '', ''],
];

/** Full breeder block with sex metadata columns on stage rows. */
export const LAMPRIMA_BLOCK = [
  ['lamprima adolphinae', 'headcount', 'adult(F4+)', 'CB', 'Eggs:17'],
  ['L1', '0', '6', '', '3 males'],
  ['L2', '0', '', '', '3 females'],
  ['L3', '16', '', ''],
];

export const LAMPRIMA_SIMPLE_BLOCK = [
  ['lamprima adolphinae', 'headcount', 'adult', 'CB'],
  ['3 males'],
  ['3 females'],
  ['16'],
];

export const CALCOSOMA_CB_BLOCK = [
  ['Calcosoma.M', 'headcount', 'adult', 'WD'],
  ['L1', '0', '1', '', 'Jan 4th: 90mm male'],
  ['L2', '0', '', ''],
  ['L3', '0', '', ''],
];

export const HPERRyi_ADULT_ONLY_BLOCK = [
  ['H.Perryi', 'headcount', 'adult', 'CB'],
  ['L1', '0', '2', ''],
  ['L2', '0', '', ''],
  ['L3', '0', '', ''],
];

export const MUSIMON_EGG_PUPA_BLOCK = [
  ['Musimon', 'headcount', 'adult', 'CB'],
  ['L1', '0', '1(Male)', ''],
  ['L2', '0', '', ''],
  ['L3', '0', '', ''],
];

/** Six-species fixture — matches Tracking note 2026 May-Jun.xlsx Sheet1. */
export { TRACKING_NOTE_REAL_ROWS as SIX_SPECIES_INVENTORY_ROWS } from './trackingNoteRealFixture';

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
