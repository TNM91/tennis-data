'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

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

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/captains-corner', label: "Captain's Corner" },
]

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

      if (playerError) {
        throw new Error(playerError.message)
      }

      const { data: playerMatchRefs, error: playerMatchRefsError } = await supabase
        .from('match_players')
        .select('match_id')
        .eq('player_id', playerId)

      if (playerMatchRefsError) {
        throw new Error(playerMatchRefsError.message)
      }

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

        if (matchesError) {
          throw new Error(matchesError.message)
        }

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

        if (participantsError) {
          throw new Error(participantsError.message)
        }

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
          (p) => p.players?.name || 'Unknown Player'
        )
        const opponentTeam = (opponentSide === 'A' ? sideA : sideB).map(
          (p) => p.players?.name || 'Unknown Player'
        )

        const partnerNames = playerTeam.filter(
          (name) => normalizeName(name).toLowerCase() !== normalizeName(playerData.name).toLowerCase()
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

      if (snapshotsError) {
        throw new Error(snapshotsError.message)
      }

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
    [filteredMatches]
  )

  const losses = useMemo(
    () => filteredMatches.filter((match) => match.result === 'L').length,
    [filteredMatches]
  )

  const totalMatches = filteredMatches.length
  const winPct = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0'
  const mostRecentMatches = useMemo(() => filteredMatches.slice(0, 10), [filteredMatches])

  const chartPoints = useMemo(() => {
    const relevantSnapshots =
      ratingView === 'overall'
        ? snapshots.filter((snapshot) => !snapshot.rating_type || snapshot.rating_type === 'overall')
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
      return toRatingNumber(player.singles_dynamic_rating ?? player.overall_dynamic_rating, 3.5)
    }

    if (ratingView === 'doubles') {
      return toRatingNumber(player.doubles_dynamic_rating ?? player.overall_dynamic_rating, 3.5)
    }

    return toRatingNumber(player.overall_dynamic_rating, 3.5)
  }, [player, ratingView])

  const staticOverall = useMemo(() => toRatingNumber(player?.overall_rating, 3.5), [player])
  const staticSingles = useMemo(
    () => toRatingNumber(player?.singles_rating ?? player?.overall_rating, 3.5),
    [player]
  )
  const staticDoubles = useMemo(
    () => toRatingNumber(player?.doubles_rating ?? player?.overall_rating, 3.5),
    [player]
  )

  const nextThreshold = useMemo(() => getNextThreshold(selectedDynamicRating), [selectedDynamicRating])
  const progressInfo = useMemo(
    () => getProgressToNextLevel(selectedDynamicRating, nextThreshold),
    [selectedDynamicRating, nextThreshold]
  )

  const dynamicHeaderInner = {
    ...headerInner,
    flexDirection: isTablet ? ('column' as const) : ('row' as const),
    alignItems: isTablet ? ('flex-start' as const) : ('center' as const),
    gap: isTablet ? '14px' : '18px',
  }

  const dynamicNavStyle = {
    ...navStyle,
    width: isTablet ? '100%' : 'auto',
    justifyContent: isTablet ? ('flex-start' as const) : ('flex-end' as const),
    flexWrap: 'wrap' as const,
  }

  const dynamicHeroWrap = {
    ...heroWrap,
    padding: isMobile ? '14px 16px 24px' : '10px 18px 24px',
  }

  const dynamicHeroShell = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
  }

  const dynamicHeroContent = {
    ...heroContent,
    gridTemplateColumns: isTablet
      ? '1fr'
      : 'minmax(0, 0.92fr) minmax(0, 1.08fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '60px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '520px',
  }

  const dynamicHeroText = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '520px',
  }

  const dynamicRightColumn = {
    ...heroRight,
    position: isTablet ? ('relative' as const) : ('sticky' as const),
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicSegmentWrap = {
    ...segmentWrap,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicFocusMetrics = {
    ...focusMetrics,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicStatsGrid = {
    ...statsGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(4, minmax(0, 1fr))',
  }

  const dynamicContentGrid = {
    ...contentGrid,
    gridTemplateColumns: '1fr',
  }

  const dynamicFooterInner = {
    ...footerInner,
    padding: isMobile ? '16px 16px 14px' : '16px 20px 14px',
  }

  const dynamicFooterRow = {
    ...footerRow,
    flexDirection: isTablet ? ('column' as const) : ('row' as const),
    alignItems: isTablet ? ('flex-start' as const) : ('center' as const),
    gap: isTablet ? '12px' : '18px',
  }

  const dynamicFooterLinks = {
    ...footerLinks,
    justifyContent: isTablet ? ('flex-start' as const) : ('center' as const),
  }

  const dynamicFooterBottom = {
    ...footerBottom,
    marginLeft: isTablet ? 0 : 'auto',
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />

        <header style={headerStyle}>
          <div style={dynamicHeaderInner}>
            <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
              <BrandWordmark compact={isMobile} top />
            </Link>

            <nav style={dynamicNavStyle}>
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} style={navLink}>
                  {link.label}
                </Link>
              ))}
              <Link href="/admin" style={navLink}>Admin</Link>
            </nav>
          </div>
        </header>

        <section style={dynamicHeroWrap}>
          <div style={dynamicHeroShell}>
            <div style={heroNoise} />
            <div style={loadingCard}>Loading player profile...</div>
          </div>
        </section>
      </main>
    )
  }

  if (error || !player) {
    return (
      <main style={pageStyle}>
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />

        <header style={headerStyle}>
          <div style={dynamicHeaderInner}>
            <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
              <BrandWordmark compact={isMobile} top />
            </Link>

            <nav style={dynamicNavStyle}>
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} style={navLink}>
                  {link.label}
                </Link>
              ))}
              <Link href="/admin" style={navLink}>Admin</Link>
            </nav>
          </div>
        </header>

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
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />

      <header style={headerStyle}>
        <div style={dynamicHeaderInner}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <BrandWordmark compact={isMobile} top />
          </Link>

          <nav style={dynamicNavStyle}>
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/players'
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    ...navLink,
                    ...(isActive ? activeNavLink : {}),
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
            <Link href="/admin" style={navLink}>Admin</Link>
          </nav>
        </div>
      </header>

      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Player profile</div>

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
                      Switch between overall, singles, and doubles.
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
                  <StatChip label="Overall" value={formatRating(toRatingNumber(player.overall_dynamic_rating, 3.5))} />
                  <StatChip label="Singles" value={formatRating(toRatingNumber(player.singles_dynamic_rating ?? player.overall_dynamic_rating, 3.5))} />
                  <StatChip label="Doubles" value={formatRating(toRatingNumber(player.doubles_dynamic_rating ?? player.overall_dynamic_rating, 3.5))} />
                  <StatChip label="Tracked" value={String(totalMatches)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={contentWrap}>
        <div style={dynamicStatsGrid}>
          <article style={{ ...statCard, ...statCardAccentBlue }}>
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
              {formatRating(toRatingNumber(player.singles_dynamic_rating ?? player.overall_dynamic_rating, 3.5))}
            </div>
          </article>
          <article style={statCard}>
            <div style={statLabel}>Doubles</div>
            <div style={statValue}>
              {formatRating(toRatingNumber(player.doubles_dynamic_rating ?? player.overall_dynamic_rating, 3.5))}
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
                      <tr key={match.id} style={tableRow}>
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

      <footer style={footerStyle}>
        <div style={dynamicFooterInner}>
          <div style={dynamicFooterRow}>
            <Link href="/" style={footerBrandLink}>
              <BrandWordmark compact={false} footer />
            </Link>

            <div style={dynamicFooterLinks}>
              <Link href="/players" style={footerUtilityLink}>Players</Link>
              <Link href="/rankings" style={footerUtilityLink}>Rankings</Link>
              <Link href="/matchup" style={footerUtilityLink}>Matchup</Link>
              <Link href="/leagues" style={footerUtilityLink}>Leagues</Link>
              <Link href="/captains-corner" style={footerUtilityLink}>Captain&apos;s Corner</Link>
            </div>

            <div style={dynamicFooterBottom}>
              © {new Date().getFullYear()} TenAceIQ
            </div>
          </div>
        </div>
      </footer>
    </main>
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
      <div style={chipStatLabel}>{label}</div>
      <div style={chipStatValue}>{value}</div>
    </div>
  )
}

