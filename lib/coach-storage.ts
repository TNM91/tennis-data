export type CoachStudentStatus = 'active' | 'needs_assignment' | 'review_notes' | 'paused'
export type CoachAssignmentStatus = 'draft' | 'assigned' | 'completed' | 'archived'
export type CoachContactPreference = 'in_app' | 'text' | 'both'
export type CoachStudentSetupStatus = 'manual' | 'invited' | 'linked'

export type CoachStudentLink = {
  id: string
  coachUserId: string
  playerUserId: string | null
  playerId: string | null
  playerName: string
  identitySlug: string
  levelLabel: string
  playerEmail: string
  playerPhone: string
  contactPreference: CoachContactPreference
  setupStatus: CoachStudentSetupStatus
  status: CoachStudentStatus
  notes: string
  updatedAt: string
}

export type CoachAssignment = {
  id: string
  studentLinkId: string
  title: string
  focus: string
  dueDate: string | null
  status: CoachAssignmentStatus
  assignment: Record<string, unknown>
  updatedAt: string
}

export type CoachStudentLinkRow = {
  id: string
  coach_user_id?: string | null
  player_user_id: string | null
  player_id: string | null
  player_name: string
  identity_slug: string
  level_label: string
  player_email?: string | null
  player_phone?: string | null
  contact_preference?: string | null
  setup_status?: string | null
  status: string
  notes: string
  updated_at: string
}

export type CoachAssignmentRow = {
  id: string
  student_link_id: string
  title: string
  focus: string
  due_date: string | null
  status: string
  assignment_json: unknown
  updated_at: string
}

export type CoachStudentLinkInput = {
  id?: unknown
  playerUserId?: unknown
  playerId?: unknown
  playerName?: unknown
  identitySlug?: unknown
  levelLabel?: unknown
  playerEmail?: unknown
  playerPhone?: unknown
  contactPreference?: unknown
  setupStatus?: unknown
  status?: unknown
  notes?: unknown
}

export type CoachAssignmentInput = {
  id?: unknown
  studentLinkId?: unknown
  title?: unknown
  focus?: unknown
  dueDate?: unknown
  status?: unknown
  assignment?: unknown
}

export type PlayerAssignmentCompletionInput = {
  recap?: unknown
  evidence?: unknown
}

export type PlayerAssignmentCheckIn = {
  recap: string
  evidence: string
  completedAt: string
}

export type CoachAssignmentReviewInput = {
  note?: unknown
  nextFocus?: unknown
}

export type CoachAssignmentReview = {
  note: string
  nextFocus: string
  reviewedAt: string
}

export type CoachAssignmentDueState = {
  label: string
  tone: 'none' | 'future' | 'soon' | 'today' | 'overdue'
}

export type CoachAssignmentSummary = {
  detail: string
  volume: string
  tracker: string[]
  prompt: string
  expectedEvidence: string
}

export function normalizeCoachStudentStatus(value: unknown): CoachStudentStatus {
  return value === 'active' || value === 'needs_assignment' || value === 'review_notes' || value === 'paused'
    ? value
    : 'active'
}

export function normalizeCoachAssignmentStatus(value: unknown): CoachAssignmentStatus {
  return value === 'draft' || value === 'assigned' || value === 'completed' || value === 'archived'
    ? value
    : 'draft'
}

export function normalizeCoachContactPreference(value: unknown): CoachContactPreference {
  return value === 'text' || value === 'both' || value === 'in_app' ? value : 'in_app'
}

export function normalizeCoachStudentSetupStatus(value: unknown): CoachStudentSetupStatus {
  return value === 'invited' || value === 'linked' || value === 'manual' ? value : 'manual'
}

export function mapCoachStudentLinkRow(row: CoachStudentLinkRow): CoachStudentLink {
  return {
    id: row.id,
    coachUserId: row.coach_user_id ?? '',
    playerUserId: row.player_user_id,
    playerId: row.player_id,
    playerName: row.player_name,
    identitySlug: row.identity_slug,
    levelLabel: row.level_label,
    playerEmail: row.player_email ?? '',
    playerPhone: row.player_phone ?? '',
    contactPreference: normalizeCoachContactPreference(row.contact_preference),
    setupStatus: normalizeCoachStudentSetupStatus(row.setup_status),
    status: normalizeCoachStudentStatus(row.status),
    notes: row.notes,
    updatedAt: row.updated_at,
  }
}

