import type { WeeklyLevelUpRecap, WeeklyLevelUpRep } from './weekly-recap'

export const LEVEL_UP_WEEKLY_PLAN_VERSION = 1 as const

export type WeeklyLevelUpPlanRep = WeeklyLevelUpRep & {
  completedAt: string | null
}

export type WeeklyLevelUpPlayerReply = {
  action: 'acknowledged' | 'question'
  message: string
  playerUserId: string
  updatedAt: string
}

export type WeeklyLevelUpCoachResponse = {
  action: 'acknowledged' | 'answered' | 'adjusted' | 'replaced'
  note: string
  targetRepId: string | null
  replacementRep: WeeklyLevelUpRep | null
  coachUserId: string
  updatedAt: string
  playerReply: WeeklyLevelUpPlayerReply | null
}

export type WeeklyLevelUpPlan = {
  version: typeof LEVEL_UP_WEEKLY_PLAN_VERSION
  id: string
  identitySlug: string
  weekStart: string
  summary: string
  strongestFocus: string
  reps: WeeklyLevelUpPlanRep[]
  sharedWithCoach: boolean
  coachUserId: string | null
  studentLinkId: string | null
  coachResponse: WeeklyLevelUpCoachResponse | null
  createdAt: string
  updatedAt: string
}

export type WeeklyLevelUpPlanRow = {
  id: string
  player_user_id: string
  coach_user_id: string | null
  student_link_id: string | null
  identity_slug: string
  week_start: string
  shared_with_coach: boolean
  plan_json: unknown
  created_at: string
  updated_at: string
}

export type WeeklyLevelUpCoachNotification = {
  title: string
  body: string
  href: string
}

export function getWeeklyLevelUpPlanWeekStart(now = new Date()) {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return toLocalDateKey(date)
}

export function getWeeklyLevelUpPlanStorageKey(identitySlug: string, weekStart: string, userId = '') {
  return `tenaceiq:level-up-week-plan:v${LEVEL_UP_WEEKLY_PLAN_VERSION}:${cleanKey(userId || 'device')}:${cleanKey(identitySlug)}:${weekStart}`
}