function BrandWordmark({
  compact = false,
  footer = false,
  top = false,
}: {
  compact?: boolean
  footer?: boolean
  top?: boolean
}) {
  const iconSize = compact ? 30 : top ? 38 : footer ? 36 : 34
  const fontSize = compact ? 24 : top ? 30 : footer ? 27 : 27

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '8px' : '10px',
        lineHeight: 1,
      }}
    >
      <Image
        src="/logo-icon.png"
        alt="TenAceIQ"
        width={iconSize}
        height={iconSize}
        priority
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'block',
          objectFit: 'contain',
        }}
      />

      <div
        style={{
          fontWeight: 900,
          letterSpacing: '-0.045em',
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'baseline',
        }}
      >
        <span style={{ color: footer ? '#FFFFFF' : '#F8FBFF' }}>TenAce</span>
        <span style={brandIQ}>IQ</span>
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

        <rect x="0" y="0" width={width} height={height} rx="20" fill="rgba(8, 20, 44, 0.9)" />

        {[0.2, 0.4, 0.6, 0.8].map((line, index) => {
          const y = padding + (height - padding * 2) * line
          return (
            <line
              key={index}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="rgba(167, 190, 255, 0.12)"
              strokeWidth="1"
            />
          )
        })}

        <path d={path} fill="none" stroke="url(#playerLineGradient)" strokeWidth="4" strokeLinecap="round" />

        {points.map((point, index) => {
          const x = padding + index * xStep
          const y =
            height - padding - ((point.rating - minRating) / spread) * (height - padding * 2)

          return (
            <g key={`${point.date}-${index}`}>
              <circle cx={x} cy={y} r="10" fill="rgba(37, 91, 227, 0.14)" />
              <circle cx={x} cy={y} r="4.5" fill="#dff7ff" />
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

const pageStyle = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at top, rgba(66,149,255,0.16), transparent 28%), linear-gradient(180deg, #07111f 0%, #0b1730 42%, #0d1b35 100%)',
} as const

const orbOne = {
  position: 'absolute',
  top: '-90px',
  left: '-110px',
  width: '340px',
  height: '340px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(84,163,255,0.18) 0%, rgba(84,163,255,0) 70%)',
  pointerEvents: 'none',
} as const

const orbTwo = {
  position: 'absolute',
  right: '-120px',
  top: '180px',
  width: '340px',
  height: '340px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(90,233,176,0.11) 0%, rgba(90,233,176,0) 68%)',
  pointerEvents: 'none',
} as const

const gridGlow = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)',
  backgroundRepeat: 'repeat, repeat',
  backgroundSize: '34px 34px, 34px 34px',
  maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent 88%)',
  pointerEvents: 'none',
} as const

