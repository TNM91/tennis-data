'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'

type SortKey = 'name' | 'matches' | 'players' | 'winPct' | 'latest'
type FilterKey = 'all' | 'active' | 'winning' | 'deep-roster'

type MatchRow = {
  id: string
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  match_date: string | null
  winner_side: 'A' | 'B' | null
}

type MatchPlayerRow = {
  match_id: string
  side: 'A' | 'B'
  player_id: string
}

type TeamCard = {
  key: string
  team: string
  league: string
  flight: string
  matches: number
  players: number
  wins: number
  losses: number
  latestMatch: string | null
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('matches')
  const [filterBy, setFilterBy] = useState<FilterKey>('all')
  const [screenWidth, setScreenWidth] = useState(1280)

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820
  const isSmallMobile = screenWidth < 560

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    void loadTeams()
  }, [])

  async function loadTeams() {
    setLoading(true)
    setError('')

    try {
      const { data: matchRows, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          home_team,
          away_team,
          league_name,
          flight,
          match_date,
          winner_side
        `)
        .order('match_date', { ascending: false })

      if (matchesError) throw new Error(matchesError.message)

      const typedMatches = (matchRows || []) as MatchRow[]
      const matchIds = typedMatches.map((match) => match.id)

      let matchPlayers: MatchPlayerRow[] = []

      if (matchIds.length > 0) {
        const { data: matchPlayerRows, error: matchPlayersError } = await supabase
          .from('match_players')
          .select(`
            match_id,
            side,
            player_id
          `)
          .in('match_id', matchIds)

        if (matchPlayersError) throw new Error(matchPlayersError.message)
        matchPlayers = (matchPlayerRows || []) as MatchPlayerRow[]
      }

      const teamMap = new Map<string, TeamCard>()
      const teamPlayerSets = new Map<string, Set<string>>()

      for (const match of typedMatches) {
        const league = safeText(match.league_name, 'Unknown League')
        const flight = safeText(match.flight, 'Unknown Flight')

        const teamEntries = [
          { team: safeText(match.home_team), side: 'A' as const },
          { team: safeText(match.away_team), side: 'B' as const },
        ]

        for (const entry of teamEntries) {
          if (entry.team === 'Unknown') continue

          const key = buildTeamKey(entry.team, league, flight)

          if (!teamMap.has(key)) {
            teamMap.set(key, {
              key,
              team: entry.team,
              league,
              flight,
              matches: 0,
              players: 0,
              wins: 0,
              losses: 0,
              latestMatch: null,
            })
          }

          if (!teamPlayerSets.has(key)) {
            teamPlayerSets.set(key, new Set<string>())
          }

          const summary = teamMap.get(key)!
          summary.matches += 1

          const won = match.winner_side === entry.side
          if (won) summary.wins += 1
          else summary.losses += 1

          if (isLaterDate(match.match_date, summary.latestMatch)) {
            summary.latestMatch = match.match_date
          }

          const participantsForSide = matchPlayers.filter(
            (row) => row.match_id === match.id && row.side === entry.side
          )

          for (const participant of participantsForSide) {
            if (participant.player_id) {
              teamPlayerSets.get(key)!.add(String(participant.player_id))
            }
          }
        }
      }

      const nextTeams = [...teamMap.values()].map((team) => ({
        ...team,
        players: teamPlayerSets.get(team.key)?.size || 0,
      }))

      setTeams(nextTeams)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase()

    let next = teams.filter((team) => {
      const matchesSearch =
        !q ||
        team.team.toLowerCase().includes(q) ||
        team.league.toLowerCase().includes(q) ||
        team.flight.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (filterBy === 'active') return team.matches >= 3
      if (filterBy === 'winning') return getWinPct(team) >= 0.5
      if (filterBy === 'deep-roster') return team.players >= 6
      return true
    })

    next = [...next].sort((a, b) => {
      if (sortBy === 'name') return a.team.localeCompare(b.team)
      if (sortBy === 'players') return b.players - a.players
      if (sortBy === 'winPct') return getWinPct(b) - getWinPct(a)
      if (sortBy === 'latest') return compareDatesDesc(a.latestMatch, b.latestMatch)
      return b.matches - a.matches
    })

    return next
  }, [teams, search, sortBy, filterBy])

  const totalMatches = useMemo(() => teams.reduce((sum, team) => sum + team.matches, 0), [teams])

  const avgRoster = useMemo(() => {
    if (teams.length === 0) return 0
    return teams.reduce((sum, team) => sum + team.players, 0) / teams.length
  }, [teams])

  const topWinPct = useMemo(() => {
    if (teams.length === 0) return 0
    return Math.max(...teams.map((team) => getWinPct(team)))
  }, [teams])

  const winningTeams = useMemo(() => teams.filter((team) => team.wins > team.losses).length, [teams])

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '26px 18px' : '34px 26px',
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.3fr) minmax(320px, 0.72fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '42px' : '58px',
  }

  const dynamicSearchPanel: CSSProperties = {
    ...searchPanel,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isTablet
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicSectionHeader: CSSProperties = {
    ...sectionHeader,
    alignItems: isMobile ? 'flex-start' : 'flex-end',
  }

  return (
    <SiteShell active="/teams">
      <section style={pageContent}>
        <section style={dynamicHeroShell}>
          <div>
            <div style={eyebrow}>Team directory</div>
            <h1 style={dynamicHeroTitle}>
              Browse teams by league and flight, then jump into roster and match history fast.
            </h1>
            <p style={heroText}>
              This is your team discovery page for captain and league workflows. Search by team,
              filter by league context, compare depth, and open the full team page when you want the details.
            </p>

            <div style={dynamicSearchPanel}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team, league, or flight"
                style={searchInput}
              />

              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={selectStyle}>
                <option value="matches">Sort: Matches</option>
                <option value="players">Sort: Players Used</option>
                <option value="winPct">Sort: Win %</option>
                <option value="latest">Sort: Latest Match</option>
                <option value="name">Sort: Name</option>
              </select>

              <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as FilterKey)} style={selectStyle}>
                <option value="all">All teams</option>
                <option value="active">3+ matches</option>
                <option value="winning">Winning record</option>
                <option value="deep-roster">6+ players used</option>
              </select>
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Directory snapshot</div>

            <div style={summaryMetricGrid}>
              <MetricBlock label="Teams" value={String(teams.length)} />
              <MetricBlock label="Showing" value={String(filteredTeams.length)} />
              <MetricBlock label="Total matches" value={String(totalMatches)} />
              <MetricBlock label="Avg roster" value={formatNumber(avgRoster)} />
            </div>

            <div style={{ ...summaryMetricGrid, marginTop: '12px' }}>
              <MetricBlock label="Best win %" value={formatPercent(topWinPct)} accent />
              <MetricBlock label="Winning teams" value={String(winningTeams)} />
            </div>

            <div style={summaryHint}>
              Best flow: discover the team here, open the team page, then use Matchup or Captain&apos;s Corner for prep.
            </div>
          </div>
        </section>

        {error ? (
          <section style={errorCard}>
            <div style={sectionKicker}>Teams</div>
            <h2 style={sectionTitle}>Unable to load teams</h2>
            <p style={sectionText}>{error}</p>
          </section>
        ) : null}

        <section style={contentWrap}>
          <div style={dynamicSectionHeader}>
            <div>
              <div style={sectionKicker}>Browse</div>
              <h2 style={sectionTitle}>Team cards built for league and captain workflows</h2>
            </div>
            <Link href="/leagues" style={secondaryLink}>
              Open leagues
            </Link>
          </div>

          {loading ? (
            <div style={loadingCard}>Loading team directory...</div>
          ) : filteredTeams.length === 0 ? (
            <div style={loadingCard}>No teams matched that search.</div>
          ) : (
            <div style={dynamicCardGrid}>
              {filteredTeams.map((team) => {
                const href = `/teams/${encodeURIComponent(team.team)}?league=${encodeURIComponent(team.league)}&flight=${encodeURIComponent(team.flight)}`

                return (
                  <Link key={team.key} href={href} style={teamCard}>
                    <div style={cardGlow} />

                    <div style={teamCardTopRow}>
                      <div style={miniKicker}>Team</div>
                      <div style={matchCountPill}>{team.matches} matches</div>
                    </div>

                    <div style={teamName}>{team.team}</div>
                    <div style={teamMeta}>
                      {team.league} · {team.flight}
                    </div>

                    <div style={recordRow}>
                      <div style={recordPillWin}>{team.wins} wins</div>
                      <div style={recordPillLoss}>{team.losses} losses</div>
                      <div style={recordPillNeutral}>{formatPercent(getWinPct(team))} win %</div>
                    </div>

                    <div style={teamStatGrid}>
                      <TeamStat label="Players used" value={String(team.players)} />
                      <TeamStat label="Latest" value={formatShortDate(team.latestMatch)} />
                    </div>

                    <div style={teamCardFooter}>
                      <span style={profileLinkText}>Open team page</span>
                      <span style={arrowText}>→</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </section>
    </SiteShell>
  )
}

function MetricBlock({
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
        ...summaryMetricCard,
        ...(accent ? summaryMetricCardAccent : {}),
      }}
    >
      <div style={summaryMetricLabel}>{label}</div>
      <div style={summaryMetricValue}>{value}</div>
    </div>
  )
}

function TeamStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={teamStatCard}>
      <div style={teamStatLabel}>{label}</div>
      <div style={teamStatValue}>{value}</div>
    </div>
  )
}

function buildTeamKey(team: string, league: string, flight: string) {
  return `${team}__${league}__${flight}`
}

function safeText(value: string | null | undefined, fallback = 'Unknown') {
  const text = (value || '').trim()
  return text || fallback
}

function getWinPct(team: TeamCard) {
  const totalDecisions = team.wins + team.losses
  if (totalDecisions === 0) return 0
  return team.wins / totalDecisions
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(1)
}

function formatShortDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function compareDatesDesc(a: string | null, b: string | null) {
  const timeA = a ? new Date(a).getTime() : 0
  const timeB = b ? new Date(b).getTime() : 0
  return timeB - timeA
}

function isLaterDate(next: string | null, current: string | null) {
  const nextTime = next ? new Date(next).getTime() : 0
  const currentTime = current ? new Date(current).getTime() : 0
  return nextTime > currentTime
}

const pageContent: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '18px 24px 0',
}

const heroShell: CSSProperties = {
  position: 'relative',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(107, 162, 255, 0.18)',
  background:
    'linear-gradient(135deg, rgba(14,39,82,0.88) 0%, rgba(11,30,64,0.90) 56%, rgba(12,46,62,0.84) 100%)',
  boxShadow: '0 28px 80px rgba(3,10,24,0.30)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.12)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: '14px',
  marginBottom: '18px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
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
  color: 'rgba(224, 234, 247, 0.84)',
  fontSize: '18px',
  lineHeight: 1.6,
  maxWidth: '720px',
}

const searchPanel: CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '14px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(10, 20, 37, 0.44)',
  maxWidth: '860px',
}

const searchInput: CSSProperties = {
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

const selectStyle: CSSProperties = {
  height: '52px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f5f8ff',
  padding: '0 14px',
  fontSize: '15px',
  outline: 'none',
}

const summaryCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(37,56,84,0.72), rgba(21,37,64,0.76))',
  padding: '18px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: '100%',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const summaryTitle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
  marginBottom: '14px',
}

const summaryMetricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
}

const summaryMetricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '14px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const summaryMetricCardAccent: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(63,121,64,0.62) 0%, rgba(47,153,94,0.58) 100%)',
  border: '1px solid rgba(134,239,172,0.24)',
}

const summaryMetricLabel: CSSProperties = {
  color: 'rgba(220,231,244,0.7)',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '8px',
}

const summaryMetricValue: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '34px',
  letterSpacing: '-0.05em',
  lineHeight: 1,
}

const summaryHint: CSSProperties = {
  marginTop: '14px',
  color: 'rgba(224, 234, 247, 0.76)',
  lineHeight: 1.6,
  fontSize: '14px',
}

const errorCard: CSSProperties = {
  marginTop: '18px',
  padding: '22px',
  borderRadius: '28px',
  border: '1px solid rgba(255,100,100,0.2)',
  background: 'rgba(62,16,22,0.52)',
}

const contentWrap: CSSProperties = {
  marginTop: '18px',
}

const sectionHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  marginBottom: '16px',
  flexWrap: 'wrap',
}

const sectionKicker: CSSProperties = {
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '30px',
  letterSpacing: '-0.04em',
}

const sectionText: CSSProperties = {
  margin: '10px 0 0',
  color: 'rgba(232, 239, 248, 0.84)',
  lineHeight: 1.6,
}

const secondaryLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.18) 0%, rgba(27,62,120,0.14) 100%)',
  color: '#ebf1fd',
  textDecoration: 'none',
  fontWeight: 800,
}

const loadingCard: CSSProperties = {
  padding: '26px',
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.10) 0%, rgba(16,34,70,0.30) 100%)',
  color: '#dfe8f8',
  fontWeight: 700,
}

const cardGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const teamCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  textDecoration: 'none',
  borderRadius: '28px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.24) 0%, rgba(28,49,95,0.34) 100%)',
  padding: '20px',
  boxShadow: '0 18px 40px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
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

const teamCardTopRow: CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '14px',
}

const miniKicker: CSSProperties = {
  color: '#87aeff',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const matchCountPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(37,91,227,0.14)',
  color: '#b8d0ff',
  fontSize: '12px',
  fontWeight: 800,
}

const teamName: CSSProperties = {
  position: 'relative',
  color: '#f8fbff',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
  lineHeight: 1.05,
  marginBottom: '8px',
}

const teamMeta: CSSProperties = {
  position: 'relative',
  color: 'rgba(223,232,248,0.74)',
  fontSize: '15px',
  fontWeight: 700,
  marginBottom: '16px',
}

const recordRow: CSSProperties = {
  position: 'relative',
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginBottom: '14px',
}

const recordPillWin: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(34,197,94,0.16)',
  color: '#aff5c4',
  fontSize: '12px',
  fontWeight: 800,
}

const recordPillLoss: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(239,68,68,0.16)',
  color: '#ffb7b7',
  fontSize: '12px',
  fontWeight: 800,
}

const recordPillNeutral: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  color: '#dfe8f8',
  fontSize: '12px',
  fontWeight: 800,
}

const teamStatGrid: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const teamStatCard: CSSProperties = {
  borderRadius: '18px',
  padding: '12px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.05)',
}

const teamStatLabel: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const teamStatValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '18px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
  lineHeight: 1.2,
}

const teamCardFooter: CSSProperties = {
  position: 'relative',
  marginTop: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#dfe9fb',
}

const profileLinkText: CSSProperties = {
  fontWeight: 800,
  fontSize: '14px',
}

const arrowText: CSSProperties = {
  fontWeight: 900,
  fontSize: '18px',
}