export function buildWeeklyLevelUpPlan(
  recap: WeeklyLevelUpRecap,
  identitySlug: string,
  now = new Date(),
): WeeklyLevelUpPlan | null {
  if (!recap.nextReps.length) return null
  const timestamp = now.toISOString()
  const weekStart = getWeeklyLevelUpPlanWeekStart(now)

  return {
    version: LEVEL_UP_WEEKLY_PLAN_VERSION,
    id: `level-up-week-${weekStart}-${cleanKey(identitySlug)}-${crypto.randomUUID()}`,
    identitySlug,
    weekStart,
    summary: recap.summary,
    strongestFocus: recap.strongestFocus,
    reps: recap.nextReps.slice(0, 3).map((rep) => ({ ...rep, completedAt: null })),
    sharedWithCoach: false,
    coachUserId: null,
    studentLinkId: null,
    coachResponse: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function toggleWeeklyLevelUpPlanRep(plan: WeeklyLevelUpPlan, repId: string, now = new Date()) {
  const timestamp = now.toISOString()
  return {
    ...plan,
    reps: plan.reps.map((rep) => rep.id === repId ? { ...rep, completedAt: rep.completedAt ? null : timestamp } : rep),
    updatedAt: timestamp,
  }
}

export function completeWeeklyLevelUpPlanFocus(
  plan: WeeklyLevelUpPlan,
  identitySlug: string,
  focusId: string,
  completedAt = new Date().toISOString(),
) {
  let matched = false
  const effectiveReps = getWeeklyLevelUpPlanReps(plan)
  const reps = plan.reps.map((rep, index) => {
    const effectiveRep = effectiveReps[index] ?? rep
    if (matched || rep.completedAt || effectiveRep.identitySlug !== identitySlug || effectiveRep.focusId !== focusId) return rep
    matched = true
    return { ...rep, completedAt }
  })
  return matched ? { ...plan, reps, updatedAt: completedAt } : plan
}

export function setWeeklyLevelUpPlanShared(
  plan: WeeklyLevelUpPlan,
  sharedWithCoach: boolean,
  link: { coachUserId?: string | null; studentLinkId?: string | null } = {},
  now = new Date(),
) {
  return {
    ...plan,
    sharedWithCoach,
    coachUserId: sharedWithCoach ? link.coachUserId ?? plan.coachUserId : null,
    studentLinkId: sharedWithCoach ? link.studentLinkId ?? plan.studentLinkId : null,
    updatedAt: now.toISOString(),
  }
}

export function getWeeklyLevelUpPlanProgress(plan: WeeklyLevelUpPlan | null) {
  const reps = plan ? getWeeklyLevelUpPlanReps(plan) : []
  const total = reps.length
  const completed = reps.filter((rep) => Boolean(rep.completedAt)).length
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    nextRep: reps.find((rep) => !rep.completedAt) ?? null,
    complete: total > 0 && completed === total,
  }
}

export function selectWeeklyLevelUpPlanForMyQuest(plans: WeeklyLevelUpPlan[], currentWeekStart: string) {
  return plans.find((plan) => Boolean(plan.coachResponse && !plan.coachResponse.playerReply))
    ?? plans.find((plan) => plan.weekStart === currentWeekStart)
    ?? plans[0]
    ?? null
}

export function buildWeeklyLevelUpCoachNotification(
  plan: Pick<WeeklyLevelUpPlan, 'id'>,
  response: WeeklyLevelUpCoachResponse,
): WeeklyLevelUpCoachNotification {
  const title = response.action === 'answered'
    ? 'Your coach answered'
    : response.action === 'adjusted'
      ? 'Your coach added a cue'
      : response.action === 'replaced'
        ? 'Your coach changed a rep'
        : 'Your coach reviewed your week'
  const replacementTitle = response.action === 'replaced' ? cleanText(response.replacementRep?.title) : ''
  const note = cleanText(response.note)
  const body = [replacementTitle, note]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join('. ')
    .slice(0, 180)

  return {
    title,
    body: body || 'Open My Quest to see the update and keep moving.',
    href: `/level-up/my-quest?coachUpdate=${encodeURIComponent(plan.id)}#level-up-coach-update`,
  }
}

export function isWeeklyLevelUpCoachNotification(value: { href?: string | null }) {
  const href = cleanText(value.href)
  return href.startsWith('/level-up/my-quest') && href.includes('#level-up-coach-update')
}

export function getWeeklyLevelUpPlanReps(plan: WeeklyLevelUpPlan): WeeklyLevelUpPlanRep[] {
  const response = plan.coachResponse
  if (response?.action !== 'replaced' || !response.targetRepId || !response.replacementRep) return plan.reps
  const replacementRep = response.replacementRep
  return plan.reps.map((rep) => rep.id === response.targetRepId
    ? { ...replacementRep, id: rep.id, completedAt: rep.completedAt }
    : rep)
}

export function buildWeeklyLevelUpCoachResponse(
  plan: WeeklyLevelUpPlan,
  input: {
    action: WeeklyLevelUpCoachResponse['action']
    note?: string
    targetRepId?: string | null
    replacementRep?: WeeklyLevelUpRep | null
  },
  coachUserId: string,
  now = new Date(),
): WeeklyLevelUpCoachResponse | null {
  if (input.action === 'answered' && plan.coachResponse?.playerReply?.action !== 'question') return null
  const needsTargetRep = input.action === 'adjusted' || input.action === 'replaced'
  const targetRepId = needsTargetRep ? cleanText(input.targetRepId) : null
  const targetRep = targetRepId ? plan.reps.find((rep) => rep.id === targetRepId) : null
  if (needsTargetRep && !targetRep) return null
  if (input.action === 'replaced' && (!input.replacementRep || targetRep?.completedAt)) return null
  const replacementRep = input.action === 'replaced' && input.replacementRep
    ? parseRep({ ...input.replacementRep, completedAt: null })
    : null
  if (input.action === 'replaced' && !replacementRep) return null
  const note = cleanText(input.note).slice(0, 500)
  if ((input.action === 'adjusted' || input.action === 'answered') && !note) return null

  return {
    action: input.action,
    note,
    targetRepId: targetRepId || null,
    replacementRep: replacementRep ? stripCompletion(replacementRep) : null,
    coachUserId: cleanText(coachUserId),
    updatedAt: now.toISOString(),
    playerReply: null,
  }
}

export function buildWeeklyLevelUpPlayerReply(
  plan: WeeklyLevelUpPlan,
  input: { action: WeeklyLevelUpPlayerReply['action']; message?: string },
  playerUserId: string,
  now = new Date(),
): WeeklyLevelUpPlayerReply | null {
  if (!plan.coachResponse) return null
  const playerId = cleanText(playerUserId)
  if (!playerId) return null
  const message = cleanText(input.message).slice(0, 500)
  if (input.action === 'question' && !message) return null

  return {
    action: input.action,
    message: input.action === 'question' ? message : '',
    playerUserId: playerId,
    updatedAt: now.toISOString(),
  }
}

export function parseWeeklyLevelUpPlan(value: unknown): WeeklyLevelUpPlan | null {
  if (typeof value === 'string') {
    try {
      return parseWeeklyLevelUpPlan(JSON.parse(value))
    } catch {
      return null
    }
  }
  if (!isRecord(value) || value.version !== LEVEL_UP_WEEKLY_PLAN_VERSION || !Array.isArray(value.reps)) return null
  const identitySlug = cleanText(value.identitySlug)
  const weekStart = cleanText(value.weekStart)
  const id = cleanText(value.id)
  if (!id || !identitySlug || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null

  const reps = value.reps.map(parseRep).filter((rep): rep is WeeklyLevelUpPlanRep => Boolean(rep)).slice(0, 3)
  if (!reps.length) return null
  const createdAt = normalizeIso(value.createdAt) || new Date().toISOString()
  const updatedAt = normalizeIso(value.updatedAt) || createdAt
  return {
    version: LEVEL_UP_WEEKLY_PLAN_VERSION,
    id,
    identitySlug,
    weekStart,
    summary: cleanText(value.summary).slice(0, 500),
    strongestFocus: cleanText(value.strongestFocus).slice(0, 160),
    reps,
    sharedWithCoach: Boolean(value.sharedWithCoach),
    coachUserId: nullableText(value.coachUserId),
    studentLinkId: nullableText(value.studentLinkId),
    coachResponse: parseCoachResponse(value.coachResponse),
    createdAt,
    updatedAt,
  }
}

export function mapWeeklyLevelUpPlanRow(row: WeeklyLevelUpPlanRow) {
  const plan = parseWeeklyLevelUpPlan(row.plan_json)
  if (!plan) return null
  return {
    ...plan,
    id: row.id,
    identitySlug: row.identity_slug,
    weekStart: row.week_start,
    sharedWithCoach: Boolean(row.shared_with_coach),
    coachUserId: row.coach_user_id,
    studentLinkId: row.student_link_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseRep(value: unknown): WeeklyLevelUpPlanRep | null {
  if (!isRecord(value)) return null
  const kind = value.kind === 'repeat' || value.kind === 'repair' || value.kind === 'balance' ? value.kind : null
  const id = cleanText(value.id)
  const focusId = cleanText(value.focusId)
  const identitySlug = cleanText(value.identitySlug)
  const href = cleanText(value.href)
  if (!kind || !id || !focusId || !identitySlug || !href.startsWith('/level-up/')) return null
  return {
    id,
    kind,
    focusId,
    identitySlug,
    label: cleanText(value.label).slice(0, 80),
    title: cleanText(value.title).slice(0, 180),
    detail: cleanText(value.detail).slice(0, 360),
    href,
    completedAt: normalizeIso(value.completedAt) || null,
  }
}

function parseCoachResponse(value: unknown): WeeklyLevelUpCoachResponse | null {
  if (!isRecord(value)) return null
  const action = value.action === 'acknowledged' || value.action === 'answered' || value.action === 'adjusted' || value.action === 'replaced'
    ? value.action
    : null
  const coachUserId = cleanText(value.coachUserId)
  const updatedAt = normalizeIso(value.updatedAt)
  if (!action || !coachUserId || !updatedAt) return null
  const needsTargetRep = action === 'adjusted' || action === 'replaced'
  const targetRepId = needsTargetRep ? nullableText(value.targetRepId) : null
  if (needsTargetRep && !targetRepId) return null
  const replacement = action === 'replaced'
    ? parseRep({ ...(isRecord(value.replacementRep) ? value.replacementRep : {}), completedAt: null })
    : null
  if (action === 'replaced' && !replacement) return null
  const note = cleanText(value.note).slice(0, 500)
  if ((action === 'adjusted' || action === 'answered') && !note) return null
  return {
    action,
    note,
    targetRepId,
    replacementRep: replacement ? stripCompletion(replacement) : null,
    coachUserId,
    updatedAt,
    playerReply: parsePlayerReply(value.playerReply),
  }
}

function parsePlayerReply(value: unknown): WeeklyLevelUpPlayerReply | null {
  if (!isRecord(value)) return null
  const action = value.action === 'acknowledged' || value.action === 'question' ? value.action : null
  const playerUserId = cleanText(value.playerUserId)
  const updatedAt = normalizeIso(value.updatedAt)
  const message = cleanText(value.message).slice(0, 500)
  if (!action || !playerUserId || !updatedAt || (action === 'question' && !message)) return null
  return { action, message: action === 'question' ? message : '', playerUserId, updatedAt }
}

function stripCompletion(rep: WeeklyLevelUpPlanRep): WeeklyLevelUpRep {
  return {
    id: rep.id,
    kind: rep.kind,
    focusId: rep.focusId,
    identitySlug: rep.identitySlug,
    label: rep.label,
    title: rep.title,
    detail: rep.detail,
    href: rep.href,
  }
}

function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function cleanKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'default'
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function nullableText(value: unknown) {
  const text = cleanText(value)
  return text || null
}

function normalizeIso(value: unknown) {
  const text = cleanText(value)
  if (!text) return ''
  const date = new Date(text)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