const headerStyle = {
  position: 'relative',
  zIndex: 2,
  padding: '24px 18px 0',
} as const

const headerInner = {
  width: '100%',
  maxWidth: '1240px',
  margin: '0 auto',
  display: 'flex',
  justifyContent: 'space-between',
} as const

const brandWrap = {
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
} as const

const brandIQ = {
  background: 'linear-gradient(135deg, #4ade80 0%, #bbf7d0 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  marginLeft: '2px',
} as const

const navStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
} as const

const navLink = {
  color: 'rgba(231,243,255,0.9)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0.01em',
  padding: '10px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(122,170,255,0.16)',
  background: 'rgba(22,42,78,0.42)',
  backdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  transition: 'all 180ms ease',
} as const

const activeNavLink = {
  color: '#06111f',
  background: 'linear-gradient(135deg, #4ade80 0%, #86efac 100%)',
  border: '1px solid rgba(134,239,172,0.45)',
  boxShadow: '0 10px 30px rgba(74,222,128,0.22)',
} as const

const heroWrap = {
  position: 'relative',
  zIndex: 1,
} as const

const heroShell = {
  width: '100%',
  maxWidth: '1240px',
  margin: '0 auto',
  borderRadius: '30px',
  background:
    'linear-gradient(180deg, rgba(16,29,56,0.84) 0%, rgba(13,25,48,0.72) 100%)',
  border: '1px solid rgba(128,174,255,0.12)',
  boxShadow:
    '0 24px 80px rgba(6,18,42,0.24), inset 0 1px 0 rgba(255,255,255,0.05)',
  overflow: 'hidden',
  position: 'relative',
} as const

const heroNoise = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 10% 0%, rgba(88,161,255,0.16), transparent 26%), radial-gradient(circle at 100% 0%, rgba(74,222,128,0.08), transparent 30%)',
  pointerEvents: 'none',
} as const

const heroContent = {
  display: 'grid',
  alignItems: 'stretch',
  position: 'relative',
  zIndex: 1,
} as const

const heroLeft = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '16px',
  minWidth: 0,
} as const

