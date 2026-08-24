'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/components/auth-provider'
import LockedPlanPage from '@/app/components/locked-plan-page'
import SiteShell from '@/app/components/site-shell'
import { buildProductAccessState } from '@/lib/access-model'
import { buildCaptainScopedHref, readCaptainResumeState, writeCaptainResumeState } from '@/lib/captain-memory'
import { readLocalArray, safeKey } from '@/lib/captain-formatters'
import { supabase } from '@/lib/supabase'

type MatchRow = {
  id: string
  match_date: string | null
  home_team: string | null
  away_team: string | null
  winner_side: 'A' | 'B' | null
  score: string | null
}
type PlayerRelation = { id: string; name: string } | { id: string; name: string }[] | null
type MatchPlayerRow = { match_id: string; side: 'A' | 'B'; players: PlayerRelation }
type PlayerImpact = { id: string; name: string; appearances: number; wins: number; losses: number }
type LineupAssignment = { id: string; event_key: string; court_label: string; players: string[] }
type WeeklyAvailability = { id: string; event_key: string; status: 'available' | 'unavailable' | 'tentative' | 'no-response' }
type WeeklyResponse = { id: string; event_key: string; status: 'confirmed' | 'declined' | 'viewed' | 'no-response' | 'running-late' | 'need-sub' }
type EventDetail = { key?: string; location?: string; arrivalTime?: string; notes?: string }

const WEEKLY_LINEUPS_STORAGE_KEY = 'tenaceiq_weekly_lineups'
const WEEKLY_EVENT_DETAILS_STORAGE_KEY = 'tenaceiq_weekly_event_details'
const WEEKLY_AVAILABILITY_STORAGE_KEY = 'tenaceiq_weekly_availability'
const WEEKLY_RESPONSES_STORAGE_KEY = 'tenaceiq_weekly_responses'

function readInitialScope() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const saved = readCaptainResumeState()
  return {
    competitionLayer: params.get('layer') || saved?.competitionLayer || '',
    team: params.get('team') || saved?.team || '',
    league: params.get('league') || saved?.league || '',
    flight: params.get('flight') || saved?.flight || '',
    eventDate: params.get('date') || saved?.eventDate || '',
    opponentTeam: params.get('opponent') || saved?.opponentTeam || '',
  }
}

function escapePostgrestValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date pending'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Date pending' : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getOpponent(match: MatchRow | null, team: string) {
  if (!match) return ''
  return match.home_team?.trim().toLowerCase() === team.trim().toLowerCase() ? (match.away_team || '') : (match.home_team || '')
}

function didTeamWin(match: MatchRow, team: string) {
  if (!match.winner_side) return null
  const teamSide = match.home_team?.trim().toLowerCase() === team.trim().toLowerCase()
    ? 'A'
    : match.away_team?.trim().toLowerCase() === team.trim().toLowerCase()
      ? 'B'
      : null
  return teamSide ? teamSide === match.winner_side : null
}

function buildPlayerImpact(matches: MatchRow[], participants: MatchPlayerRow[], team: string): PlayerImpact[] {
  const matchById = new Map(matches.map((match) => [match.id, match]))
  const impact = new Map<string, PlayerImpact>()
  for (const row of participants) {
    const match = matchById.get(row.match_id)
    const won = match ? didTeamWin(match, team) : null
    if (!match || won === null) continue
    const normalizedTeam = team.trim().toLowerCase()
    const teamSide = match.home_team?.trim().toLowerCase() === normalizedTeam ? 'A'
      : match.away_team?.trim().toLowerCase() === normalizedTeam ? 'B'
        : null
    if (!teamSide || row.side !== teamSide) continue
    const player = Array.isArray(row.players) ? row.players[0] : row.players
    if (!player?.id || !player.name) continue
    const current = impact.get(player.id) ?? { id: player.id, name: player.name, appearances: 0, wins: 0, losses: 0 }
    current.appearances += 1
    if (won) current.wins += 1
    else current.losses += 1
    impact.set(player.id, current)
  }
  return [...impact.values()].sort((a, b) => b.appearances - a.appearances || b.wins - a.wins || a.name.localeCompare(b.name)).slice(0, 3)
}

export default function CaptainSeasonDashboardPage() {
  return <SiteShell active="/captain"><CaptainSeasonDashboardContent /></SiteShell>
}

