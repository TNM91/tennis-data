'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import ScheduleMessageComposer from '@/app/components/schedule-message-composer'
import { useAuth } from '@/app/components/auth-provider'
import SiteShell from '@/app/components/site-shell'
import LockedPlanPage from '@/app/components/locked-plan-page'
import CaptainSuitePanel from '@/app/components/captain-suite-panel'
import {
  buildCaptainScopedHref,
  readCaptainResumeState,
  writeCaptainResumeState,
} from '@/lib/captain-memory'
import { supabase } from '@/lib/supabase'
import { buildProductAccessState } from '@/lib/access-model'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { safeText, normalizeTeamName } from '@/lib/captain-formatters'

type TeamOption = {
  team: string
  league: string
  flight: string
  matches: number
}

type AvailabilityStatus = 'in' | 'out' | 'maybe' | 'unanswered'

type AvailabilityPlayer = {
  id: string
  name: string
  status: AvailabilityStatus
  note?: string
}

type AvailabilityActionCard = {
  label: string
  title: string
  detail: string
  value: string
  tone: 'green' | 'blue' | 'slate' | 'warn'
  cta: string
  href: string
}

type TeamOptionMatchRow = {
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  match_date: string | null
  match_time?: string | null
  facility?: string | null
  line_number: string | null
}

type TeamRosterMatchRow = {
  id: string
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  match_date: string | null
  match_time?: string | null
  facility?: string | null
  line_number: string | null
}

type TeamRosterMemberRow = {
  team_name: string | null
  player_id: string | null
  player_name: string | null
  league_name: string | null
  flight: string | null
}

type RosterPlayerRelation =
  | {
      id: string
      name: string
    }
  | {
      id: string
      name: string
    }[]
  | null

type MatchPlayerRosterRow = {
  match_id: string
  side: 'A' | 'B'
  players: RosterPlayerRelation
}

function formatScheduleLabel(match: TeamRosterMatchRow | null) {
  if (!match) return 'Select a scheduled match'
  const parts = [
    match.match_date ? new Date(match.match_date).toLocaleDateString() : '',
    safeText(match.match_time),
    safeText(match.facility),
  ].filter(Boolean)
  return parts.join(' - ') || 'Schedule details pending'
}

function getOpponent(match: TeamRosterMatchRow, team: string) {
  const selected = team.trim().toLowerCase()
  const home = safeText(match.home_team)
  const away = safeText(match.away_team)
  if (home.toLowerCase() === selected) return away
  if (away.toLowerCase() === selected) return home
  return [home, away].filter(Boolean).join(' vs ')
}

function readInitialAvailabilityContext() {
  if (typeof window === 'undefined') {
    return {
      competitionLayer: '',
      team: '',
      league: '',
      flight: '',
      eventDate: '',
      opponentTeam: '',
    }
  }

  const params = new URLSearchParams(window.location.search)
  const resumeState = readCaptainResumeState()

  return {
    competitionLayer: params.get('layer') || resumeState?.competitionLayer || '',
    team: params.get('team') || resumeState?.team || '',
    league: params.get('league') || resumeState?.league || '',
    flight: params.get('flight') || resumeState?.flight || '',
    eventDate: params.get('date') || resumeState?.eventDate || '',
    opponentTeam: params.get('opponent') || resumeState?.opponentTeam || '',
  }
}

export default function CaptainAvailabilityPage() {
  return (
    <SiteShell active="/captain">
      <CaptainAvailabilityContent />
    </SiteShell>
  )
}

