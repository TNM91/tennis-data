import {
  buildCaptainScopedHref,
  getCaptainResumeHref,
  type CaptainResumeState,
} from './captain-memory'
import {
  buildCoachWorkspaceHref,
  getCoachResumeHref,
  type CoachResumeState,
} from './coach-memory'
import {
  getCompeteResumeHref,
  type CompeteResumeState,
} from './compete-memory'
import {
  getExploreResumeHref,
  type ExploreResumeState,
} from './explore-memory'
import {
  getLeagueCoordinatorResumeHref,
  type LeagueCoordinatorResumeState,
} from './league-coordinator-memory'
import {
  getPlayerImproveResumeHref,
  type PlayerImproveResumeState,
} from './player-improve-memory'

export type PlatformResumeCandidate = {
  id: 'captain' | 'coach' | 'improve' | 'compete' | 'explore' | 'league'
  lane: string
  label: string
  context: string
  href: string
  visitedAt: string
  status: 'unfinished' | 'recent'
  actionLabel: string
  reason: string
  priority: number
  dueAt?: string
  handoff?: boolean
}

export type PlatformResumeHandoff = {
  completedActionLabel: string
  candidate: PlatformResumeCandidate
}

export type PlatformResumeStates = {
  captain?: CaptainResumeState | null
  coach?: CoachResumeState | null
  improve?: PlayerImproveResumeState | null
  compete?: CompeteResumeState | null
  explore?: ExploreResumeState | null
  league?: LeagueCoordinatorResumeState | null
  teamRoomDraftPending?: boolean
}

type ResumeActionSignal = Pick<PlatformResumeCandidate, 'status' | 'actionLabel' | 'reason' | 'priority'> & {
  href?: string
}

function clean(value: string | null | undefined, fallback = '') {
  return (value || '').trim() || fallback
}

function context(parts: Array<string | null | undefined>) {
  return parts.map((part) => clean(part)).filter(Boolean).slice(0, 2).join(' · ')
}

const DAY_MS = 24 * 60 * 60 * 1000

function parsePlatformResumeDueDate(value: string | null | undefined) {
  const normalized = clean(value).slice(0, 80)
  if (!normalized) return null

  const dateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const year = Number(dateOnly[1])
    const month = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    const displayDate = new Date(year, month - 1, day)
    if (
      displayDate.getFullYear() !== year ||
      displayDate.getMonth() !== month - 1 ||
      displayDate.getDate() !== day
    ) return null
    return { normalized, displayDate, dayKey: Date.UTC(year, month - 1, day) }
  }

  const timestamp = Date.parse(normalized)
  if (!Number.isFinite(timestamp)) return null
  const displayDate = new Date(timestamp)
  return {
    normalized,
    displayDate,
    dayKey: Date.UTC(displayDate.getFullYear(), displayDate.getMonth(), displayDate.getDate()),
  }
}

function getPlatformResumeDueDayDelta(candidate: PlatformResumeCandidate, now = Date.now()) {
  const due = parsePlatformResumeDueDate(candidate.dueAt)
  if (!due || !Number.isFinite(now)) return null
  const current = new Date(now)
  const currentDayKey = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate())
  return Math.round((due.dayKey - currentDayKey) / DAY_MS)
}

function getPlatformResumeDueUrgency(candidate: PlatformResumeCandidate, now = Date.now()) {
  if (candidate.status !== 'unfinished') return 0
  const days = getPlatformResumeDueDayDelta(candidate, now)
  if (days === null) return 0
  if (days < -7) return -80
  if (days < 0) return 260 + days * 20
  if (days === 0) return 500
  if (days === 1) return 460
  if (days <= 3) return 400
  if (days <= 7) return 300
  if (days <= 14) return 180
  if (days <= 30) return 80
  return 0
}