function CaptainSeasonDashboardContent() {
  const router = useRouter()
  const initialScope = useMemo(() => readInitialScope(), [])
  const { role, entitlements, authResolved } = useAuth()
  const access = useMemo(() => buildProductAccessState(role, entitlements), [entitlements, role])
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [nextMatch, setNextMatch] = useState<MatchRow | null>(null)
  const [recentResults, setRecentResults] = useState<MatchRow[]>([])
  const [playerImpact, setPlayerImpact] = useState<PlayerImpact[]>([])
  const [opponentResults, setOpponentResults] = useState<MatchRow[]>([])
  const [loadError, setLoadError] = useState('')

  const team = initialScope?.team || ''
  const league = initialScope?.league || ''
  const flight = initialScope?.flight || ''
  const competitionLayer = initialScope?.competitionLayer || ''
  const initialDate = initialScope?.eventDate || ''
  const initialOpponent = initialScope?.opponentTeam || ''

  useEffect(() => {
    if (!authResolved || role !== 'public') return
    router.replace(`/login?plan=captain&next=${encodeURIComponent('/captain/season-dashboard')}`)
  }, [authResolved, role, router])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    if (!access.canUseCaptainWorkflow) return
    if (!team) return
    let active = true
    const escapedTeam = escapePostgrestValue(team)
    let inventoryQuery = supabase.from('matches').select('id', { count: 'exact', head: true })
      .or(`home_team.eq."${escapedTeam}",away_team.eq."${escapedTeam}"`).is('line_number', null)
    let upcomingQuery = supabase.from('matches').select('id, match_date, home_team, away_team, winner_side, score')
      .or(`home_team.eq."${escapedTeam}",away_team.eq."${escapedTeam}"`).is('line_number', null)
      .gte('match_date', new Date().toISOString().slice(0, 10)).order('match_date', { ascending: true }).limit(1)
    let resultsQuery = supabase.from('matches').select('id, match_date, home_team, away_team, winner_side, score')
      .or(`home_team.eq."${escapedTeam}",away_team.eq."${escapedTeam}"`).is('line_number', null)
      .not('winner_side', 'is', null).order('match_date', { ascending: false }).limit(400)
    if (league) { inventoryQuery = inventoryQuery.eq('league_name', league); upcomingQuery = upcomingQuery.eq('league_name', league) }
    if (league) resultsQuery = resultsQuery.eq('league_name', league)
    if (flight) { inventoryQuery = inventoryQuery.eq('flight', flight); upcomingQuery = upcomingQuery.eq('flight', flight); resultsQuery = resultsQuery.eq('flight', flight) }

    void Promise.all([inventoryQuery, upcomingQuery, resultsQuery]).then(([inventory, upcoming, results]) => {
      if (!active) return
      const error = inventory.error || upcoming.error || results.error
      if (error) {
        setLoadError('Season data is temporarily unavailable. Try again shortly.')
        setMatchCount(null)
        setNextMatch(null)
        setRecentResults([])
        setPlayerImpact([])
        return
      }
      setLoadError('')
      setMatchCount(inventory.count ?? 0)
      setNextMatch((upcoming.data?.[0] as MatchRow | undefined) ?? null)
      setRecentResults((results.data ?? []) as MatchRow[])
      const completedResults = (results.data ?? []) as MatchRow[]
      const matchIds = completedResults.map((match) => match.id)
      if (!matchIds.length) { setPlayerImpact([]); return }
      void supabase.from('match_players').select('match_id, side, players ( id, name )').in('match_id', matchIds).then(({ data, error: participantError }) => {
        if (!active || participantError) { if (active) setPlayerImpact([]); return }
        setPlayerImpact(buildPlayerImpact(completedResults, (data ?? []) as MatchPlayerRow[], team))
      })
    })
    return () => { active = false }
  }, [access.canUseCaptainWorkflow, authResolved, flight, league, role, team])

  const resolvedDate = nextMatch?.match_date || initialDate
  const resolvedOpponent = getOpponent(nextMatch, team) || initialOpponent
  useEffect(() => {
    if (!authResolved || role === 'public' || !access.canUseCaptainWorkflow || !resolvedOpponent) return
    let active = true
    const escapedOpponent = escapePostgrestValue(resolvedOpponent)
    let query = supabase.from('matches').select('id, match_date, home_team, away_team, winner_side, score')
      .or(`home_team.eq."${escapedOpponent}",away_team.eq."${escapedOpponent}"`).is('line_number', null)
      .not('winner_side', 'is', null).order('match_date', { ascending: false }).limit(400)
    if (league) query = query.eq('league_name', league)
    if (flight) query = query.eq('flight', flight)
    void query.then(({ data, error }) => {
      if (!active) return
      setOpponentResults(error ? [] : (data ?? []) as MatchRow[])
    })
    return () => { active = false }
  }, [access.canUseCaptainWorkflow, authResolved, flight, league, resolvedOpponent, role])
  const seasonResults = useMemo(() => recentResults.map((match) => ({ match, won: didTeamWin(match, team) })).filter((item) => item.won !== null), [recentResults, team])
  const seasonWins = seasonResults.filter((item) => item.won).length
  const seasonLosses = seasonResults.length - seasonWins
  const currentForm = seasonResults.slice(0, 5).map((item) => item.won ? 'W' : 'L')
  const recentResultRows = seasonResults.slice(0, 5)
  const opponentRecord = useMemo(() => {
    const results = opponentResults.map((match) => didTeamWin(match, resolvedOpponent)).filter((won): won is boolean => won !== null)
    return { wins: results.filter(Boolean).length, losses: results.filter((won) => !won).length, form: results.slice(0, 5).map((won) => won ? 'W' : 'L') }
  }, [opponentResults, resolvedOpponent])
  const hasOpponentRecord = Boolean(resolvedOpponent) && opponentRecord.wins + opponentRecord.losses > 0
  const currentStreak = useMemo(() => {
    const first = seasonResults[0]?.won
    if (typeof first !== 'boolean') return ''
    const count = seasonResults.findIndex((item) => item.won !== first)
    const length = count === -1 ? seasonResults.length : count
    return `${first ? 'Winning' : 'Loss'} streak: ${length}`
  }, [seasonResults])
  const eventKey = useMemo(() => safeKey(team, league, flight, resolvedDate || null), [flight, league, resolvedDate, team])
  const lineupRows = useMemo(() => readLocalArray<LineupAssignment>(WEEKLY_LINEUPS_STORAGE_KEY).filter((row) => row.event_key === eventKey), [eventKey])
  const availabilityRows = useMemo(() => readLocalArray<WeeklyAvailability>(WEEKLY_AVAILABILITY_STORAGE_KEY).filter((row) => row.event_key === eventKey), [eventKey])
  const responseRows = useMemo(() => readLocalArray<WeeklyResponse>(WEEKLY_RESPONSES_STORAGE_KEY).filter((row) => row.event_key === eventKey), [eventKey])
  const eventDetail = useMemo(() => readLocalArray<EventDetail>(WEEKLY_EVENT_DETAILS_STORAGE_KEY).find((row) => row.key === eventKey) ?? null, [eventKey])
  const availabilityReady = availabilityRows.filter((row) => row.status === 'available').length
  const availabilityToClear = availabilityRows.filter((row) => row.status === 'tentative' || row.status === 'no-response').length
  const replyRisk = responseRows.filter((row) => row.status === 'no-response' || row.status === 'running-late' || row.status === 'need-sub').length
  const readinessItems = [lineupRows.length > 0, availabilityRows.length > 0 && availabilityToClear === 0, responseRows.length === 0 || replyRisk === 0, Boolean(eventDetail?.location || eventDetail?.arrivalTime || eventDetail?.notes)]
  const readinessPercent = resolvedDate ? Math.round((readinessItems.filter(Boolean).length / readinessItems.length) * 100) : 0
  const scopedParams = useMemo(
    () => ({ competitionLayer, team, league, flight, date: resolvedDate || '', opponent: resolvedOpponent }),
    [competitionLayer, flight, league, resolvedDate, resolvedOpponent, team],
  )
  const weeklyBriefHref = buildCaptainScopedHref('/captain/weekly-brief', scopedParams)
  const availabilityHref = buildCaptainScopedHref('/captain/availability', scopedParams)
  const lineupHref = buildCaptainScopedHref('/captain/lineup-builder', scopedParams)
  const lineupProjectionHref = buildCaptainScopedHref('/captain/lineup-projection', scopedParams)
  const opponentTeamHref = resolvedOpponent ? `/teams/${encodeURIComponent(resolvedOpponent)}` : '/teams'

  useEffect(() => {
    if (!team || !authResolved || !access.canUseCaptainWorkflow) return
    writeCaptainResumeState({
      competitionLayer: competitionLayer || undefined, team, league: league || undefined, flight: flight || undefined,
      eventDate: resolvedDate || undefined, opponentTeam: resolvedOpponent || undefined,
      lastTool: 'season-dashboard', lastToolLabel: 'Captain Season',
      lastHref: buildCaptainScopedHref('/captain/season-dashboard', scopedParams),
    })
  }, [access.canUseCaptainWorkflow, authResolved, competitionLayer, flight, league, resolvedDate, resolvedOpponent, scopedParams, team])

  if (!authResolved) return <main style={pageStyle}><section style={surfaceStyle}><p style={mutedStyle}>Checking Captain access…</p></section></main>
  if (!access.canUseCaptainWorkflow) {
    return <LockedPlanPage active="/captain" withinShell planId="captain" headline="Want your team season and match week in one place?" body="Unlock Captain to keep the season context, availability, lineup, and team plan connected." ctaLabel="Unlock Captain" secondaryLabel="Back to Captain" secondaryHref="/captain" />
  }
  if (!team) {
    return <main style={pageStyle}><section style={surfaceStyle}><p style={eyebrowStyle}>Captain season</p><h1 style={titleStyle}>Choose your team first.</h1><p style={mutedStyle}>Open Captain to set the team, league, and flight you want to manage.</p><Link href="/captain" style={primaryLinkStyle}>Open Captain</Link></section></main>
  }

  return (
    <main style={pageStyle}>
      <div style={contentStyle}>
        <section style={heroStyle}>
          <p style={eyebrowStyle}>Captain season</p><h1 style={titleStyle}>{team}</h1>
          <p style={mutedStyle}>{[league, flight].filter(Boolean).join(' · ') || 'Your saved team context'}</p>
          {loadError ? <p style={errorStyle}>{loadError}</p> : null}
          <div style={metricGridStyle}>
            <Metric label="Season matches" value={matchCount === null ? 'Loading' : String(matchCount)} detail="Canonical matches in this scope" />
            <Metric label="Reported record" value={seasonResults.length ? `${seasonWins}-${seasonLosses}` : 'No results'} detail={seasonResults.length ? `${seasonResults.length} reported team results` : 'Reported results appear here as they arrive'} />
            <Metric label="Next match" value={resolvedDate ? formatDate(resolvedDate) : 'Not scheduled'} detail={resolvedOpponent ? `vs ${resolvedOpponent}` : 'No opponent in the current record'} />
            <Metric label="Match Week" value={resolvedDate ? `${readinessPercent}% ready` : 'Open'} detail={resolvedDate ? 'Based on your saved team plan' : 'Choose a match to begin'} />
          </div>
        </section>
        <section style={surfaceStyle} aria-label="Recent season results">
          <div style={sectionHeaderStyle}><div><p style={eyebrowStyle}>Season form</p><h2 style={sectionTitleStyle}>Recent team results</h2>{currentStreak ? <p style={metricDetailStyle}>{currentStreak}</p> : null}</div>{currentForm.length ? <div style={formStyle} aria-label={`Recent form: ${currentForm.join(', ')}`}>{currentForm.map((result, index) => <span key={`${result}-${index}`} style={result === 'W' ? winMarkStyle : lossMarkStyle}>{result}</span>)}</div> : null}</div>
          {seasonResults.length ? <div style={resultListStyle}>{recentResultRows.map(({ match, won }) => <div key={match.id} style={resultRowStyle}><span style={won ? winMarkStyle : lossMarkStyle}>{won ? 'W' : 'L'}</span><div style={resultCopyStyle}><strong style={resultOpponentStyle}>vs {getOpponent(match, team) || 'Opponent pending'}</strong><span style={metricDetailStyle}>{formatDate(match.match_date)}{match.score ? ` · ${match.score}` : ''}</span></div></div>)}</div> : <p style={mutedStyle}>No reported team results in this saved scope yet. Scheduled and unreported matches stay out of the record.</p>}
        </section>
        <section style={surfaceStyle} aria-label="Opponent snapshot">
          <div style={sectionHeaderStyle}><div><p style={eyebrowStyle}>Opponent snapshot</p><h2 style={sectionTitleStyle}>{resolvedOpponent ? `What ${resolvedOpponent} brings in` : 'What the next opponent brings in'}</h2></div><Link href={opponentTeamHref} style={secondaryLinkStyle}>Open team record</Link></div>
          {hasOpponentRecord ? <div style={impactGridStyle}><Metric label="Reported record" value={`${opponentRecord.wins}-${opponentRecord.losses}`} detail={`${opponentRecord.wins + opponentRecord.losses} completed result${opponentRecord.wins + opponentRecord.losses === 1 ? '' : 's'} in this scope`} /><div style={impactCardStyle}><span style={metricLabelStyle}>Recent form</span><div style={formStyle} aria-label={`${resolvedOpponent} recent form: ${opponentRecord.form.join(', ')}`}>{opponentRecord.form.map((result, index) => <span key={`${result}-${index}`} style={result === 'W' ? winMarkStyle : lossMarkStyle}>{result}</span>)}</div><span style={metricDetailStyle}>Canonical reported results only</span></div></div> : <p style={mutedStyle}>{resolvedOpponent ? `Completed results for ${resolvedOpponent} will appear here as they are connected to this league and flight.` : 'Choose a scheduled match to see the next opponent’s reported form.'}</p>}
        </section>
        <section style={surfaceStyle} aria-label="Roster impact">
          <div style={sectionHeaderStyle}><div><p style={eyebrowStyle}>Roster impact</p><h2 style={sectionTitleStyle}>Who has carried the most match load</h2></div><Link href={lineupProjectionHref} style={secondaryLinkStyle}>Use in lineup</Link></div>
          {playerImpact.length ? <div style={impactGridStyle}>{playerImpact.map((player) => <div key={player.id} style={impactCardStyle}><strong style={resultOpponentStyle}>{player.name}</strong><span style={metricValueStyle}>{player.wins}-{player.losses}</span><span style={metricDetailStyle}>{player.appearances} reported appearances</span></div>)}</div> : <p style={mutedStyle}>Player links are still being completed for this team’s reported results. Team results remain available above.</p>}
        </section>
        <section style={surfaceStyle} aria-label="Match Week readiness">
          <div style={sectionHeaderStyle}><div><p style={eyebrowStyle}>Next up</p><h2 style={sectionTitleStyle}>{resolvedOpponent ? `Prepare for ${resolvedOpponent}` : 'Prepare your next match week'}</h2></div><Link href={weeklyBriefHref} style={secondaryLinkStyle}>Open Match Week</Link></div>
          <div style={readinessGridStyle}>
            <ReadinessItem label="Lineup" value={lineupRows.length ? `${lineupRows.length} courts set` : 'Not built'} detail={lineupRows.length ? 'Court assignments saved' : 'Build the lineup first'} ready={lineupRows.length > 0} />
            <ReadinessItem label="Availability" value={availabilityRows.length ? `${availabilityReady} in` : 'Not collected'} detail={availabilityToClear ? `${availabilityToClear} still to clear` : availabilityRows.length ? 'No saved reply gaps' : 'Ask the roster'} ready={availabilityRows.length > 0 && availabilityToClear === 0} />
            <ReadinessItem label="Team replies" value={responseRows.length ? `${responseRows.length} tracked` : 'Not sent'} detail={replyRisk ? `${replyRisk} need follow-up` : responseRows.length ? 'No saved reply risks' : 'Send the plan when ready'} ready={responseRows.length > 0 && replyRisk === 0} />
            <ReadinessItem label="Match details" value={eventDetail?.location || eventDetail?.arrivalTime ? 'Saved' : 'Missing'} detail={eventDetail?.arrivalTime ? `Arrive by ${eventDetail.arrivalTime}` : eventDetail?.location ? eventDetail.location : 'Add location or arrival time'} ready={Boolean(eventDetail?.location || eventDetail?.arrivalTime || eventDetail?.notes)} />
          </div>
          <div style={actionRowStyle}><Link href={lineupHref} style={primaryLinkStyle}>{lineupRows.length ? 'Review lineup' : 'Build lineup'}</Link><Link href={lineupProjectionHref} style={secondaryLinkStyle}>Compare lineups</Link><Link href={availabilityHref} style={secondaryLinkStyle}>{availabilityRows.length ? 'Review availability' : 'Collect availability'}</Link></div>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div style={metricStyle}><span style={metricLabelStyle}>{label}</span><strong style={metricValueStyle}>{value}</strong><span style={metricDetailStyle}>{detail}</span></div> }
