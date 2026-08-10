import { buildLevelUpTennisStreak } from './quest-handoff'

export type WeeklyLevelUpSessionRead = {
  id: string
  identitySlug?: string
  focusId: string
  focusTitle: string
  drillTitle: string
  rating: number
  completedAt: string
}

export type WeeklyLevelUpFocusRead = {
  id: string
  title: string
  identitySlug?: string
}

export type WeeklyLevelUpRep = {
  id: string
  kind: 'repeat' | 'repair' | 'balance'
  label: string
  title: string
  detail: string
  href: string
}

export type WeeklyLevelUpRecap = {
  proofCount: number
  proofTrend: 'up' | 'steady' | 'down' | 'new'
  proofTrendLabel: string
  activeDays: number
  activeDayTrend: 'up' | 'steady' | 'down' | 'new'
  activeDayTrendLabel: string
  tennisStreakDays: number
  averageRating: number
  strongestFocus: string
  strongestFocusRead: string
  summary: string
  nextReps: WeeklyLevelUpRep[]
}

type BuildWeeklyLevelUpRecapInput = {
  sessions: WeeklyLevelUpSessionRead[]
  focuses?: WeeklyLevelUpFocusRead[]
  identitySlug?: string
  now?: Date
}

type FocusGroup = {
  key: string
  focusId: string
  focusTitle: string
  identitySlug: string
  sessions: WeeklyLevelUpSessionRead[]
  average: number
  latestAt: number
}

export function buildWeeklyLevelUpRecap({
  sessions,
  focuses = [],
  identitySlug = 'relentless-competitor-4-0',
  now = new Date(),
}: BuildWeeklyLevelUpRecapInput): WeeklyLevelUpRecap {
  const end = endOfLocalDay(now)
  const currentStart = startOfLocalDay(addLocalDays(now, -6))
  const previousStart = startOfLocalDay(addLocalDays(now, -13))
  const previousEnd = endOfLocalDay(addLocalDays(now, -7))
  const validSessions = sessions
    .filter(isValidSession)
    .filter((session) => getTime(session.completedAt) <= end.getTime())
  const currentSessions = validSessions.filter((session) => isWithin(session.completedAt, currentStart, end))
  const previousSessions = validSessions.filter((session) => isWithin(session.completedAt, previousStart, previousEnd))
  const currentActiveDays = countActiveDays(currentSessions)
  const previousActiveDays = countActiveDays(previousSessions)
  const proofTrend = getTrend(currentSessions.length, previousSessions.length)
  const activeDayTrend = getTrend(currentActiveDays, previousActiveDays)
  const proofAverage = getAverage(currentSessions)
  const recentSessions = currentSessions.length ? currentSessions : validSessions.slice().sort(sortNewest).slice(0, 20)
  const groups = buildFocusGroups(recentSessions, identitySlug)
  const strongestGroup = groups.slice().sort(sortStrongest)[0] ?? null
  const strongestFocus = strongestGroup?.focusTitle ?? 'First proof decides'
  const strongestFocusRead = strongestGroup
    ? `${strongestGroup.average.toFixed(1)}/5 across ${strongestGroup.sessions.length} proof${strongestGroup.sessions.length === 1 ? '' : 's'}`
    : 'Bank one scored rep to reveal it.'
  const tennisStreakDays = buildLevelUpTennisStreak(validSessions.map((session) => session.completedAt), now)
  const nextReps = buildWeeklyReps({
    currentSessions,
    recentSessions,
    groups,
    focuses,
    fallbackIdentitySlug: identitySlug,
  })

  return {
    proofCount: currentSessions.length,
    proofTrend,
    proofTrendLabel: buildProofTrendLabel(currentSessions.length, previousSessions.length),
    activeDays: currentActiveDays,
    activeDayTrend,
    activeDayTrendLabel: buildActiveDayTrendLabel(currentActiveDays, previousActiveDays),
    tennisStreakDays,
    averageRating: proofAverage,
    strongestFocus,
    strongestFocusRead,
    summary: currentSessions.length
      ? `${currentSessions.length} proof${currentSessions.length === 1 ? '' : 's'} across ${currentActiveDays} active day${currentActiveDays === 1 ? '' : 's'}. ${strongestFocus} is leading.`
      : 'No proof in the last seven days. Start with one short, scored rep.',
    nextReps,
  }
}

