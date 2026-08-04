import { notifyPlatformResumeUpdated } from './platform-resume-events'

export const COACH_RESUME_STORAGE_KEY = 'tenaceiq_coach_resume'

export function getCoachResumeStorageKey(userId?: string | null) {
  const accountId = (userId || '').trim()
  return accountId ? `${COACH_RESUME_STORAGE_KEY}:${accountId}` : COACH_RESUME_STORAGE_KEY
}

export type CoachResumeSurface =
  | 'bench'
  | 'add-player'
  | 'player-hub'
  | 'development-plan'
  | 'assignment'
  | 'conversation'

export type CoachResumeAssignmentDraft = {
  routeRequestKey?: string
  title?: string
  focus?: string
  dueDate?: string
  templateId?: string
  presetId?: string
  starterId?: string
  levelUpCardId?: string
  levelUpPackId?: string
  editId?: string
  lessonDateTime?: string
  lessonFocus?: string
  lessonLocation?: string
  sessionPresetId?: string
}

export type CoachResumeState = {
  studentLinkId?: string
  playerName?: string
  playerUserId?: string
  identitySlug?: string
  assignmentId?: string
  conversationId?: string
  lastSurface?: CoachResumeSurface
  lastSurfaceLabel?: string
  lastVisitedAt?: string
  lastHref?: string
  assignmentDraft?: CoachResumeAssignmentDraft
}

const COACH_RESUME_SURFACES = new Set<CoachResumeSurface>([
  'bench',
  'add-player',
  'player-hub',
  'development-plan',
  'assignment',
  'conversation',
])

function cleanResumeText(value: unknown, maxLength = 180) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function isSafeCoachResumeHref(value: unknown): value is string {
  const href = cleanResumeText(value, 1600)
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false

  try {
    const parsed = new URL(href, 'https://www.tenaceiq.com')
    return parsed.origin === 'https://www.tenaceiq.com'
  } catch {
    return false
  }
}

function sanitizeCoachAssignmentDraft(value: unknown): CoachResumeAssignmentDraft | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const draft: CoachResumeAssignmentDraft = {
    ...(cleanResumeText(input.routeRequestKey, 240) ? { routeRequestKey: cleanResumeText(input.routeRequestKey, 240) } : {}),
    ...(cleanResumeText(input.title, 240) ? { title: cleanResumeText(input.title, 240) } : {}),
    ...(cleanResumeText(input.focus, 500) ? { focus: cleanResumeText(input.focus, 500) } : {}),
    ...(cleanResumeText(input.dueDate, 40) ? { dueDate: cleanResumeText(input.dueDate, 40) } : {}),
    ...(cleanResumeText(input.templateId, 160) ? { templateId: cleanResumeText(input.templateId, 160) } : {}),
    ...(cleanResumeText(input.presetId, 160) ? { presetId: cleanResumeText(input.presetId, 160) } : {}),
    ...(cleanResumeText(input.starterId, 160) ? { starterId: cleanResumeText(input.starterId, 160) } : {}),
    ...(cleanResumeText(input.levelUpCardId, 160) ? { levelUpCardId: cleanResumeText(input.levelUpCardId, 160) } : {}),
    ...(cleanResumeText(input.levelUpPackId, 160) ? { levelUpPackId: cleanResumeText(input.levelUpPackId, 160) } : {}),
    ...(cleanResumeText(input.editId, 160) ? { editId: cleanResumeText(input.editId, 160) } : {}),
    ...(cleanResumeText(input.lessonDateTime, 80) ? { lessonDateTime: cleanResumeText(input.lessonDateTime, 80) } : {}),
    ...(cleanResumeText(input.lessonFocus, 500) ? { lessonFocus: cleanResumeText(input.lessonFocus, 500) } : {}),
    ...(cleanResumeText(input.lessonLocation, 240) ? { lessonLocation: cleanResumeText(input.lessonLocation, 240) } : {}),
    ...(cleanResumeText(input.sessionPresetId, 160) ? { sessionPresetId: cleanResumeText(input.sessionPresetId, 160) } : {}),
  }
  return Object.keys(draft).length ? draft : undefined
}

