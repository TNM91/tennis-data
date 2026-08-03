export const PLAYER_IMPROVE_RESUME_STORAGE_KEY = 'tenaceiq_player_improve_resume_v1'

export function getPlayerImproveResumeStorageKey(userId?: string | null) {
  const accountId = (userId || '').trim()
  return accountId ? `${PLAYER_IMPROVE_RESUME_STORAGE_KEY}:${accountId}` : PLAYER_IMPROVE_RESUME_STORAGE_KEY
}

export type PlayerImproveResumeSurface =
  | 'improve'
  | 'player-path'
  | 'level-up'
  | 'assignment'
  | 'conversation'
  | 'my-lab'

export type PlayerImproveSessionDraft = {
  rating?: number | null
  feeling?: 'ready' | 'tight' | 'tired' | 'nervous'
  note?: string
  sharedWithCoach?: boolean
  proofCounter?: number
  elapsedSeconds?: number
  readiness?: 'fresh' | 'okay' | 'tired'
  accessMode?: 'coach_invited' | 'player_plus' | 'free_preview'
  scoring?: boolean
}

export type PlayerImproveResumeState = {
  identitySlug?: string
  identityTitle?: string
  focusId?: string
  workType?: 'court' | 'physical' | 'mental'
  trainingContext?: 'alone' | 'partner' | 'singles' | 'doubles' | 'coach'
  drillId?: string
  cardId?: string
  questId?: string
  assignmentId?: string
  assignmentTitle?: string
  assignmentFocus?: string
  studentLinkId?: string
  conversationId?: string
  conversationDraft?: string
  lastSurface?: PlayerImproveResumeSurface
  lastSurfaceLabel?: string
  lastVisitedAt?: string
  lastHref?: string
  sessionDraft?: PlayerImproveSessionDraft
}

const SURFACES = new Set<PlayerImproveResumeSurface>([
  'improve',
  'player-path',
  'level-up',
  'assignment',
  'conversation',
  'my-lab',
])

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function isSafePlayerImproveResumeHref(value: unknown): value is string {
  const href = cleanText(value, 1800)
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false
  try {
    const parsed = new URL(href, 'https://www.tenaceiq.com')
    return parsed.origin === 'https://www.tenaceiq.com'
  } catch {
    return false
  }
}

function sanitizeSessionDraft(value: unknown): PlayerImproveSessionDraft | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const rating = input.rating === null
    ? null
    : typeof input.rating === 'number' && input.rating >= 0 && input.rating <= 5
      ? input.rating
      : undefined
  const feeling = input.feeling === 'tight' || input.feeling === 'tired' || input.feeling === 'nervous' || input.feeling === 'ready'
    ? input.feeling
    : undefined
  const readiness = input.readiness === 'fresh' || input.readiness === 'tired' || input.readiness === 'okay'
    ? input.readiness
    : undefined
  const accessMode = input.accessMode === 'coach_invited' || input.accessMode === 'player_plus' || input.accessMode === 'free_preview'
    ? input.accessMode
    : undefined
  const draft: PlayerImproveSessionDraft = {
    ...(rating === undefined ? {} : { rating }),
    ...(feeling ? { feeling } : {}),
    ...(cleanText(input.note, 500) ? { note: cleanText(input.note, 500) } : {}),
    ...(typeof input.sharedWithCoach === 'boolean' ? { sharedWithCoach: input.sharedWithCoach } : {}),
    ...(typeof input.proofCounter === 'number' ? { proofCounter: Math.max(0, Math.min(99, Math.round(input.proofCounter))) } : {}),
    ...(typeof input.elapsedSeconds === 'number' ? { elapsedSeconds: Math.max(0, Math.min(86400, Math.round(input.elapsedSeconds))) } : {}),
    ...(readiness ? { readiness } : {}),
    ...(accessMode ? { accessMode } : {}),
    ...(typeof input.scoring === 'boolean' ? { scoring: input.scoring } : {}),
  }
  return Object.keys(draft).length ? draft : undefined
}