function ReadinessItem({ label, value, detail, ready }: { label: string; value: string; detail: string; ready: boolean }) { return <div style={readinessItemStyle}><span style={{ ...statusDotStyle, background: ready ? 'var(--brand-lime)' : 'var(--shell-copy-muted)' }} /><span style={metricLabelStyle}>{label}</span><strong style={readinessValueStyle}>{value}</strong><span style={metricDetailStyle}>{detail}</span></div> }

const pageStyle: CSSProperties = { width: 'min(100% - 32px, 1100px)', margin: '0 auto', padding: '28px 0 64px', minWidth: 0 }
const contentStyle: CSSProperties = { display: 'grid', gap: 16, minWidth: 0 }
const surfaceStyle: CSSProperties = { display: 'grid', gap: 18, padding: 'clamp(20px, 4vw, 32px)', borderRadius: 28, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg-strong)', minWidth: 0 }
const heroStyle: CSSProperties = { ...surfaceStyle, background: 'linear-gradient(135deg, rgba(37, 152, 255, .14), var(--shell-panel-bg-strong) 50%, rgba(177, 255, 0, .08))' }
const eyebrowStyle: CSSProperties = { margin: 0, color: 'var(--brand-blue-2)', fontWeight: 900, fontSize: '.78rem', letterSpacing: '.12em', textTransform: 'uppercase' }
const titleStyle: CSSProperties = { margin: 0, color: 'var(--foreground-strong)', fontSize: 'clamp(2.25rem, 7vw, 4.5rem)', lineHeight: .98, overflowWrap: 'anywhere' }
const sectionTitleStyle: CSSProperties = { margin: '6px 0 0', color: 'var(--foreground-strong)', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.05 }
const mutedStyle: CSSProperties = { margin: 0, color: 'var(--shell-copy-muted)', lineHeight: 1.5 }
const errorStyle: CSSProperties = { ...mutedStyle, color: 'var(--brand-lime)' }
const metricGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 10 }
const metricStyle: CSSProperties = { display: 'grid', gap: 7, minWidth: 0, padding: 16, borderRadius: 18, border: '1px solid var(--shell-panel-border)', background: 'rgba(3, 20, 40, .38)' }
const metricLabelStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: '.76rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }
const metricValueStyle: CSSProperties = { color: 'var(--foreground-strong)', fontSize: 'clamp(1.2rem, 4vw, 1.75rem)', lineHeight: 1.1, overflowWrap: 'anywhere' }
const metricDetailStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: '.9rem', lineHeight: 1.35, overflowWrap: 'anywhere' }
const sectionHeaderStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }
const readinessGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 10 }
const readinessItemStyle: CSSProperties = { ...metricStyle, gridTemplateColumns: 'auto 1fr', columnGap: 9, alignItems: 'center' }
const readinessValueStyle: CSSProperties = { ...metricValueStyle, gridColumn: '1 / -1' }
const statusDotStyle: CSSProperties = { width: 8, height: 8, borderRadius: 999 }
const formStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 }
const winMarkStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 32, padding: '0 9px', borderRadius: 999, background: 'rgba(177, 255, 0, .18)', border: '1px solid rgba(177, 255, 0, .46)', color: 'var(--brand-lime)', fontWeight: 900 }
const lossMarkStyle: CSSProperties = { ...winMarkStyle, background: 'rgba(255, 112, 136, .12)', border: '1px solid rgba(255, 112, 136, .28)', color: '#ff9aac' }
const resultListStyle: CSSProperties = { display: 'grid', gap: 8 }
const resultRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'rgba(3, 20, 40, .28)', minWidth: 0 }
const resultCopyStyle: CSSProperties = { display: 'grid', gap: 4, minWidth: 0 }
const resultOpponentStyle: CSSProperties = { color: 'var(--foreground-strong)', overflowWrap: 'anywhere' }
const impactGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 10 }
const impactCardStyle: CSSProperties = { ...metricStyle, background: 'rgba(3, 20, 40, .28)' }
const actionRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10 }
const primaryLinkStyle: CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '12px 16px', borderRadius: 999, background: 'var(--brand-lime)', color: '#071526', textDecoration: 'none', fontWeight: 900 }
const secondaryLinkStyle: CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '12px 16px', borderRadius: 999, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', color: 'var(--foreground-strong)', textDecoration: 'none', fontWeight: 900 }
