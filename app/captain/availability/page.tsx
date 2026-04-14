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
import SiteShell from '@/app/components/site-shell'
import { getClientAuthState } from '@/lib/auth'
import { readCaptainResumeState, writeCaptainResumeState } from '@/lib/captain-memory'
import { supabase } from '@/lib/supabase'
import { normalizeUserRole, type UserRole } from '@/lib/roles'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

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

type TeamOptionMatchRow = {
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  line_number: string | null
}

type TeamRosterMatchRow = {
  id: string
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  line_number: string | null
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

function safeText(value: string | null | undefined, fallback = 'Unknown') {
  const text = (value || '').trim()
  return text || fallback
}

export default function CaptainAvailabilityPage() {
  const router = useRouter()

  const [teamParam, setTeamParam] = useState('')
  const [leagueParam, setLeagueParam] = useState('')
  const [flightParam, setFlightParam] = useState('')

  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)

  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [selectedTeam, setSelectedTeam] = useState(teamParam)
  const [selectedLeague, setSelectedLeague] = useState(leagueParam)
  const [selectedFlight, setSelectedFlight] = useState(flightParam)

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [error, setError] = useState('')

  const [players, setPlayers] = useState<AvailabilityPlayer[]>([])
  const [weekLabel, setWeekLabel] = useState('Wednesday · 8:30 PM')
  const [requestSent, setRequestSent] = useState(false)

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  const loadTeamOptions = useCallback(async () => {
    setLoadingOptions(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('matches')
        .select('home_team, away_team, league_name, flight, line_number')
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
        .select('id, home_team, away_team, league_name, flight, line_number')
        .is('line_number', null)
        .or(`home_team.eq.${selectedTeam},away_team.eq.${selectedTeam}`)

      if (selectedLeague) matchQuery = matchQuery.eq('league_name', selectedLeague)
      if (selectedFlight) matchQuery = matchQuery.eq('flight', selectedFlight)

      const { data: matches, error: matchError } = await matchQuery.limit(25)
      if (matchError) throw new Error(matchError.message)

      const typedMatches = (matches || []) as TeamRosterMatchRow[]
      const matchIds = typedMatches.map((match) => match.id)

      if (!matchIds.length) {
        setPlayers([])
        return
      }

      const { data: matchPlayers, error: playerError } = await supabase
        .from('match_players')
        .select(`
          match_id,
          side,
          players (
            id,
            name
          )
        `)
        .in('match_id', matchIds)

      if (playerError) throw new Error(playerError.message)

      const teamSides = new Map<string, 'A' | 'B'>()
      for (const match of typedMatches) {
        if (safeText(match.home_team) === selectedTeam) teamSides.set(match.id, 'A')
        if (safeText(match.away_team) === selectedTeam) teamSides.set(match.id, 'B')
      }

      const rosterMap = new Map<string, AvailabilityPlayer>()

      for (const row of (matchPlayers || []) as MatchPlayerRosterRow[]) {
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
  }, [selectedFlight, selectedLeague, selectedTeam])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const resumeState = readCaptainResumeState()
    setTeamParam(params.get('team') || resumeState?.team || '')
    setLeagueParam(params.get('league') || resumeState?.league || '')
    setFlightParam(params.get('flight') || resumeState?.flight || '')
  }, [])

  useEffect(() => {
    if (!selectedTeam && !selectedLeague && !selectedFlight) return

    writeCaptainResumeState({
      team: selectedTeam,
      league: selectedLeague,
      flight: selectedFlight,
      lastTool: 'availability',
      lastToolLabel: 'Availability',
    })
  }, [selectedFlight, selectedLeague, selectedTeam])

  useEffect(() => {
    let mounted = true

    async function loadAuth() {
      try {
        const authState = await getClientAuthState()

        if (!authState.user) {
          if (mounted) {
            setRole('public')
            setAuthLoading(false)
          }
          router.replace('/login?next=/captain/availability')
          return
        }

        const nextRole = normalizeUserRole(authState.role)

        if (!mounted) return
        setRole(nextRole)
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }

    void loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadAuth()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    void loadTeamOptions()
  }, [loadTeamOptions])

  useEffect(() => {
    if (!selectedTeam) return
    void loadRoster()
  }, [loadRoster, selectedTeam])

  function updateStatus(playerId: string, status: AvailabilityStatus) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, status } : player,
      ),
    )
  }

  const filteredTeamOptions = useMemo(() => {
    return teamOptions.filter((option) => option.team && option.league && option.flight)
  }, [teamOptions])
  const hasScope = Boolean(selectedTeam && selectedLeague && selectedFlight)
  const lineupBuilderHref = hasScope
    ? `/captain/lineup-builder?team=${encodeURIComponent(selectedTeam)}&league=${encodeURIComponent(selectedLeague)}&flight=${encodeURIComponent(selectedFlight)}`
    : '/captain/lineup-builder'
  const messagingHref = hasScope
    ? `/captain/messaging?team=${encodeURIComponent(selectedTeam)}&league=${encodeURIComponent(selectedLeague)}&flight=${encodeURIComponent(selectedFlight)}`
    : '/captain/messaging'

  const counts = useMemo(() => {
    return {
      in: players.filter((p) => p.status === 'in').length,
      out: players.filter((p) => p.status === 'out').length,
      maybe: players.filter((p) => p.status === 'maybe').length,
      unanswered: players.filter((p) => p.status === 'unanswered').length,
    }
  }, [players])
  const responseSummary =
    counts.unanswered > 0
      ? `${counts.unanswered} player${counts.unanswered === 1 ? '' : 's'} still need a reply before the lineup is safe to finalize.`
      : counts.in === 0 && counts.out === 0 && counts.maybe === 0
        ? 'Start by picking a team to load the weekly roster.'
        : 'The roster is fully answered, so you can move straight into lineup planning.'

  if (authLoading) {
    return (
      <SiteShell active="/captain">
        <section style={loadingWrap}>
          <div style={loadingCard}>Loading availability...</div>
        </section>
      </SiteShell>
    )
  }

  if (role === 'public') return null

  return (
    <SiteShell active="/captain">
      <div style={pageWrap}>
        <section style={heroShellResponsive(isTablet, isMobile)}>
          <div>
            <div style={eyebrow}>Captain availability</div>
            <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>
              Know who you have before you build the lineup.
            </h1>
            <p style={heroText}>
              Use this page as your weekly captain checkpoint. Select the team, view availability status,
              follow up with non-responders, and move directly into lineup building once the roster is clear.
            </p>

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
                      {option.team} · {option.league} · {option.flight}
                    </option>
                  ))
                )}
              </select>

              <input
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
                style={textInputStyle}
                placeholder="Wednesday · 8:30 PM"
              />

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
                Send Request
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

            <div style={heroBadgeRow}>
              <span style={badgeBlue}>{counts.in} available</span>
              <span style={badgeGreen}>{counts.maybe} maybe</span>
              <span style={badgeSlate}>{counts.unanswered} unanswered</span>
            </div>
          </div>

          <div style={quickStartCard}>
            <div style={quickStartLabel}>Availability snapshot</div>
            <h2 style={quickStartTitle}>{selectedTeam || 'Select a team'}</h2>
            <div style={quickStartMeta}>
              {selectedLeague || 'League'} · {selectedFlight || 'Flight'}
            </div>

            <div style={statusGrid}>
              <div style={statusCard}>
                <div style={statusLabelGreen}>In</div>
                <div style={statusValue}>{counts.in}</div>
              </div>
              <div style={statusCard}>
                <div style={statusLabelBlue}>Out</div>
                <div style={statusValue}>{counts.out}</div>
              </div>
              <div style={statusCard}>
                <div style={statusLabelSlate}>No reply</div>
                <div style={statusValue}>{counts.unanswered}</div>
              </div>
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
                  Update statuses as you hear back, then move straight into lineup planning.
                </div>
              </div>

              <div style={sectionActions}>
                <Link href={lineupBuilderHref} style={sectionCtaPrimary}>
                  Build Lineup
                </Link>
                <Link href={messagingHref} style={sectionCtaSecondary}>
                  Text Team
                </Link>
              </div>
            </div>

            {!filteredTeamOptions.length && !loadingOptions ? (
              <div style={stateBox}>
                No team history is available yet. Import match data first, then return here to track responses.
              </div>
            ) : loadingRoster ? (
              <div style={stateBox}>Loading roster...</div>
            ) : players.length === 0 ? (
              <div style={stateBox}>
                No roster was found for this team selection yet. Try another team scope or load more match history first.
              </div>
            ) : (
              <div style={playerList}>
                {players.map((player) => (
                  <div key={player.id} style={playerRowResponsive(isSmallMobile)}>
                    <div>
                      <div style={playerName}>{player.name}</div>
                      <div style={playerMeta}>
                        {selectedTeam || 'Team'} · {weekLabel}
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
    </SiteShell>
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

function heroShellResponsive(isTablet: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroShell,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.08fr) minmax(330px, 0.84fr)',
    padding: isMobile ? '26px 18px' : '34px 26px',
    gap: isMobile ? '18px' : '22px',
  }
}

function heroTitleResponsive(isSmallMobile: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '56px',
  }
}

function selectorPanelResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...selectorPanel,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
  }
}

