export const LEVEL_UP_PROGRESS_SYNCED_EVENT = 'tenaceiq:level-up-progress-synced'
export const LEVEL_UP_PROGRESS_SYNCED_STORAGE_KEY = 'tenaceiq:level-up-progress-synced-at'

export function notifyLevelUpProgressSynced() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LEVEL_UP_PROGRESS_SYNCED_STORAGE_KEY, new Date().toISOString())
  } catch {
    // The in-page event still refreshes progress when storage is unavailable.
  }
  window.dispatchEvent(new Event(LEVEL_UP_PROGRESS_SYNCED_EVENT))
}

export function subscribeToLevelUpProgressSynced(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LEVEL_UP_PROGRESS_SYNCED_STORAGE_KEY) listener()
  }
  window.addEventListener(LEVEL_UP_PROGRESS_SYNCED_EVENT, listener)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(LEVEL_UP_PROGRESS_SYNCED_EVENT, listener)
    window.removeEventListener('storage', handleStorage)
  }
}
