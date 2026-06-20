import { ALL_STORAGE_KEYS, userStorageKey } from '../constants/storageKeys';

/** Remove all app data from localStorage (user-scoped and legacy keys). */
export function clearAllAppDataFromStorage(userId?: string): void {
  if (typeof window === 'undefined') return;

  if (userId) {
    for (const baseKey of ALL_STORAGE_KEYS) {
      window.localStorage.removeItem(userStorageKey(baseKey, userId));
    }
  }

  for (const key of ALL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}
