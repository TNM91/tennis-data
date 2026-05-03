'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CSSProperties, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'
import FollowButton from '@/app/components/follow-button'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import {
  getCompetitionLayerLabel,
  getLeagueFormatLabel,
  inferCompetitionLayerFromValues,
  inferLeagueFormatFromValues,
  type LeagueFormat,
} from '@/lib/competition-layers'
import { formatDate, cleanText } from '@/lib/captain-formatters'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type LeagueMatchRow = {
  id: string
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  match_type: 'singles' | 'doubles' | null
  score: string | null
  winner_side: 'A' | 'B' | null
  status: string | null
}

type TeamSummary = {
  name: string
  matches: number
  completedMatches: number
  scheduledMatches: number
  missingScorecards: number
  homeMatches: number
  awayMatches: number
  wins: number
  losses: number
  latestMatchDate: string | null
  winPct: number
}

type LeagueScopeDiagnostic = {
  totalRows: number
  leagueNames: string[]
}

function normalizeCompareText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function buildTeamHref(teamName: string, leagueName: string, flight: string, competitionLayer: string) {
  const params = new URLSearchParams()

  if (competitionLayer) params.set('layer', competitionLayer)
  if (leagueName) params.set('league', leagueName)
  if (flight) params.set('flight', flight)

  const query = params.toString()
  return `/teams/${encodeURIComponent(teamName)}${query ? `?${query}` : ''}`
}

function buildLeagueScopeHref(leagueName: string, flight: string, section: string, district: string) {
  const params = new URLSearchParams()

  if (leagueName) params.set('league', leagueName)
  if (flight) params.set('flight', flight)
  if (section) params.set('section', section)
  if (district) params.set('district', district)

  const query = params.toString()
  return `/leagues/${encodeURIComponent(leagueName || 'league')}${query ? `?${query}` : ''}`
}

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

