import type { LevelUpSession } from '@/lib/level-up-sessions'

export const LEVEL_UP_QUEST_HANDOFF_KEY = 'tiq-level-up-quest-handoff-v1'

export type LevelUpQuestHandoffState = 'ready' | 'pending' | 'credited' | 'sync_issue'

export type LevelUpQuestHandoff = {
  version: 1
  sessionId: string
  identitySlug: string
  focusId: string
  focusTitle: string
  drillTitle: string
  rating: number
  completedAt: string
  tennisStreakDays: number
  questState: LevelUpQuestHandoffState
  questMessage: string
  nextRepTitle: string
  nextRepHref: string
  questBuilderHref: string
}

type BuildLevelUpQuestHandoffInput = {
  sessionId: string
  identitySlug: string
  focusId: string
  focusTitle: string
  drillTitle: string
  rating: number
  completedAt: string
  tennisStreakDays: number
  nextRepTitle?: string
  nextRepCardId?: string
  questCardId?: string
  customQuestId?: string
}

export function buildLevelUpQuestHandoff(input: BuildLevelUpQuestHandoffInput): LevelUpQuestHandoff {
  const identitySlug = cleanText(input.identitySlug) || 'relentless-competitor-4-0'
  const focusId = cleanText(input.focusId) || 'focus'
  const questCardId = cleanText(input.questCardId)
  const customQuestId = cleanText(input.customQuestId)
  const nextRepCardId = cleanText(input.nextRepCardId)
  const nextParams = new URLSearchParams()

  if (nextRepCardId) nextParams.set('card', nextRepCardId)
  else nextParams.set('focus', focusId)

  return {
    version: 1,
    sessionId: cleanText(input.sessionId),
    identitySlug,
    focusId,
    focusTitle: cleanText(input.focusTitle) || 'Tennis work',
    drillTitle: cleanText(input.drillTitle) || 'Saved rep',
    rating: clampRating(input.rating),
    completedAt: normalizeIsoDate(input.completedAt) || new Date().toISOString(),
    tennisStreakDays: clampStreak(input.tennisStreakDays),
    questState: customQuestId && questCardId ? 'pending' : 'ready',
    questMessage: customQuestId && questCardId ? 'Quest XP queued.' : 'Tennis proof is ready for a quest.',
    nextRepTitle: cleanText(input.nextRepTitle) || cleanText(input.drillTitle) || 'Next tennis rep',
    nextRepHref: `/level-up/${encodeURIComponent(identitySlug)}?${nextParams.toString()}#level-up-flow`,
    questBuilderHref: questCardId
      ? `/level-up/${encodeURIComponent(identitySlug)}?questCard=${encodeURIComponent(questCardId)}#quest-builder`
      : `/level-up/${encodeURIComponent(identitySlug)}#quest-builder`,
  }
}

export function buildLevelUpQuestHandoffFromSessions(sessions: LevelUpSession[]) {
  const latest = sessions.reduce<LevelUpSession | null>((current, session) => {
    if (!current) return session
    return getTime(session.completedAt) > getTime(current.completedAt) ? session : current
  }, null)

  if (!latest) return null

  return buildLevelUpQuestHandoff({
    sessionId: latest.id,
    identitySlug: latest.identitySlug,
    focusId: latest.focusId,
    focusTitle: latest.focusTitle,
    drillTitle: latest.drillTitle,
    rating: latest.rating,
    completedAt: latest.completedAt,
    tennisStreakDays: buildLevelUpTennisStreak(sessions.map((session) => session.completedAt)),
    nextRepTitle: latest.drillTitle,
  })
}