const heroRight = {
  display: 'grid',
  gap: '14px',
  alignContent: 'start',
  minWidth: 0,
} as const

const eyebrow = {
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
} as const

const heroTitle = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  letterSpacing: '-0.045em',
} as const

const heroText = {
  margin: 0,
  color: 'rgba(224,236,249,0.86)',
  lineHeight: 1.65,
  fontWeight: 500,
} as const

const heroHintRow = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '4px',
} as const

const heroHintPill = {
  border: '1px solid rgba(137,182,255,0.14)',
  background: 'rgba(43,78,138,0.34)',
  color: '#e2efff',
  borderRadius: '999px',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
} as const

const meterCard = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(128,174,255,0.16)',
  background: 'linear-gradient(180deg, rgba(45,79,137,0.42) 0%, rgba(24,45,84,0.5) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  maxWidth: '560px',
} as const

const meterHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: '14px',
} as const

const meterLabel = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '22px',
  letterSpacing: '-0.03em',
} as const

const meterSubtext = {
  marginTop: '4px',
  color: 'rgba(220,231,244,0.78)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
} as const

const meterValueGroup = {
  textAlign: 'right',
} as const

const meterCurrent = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '32px',
  lineHeight: 1,
  letterSpacing: '-0.04em',
} as const

const meterTarget = {
  marginTop: '6px',
  color: '#bbf7d0',
  fontWeight: 800,
  fontSize: '13px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
} as const

const meterTrack = {
  width: '100%',
  height: '14px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.08)',
  overflow: 'hidden',
} as const

const meterFill = {
  height: '100%',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, rgba(103, 241, 154, 1), rgba(40, 205, 110, 0.94))',
  boxShadow: '0 10px 24px rgba(43, 195, 104, 0.22)',
} as const

const meterFooter = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginTop: '10px',
  color: 'rgba(214,228,248,0.74)',
  fontSize: '13px',
  fontWeight: 700,
} as const

const focusCard = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(128,174,255,0.16)',
  background: 'linear-gradient(180deg, rgba(45,79,137,0.42) 0%, rgba(24,45,84,0.5) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
} as const

const focusHead = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: '14px',
} as const

const focusLabel = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
} as const

const focusSubtitle = {
  marginTop: '4px',
  color: 'rgba(220,231,244,0.78)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
} as const

const secondaryMiniLink = {
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
} as const

const segmentWrap = {
  display: 'grid',
  gap: '10px',
  marginBottom: '14px',
} as const

const segmentButton = {
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.06)',
  color: '#f7fbff',
  minHeight: '52px',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
} as const

const segmentButtonActive = {
  background: 'linear-gradient(135deg, rgba(103, 241, 154, 1), rgba(40, 205, 110, 0.94))',
  color: '#071622',
  border: '1px solid rgba(111, 236, 168, 0.34)',
  boxShadow: '0 12px 30px rgba(43, 195, 104, 0.20), inset 0 1px 0 rgba(255,255,255,0.26)',
} as const

const focusMetrics = {
  display: 'grid',
  gap: '10px',
} as const

const summaryCard = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(128,174,255,0.16)',
  background: 'linear-gradient(180deg, rgba(45,79,137,0.42) 0%, rgba(24,45,84,0.5) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
} as const

const summaryTitle = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
  marginBottom: '14px',
} as const

const summaryStatsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
} as const

const chipStat = {
  borderRadius: '18px',
  padding: '12px 12px 11px',
  background: 'rgba(26,42,71,0.58)',
  border: '1px solid rgba(74,123,211,0.24)',
  minWidth: 0,
} as const

const chipStatAccent = {
  background: 'linear-gradient(135deg, rgba(31,102,74,0.92) 0%, rgba(42,162,96,0.84) 100%)',
  border: '1px solid rgba(134,239,172,0.24)',
} as const

const chipStatLabel = {
  color: 'rgba(198,214,230,0.74)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
} as const

const chipStatValue = {
  color: '#f8fbff',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
} as const

const statsGrid = {
  display: 'grid',
  gap: '16px',
  marginBottom: '16px',
} as const

const statCard = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  boxShadow: '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
} as const

const statCardAccentBlue = {
  border: '1px solid rgba(91, 162, 255, 0.26)',
  boxShadow: '0 14px 34px rgba(9,25,54,0.18), inset 0 0 0 1px rgba(59,130,246,0.08)',
} as const

