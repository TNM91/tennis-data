'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import { getClientAuthState } from '@/lib/auth'
import { buildCaptainScopedHref, readCaptainResumeState, writeCaptainResumeState } from '@/lib/captain-memory'
import { readCaptainWeekNotes } from '@/lib/captain-week-notes'
import {
  buildCaptainWeekStatusKey,
  getCaptainWeekStatusMeta,
  readCaptainWeekStatus,
  upsertCaptainWeekStatus,
  type CaptainWeekStatus,
} from '@/lib/captain-week-status'
import { supabase } from '@/lib/supabase'
import { type UserRole } from '@/lib/roles'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type MatchRow = {
  id: string
  match_date: string | null
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  line_number: string | null
}

type StoredScenario = {
  id?: string
  scenario_name?: string
  match_date?: string | null
  league_name?: string | null
  flight?: string | null
  team_name?: string | null
  opponent_team?: string | null
  notes?: string | null
}

type EventDetail = {
  key?: string
  location?: string
  directions?: string
  arrivalTime?: string
  notes?: string
}

type LineupAssignment = {
  id: string
  event_key: string
  court_label: string
  slot_type: 'singles' | 'doubles'
  players: string[]
}

type WeeklyAvailability = {
  id: string
  event_key: string
  contact_id: string
  status: 'available' | 'unavailable' | 'tentative' | 'no-response'
  note: string
  updated_at: string
}

type WeeklyResponse = {
  id: string
  event_key: string
  contact_id: string
  status: 'confirmed' | 'declined' | 'viewed' | 'no-response' | 'running-late' | 'need-sub'
  note: string
  updated_at: string
}

const WEEKLY_LINEUPS_STORAGE_KEY = 'tenaceiq_weekly_lineups'
const WEEKLY_EVENT_DETAILS_STORAGE_KEY = 'tenaceiq_weekly_event_details'
const WEEKLY_AVAILABILITY_STORAGE_KEY = 'tenaceiq_weekly_availability'
const WEEKLY_RESPONSES_STORAGE_KEY = 'tenaceiq_weekly_responses'
const SELECTED_SCENARIO_STORAGE_KEY = 'tenace_selected_scenario'

function safeText(value: string | null | undefined, fallback = '') {
  return (value || '').trim() || fallback
}

