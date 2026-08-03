import {
  getCaptainResumeHref,
  type CaptainResumeState,
} from './captain-memory'
import {
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
}

export type PlatformResumeStates = {
  captain?: CaptainResumeState | null
  coach?: CoachResumeState | null
  improve?: PlayerImproveResumeState | null
  compete?: CompeteResumeState | null
  explore?: ExploreResumeState | null
  league?: LeagueCoordinatorResumeState | null
}

function clean(value: string | null | undefined, fallback = '') {
  return (value || '').trim() || fallback
}

function context(parts: Array<string | null | undefined>) {
  return parts.map((part) => clean(part)).filter(Boolean).slice(0, 2).join(' · ')
}

function candidate(input: PlatformResumeCandidate) {
  if (!input.href || !input.visitedAt || !Number.isFinite(Date.parse(input.visitedAt))) return null

  if (input.href === '/team-room' || input.href.startsWith('/team-room?')) {
    return { ...input, lane: 'Team Chat', label: clean(input.context, 'Open team chat') }
  }

  return input
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
    }))
  }

  if (improve && improve.lastSurface !== 'improve') {
    candidates.push(candidate({
      id: 'improve',
      lane: improve.lastSurface === 'conversation' ? 'Messages' : 'Improve',
      label: clean(improve.lastSurfaceLabel, improve.assignmentTitle || 'Training work'),
      context: context([improve.assignmentTitle, improve.identityTitle]),
      href: getPlayerImproveResumeHref(improve),
      visitedAt: clean(improve.lastVisitedAt),
    }))
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
    candidates.push(candidate({
      id: 'league',
      lane: league.lastSurface === 'conversation' ? 'Messages' : 'League',
      label: clean(league.lastSurfaceLabel, 'League work'),
      context: clean(league.tournamentName || league.leagueName),
      href: getLeagueCoordinatorResumeHref(league),
      visitedAt: clean(league.lastVisitedAt),
    }))
  }

  return candidates
    .filter((item): item is PlatformResumeCandidate => Boolean(item))
    .sort((left, right) => Date.parse(right.visitedAt) - Date.parse(left.visitedAt))
}

export function mergePlatformResumeCandidates(
  localCandidates: PlatformResumeCandidate[],
  cloudCandidates: PlatformResumeCandidate[],
) {
  const latestById = new Map<PlatformResumeCandidate['id'], PlatformResumeCandidate>()

  for (const item of [...cloudCandidates, ...localCandidates]) {
    const current = latestById.get(item.id)
    if (!current || Date.parse(item.visitedAt) > Date.parse(current.visitedAt)) {
      latestById.set(item.id, item)
    }
  }

  const seenHrefs = new Set<string>()
  return [...latestById.values()]
    .sort((left, right) => Date.parse(right.visitedAt) - Date.parse(left.visitedAt))
    .filter((item) => {
      if (seenHrefs.has(item.href)) return false
      seenHrefs.add(item.href)
      return true
    })
}

export function sanitizePlatformResumeCandidates(value: unknown) {
  if (!Array.isArray(value)) return []
  const ids = new Set<PlatformResumeCandidate['id']>(['captain', 'coach', 'improve', 'compete', 'explore', 'league'])

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const input = entry as Record<string, unknown>
    const id = typeof input.id === 'string' ? input.id as PlatformResumeCandidate['id'] : null
    const href = typeof input.href === 'string' ? input.href.trim().slice(0, 1800) : ''
    const visitedAt = typeof input.visitedAt === 'string' ? input.visitedAt.trim().slice(0, 80) : ''
    if (!id || !ids.has(id) || !href.startsWith('/') || href.startsWith('//') || !Number.isFinite(Date.parse(visitedAt))) return []

    return [{
      id,
      lane: typeof input.lane === 'string' ? input.lane.trim().slice(0, 40) : '',
      label: typeof input.label === 'string' ? input.label.trim().slice(0, 120) : '',
      context: typeof input.context === 'string' ? input.context.trim().slice(0, 300) : '',
      href,
      visitedAt,
    }]
  })
}
