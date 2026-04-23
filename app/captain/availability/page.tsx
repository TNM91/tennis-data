'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
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
import CaptainSubnav from '@/app/components/captain-subnav'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useTheme } from '@/app/components/theme-provider'
import { getClientAuthState } from '@/lib/auth'
import {
  buildCaptainScopedHref,
  readCaptainResumeState,
  writeCaptainResumeState,
} from '@/lib/captain-memory'
import { supabase } from '@/lib/supabase'
import { normalizeUserRole, type UserRole } from '@/lib/roles'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
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
  const { theme } = useTheme()

  const [teamParam, setTeamParam] = useState('')
  const [competitionLayerParam, setCompetitionLayerParam] = useState('')
  const [leagueParam, setLeagueParam] = useState('')
  const [flightParam, setFlightParam] = useState('')

  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [selectedTeam, setSelectedTeam] = useState(teamParam)
  const [selectedLeague, setSelectedLeague] = useState(leagueParam)
  const [selectedFlight, setSelectedFlight] = useState(flightParam)

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [error, setError] = useState('')

  const [players, setPlayers] = useState<AvailabilityPlayer[]>([])
  const [weekLabel, setWeekLabel] = useState('Wednesday - 8:30 PM')
  const [requestSent, setRequestSent] = useState(false)

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const heroArtworkSrc = theme === 'dark'
    ? '/df190aef-4a8e-4587-bce8-7e2e22655646.png'
    : '/151c73b4-3ea5-4ef5-82df-470da3b99f27.png'

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
    setCompetitionLayerParam(params.get('layer') || resumeState?.competitionLayer || '')
    setTeamParam(params.get('team') || resumeState?.team || '')
    setLeagueParam(params.get('league') || resumeState?.league || '')
    setFlightParam(params.get('flight') || resumeState?.flight || '')
  }, [])

  useEffect(() => {
    if (!selectedTeam && !selectedLeague && !selectedFlight) return

    writeCaptainResumeState({
      competitionLayer: competitionLayerParam || undefined,
      team: selectedTeam,
      league: selectedLeague,
      flight: selectedFlight,
      lastTool: 'availability',
      lastToolLabel: 'Availability',
    })
  }, [competitionLayerParam, selectedFlight, selectedLeague, selectedTeam])

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
        setEntitlements(authState.entitlements)
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
  const availabilitySignals = [
    {
      label: 'Roster clarity',
      value: counts.unanswered > 0 ? `${counts.unanswered} waiting` : 'Fully answered',
      note: 'Availability is the checkpoint that tells you whether the week is still uncertain or ready for lineup decisions.',
    },
    {
      label: 'Weekly scope',
      value: hasScope ? `${selectedTeam} - ${selectedFlight}` : 'Choose a team',
      note: 'Keep this page scoped to one real team and one weekly context before sending requests or building lineups.',
    },
    {
      label: 'Best next move',
      value: counts.unanswered > 0 ? 'Follow up first' : 'Build lineup',
      note: counts.unanswered > 0
        ? 'Clear blockers here, then hand off into messaging or lineup building.'
        : 'The roster is clear enough to move directly into lineup construction.',
    },
  ]

  const dynamicQuickStartCard: CSSProperties = {
    ...quickStartCard,
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--shell-panel-bg)',
  }

  const availabilityVisualStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
  }

  const availabilityVisualMaskStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: isTablet ? 'var(--shell-hero-mask-mobile)' : 'var(--shell-hero-mask)',
    pointerEvents: 'none',
    zIndex: 1,
  }

  const availabilityVisualContentStyle: CSSProperties = {
    position: 'relative',
    zIndex: 2,
  }

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
                      {option.team} - {option.league} - {option.flight}
                    </option>
                  ))
                )}
              </select>

              <input
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
                style={textInputStyle}
                placeholder="Wednesday - 8:30 PM"
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

          <div style={dynamicQuickStartCard}>
            <div style={availabilityVisualStyle}>
              <Image
                src={heroArtworkSrc}
                alt="TenAceIQ availability concept art"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 34vw"
                style={{
                  objectFit: 'cover',
                  objectPosition: isTablet ? 'center center' : '72% center',
                  opacity: theme === 'dark' ? 0.94 : 0.82,
                }}
              />
              <div style={availabilityVisualMaskStyle} />
            </div>

            <div style={availabilityVisualContentStyle}>
              <div style={quickStartLabel}>Availability snapshot</div>
              <h2 style={quickStartTitle}>{selectedTeam || 'Select a team'}</h2>
              <div style={quickStartMeta}>
                {selectedLeague || 'League'} - {selectedFlight || 'Flight'}
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
          </div>
        </section>

        <CaptainSubnav
          title="Availability sits inside the full captain workflow"
          description="Clear the roster first, then move directly into lineups, messaging, scenarios, and season management."
          tierLabel={access.captainTierLabel}
          tierActive={access.captainSubscriptionActive}
        />

        {!access.canUseCaptainWorkflow ? (
          <UpgradePrompt
            planId="captain"
            compact
            headline="Still chasing availability one player at a time?"
            body="Unlock Captain to keep roster status, reminders, lineup prep, and match-week communication in one workflow instead of rebuilding the process every week."
            ctaLabel="Unlock Captain Tools"
            ctaHref="/pricing"
            secondaryLabel="See Captain value"
            secondaryHref="/pricing"
            footnote="Best for captains who want less back-and-forth, clearer roster reads, and a faster path into lineup decisions."
          />
        ) : null}

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

          <section style={signalGridStyle(isSmallMobile)}>
            {availabilitySignals.map((signal) => (
              <article key={signal.label} style={signalCardStyle}>
                <div style={signalLabelStyle}>{signal.label}</div>
                <div style={signalValueStyle}>{signal.value}</div>
                <div style={signalNoteStyle}>{signal.note}</div>
              </article>
            ))}
          </section>

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
                Team history is not ready yet. Import match data first, then return here to track responses.
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
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
  color: 'var(--home-eyebrow-color)',
  fontWeight: 800,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