function safeKey(...parts: Array<string | null | undefined>) {
  return parts.map((part) => (part || '').trim().toLowerCase() || '—').join('|')
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function readLocalArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function readLocalObject<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function readInitialBriefContext() {
  if (typeof window === 'undefined') {
    return {
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
    team: params.get('team') ?? resumeState?.team ?? '',
    league: params.get('league') ?? resumeState?.league ?? '',
    flight: params.get('flight') ?? resumeState?.flight ?? '',
    eventDate: params.get('date') ?? resumeState?.eventDate ?? '',
    opponentTeam: params.get('opponent') ?? resumeState?.opponentTeam ?? '',
  }
}

export default function CaptainWeeklyBriefPage() {
  const router = useRouter()
  const { isTablet, isSmallMobile } = useViewportBreakpoints()
  const initialContext = readInitialBriefContext()

  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [weekStatusState, setWeekStatusState] = useState<{
    key: string
    status: CaptainWeekStatus
  }>({
    key: '',
    status: 'draft-lineup',
  })

  const [team] = useState(initialContext.team)
  const [league] = useState(initialContext.league)
  const [flight] = useState(initialContext.flight)
  const [eventDate, setEventDate] = useState(initialContext.eventDate)
  const [opponentTeam, setOpponentTeam] = useState(initialContext.opponentTeam)
  const [matches, setMatches] = useState<MatchRow[]>([])

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      const authState = await getClientAuthState()
      if (!mounted) return

      setRole(authState.role)
      setAuthLoading(false)

      if (authState.role === 'public' && typeof window !== 'undefined') {
        const next = encodeURIComponent('/captain/weekly-brief')
        window.location.href = `/login?next=${next}`
      }
    }

    void loadRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadRole()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (authLoading || role === 'public') return
    if (!team || !league || !flight) return

    let active = true

    async function loadMatches() {
      setLoading(true)
      setError('')

      const { data, error: matchesError } = await supabase
        .from('matches')
        .select('id, match_date, league_name, flight, home_team, away_team, line_number')
        .eq('league_name', league)
        .eq('flight', flight)
        .or(`home_team.eq.${team},away_team.eq.${team}`)
        .is('line_number', null)
        .order('match_date', { ascending: true })
        .limit(24)

      if (!active) return

      if (matchesError) {
        setError(matchesError.message)
        setMatches([])
        setLoading(false)
        return
      }

      const nextMatches = (data ?? []) as MatchRow[]
      setMatches(nextMatches)

      const selectedMatch =
        nextMatches.find((match) => safeText(match.match_date).slice(0, 10) === safeText(eventDate).slice(0, 10)) ??
        nextMatches[0] ??
        null

      if (selectedMatch) {
        if (!eventDate) {
          setEventDate(safeText(selectedMatch.match_date).slice(0, 10))
        }

        if (!opponentTeam) {
          const inferredOpponent =
            safeText(selectedMatch.home_team) === team
              ? safeText(selectedMatch.away_team)
              : safeText(selectedMatch.home_team)
          setOpponentTeam(inferredOpponent)
        }
      }

      setLoading(false)
    }

    void loadMatches()

    return () => {
      active = false
    }
  }, [authLoading, eventDate, flight, league, opponentTeam, role, team])

  useEffect(() => {
    if (!team && !league && !flight) return

    writeCaptainResumeState({
      team: team || undefined,
      league: league || undefined,
      flight: flight || undefined,
      eventDate: eventDate || undefined,
      opponentTeam: opponentTeam || undefined,
      lastTool: 'weekly-brief',
      lastToolLabel: 'Weekly Brief',
    })
  }, [eventDate, flight, league, opponentTeam, team])

  const currentMatch = useMemo(
    () =>
      matches.find((match) => safeText(match.match_date).slice(0, 10) === safeText(eventDate).slice(0, 10)) ??
      matches[0] ??
      null,
    [eventDate, matches]
  )

  const resolvedOpponent =
    opponentTeam ||
    (currentMatch
      ? safeText(currentMatch.home_team) === team
        ? safeText(currentMatch.away_team)
        : safeText(currentMatch.home_team)
      : '')

  const eventKey = useMemo(
    () => safeKey(team, league, flight, eventDate || currentMatch?.match_date || null),
    [currentMatch?.match_date, eventDate, flight, league, team]
  )

  const lineupRows = useMemo(
    () => readLocalArray<LineupAssignment>(WEEKLY_LINEUPS_STORAGE_KEY).filter((row) => row.event_key === eventKey),
    [eventKey]
  )

  const eventDetail =
    readLocalArray<EventDetail>(WEEKLY_EVENT_DETAILS_STORAGE_KEY).find((row) => safeText(row.key) === eventKey) ?? null

  const selectedScenario = readLocalObject<StoredScenario>(SELECTED_SCENARIO_STORAGE_KEY)
  const sharedNotes = readCaptainWeekNotes({
    team,
    league,
    flight,
    eventDate: eventDate || currentMatch?.match_date || '',
    opponentTeam: resolvedOpponent,
  })
  const weekStatusScope = useMemo(
    () => ({
      team,
      league,
      flight,
      eventDate: eventDate || currentMatch?.match_date || '',
      opponentTeam: resolvedOpponent,
    }),
    [currentMatch?.match_date, eventDate, flight, league, resolvedOpponent, team],
  )
  const weekStatusKey = useMemo(() => buildCaptainWeekStatusKey(weekStatusScope), [weekStatusScope])
  const weekStatus = useMemo(
    () => (weekStatusState.key === weekStatusKey ? weekStatusState.status : readCaptainWeekStatus(weekStatusScope)?.status || 'draft-lineup'),
    [weekStatusKey, weekStatusScope, weekStatusState],
  )
  const weekStatusMeta = useMemo(() => getCaptainWeekStatusMeta(weekStatus), [weekStatus])

  const availabilityRows = useMemo(
    () => readLocalArray<WeeklyAvailability>(WEEKLY_AVAILABILITY_STORAGE_KEY).filter((row) => row.event_key === eventKey),
    [eventKey]
  )
  const responseRows = useMemo(
    () => readLocalArray<WeeklyResponse>(WEEKLY_RESPONSES_STORAGE_KEY).filter((row) => row.event_key === eventKey),
    [eventKey]
  )

  const availabilitySummary = useMemo(() => {
    const counts = {
      available: 0,
      tentative: 0,
      unavailable: 0,
      noResponse: 0,
    }

    for (const row of availabilityRows) {
      if (row.status === 'available') counts.available += 1
      else if (row.status === 'tentative') counts.tentative += 1
      else if (row.status === 'unavailable') counts.unavailable += 1
      else counts.noResponse += 1
    }

    return counts
  }, [availabilityRows])

  const responseSummary = useMemo(() => {
    const counts = {
      confirmed: 0,
      late: 0,
      noResponse: 0,
    }

    for (const row of responseRows) {
      if (row.status === 'confirmed') counts.confirmed += 1
      else if (row.status === 'running-late') counts.late += 1
      else if (row.status === 'no-response') counts.noResponse += 1
    }

    return counts
  }, [responseRows])

  const readinessItems = [
    {
      label: 'Team scope',
      done: !!team && !!league && !!flight,
      detail: team && league && flight ? `${team} · ${league} · ${flight}` : 'Choose a team, league, and flight scope first.',
    },
    {
      label: 'Event context',
      done: !!eventDate && !!resolvedOpponent,
      detail: eventDate && resolvedOpponent ? `${formatDate(eventDate)} vs ${resolvedOpponent}` : 'Match date and opponent are still incomplete.',
    },
    {
      label: 'Lineup loaded',
      done: lineupRows.length > 0,
      detail: lineupRows.length ? `${lineupRows.length} court assignments are loaded.` : 'No weekly lineup has been imported into the command sheet yet.',
    },
    {
      label: 'Communication plan',
      done: !!(eventDetail?.location || eventDetail?.arrivalTime || eventDetail?.notes),
      detail:
        eventDetail?.location || eventDetail?.arrivalTime || eventDetail?.notes
          ? 'Arrival, location, or weekly message details are ready.'
          : 'Add event details in messaging so the team handoff is clearer.',
    },
  ]

  const lineupBuilderHref = buildCaptainScopedHref('/captain/lineup-builder', {
    team,
    league,
    flight,
    date: eventDate,
    opponent: resolvedOpponent,
  })
  const messagingHref = buildCaptainScopedHref('/captain/messaging', {
    team,
    league,
    flight,
    date: eventDate,
    opponent: resolvedOpponent,
  })
  const analyticsHref = buildCaptainScopedHref('/captain/analytics', {
    team,
    league,
    flight,
    date: eventDate,
    opponent: resolvedOpponent,
  })
  const teamBriefHref = buildCaptainScopedHref('/captain/team-brief', {
    team,
    league,
    flight,
    date: eventDate,
    opponent: resolvedOpponent,
  })

  function updateWeekStatus(nextStatus: CaptainWeekStatus) {
    setWeekStatusState({
      key: weekStatusKey,
      status: nextStatus,
    })
    upsertCaptainWeekStatus(weekStatusScope, nextStatus)
  }

  function handlePrint() {
    if (typeof window === 'undefined') return
    window.print()
  }

  if (authLoading) {
    return (
      <main style={pageStyle}>
        <SiteShell>
          <section style={surfaceCard}>
            <p style={mutedTextStyle}>Checking captain brief access...</p>
          </section>
        </SiteShell>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <SiteShell>
        <div style={contentStyle}>
          <section style={heroCard}>
            <div style={heroTopRow}>
              <div>
                <p style={sectionKicker}>Weekly Brief</p>
                <h1 style={heroTitle}>One captain command sheet for the whole week.</h1>
                <p style={heroText}>
                  Pull together match context, shared notes, lineup status, event logistics, and communication readiness in one place before match day.
                </p>
              </div>

              <div style={heroButtonRow}>
                <button type="button" onClick={handlePrint} style={primaryButton}>
                  Print brief
                </button>
                <Link href={teamBriefHref} style={secondaryButton}>
                  Team-facing brief
                </Link>
                <Link href={messagingHref} style={secondaryButton}>
                  Open messaging
                </Link>
                <Link href={lineupBuilderHref} style={secondaryButton}>
                  Open lineup builder
                </Link>
              </div>
            </div>

            <div style={statusShell}>
              <div>
                <div style={sectionKicker}>Weekly workflow status</div>
                <div style={statusValue}>{weekStatusMeta.label}</div>
                <div style={heroText}>{weekStatusMeta.detail}</div>
              </div>
              <div style={statusButtonRow}>
                <button type="button" onClick={() => updateWeekStatus('draft-lineup')} style={weekStatus === 'draft-lineup' ? primaryButton : secondaryButton}>
                  Draft lineup
                </button>
                <button type="button" onClick={() => updateWeekStatus('ready-to-send')} style={weekStatus === 'ready-to-send' ? primaryButton : secondaryButton}>
                  Ready to send
                </button>
                <button type="button" onClick={() => updateWeekStatus('finalized')} style={weekStatus === 'finalized' ? primaryButton : secondaryButton}>
                  Finalized
                </button>
              </div>
            </div>

            <div style={metricGrid}>
              <MetricCard label="Team scope" value={team || 'Not set'} detail={league && flight ? `${league} · ${flight}` : 'Scope incomplete'} />
              <MetricCard label="Match day" value={formatDate(eventDate || currentMatch?.match_date)} detail={resolvedOpponent ? `vs ${resolvedOpponent}` : 'Opponent not set'} />
              <MetricCard label="Lineup" value={lineupRows.length ? `${lineupRows.length} courts` : 'Not loaded'} detail={selectedScenario?.scenario_name || 'No active saved scenario'} />
              <MetricCard label="Messaging" value={eventDetail?.arrivalTime || 'Pending'} detail={eventDetail?.location || 'Location not set yet'} accent />
            </div>
          </section>

          {error ? <section style={errorCard}>{error}</section> : null}

          {!team || !league || !flight ? (
            <section style={surfaceCard}>
              <div style={mutedCallout}>
                Choose a captain team scope first so the weekly brief knows which match week to summarize.
              </div>
            </section>
          ) : null}

          {loading ? (
            <section style={surfaceCard}>
              <p style={mutedTextStyle}>Loading weekly brief data...</p>
            </section>
          ) : null}

          <section style={twoColumnGrid(isTablet)}>
            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Shared notes</p>
                  <h2 style={sectionTitle}>Weekly prep + opponent scouting</h2>
                </div>
                <span style={pillStyle}>{sharedNotes?.updatedAt ? 'Saved memory' : 'No saved notes'}</span>
              </div>

              <div style={notesStack}>
                <div style={noteCard}>
                  <div style={noteLabel}>Weekly prep notes</div>
                  <div style={noteText}>{sharedNotes?.weeklyNotes || 'No weekly prep notes saved yet.'}</div>
                </div>
                <div style={noteCard}>
                  <div style={noteLabel}>Opponent scouting notes</div>
                  <div style={noteText}>{sharedNotes?.opponentNotes || 'No opponent scouting notes saved yet.'}</div>
                </div>
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Event setup</p>
                  <h2 style={sectionTitle}>Arrival, location, and captain ops</h2>
                </div>
                <span style={pillStyle}>{eventDetail?.arrivalTime || 'Arrival TBD'}</span>
              </div>

              <div style={eventGrid}>
                <InfoBlock label="Location" value={eventDetail?.location || 'Not set'} />
                <InfoBlock label="Arrival time" value={eventDetail?.arrivalTime || 'Not set'} />
                <InfoBlock label="Directions" value={eventDetail?.directions || 'No directions saved'} />
                <InfoBlock label="Week notes for message" value={eventDetail?.notes || 'No event note saved yet'} />
              </div>
            </section>
          </section>

          <section style={surfaceCard}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Lineup sheet</p>
                <h2 style={sectionTitle}>Current weekly lineup</h2>
              </div>
              <span style={pillStyle}>{lineupRows.length ? `${lineupRows.length} assignments` : 'No lineup yet'}</span>
            </div>

            {lineupRows.length ? (
              <div style={lineupGrid(isSmallMobile)}>
                {lineupRows.map((row) => (
                  <div key={row.id} style={lineupCard}>
                    <div style={lineupTop}>
                      <span style={courtPill}>{row.court_label}</span>
                      <span style={pillStyle}>{row.slot_type}</span>
                    </div>
                    <div style={lineupPlayers}>{row.players.filter(Boolean).join(' / ') || 'Open slot'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={mutedCallout}>
                No weekly lineup is loaded for this event yet. Build it in lineup builder or import a saved scenario from messaging.
              </div>
            )}
          </section>

          <section style={twoColumnGrid(isTablet)}>
            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Scenario anchor</p>
                  <h2 style={sectionTitle}>Saved scenario context</h2>
                </div>
              </div>

              <div style={eventGrid}>
                <InfoBlock label="Scenario" value={selectedScenario?.scenario_name || 'No saved scenario selected'} />
                <InfoBlock label="Opponent" value={selectedScenario?.opponent_team || resolvedOpponent || 'Not set'} />
                <InfoBlock label="Scenario notes" value={selectedScenario?.notes || 'No scenario note saved'} />
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Readiness</p>
                  <h2 style={sectionTitle}>Are we ready to move?</h2>
                </div>
              </div>

              <div style={readinessGrid}>
                {readinessItems.map((item) => (
                  <div key={item.label} style={item.done ? readinessGoodCard : readinessInfoCard}>
                    <div style={readinessLabel}>{item.label}</div>
                    <div style={readinessValue}>{item.done ? 'Ready' : 'Needs work'}</div>
                    <div style={readinessText}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section style={surfaceCard}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Team pulse</p>
                <h2 style={sectionTitle}>Availability and response snapshot</h2>
              </div>
            </div>

            <div style={metricGrid}>
              <MetricCard label="Available" value={String(availabilitySummary.available)} detail="Players marked available" accent />
              <MetricCard label="Tentative" value={String(availabilitySummary.tentative)} detail="Still needs follow-up" />
              <MetricCard label="Unavailable" value={String(availabilitySummary.unavailable)} detail="Out for this match" />
              <MetricCard label="Confirmed" value={String(responseSummary.confirmed)} detail={`${responseSummary.late} running late · ${responseSummary.noResponse} no response`} />
            </div>
          </section>

          <section style={surfaceCard}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Next actions</p>
                <h2 style={sectionTitle}>Move the week forward</h2>
              </div>
            </div>

            <div style={actionRow}>
              <Link href={lineupBuilderHref} style={primaryButton}>Refine lineup</Link>
              <Link href={messagingHref} style={secondaryButton}>Prepare messaging</Link>
              <Link href={analyticsHref} style={secondaryButton}>Review analytics</Link>
              <button type="button" onClick={() => router.push('/captain')} style={secondaryButton}>
                Back to hub
              </button>
            </div>
          </section>
        </div>
      </SiteShell>
    </main>
  )
}

function MetricCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string
  value: string
  detail: string
  accent?: boolean
}) {
  return (
    <div style={accent ? metricCardAccent : metricCard}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
      <div style={metricDetail}>{detail}</div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBlock}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value}</div>
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top, rgba(37,99,235,0.22), transparent 32%), linear-gradient(180deg, #081224 0%, #0b1730 100%)',
}

const contentStyle: CSSProperties = {
  display: 'grid',
  gap: 20,
}

const heroCard: CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 24,
  borderRadius: 28,
  border: '1px solid rgba(74,222,128,0.16)',
  background: 'linear-gradient(180deg, rgba(14,30,58,0.86) 0%, rgba(16,38,70,0.78) 100%)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
}

const heroTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
}

const heroTitle: CSSProperties = {
  margin: '6px 0 0',
  color: '#f8fbff',
  fontSize: 34,
  lineHeight: 1.02,
  letterSpacing: '-0.04em',
}

const heroText: CSSProperties = {
  marginTop: 12,
  color: 'rgba(229,238,251,0.8)',
  fontSize: 15,
  lineHeight: 1.7,
  maxWidth: 760,
}

const heroButtonRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const statusShell: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(18,36,66,0.72) 0%, rgba(17,34,61,0.58) 100%)',
  marginTop: 18,
}

const statusValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1.08,
  letterSpacing: '-0.03em',
  marginTop: 6,
}

const statusButtonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 14,
}

const metricCard: CSSProperties = {
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.52)',
}

const metricCardAccent: CSSProperties = {
  ...metricCard,
  border: '1px solid rgba(74,222,128,0.18)',
  boxShadow: '0 10px 24px rgba(74,222,128,0.08)',
}

const metricLabel: CSSProperties = {
  color: 'rgba(197,213,234,0.86)',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const metricValue: CSSProperties = {
  marginTop: 10,
  color: '#f8fbff',
  fontSize: 24,
  fontWeight: 900,
}

const metricDetail: CSSProperties = {
  marginTop: 10,
  color: 'rgba(229,238,251,0.72)',
  fontSize: 13,
  lineHeight: 1.65,
}

const surfaceCard: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(16,38,70,0.78) 100%)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
}

const sectionKicker: CSSProperties = {
  fontSize: 12,
  color: 'rgba(197,213,234,0.86)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const sectionTitle: CSSProperties = {
  margin: '6px 0 0',
  color: '#f8fbff',
  fontSize: 24,
  lineHeight: 1.08,
  letterSpacing: '-0.03em',
}

const pillStyle: CSSProperties = {
  borderRadius: 999,
  padding: '8px 12px',
  background: 'rgba(37,91,227,0.16)',
  color: '#c7dbff',
  fontSize: 12,
  fontWeight: 800,
}

