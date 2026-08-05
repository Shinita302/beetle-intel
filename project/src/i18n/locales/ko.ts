import type { MessageTree } from '../types';

/**
 * Korean locale.
 * Source of truth for approved Korean copy: Beetleintel-Korean.xlsx Column C.
 * Blank Column C → English (intentionally untranslated for now).
 */
const ko = {
  brand: {
    name: '비틀인텔',
    // Column C blank — keep English
    tagline: 'Breeding Intelligence',
  },
  common: {
    saving: 'Saving…',
    or: 'or',
    backHome: '← Back to home',
    caseInsensitive: 'Case insensitive',
    signedIn: 'Signed in',
    language: 'Language',
  },
  nav: {
    dashboard: '대쉬보드',
    addBeetle: '곤충 추가',
    inventory: '인벤토리',
    importSpreadsheet: '엑셀 추가',
    larvalGrowth: '성장 기록',
    pairing: '페어링 & 유정',
    // Column C blank — keep English
    pestRisk: 'Pest Risk',
    settings: '설정',
  },
  shell: {
    logOut: '로그아웃',
  },
  auth: {
    // Not covered by spreadsheet Column C — keep English
    loginTitle: 'Log in',
    loginSubtitle: 'Access your beetle breeding records',
    noAccount: 'No account?',
    signUpLink: 'Sign up',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot password?',
    loggingIn: 'Logging in…',
    logIn: 'Log in',
    continueGoogle: 'Continue with Google',
    signInFailed: 'Sign-in failed. Please try again.',
    enterEmailFirst: 'Enter your email address first, then click forgot password.',
    resetSent: 'Password reset email sent. Check your inbox.',
    signupTitle: 'Create account',
    signupSubtitle: 'Start tracking your beetle breeding program',
    haveAccount: 'Already have an account?',
    logInLink: 'Log in',
    confirmPassword: 'Confirm password',
    creatingAccount: 'Creating account…',
    createAccount: 'Create account',
    passwordTooShort: 'Password must be at least 8 characters.',
    passwordMismatch: 'Passwords do not match.',
    accountCreated: 'Account created. Check your email to confirm your address, then log in.',
  },
  pages: {
    addBeetleTitle: '곤충 추가',
    addBeetleSubtitle: 'Quick profile for an individual beetle',
    growthTitle: '성장 기록',
    growthSubtitle: 'Log weight, stage, and environment data per beetle',
    inventoryTitle: '인벤토리',
    inventorySubtitle: 'Collection-level population counts by species',
    pairingTitle: '페어링 & 유정',
    pairingSubtitle: 'Log a pairing first, then return to the same record as eggs hatch and adults emerge',
    pestTitle: 'Pest Risk Monitor',
    pestSubtitle: 'Track pest issues and review qualitative risk assessments',
    importTitle: '엑셀 추가',
    importSubtitle: 'Hybrid import: automatic population groups with editable preview before saving.',
    dashboardTitle: '대쉬보드',
    dashboardSubtitle: 'Breeding intelligence overview',
  },
  addBeetle: {
    advancedDetails: '추가 사항',
    saveBeetle: '곤충 저장',
  },
  inventory: {
    addSpecies: '종 추가',
    totalSpecies: '전체 종',
    populationTable: '개채 수 테이블',
    speciesCount: '{count} 종',
    searchSpecies: '종 검색',
    species: '종',
    eggs: '알',
    prePupa: '전용',
    pupa: '번대기',
    adult: '성충',
    total: '전체',
    actions: '액션',
  },
  pairing: {
    // Column C blank for Male (Add Beetle / Pairing) — keep English
    male: 'Male',
    female: '암컷',
    selectMale: '수컷 선택',
    selectFemale: '암컷 선택',
    pairingDate: '페어링 날짜',
    savePairing: '페어링 기록 저장',
  },
  settings: {
    title: '설정',
    // Remaining settings strings: Column C blank — keep English
    subtitle: 'All breeding data syncs to your account and appears on any device after you log in',
    languageTitle: 'Language',
    languageSubtitle: 'Choose English or Korean for the app interface',
    accountTitle: 'Account',
    accountSubtitle: 'Your BeetleIntel login',
    deleteAccountHint: 'Deleting your account permanently removes your login and all synced breeding data.',
    typeConfirm: 'Type {phrase} to confirm',
    deleteAccount: 'Delete account',
    accountDeleted: 'Account deleted',
    yourDataTitle: 'Your data',
    yourDataSubtitle: 'Beetles, growth logs, inventory, pairings, and pest notes in Supabase',
    beetles: '{count} beetles',
    growthRecords: '{count} growth records',
    pairings: '{count} pairings',
    pestLogs: '{count} pest logs',
    noDataYet: 'No breeding data saved yet.',
    deleteDataTitle: 'Delete all breeding data',
    deleteDataSubtitle:
      'Removes beetles, growth records, pairings, pest logs, and inventory — keeps your login',
    deleteDataWarning: 'This cannot be undone. Your account stays active — only the breeding data is removed.',
    deleteEverything: 'Delete everything',
    allDataDeleted: 'All data deleted',
    restoreTitle: 'Restore sample data',
    restoreSubtitle: 'Reload the built-in demo beetles and records (replaces current data)',
    restoreHint: 'Use this after deleting everything, or if you want to start over with example profiles.',
    restoreDemo: 'Restore demo data',
    demoRestored: 'Demo data restored',
    footerSync: 'Breeding data is stored in your Supabase account and syncs across browsers when you log in.',
    deleteAccountDialogTitle: 'Delete your account?',
    deleteAccountDialogMessage:
      'This permanently deletes your login, beetles, growth logs, inventory, pairings, and pest notes. This cannot be undone.',
    deleting: 'Deleting…',
    deleteAccountError: 'Could not delete account.',
  },
} as const satisfies MessageTree;

export default ko;