export function mapCoachAssignmentRow(row: CoachAssignmentRow): CoachAssignment {
  return {
    id: row.id,
    studentLinkId: row.student_link_id,
    title: row.title,
    focus: row.focus,
    dueDate: row.due_date,
    status: normalizeCoachAssignmentStatus(row.status),
    assignment: isPlainRecord(row.assignment_json) ? row.assignment_json : {},
    updatedAt: row.updated_at,
  }
}

export function buildCoachStudentLinkPayload(input: CoachStudentLinkInput, coachUserId: string) {
  const playerName = stringOrEmpty(input.playerName).trim()
  if (!playerName) return null

  const id = stringOrEmpty(input.id).trim() || `coach-student-${crypto.randomUUID()}`

  return {
    id,
    coach_user_id: coachUserId,
    player_user_id: nullableString(input.playerUserId),
    player_id: nullableString(input.playerId),
    player_name: playerName,
    identity_slug: stringOrEmpty(input.identitySlug).trim() || 'relentless-competitor-4-0',
    level_label: stringOrEmpty(input.levelLabel).trim(),
    player_email: normalizeEmail(input.playerEmail),
    player_phone: normalizePhone(input.playerPhone),
    contact_preference: normalizeCoachContactPreference(input.contactPreference),
    setup_status: normalizeCoachStudentSetupStatus(input.setupStatus),
    status: normalizeCoachStudentStatus(input.status),
    notes: stringOrEmpty(input.notes).trim(),
    updated_at: new Date().toISOString(),
  }
}

export function buildCoachAssignmentPayload(input: CoachAssignmentInput, coachUserId: string) {
  const studentLinkId = stringOrEmpty(input.studentLinkId).trim()
  const title = stringOrEmpty(input.title).trim()
  if (!studentLinkId || !title) return null

  const id = stringOrEmpty(input.id).trim() || `coach-assignment-${crypto.randomUUID()}`

  return {
    id,
    coach_user_id: coachUserId,
    student_link_id: studentLinkId,
    title,
    focus: stringOrEmpty(input.focus).trim(),
    due_date: nullableDate(input.dueDate),
    status: normalizeCoachAssignmentStatus(input.status),
    assignment_json: isPlainRecord(input.assignment) ? input.assignment : {},
    updated_at: new Date().toISOString(),
  }
}

export function buildPlayerAssignmentCompletion(
  existingAssignment: Record<string, unknown>,
  input: PlayerAssignmentCompletionInput,
) {
  const recap = clampText(input.recap, 700)
  const evidence = clampText(input.evidence, 300)

  return {
    ...existingAssignment,
    playerCheckIn: {
      recap,
      evidence,
      completedAt: new Date().toISOString(),
    },
  }
}

export function getPlayerAssignmentCheckIn(assignment: Record<string, unknown>): PlayerAssignmentCheckIn | null {
  const rawCheckIn = assignment.playerCheckIn
  if (!isPlainRecord(rawCheckIn)) return null

  const recap = stringOrEmpty(rawCheckIn.recap).trim()
  const evidence = stringOrEmpty(rawCheckIn.evidence).trim()
  const completedAt = stringOrEmpty(rawCheckIn.completedAt).trim()
  if (!recap && !evidence) return null

  return {
    recap,
    evidence,
    completedAt,
  }
}

export function buildCoachAssignmentReview(existingAssignment: Record<string, unknown>, input: CoachAssignmentReviewInput) {
  const note = clampText(input.note, 700)
  const nextFocus = clampText(input.nextFocus, 300)

  return {
    ...existingAssignment,
    coachReview: {
      note,
      nextFocus,
      reviewedAt: new Date().toISOString(),
    },
  }
}

export function getCoachAssignmentReview(assignment: Record<string, unknown>): CoachAssignmentReview | null {
  const rawReview = assignment.coachReview
  if (!isPlainRecord(rawReview)) return null

  const note = stringOrEmpty(rawReview.note).trim()
  const nextFocus = stringOrEmpty(rawReview.nextFocus).trim()
  const reviewedAt = stringOrEmpty(rawReview.reviewedAt).trim()
  if (!note && !nextFocus) return null

  return {
    note,
    nextFocus,
    reviewedAt,
  }
}