export function buildLevelUpTennisStreak(completedAtDates: string[], now = new Date()) {
  const dateKeys = new Set(completedAtDates.map(toLocalDateKey).filter(Boolean))
  if (!dateKeys.size) return 0

  const today = startOfLocalDay(now)
  const yesterday = addLocalDays(today, -1)
  let cursor = dateKeys.has(toLocalDateKey(today))
    ? today
    : dateKeys.has(toLocalDateKey(yesterday))
      ? yesterday
      : null

  if (!cursor) return 0

  let streak = 0
  while (dateKeys.has(toLocalDateKey(cursor))) {
    streak += 1
    cursor = addLocalDays(cursor, -1)
  }

  return streak
}

export function parseLevelUpQuestHandoff(value: string | null): LevelUpQuestHandoff | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as unknown
    if (!isRecord(parsed) || parsed.version !== 1) return null

    const sessionId = cleanText(parsed.sessionId)
    const identitySlug = cleanText(parsed.identitySlug)
    const focusId = cleanText(parsed.focusId)
    const completedAt = normalizeIsoDate(parsed.completedAt)
    if (!sessionId || !identitySlug || !focusId || !completedAt) return null

    const questState = isQuestState(parsed.questState) ? parsed.questState : 'ready'
    return {
      version: 1,
      sessionId,
      identitySlug,
      focusId,
      focusTitle: cleanText(parsed.focusTitle) || 'Tennis work',
      drillTitle: cleanText(parsed.drillTitle) || 'Saved rep',
      rating: clampRating(parsed.rating),
      completedAt,
      tennisStreakDays: clampStreak(parsed.tennisStreakDays),
      questState,
      questMessage: cleanText(parsed.questMessage) || 'Tennis proof is ready for a quest.',
      nextRepTitle: cleanText(parsed.nextRepTitle) || cleanText(parsed.drillTitle) || 'Next tennis rep',
      nextRepHref: safeLevelUpHref(parsed.nextRepHref, identitySlug, focusId),
      questBuilderHref: safeQuestBuilderHref(parsed.questBuilderHref, identitySlug),
    }
  } catch {
    return null
  }
}

export function chooseLatestLevelUpQuestHandoff(
  local: LevelUpQuestHandoff | null,
  remote: LevelUpQuestHandoff | null,
) {
  if (!local) return remote
  if (!remote) return local
  return getTime(remote.completedAt) > getTime(local.completedAt) ? remote : local
}

export function updateLevelUpQuestHandoffMessage(
  handoff: LevelUpQuestHandoff,
  questMessage: string,
): LevelUpQuestHandoff {
  const message = cleanText(questMessage)
  const normalized = message.toLowerCase()
  const questState: LevelUpQuestHandoffState = normalized.includes('recorded')
    ? 'credited'
    : normalized.includes('could not') || normalized.includes('skipped') || normalized.includes('sign in')
      ? 'sync_issue'
      : normalized.includes('queued')
        ? 'pending'
        : handoff.questState

  return {
    ...handoff,
    questState,
    questMessage: message || handoff.questMessage,
  }
}

function safeLevelUpHref(value: unknown, identitySlug: string, focusId: string) {
  const href = cleanText(value)
  return href.startsWith('/level-up/')
    ? href
    : `/level-up/${encodeURIComponent(identitySlug)}?focus=${encodeURIComponent(focusId)}#level-up-flow`
}

function safeQuestBuilderHref(value: unknown, identitySlug: string) {
  const href = cleanText(value)
  return href.startsWith('/level-up/') && href.includes('#quest-builder')
    ? href
    : `/level-up/${encodeURIComponent(identitySlug)}#quest-builder`
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toLocalDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTime(value: string) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function normalizeIsoDate(value: unknown) {
  const date = new Date(cleanText(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function clampRating(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number.parseInt(cleanText(value), 10)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(5, Math.round(numeric))) : 0
}

function clampStreak(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number.parseInt(cleanText(value), 10)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(3650, Math.round(numeric))) : 0
}

function isQuestState(value: unknown): value is LevelUpQuestHandoffState {
  return value === 'ready' || value === 'pending' || value === 'credited' || value === 'sync_issue'
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
