import { notifyPlatformResumeUpdated } from './platform-resume-events'

export const LEAGUE_COORDINATOR_RESUME_STORAGE_KEY = 'tenaceiq_league_coordinator_resume_v1'

export function getLeagueCoordinatorResumeStorageKey(userId?: string | null) {
  const accountId = (userId || '').trim()
  return accountId ? `${LEAGUE_COORDINATOR_RESUME_STORAGE_KEY}:${accountId}` : LEAGUE_COORDINATOR_RESUME_STORAGE_KEY
}

export type LeagueCoordinatorResumeSurface =
  | 'hub'
  | 'setup'
  | 'team-results'
  | 'individual-results'
  | 'tournament'
  | 'conversation'

export type LeagueCoordinatorTeamResultDraft = {
  scheduleItemId?: string
  leagueId?: string
  teamAName?: string
  teamBName?: string
  matchDate?: string
  facility?: string
  notes?: string
}

export type LeagueCoordinatorIndividualResultDraft = {
  leagueId?: string
  playerA?: string
  playerB?: string
  winner?: string
  score?: string
  resultDate?: string
  notes?: string
  editingResultId?: string
  formOpen?: boolean
}

export type LeagueCoordinatorTournamentDraft = {
  tournamentId?: string
  name?: string
  format?: string
  entrantType?: 'players' | 'teams'
  startsOn?: string
  locationLabel?: string
  directorNotes?: string
  entrantsText?: string
  isPublic?: boolean
}

export type LeagueCoordinatorResumeState = {
  leagueId?: string
  leagueName?: string
  leagueFormat?: 'team' | 'individual'
  tournamentId?: string
  tournamentName?: string
  eventId?: string
  conversationId?: string
  lastSurface?: LeagueCoordinatorResumeSurface
  lastSurfaceLabel?: string
  lastVisitedAt?: string
  lastHref?: string
  teamResultDraft?: LeagueCoordinatorTeamResultDraft
  individualResultDraft?: LeagueCoordinatorIndividualResultDraft
  tournamentDraft?: LeagueCoordinatorTournamentDraft
}

const RESUME_SURFACES = new Set<LeagueCoordinatorResumeSurface>([
  'hub',
  'setup',
  'team-results',
  'individual-results',
  'tournament',
  'conversation',
])

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function cleanBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

export function isSafeLeagueCoordinatorResumeHref(value: unknown): value is string {
  const href = cleanText(value, 1800)
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false

  try {
    const parsed = new URL(href, 'https://www.tenaceiq.com')
    return parsed.origin === 'https://www.tenaceiq.com'
  } catch {
    return false
  }
}

function sanitizeTeamResultDraft(value: unknown): LeagueCoordinatorTeamResultDraft | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const draft: LeagueCoordinatorTeamResultDraft = {
    ...(cleanText(input.scheduleItemId, 160) ? { scheduleItemId: cleanText(input.scheduleItemId, 160) } : {}),
    ...(cleanText(input.leagueId, 160) ? { leagueId: cleanText(input.leagueId, 160) } : {}),
    ...(cleanText(input.teamAName, 240) ? { teamAName: cleanText(input.teamAName, 240) } : {}),
    ...(cleanText(input.teamBName, 240) ? { teamBName: cleanText(input.teamBName, 240) } : {}),
    ...(cleanText(input.matchDate, 40) ? { matchDate: cleanText(input.matchDate, 40) } : {}),
    ...(cleanText(input.facility, 240) ? { facility: cleanText(input.facility, 240) } : {}),
    ...(cleanText(input.notes, 1000) ? { notes: cleanText(input.notes, 1000) } : {}),
  }
  return Object.keys(draft).length ? draft : undefined
}

