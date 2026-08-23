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

type MatchRow = { id: string; match_date: string | null; home_team: string | null; away_team: string | null }
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
    let upcomingQuery = supabase.from('matches').select('id, match_date, home_team, away_team')
      .or(`home_team.eq."${escapedTeam}",away_team.eq."${escapedTeam}"`).is('line_number', null)
      .gte('match_date', new Date().toISOString().slice(0, 10)).order('match_date', { ascending: true }).limit(1)
    if (league) { inventoryQuery = inventoryQuery.eq('league_name', league); upcomingQuery = upcomingQuery.eq('league_name', league) }
    if (flight) { inventoryQuery = inventoryQuery.eq('flight', flight); upcomingQuery = upcomingQuery.eq('flight', flight) }

    void Promise.all([inventoryQuery, upcomingQuery]).then(([inventory, upcoming]) => {
      if (!active) return
      const error = inventory.error || upcoming.error
      if (error) {
        setLoadError('Season data is temporarily unavailable. Try again shortly.')
        setMatchCount(null)
        setNextMatch(null)
        return
      }
      setLoadError('')
      setMatchCount(inventory.count ?? 0)
      setNextMatch((upcoming.data?.[0] as MatchRow | undefined) ?? null)
    })
    return () => { active = false }
  }, [access.canUseCaptainWorkflow, authResolved, flight, league, role, team])

  const resolvedDate = nextMatch?.match_date || initialDate
  const resolvedOpponent = getOpponent(nextMatch, team) || initialOpponent
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
            <Metric label="Next match" value={resolvedDate ? formatDate(resolvedDate) : 'Not scheduled'} detail={resolvedOpponent ? `vs ${resolvedOpponent}` : 'No opponent in the current record'} />
            <Metric label="Match Week" value={resolvedDate ? `${readinessPercent}% ready` : 'Open'} detail={resolvedDate ? 'Based on your saved team plan' : 'Choose a match to begin'} />
          </div>
        </section>
        <section style={surfaceStyle} aria-label="Match Week readiness">
          <div style={sectionHeaderStyle}><div><p style={eyebrowStyle}>Next up</p><h2 style={sectionTitleStyle}>{resolvedOpponent ? `Prepare for ${resolvedOpponent}` : 'Prepare your next match week'}</h2></div><Link href={weeklyBriefHref} style={secondaryLinkStyle}>Open Match Week</Link></div>
          <div style={readinessGridStyle}>
            <ReadinessItem label="Lineup" value={lineupRows.length ? `${lineupRows.length} courts set` : 'Not built'} detail={lineupRows.length ? 'Court assignments saved' : 'Build the lineup first'} ready={lineupRows.length > 0} />
            <ReadinessItem label="Availability" value={availabilityRows.length ? `${availabilityReady} in` : 'Not collected'} detail={availabilityToClear ? `${availabilityToClear} still to clear` : availabilityRows.length ? 'No saved reply gaps' : 'Ask the roster'} ready={availabilityRows.length > 0 && availabilityToClear === 0} />
            <ReadinessItem label="Team replies" value={responseRows.length ? `${responseRows.length} tracked` : 'Not sent'} detail={replyRisk ? `${replyRisk} need follow-up` : responseRows.length ? 'No saved reply risks' : 'Send the plan when ready'} ready={responseRows.length > 0 && replyRisk === 0} />
            <ReadinessItem label="Match details" value={eventDetail?.location || eventDetail?.arrivalTime ? 'Saved' : 'Missing'} detail={eventDetail?.arrivalTime ? `Arrive by ${eventDetail.arrivalTime}` : eventDetail?.location ? eventDetail.location : 'Add location or arrival time'} ready={Boolean(eventDetail?.location || eventDetail?.arrivalTime || eventDetail?.notes)} />
          </div>
          <div style={actionRowStyle}><Link href={lineupHref} style={primaryLinkStyle}>{lineupRows.length ? 'Review lineup' : 'Build lineup'}</Link><Link href={availabilityHref} style={secondaryLinkStyle}>{availabilityRows.length ? 'Review availability' : 'Collect availability'}</Link></div>
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
const actionRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10 }
const primaryLinkStyle: CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '12px 16px', borderRadius: 999, background: 'var(--brand-lime)', color: '#071526', textDecoration: 'none', fontWeight: 900 }
const secondaryLinkStyle: CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '12px 16px', borderRadius: 999, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', color: 'var(--foreground-strong)', textDecoration: 'none', fontWeight: 900 }
