import { ALL_STORAGE_KEYS } from '../constants/storageKeys';

export function clearAllAppDataFromStorage(): void {
  for (const key of ALL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}
