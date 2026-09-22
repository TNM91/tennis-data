/** Shared across collector lanes; written only while holding the sync-run lock. */
export type SourceOutageState = {
  failedQueueIds: string[]
  lastFailureAt: string | null
  cooldownUntil: string | null
  level: number
}

export const SOURCE_OUTAGE_WINDOW_MS = 15 * 60_000
const COOLDOWN_MINUTES = [15, 30, 60] as const

export function readSourceOutageState(value: unknown): SourceOutageState {
  const state = (value && typeof value === 'object' ? value : {}) as Partial<SourceOutageState>
  return {
    failedQueueIds: Array.isArray(state.failedQueueIds) ? [...new Set(state.failedQueueIds.filter(id => typeof id === 'string'))].slice(-3) : [],
    lastFailureAt: typeof state.lastFailureAt === 'string' ? state.lastFailureAt : null,
    cooldownUntil: typeof state.cooldownUntil === 'string' ? state.cooldownUntil : null,
    level: Number.isInteger(state.level) ? Math.max(0, Math.min(3, state.level!)) : 0,
  }
}

export function sourceOutageIsCooling(value: unknown, now = Date.now()) {
  const until = readSourceOutageState(value).cooldownUntil
  return Boolean(until && Date.parse(until) > now)
}

/** Only call for a confirmed source-fetch failure, never a DB/parser error. */
export function recordSourceOutageFailure(value: unknown, queueId: string, now = Date.now()): SourceOutageState {
  const state = readSourceOutageState(value)
  const recent = state.lastFailureAt && now - Date.parse(state.lastFailureAt) <= SOURCE_OUTAGE_WINDOW_MS
  const failedQueueIds = [...new Set([...(recent || state.level ? state.failedQueueIds : []), queueId])].slice(-3)
  // After expiry, one ordinary queued page tests recovery. A failed test
  // extends the shared pause without consuming that page's retry allowance.
  const opens = state.level > 0 || failedQueueIds.length >= 3
  const level = opens ? Math.min(3, state.level + 1) : 0
  return {
    failedQueueIds,
    lastFailureAt: new Date(now).toISOString(),
    cooldownUntil: opens ? new Date(now + COOLDOWN_MINUTES[level - 1] * 60_000).toISOString() : null,
    level,
  }
}