function sanitizeIndividualResultDraft(value: unknown): LeagueCoordinatorIndividualResultDraft | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const formOpen = cleanBoolean(input.formOpen)
  const draft: LeagueCoordinatorIndividualResultDraft = {
    ...(cleanText(input.leagueId, 160) ? { leagueId: cleanText(input.leagueId, 160) } : {}),
    ...(cleanText(input.playerA, 240) ? { playerA: cleanText(input.playerA, 240) } : {}),
    ...(cleanText(input.playerB, 240) ? { playerB: cleanText(input.playerB, 240) } : {}),
    ...(cleanText(input.winner, 240) ? { winner: cleanText(input.winner, 240) } : {}),
    ...(cleanText(input.score, 120) ? { score: cleanText(input.score, 120) } : {}),
    ...(cleanText(input.resultDate, 40) ? { resultDate: cleanText(input.resultDate, 40) } : {}),
    ...(cleanText(input.notes, 1000) ? { notes: cleanText(input.notes, 1000) } : {}),
    ...(cleanText(input.editingResultId, 160) ? { editingResultId: cleanText(input.editingResultId, 160) } : {}),
    ...(formOpen === undefined ? {} : { formOpen }),
  }
  return Object.keys(draft).length ? draft : undefined
}

function sanitizeTournamentDraft(value: unknown): LeagueCoordinatorTournamentDraft | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const entrantType = input.entrantType === 'teams' ? 'teams' : input.entrantType === 'players' ? 'players' : undefined
  const isPublic = cleanBoolean(input.isPublic)
  const draft: LeagueCoordinatorTournamentDraft = {
    ...(cleanText(input.tournamentId, 160) ? { tournamentId: cleanText(input.tournamentId, 160) } : {}),
    ...(cleanText(input.name, 240) ? { name: cleanText(input.name, 240) } : {}),
    ...(cleanText(input.format, 80) ? { format: cleanText(input.format, 80) } : {}),
    ...(entrantType ? { entrantType } : {}),
    ...(cleanText(input.startsOn, 40) ? { startsOn: cleanText(input.startsOn, 40) } : {}),
    ...(cleanText(input.locationLabel, 240) ? { locationLabel: cleanText(input.locationLabel, 240) } : {}),
    ...(cleanText(input.directorNotes, 1000) ? { directorNotes: cleanText(input.directorNotes, 1000) } : {}),
    ...(cleanText(input.entrantsText, 8000) ? { entrantsText: cleanText(input.entrantsText, 8000) } : {}),
    ...(isPublic === undefined ? {} : { isPublic }),
  }
  return Object.keys(draft).length ? draft : undefined
}

export function sanitizeLeagueCoordinatorResumeState(value: unknown): LeagueCoordinatorResumeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const lastSurface = cleanText(input.lastSurface) as LeagueCoordinatorResumeSurface
  const leagueFormat = input.leagueFormat === 'team'
    ? 'team'
    : input.leagueFormat === 'individual'
      ? 'individual'
      : undefined
  const lastHref = isSafeLeagueCoordinatorResumeHref(input.lastHref) ? cleanText(input.lastHref, 1800) : ''

  return {
    ...(cleanText(input.leagueId, 160) ? { leagueId: cleanText(input.leagueId, 160) } : {}),
    ...(cleanText(input.leagueName, 240) ? { leagueName: cleanText(input.leagueName, 240) } : {}),
    ...(leagueFormat ? { leagueFormat } : {}),
    ...(cleanText(input.tournamentId, 160) ? { tournamentId: cleanText(input.tournamentId, 160) } : {}),
    ...(cleanText(input.tournamentName, 240) ? { tournamentName: cleanText(input.tournamentName, 240) } : {}),
    ...(cleanText(input.eventId, 160) ? { eventId: cleanText(input.eventId, 160) } : {}),
    ...(cleanText(input.conversationId, 160) ? { conversationId: cleanText(input.conversationId, 160) } : {}),
    ...(RESUME_SURFACES.has(lastSurface) ? { lastSurface } : {}),
    ...(cleanText(input.lastSurfaceLabel, 100) ? { lastSurfaceLabel: cleanText(input.lastSurfaceLabel, 100) } : {}),
    ...(cleanText(input.lastVisitedAt, 80) ? { lastVisitedAt: cleanText(input.lastVisitedAt, 80) } : {}),
    ...(lastHref ? { lastHref } : {}),
    ...(sanitizeTeamResultDraft(input.teamResultDraft) ? { teamResultDraft: sanitizeTeamResultDraft(input.teamResultDraft) } : {}),
    ...(sanitizeIndividualResultDraft(input.individualResultDraft) ? { individualResultDraft: sanitizeIndividualResultDraft(input.individualResultDraft) } : {}),
    ...(sanitizeTournamentDraft(input.tournamentDraft) ? { tournamentDraft: sanitizeTournamentDraft(input.tournamentDraft) } : {}),
  }
}

