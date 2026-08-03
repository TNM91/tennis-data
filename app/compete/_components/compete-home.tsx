'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import RoleActionHome, { type RoleHomeAction, type RoleHomeQuickAction } from '@/app/components/role-action-home'
import {
  chooseLatestCompeteResumeState,
  getCompeteResumeHref,
  loadCompeteResumeStateFromCloud,
  readCompeteResumeState,
  syncCompeteResumeState,
  writeCompeteResumeState,
  type CompeteResumeState,
  type CompeteResumeSurface,
} from '@/lib/compete-memory'

const primaryAction: RoleHomeAction = {
  label: 'Start here',
  title: 'Prep your next matchup',
  detail: 'Compare the players and leave with the first thing to watch.',
  cta: 'Prep matchup',
  href: '/matchup',
  icon: 'matchupAnalysis',
  event: { eventName: 'matchup_started', surface: 'matchup', metadata: { location: 'compete_hub', job: 'prep_matchup' } },
}

const quickActions: RoleHomeQuickAction[] = [
  {
    title: 'Scout player',
    detail: 'Ratings and recent context',
    href: '/explore/players',
    icon: 'playerRatings',
    event: { eventName: 'search_result_clicked', surface: 'public_site', metadata: { location: 'compete_hub', job: 'scout_players' } },
  },
  {
    title: 'Build lineup',
    detail: 'Turn the read into a team plan',
    href: '/captain/lineup-builder',
    icon: 'lineupBuilder',
    event: { eventName: 'lineup_preview_clicked', surface: 'captain', metadata: { location: 'compete_hub', job: 'build_lineup_plan' } },
  },
  {
    title: 'Check results',
    detail: 'Review what happened',
    href: '/compete/results',
    icon: 'reports',
    event: { eventName: 'standings_preview_clicked', surface: 'public_site', metadata: { location: 'compete_hub', job: 'track_results' } },
  },
  {
    title: 'Read a team',
    detail: 'Roster and team context',
    href: '/compete/teams',
    icon: 'teamRankings',
    event: { eventName: 'team_search_submitted', surface: 'teams', metadata: { location: 'compete_hub', job: 'read_team' } },
  },
]

const steps = [
  { title: 'Find the opponent', detail: 'Open the player, team, or league behind the next match.' },
  { title: 'Make one match plan', detail: 'Use the matchup read to choose the first pattern or pressure point.' },
  { title: 'Carry it forward', detail: 'Take the read into a lineup, result review, or Improve plan.' },
]

export default function CompeteHome() {
  const { userId, authResolved, session } = useAuth()
  const [resumeState, setResumeState] = useState<CompeteResumeState | null>(null)
  const [resumeResolved, setResumeResolved] = useState(false)

  useEffect(() => {
    if (!authResolved) return
    const accessToken = session?.access_token || ''
    let active = true
    void (async () => {
      const localState = readCompeteResumeState(userId)
      const cloudState = accessToken ? await loadCompeteResumeStateFromCloud(accessToken) : null
      const latest = chooseLatestCompeteResumeState(localState, cloudState)
      if (!active) return
      if (latest) writeCompeteResumeState(latest, userId)
      setResumeState(latest)
    })().finally(() => {
      if (active) setResumeResolved(true)
    })
    return () => {
      active = false
    }
  }, [authResolved, session?.access_token, userId])

  const resumeHref = getCompeteResumeHref(resumeState)
  const resumeContext = resumeState?.tournamentName || resumeState?.leagueName || resumeState?.matchupLabel || ''
  const continueAction: RoleHomeAction | null = resumeResolved && userId && resumeHref && resumeHref !== '/compete'
    ? {
        label: 'Continue',
        title: `Continue ${resumeState?.lastSurfaceLabel || 'match prep'}`,
        detail: resumeContext || 'Open the exact Compete work you left.',
        cta: 'Continue',
        href: resumeHref,
        icon: getResumeIcon(resumeState?.lastSurface),
      }
    : null

  function rememberAction(action: Pick<RoleHomeAction, 'title' | 'href'>) {
    const surface = getSurfaceForHref(action.href)
    const nextState: CompeteResumeState = {
      ...resumeState,
      lastSurface: surface,
      lastSurfaceLabel: action.title,
      lastHref: action.href,
      lastVisitedAt: new Date().toISOString(),
    }
    const saved = writeCompeteResumeState(nextState, userId)
    if (saved) setResumeState(saved)
    void syncCompeteResumeState(nextState, userId, session?.access_token)
  }

  return (
    <RoleActionHome
      roleLabel="Compete"
      contextLabel="Match focus"
      contextValue={resumeContext || 'Next match'}
      primaryAction={continueAction || primaryAction}
      quickActions={quickActions}
      helpTitle="Need help with match prep?"
      steps={steps}
      resumeKey={userId ? `compete:${userId}` : 'compete'}
      preferPrimaryAction={Boolean(continueAction)}
      onAction={rememberAction}
    />
  )
}

function getSurfaceForHref(href: string): CompeteResumeSurface {
  if (href.startsWith('/matchup')) return 'matchup'
  if (href.startsWith('/explore/players')) return 'players'
  if (href.startsWith('/compete/results')) return 'results'
  if (href.startsWith('/compete/schedule')) return 'schedule'
  if (href.startsWith('/compete/teams') || href.startsWith('/captain')) return 'teams'
  if (href.startsWith('/compete/leagues') || href.startsWith('/explore/leagues')) return 'leagues'
  if (href.startsWith('/tournaments')) return 'tournament'
  return 'compete'
}

function getResumeIcon(surface?: CompeteResumeSurface) {
  if (surface === 'tournament-alerts') return 'messagingCenter' as const
  if (surface === 'tournament' || surface === 'tournament-entry' || surface === 'schedule') return 'schedule' as const
  if (surface === 'results') return 'reports' as const
  if (surface === 'teams' || surface === 'leagues') return 'teamRankings' as const
  if (surface === 'players') return 'playerRatings' as const
  return 'matchupAnalysis' as const
}
