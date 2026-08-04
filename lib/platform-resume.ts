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

function candidate(
  input: Omit<PlatformResumeCandidate, 'status' | 'actionLabel' | 'reason' | 'priority'>,
  action?: ResumeActionSignal | null,
) {
  const href = action?.href || input.href
  if (!href || !input.visitedAt || !Number.isFinite(Date.parse(input.visitedAt))) return null

  const normalized = href === '/team-room' || href.startsWith('/team-room?')
    ? { ...input, href, lane: 'Team Chat', label: clean(input.context, 'Open team chat') }
    : { ...input, href }

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

  if (captain.lastTool === 'team-room' && teamRoomDraftPending) {
    return {
      status: 'unfinished',
      actionLabel: 'Finish message',
      reason: 'Unsent team message',
      priority: 140,
    }
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

  if (captain.weekStatus === 'ready-to-send') {
    return {
      status: 'unfinished',
      actionLabel: 'Send lineup',
      reason: 'The lineup is ready for the team',
      priority: 120,
      href: buildCaptainScopedHref('/captain/messaging', scope),
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

  return null
}

function hasDraft(value: object | null | undefined) {
  return Boolean(value && Object.keys(value).length)
}

function comparePlatformResumeCandidates(left: PlatformResumeCandidate, right: PlatformResumeCandidate) {
  if (left.status !== right.status) return left.status === 'unfinished' ? -1 : 1
  if (left.priority !== right.priority) return right.priority - left.priority
  return Date.parse(right.visitedAt) - Date.parse(left.visitedAt)
}

export function buildPlatformResumeCandidates(states: PlatformResumeStates) {
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
    }, captainActionSignal(captain, Boolean(states.teamRoomDraftPending))))
  }

  if (coach) {
    candidates.push(candidate({
      id: 'coach',
      lane: coach.lastSurface === 'conversation' ? 'Messages' : 'Coach',
      label: clean(coach.lastSurfaceLabel, 'Coaching work'),
      context: clean(coach.playerName),
      href: getCoachResumeHref(coach),
      visitedAt: clean(coach.lastVisitedAt),
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
    }, leagueAction))
  }

  return candidates
    .filter((item): item is PlatformResumeCandidate => Boolean(item))
    .sort(comparePlatformResumeCandidates)
}

export function mergePlatformResumeCandidates(
  localCandidates: PlatformResumeCandidate[],
  cloudCandidates: PlatformResumeCandidate[],
) {
  const latestById = new Map<PlatformResumeCandidate['id'], PlatformResumeCandidate>()

  for (const item of [...cloudCandidates, ...localCandidates]) {
    const current = latestById.get(item.id)
    const itemTime = Date.parse(item.visitedAt)
    const currentTime = Date.parse(current?.visitedAt || '')
    if (!current || itemTime > currentTime || (itemTime === currentTime && comparePlatformResumeCandidates(item, current) < 0)) {
      latestById.set(item.id, item)
    }
  }

  const seenHrefs = new Set<string>()
  return [...latestById.values()]
    .sort(comparePlatformResumeCandidates)
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
    }]
  })
}