export default function LeagueDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const routeLayer = getParamValue(params.layer as string | string[] | undefined)
  const leagueFromRoute = decodeURIComponent(getParamValue(params.league as string | string[] | undefined))
  const flight = searchParams.get('flight') || ''
  const section = searchParams.get('section') || ''
  const district = searchParams.get('district') || ''
  const formatHint = searchParams.get('format') || ''

  const [rows, setRows] = useState<LeagueMatchRow[]>([])
  const [nearbyRows, setNearbyRows] = useState<LeagueMatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')
  const [standingsView, setStandingsView] = useState<'cards' | 'table'>('cards')
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  const loadLeagueMatches = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      let query = supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          usta_section,
          district_area,
          home_team,
          away_team,
          match_date,
          match_type,
          score,
          winner_side,
          status
        `)
        .eq('league_name', leagueFromRoute)
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .limit(200)

      if (flight) query = query.eq('flight', flight)
      if (section) query = query.eq('usta_section', section)
      if (district) query = query.eq('district_area', district)

      const { data, error } = await query

      if (error) throw new Error(error.message)

      const exactRows = (data || []) as LeagueMatchRow[]
      setRows(exactRows)

      if (exactRows.length === 0 && (flight || section || district)) {
        let fallbackQuery = supabase
          .from('matches')
          .select(`
            id,
            league_name,
            flight,
            usta_section,
            district_area,
            home_team,
            away_team,
            match_date,
            match_type,
            score,
            winner_side,
            status
          `)
          .is('line_number', null)
          .order('match_date', { ascending: false })
          .limit(200)

        if (flight) fallbackQuery = fallbackQuery.eq('flight', flight)
        if (section) fallbackQuery = fallbackQuery.eq('usta_section', section)
        if (district) fallbackQuery = fallbackQuery.eq('district_area', district)

        const { data: fallbackData, error: fallbackError } = await fallbackQuery
        if (fallbackError) throw new Error(fallbackError.message)
        setNearbyRows((fallbackData || []) as LeagueMatchRow[])
      } else {
        setNearbyRows([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load league.')
    } finally {
      setLoading(false)
    }
  }, [district, flight, leagueFromRoute, section])

  useEffect(() => {
    void loadLeagueMatches()
  }, [loadLeagueMatches])

  const validRows = useMemo(() => {
    return rows.filter((row) => {
      const home = cleanText(row.home_team)
      const away = cleanText(row.away_team)
      return Boolean(home && away)
    })
  }, [rows])

  const nearbyScopeDiagnostic = useMemo<LeagueScopeDiagnostic | null>(() => {
    if (validRows.length > 0 || nearbyRows.length === 0) return null

    const leagueNames = Array.from(
      new Set(
        nearbyRows
          .map((row) => cleanText(row.league_name))
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => {
      const route = normalizeCompareText(leagueFromRoute)
      const aMatches = normalizeCompareText(a).includes(route) ? 1 : 0
      const bMatches = normalizeCompareText(b).includes(route) ? 1 : 0
      if (aMatches !== bMatches) return bMatches - aMatches
      return a.localeCompare(b)
    })

    return {
      totalRows: nearbyRows.length,
      leagueNames,
    }
  }, [validRows.length, nearbyRows, leagueFromRoute])

  const leagueInfo = useMemo(() => {
    if (!validRows.length) {
      return {
        leagueName: leagueFromRoute || '',
        flight: flight || '',
        section: section || '',
        district: district || '',
      }
    }

    const first = validRows[0]

    return {
      leagueName: cleanText(first.league_name) || leagueFromRoute || '',
      flight: cleanText(first.flight) || flight || '',
      section: cleanText(first.usta_section) || section || '',
      district: cleanText(first.district_area) || district || '',
    }
  }, [validRows, leagueFromRoute, flight, section, district])

  const teamSummaries = useMemo<TeamSummary[]>(() => {
    const map = new Map<string, Omit<TeamSummary, 'winPct'>>()

    for (const row of validRows) {
      const homeTeam = cleanText(row.home_team)
      const awayTeam = cleanText(row.away_team)
      if (!homeTeam || !awayTeam) continue

      if (!map.has(homeTeam)) {
        map.set(homeTeam, {
          name: homeTeam,
          matches: 0,
          completedMatches: 0,
          scheduledMatches: 0,
          missingScorecards: 0,
          homeMatches: 0,
          awayMatches: 0,
          wins: 0,
          losses: 0,
          latestMatchDate: null,
        })
      }

      if (!map.has(awayTeam)) {
        map.set(awayTeam, {
          name: awayTeam,
          matches: 0,
          completedMatches: 0,
          scheduledMatches: 0,
          missingScorecards: 0,
          homeMatches: 0,
          awayMatches: 0,
          wins: 0,
          losses: 0,
          latestMatchDate: null,
        })
      }

      const home = map.get(homeTeam)!
      const away = map.get(awayTeam)!

      home.matches += 1
      home.homeMatches += 1
      away.matches += 1
      away.awayMatches += 1

      const isCompleted = Boolean(row.winner_side || cleanText(row.score) || row.status === 'completed')
      if (isCompleted) {
        home.completedMatches += 1
        away.completedMatches += 1
      } else {
        const isMissingScorecard = row.match_date ? new Date(row.match_date).getTime() <= Date.now() : false
        home.scheduledMatches += 1
        away.scheduledMatches += 1
        if (isMissingScorecard) {
          home.missingScorecards += 1
          away.missingScorecards += 1
        }
      }

      if (row.winner_side === 'A') {
        home.wins += 1
        away.losses += 1
      } else if (row.winner_side === 'B') {
        away.wins += 1
        home.losses += 1
      }

      for (const team of [home, away]) {
        if (
          row.match_date &&
          (!team.latestMatchDate ||
            new Date(row.match_date).getTime() > new Date(team.latestMatchDate).getTime())
        ) {
          team.latestMatchDate = row.match_date
        }
      }
    }

    return [...map.values()]
      .map((team) => ({
        ...team,
        winPct: team.completedMatches > 0 ? team.wins / team.completedMatches : 0,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        if (b.winPct !== a.winPct) return b.winPct - a.winPct
        if (a.losses !== b.losses) return a.losses - b.losses
        return a.name.localeCompare(b.name)
      })
  }, [validRows])

  const filteredMatches = useMemo(() => {
    if (teamFilter === 'all') return validRows

    return validRows.filter((row) => {
      const home = cleanText(row.home_team)
      const away = cleanText(row.away_team)
      return home === teamFilter || away === teamFilter
    })
  }, [validRows, teamFilter])
  const hasActiveTeamFilter = teamFilter !== 'all'

  const stats = useMemo(() => {
    const singles = validRows.filter((row) => row.match_type === 'singles').length
    const doubles = validRows.filter((row) => row.match_type === 'doubles').length
    const teams = teamSummaries.length
    const latest = validRows[0]?.match_date || null
    const withScores = validRows.filter((row) => row.score && row.score.trim()).length
    const decided = validRows.filter((row) => row.winner_side).length
    const completed = validRows.filter((row) => row.winner_side || cleanText(row.score) || row.status === 'completed').length
    const scheduled = validRows.length - completed
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const missingScorecards = validRows.filter((row) => {
      if (row.winner_side || cleanText(row.score) || row.status === 'completed') return false
      return row.match_date ? new Date(row.match_date).getTime() <= startOfToday : false
    }).length

    return {
      matchCount: validRows.length,
      singles,
      doubles,
      teams,
      latest,
      withScores,
      decided,
      completed,
      scheduled,
      missingScorecards,
    }
  }, [validRows, teamSummaries])

  const [topPerformers, setTopPerformers] = useState<Array<{ id: string; name: string; wins: number; losses: number; appearances: number }>>([])

  useEffect(() => {
    if (rows.length === 0) return
    const matchIds = rows.map((r) => r.id)
    const CHUNK = 200
    const chunks: string[][] = []
    for (let i = 0; i < matchIds.length; i += CHUNK) chunks.push(matchIds.slice(i, i + CHUNK))
    void (async () => {
      const all: Array<{ match_id: string; side: string; player_id: string; players: { id: string; name: string } | null }> = []
      const matchWinnerMap = new Map(rows.map((r) => [r.id, r.winner_side]))
      for (const chunk of chunks) {
        const { data } = await supabase
          .from('match_players')
          .select('match_id, side, player_id, players(id, name)')
          .in('match_id', chunk)
        if (data) all.push(...(data as unknown as typeof all))
      }
      const map = new Map<string, { id: string; name: string; wins: number; losses: number; appearances: number }>()
      for (const row of all) {
        const playerData = Array.isArray(row.players) ? row.players[0] : row.players
        if (!playerData?.id || !playerData?.name) continue
        const winner = matchWinnerMap.get(row.match_id)
        const existing = map.get(playerData.id) ?? { id: playerData.id, name: playerData.name, wins: 0, losses: 0, appearances: 0 }
        existing.appearances++
        if (winner === row.side) existing.wins++
        else if (winner && winner !== row.side) existing.losses++
        map.set(playerData.id, existing)
      }
      setTopPerformers(
        [...map.values()]
          .filter((p) => p.appearances >= 2)
          .sort((a, b) => b.wins - a.wins || b.appearances - a.appearances)
          .slice(0, 8)
      )
    })()
  }, [rows])

  const matchQualityStats = useMemo(() => {
    let dominant = 0   // has a 6-0 set
    let tiebreak = 0   // has a 7-6 set
    let threeSets = 0  // 3 sets played
    let missingScore = 0
    for (const row of validRows) {
      const s = (row.score || '').trim()
      if (!s) { missingScore++; continue }
      const sets = s.split(/[;,|]/).map((t) => t.trim()).filter(Boolean)
      if (sets.length >= 3) threeSets++
      for (const set of sets) {
        if (/^6-0$|^0-6$/.test(set)) { dominant++; break }
        if (/^7-6$|^6-7$/.test(set)) { tiebreak++; break }
      }
    }
    const total = validRows.length
    return { dominant, tiebreak, threeSets, missingScore, total }
  }, [validRows])

  const leagueLeader = teamSummaries[0] ?? null

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.95fr) minmax(300px, 1.05fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '60px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '560px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '560px',
  }

  const dynamicSeasonToolsCard: CSSProperties = {
    ...seasonToolsCard,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicMetricGrid: CSSProperties = {
    ...metricGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(5, minmax(0, 1fr))',
  }

  const dynamicSectionHead: CSSProperties = {
    ...sectionHead,
    alignItems: isMobile ? 'flex-start' : 'flex-end',
  }

  const dynamicTeamGrid: CSSProperties = {
    ...teamGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
  }

  const dynamicTeamTop: CSSProperties = {
    ...teamTop,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'flex-start',
  }

  const dynamicMiniGrid: CSSProperties = {
    ...miniGrid,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicMatchTop: CSSProperties = {
    ...matchTop,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'flex-start',
  }

  const dynamicHeroActions: CSSProperties = {
    ...heroActions,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
  }

  const dynamicStateActionRow: CSSProperties = {
    ...stateActionRow,
    justifyContent: isMobile ? 'flex-start' : 'center',
    alignItems: isMobile ? 'stretch' : 'center',
  }

  const dynamicFilterWrap: CSSProperties = {
    ...filterWrap,
    width: isMobile ? '100%' : '260px',
  }

  const dynamicMatchBottom: CSSProperties = {
    ...matchBottom,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
  }

  const subtitleParts = [leagueInfo.flight, leagueInfo.section, leagueInfo.district].filter(Boolean)
  const competitionLayer = inferCompetitionLayerFromValues({
    layerHint: routeLayer,
    leagueName: leagueInfo.leagueName,
    ustaSection: leagueInfo.section,
    districtArea: leagueInfo.district,
  })
  const leagueFormat: LeagueFormat =
    formatHint === 'team' || formatHint === 'individual'
      ? formatHint
      : inferLeagueFormatFromValues({
          competitionLayer,
          leagueName: leagueInfo.leagueName,
          teamCount: teamSummaries.length,
        })
  const stableLeagueFollowId = [leagueInfo.leagueName || leagueFromRoute, leagueInfo.flight, leagueInfo.section, leagueInfo.district]
    .map((value) => cleanText(value) || '')
    .join('__')
  const leagueSignals = [
    {
      label: competitionLayer === 'usta' ? 'Official layer' : 'Strategic layer',
      value: getCompetitionLayerLabel(competitionLayer),
      note:
        competitionLayer === 'usta'
          ? 'Find your league, track your team, and see which results are in.'
          : 'Prepare for your next match with team context, lineup tools, and results in one place.',
    },
    {
      label: 'League format',
      value: getLeagueFormatLabel(leagueFormat),
      note:
        leagueFormat === 'team'
          ? 'Track teams, schedules, completed results, and missing scorecards.'
          : 'Track players, match results, and upcoming competition context.',
    },
    {
      label: 'Season activity',
      value: `${stats.matchCount} matches`,
      note: `Track ${stats.teams} active ${leagueFormat === 'team' ? 'teams' : 'players'} and prepare for the next match.`,
    },
  ]
  const competeHref = buildCaptainScopedHref('/compete/leagues', {
    competitionLayer,
    league: leagueInfo.leagueName,
    flight: leagueInfo.flight,
  })
  const captainActionLinks =
    leagueFormat === 'team'
      ? [
          {
            href: buildCaptainScopedHref('/captain/availability', {
              competitionLayer,
              league: leagueInfo.leagueName,
              flight: leagueInfo.flight,
            }),
            label: 'Availability',
          },
          {
            href: buildCaptainScopedHref('/captain/lineup-builder', {
              competitionLayer,
              league: leagueInfo.leagueName,
              flight: leagueInfo.flight,
            }),
            label: 'Lineup Builder',
          },
          {
            href: buildCaptainScopedHref('/captain/scenario-builder', {
              competitionLayer,
              league: leagueInfo.leagueName,
              flight: leagueInfo.flight,
            }),
            label: 'Scenario Builder',
          },
          {
            href: buildCaptainScopedHref('/captain/messaging', {
              competitionLayer,
              league: leagueInfo.leagueName,
              flight: leagueInfo.flight,
            }),
            label: 'Messaging',
          },
        ]
      : []

  return (
    <SiteShell active="/leagues">
      <section style={pageContent}>
        <section style={dynamicHeroShell}>
          <div>
            <div style={eyebrow}>League Season</div>
            <h1 style={dynamicHeroTitle}>{leagueInfo.leagueName || 'League Season'}</h1>
            <div style={heroMetaRow}>
              <span style={competitionLayer === 'usta' ? heroMetaBluePill : heroMetaGreenPill}>
                {getCompetitionLayerLabel(competitionLayer)}
              </span>
              <span style={heroMetaSlatePill}>{getLeagueFormatLabel(leagueFormat)}</span>
            </div>
            {subtitleParts.length > 0 ? (
              <p style={dynamicHeroText}>{subtitleParts.join(' | ')}</p>
            ) : null}

            <div style={heroHintRow}>
              <span style={heroHintPill}>{stats.matchCount} matches</span>
              <span style={heroHintPill}>{stats.teams} teams</span>
              <span style={heroHintPill}>Latest: {formatDate(stats.latest)}</span>
            </div>

            <div style={dynamicHeroActions}>
              <FollowButton
                entityType="league"
                entityId={stableLeagueFollowId}
                entityName={leagueInfo.leagueName || leagueFromRoute || 'League'}
                subtitle={subtitleParts.join(' · ')}
              />
              <GhostLink href="/leagues">Back to Leagues</GhostLink>
              <GhostLink href={competeHref}>Open Compete</GhostLink>
            </div>
          </div>

          <div style={dynamicSeasonToolsCard}>
            <div style={seasonToolsLabel}>Season tools</div>
            <div style={seasonToolsValue}>
              {leagueInfo.flight || getCompetitionLayerLabel(competitionLayer)}
            </div>
            <div style={seasonToolsText}>
              {competitionLayer === 'usta'
                ? 'Find your league, track your team, and see which scorecards are still missing.'
                : 'Use this league context to build lineups, compare options, and message your team.'}
            </div>

            <div style={seasonToolsActions}>
              {leagueInfo.section ? <span style={miniPillSlate}>{leagueInfo.section}</span> : null}
              {leagueInfo.district ? <span style={miniPillGreen}>{leagueInfo.district}</span> : null}
            </div>
            {captainActionLinks.length > 0 ? (
              <div style={seasonToolsQuickActionGrid}>
                {captainActionLinks.map((action) => (
                  <Link key={action.href} href={action.href} style={seasonQuickActionButton}>
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <div style={dynamicMetricGrid}>
          <MetricCard label="Completed" value={String(stats.completed)} />
          <MetricCard label="Scheduled" value={String(stats.scheduled)} />
          <MetricCard label="Missing scorecards" value={String(stats.missingScorecards)} />
          <MetricCard label="Teams" value={String(stats.teams)} />
          <MetricCard label="Latest Match" value={formatDate(stats.latest)} accent />
        </div>

        {matchQualityStats.total > 0 ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginTop: 16 }}>
            {[
              { label: 'Dominant (6-0 set)', count: matchQualityStats.dominant, color: '#d9f84a', bg: 'rgba(155,225,29,0.10)', border: 'rgba(155,225,29,0.20)' },
              { label: 'Tiebreak (7-6 set)', count: matchQualityStats.tiebreak, color: '#fed7aa', bg: 'rgba(251,146,60,0.10)', border: 'rgba(251,146,60,0.20)' },
              { label: '3-set battles', count: matchQualityStats.threeSets, color: '#93c5fd', bg: 'rgba(116,190,255,0.10)', border: 'rgba(116,190,255,0.20)' },
              { label: 'Missing scores', count: matchQualityStats.missingScore, color: matchQualityStats.missingScore > 0 ? '#fca5a5' : 'var(--shell-copy-muted)', bg: matchQualityStats.missingScore > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: matchQualityStats.missingScore > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.08)' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, background: item.bg, border: `1px solid ${item.border}` }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: item.color }}>{item.count}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--shell-copy-muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <section style={signalGridStyle(isSmallMobile)}>
          {leagueSignals.map((signal) => (
            <article key={signal.label} style={signalCardStyle}>
              <div style={signalLabelStyle}>{signal.label}</div>
              <div style={signalValueStyle}>{signal.value}</div>
              <div style={signalNoteStyle}>{signal.note}</div>
            </article>
          ))}
        </section>

        <article
          style={{
            ...panelCard,
            marginTop: '18px',
          }}
        >
          <div style={sectionKicker}>Season context</div>
          <h2 style={sectionTitle}>Find your league. Track your team. Prepare for the next match.</h2>
          <div style={sectionSub}>
            Use this page to see completed results, scheduled matches, missing scorecards, and the teams that matter.
            Captains can jump into lineup, scenario, availability, and messaging tools when they need to act.
          </div>
          <div style={dynamicStateActionRow}>
            <GhostLink href="/leagues">Back to leagues</GhostLink>
            <GhostLink href="/advertising-disclosure">Advertising disclosure</GhostLink>
          </div>
        </article>

        <article style={panelCard}>
          {loading ? (
            <div style={stateBox}>Loading season data...</div>
          ) : error ? (
            <div style={errorBox}>{error}</div>
          ) : validRows.length === 0 ? (
            <div style={stateBox}>
              Match data is not available for this league segment yet.
              <div style={stateHelperText}>
                This usually means the season scope exists, but imported match rows do not yet include both team names
                for this exact league, flight, or district slice.
              </div>
              {nearbyScopeDiagnostic ? (
                <div style={{ ...stateHelperText, marginTop: 12 }}>
                  I did find {nearbyScopeDiagnostic.totalRows} nearby rows in the same flight/section/district scope.
                  {nearbyScopeDiagnostic.leagueNames.length > 0
                    ? ` Nearby league names: ${nearbyScopeDiagnostic.leagueNames.slice(0, 5).join(' | ')}`
                    : ' Those rows are also missing a visible league name.'}
                </div>
              ) : null}
              {nearbyScopeDiagnostic && nearbyScopeDiagnostic.leagueNames.length > 0 ? (
                <div style={{ ...stateActionRow, marginTop: 12 }}>
                  {nearbyScopeDiagnostic.leagueNames.slice(0, 3).map((name) => (
                    <GhostLink
                      key={name}
                      href={buildLeagueScopeHref(name, leagueInfo.flight, leagueInfo.section, leagueInfo.district)}
                    >
                      Try {name}
                    </GhostLink>
                  ))}
                </div>
              ) : null}
              <div style={dynamicStateActionRow}>
                <GhostLink href="/leagues">Back to leagues</GhostLink>
                <GhostLink href="/teams">Browse teams</GhostLink>
              </div>
            </div>
          ) : (
            <>
              {topPerformers.length > 0 ? (
                <section style={{ marginBottom: 24 }}>
                  <div style={{ color: '#93c5fd', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 14 }}>Top performers</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    {topPerformers.map((p, i) => {
                      const winPct = p.appearances > 0 ? Math.round((p.wins / p.appearances) * 100) : 0
                      return (
                        <Link key={p.id} href={`/players/${p.id}`} style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, padding: '12px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'rgba(190,210,240,0.4)', fontSize: 11, fontWeight: 800 }}>#{i + 1}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: winPct >= 60 ? 'rgba(155,225,29,0.10)' : 'rgba(255,255,255,0.04)', color: winPct >= 60 ? '#d9f84a' : 'var(--shell-copy-muted)', border: `1px solid ${winPct >= 60 ? 'rgba(155,225,29,0.18)' : 'rgba(255,255,255,0.08)'}` }}>{winPct}%</span>
                          </div>
                          <div style={{ color: '#f8fbff', fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                          <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12 }}>{p.wins}W–{p.losses}L · {p.appearances} matches</div>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              ) : null}

              <section>
                <div style={dynamicSectionHead}>
                  <div>
                    <div style={sectionKicker}>Team Summary</div>
                    <h2 style={sectionTitle}>Teams</h2>
                    <div style={sectionSub}>
                      Standings-style season snapshot for each team in this league.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {(['cards', 'table'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setStandingsView(v)}
                        style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer', background: standingsView === v ? 'rgba(116,190,255,0.12)' : 'transparent', border: `1px solid ${standingsView === v ? 'rgba(116,190,255,0.28)' : 'rgba(255,255,255,0.10)'}`, color: standingsView === v ? '#bfdbfe' : 'var(--shell-copy-muted)' }}
                      >
                        {v === 'cards' ? 'Cards' : 'Table'}
                      </button>
                    ))}
                  </div>
                </div>

                {standingsView === 'table' ? (
                  <div style={{ overflowX: 'auto', borderRadius: 20, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', marginTop: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: 520 }}>
                      <thead>
                        <tr>
                          {['#', 'Team', 'W', 'L', 'Win %', 'Completed', 'Scheduled', 'Missing scorecards', 'Last match'].map((h) => (
                            <th key={h} style={{ padding: '12px 14px', textAlign: 'left' as const, color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', whiteSpace: 'nowrap' as const }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {teamSummaries.map((team, index) => {
                          const winPct = Math.round(team.winPct * 100)
                          const isLeader = team.name === leagueLeader?.name
                          const tdStyle = { padding: '13px 14px', color: 'var(--foreground)', fontSize: 14, fontWeight: 600, borderTop: '1px solid var(--shell-panel-border)' }
                          return (
                            <tr key={team.name} style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.016)' }}>
                              <td style={{ ...tdStyle, color: 'var(--shell-copy-muted)', fontWeight: 700 }}>#{index + 1}</td>
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Link href={buildTeamHref(team.name, leagueInfo.leagueName, leagueInfo.flight, competitionLayer)} style={{ color: '#93c5fd', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>{team.name}</Link>
                                  {isLeader && team.wins > 0 ? <span style={{ padding: '2px 7px', borderRadius: 999, background: 'rgba(155,225,29,0.10)', border: '1px solid rgba(155,225,29,0.20)', color: '#d9f84a', fontSize: 10, fontWeight: 800 }}>Leader</span> : null}
                                </div>
                              </td>
                              <td style={{ ...tdStyle, color: '#86efac', fontWeight: 800 }}>{team.wins}</td>
                              <td style={{ ...tdStyle, color: '#fca5a5', fontWeight: 800 }}>{team.losses}</td>
                              <td style={tdStyle}>
                                <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: winPct >= 60 ? 'rgba(155,225,29,0.10)' : winPct < 40 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)', color: winPct >= 60 ? '#d9f84a' : winPct < 40 ? '#fca5a5' : 'var(--shell-copy-muted)', border: `1px solid ${winPct >= 60 ? 'rgba(155,225,29,0.20)' : winPct < 40 ? 'rgba(239,68,68,0.16)' : 'rgba(255,255,255,0.08)'}` }}>{winPct}%</span>
                              </td>
                              <td style={{ ...tdStyle, color: 'var(--shell-copy-muted)' }}>{team.completedMatches}</td>
                              <td style={{ ...tdStyle, color: 'var(--shell-copy-muted)' }}>{team.scheduledMatches}</td>
                              <td style={{ ...tdStyle, color: team.missingScorecards > 0 ? '#fca5a5' : 'var(--shell-copy-muted)' }}>{team.missingScorecards}</td>
                              <td style={{ ...tdStyle, color: 'var(--shell-copy-muted)', fontSize: 13 }}>{formatDate(team.latestMatchDate)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {standingsView === 'cards' ? <div style={dynamicTeamGrid}>
                  {teamSummaries.map((team, index) => {
                    const winPct = Math.round(team.winPct * 100)
                    const isLeader = team.name === leagueLeader?.name
                    return (
                    <div key={team.name} style={teamCard}>
                      <div style={cardGlow} />

                      <div style={dynamicTeamTop}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={teamRank}>#{index + 1}</div>
                            {isLeader && team.wins > 0 ? (
                              <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(155,225,29,0.10)', border: '1px solid rgba(155,225,29,0.20)', color: '#d9f84a', fontSize: 11, fontWeight: 800 }}>League leader</span>
                            ) : null}
                          </div>
                          <div style={teamName}>{team.name}</div>
                          <div style={teamRecord}>
                            {team.wins}-{team.losses} record
                            {team.completedMatches > 0 ? ` · ${winPct}% win` : ' · no completed scorecards'}
                          </div>
                        </div>

                        <PrimaryLink href={buildTeamHref(team.name, leagueInfo.leagueName, leagueInfo.flight, competitionLayer)}>
                          Team Page
                        </PrimaryLink>
                      </div>

                      {team.completedMatches > 0 ? (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', borderRadius: 999, overflow: 'hidden', height: 8, background: 'rgba(255,255,255,0.06)', marginBottom: 5 }}>
                            <div style={{ width: `${winPct}%`, background: 'linear-gradient(90deg,rgba(155,225,29,0.7),rgba(74,222,128,0.7))', minWidth: winPct > 0 ? 4 : 0, transition: 'width 400ms ease' }} />
                            <div style={{ flex: 1, background: 'rgba(239,68,68,0.25)' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(155,225,29,0.8)' }}>{winPct}% W</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(239,68,68,0.7)' }}>{100 - winPct}% L</span>
                          </div>
                        </div>
                      ) : null}

                      <div style={dynamicMiniGrid}>
                        <MiniStatCard label="Completed" value={String(team.completedMatches)} />
                        <MiniStatCard label="Scheduled" value={String(team.scheduledMatches)} />
                        <MiniStatCard label="Missing scorecards" value={String(team.missingScorecards)} />
                        <MiniStatCard label="Latest" value={formatDate(team.latestMatchDate)} />
                      </div>
                    </div>
                  )})}
                </div> : null}
              </section>

              <section style={{ marginTop: '24px' }}>
                <div style={dynamicSectionHead}>
                  <div>
                    <div style={sectionKicker}>Season Matches</div>
                    <h2 style={sectionTitle}>Match History</h2>
                    <div style={sectionSub}>
                      Filter the season list by team to narrow the schedule and results.
                    </div>
                  </div>

                  <div style={dynamicFilterWrap}>
                    <label htmlFor="teamFilter" style={inputLabel}>
                      Filter by team
                    </label>
                    <select
                      id="teamFilter"
                      value={teamFilter}
                      onChange={(e) => setTeamFilter(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="all">All Teams</option>
                      {teamSummaries.map((team) => (
                        <option key={team.name} value={team.name}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    {hasActiveTeamFilter ? (
                      <button
                        type="button"
                        onClick={() => setTeamFilter('all')}
                        style={clearFilterButton}
                      >
                        Clear team filter
                      </button>
                    ) : null}
                  </div>
                </div>

                {filteredMatches.length === 0 ? (
                  <div style={stateBox}>
                    No matches matched the selected team filter.
                    <div style={stateHelperText}>
                      Clear the active filter to return to the full season view, or choose another team from the season
                      summary above.
                    </div>
                  </div>
                ) : null}

                <div style={matchList}>
                  {filteredMatches.map((row) => {
                    const home = cleanText(row.home_team)
                    const away = cleanText(row.away_team)
                    if (!home || !away) return null

                    const winner =
                      row.winner_side === 'A'
                        ? home
                        : row.winner_side === 'B'
                          ? away
                          : '—'

                    return (
                      <div key={row.id} style={matchCard}>
                        <div style={dynamicMatchTop}>
                          <div>
                            <div style={matchTitle}>
                              {home} vs {away}
                            </div>
                            <div style={matchMeta}>
                              {formatDate(row.match_date)}
                              {row.match_type ? ` · ${row.match_type}` : ''}
                            </div>
                          </div>

                          <div style={winnerPill}>Winner: {winner}</div>
                        </div>

                        <div style={dynamicMatchBottom}>
                          <div style={scoreText}>{row.score ?? '—'}</div>
                          <div style={subMeta}>
                            {[leagueInfo.flight, leagueInfo.district].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </article>
      </section>
    </SiteShell>
  )
}

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      style={{
        ...metricCard,
        ...(accent ? metricCardAccent : {}),
      }}
    >
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  )
}

function MiniStatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={miniStatCard}>
      <div style={miniStatLabel}>{label}</div>
      <div style={miniStatValue}>{value}</div>
    </div>
  )
}

const pageContent: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '18px 24px 0',
  display: 'grid',
  gap: '18px',
}

const heroShell: CSSProperties = {
  position: 'relative',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '7px 11px',
  borderRadius: '999px',
  color: '#d6e9ff',
  background: 'rgba(74,123,211,0.18)',
  border: '1px solid rgba(130,178,255,0.18)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: '16px 0 0',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: '14px 0 0',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const heroHintRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '16px',
}

const heroMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginTop: '14px',
}

const heroMetaBluePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(74,163,255,0.14)',
  color: '#e2efff',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const heroMetaGreenPill: CSSProperties = {
  ...heroMetaBluePill,
  background: 'rgba(155,225,29,0.14)',
}

const heroMetaSlatePill: CSSProperties = {
  ...heroMetaBluePill,
  background: 'rgba(142, 161, 189, 0.14)',
}

const heroHintPill: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  borderRadius: '999px',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
}

const heroActions: CSSProperties = {
  marginTop: '18px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
}

const seasonToolsCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
}

const seasonToolsLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const seasonToolsValue: CSSProperties = {
  marginTop: '8px',
  color: 'var(--foreground-strong)',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const seasonToolsText: CSSProperties = {
  marginTop: '10px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const seasonToolsActions: CSSProperties = {
  marginTop: '16px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const seasonToolsQuickActionGrid: CSSProperties = {
  marginTop: '18px',
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const seasonQuickActionButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 12px',
  borderRadius: '14px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '13px',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '13px',
}

const miniPillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
}

const miniPillSlate: CSSProperties = {
  ...miniPillBase,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
}

const miniPillGreen: CSSProperties = {
  ...miniPillBase,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const signalGridStyle = (isSmallMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: '14px',
  marginTop: '18px',
})

const signalCardStyle: CSSProperties = {
  borderRadius: '24px',
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
  fontSize: '1.28rem',
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
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const metricCardAccent: CSSProperties = {
  border: '1px solid rgba(111, 236, 168, 0.34)',
  boxShadow: '0 16px 34px rgba(43, 195, 104, 0.14), inset 0 1px 0 rgba(255,255,255,0.08)',
}

const metricLabel: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 750,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const metricValue: CSSProperties = {
  marginTop: '8px',
  color: 'var(--foreground-strong)',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const panelCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const stateBox: CSSProperties = {
  borderRadius: '18px',
  padding: '18px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--foreground)',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 600,
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const errorBox: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.18)',
  color: '#fecaca',
  fontWeight: 700,
  fontSize: '14px',
}

const stateHelperText: CSSProperties = {
  marginTop: '10px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const stateActionRow: CSSProperties = {
  marginTop: '14px',
  display: 'flex',
  justifyContent: 'center',
  gap: '10px',
  flexWrap: 'wrap',
}

const sectionHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const sectionKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
}

const sectionSub: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
  fontWeight: 500,
}

const teamGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const teamCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  boxShadow: '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
}

const cardGlow: CSSProperties = {
  position: 'absolute',
  top: '-70px',
  right: '-50px',
  width: '180px',
  height: '180px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(78,178,255,0.24), rgba(78,178,255,0) 70%)',
  pointerEvents: 'none',
}

const teamTop: CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  marginBottom: '16px',
}

const teamRank: CSSProperties = {
  color: '#8ec5ff',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '8px',
}

const teamName: CSSProperties = {
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const teamRecord: CSSProperties = {
  marginTop: '8px',
  color: '#8ec5ff',
  fontSize: '15px',
  lineHeight: 1.5,
  fontWeight: 800,
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, rgba(103, 241, 154, 1), rgba(40, 205, 110, 0.94))',
  color: '#071622',
  fontWeight: 900,
  fontSize: '13px',
  letterSpacing: '0.01em',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxShadow: '0 12px 30px rgba(43, 195, 104, 0.20), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const miniGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const miniStatCard: CSSProperties = {
  borderRadius: '18px',
  padding: '14px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.08)',
  minWidth: 0,
}

const miniStatLabel: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const miniStatValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '16px',
  lineHeight: 1.35,
  fontWeight: 800,
  wordBreak: 'break-word',
}

const filterWrap: CSSProperties = {
  width: '260px',
  maxWidth: '100%',
}

const inputLabel: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'var(--muted)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '52px',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 700,
  outline: 'none',
}

const clearFilterButton: CSSProperties = {
  marginTop: '10px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e6eefb',
  fontWeight: 800,
  cursor: 'pointer',
}

const matchList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const matchCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(140,184,255,0.16)',
  background: 'linear-gradient(180deg, rgba(39,67,118,0.34) 0%, rgba(20,36,71,0.46) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const matchTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
}

const matchTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '20px',
  lineHeight: 1.25,
  fontWeight: 900,
  letterSpacing: '-0.02em',
}

const matchMeta: CSSProperties = {
  color: '#c0d5f5',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 500,
  marginTop: '6px',
  textTransform: 'capitalize',
}

const winnerPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  borderRadius: '999px',
  background: 'rgba(34, 197, 94, 0.14)',
  border: '1px solid rgba(34, 197, 94, 0.22)',
  color: '#bbf7d0',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
}

const matchBottom: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  marginTop: '14px',
  paddingTop: '14px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
}

const scoreText: CSSProperties = {
  color: '#8ec5ff',
  fontSize: '18px',
  lineHeight: 1.2,
  fontWeight: 900,
}

const subMeta: CSSProperties = {
  color: '#c0d5f5',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 500,
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{ ...ghostButton, ...(hovered ? { background: 'rgba(255,255,255,0.12)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{ ...primaryButton, ...(hovered ? { transform: 'translateY(-2px)', boxShadow: '0 18px 36px rgba(43,195,104,0.30)' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}