const twoColumnGrid = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  gap: 20,
})

const notesStack: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const noteCard: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}

const noteLabel: CSSProperties = {
  color: '#dbeafe',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const noteText: CSSProperties = {
  color: 'rgba(229,238,251,0.82)',
  fontSize: 14,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
}

const eventGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
}

const infoBlock: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}

const infoLabel: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const infoValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: 14,
  lineHeight: 1.65,
  whiteSpace: 'pre-wrap',
}

const lineupGrid = (isSmallMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
})

const lineupCard: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}

const lineupTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
}

const courtPill: CSSProperties = {
  borderRadius: 999,
  padding: '8px 12px',
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
  fontSize: 12,
  fontWeight: 800,
}

const lineupPlayers: CSSProperties = {
  color: '#f8fbff',
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.6,
}

const readinessGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 12,
}

const readinessBaseCard: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 16,
  borderRadius: 20,
}

const readinessGoodCard: CSSProperties = {
  ...readinessBaseCard,
  border: '1px solid rgba(74,222,128,0.18)',
  background: 'rgba(18,58,40,0.34)',
}

const readinessInfoCard: CSSProperties = {
  ...readinessBaseCard,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(21,37,66,0.54)',
}

const readinessLabel: CSSProperties = {
  color: '#dbeafe',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const readinessValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: 18,
  fontWeight: 900,
}

const readinessText: CSSProperties = {
  color: 'rgba(229,238,251,0.78)',
  fontSize: 13,
  lineHeight: 1.65,
}

const actionRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  padding: '12px 18px',
  background: 'linear-gradient(135deg, #9be11d 0%, #45e3a1 100%)',
  color: '#071425',
  fontWeight: 900,
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
}

const secondaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  padding: '12px 18px',
  background: 'rgba(255,255,255,0.06)',
  color: '#f8fbff',
  fontWeight: 800,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer',
}

const mutedTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  margin: 0,
  lineHeight: 1.65,
}

const mutedCallout: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(229,238,251,0.78)',
  lineHeight: 1.7,
}

const errorCard: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(248,113,113,0.22)',
  background: 'rgba(60,16,24,0.76)',
  color: '#fecaca',
  fontWeight: 700,
}