export function sanitizeCoachResumeState(value: unknown): CoachResumeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const lastSurface = cleanResumeText(input.lastSurface) as CoachResumeSurface
  const lastHref = isSafeCoachResumeHref(input.lastHref) ? cleanResumeText(input.lastHref, 1600) : ''
  const assignmentDraft = sanitizeCoachAssignmentDraft(input.assignmentDraft)

  return {
    ...(cleanResumeText(input.studentLinkId, 160) ? { studentLinkId: cleanResumeText(input.studentLinkId, 160) } : {}),
    ...(cleanResumeText(input.playerName, 180) ? { playerName: cleanResumeText(input.playerName, 180) } : {}),
    ...(cleanResumeText(input.playerUserId, 160) ? { playerUserId: cleanResumeText(input.playerUserId, 160) } : {}),
    ...(cleanResumeText(input.identitySlug, 180) ? { identitySlug: cleanResumeText(input.identitySlug, 180) } : {}),
    ...(cleanResumeText(input.assignmentId, 160) ? { assignmentId: cleanResumeText(input.assignmentId, 160) } : {}),
    ...(cleanResumeText(input.conversationId, 160) ? { conversationId: cleanResumeText(input.conversationId, 160) } : {}),
    ...(COACH_RESUME_SURFACES.has(lastSurface) ? { lastSurface } : {}),
    ...(cleanResumeText(input.lastSurfaceLabel, 80) ? { lastSurfaceLabel: cleanResumeText(input.lastSurfaceLabel, 80) } : {}),
    ...(cleanResumeText(input.lastVisitedAt, 80) ? { lastVisitedAt: cleanResumeText(input.lastVisitedAt, 80) } : {}),
    ...(lastHref ? { lastHref } : {}),
    ...(assignmentDraft ? { assignmentDraft } : {}),
  }
}

function resumeTimestamp(state: CoachResumeState | null | undefined) {
  const timestamp = Date.parse(state?.lastVisitedAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function chooseLatestCoachResumeState(
  localState: CoachResumeState | null,
  cloudState: CoachResumeState | null,
) {
  if (!localState) return cloudState
  if (!cloudState) return localState
  return resumeTimestamp(cloudState) > resumeTimestamp(localState) ? cloudState : localState
}

export function buildCoachWorkspaceHref(sectionId: string, studentLinkId?: string | null) {
  const studentId = (studentLinkId || '').trim()
  const query = studentId ? `?studentLinkId=${encodeURIComponent(studentId)}` : ''
  const anchor = sectionId.trim().replace(/^#/, '')
  return `/coach${query}${anchor ? `#${anchor}` : ''}`
}

export function getCoachResumeHref(state: CoachResumeState | null | undefined) {
  if (!state) return ''
  if (isSafeCoachResumeHref(state.lastHref)) return state.lastHref

  if (state.lastSurface === 'conversation' && state.conversationId) {
    return `/messages?thread=${encodeURIComponent(state.conversationId)}`
  }
  if ((state.lastSurface === 'player-hub' || state.lastSurface === 'development-plan') && state.identitySlug) {
    return `/player-development/${encodeURIComponent(state.identitySlug)}`
  }
  if (state.lastSurface === 'assignment') {
    return buildCoachWorkspaceHref('coach-lesson-frame', state.studentLinkId)
  }
  if (state.lastSurface === 'add-player') return buildCoachWorkspaceHref('coach-student-board')
  if (state.lastSurface === 'bench' || state.studentLinkId) {
    return buildCoachWorkspaceHref('coach-linked-dashboard', state.studentLinkId)
  }
  return ''
}

export function readCoachResumeState(userId?: string | null): CoachResumeState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(getCoachResumeStorageKey(userId))
    if (!raw) return null
    const resume = sanitizeCoachResumeState(JSON.parse(raw))
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export function writeCoachResumeState(nextState: CoachResumeState, userId?: string | null) {
  if (typeof window === 'undefined') return null

  try {
    const current = readCoachResumeState(userId) || {}
    const saved = sanitizeCoachResumeState({
      ...current,
      ...nextState,
      lastVisitedAt: nextState.lastVisitedAt || new Date().toISOString(),
    })
    window.localStorage.setItem(getCoachResumeStorageKey(userId), JSON.stringify(saved))
    notifyPlatformResumeUpdated('coach')
    return saved
  } catch {
    return null
  }
}

export async function loadCoachResumeStateFromCloud(accessToken: string) {
  if (!accessToken) return null
  try {
    const response = await fetch('/api/coach/resume', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const payload = await response.json() as { resume?: unknown }
    const resume = sanitizeCoachResumeState(payload.resume)
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export async function syncCoachResumeState(
  nextState: CoachResumeState,
  userId?: string | null,
  accessToken?: string | null,
) {
  const saved = writeCoachResumeState(nextState, userId)
  if (!saved || !accessToken) return saved

  try {
    await fetch('/api/coach/resume', {
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