const statLabel = {
  color: 'rgba(198,216,248,0.78)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 750,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
} as const

const statValue = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
} as const

const contentWrap = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '0 18px 0',
} as const

const contentGrid = {
  display: 'grid',
  gap: '16px',
} as const

const panelCard = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(133, 168, 229, 0.16)',
  background:
    'radial-gradient(circle at top right, rgba(184, 230, 26, 0.12), transparent 34%), linear-gradient(135deg, rgba(8, 34, 75, 0.98) 0%, rgba(4, 18, 45, 0.98) 58%, rgba(7, 36, 46, 0.98) 100%)',
  boxShadow: '0 28px 60px rgba(2, 8, 23, 0.28)',
  minWidth: 0,
} as const

const panelHead = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
} as const

const sectionKicker = {
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
} as const

const panelTitle = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
} as const

const panelChip = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(16, 39, 77, 0.84)',
  color: 'rgba(220, 232, 255, 0.92)',
  border: '1px solid rgba(82, 127, 201, 0.2)',
  fontWeight: 800,
  fontSize: '13px',
} as const

const emptyText = {
  margin: 0,
  color: 'rgba(220, 231, 252, 0.78)',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 550,
} as const

const tableWrap = {
  overflowX: 'auto' as const,
  borderRadius: '20px',
  border: '1px solid rgba(160, 185, 234, 0.12)',
  background: 'rgba(7, 20, 45, 0.62)',
} as const

const dataTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '760px',
} as const

const tableHead = {
  padding: '15px 16px',
  textAlign: 'left' as const,
  color: 'rgba(190, 210, 245, 0.8)',
  fontSize: '12px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  fontWeight: 800,
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(10, 27, 58, 0.78)',
  whiteSpace: 'nowrap' as const,
} as const

const tableRow = {} as const

const tableCell = {
  padding: '16px',
  color: '#e9f2ff',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 600,
  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  verticalAlign: 'top' as const,
} as const

const resultPill = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '2.4rem',
  padding: '0.35rem 0.65rem',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.04em',
} as const

const resultWin = {
  background: 'rgba(95, 223, 163, 0.14)',
  color: '#a9ffc8',
  border: '1px solid rgba(95, 223, 163, 0.2)',
} as const

const resultLoss = {
  background: 'rgba(255, 107, 107, 0.14)',
  color: '#ffc2c2',
  border: '1px solid rgba(255, 107, 107, 0.18)',
} as const

const loadingCard = {
  padding: '26px',
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(11, 22, 39, 0.82)',
  color: '#dfe8f8',
  fontWeight: 700,
  position: 'relative',
  zIndex: 1,
} as const

const errorCard = {
  padding: '22px',
  borderRadius: '28px',
  border: '1px solid rgba(255,100,100,0.2)',
  background: 'rgba(62,16,22,0.78)',
  position: 'relative',
  zIndex: 1,
} as const

const sectionTitle = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '30px',
  letterSpacing: '-0.04em',
} as const

const sectionText = {
  margin: '10px 0 0',
  color: 'rgba(232, 239, 248, 0.84)',
  lineHeight: 1.6,
} as const

const chartShell = {
  width: '100%',
} as const

const chartSvg = {
  width: '100%',
  height: 'auto',
  display: 'block',
  overflow: 'visible',
} as const

const chartMeta = {
  marginTop: '0.9rem',
  color: 'rgba(219, 230, 255, 0.78)',
  fontSize: '0.9rem',
  fontWeight: 600,
} as const

const footerStyle = {
  position: 'relative',
  zIndex: 2,
  padding: '28px 18px 20px',
} as const

const footerInner = {
  width: '100%',
  maxWidth: '1240px',
  margin: '0 auto',
  borderRadius: '22px',
  background: 'rgba(17,31,58,0.72)',
  border: '1px solid rgba(128,174,255,0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
} as const

const footerRow = {
  display: 'flex',
  width: '100%',
} as const

const footerBrandLink = {
  display: 'inline-flex',
  textDecoration: 'none',
  flexShrink: 0,
} as const

const footerLinks = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '10px 14px',
} as const

const footerUtilityLink = {
  color: 'rgba(231,243,255,0.86)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
} as const

const footerBottom = {
  color: 'rgba(190,205,224,0.74)',
  fontSize: '13px',
  fontWeight: 600,
  whiteSpace: 'nowrap' as const,
} as const
