export type LevelUpWorkType = 'court' | 'physical' | 'mental'
export type LevelUpTrainingContext = 'alone' | 'partner' | 'singles' | 'doubles' | 'coach'
export type LevelUpFeeling = 'ready' | 'tight' | 'tired' | 'nervous'
export type LevelUpAccessMode = 'coach_invited' | 'player_plus' | 'free_preview'

export type LevelUpSession = {
  id: string
  playerUserId: string
  coachUserId: string | null
  studentLinkId: string | null
  assignmentId: string | null
  identitySlug: string
  focusId: string
  focusTitle: string
  workType: LevelUpWorkType
  context: LevelUpTrainingContext
  drillTitle: string
  rating: number
  feeling: LevelUpFeeling
  accessMode: LevelUpAccessMode
  note: string
  elapsedSeconds: number
  sharedWithCoach: boolean
  completedAt: string
  createdAt: string
  updatedAt: string
}

export type LevelUpSessionRow = {
  id: string
  player_user_id: string
  coach_user_id: string | null
  student_link_id: string | null
  assignment_id: string | null
  identity_slug: string
  focus_id: string
  focus_title: string
  work_type: string
  training_context: string
  drill_title: string
  rating: number
  feeling: string
  access_mode: string
  note: string
  elapsed_seconds: number
  shared_with_coach: boolean
  completed_at: string
  created_at: string
  updated_at: string
}

export type LevelUpSessionInput = {
  id?: unknown
  focusId?: unknown
  focusTitle?: unknown
  workType?: unknown
  context?: unknown
  drillTitle?: unknown
  rating?: unknown
  feeling?: unknown
  accessMode?: unknown
  note?: unknown
  elapsedSeconds?: unknown
  sharedWithCoach?: unknown
  completedAt?: unknown
  assignmentId?: unknown
  studentLinkId?: unknown
  identitySlug?: unknown
}

export function mapLevelUpSessionRow(row: LevelUpSessionRow): LevelUpSession {
  return {
    id: row.id,
    playerUserId: row.player_user_id,
    coachUserId: row.coach_user_id,
    studentLinkId: row.student_link_id,
    assignmentId: row.assignment_id,
    identitySlug: row.identity_slug,
    focusId: row.focus_id,
    focusTitle: row.focus_title,
    workType: normalizeWorkType(row.work_type),
    context: normalizeTrainingContext(row.training_context),
    drillTitle: row.drill_title,
    rating: clampRating(row.rating) ?? 0,
    feeling: normalizeFeeling(row.feeling),
    accessMode: normalizeAccessMode(row.access_mode),
    note: row.note,
    elapsedSeconds: normalizeSeconds(row.elapsed_seconds),
    sharedWithCoach: Boolean(row.shared_with_coach),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function buildLevelUpSessionPayload(
  input: LevelUpSessionInput,
  playerUserId: string,
  link: { coachUserId?: string | null; studentLinkId?: string | null } = {},
) {
  const focusId = stringOrEmpty(input.focusId).trim()
  const focusTitle = stringOrEmpty(input.focusTitle).trim()
  const drillTitle = stringOrEmpty(input.drillTitle).trim()
  const rating = clampRating(input.rating)
  if (!focusId || !focusTitle || !drillTitle || rating === null) return null

  const now = new Date().toISOString()
  const accessMode = normalizeAccessMode(input.accessMode)
  const sharedWithCoach = accessMode === 'coach_invited' && Boolean(input.sharedWithCoach)

  return {
    id: stringOrEmpty(input.id).trim() || `level-up-${crypto.randomUUID()}`,
    player_user_id: playerUserId,
    coach_user_id: link.coachUserId || null,
    student_link_id: link.studentLinkId || null,
    assignment_id: nullableString(input.assignmentId),
    identity_slug: stringOrEmpty(input.identitySlug).trim() || 'relentless-competitor-4-0',
    focus_id: focusId,
    focus_title: focusTitle,
    work_type: normalizeWorkType(input.workType),
    training_context: normalizeTrainingContext(input.context),
    drill_title: drillTitle,
    rating,
    feeling: normalizeFeeling(input.feeling),
    access_mode: accessMode,
    note: stringOrEmpty(input.note).trim().slice(0, 700),
    elapsed_seconds: normalizeSeconds(input.elapsedSeconds),
    shared_with_coach: sharedWithCoach,
    session_json: {
      source: 'level-up-workbench',
      quickNote: stringOrEmpty(input.note).trim().slice(0, 220),
    },
    completed_at: normalizeIsoDate(input.completedAt) || now,
    updated_at: now,
  }
}

export function normalizeAccessMode(value: unknown): LevelUpAccessMode {
  return value === 'coach_invited' || value === 'player_plus' || value === 'free_preview' ? value : 'free_preview'
}

function normalizeWorkType(value: unknown): LevelUpWorkType {
  return value === 'physical' || value === 'mental' || value === 'court' ? value : 'court'
}

function normalizeTrainingContext(value: unknown): LevelUpTrainingContext {
  return value === 'partner' || value === 'singles' || value === 'doubles' || value === 'coach' || value === 'alone'
    ? value
    : 'alone'
}

function normalizeFeeling(value: unknown): LevelUpFeeling {
  return value === 'tight' || value === 'tired' || value === 'nervous' || value === 'ready' ? value : 'ready'
}

function clampRating(value: unknown) {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(5, Math.round(numeric)))
}

function normalizeSeconds(value: unknown) {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : 0
  return Number.isFinite(numeric) ? Math.max(0, Math.min(7200, Math.round(numeric))) : 0
}

function normalizeIsoDate(value: unknown) {
  const text = stringOrEmpty(value).trim()
  if (!text) return ''
  const date = new Date(text)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function nullableString(value: unknown) {
  const text = stringOrEmpty(value).trim()
  return text || null
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : ''
}