const heroTitle: CSSProperties = {
  margin: '0 0 12px',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: '760px',
}

const heroText: CSSProperties = {
  margin: '0 0 20px',
  color: 'var(--shell-copy-muted)',
  fontSize: '18px',
  lineHeight: 1.6,
  maxWidth: '760px',
}

const selectorPanel: CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '14px',
  borderRadius: '24px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  maxWidth: '940px',
}

const selectStyle: CSSProperties = {
  flex: 1,
  minWidth: '220px',
  height: '52px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
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
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  borderColor: 'var(--shell-panel-border)',
}

const quickStartCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  padding: '22px',
  minHeight: '100%',
}

const quickStartLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const quickStartTitle: CSSProperties = {
  margin: '8px 0 10px',
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const quickStartMeta: CSSProperties = {
  color: 'var(--shell-copy-muted)',
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
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
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
  color: 'var(--foreground)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const statusValue: CSSProperties = {
  marginTop: '8px',
  color: 'var(--foreground-strong)',
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
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--foreground)',
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

const signalGridStyle = (isSmallMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: '14px',
})

const signalCardStyle: CSSProperties = {
  borderRadius: '22px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: 'var(--shadow-soft)',
}

const signalLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const signalValueStyle: CSSProperties = {
  marginTop: '10px',
  color: 'var(--foreground-strong)',
  fontSize: '1.24rem',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const signalNoteStyle: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  fontSize: '.94rem',
}

const metricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '18px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
}

const metricCardGreen: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(20,66,54,0.82) 0%, rgba(10,40,32,0.92) 100%)',
  border: '1px solid rgba(130,244,118,0.16)',
}

const metricCardBlue: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
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
}

const metricValue: CSSProperties = {
  marginTop: '8px',
  color: 'var(--foreground-strong)',
  fontSize: '24px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const sectionCard: CSSProperties = {
  borderRadius: '28px',
  padding: '24px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
}

const sectionHead: CSSProperties = {
  marginBottom: '18px',
}

const sectionKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  marginBottom: '8px',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const sectionSub: CSSProperties = {
  marginTop: '10px',
  color: 'var(--shell-copy-muted)',
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
  color: 'var(--foreground-strong)',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
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
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const playerName: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 800,
  lineHeight: 1.4,
}

const playerMeta: CSSProperties = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
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
