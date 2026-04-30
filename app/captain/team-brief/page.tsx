'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import CaptainSubnav from '@/app/components/captain-subnav'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import SiteShell from '@/app/components/site-shell'
import { getClientAuthState } from '@/lib/auth'
import { buildCaptainScopedHref, readCaptainResumeState, writeCaptainResumeState } from '@/lib/captain-memory'
import {
  buildCaptainWeekStatusKey,
  getCaptainWeekStatusMeta,
  readCaptainWeekStatus,
  upsertCaptainWeekStatus,
  type CaptainWeekStatus,
} from '@/lib/captain-week-status'
import { supabase } from '@/lib/supabase'
import { type UserRole } from '@/lib/roles'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import {
  formatWeekdayDate as formatDate,
  cleanText as safeText,
  safeKey,
  formatDateTime,
  readLocalArray,
} from '@/lib/captain-formatters'

type MatchRow = {
  id: string
  match_date: string | null
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  line_number: string | null
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
const WEEKLY_RESPONSES_STORAGE_KEY = 'tenaceiq_weekly_responses'

function readInitialContext() {
  if (typeof window === 'undefined') {
    return { competitionLayer: '', team: '', league: '', flight: '', eventDate: '', opponentTeam: '' }
  }

  const params = new URLSearchParams(window.location.search)
  const resumeState = readCaptainResumeState()

  return {
    competitionLayer: params.get('layer') ?? resumeState?.competitionLayer ?? '',
    team: params.get('team') ?? resumeState?.team ?? '',
    league: params.get('league') ?? resumeState?.league ?? '',
    flight: params.get('flight') ?? resumeState?.flight ?? '',
    eventDate: params.get('date') ?? resumeState?.eventDate ?? '',
    opponentTeam: params.get('opponent') ?? resumeState?.opponentTeam ?? '',
  }
}

export default function CaptainTeamBriefPage() {
  const { isTablet, isSmallMobile } = useViewportBreakpoints()
  const initialContext = readInitialContext()

  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [weekStatusState, setWeekStatusState] = useState<{
    key: string
    status: CaptainWeekStatus
  }>({
    key: '',
    status: 'draft-lineup',
  })

  const [competitionLayer] = useState(initialContext.competitionLayer)
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
      setEntitlements(authState.entitlements)
      setAuthLoading(false)

      if (authState.role === 'public' && typeof window !== 'undefined') {
        const next = encodeURIComponent('/captain/team-brief')
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
        if (!eventDate) setEventDate(safeText(selectedMatch.match_date).slice(0, 10))
        if (!opponentTeam) {
          setOpponentTeam(
            safeText(selectedMatch.home_team) === team
              ? safeText(selectedMatch.away_team)
              : safeText(selectedMatch.home_team)
          )
        }
      }

      setLoading(false)
    }

    void loadMatches()

    return () => {
      active = false
    }
  }, [authLoading, eventDate, flight, league, opponentTeam, role, team])

  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

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

  useEffect(() => {
    if (!team && !league && !flight) return
    writeCaptainResumeState({
      competitionLayer: competitionLayer || undefined,
      team: team || undefined,
      league: league || undefined,
      flight: flight || undefined,
      eventDate: eventDate || undefined,
      opponentTeam: resolvedOpponent || undefined,
      lastTool: 'team-brief',
      lastToolLabel: 'Team Brief',
    })
  }, [competitionLayer, eventDate, flight, league, resolvedOpponent, team])

  const eventKey = useMemo(
    () => safeKey(team, league, flight, eventDate || currentMatch?.match_date || null),
    [currentMatch?.match_date, eventDate, flight, league, team]
  )

  const lineupRows = useMemo(
    () => readLocalArray<LineupAssignment>(WEEKLY_LINEUPS_STORAGE_KEY).filter((row) => row.event_key === eventKey),
    [eventKey]
  )
  const responseRows = useMemo(
    () => readLocalArray<WeeklyResponse>(WEEKLY_RESPONSES_STORAGE_KEY).filter((row) => row.event_key === eventKey),
    [eventKey]
  )
  const eventDetail =
    readLocalArray<EventDetail>(WEEKLY_EVENT_DETAILS_STORAGE_KEY).find((row) => safeText(row.key) === eventKey) ?? null

  const lineupSummaryText = useMemo(() => {
    if (!lineupRows.length) return 'Lineup assignments are still being finalized.'
    return lineupRows
      .map((row) => `${row.court_label}: ${row.players.filter(Boolean).join(' / ') || 'Open slot'}`)
      .join('\n')
  }, [lineupRows])

  const responseRiskSummary = useMemo(() => {
    let late = 0
    let noResponse = 0
    let needSub = 0

    for (const row of responseRows) {
      if (row.status === 'running-late') late += 1
      if (row.status === 'no-response') noResponse += 1
      if (row.status === 'need-sub') needSub += 1
    }

    return { late, noResponse, needSub }
  }, [responseRows])

  const alertLines = [
    responseRiskSummary.late ? `${responseRiskSummary.late} player${responseRiskSummary.late === 1 ? '' : 's'} flagged as running late.` : '',
    responseRiskSummary.noResponse ? `${responseRiskSummary.noResponse} player${responseRiskSummary.noResponse === 1 ? '' : 's'} still have no response.` : '',
    responseRiskSummary.needSub ? `${responseRiskSummary.needSub} substitution issue${responseRiskSummary.needSub === 1 ? '' : 's'} still need attention.` : '',
  ].filter(Boolean)

  const generatedTeamMessage = [
    `Team update for ${formatDate(eventDate || currentMatch?.match_date)}${resolvedOpponent ? ` vs ${resolvedOpponent}` : ''}.`,
    eventDetail?.arrivalTime ? `Please arrive by ${eventDetail.arrivalTime}.` : '',
    eventDetail?.location ? `Location: ${eventDetail.location}.` : '',
    eventDetail?.directions ? `Directions: ${eventDetail.directions}` : '',
    eventDetail?.notes ? eventDetail.notes : '',
    alertLines.length ? `Alerts: ${alertLines.join(' ')}` : '',
    '',
    lineupSummaryText,
  ]
    .filter(Boolean)
    .join('\n')

  const weeklyBriefHref = buildCaptainScopedHref('/captain/weekly-brief', {
    competitionLayer,
    team,
    league,
    flight,
    date: eventDate,
    opponent: resolvedOpponent,
  })
  const messagingHref = buildCaptainScopedHref('/captain/messaging', {
    competitionLayer,
    team,
    league,
    flight,
    date: eventDate,
    opponent: resolvedOpponent,
  })
  const availabilityHref = buildCaptainScopedHref('/captain/availability', {
    competitionLayer,
    team,
    league,
    flight,
    date: eventDate,
    opponent: resolvedOpponent,
  })
  const lineupBuilderHref = buildCaptainScopedHref('/captain/lineup-builder', {
    competitionLayer,
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
  const latestResponseUpdate = responseRows.reduce<string | null>((latest, row) => {
    if (!row.updated_at) return latest
    if (!latest) return row.updated_at
    return new Date(row.updated_at).getTime() > new Date(latest).getTime() ? row.updated_at : latest
  }, null)
  const lineupUpdatedLabel = lineupRows.length ? `${lineupRows.length} assignments ready` : 'No lineup saved yet'
  const eventUpdatedLabel = eventDetail ? 'Event details saved' : 'No event details saved'
  const responseUpdatedLabel = latestResponseUpdate ? formatDateTime(latestResponseUpdate) : 'No response updates yet'
  const teamBriefSignals = [
    {
      label: 'Weekly status',
      value: weekStatusMeta.label,
      note: 'This version is meant for players and parents, so it should stay clean, current, and easy to act on.',
    },
    {
      label: 'Share readiness',
      value: lineupRows.length ? 'Lineup loaded' : 'Lineup still open',
      note: lineupRows.length
        ? 'Assignments are present, so this brief can work as a clear outward-facing summary.'
        : 'Wait until the lineup is more stable before treating this as the final player-facing brief.',
    },
    {
      label: 'Best next move',
      value: alertLines.length ? 'Clear team alerts' : 'Share the brief',
      note: alertLines.length
        ? 'Late arrivals, no-responses, or sub issues should be handled before broad sharing.'
        : 'The player-facing version is clean enough to print, copy, or send.',
    },
  ]

  function handlePrint() {
    if (typeof window === 'undefined') return
    window.print()
  }

  async function handleCopyMessage() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyStatus('Clipboard not available on this device.')
      return
    }

    try {
      await navigator.clipboard.writeText(generatedTeamMessage)
      setCopyStatus('Team message copied.')
    } catch {
      setCopyStatus('Unable to copy the message right now.')
    }
  }

  if (authLoading) {
    return (
      <main style={pageStyle}>
        <SiteShell>
          <section style={surfaceCard}>
            <p style={mutedTextStyle}>Checking team brief access...</p>
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
                <p style={sectionKicker}>Team Brief</p>
                <h1 style={heroTitle}>A clean player-facing weekly summary.</h1>
                <p style={heroText}>
                  Use this version when you want to share or print the week&apos;s essentials without exposing private scouting notes.
                </p>
              </div>

              <div style={heroButtonRow}>
                <PrimaryBtn onClick={handlePrint}>Print team brief</PrimaryBtn>
                <SecondaryBtn onClick={() => void handleCopyMessage()}>Copy team message</SecondaryBtn>
                <SecondaryLink href={weeklyBriefHref}>Open captain brief</SecondaryLink>
              </div>
            </div>

            <div style={statusShell}>
              <div>
                <div style={sectionKicker}>Weekly workflow status</div>
                <div style={statusValue}>{weekStatusMeta.label}</div>
                <div style={mutedTextStyle}>{weekStatusMeta.detail}</div>
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
              <MetricCard label="Team" value={team || 'Not set'} detail={league && flight ? `${league} - ${flight}` : 'Scope incomplete'} />
              <MetricCard label="Match day" value={formatDate(eventDate || currentMatch?.match_date)} detail={resolvedOpponent ? `vs ${resolvedOpponent}` : 'Opponent not set'} />
              <MetricCard label="Arrival" value={eventDetail?.arrivalTime || 'Not set'} detail={eventDetail?.location || 'Location not set'} accent />
              <MetricCard label="Alerts" value={alertLines.length ? String(alertLines.length) : 'Clear'} detail={alertLines.length ? 'Open team issues still need follow-up' : 'No saved late/sub/response alerts'} />
            </div>

            <section style={signalGridStyle}>
              {teamBriefSignals.map((signal) => (
                <article key={signal.label} style={signalCardStyle}>
                  <div style={signalLabelStyle}>{signal.label}</div>
                  <div style={signalValueStyle}>{signal.value}</div>
                  <div style={signalNoteStyle}>{signal.note}</div>
                </article>
              ))}
            </section>
          </section>

          {error ? <section style={errorCard}>{error}</section> : null}

          {!team || !league || !flight ? (
            <section style={surfaceCard}>
              <div style={mutedCallout}>
                Choose a captain team scope first so the team brief knows what week to summarize.
              </div>
            </section>
          ) : null}

          {loading ? (
            <section style={surfaceCard}>
              <p style={mutedTextStyle}>Loading team brief data...</p>
            </section>
          ) : null}

          <section style={surfaceCard}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Freshness</p>
                <h2 style={sectionTitle}>How current is this brief?</h2>
              </div>
            </div>

            <div style={metricGrid}>
              <MetricCard label="Lineup" value={lineupUpdatedLabel} detail="Pulled from the weekly lineup memory." />
              <MetricCard label="Event details" value={eventUpdatedLabel} detail="Location, arrival, and weekly note status." />
              <MetricCard label="Responses" value={responseUpdatedLabel} detail="Latest saved response/alert update." accent />
            </div>
          </section>

          <section style={twoColumnGrid(isTablet)}>
            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Match details</p>
                  <h2 style={sectionTitle}>When and where</h2>
                </div>
              </div>

              <div style={eventGrid}>
                <InfoBlock label="Opponent" value={resolvedOpponent || 'Not set'} />
                <InfoBlock label="Location" value={eventDetail?.location || 'Not set'} />
                <InfoBlock label="Arrival time" value={eventDetail?.arrivalTime || 'Not set'} />
                <InfoBlock label="Directions" value={eventDetail?.directions || 'No directions saved'} />
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Captain note</p>
                  <h2 style={sectionTitle}>Weekly message context</h2>
                </div>
              </div>

              <div style={noteCard}>
                <div style={noteText}>{eventDetail?.notes || 'No team-facing weekly note has been saved yet.'}</div>
              </div>
            </section>
          </section>

          <section style={surfaceCard}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Lineup</p>
                <h2 style={sectionTitle}>Current assignment sheet</h2>
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
                No lineup is loaded yet. Build one in lineup builder or import a saved scenario from messaging before sharing this brief.
              </div>
            )}
          </section>

          <section style={surfaceCard}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Send-ready message</p>
                <h2 style={sectionTitle}>Copy and send this to the team</h2>
              </div>
              <SecondaryBtn onClick={() => void handleCopyMessage()}>Copy message</SecondaryBtn>
            </div>

            {copyStatus ? <div style={statusPill}>{copyStatus}</div> : null}

            <div style={messageCard}>
              <pre style={messageText}>{generatedTeamMessage}</pre>
            </div>
          </section>

          <section style={surfaceCard}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Risk watch</p>
                <h2 style={sectionTitle}>What still needs attention</h2>
              </div>
            </div>

            {alertLines.length ? (
              <div style={alertStack}>
                {alertLines.map((line) => (
                  <div key={line} style={alertCard}>{line}</div>
                ))}
              </div>
            ) : (
              <div style={mutedCallout}>
                No current late-arrival, substitution, or no-response alerts are saved for this event.
              </div>
            )}

            <div style={quickActionRow}>
              <SecondaryLink href={messagingHref}>Open messaging</SecondaryLink>
              <SecondaryLink href={availabilityHref}>Open availability</SecondaryLink>
              <SecondaryLink href={lineupBuilderHref}>Open lineup builder</SecondaryLink>
            </div>
          </section>
        </div>

        <CaptainSubnav
          title="Team Brief inside the captain command center"
          description="Move from team intelligence into lineup building, scenario planning, messaging, and availability without breaking the pre-match workflow."
          tierLabel={access.captainTierLabel}
          tierActive={access.captainSubscriptionActive}
        />

        {!access.canUseCaptainWorkflow ? (
          <UpgradePrompt
            planId="captain"
            compact
            headline="Need one place to prep your team for the week?"
            body="Unlock Captain to connect team brief context, availability, lineup planning, and match-day communication instead of managing each step separately."
            ctaLabel="Unlock Captain Tools"
            ctaHref="/pricing"
            secondaryLabel="See Captain plan"
            secondaryHref="/pricing"
            footnote="Best for captains who want cleaner weekly prep, less scrambling, and clearer decisions before match day."
          />
        ) : null}
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
const contentStyle: CSSProperties = { display: 'grid', gap: 20 }
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
const heroButtonRow: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap' }
const metricGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }
const signalGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }
const signalCardStyle: CSSProperties = { padding: 18, borderRadius: 22, border: '1px solid rgba(116,190,255,0.14)', background: 'linear-gradient(180deg, rgba(28,56,101,0.22) 0%, rgba(10,22,44,0.86) 100%)', boxShadow: '0 14px 34px rgba(7,18,40,0.16)' }
const signalLabelStyle: CSSProperties = { color: '#8fb7ff', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }
const signalValueStyle: CSSProperties = { marginTop: 10, color: '#f8fbff', fontSize: '1.24rem', fontWeight: 900, letterSpacing: '-0.03em' }
const signalNoteStyle: CSSProperties = { marginTop: 8, color: 'rgba(224,234,247,0.74)', fontSize: '.94rem', lineHeight: 1.6 }
const metricCard: CSSProperties = { padding: 16, borderRadius: 22, border: '1px solid rgba(116,190,255,0.14)', background: 'rgba(15,23,42,0.52)' }
const metricCardAccent: CSSProperties = { ...metricCard, border: '1px solid rgba(74,222,128,0.18)', boxShadow: '0 10px 24px rgba(74,222,128,0.08)' }
const metricLabel: CSSProperties = { color: 'rgba(197,213,234,0.86)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }
const metricValue: CSSProperties = { marginTop: 10, color: '#f8fbff', fontSize: 24, fontWeight: 900 }
const metricDetail: CSSProperties = { marginTop: 10, color: 'rgba(229,238,251,0.72)', fontSize: 13, lineHeight: 1.65 }
const surfaceCard: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(16,38,70,0.78) 100%)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
}
const sectionHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }
const sectionKicker: CSSProperties = { fontSize: 12, color: 'rgba(197,213,234,0.86)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }
const sectionTitle: CSSProperties = { margin: '6px 0 0', color: '#f8fbff', fontSize: 24, lineHeight: 1.08, letterSpacing: '-0.03em' }
const pillStyle: CSSProperties = { borderRadius: 999, padding: '8px 12px', background: 'rgba(37,91,227,0.16)', color: '#c7dbff', fontSize: 12, fontWeight: 800 }
const statusShell: CSSProperties = { display: 'grid', gap: 14, padding: 18, borderRadius: 22, border: '1px solid rgba(116,190,255,0.14)', background: 'linear-gradient(180deg, rgba(18,36,66,0.72) 0%, rgba(17,34,61,0.58) 100%)', marginTop: 18 }
const statusValue: CSSProperties = { color: '#f8fbff', fontSize: 26, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', marginTop: 6 }
const statusButtonRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10 }
const twoColumnGrid = (isTablet: boolean): CSSProperties => ({ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 20 })
const eventGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }
const infoBlock: CSSProperties = { display: 'grid', gap: 8, padding: 14, borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }
const infoLabel: CSSProperties = { color: '#93c5fd', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }
const infoValue: CSSProperties = { color: '#f8fbff', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }
const noteCard: CSSProperties = { display: 'grid', gap: 8, padding: 16, borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }
const noteText: CSSProperties = { color: 'rgba(229,238,251,0.82)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }
const lineupGrid = (isSmallMobile: boolean): CSSProperties => ({ display: 'grid', gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 })
const lineupCard: CSSProperties = { display: 'grid', gap: 10, padding: 16, borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }
const lineupTop: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }
const courtPill: CSSProperties = { borderRadius: 999, padding: '8px 12px', background: 'rgba(155,225,29,0.14)', color: '#e7ffd1', fontSize: 12, fontWeight: 800 }
const lineupPlayers: CSSProperties = { color: '#f8fbff', fontSize: 15, fontWeight: 700, lineHeight: 1.6 }
const alertStack: CSSProperties = { display: 'grid', gap: 12 }
const alertCard: CSSProperties = { padding: 14, borderRadius: 18, border: '1px solid rgba(245,158,11,0.22)', background: 'rgba(92,40,10,0.32)', color: '#fde68a', lineHeight: 1.65, fontWeight: 700 }
const messageCard: CSSProperties = { padding: 18, borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }
const messageText: CSSProperties = { margin: 0, color: '#f8fbff', fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }
const statusPill: CSSProperties = { borderRadius: 999, padding: '8px 12px', background: 'rgba(74,222,128,0.16)', color: '#dcfce7', fontSize: 12, fontWeight: 800, justifySelf: 'start' }
const quickActionRow: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap' }
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '12px 18px', background: 'linear-gradient(135deg, #9be11d 0%, #45e3a1 100%)', color: '#071425', fontWeight: 900, textDecoration: 'none', border: 'none', cursor: 'pointer' }
const secondaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '12px 18px', background: 'rgba(255,255,255,0.06)', color: '#f8fbff', fontWeight: 800, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }
const mutedTextStyle: CSSProperties = { color: 'rgba(224,234,247,0.72)', margin: 0, lineHeight: 1.65 }
const mutedCallout: CSSProperties = { padding: 16, borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(229,238,251,0.78)', lineHeight: 1.7 }
const errorCard: CSSProperties = { padding: 18, borderRadius: 22, border: '1px solid rgba(248,113,113,0.22)', background: 'rgba(60,16,24,0.76)', color: '#fecaca', fontWeight: 700 }

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        ...primaryButton,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 20px 40px rgba(155,225,29,0.26)' : undefined,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

function SecondaryBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        ...secondaryButton,
        borderColor: hovered ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
        background: hovered ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.06)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...secondaryButton,
        borderColor: hovered ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
        background: hovered ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.06)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 150ms ease',
      }}
    >
      {children}
    </Link>
  )
}
