import type { WeeklyLevelUpRecap, WeeklyLevelUpRep } from './weekly-recap'

export const LEVEL_UP_WEEKLY_PLAN_VERSION = 1 as const

export type WeeklyLevelUpPlanRep = WeeklyLevelUpRep & {
  completedAt: string | null
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
  const reps = plan.reps.map((rep) => {
    if (matched || rep.completedAt || rep.identitySlug !== identitySlug || rep.focusId !== focusId) return rep
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
  const total = plan?.reps.length ?? 0
  const completed = plan?.reps.filter((rep) => Boolean(rep.completedAt)).length ?? 0
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    nextRep: plan?.reps.find((rep) => !rep.completedAt) ?? null,
    complete: total > 0 && completed === total,
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