function buildWeeklyReps({
  currentSessions,
  recentSessions,
  groups,
  focuses,
  fallbackIdentitySlug,
}: {
  currentSessions: WeeklyLevelUpSessionRead[]
  recentSessions: WeeklyLevelUpSessionRead[]
  groups: FocusGroup[]
  focuses: WeeklyLevelUpFocusRead[]
  fallbackIdentitySlug: string
}) {
  if (!recentSessions.length) {
    return buildStarterWeek(focuses, fallbackIdentitySlug)
  }

  const strongestGroup = groups.slice().sort(sortStrongest)[0] ?? null
  const weakestGroup = groups
    .filter((group) => group.key !== strongestGroup?.key)
    .sort(sortWeakest)[0] ?? groups.slice().sort(sortWeakest)[0] ?? null
  const strongestSession = strongestGroup?.sessions.slice().sort(sortHighestProof)[0] ?? null
  const weakestSession = weakestGroup?.sessions.slice().sort(sortLowestProof)[0] ?? null
  const usedFocusKeys = new Set(currentSessions.map((session) => focusKey(session.identitySlug || fallbackIdentitySlug, session.focusId)))
  const balanceFocus = focuses.find((focus) => !usedFocusKeys.has(focusKey(focus.identitySlug || fallbackIdentitySlug, focus.id)))
    ?? focuses.find((focus) => focus.id !== strongestGroup?.focusId)
    ?? focuses[0]
    ?? null
  const latestSession = recentSessions.slice().sort(sortNewest)[0] ?? null
  const reps: WeeklyLevelUpRep[] = []

  if (strongestSession) {
    reps.push({
      id: `repeat-${strongestSession.id}`,
      kind: 'repeat',
      label: 'Keep the win',
      title: `Repeat ${strongestSession.drillTitle}`,
      detail: `Prove ${Math.max(4, strongestSession.rating)}/5 again before adding speed or pressure.`,
      href: buildFocusHref(strongestSession.identitySlug || fallbackIdentitySlug, strongestSession.focusId),
    })
  }

  if (weakestSession) {
    reps.push({
      id: `repair-${weakestSession.id}`,
      kind: 'repair',
      label: 'Repair next',
      title: `Clean up ${weakestSession.drillTitle}`,
      detail: 'Slow the rep down, fix the first visible leak, then score it again.',
      href: buildFocusHref(weakestSession.identitySlug || fallbackIdentitySlug, weakestSession.focusId),
    })
  }

  if (balanceFocus) {
    reps.push({
      id: `balance-${balanceFocus.identitySlug || fallbackIdentitySlug}-${balanceFocus.id}`,
      kind: 'balance',
      label: 'Round out week',
      title: `${formatFocusTitle(balanceFocus.title)} proof`,
      detail: 'Bank one short block so this week is not built around only one tennis job.',
      href: buildFocusHref(balanceFocus.identitySlug || fallbackIdentitySlug, balanceFocus.id),
    })
  }

  const seedFocus = balanceFocus ?? (latestSession ? {
    id: latestSession.focusId,
    title: latestSession.focusTitle,
    identitySlug: latestSession.identitySlug,
  } : focuses[0])

  while (reps.length < 3 && seedFocus) {
    const slot = reps.length
    reps.push({
      id: `starter-${slot}-${seedFocus.identitySlug || fallbackIdentitySlug}-${seedFocus.id}`,
      kind: slot === 0 ? 'repeat' : slot === 1 ? 'repair' : 'balance',
      label: slot === 0 ? 'Start here' : slot === 1 ? 'Add proof' : 'Match transfer',
      title: slot === 0 ? `${formatFocusTitle(seedFocus.title)} starter` : `${formatFocusTitle(seedFocus.title)} rep ${slot + 1}`,
      detail: slot === 0
        ? 'Run one clean block and save the first honest score.'
        : slot === 1
          ? 'Repeat the same cue once before changing the job.'
          : 'Finish with one point-pattern or pressure version of the same work.',
      href: buildFocusHref(seedFocus.identitySlug || fallbackIdentitySlug, seedFocus.id),
    })
  }

  return reps.slice(0, 3)
}

