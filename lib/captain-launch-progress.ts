export type CaptainLaunchStepId = 'player' | 'team' | 'schedule' | 'contacts' | 'outreach'

export type CaptainLaunchProgress = {
  completedCount: number
  totalCount: number
  isComplete: boolean
  nextStep: CaptainLaunchStepId | 'complete'
  steps: Array<{
    id: CaptainLaunchStepId
    complete: boolean
  }>
}

export function getCaptainLaunchProgress(input: {
  hasPlayer: boolean
  hasTeam: boolean
  hasSchedule: boolean
  hasContacts: boolean
  hasOutreach: boolean
}): CaptainLaunchProgress {
  const steps = [
    { id: 'player' as const, complete: input.hasPlayer },
    { id: 'team' as const, complete: input.hasTeam },
    { id: 'schedule' as const, complete: input.hasSchedule },
    { id: 'contacts' as const, complete: input.hasContacts },
    { id: 'outreach' as const, complete: input.hasOutreach },
  ]
  const next = steps.find((step) => !step.complete)

  return {
    completedCount: steps.filter((step) => step.complete).length,
    totalCount: steps.length,
    isComplete: !next,
    nextStep: next?.id || 'complete',
    steps,
  }
}

const CAPTAIN_LAUNCH_OUTREACH_STORAGE_KEY = 'tenaceiq_captain_launch_outreach'

export type CaptainLaunchOutreachScope = {
  team: string
  league: string
  flight: string
}

export function buildCaptainLaunchOutreachScopeKey(scope: CaptainLaunchOutreachScope) {
  return [scope.team, scope.league, scope.flight].map(normalizeKey).join('__')
}

export function readCaptainLaunchOutreach(scope: CaptainLaunchOutreachScope) {
  if (typeof window === 'undefined') return false
  const key = buildCaptainLaunchOutreachScopeKey(scope)
  if (!key.replace(/_/g, '')) return false

  try {
    const saved = JSON.parse(window.localStorage.getItem(CAPTAIN_LAUNCH_OUTREACH_STORAGE_KEY) || '[]') as unknown
    return Array.isArray(saved) && saved.some((entry) => (
      typeof entry === 'object'
      && entry !== null
      && 'scopeKey' in entry
      && (entry as { scopeKey?: unknown }).scopeKey === key
    ))
  } catch {
    return false
  }
}

export function markCaptainLaunchOutreachStarted(scope: CaptainLaunchOutreachScope) {
  if (typeof window === 'undefined') return false
  const scopeKey = buildCaptainLaunchOutreachScopeKey(scope)
  if (!scopeKey.replace(/_/g, '')) return false

  try {
    const raw = JSON.parse(window.localStorage.getItem(CAPTAIN_LAUNCH_OUTREACH_STORAGE_KEY) || '[]') as unknown
    const entries = Array.isArray(raw)
      ? raw.filter((entry): entry is { scopeKey: string; startedAt: string } => (
        typeof entry === 'object'
        && entry !== null
        && typeof (entry as { scopeKey?: unknown }).scopeKey === 'string'
        && typeof (entry as { startedAt?: unknown }).startedAt === 'string'
      ))
      : []
    const next = [
      { scopeKey, startedAt: new Date().toISOString() },
      ...entries.filter((entry) => entry.scopeKey !== scopeKey),
    ].slice(0, 80)
    window.localStorage.setItem(CAPTAIN_LAUNCH_OUTREACH_STORAGE_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
