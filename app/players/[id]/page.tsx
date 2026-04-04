'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'

type RatingView = 'overall' | 'singles' | 'doubles'
type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'

type Player = {
  id: string
  name: string
  location?: string | null
  overall_rating?: number | string | null
  overall_dynamic_rating?: number | null
  singles_rating?: number | string | null
  singles_dynamic_rating?: number | null
  doubles_rating?: number | string | null
  doubles_dynamic_rating?: number | null
}

type MatchRecord = {
  id: string
  date: string
  matchType: MatchType
  score: string
  result: 'W' | 'L'
  opponent: string
  partner: string | null
  sideA: string[]
  sideB: string[]
}

type SnapshotRow = {
  id: string
  player_id: string
  match_id: string
  snapshot_date: string
  rating_type?: RatingView | null
  dynamic_rating: number
}

type MatchRow = {
  id: string
  match_date: string
  match_type: MatchType
  score: string
  winner_side: MatchSide
}

type MatchPlayerRow = {
  match_id: string
  player_id: string
  side: MatchSide
  seat: number | null
  players: {
    id: string
    name: string
  } | null
}

export default function PlayerProfilePage() {
  const params = useParams()
  const playerId = String(params.id)

  const [player, setPlayer] = useState<Player | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ratingView, setRatingView] = useState<RatingView>('overall')
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
    if (playerId) {
      void loadPlayerProfile()
    }
  }, [playerId])

  async function loadPlayerProfile() {
    setLoading(true)
    setError('')

    try {
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          location,
          overall_rating,
          overall_dynamic_rating,
          singles_rating,
          singles_dynamic_rating,
          doubles_rating,
          doubles_dynamic_rating
        `)
        .eq('id', playerId)
        .single()

      if (playerError) throw new Error(playerError.message)

      const { data: playerMatchRefs, error: playerMatchRefsError } = await supabase
        .from('match_players')
        .select('match_id')
        .eq('player_id', playerId)

      if (playerMatchRefsError) throw new Error(playerMatchRefsError.message)

      const matchIds = [...new Set((playerMatchRefs || []).map((row) => row.match_id))]

      let matchRows: MatchRow[] = []
      let participantRows: MatchPlayerRow[] = []

      if (matchIds.length > 0) {
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select(`
            id,
            match_date,
            match_type,
            score,
            winner_side
          `)
          .in('id', matchIds)
          .order('match_date', { ascending: false })
          .order('id', { ascending: false })

        if (matchesError) throw new Error(matchesError.message)

        matchRows = (matchesData || []) as MatchRow[]

        const { data: participantsData, error: participantsError } = await supabase
          .from('match_players')
          .select(`
            match_id,
            player_id,
            side,
            seat,
            players (
              id,
              name
            )
          `)
          .in('match_id', matchIds)

        if (participantsError) throw new Error(participantsError.message)

        participantRows = (participantsData || []) as unknown as MatchPlayerRow[]
      }

      const participantsByMatchId = new Map<string, MatchPlayerRow[]>()

      for (const row of participantRows) {
        const existing = participantsByMatchId.get(row.match_id) ?? []
        existing.push(row)
        participantsByMatchId.set(row.match_id, existing)
      }

      const groupedMatches: MatchRecord[] = matchRows.map((match) => {
        const participants = participantsByMatchId.get(match.id) ?? []

        const sideA = participants
          .filter((p) => p.side === 'A')
          .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

        const sideB = participants
          .filter((p) => p.side === 'B')
          .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

        const playerOnSideA = sideA.some((p) => p.player_id === playerId)
        const playerSide: MatchSide = playerOnSideA ? 'A' : 'B'
        const opponentSide: MatchSide = playerSide === 'A' ? 'B' : 'A'

        const playerTeam = (playerSide === 'A' ? sideA : sideB).map(
          (p) => p.players?.name || 'Unknown Player',
        )
        const opponentTeam = (opponentSide === 'A' ? sideA : sideB).map(
          (p) => p.players?.name || 'Unknown Player',
        )

        const partnerNames = playerTeam.filter(
          (name) =>
            normalizeName(name).toLowerCase() !==
            normalizeName(playerData.name).toLowerCase(),
        )

        const isWin =
          (playerSide === 'A' && match.winner_side === 'A') ||
          (playerSide === 'B' && match.winner_side === 'B')

        return {
          id: match.id,
          date: match.match_date,
          matchType: normalizeMatchType(match.match_type),
          score: match.score,
          result: isWin ? 'W' : 'L',
          opponent: opponentTeam.join(' / '),
          partner: partnerNames.length > 0 ? partnerNames.join(' / ') : null,
          sideA: sideA.map((p) => p.players?.name || 'Unknown Player'),
          sideB: sideB.map((p) => p.players?.name || 'Unknown Player'),
        }
      })

      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('rating_snapshots')
        .select('id, player_id, match_id, snapshot_date, rating_type, dynamic_rating')
        .eq('player_id', playerId)
        .order('snapshot_date', { ascending: true })
        .order('id', { ascending: true })

      if (snapshotsError) throw new Error(snapshotsError.message)

      setPlayer(playerData as Player)
      setMatches(groupedMatches)
      setSnapshots((snapshotsData || []) as SnapshotRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player profile')
    } finally {
      setLoading(false)
    }
  }

  const filteredMatches = useMemo(() => {
    if (ratingView === 'overall') return matches
    return matches.filter((match) => match.matchType === ratingView)
  }, [matches, ratingView])

  const wins = useMemo(
    () => filteredMatches.filter((match) => match.result === 'W').length,
    [filteredMatches],
  )

  const losses = useMemo(
    () => filteredMatches.filter((match) => match.result === 'L').length,
    [filteredMatches],
  )

  const totalMatches = filteredMatches.length
  const winPct = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0'
  const mostRecentMatches = useMemo(() => filteredMatches.slice(0, 10), [filteredMatches])

  const chartPoints = useMemo(() => {
    const relevantSnapshots =
      ratingView === 'overall'
        ? snapshots.filter(
            (snapshot) => !snapshot.rating_type || snapshot.rating_type === 'overall',
          )
        : snapshots.filter((snapshot) => snapshot.rating_type === ratingView)

    return relevantSnapshots.map((snapshot, index) => ({
      x: index + 1,
      date: snapshot.snapshot_date,
      rating: snapshot.dynamic_rating,
    }))
  }, [snapshots, ratingView])

  const selectedDynamicRating = useMemo(() => {
    if (!player) return 3.5

    if (ratingView === 'singles') {
      return toRatingNumber(
        player.singles_dynamic_rating ?? player.overall_dynamic_rating,
        3.5,
      )
    }

    if (ratingView === 'doubles') {
      return toRatingNumber(
        player.doubles_dynamic_rating ?? player.overall_dynamic_rating,
        3.5,
      )
    }

    return toRatingNumber(player.overall_dynamic_rating, 3.5)
  }, [player, ratingView])

  const staticOverall = useMemo(() => toRatingNumber(player?.overall_rating, 3.5), [player])
  const staticSingles = useMemo(
    () => toRatingNumber(player?.singles_rating ?? player?.overall_rating, 3.5),
    [player],
  )
  const staticDoubles = useMemo(
    () => toRatingNumber(player?.doubles_rating ?? player?.overall_rating, 3.5),
    [player],
  )

  const nextThreshold = useMemo(
    () => getNextThreshold(selectedDynamicRating),
    [selectedDynamicRating],
  )
  const progressInfo = useMemo(
    () => getProgressToNextLevel(selectedDynamicRating, nextThreshold),
    [selectedDynamicRating, nextThreshold],
  )

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '14px 16px 24px' : '10px 18px 24px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet
      ? '1fr'
      : 'minmax(0, 0.96fr) minmax(0, 1.04fr)',
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

  const dynamicRightColumn: CSSProperties = {
    ...heroRight,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicSegmentWrap: CSSProperties = {
    ...segmentWrap,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicFocusMetrics: CSSProperties = {
    ...focusMetrics,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicStatsGrid: CSSProperties = {
    ...statsGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(4, minmax(0, 1fr))',
  }

  const dynamicContentGrid: CSSProperties = {
    ...contentGrid,
    gridTemplateColumns: '1fr',
  }

  if (loading) {
    return (
      <SiteShell active="/players">
        <section style={dynamicHeroWrap}>
          <div style={dynamicHeroShell}>
            <div style={heroNoise} />
            <div style={loadingCard}>Loading player profile...</div>
          </div>
        </section>
      </SiteShell>
    )
  }

  if (error || !player) {
    return (
      <SiteShell active="/players">
        <section style={dynamicHeroWrap}>
          <div style={dynamicHeroShell}>
            <div style={heroNoise} />
            <div style={errorCard}>
              <div style={sectionKicker}>Player profile</div>
              <h2 style={sectionTitle}>Unable to load player</h2>
              <p style={sectionText}>{error || 'Player not found.'}</p>
            </div>
          </div>
        </section>
      </SiteShell>
    )
  }

  return (
    <SiteShell active="/players">
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Player profile preview</div>

              <h1 style={dynamicHeroTitle}>{player.name}</h1>

              <p style={dynamicHeroText}>{player.location || 'Location not set'}</p>

              <div style={heroHintRow}>
                <span style={heroHintPill}>{totalMatches} matches</span>
                <span style={heroHintPill}>{winPct}% win rate</span>
                <span style={heroHintPill}>{capitalize(ratingView)} view</span>
              </div>

              <div style={meterCard}>
                <div style={meterHeader}>
                  <div>
                    <div style={meterLabel}>Level-up meter</div>
                    <div style={meterSubtext}>
                      Current {ratingView} dynamic rating vs. next threshold
                    </div>
                  </div>

                  <div style={meterValueGroup}>
                    <div style={meterCurrent}>{selectedDynamicRating.toFixed(2)}</div>
                    <div style={meterTarget}>Next: {nextThreshold.toFixed(1)}</div>
                  </div>
                </div>

                <div style={meterTrack}>
                  <div
                    style={{
                      ...meterFill,
                      width: `${progressInfo.percent}%`,
                    }}
                  />
                </div>

                <div style={meterFooter}>
                  <span>{progressInfo.previous.toFixed(1)}</span>
                  <span>{progressInfo.remaining.toFixed(2)} to go</span>
                  <span>{nextThreshold.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div style={dynamicRightColumn}>
              <div style={focusCard}>
                <div style={focusHead}>
                  <div>
                    <div style={focusLabel}>Rating focus</div>
                    <div style={focusSubtitle}>
                      Previewing the shared home/matchup shell on player profiles.
                    </div>
                  </div>

                  <Link href="/players" style={secondaryMiniLink}>
                    Back to players
                  </Link>
                </div>

                <div style={dynamicSegmentWrap}>
                  <button
                    type="button"
                    onClick={() => setRatingView('overall')}
                    style={{
                      ...segmentButton,
                      ...(ratingView === 'overall' ? segmentButtonActive : {}),
                    }}
                  >
                    Overall
                  </button>
                  <button
                    type="button"
                    onClick={() => setRatingView('singles')}
                    style={{
                      ...segmentButton,
                      ...(ratingView === 'singles' ? segmentButtonActive : {}),
                    }}
                  >
                    Singles
                  </button>
                  <button
                    type="button"
                    onClick={() => setRatingView('doubles')}
                    style={{
                      ...segmentButton,
                      ...(ratingView === 'doubles' ? segmentButtonActive : {}),
                    }}
                  >
                    Doubles
                  </button>
                </div>

                <div style={dynamicFocusMetrics}>
                  <StatChip label="Dynamic" value={selectedDynamicRating.toFixed(2)} accent />
                  <StatChip
                    label="Static"
                    value={
                      ratingView === 'overall'
                        ? staticOverall.toFixed(2)
                        : ratingView === 'singles'
                          ? staticSingles.toFixed(2)
                          : staticDoubles.toFixed(2)
                    }
                  />
                  <StatChip label="Wins" value={String(wins)} />
                  <StatChip label="Losses" value={String(losses)} />
                </div>
              </div>

              <div style={summaryCard}>
                <div style={summaryTitle}>Quick profile view</div>

                <div style={summaryStatsGrid}>
                  <StatChip
                    label="Overall"
                    value={formatRating(
                      toRatingNumber(player.overall_dynamic_rating, 3.5),
                    )}
                  />
                  <StatChip
                    label="Singles"
                    value={formatRating(
                      toRatingNumber(
                        player.singles_dynamic_rating ?? player.overall_dynamic_rating,
                        3.5,
                      ),
                    )}
                  />
                  <StatChip
                    label="Doubles"
                    value={formatRating(
                      toRatingNumber(
                        player.doubles_dynamic_rating ?? player.overall_dynamic_rating,
                        3.5,
                      ),
                    )}
                  />
                  <StatChip label="Tracked" value={String(totalMatches)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={contentWrap}>
        <div style={dynamicStatsGrid}>
          <article style={{ ...statCard, ...statCardAccentGreen }}>
            <div style={statLabel}>Current {capitalize(ratingView)} dynamic</div>
            <div style={statValue}>{selectedDynamicRating.toFixed(2)}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Overall</div>
            <div style={statValue}>
              {formatRating(toRatingNumber(player.overall_dynamic_rating, 3.5))}
            </div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Singles</div>
            <div style={statValue}>
              {formatRating(
                toRatingNumber(
                  player.singles_dynamic_rating ?? player.overall_dynamic_rating,
                  3.5,
                ),
              )}
            </div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Doubles</div>
            <div style={statValue}>
              {formatRating(
                toRatingNumber(
                  player.doubles_dynamic_rating ?? player.overall_dynamic_rating,
                  3.5,
                ),
              )}
            </div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Wins</div>
            <div style={statValue}>{wins}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Losses</div>
            <div style={statValue}>{losses}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Win rate</div>
            <div style={statValue}>{winPct}%</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Tracked matches</div>
            <div style={statValue}>{totalMatches}</div>
          </article>
        </div>

        <div style={dynamicContentGrid}>
          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Trend</div>
                <h2 style={panelTitle}>{capitalize(ratingView)} rating trend</h2>
              </div>
              <span style={panelChip}>{chartPoints.length} points</span>
            </div>

            {chartPoints.length === 0 ? (
              <p style={emptyText}>No rating history yet for this view.</p>
            ) : (
              <SimpleLineChart points={chartPoints} />
            )}
          </article>

          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Recent results</div>
                <h2 style={panelTitle}>Latest match history</h2>
              </div>
              <span style={panelChip}>Latest 10</span>
            </div>

            {mostRecentMatches.length === 0 ? (
              <p style={emptyText}>No matches found for this view.</p>
            ) : (
              <div style={tableWrap}>
                <table style={dataTable}>
                  <thead>
                    <tr>
                      <th style={tableHead}>Date</th>
                      <th style={tableHead}>Type</th>
                      <th style={tableHead}>Partner</th>
                      <th style={tableHead}>Opponent</th>
                      <th style={tableHead}>Score</th>
                      <th style={tableHead}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mostRecentMatches.map((match) => (
                      <tr key={match.id}>
                        <td style={tableCell}>{formatDate(match.date)}</td>
                        <td style={tableCell}>{capitalize(match.matchType)}</td>
                        <td style={tableCell}>{match.partner || '—'}</td>
                        <td style={tableCell}>{match.opponent}</td>
                        <td style={tableCell}>{match.score}</td>
                        <td style={tableCell}>
                          <span
                            style={{
                              ...resultPill,
                              ...(match.result === 'W' ? resultWin : resultLoss),
                            }}
                          >
                            {match.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      </section>
    </SiteShell>
  )
}

function StatChip({
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
        ...chipStat,
        ...(accent ? chipStatAccent : {}),
      }}
    >
      <div
        style={{
          ...chipStatLabel,
          ...(accent ? { color: 'rgba(255,255,255,0.82)' } : {}),
        }}
      >
        {label}
      </div>
      <div
        style={{
          ...chipStatValue,
          ...(accent ? { color: '#07111d' } : {}),
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SimpleLineChart({
  points,
}: {
  points: Array<{ x: number; date: string; rating: number }>
}) {
  const width = 920
  const height = 280
  const padding = 34

  const minRating = Math.min(...points.map((p) => p.rating))
  const maxRating = Math.max(...points.map((p) => p.rating))
  const spread = Math.max(maxRating - minRating, 0.1)
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

  const path = points
    .map((point, index) => {
      const x = padding + index * xStep
      const y =
        height - padding - ((point.rating - minRating) / spread) * (height - padding * 2)

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <div style={chartShell}>
      <svg width={width} height={height} style={chartSvg} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="playerLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#255BE3" />
            <stop offset="55%" stopColor="#3FA7FF" />
            <stop offset="100%" stopColor="#B8E61A" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} rx="20" fill="#0f1c38" />

        {[0.2, 0.4, 0.6, 0.8].map((line, index) => {
          const y = padding + (height - padding * 2) * line
          return (
            <line
              key={index}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1"
            />
          )
        })}

        <path
          d={path}
          fill="none"
          stroke="url(#playerLineGradient)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {points.map((point, index) => {
          const x = padding + index * xStep
          const y =
            height - padding - ((point.rating - minRating) / spread) * (height - padding * 2)

          return (
            <g key={`${point.date}-${index}`}>
              <circle cx={x} cy={y} r="10" fill="rgba(37, 91, 227, 0.18)" />
              <circle cx={x} cy={y} r="4.5" fill="#255BE3" />
            </g>
          )
        })}
      </svg>

      <div style={chartMeta}>
        {points.length} data point{points.length === 1 ? '' : 's'} • Latest rating{' '}
        {points[points.length - 1]?.rating.toFixed(2)}
      </div>
    </div>
  )
}

function normalizeMatchType(value: string | null | undefined): MatchType {
  return value === 'doubles' ? 'doubles' : 'singles'
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function toRatingNumber(value: number | string | null | undefined, fallback = 3.5) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function formatRating(value: number) {
  return value.toFixed(2)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value: string) {
  if (!value) return '—'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getNextThreshold(rating: number) {
  const threshold = Math.ceil(rating * 2) / 2
  return threshold <= rating ? threshold + 0.5 : threshold
}

function getProgressToNextLevel(rating: number, next: number) {
  const previous = next - 0.5
  const percent = Math.max(0, Math.min(100, ((rating - previous) / 0.5) * 100))
  const remaining = Math.max(0, next - rating)

  return { previous, percent, remaining }
}

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '30px',
  background:
    'linear-gradient(180deg, rgba(26, 54, 104, 0.52) 0%, rgba(17, 36, 72, 0.72) 22%, rgba(12, 27, 52, 0.82) 100%)',
  border: '1px solid rgba(116,190,255,0.22)',
  boxShadow:
    '0 26px 80px rgba(7,18,42,0.24), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 80px rgba(88,170,255,0.06)',
  overflow: 'hidden',
  position: 'relative',
}

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 12% 0%, rgba(116,190,255,0.26), transparent 28%), radial-gradient(circle at 72% 8%, rgba(88,170,255,0.18), transparent 24%), radial-gradient(circle at 100% 0%, rgba(155,225,29,0.10), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 26%)',
  pointerEvents: 'none',
}

const heroContent: CSSProperties = {
  display: 'grid',
  alignItems: 'stretch',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '16px',
  minWidth: 0,
}

const heroRight: CSSProperties = {
  display: 'grid',
  gap: '14px',
  alignContent: 'start',
  minWidth: 0,
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
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'rgba(224,236,249,0.86)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const heroHintRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '4px',
}

const heroHintPill: CSSProperties = {
  border: '1px solid rgba(137,182,255,0.14)',
  background: 'rgba(43,78,138,0.34)',
  color: '#e2efff',
  borderRadius: '999px',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
}

const meterCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.88) 0%, rgba(10,22,44,0.96) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
  maxWidth: '560px',
}

const meterHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: '14px',
}

const meterLabel: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '22px',
  letterSpacing: '-0.03em',
}

const meterSubtext: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(220,231,244,0.78)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
}

const meterValueGroup: CSSProperties = {
  textAlign: 'right',
}

const meterCurrent: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '32px',
  lineHeight: 1,
  letterSpacing: '-0.04em',
}

const meterTarget: CSSProperties = {
  marginTop: '6px',
  color: '#d9f84a',
  fontWeight: 800,
  fontSize: '13px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const meterTrack: CSSProperties = {
  width: '100%',
  height: '14px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.06)',
  overflow: 'hidden',
}

const meterFill: CSSProperties = {
  height: '100%',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 60%, #22c55e 100%)',
  boxShadow: '0 10px 24px rgba(155,225,29,0.25)',
}

const meterFooter: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginTop: '10px',
  color: 'rgba(214,228,248,0.74)',
  fontSize: '13px',
  fontWeight: 700,
}

const focusCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(18,38,74,0.88) 0%, rgba(10,22,44,0.94) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
}

const focusHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: '14px',
}

const focusLabel: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
}

const focusSubtitle: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(220,231,244,0.78)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
}

const secondaryMiniLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.07)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '13px',
}

const segmentWrap: CSSProperties = {
  display: 'grid',
  gap: '10px',
  marginBottom: '14px',
}

const segmentButton: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.06)',
  color: '#f7fbff',
  minHeight: '52px',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
}

const segmentButtonActive: CSSProperties = {
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  color: '#04121f',
  border: '1px solid rgba(155,225,29,0.45)',
  boxShadow: '0 12px 30px rgba(155,225,29,0.25)',
}

const focusMetrics: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const summaryCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(17,36,72,0.88) 0%, rgba(10,22,44,0.94) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
}

const summaryTitle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
  marginBottom: '14px',
}

const summaryStatsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const chipStat: CSSProperties = {
  borderRadius: '18px',
  padding: '12px 12px 11px',
  background: 'rgba(19,34,62,0.92)',
  border: '1px solid rgba(116,190,255,0.10)',
  minWidth: 0,
}

const chipStatAccent: CSSProperties = {
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  border: '1px solid rgba(155,225,29,0.35)',
}

const chipStatLabel: CSSProperties = {
  color: 'rgba(217, 231, 255, 0.82)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
}

const chipStatValue: CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const statsGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '26px',
}

const statCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(18,38,74,0.88) 0%, rgba(10,22,44,0.94) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
}

const statCardAccentGreen: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.32)',
  boxShadow: '0 10px 30px rgba(155,225,29,0.12), inset 0 0 0 1px rgba(155,225,29,0.06)',
}

const statLabel: CSSProperties = {
  color: 'rgba(217, 231, 255, 0.82)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 750,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const statValue: CSSProperties = {
  marginTop: '8px',
  color: '#ffffff',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '32px 18px 10px',
}

const contentGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const panelCard: CSSProperties = {
  borderRadius: '28px',
  padding: '22px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(18,38,74,0.88) 0%, rgba(10,22,44,0.94) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
}

const panelHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
}

const sectionKicker: CSSProperties = {
  color: '#93c5fd',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const panelTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
}

const panelChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(155,225,29,0.12)',
  color: '#d9f84a',
  border: '1px solid rgba(155,225,29,0.25)',
  fontWeight: 800,
  fontSize: '13px',
}

const emptyText: CSSProperties = {
  margin: 0,
  color: 'rgba(224,236,249,0.78)',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 550,
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(15,28,54,0.92)',
}

const dataTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: '760px',
}

const tableHead: CSSProperties = {
  padding: '15px 16px',
  textAlign: 'left',
  color: 'rgba(217, 231, 255, 0.72)',
  fontSize: '12px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontWeight: 800,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.02)',
  whiteSpace: 'nowrap',
}

const tableCell: CSSProperties = {
  padding: '16px',
  color: '#f8fbff',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 600,
  borderTop: '1px solid rgba(255,255,255,0.06)',
  verticalAlign: 'top',
}

const resultPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '2.4rem',
  padding: '0.35rem 0.65rem',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.04em',
}

const resultWin: CSSProperties = {
  background: 'rgba(155,225,29,0.14)',
  color: '#d9f84a',
  border: '1px solid rgba(155,225,29,0.24)',
}

const resultLoss: CSSProperties = {
  background: 'rgba(255, 60, 40, 0.10)',
  color: '#ffb4ab',
  border: '1px solid rgba(255, 60, 40, 0.16)',
}

const loadingCard: CSSProperties = {
  padding: '26px',
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(19,30,54,0.92)',
  color: '#dfe8f8',
  fontWeight: 700,
  position: 'relative',
  zIndex: 1,
}

const errorCard: CSSProperties = {
  padding: '22px',
  borderRadius: '28px',
  border: '1px solid rgba(255, 60, 40, 0.18)',
  background: 'rgba(19,30,54,0.92)',
  position: 'relative',
  zIndex: 1,
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
  color: 'rgba(224,236,249,0.78)',
  lineHeight: 1.6,
}

const chartShell: CSSProperties = {
  width: '100%',
}

const chartSvg: CSSProperties = {
  width: '100%',
  height: 'auto',
  display: 'block',
  overflow: 'visible',
}

const chartMeta: CSSProperties = {
  marginTop: '0.9rem',
  color: 'rgba(224,236,249,0.72)',
  fontSize: '0.9rem',
  fontWeight: 600,
}