function CaptainAvailabilityContent() {
  const router = useRouter()
  const initialContext = readInitialAvailabilityContext()

  const [teamParam] = useState(initialContext.team)
  const [competitionLayerParam] = useState(initialContext.competitionLayer)
  const [leagueParam] = useState(initialContext.league)
  const [flightParam] = useState(initialContext.flight)

  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [selectedTeam, setSelectedTeam] = useState(teamParam)
  const [selectedLeague, setSelectedLeague] = useState(leagueParam)
  const [selectedFlight, setSelectedFlight] = useState(flightParam)

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [error, setError] = useState('')

  const [players, setPlayers] = useState<AvailabilityPlayer[]>([])
  const [scheduledMatches, setScheduledMatches] = useState<TeamRosterMatchRow[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [weekLabel, setWeekLabel] = useState(
    initialContext.eventDate ? new Date(initialContext.eventDate).toLocaleDateString() : 'Select a scheduled match',
  )
  const [preferredMatchDate] = useState(initialContext.eventDate)
  const [preferredOpponent] = useState(initialContext.opponentTeam)
  const [requestSent, setRequestSent] = useState(false)

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const { role, entitlements, authResolved } = useAuth()

  const loadTeamOptions = useCallback(async () => {
    setLoadingOptions(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('matches')
        .select('home_team, away_team, league_name, flight, match_date, match_time, facility, line_number')
        .is('line_number', null)

      if (error) throw new Error(error.message)

      const map = new Map<string, TeamOption>()

      for (const row of (data || []) as TeamOptionMatchRow[]) {
        const league = safeText(row.league_name, 'Unknown League')
        const flight = safeText(row.flight, 'Unknown Flight')

        for (const side of [safeText(row.home_team), safeText(row.away_team)]) {
          if (side === 'Unknown') continue
          const key = `${side}__${league}__${flight}`

          if (!map.has(key)) {
            map.set(key, { team: side, league, flight, matches: 0 })
          }

          map.get(key)!.matches += 1
        }
      }

      const next = [...map.values()].sort((a, b) => {
        if (b.matches !== a.matches) return b.matches - a.matches
        return a.team.localeCompare(b.team)
      })

      setTeamOptions(next)

      if (!teamParam && next.length > 0) {
        setSelectedTeam(next[0].team)
        setSelectedLeague(next[0].league)
        setSelectedFlight(next[0].flight)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoadingOptions(false)
    }
  }, [teamParam])

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true)
    setError('')

    try {
      let matchQuery = supabase
        .from('matches')
        .select('id, home_team, away_team, league_name, flight, match_date, match_time, facility, line_number')
        .is('line_number', null)
        .or(`home_team.eq."${selectedTeam.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",away_team.eq."${selectedTeam.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)

      if (selectedLeague) matchQuery = matchQuery.eq('league_name', selectedLeague)
      if (selectedFlight) matchQuery = matchQuery.eq('flight', selectedFlight)

      const { data: matches, error: matchError } = await matchQuery.limit(25)
      if (matchError) throw new Error(matchError.message)

      const typedMatches = (matches || []) as TeamRosterMatchRow[]
      setScheduledMatches(typedMatches)
      const nextSelectedMatch =
        typedMatches.find((match) => match.id === selectedMatchId) ??
        typedMatches.find((match) => {
          if (preferredMatchDate && match.match_date !== preferredMatchDate) return false
          if (preferredOpponent && getOpponent(match, selectedTeam) !== preferredOpponent) return false
          return Boolean(preferredMatchDate || preferredOpponent)
        }) ??
        typedMatches.find((match) => match.match_date && new Date(match.match_date).getTime() >= Date.now() - 86400000) ??
        typedMatches[0] ??
        null
      if (nextSelectedMatch) {
        setSelectedMatchId(nextSelectedMatch.id)
        setWeekLabel(formatScheduleLabel(nextSelectedMatch))
      }
      const matchIds = typedMatches.map((match) => match.id)

      if (!matchIds.length) {
        setPlayers([])
        return
      }

      const [matchPlayersResult, rosterMembersResult] = await Promise.all([
        supabase
          .from('match_players')
          .select(`
            match_id,
            side,
            players (
              id,
              name
            )
          `)
          .in('match_id', matchIds),
        supabase
          .from('team_roster_members')
          .select('team_name, player_id, player_name, league_name, flight')
          .eq('normalized_team_name', normalizeTeamName(selectedTeam))
          .limit(500),
      ])

      if (matchPlayersResult.error) throw new Error(matchPlayersResult.error.message)

      const teamSides = new Map<string, 'A' | 'B'>()
      for (const match of typedMatches) {
        if (safeText(match.home_team) === selectedTeam) teamSides.set(match.id, 'A')
        if (safeText(match.away_team) === selectedTeam) teamSides.set(match.id, 'B')
      }

      const rosterMap = new Map<string, AvailabilityPlayer>()

      for (const row of (matchPlayersResult.data || []) as MatchPlayerRosterRow[]) {
        const expectedSide = teamSides.get(row.match_id)
        if (!expectedSide || row.side !== expectedSide) continue

        const player = Array.isArray(row.players) ? row.players[0] : row.players
        if (!player?.id || !player?.name) continue

        if (!rosterMap.has(player.id)) {
          rosterMap.set(player.id, {
            id: player.id,
            name: player.name,
            status: 'unanswered',
          })
        }
      }

      if (!rosterMembersResult.error) {
        for (const row of (rosterMembersResult.data || []) as TeamRosterMemberRow[]) {
          if (!row.player_id || !row.player_name) continue
          if (selectedLeague && safeText(row.league_name, '') && safeText(row.league_name) !== selectedLeague) continue
          if (selectedFlight && safeText(row.flight, '') && safeText(row.flight) !== selectedFlight) continue
          if (!rosterMap.has(row.player_id)) {
            rosterMap.set(row.player_id, {
              id: row.player_id,
              name: row.player_name,
              status: 'unanswered',
            })
          }
        }
      }

      const roster = [...rosterMap.values()].sort((a, b) => a.name.localeCompare(b.name))

      const seeded = roster.map((player, index) => {
        if (index < 5) return { ...player, status: 'in' as AvailabilityStatus }
        if (index < 7) return { ...player, status: 'out' as AvailabilityStatus }
        if (index < 9) return { ...player, status: 'maybe' as AvailabilityStatus }
        return player
      })

      setPlayers(seeded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability')
    } finally {
      setLoadingRoster(false)
    }
  }, [preferredMatchDate, preferredOpponent, selectedFlight, selectedLeague, selectedMatchId, selectedTeam])

  useEffect(() => {
    if (!selectedTeam && !selectedLeague && !selectedFlight) return

    writeCaptainResumeState({
      competitionLayer: competitionLayerParam || undefined,
      team: selectedTeam,
      league: selectedLeague,
      flight: selectedFlight,
      eventDate: preferredMatchDate || undefined,
      opponentTeam: preferredOpponent || undefined,
      lastTool: 'availability',
      lastToolLabel: 'Availability',
    })
  }, [competitionLayerParam, preferredMatchDate, preferredOpponent, selectedFlight, selectedLeague, selectedTeam])

  useEffect(() => {
    if (!authResolved || role !== 'public') return
    router.replace('/login?next=/captain/availability')
  }, [authResolved, role, router])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    void loadTeamOptions()
  }, [authResolved, loadTeamOptions, role])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    if (!selectedTeam) return
    void loadRoster()
  }, [authResolved, loadRoster, role, selectedTeam])

  function updateStatus(playerId: string, status: AvailabilityStatus) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, status } : player,
      ),
    )
  }

  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  const filteredTeamOptions = useMemo(() => {
    return teamOptions.filter((option) => option.team && option.league && option.flight)
  }, [teamOptions])
  const hasScope = Boolean(selectedTeam && selectedLeague && selectedFlight)
  const lineupBuilderHref = buildCaptainScopedHref('/captain/lineup-builder', {
    competitionLayer: hasScope ? competitionLayerParam : undefined,
    team: hasScope ? selectedTeam : undefined,
    league: hasScope ? selectedLeague : undefined,
    flight: hasScope ? selectedFlight : undefined,
  })
  const messagingHref = buildCaptainScopedHref('/captain/messaging', {
    competitionLayer: hasScope ? competitionLayerParam : undefined,
    team: hasScope ? selectedTeam : undefined,
    league: hasScope ? selectedLeague : undefined,
    flight: hasScope ? selectedFlight : undefined,
  })
  const lineupProjectionHref = buildCaptainScopedHref('/captain/lineup-projection', {
    competitionLayer: hasScope ? competitionLayerParam : undefined,
    team: hasScope ? selectedTeam : undefined,
    league: hasScope ? selectedLeague : undefined,
    flight: hasScope ? selectedFlight : undefined,
  })

  const counts = useMemo(() => {
    return {
      in: players.filter((p) => p.status === 'in').length,
      out: players.filter((p) => p.status === 'out').length,
      maybe: players.filter((p) => p.status === 'maybe').length,
      unanswered: players.filter((p) => p.status === 'unanswered').length,
    }
  }, [players])
  const responseTotal = counts.in + counts.out + counts.maybe + counts.unanswered
  const responseAnswered = responseTotal - counts.unanswered
  const responseProgress = responseTotal > 0 ? Math.round((responseAnswered / responseTotal) * 100) : 0
  const lineupPoolCount = counts.in + counts.maybe
  const lineupPoolLabel =
    lineupPoolCount >= 8
      ? 'Healthy lineup pool'
      : lineupPoolCount >= 4
        ? 'Usable lineup pool'
        : responseTotal > 0
          ? 'Need more yes/maybe replies'
          : 'Roster not loaded yet'
  const responseSummary =
    counts.unanswered > 0
      ? `${counts.unanswered} player${counts.unanswered === 1 ? '' : 's'} still need a reply before the lineup is safe to finalize.`
      : counts.in === 0 && counts.out === 0 && counts.maybe === 0
        ? 'Start by picking a team to load the weekly roster.'
        : 'The roster is fully answered, so you can move straight into lineup planning.'
  const selectedMatch = scheduledMatches.find((match) => match.id === selectedMatchId) ?? null
  const availabilityActionCards = useMemo<AvailabilityActionCard[]>(() => {
    const responseValue =
      responseTotal > 0
        ? `${responseAnswered}/${responseTotal}`
        : 'No roster'
    const responseTone = counts.unanswered > 0 ? 'warn' : responseTotal > 0 ? 'green' : 'slate'
    const lineupTone = lineupPoolCount >= 8 ? 'green' : lineupPoolCount >= 4 ? 'blue' : 'warn'
    const maybeText =
      counts.maybe > 0
        ? `${counts.maybe} maybe ${counts.maybe === 1 ? 'player' : 'players'} can swing the final courts.`
        : 'No maybe replies are waiting on a captain call.'

    return [
      {
        label: 'Reply chase',
        title: counts.unanswered > 0 ? 'Chase the missing replies' : 'Responses are covered',
        detail:
          counts.unanswered > 0
            ? 'Send the short availability nudge before you spend time on court order.'
            : 'Everyone loaded for this roster has a saved answer.',
        value: responseValue,
        tone: responseTone,
        cta: counts.unanswered > 0 ? 'Text Team' : 'Review Message',
        href: messagingHref,
      },
      {
        label: 'Lineup pool',
        title: lineupPoolCount >= 4 ? 'Pool is usable' : 'Pool needs help',
        detail:
          lineupPoolCount >= 4
            ? `${lineupPoolCount} players are in or maybe, enough to start shaping courts.`
            : 'Mark more yes or maybe replies before building the week.',
        value: String(lineupPoolCount),
        tone: lineupTone,
        cta: 'Build Lineup',
        href: lineupBuilderHref,
      },
      {
        label: 'Maybe list',
        title: counts.maybe > 0 ? 'Resolve the swing players' : 'No swing players',
        detail: maybeText,
        value: String(counts.maybe),
        tone: counts.maybe > 0 ? 'blue' : 'slate',
        cta: 'Project Courts',
        href: lineupProjectionHref,
      },
    ]
  }, [
    counts.maybe,
    counts.unanswered,
    lineupBuilderHref,
    lineupPoolCount,
    lineupProjectionHref,
    messagingHref,
    responseAnswered,
    responseTotal,
  ])
  if (!authResolved) {
    return (
      <section style={loadingWrap}>
        <div style={loadingCard}>Loading availability...</div>
      </section>
    )
  }

  if (role === 'public') return null

  if (!access.canUseCaptainWorkflow) {
    return (
      <LockedPlanPage
        active="/captain"
        withinShell
        planId="captain"
        headline="Still chasing availability one player at a time?"
        body="Unlock Captain to keep roster status, reminders, lineup prep, and match-week communication together instead of rebuilding the process every week."
        ctaLabel="Unlock Captain"
        secondaryLabel="Back to Captain"
        secondaryHref="/captain"
      />
    )
  }

  return (
    <div style={pageWrap}>
        {!isMobile ? <CaptainSuitePanel active="availability" teamLabel={selectedTeam || 'Team week'} /> : null}
        <section style={availabilityControlShellResponsive(isTablet, isMobile)} aria-label="Availability controls">
          <span aria-hidden="true" style={watermarkStyle} />
          <div>
            <div style={availabilityControlHeader}>
              <div>
                <div style={sectionKicker}>Availability controls</div>
                <h1 style={availabilityControlTitle}>Who can play?</h1>
              </div>
              <span style={responseProgress >= 80 ? badgeGreen : responseProgress >= 50 ? badgeBlue : badgeSlate}>
                {responseProgress}% answered
              </span>
            </div>

            <div style={selectorPanelResponsive(isSmallMobile)}>
              <select
                value={selectedTeam}
                onChange={(e) => {
                  const option = filteredTeamOptions.find((item) => item.team === e.target.value)
                  setSelectedTeam(e.target.value)
                  if (option) {
                    setSelectedLeague(option.league)
                    setSelectedFlight(option.flight)
                  }
                }}
                style={selectStyle}
              >
                {loadingOptions && !filteredTeamOptions.length ? (
                  <option>Loading teams...</option>
                ) : (
                  filteredTeamOptions.map((option) => (
                    <option key={`${option.team}__${option.league}__${option.flight}`} value={option.team}>
                      {option.team} - {option.league} - {option.flight}
                    </option>
                  ))
                )}
              </select>

              <input
                value={weekLabel}
                readOnly
                style={textInputStyle}
                placeholder="Select a scheduled match"
              />

              <select
                value={selectedMatchId}
                onChange={(e) => {
                  setSelectedMatchId(e.target.value)
                  const match = scheduledMatches.find((item) => item.id === e.target.value) ?? null
                  setWeekLabel(formatScheduleLabel(match))
                }}
                style={selectStyle}
                disabled={!selectedTeam || scheduledMatches.length === 0}
              >
                <option value="">Select match</option>
                {scheduledMatches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {getOpponent(match, selectedTeam)} - {formatScheduleLabel(match)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                style={{
                  ...primaryButton,
                  ...(!hasScope ? disabledAction : {}),
                }}
                onClick={() => {
                  if (!hasScope) return
                  setRequestSent(true)
                }}
                disabled={!hasScope}
              >
                Prep request
              </button>

              <button
                type="button"
                style={sectionCtaSecondary}
                onClick={() => void loadRoster()}
                disabled={!hasScope || loadingRoster}
              >
                {loadingRoster ? 'Refreshing...' : 'Refresh roster'}
              </button>
            </div>
          </div>

          <div style={captainReadCard}>
            <div style={captainReadTop}>
              <div>
                <div style={sectionKicker}>Live read</div>
                <h2 style={captainReadTitle}>{selectedTeam || 'Select a team'}</h2>
                <p style={captainReadText}>
                  {selectedLeague || 'League'} - {selectedFlight || 'Flight'}
                </p>
              </div>
              <span style={responseProgress >= 80 ? badgeGreen : responseProgress >= 50 ? badgeBlue : badgeSlate}>
                {responseProgress}% answered
              </span>
            </div>

            <div
              style={responseTrack}
              role="meter"
              aria-label="Availability responses answered"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={responseProgress}
            >
              <span style={{ ...responseFill, width: `${responseProgress}%` }} />
            </div>

            <div style={captainReadStats}>
              <span>{responseAnswered} answered</span>
              <span>{lineupPoolLabel}</span>
              <span>{counts.out} out</span>
            </div>

            {requestSent ? (
              <div style={successBanner}>Availability request prepared for {weekLabel}.</div>
            ) : (
              <div style={helperBanner}>{responseSummary}</div>
            )}
          </div>
        </section>

        {error ? (
          <section style={errorCard}>
            <div>{error}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" style={sectionCtaSecondary} onClick={() => void loadTeamOptions()}>
                Retry teams
              </button>
              <button
                type="button"
                style={sectionCtaSecondary}
                onClick={() => void loadRoster()}
                disabled={!hasScope}
              >
                Retry roster
              </button>
            </div>
          </section>
        ) : null}

        <section style={decisionPanel}>
          <div style={sectionHeadResponsive(isTablet)}>
            <div>
              <div style={sectionKicker}>Availability read</div>
              <h2 style={sectionTitle}>Turn replies into the next move.</h2>
              <div style={sectionSub}>
                {selectedMatch
                  ? `${getOpponent(selectedMatch, selectedTeam) || 'Opponent'} - ${formatScheduleLabel(selectedMatch)}`
                  : 'Choose a scheduled match to make this read specific.'}
              </div>
            </div>
            <div style={sectionChipRow}>
              <span style={responseProgress >= 80 ? badgeGreen : responseProgress >= 50 ? badgeBlue : badgeSlate}>
                {responseProgress}% answered
              </span>
              <span style={lineupPoolCount >= 8 ? badgeGreen : lineupPoolCount >= 4 ? badgeBlue : badgeSlate}>
                {lineupPoolLabel}
              </span>
            </div>
          </div>

          <div style={availabilityActionGridResponsive(isSmallMobile)}>
            {availabilityActionCards.map((card) => (
              <article
                key={card.label}
                style={{
                  ...availabilityActionCard,
                  ...(card.tone === 'green'
                    ? availabilityActionCardGreen
                    : card.tone === 'blue'
                      ? availabilityActionCardBlue
                      : card.tone === 'warn'
                        ? availabilityActionCardWarn
                        : availabilityActionCardSlate),
                }}
              >
                <div style={availabilityActionTop}>
                  <span style={availabilityActionLabel}>{card.label}</span>
                  <span style={card.tone === 'green' ? badgeGreen : card.tone === 'blue' ? badgeBlue : card.tone === 'warn' ? warnBadge : badgeSlate}>
                    {card.value}
                  </span>
                </div>
                <div>
                  <div style={availabilityActionTitle}>{card.title}</div>
                  <div style={availabilityActionText}>{card.detail}</div>
                </div>
                <Link href={card.href} style={sectionCtaSecondary}>
                  {card.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section style={contentWrap}>
          <div style={metricGridResponsive(isSmallMobile, isMobile)}>
            <MetricCard label="Available" value={String(counts.in)} accent="green" />
            <MetricCard label="Unavailable" value={String(counts.out)} accent="blue" />
            <MetricCard label="Maybe" value={String(counts.maybe)} accent="slate" />
            <MetricCard label="Unanswered" value={String(counts.unanswered)} accent="slate" />
          </div>

          <section style={sectionCard}>
            <div style={sectionHeadResponsive(isTablet)}>
              <div>
                <div style={sectionKicker}>Weekly roster</div>
                <h2 style={sectionTitle}>Player responses</h2>
                <div style={sectionSub}>
                  Update the list as replies come in. The lineup should start here.
                </div>
                <div style={sectionChipRow}>
                  <span style={badgeGreen}>{lineupPoolCount} in play</span>
                  <span style={counts.unanswered > 0 ? badgeBlue : badgeSlate}>
                    {counts.unanswered > 0 ? `${counts.unanswered} to chase` : 'Ready for lineup'}
                  </span>
                </div>
              </div>

              <div style={sectionActions}>
                <Link href={lineupBuilderHref} style={sectionCtaPrimary}>
                  Build Lineup
                </Link>
                <Link href={messagingHref} style={sectionCtaSecondary}>
                  Text Team
                </Link>
                {selectedTeam ? (
                  <ScheduleMessageComposer
                    mode="captain-practice"
                    triggerLabel="Schedule practice"
                    teamName={selectedTeam}
                    leagueName={selectedLeague}
                    flight={selectedFlight}
                    defaultDate={selectedMatch?.match_date || preferredMatchDate}
                    defaultTime={selectedMatch?.match_time || ''}
                    defaultFacility={selectedMatch?.facility || ''}
                  />
                ) : null}
              </div>
            </div>

            {!filteredTeamOptions.length && !loadingOptions ? (
              <div style={stateBox}>
                Team history is not ready yet. Import match data first, then return here to track responses.
              </div>
            ) : loadingRoster ? (
              <div style={stateBox}>Loading roster...</div>
            ) : players.length === 0 ? (
              <div style={stateBox}>
                No roster is available for this team selection yet. Re-import the team summary, refresh, or widen
                the league and flight filters.
              </div>
            ) : (
              <div style={playerList}>
                {players.map((player) => (
                  <div key={player.id} style={playerRowResponsive(isSmallMobile)}>
                    <div>
                      <div style={playerName}>{player.name}</div>
                      <div style={playerMeta}>
                        {selectedTeam || 'Team'} - {weekLabel}
                      </div>
                    </div>

                    <div style={statusButtonRowResponsive(isSmallMobile)}>
                      <button
                        type="button"
                        style={{ ...statusButton, ...(player.status === 'in' ? statusButtonIn : {}) }}
                        onClick={() => updateStatus(player.id, 'in')}
                      >
                        In
                      </button>
                      <button
                        type="button"
                        style={{ ...statusButton, ...(player.status === 'out' ? statusButtonOut : {}) }}
                        onClick={() => updateStatus(player.id, 'out')}
                      >
                        Out
                      </button>
                      <button
                        type="button"
                        style={{ ...statusButton, ...(player.status === 'maybe' ? statusButtonMaybe : {}) }}
                        onClick={() => updateStatus(player.id, 'maybe')}
                      >
                        Maybe
                      </button>
                      <button
                        type="button"
                        style={{ ...statusButton, ...(player.status === 'unanswered' ? statusButtonUnanswered : {}) }}
                        onClick={() => updateStatus(player.id, 'unanswered')}
                      >
                        Unanswered
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'green' | 'blue' | 'slate'
}) {
  return (
    <div
      style={{
        ...metricCard,
        ...(accent === 'green'
          ? metricCardGreen
          : accent === 'blue'
            ? metricCardBlue
            : metricCardSlate),
      }}
    >
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  )
}

function availabilityControlShellResponsive(isTablet: boolean, isMobile: boolean): CSSProperties {
  return {
    ...availabilityControlShell,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.08fr) minmax(min(100%, 330px), 0.84fr)',
    padding: isMobile ? '20px 18px' : '24px 22px',
    gap: isMobile ? '18px' : '22px',
    minWidth: 0,
  }
}

function selectorPanelResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...selectorPanel,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
    minWidth: 0,
  }
}

function metricGridResponsive(isSmallMobile: boolean, isMobile: boolean): CSSProperties {
  return {
    ...metricGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
    minWidth: 0,
  }
}

function availabilityActionGridResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...availabilityActionGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : availabilityActionGrid.gridTemplateColumns,
    minWidth: 0,
  }
}

function sectionHeadResponsive(isTablet: boolean): CSSProperties {
  return {
    ...sectionHead,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: isTablet ? 'flex-start' : 'flex-end',
    gap: '16px',
    flexDirection: isTablet ? 'column' : 'row',
    minWidth: 0,
  }
}

function playerRowResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...playerRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
    minWidth: 0,
  }
}

function statusButtonRowResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...statusButtonRow,
    width: isSmallMobile ? '100%' : 'auto',
    minWidth: 0,
  }
}

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  display: 'grid',
  gap: '18px',
  padding: '18px 0 64px',
  position: 'relative',
  zIndex: 2,
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
}

const availabilityControlShell: CSSProperties = {
  position: 'relative',
  display: 'grid',
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2,8,23,0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflow: 'hidden',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 'clamp(-92px, -7vw, -34px)',
  bottom: 'clamp(-112px, -10vw, -52px)',
  width: 'clamp(230px, 30vw, 420px)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}

const availabilityControlHeader: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 14,
  minWidth: 0,
}

const availabilityControlTitle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 'clamp(1.45rem, 2.5vw, 2.1rem)',
  lineHeight: 1.08,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const selectorPanel: CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '14px',
  borderRadius: '24px',
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(255,255,255,0.045)',
  maxWidth: '940px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const selectStyle: CSSProperties = {
  flex: '1 1 min(100%, 220px)',
  minWidth: 0,
  height: '52px',
  borderRadius: '16px',
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  padding: '0 16px',
  fontSize: '15px',
  outline: 'none',
  colorScheme: 'dark',
}

const textInputStyle: CSSProperties = {
  ...selectStyle,
}

const primaryButton: CSSProperties = {
  minHeight: '52px',
  padding: '0 18px',
  borderRadius: '16px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '14px',
  color: 'var(--foreground-strong)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.26), rgba(34,211,238,0.13))',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
  cursor: 'pointer',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const disabledAction: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
  boxShadow: 'none',
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '999px',
  fontSize: '13px',
  lineHeight: 1,
  fontWeight: 900,
  border: '1px solid transparent',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const badgeBlue: CSSProperties = {
  ...badgeBase,
  background: 'rgba(37,91,227,0.16)',
  color: '#c7dbff',
  borderColor: 'rgba(98,154,255,0.18)',
}

const badgeGreen: CSSProperties = {
  ...badgeBase,
  background: 'rgba(96,221,116,0.14)',
  color: '#dffad5',
  borderColor: 'rgba(130,244,118,0.2)',
}

const badgeSlate: CSSProperties = {
  ...badgeBase,
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground)',
  borderColor: 'rgba(125,211,252,0.14)',
}

const warnBadge: CSSProperties = {
  ...badgeBase,
  background: 'rgba(60,16,24,0.76)',
  color: '#fecaca',
  borderColor: 'rgba(248,113,113,0.22)',
}

const captainReadCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8,13,28,0.60)',
  boxShadow: '0 18px 45px rgba(2,8,23,0.28)',
  padding: '22px',
  minHeight: '100%',
  minWidth: 0,
}

const captainReadTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '14px',
  flexWrap: 'wrap',
  marginBottom: '16px',
  minWidth: 0,
}

const captainReadTitle: CSSProperties = {
  margin: '6px 0',
  color: 'var(--foreground-strong)',
  fontSize: '26px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainReadText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const captainReadStats: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  marginTop: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  minWidth: 0,
}

const responseTrack: CSSProperties = {
  position: 'relative',
  height: 10,
  overflow: 'hidden',
  borderRadius: 999,
  background: 'rgba(148, 163, 184, 0.22)',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  minWidth: 0,
}

const responseFill: CSSProperties = {
  position: 'absolute',
  inset: '0 auto 0 0',
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--brand-blue-2), var(--brand-green))',
  minWidth: 2,
}

const successBanner: CSSProperties = {
  marginTop: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(96,221,116,0.12)',
  border: '1px solid rgba(130,244,118,0.18)',
  color: '#e7ffd0',
  fontWeight: 700,
  fontSize: '14px',
  overflowWrap: 'anywhere',
}

const helperBanner: CSSProperties = {
  marginTop: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--foreground)',
  fontWeight: 700,
  fontSize: '14px',
  overflowWrap: 'anywhere',
}

const contentWrap: CSSProperties = {
  display: 'grid',
  gap: '18px',
  minWidth: 0,
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  minWidth: 0,
}

const decisionPanel: CSSProperties = {
  display: 'grid',
  gap: 18,
  borderRadius: '26px',
  padding: '24px',
  background: 'var(--shell-panel-bg-strong)',
  border: '1px solid rgba(116,190,255,0.13)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
  minWidth: 0,
}

const availabilityActionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: '14px',
  minWidth: 0,
}

const availabilityActionCard: CSSProperties = {
  display: 'grid',
  alignContent: 'space-between',
  gap: 14,
  minHeight: 210,
  borderRadius: '22px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const availabilityActionCardGreen: CSSProperties = {
  borderColor: 'rgba(130,244,118,0.2)',
}

const availabilityActionCardBlue: CSSProperties = {
  borderColor: 'rgba(98,154,255,0.2)',
}

const availabilityActionCardSlate: CSSProperties = {
  borderColor: 'var(--shell-panel-border)',
}

const availabilityActionCardWarn: CSSProperties = {
  borderColor: 'rgba(248,113,113,0.22)',
}

const availabilityActionTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const availabilityActionLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const availabilityActionTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.24rem',
  fontWeight: 900,
  lineHeight: 1.12,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const availabilityActionText: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  fontSize: '.94rem',
  overflowWrap: 'anywhere',
}

const metricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '18px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const metricCardGreen: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  border: '1px solid rgba(155,225,29,0.20)',
}

const metricCardBlue: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-chip-bg) 92%)',
}

const metricCardSlate: CSSProperties = {
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const metricLabel: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const metricValue: CSSProperties = {
  marginTop: '8px',
  color: 'var(--foreground-strong)',
  fontSize: '24px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const sectionCard: CSSProperties = {
  borderRadius: '28px',
  padding: '24px',
  background: 'var(--shell-panel-bg-strong)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const sectionHead: CSSProperties = {
  marginBottom: '18px',
  minWidth: 0,
}

const sectionKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  marginBottom: '8px',
  overflowWrap: 'anywhere',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const sectionSub: CSSProperties = {
  marginTop: '10px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const sectionActions: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionChipRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 12,
  minWidth: 0,
}

const sectionCtaPrimary: CSSProperties = {
  ...primaryButton,
  minHeight: '44px',
  fontSize: '13px',
}

const sectionCtaSecondary: CSSProperties = {
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '13px',
  color: 'var(--foreground-strong)',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const playerList: CSSProperties = {
  display: 'grid',
  gap: '12px',
  minWidth: 0,
}

const playerRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  borderRadius: '20px',
  padding: '16px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  flexWrap: 'wrap',
  minWidth: 0,
}

const playerName: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 800,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const playerMeta: CSSProperties = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const statusButtonRow: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  alignItems: 'center',
  minWidth: 0,
}

const statusButton: CSSProperties = {
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 800,
  fontSize: '12px',
  cursor: 'pointer',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const statusButtonIn: CSSProperties = {
  background: 'rgba(96,221,116,0.14)',
  borderColor: 'rgba(130,244,118,0.20)',
  color: '#dffad5',
}

const statusButtonOut: CSSProperties = {
  background: 'rgba(37,91,227,0.16)',
  borderColor: 'rgba(98,154,255,0.18)',
  color: '#c7dbff',
}

const statusButtonMaybe: CSSProperties = {
  background: 'var(--shell-chip-bg)',
  borderColor: 'var(--shell-panel-border)',
  color: 'var(--foreground-strong)',
}

const statusButtonUnanswered: CSSProperties = {
  background: 'var(--shell-chip-bg)',
  borderColor: 'var(--shell-panel-border)',
  color: 'var(--foreground)',
}

const stateBox: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--foreground)',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const errorCard: CSSProperties = {
  padding: '14px 18px',
  borderRadius: '18px',
  background: 'rgba(142, 32, 32, 0.18)',
  border: '1px solid rgba(255, 122, 122, 0.26)',
  color: '#ffd7d7',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const loadingWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 48px)))',
  margin: '0 auto',
  padding: '40px 0',
  position: 'relative',
  zIndex: 2,
  minWidth: 0,
}

const loadingCard: CSSProperties = {
  borderRadius: '22px',
  padding: '18px 20px',
  color: '#eaf4ff',
  background: 'var(--shell-panel-bg-strong)',
  border: '1px solid var(--shell-panel-border)',
  fontSize: '15px',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}