export function getPlatformResumeDueLabel(candidate: PlatformResumeCandidate, now = Date.now()) {
  if (candidate.status !== 'unfinished') return ''
  const due = parsePlatformResumeDueDate(candidate.dueAt)
  const days = getPlatformResumeDueDayDelta(candidate, now)
  if (!due || days === null) return ''
  if (days < 0) return 'Past due'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 7) return `In ${days} days`
  return `Due ${due.displayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export function getPlatformResumeDetail(candidate: PlatformResumeCandidate, now = Date.now()) {
  return [candidate.reason || candidate.context, getPlatformResumeDueLabel(candidate, now)]
    .filter(Boolean)
    .join(' · ')
}

function candidate(
  input: Omit<PlatformResumeCandidate, 'status' | 'actionLabel' | 'reason' | 'priority'>,
  action?: ResumeActionSignal | null,
) {
  const href = action?.href || input.href
  if (!href || !input.visitedAt || !Number.isFinite(Date.parse(input.visitedAt))) return null

  const dueAt = parsePlatformResumeDueDate(input.dueAt)?.normalized
  const candidateInput = { ...input }
  delete candidateInput.dueAt

  const normalized = href === '/team-room' || href.startsWith('/team-room?')
    ? { ...candidateInput, href, lane: 'Team Chat', label: clean(input.context, 'Open team chat'), ...(dueAt ? { dueAt } : {}) }
    : { ...candidateInput, href, ...(dueAt ? { dueAt } : {}) }

  return {
    ...normalized,
    status: action?.status || 'recent',
    actionLabel: action?.actionLabel || `Continue ${normalized.lane}`,
    reason: action?.reason || '',
    priority: action?.priority || 0,
  } satisfies PlatformResumeCandidate
}

function captainActionSignal(captain: CaptainResumeState, teamRoomDraftPending: boolean): ResumeActionSignal | null {
  const scope = {
    competitionLayer: captain.competitionLayer,
    team: captain.team,
    league: captain.league,
    flight: captain.flight,
    date: captain.eventDate,
    opponent: captain.opponentTeam,
    matchId: captain.matchId,
    scenarioId: captain.scenarioId,
  }

  const pendingResponses = captain.pendingResponseCount || 0
  if (pendingResponses > 0) {
    return {
      status: 'unfinished',
      actionLabel: 'Check replies',
      reason: `${pendingResponses} player${pendingResponses === 1 ? '' : 's'} still need to answer`,
      priority: 130,
      href: buildCaptainScopedHref('/captain/availability', scope),
    }
  }

  const lineupCount = captain.lineupCount || 0
  if (captain.weekStatus === 'draft-lineup' && lineupCount > 0) {
    return {
      status: 'unfinished',
      actionLabel: 'Finish lineup',
      reason: `${lineupCount} court${lineupCount === 1 ? '' : 's'} still in draft`,
      priority: 110,
      href: buildCaptainScopedHref('/captain/lineup-builder', scope),
    }
  }

  if (captain.weekStatus === 'draft-lineup' && captain.eventDate) {
    return {
      status: 'unfinished',
      actionLabel: 'Build lineup',
      reason: 'Availability is clear for this match',
      priority: 100,
      href: buildCaptainScopedHref('/captain/lineup-builder', scope),
    }
  }

  if (captain.weekStatus === 'ready-to-send') {
    return {
      status: 'unfinished',
      actionLabel: 'Send lineup',
      reason: 'The lineup is ready for the team',
      priority: 120,
      href: buildCaptainScopedHref('/captain/messaging', scope),
    }
  }

  if (captain.lastTool === 'team-room' && teamRoomDraftPending) {
    return {
      status: 'unfinished',
      actionLabel: 'Finish message',
      reason: 'Unsent team message',
      priority: 140,
    }
  }

  return null
}

const PLATFORM_HANDOFF_COPY: Record<string, Pick<PlatformResumeCandidate, 'actionLabel' | 'reason'>> = {
  'Check replies': { actionLabel: 'Build lineup', reason: 'Availability is clear' },
  'Finish lineup': { actionLabel: 'Send lineup', reason: 'The lineup is ready for the team' },
  'Send lineup': { actionLabel: 'Open match day', reason: 'The team update is handled' },
  'Finish message': { actionLabel: 'Open team chat', reason: 'Your message was sent' },
  'Finish assignment': { actionLabel: 'Open player bench', reason: 'The assignment was saved' },
  'Finish reply': { actionLabel: 'Open messages', reason: 'Your reply was sent' },
  'Finish training': { actionLabel: 'View progress', reason: 'Your training was saved' },
  'Finish team result': { actionLabel: 'Review results', reason: 'The team result was saved' },
  'Finish player result': { actionLabel: 'Review results', reason: 'The player result was saved' },
  'Finish tournament': { actionLabel: 'Open tournament', reason: 'The tournament was saved' },
}

function replaceResumeHrefPath(href: string, pathname: string, hash = '') {
  try {
    const parsed = new URL(href, 'https://www.tenaceiq.com')
    return `${pathname}${parsed.search}${hash}`
  } catch {
    return href
  }
}

function getPlatformHandoffHref(completedActionLabel: string, successor: PlatformResumeCandidate) {
  if (completedActionLabel === 'Send lineup') {
    return replaceResumeHrefPath(successor.href, '/captain', '#captain-match-day-command-strip')
  }
  if (completedActionLabel === 'Finish assignment') {
    return replaceResumeHrefPath(successor.href, '/coach', '#coach-linked-dashboard')
  }
  return successor.href
}

export function buildPlatformResumeHandoff(
  previousCandidates: PlatformResumeCandidate[] | null,
  nextCandidates: PlatformResumeCandidate[],
): PlatformResumeHandoff | null {
  if (!previousCandidates?.length) return null

  const completed = previousCandidates.find((previous) => (
    previous.status === 'unfinished'
    && !nextCandidates.some((next) => (
      next.id === previous.id
      && next.status === 'unfinished'
      && next.actionLabel === previous.actionLabel
    ))
  ))
  if (!completed) return null

  const successor = nextCandidates.find((candidate) => candidate.id === completed.id)
  if (!successor) return null
  const copy = PLATFORM_HANDOFF_COPY[completed.actionLabel]

  return {
    completedActionLabel: completed.actionLabel,
    candidate: {
      ...successor,
      actionLabel: successor.status === 'unfinished'
        ? successor.actionLabel
        : copy?.actionLabel || successor.actionLabel,
      reason: successor.status === 'unfinished'
        ? successor.reason
        : copy?.reason || successor.reason,
      href: getPlatformHandoffHref(completed.actionLabel, successor),
      handoff: true,
    },
  }
}

export function applyPlatformResumeHandoff(
  candidates: PlatformResumeCandidate[],
  handoff: PlatformResumeHandoff | null,
) {
  if (!handoff) return candidates
  return [handoff.candidate, ...candidates.filter((candidate) => candidate.id !== handoff.candidate.id)]
}

function hasDraft(value: object | null | undefined) {
  return Boolean(value && Object.keys(value).length)
}

function comparePlatformResumeCandidates(left: PlatformResumeCandidate, right: PlatformResumeCandidate, now = Date.now()) {
  if (left.status !== right.status) return left.status === 'unfinished' ? -1 : 1
  const leftPriority = left.priority + getPlatformResumeDueUrgency(left, now)
  const rightPriority = right.priority + getPlatformResumeDueUrgency(right, now)
  if (leftPriority !== rightPriority) return rightPriority - leftPriority
  return Date.parse(right.visitedAt) - Date.parse(left.visitedAt)
}

export function buildPlatformResumeCandidates(states: PlatformResumeStates, now = Date.now()) {
  const candidates: Array<PlatformResumeCandidate | null> = []
  const captain = states.captain
  const coach = states.coach
  const improve = states.improve
  const compete = states.compete
  const explore = states.explore
  const league = states.league

  if (captain && captain.lastTool !== 'hub') {
    candidates.push(candidate({
      id: 'captain',
      lane: 'Captain',
      label: clean(captain.lastToolLabel, 'Captain work'),
      context: context([captain.team, captain.opponentTeam ? `vs ${captain.opponentTeam}` : '']),
      href: getCaptainResumeHref(captain),
      visitedAt: clean(captain.lastVisitedAt),
      dueAt: clean(captain.eventDate),
    }, captainActionSignal(captain, Boolean(states.teamRoomDraftPending))))
  } else if (captain?.team && captain.eventDate) {
    const scope = {
      competitionLayer: captain.competitionLayer,
      team: captain.team,
      league: captain.league,
      flight: captain.flight,
      date: captain.eventDate,
      opponent: captain.opponentTeam,
      matchId: captain.matchId,
    }
    candidates.push(candidate({
      id: 'captain',
      lane: 'Captain',
      label: 'Next match',
      context: context([captain.team, captain.opponentTeam ? `vs ${captain.opponentTeam}` : '']),
      href: buildCaptainScopedHref('/captain/availability', scope),
      visitedAt: clean(captain.lastVisitedAt),
      dueAt: clean(captain.eventDate),
    }, {
      status: 'unfinished',
      actionLabel: 'Check availability',
      reason: 'Start with player availability',
      priority: 90,
    }))
  }

  if (coach) {
    candidates.push(candidate({
      id: 'coach',
      lane: coach.lastSurface === 'conversation' ? 'Messages' : 'Coach',
      label: clean(coach.lastSurfaceLabel, 'Coaching work'),
      context: clean(coach.playerName),
      href: getCoachResumeHref(coach),
      visitedAt: clean(coach.lastVisitedAt),
      dueAt: clean(coach.assignmentDraft?.dueDate || coach.assignmentDraft?.lessonDateTime),
    }, hasDraft(coach.assignmentDraft) ? {
      status: 'unfinished',
      actionLabel: 'Finish assignment',
      reason: coach.playerName ? `Assignment draft for ${coach.playerName}` : 'Coaching assignment draft',
      priority: 110,
      href: buildCoachWorkspaceHref('coach-lesson-frame', coach.studentLinkId),
    } : null))
  }

  if (improve && improve.lastSurface !== 'improve') {
    candidates.push(candidate({
      id: 'improve',
      lane: improve.lastSurface === 'conversation' ? 'Messages' : 'Improve',
      label: clean(improve.lastSurfaceLabel, improve.assignmentTitle || 'Training work'),
      context: context([improve.assignmentTitle, improve.identityTitle]),
      href: getPlayerImproveResumeHref(improve),
      visitedAt: clean(improve.lastVisitedAt),
    }, improve.conversationDraft ? {
      status: 'unfinished',
      actionLabel: 'Finish reply',
      reason: 'Unsent coach message',
      priority: 130,
    } : hasDraft(improve.sessionDraft) ? {
      status: 'unfinished',
      actionLabel: 'Finish training',
      reason: improve.assignmentTitle || 'Training session in progress',
      priority: 105,
    } : null))
  }

  if (compete && compete.lastSurface !== 'compete') {
    candidates.push(candidate({
      id: 'compete',
      lane: 'Compete',
      label: clean(compete.lastSurfaceLabel, 'Competition work'),
      context: context([compete.matchupLabel, compete.tournamentName || compete.leagueName]),
      href: getCompeteResumeHref(compete),
      visitedAt: clean(compete.lastVisitedAt),
    }))
  }

  if (explore && explore.lastSurface !== 'explore') {
    candidates.push(candidate({
      id: 'explore',
      lane: 'Explore',
      label: clean(explore.lastSurfaceLabel, 'Explore tennis'),
      context: clean(explore.contextLabel),
      href: getExploreResumeHref(explore),
      visitedAt: clean(explore.lastVisitedAt),
    }))
  }

  if (league && league.lastSurface !== 'hub') {
    const tournamentDraftPending = Boolean(
      league.tournamentDraft && !league.tournamentDraft.tournamentId && (
        league.tournamentDraft.name || league.tournamentDraft.startsOn || league.tournamentDraft.locationLabel ||
        league.tournamentDraft.directorNotes || league.tournamentDraft.entrantsText
      ),
    )
    const leagueAction = hasDraft(league.teamResultDraft) ? {
      status: 'unfinished' as const,
      actionLabel: 'Finish team result',
      reason: league.leagueName || 'Team result draft',
      priority: 120,
    } : hasDraft(league.individualResultDraft) ? {
      status: 'unfinished' as const,
      actionLabel: 'Finish player result',
      reason: league.leagueName || 'Player result draft',
      priority: 120,
    } : tournamentDraftPending ? {
      status: 'unfinished' as const,
      actionLabel: 'Finish tournament',
      reason: league.tournamentDraft?.name || 'Tournament draft',
      priority: 100,
    } : null

    candidates.push(candidate({
      id: 'league',
      lane: league.lastSurface === 'conversation' ? 'Messages' : 'League',
      label: clean(league.lastSurfaceLabel, 'League work'),
      context: clean(league.tournamentName || league.leagueName),
      href: getLeagueCoordinatorResumeHref(league),
      visitedAt: clean(league.lastVisitedAt),
      dueAt: clean(
        league.teamResultDraft?.matchDate ||
        league.individualResultDraft?.resultDate ||
        league.tournamentDraft?.startsOn,
      ),
    }, leagueAction))
  }

  return candidates
    .filter((item): item is PlatformResumeCandidate => Boolean(item))
    .sort((left, right) => comparePlatformResumeCandidates(left, right, now))
}

export function mergePlatformResumeCandidates(
  localCandidates: PlatformResumeCandidate[],
  cloudCandidates: PlatformResumeCandidate[],
  now = Date.now(),
) {
  const latestById = new Map<PlatformResumeCandidate['id'], PlatformResumeCandidate>()

  for (const item of [...cloudCandidates, ...localCandidates]) {
    const current = latestById.get(item.id)
    const itemTime = Date.parse(item.visitedAt)
    const currentTime = Date.parse(current?.visitedAt || '')
    if (!current || itemTime > currentTime || (itemTime === currentTime && comparePlatformResumeCandidates(item, current, now) < 0)) {
      latestById.set(item.id, item)
    }
  }

  const seenHrefs = new Set<string>()
  return [...latestById.values()]
    .sort((left, right) => comparePlatformResumeCandidates(left, right, now))
    .filter((item) => {
      if (seenHrefs.has(item.href)) return false
      seenHrefs.add(item.href)
      return true
    })
}

export function sanitizePlatformResumeCandidates(value: unknown): PlatformResumeCandidate[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<PlatformResumeCandidate['id']>(['captain', 'coach', 'improve', 'compete', 'explore', 'league'])

  return value.flatMap<PlatformResumeCandidate>((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const input = entry as Record<string, unknown>
    const id = typeof input.id === 'string' ? input.id as PlatformResumeCandidate['id'] : null
    const href = typeof input.href === 'string' ? input.href.trim().slice(0, 1800) : ''
    const visitedAt = typeof input.visitedAt === 'string' ? input.visitedAt.trim().slice(0, 80) : ''
    const status = input.status === 'unfinished' ? 'unfinished' : input.status === 'recent' ? 'recent' : null
    const priority = typeof input.priority === 'number' && Number.isFinite(input.priority)
      ? Math.max(0, Math.min(999, Math.round(input.priority)))
      : 0
    const dueAt = parsePlatformResumeDueDate(typeof input.dueAt === 'string' ? input.dueAt : '')?.normalized
    if (!id || !ids.has(id) || !status || !href.startsWith('/') || href.startsWith('//') || !Number.isFinite(Date.parse(visitedAt))) return []

    return [{
      id,
      lane: typeof input.lane === 'string' ? input.lane.trim().slice(0, 40) : '',
      label: typeof input.label === 'string' ? input.label.trim().slice(0, 120) : '',
      context: typeof input.context === 'string' ? input.context.trim().slice(0, 300) : '',
      href,
      visitedAt,
      status,
      actionLabel: typeof input.actionLabel === 'string' ? input.actionLabel.trim().slice(0, 80) : '',
      reason: typeof input.reason === 'string' ? input.reason.trim().slice(0, 240) : '',
      priority,
      ...(dueAt ? { dueAt } : {}),
    }]
  })
}