export function sanitizePlayerImproveResumeState(value: unknown): PlayerImproveResumeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const lastSurface = cleanText(input.lastSurface) as PlayerImproveResumeSurface
  const workType = input.workType === 'physical' || input.workType === 'mental' || input.workType === 'court'
    ? input.workType
    : undefined
  const trainingContext = input.trainingContext === 'alone' || input.trainingContext === 'partner' ||
    input.trainingContext === 'singles' || input.trainingContext === 'doubles' || input.trainingContext === 'coach'
    ? input.trainingContext
    : undefined
  const lastHref = isSafePlayerImproveResumeHref(input.lastHref) ? cleanText(input.lastHref, 1800) : ''
  const sessionDraft = sanitizeSessionDraft(input.sessionDraft)

  return {
    ...(cleanText(input.identitySlug, 180) ? { identitySlug: cleanText(input.identitySlug, 180) } : {}),
    ...(cleanText(input.identityTitle, 240) ? { identityTitle: cleanText(input.identityTitle, 240) } : {}),
    ...(cleanText(input.focusId, 180) ? { focusId: cleanText(input.focusId, 180) } : {}),
    ...(workType ? { workType } : {}),
    ...(trainingContext ? { trainingContext } : {}),
    ...(cleanText(input.drillId, 240) ? { drillId: cleanText(input.drillId, 240) } : {}),
    ...(cleanText(input.cardId, 180) ? { cardId: cleanText(input.cardId, 180) } : {}),
    ...(cleanText(input.questId, 180) ? { questId: cleanText(input.questId, 180) } : {}),
    ...(cleanText(input.assignmentId, 180) ? { assignmentId: cleanText(input.assignmentId, 180) } : {}),
    ...(cleanText(input.assignmentTitle, 240) ? { assignmentTitle: cleanText(input.assignmentTitle, 240) } : {}),
    ...(cleanText(input.assignmentFocus, 500) ? { assignmentFocus: cleanText(input.assignmentFocus, 500) } : {}),
    ...(cleanText(input.studentLinkId, 180) ? { studentLinkId: cleanText(input.studentLinkId, 180) } : {}),
    ...(cleanText(input.conversationId, 180) ? { conversationId: cleanText(input.conversationId, 180) } : {}),
    ...(cleanText(input.conversationDraft, 1500) ? { conversationDraft: cleanText(input.conversationDraft, 1500) } : {}),
    ...(SURFACES.has(lastSurface) ? { lastSurface } : {}),
    ...(cleanText(input.lastSurfaceLabel, 120) ? { lastSurfaceLabel: cleanText(input.lastSurfaceLabel, 120) } : {}),
    ...(cleanText(input.lastVisitedAt, 80) ? { lastVisitedAt: cleanText(input.lastVisitedAt, 80) } : {}),
    ...(lastHref ? { lastHref } : {}),
    ...(sessionDraft ? { sessionDraft } : {}),
  }
}

function resumeTimestamp(state: PlayerImproveResumeState | null | undefined) {
  const timestamp = Date.parse(state?.lastVisitedAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function chooseLatestPlayerImproveResumeState(
  localState: PlayerImproveResumeState | null,
  cloudState: PlayerImproveResumeState | null,
) {
  if (!localState) return cloudState
  if (!cloudState) return localState
  return resumeTimestamp(cloudState) > resumeTimestamp(localState) ? cloudState : localState
}

export function buildPlayerImproveLevelUpHref(state: PlayerImproveResumeState) {
  const identitySlug = state.identitySlug || 'relentless-competitor-4-0'
  const params = new URLSearchParams()
  if (state.focusId) params.set('focus', state.focusId)
  if (state.workType) params.set('workType', state.workType)
  if (state.trainingContext) params.set('context', state.trainingContext)
  if (state.drillId) params.set('drill', state.drillId)
  if (state.cardId) params.set('card', state.cardId)
  if (state.questId) params.set('quest', state.questId)
  if (state.assignmentId) params.set('assignmentId', state.assignmentId)
  if (state.assignmentTitle) params.set('assignmentTitle', state.assignmentTitle)
  if (state.assignmentFocus) params.set('assignmentFocus', state.assignmentFocus)
  if (state.studentLinkId) params.set('studentLinkId', state.studentLinkId)
  if (state.assignmentId || state.studentLinkId) params.set('coach', '1')
  const query = params.toString()
  return `/level-up/${encodeURIComponent(identitySlug)}${query ? `?${query}` : ''}#level-up-flow`
}

export function getPlayerImproveResumeHref(state: PlayerImproveResumeState | null | undefined) {
  if (!state) return ''
  if (isSafePlayerImproveResumeHref(state.lastHref)) return state.lastHref
  if (state.lastSurface === 'conversation' && state.conversationId) {
    return `/messages?thread=${encodeURIComponent(state.conversationId)}`
  }
  if (state.lastSurface === 'level-up' || state.lastSurface === 'assignment') {
    return buildPlayerImproveLevelUpHref(state)
  }
  if (state.lastSurface === 'player-path' && state.identitySlug) {
    return `/player-development/${encodeURIComponent(state.identitySlug)}`
  }
  if (state.lastSurface === 'my-lab') return '/mylab#player-workshop'
  return '/player-development'
}

export function readPlayerImproveResumeState(userId?: string | null): PlayerImproveResumeState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getPlayerImproveResumeStorageKey(userId))
    if (!raw) return null
    const resume = sanitizePlayerImproveResumeState(JSON.parse(raw))
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export function writePlayerImproveResumeState(nextState: PlayerImproveResumeState, userId?: string | null) {
  if (typeof window === 'undefined') return null
  try {
    const current = readPlayerImproveResumeState(userId) || {}
    const saved = sanitizePlayerImproveResumeState({
      ...current,
      ...nextState,
      lastVisitedAt: nextState.lastVisitedAt || new Date().toISOString(),
    })
    window.localStorage.setItem(getPlayerImproveResumeStorageKey(userId), JSON.stringify(saved))
    return saved
  } catch {
    return null
  }
}

export async function loadPlayerImproveResumeStateFromCloud(accessToken: string) {
  if (!accessToken) return null
  try {
    const response = await fetch('/api/player/resume', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const payload = await response.json() as { resume?: unknown }
    const resume = sanitizePlayerImproveResumeState(payload.resume)
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export async function syncPlayerImproveResumeState(
  nextState: PlayerImproveResumeState,
  userId?: string | null,
  accessToken?: string | null,
) {
  const saved = writePlayerImproveResumeState(nextState, userId)
  if (!saved || !accessToken) return saved
  try {
    await fetch('/api/player/resume', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resume: saved }),
      keepalive: true,
    })
  } catch {
    // Local resume remains available while cloud sync recovers.
  }
  return saved
}