export function assignmentNeedsCoachReview(assignment: CoachAssignment) {
  return Boolean(getPlayerAssignmentCheckIn(assignment.assignment)) && !getCoachAssignmentReview(assignment.assignment)
}

export function sortCoachAssignmentsForReview(assignments: CoachAssignment[]) {
  return [...assignments].sort((a, b) => {
    const aPriority = getCoachAssignmentPriority(a)
    const bPriority = getCoachAssignmentPriority(b)
    if (aPriority !== bPriority) return aPriority - bPriority
    return Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || '')
  })
}

export function sortPlayerAssignmentsForAction(assignments: CoachAssignment[], now = new Date()) {
  return [...assignments].sort((a, b) => {
    const aPriority = getPlayerAssignmentPriority(a, now)
    const bPriority = getPlayerAssignmentPriority(b, now)
    if (aPriority !== bPriority) return aPriority - bPriority
    return getDueTimestamp(a.dueDate) - getDueTimestamp(b.dueDate)
  })
}

export function getCoachAssignmentDueState(dueDate: string | null | undefined, now = new Date()): CoachAssignmentDueState {
  if (!dueDate) return { label: 'No due date', tone: 'none' }

  const dueTimestamp = Date.parse(`${dueDate}T00:00:00`)
  if (!Number.isFinite(dueTimestamp)) return { label: 'No due date', tone: 'none' }

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((dueTimestamp - today.getTime()) / 86_400_000)

  if (diffDays < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, tone: 'overdue' }
  if (diffDays === 0) return { label: 'Due today', tone: 'today' }
  if (diffDays === 1) return { label: 'Due tomorrow', tone: 'soon' }
  if (diffDays <= 7) return { label: `Due in ${diffDays}d`, tone: 'soon' }
  return { label: `Due ${dueDate}`, tone: 'future' }
}

export function getCoachAssignmentSummary(assignment: Record<string, unknown>): CoachAssignmentSummary {
  const reps = numberOrNull(assignment.reps)
  const sets = numberOrNull(assignment.sets)
  const detail = stringOrEmpty(assignment.detail).trim()
  const prompt = stringOrEmpty(assignment.playerPlusPrompt).trim()
  const expectedEvidence = stringOrEmpty(assignment.expectedEvidence).trim()
  const tracker = Array.isArray(assignment.tracker)
    ? assignment.tracker.map((item) => stringOrEmpty(item).trim()).filter(Boolean).slice(0, 4)
    : []

  return {
    detail,
    volume: reps ? `${reps} reps` : sets ? `${sets} sets` : '',
    tracker,
    prompt,
    expectedEvidence,
  }
}

function getPlayerAssignmentPriority(assignment: CoachAssignment, now: Date) {
  if (assignment.status === 'completed') return getCoachAssignmentReview(assignment.assignment) ? 4 : 3
  const dueTone = getCoachAssignmentDueState(assignment.dueDate, now).tone
  if (dueTone === 'overdue') return 0
  if (dueTone === 'today') return 1
  return 2
}

function getDueTimestamp(dueDate: string | null) {
  if (!dueDate) return Number.MAX_SAFE_INTEGER
  const timestamp = Date.parse(`${dueDate}T00:00:00`)
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

function getCoachAssignmentPriority(assignment: CoachAssignment) {
  if (assignmentNeedsCoachReview(assignment)) return 0
  if (assignment.status === 'assigned') return 1
  if (assignment.status === 'completed') return 2
  if (assignment.status === 'draft') return 3
  return 4
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function nullableString(value: unknown) {
  const text = stringOrEmpty(value).trim()
  return text || null
}

function normalizeEmail(value: unknown) {
  const email = stringOrEmpty(value).trim().toLowerCase()
  return email.includes('@') ? email : ''
}

function normalizePhone(value: unknown) {
  return stringOrEmpty(value).replace(/[^\d+]/g, '').slice(0, 24)
}

function nullableDate(value: unknown) {
  const text = stringOrEmpty(value).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function clampText(value: unknown, maxLength: number) {
  return stringOrEmpty(value).trim().slice(0, maxLength)
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