function metricGridResponsive(isSmallMobile: boolean, isMobile: boolean): CSSProperties {
  return {
    ...metricGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
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
  }
}

function playerRowResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...playerRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
  }
}

function statusButtonRowResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...statusButtonRow,
    width: isSmallMobile ? '100%' : 'auto',
  }
}

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 48px))',
  margin: '0 auto',
  display: 'grid',
  gap: '18px',
  padding: '14px 0 28px',
  position: 'relative',
  zIndex: 2,
}

const heroShell: CSSProperties = {
  position: 'relative',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'linear-gradient(135deg, rgba(26,54,104,0.52) 0%, rgba(17,36,72,0.72) 22%, rgba(12,27,52,0.82) 100%)',
  boxShadow: '0 34px 80px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 80px rgba(88,170,255,0.06)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(130,244,118,0.28)',
  background: 'rgba(89,145,73,0.14)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

const heroTitle: CSSProperties = {
  margin: '0 0 12px',
  color: '#f7fbff',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: '760px',
}

const heroText: CSSProperties = {
  margin: '0 0 20px',
  color: 'rgba(224,234,247,0.84)',
  fontSize: '18px',
  lineHeight: 1.6,
  maxWidth: '760px',
}

const selectorPanel: CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '14px',
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(10,20,37,0.64)',
  maxWidth: '940px',
}

