export const LEVEL_UP_HISTORY_UNAVAILABLE = 'Account history is unavailable. Proof already on this device is still available. Try again to load account proof.'

export async function readLevelUpSessionHistory<T>(response: Response): Promise<T[]> {
  if (!response.ok) throw new Error(LEVEL_UP_HISTORY_UNAVAILABLE)
  const json: unknown = await response.json()
  if (!json || typeof json !== 'object' || !('ok' in json) || json.ok !== true || !('sessions' in json) || !Array.isArray(json.sessions)) {
    throw new Error(LEVEL_UP_HISTORY_UNAVAILABLE)
  }
  return json.sessions as T[]
}