function buildStarterWeek(focuses: WeeklyLevelUpFocusRead[], fallbackIdentitySlug: string) {
  if (!focuses.length) return []

  return Array.from({ length: 3 }, (_, index) => {
    const focus = focuses[index % focuses.length]
    const label = index === 0 ? 'Start here' : index === 1 ? 'Add proof' : 'Match transfer'
    const detail = index === 0
      ? 'Run one clean block and save the first honest score.'
      : index === 1
        ? 'Add a second tennis job so the week starts balanced.'
        : 'Finish with one point-pattern or pressure version of the work.'

    return {
      id: `starter-${index}-${focus.identitySlug || fallbackIdentitySlug}-${focus.id}`,
      kind: index === 0 ? 'repeat' as const : index === 1 ? 'repair' as const : 'balance' as const,
      label,
      title: `${formatFocusTitle(focus.title)} ${index === 0 ? 'starter' : 'proof'}`,
      detail,
      href: buildFocusHref(focus.identitySlug || fallbackIdentitySlug, focus.id),
    }
  })
}

function buildFocusGroups(sessions: WeeklyLevelUpSessionRead[], fallbackIdentitySlug: string) {
  const groups = new Map<string, FocusGroup>()

  for (const session of sessions) {
    const identitySlug = session.identitySlug || fallbackIdentitySlug
    const key = focusKey(identitySlug, session.focusId)
    const current = groups.get(key)
    if (current) {
      current.sessions.push(session)
      current.average = getAverage(current.sessions)
      current.latestAt = Math.max(current.latestAt, getTime(session.completedAt))
      continue
    }

    groups.set(key, {
      key,
      focusId: session.focusId,
      focusTitle: formatFocusTitle(session.focusTitle),
      identitySlug,
      sessions: [session],
      average: clampRating(session.rating),
      latestAt: getTime(session.completedAt),
    })
  }

  return [...groups.values()]
}

function buildProofTrendLabel(current: number, previous: number) {
  if (!current && !previous) return 'First proof starts the week'
  if (current > previous) return `+${current - previous} vs prior 7 days`
  if (current < previous) return `${previous - current} fewer than prior 7 days`
  return 'Even with prior 7 days'
}

function buildActiveDayTrendLabel(current: number, previous: number) {
  if (!current && !previous) return 'Start with one active day'
  if (current > previous) return `Up ${current - previous} active day${current - previous === 1 ? '' : 's'}`
  if (current < previous) return `Down ${previous - current} active day${previous - current === 1 ? '' : 's'}`
  return `${current} active day${current === 1 ? '' : 's'} again`
}

function getTrend(current: number, previous: number): WeeklyLevelUpRecap['proofTrend'] {
  if (!previous && current) return 'new'
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'steady'
}

function countActiveDays(sessions: WeeklyLevelUpSessionRead[]) {
  return new Set(sessions.map((session) => toLocalDateKey(session.completedAt))).size
}

function getAverage(sessions: WeeklyLevelUpSessionRead[]) {
  if (!sessions.length) return 0
  return sessions.reduce((total, session) => total + clampRating(session.rating), 0) / sessions.length
}

function sortStrongest(a: FocusGroup, b: FocusGroup) {
  return b.average - a.average || b.sessions.length - a.sessions.length || b.latestAt - a.latestAt
}

function sortWeakest(a: FocusGroup, b: FocusGroup) {
  return a.average - b.average || b.sessions.length - a.sessions.length || b.latestAt - a.latestAt
}

function sortNewest(a: WeeklyLevelUpSessionRead, b: WeeklyLevelUpSessionRead) {
  return getTime(b.completedAt) - getTime(a.completedAt)
}

function sortHighestProof(a: WeeklyLevelUpSessionRead, b: WeeklyLevelUpSessionRead) {
  return clampRating(b.rating) - clampRating(a.rating) || sortNewest(a, b)
}

function sortLowestProof(a: WeeklyLevelUpSessionRead, b: WeeklyLevelUpSessionRead) {
  return clampRating(a.rating) - clampRating(b.rating) || sortNewest(a, b)
}

function buildFocusHref(identitySlug: string, focusId: string) {
  return `/level-up/${encodeURIComponent(identitySlug)}?focus=${encodeURIComponent(focusId)}#level-up-flow`
}

function focusKey(identitySlug: string, focusId: string) {
  return `${identitySlug}:${focusId}`
}

function formatFocusTitle(title: string) {
  return title.replace(' Development', '').replace(' Section', '').trim() || 'Tennis focus'
}

function isWithin(value: string, start: Date, end: Date) {
  const time = getTime(value)
  return time >= start.getTime() && time <= end.getTime()
}

function isValidSession(session: WeeklyLevelUpSessionRead) {
  return Boolean(session.id && session.focusId && session.focusTitle && session.drillTitle && getTime(session.completedAt))
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toLocalDateKey(value: string) {
  const date = new Date(value)
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

function clampRating(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0
}