const selectStyle: CSSProperties = {
  flex: 1,
  minWidth: '220px',
  height: '52px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#f5f8ff',
  padding: '0 16px',
  fontSize: '15px',
  outline: 'none',
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
  color: '#08111d',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
  cursor: 'pointer',
}

const disabledAction: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
  boxShadow: 'none',
}

const heroBadgeRow: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '14px',
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
  background: 'rgba(255,255,255,0.08)',
  color: '#ecf4ff',
  borderColor: 'rgba(255,255,255,0.1)',
}

const quickStartCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)',
  boxShadow: '0 22px 52px rgba(7,18,40,0.24)',
  padding: '22px',
  minHeight: '100%',
}

const quickStartLabel: CSSProperties = {
  color: '#e7ffd0',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const quickStartTitle: CSSProperties = {
  margin: '8px 0 10px',
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const quickStartMeta: CSSProperties = {
  color: 'rgba(224,236,249,0.76)',
  fontSize: '14px',
  lineHeight: 1.55,
  marginBottom: '14px',
}

const statusGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '10px',
}

const statusCard: CSSProperties = {
  borderRadius: '18px',
  padding: '14px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
}

const statusLabelGreen: CSSProperties = {
  color: '#dffad5',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const statusLabelBlue: CSSProperties = {
  color: '#c7dbff',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const statusLabelSlate: CSSProperties = {
  color: '#ecf4ff',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const statusValue: CSSProperties = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '28px',
  fontWeight: 900,
  lineHeight: 1,
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
}

const helperBanner: CSSProperties = {
  marginTop: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#e7eefb',
  fontWeight: 700,
  fontSize: '14px',
}

const contentWrap: CSSProperties = {
  display: 'grid',
  gap: '18px',
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const metricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '18px',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18)',
}

const metricCardGreen: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(20,66,54,0.82) 0%, rgba(10,40,32,0.92) 100%)',
  border: '1px solid rgba(130,244,118,0.16)',
}

const metricCardBlue: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
}

const metricCardSlate: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(31,38,56,0.82) 0%, rgba(17,22,34,0.94) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const metricLabel: CSSProperties = {
  color: 'rgba(188,208,232,0.8)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const metricValue: CSSProperties = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '24px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const sectionCard: CSSProperties = {
  borderRadius: '28px',
  padding: '24px',
  background: 'linear-gradient(180deg, rgba(20,42,80,0.42) 0%, rgba(11,23,44,0.76) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  boxShadow: '0 20px 48px rgba(7,18,40,0.18)',
}

const sectionHead: CSSProperties = {
  marginBottom: '18px',
}

const sectionKicker: CSSProperties = {
  color: 'rgba(188,208,232,0.8)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  marginBottom: '8px',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const sectionSub: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(224,236,249,0.78)',
  fontSize: '14px',
  lineHeight: 1.65,
}

const sectionActions: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
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
  color: '#e7eefb',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.22) 0%, rgba(27,62,120,0.18) 100%)',
  border: '1px solid rgba(116,190,255,0.22)',
}

const playerList: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const playerRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  borderRadius: '20px',
  padding: '16px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
}

const playerName: CSSProperties = {
  color: '#f8fbff',
  fontSize: '16px',
  fontWeight: 800,
  lineHeight: 1.4,
}

const playerMeta: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(224,236,249,0.7)',
  fontSize: '13px',
  lineHeight: 1.55,
}

const statusButtonRow: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  alignItems: 'center',
}

const statusButton: CSSProperties = {
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7eefb',
  fontWeight: 800,
  fontSize: '12px',
  cursor: 'pointer',
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
  background: 'rgba(255,255,255,0.10)',
  borderColor: 'rgba(255,255,255,0.14)',
  color: '#ffffff',
}

const statusButtonUnanswered: CSSProperties = {
  background: 'rgba(31,38,56,0.82)',
  borderColor: 'rgba(255,255,255,0.08)',
  color: '#ecf4ff',
}

const stateBox: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  color: '#e7eefb',
  fontWeight: 700,
}

const errorCard: CSSProperties = {
  padding: '14px 18px',
  borderRadius: '18px',
  background: 'rgba(142, 32, 32, 0.18)',
  border: '1px solid rgba(255, 122, 122, 0.26)',
  color: '#ffd7d7',
  fontWeight: 700,
}

const loadingWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 48px))',
  margin: '0 auto',
  padding: '40px 0',
  position: 'relative',
  zIndex: 2,
}

const loadingCard: CSSProperties = {
  borderRadius: '22px',
  padding: '18px 20px',
  color: '#eaf4ff',
  background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)',
  border: '1px solid rgba(116,190,255,0.18)',
  fontSize: '15px',
  fontWeight: 700,
}