function resumeTimestamp(state: LeagueCoordinatorResumeState | null | undefined) {
  const timestamp = Date.parse(state?.lastVisitedAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function chooseLatestLeagueCoordinatorResumeState(
  localState: LeagueCoordinatorResumeState | null,
  cloudState: LeagueCoordinatorResumeState | null,
) {
  if (!localState) return cloudState
  if (!cloudState) return localState
  return resumeTimestamp(cloudState) > resumeTimestamp(localState) ? cloudState : localState
}

export function buildLeagueCoordinatorHref(surface: LeagueCoordinatorResumeSurface, leagueId?: string | null) {
  const id = (leagueId || '').trim()
  const query = id ? `?leagueId=${encodeURIComponent(id)}` : ''
  if (surface === 'team-results') return `/league-coordinator/results${query}`
  if (surface === 'individual-results') return `/league-coordinator/individual-results${query}`
  if (surface === 'setup') return `/league-coordinator${query}#league-setup-form`
  return '/league-coordinator'
}

export function getLeagueCoordinatorResumeHref(state: LeagueCoordinatorResumeState | null | undefined) {
  if (!state) return ''
  if (isSafeLeagueCoordinatorResumeHref(state.lastHref)) return state.lastHref
  if (state.lastSurface === 'conversation' && state.conversationId) {
    return `/messages?thread=${encodeURIComponent(state.conversationId)}`
  }
  if (state.lastSurface === 'tournament') {
    const query = state.tournamentId ? `?tournamentId=${encodeURIComponent(state.tournamentId)}` : ''
    return `/league-coordinator/tournaments${query}#tournament-setup`
  }
  return buildLeagueCoordinatorHref(state.lastSurface || 'hub', state.leagueId)
}

export function readLeagueCoordinatorResumeState(userId?: string | null): LeagueCoordinatorResumeState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getLeagueCoordinatorResumeStorageKey(userId))
    if (!raw) return null
    const resume = sanitizeLeagueCoordinatorResumeState(JSON.parse(raw))
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export function writeLeagueCoordinatorResumeState(nextState: LeagueCoordinatorResumeState, userId?: string | null) {
  if (typeof window === 'undefined') return null
  try {
    const current = readLeagueCoordinatorResumeState(userId) || {}
    const saved = sanitizeLeagueCoordinatorResumeState({
      ...current,
      ...nextState,
      lastVisitedAt: nextState.lastVisitedAt || new Date().toISOString(),
    })
    window.localStorage.setItem(getLeagueCoordinatorResumeStorageKey(userId), JSON.stringify(saved))
    notifyPlatformResumeUpdated('league')
    return saved
  } catch {
    return null
  }
}

export async function loadLeagueCoordinatorResumeStateFromCloud(accessToken: string) {
  if (!accessToken) return null
  try {
    const response = await fetch('/api/league-coordinator/resume', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const payload = await response.json() as { resume?: unknown }
    const resume = sanitizeLeagueCoordinatorResumeState(payload.resume)
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export async function syncLeagueCoordinatorResumeState(
  nextState: LeagueCoordinatorResumeState,
  userId?: string | null,
  accessToken?: string | null,
) {
  const saved = writeLeagueCoordinatorResumeState(nextState, userId)
  if (!saved || !accessToken) return saved
  try {
    await fetch('/api/league-coordinator/resume', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resume: saved }),
      keepalive: true,
    })
  } catch {
    // Local resume remains available if cloud sync is temporarily unavailable.
  }
  return saved
}
