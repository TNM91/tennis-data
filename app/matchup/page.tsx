'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type RatingView = 'overall' | 'singles' | 'doubles'
type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'

type Player = {
  id: string
  name: string
  location?: string | null
  overall_dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
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
  players:
    | {
        id: string
        name: string
      }
    | {
        id: string
        name: string
      }[]
    | null
}

type HeadToHeadState = {
  total: number
  winsA: number
  winsB: number
  singlesA: number
  singlesB: number
  doublesA: number
  doublesB: number
  lastMatch: {
    matchDate: string
    matchType: MatchType
    score: string
    winner: 'A' | 'B'
  } | null
}

type ComparisonState = {
  leftLabel: string
  rightLabel: string
  leftLocation: string
  rightLocation: string
  leftRatings: {
    overall: number
    singles: number
    doubles: number
  }
  rightRatings: {
    overall: number
    singles: number
    doubles: number
  }
  leftSelected: number
  rightSelected: number
  gap: number
  higherRatedLabel: string
  leftProfileHref: string | null
  rightProfileHref: string | null
}

const RATING_DIVISOR = 0.35

export default function MatchupPage() {

  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [headToHeadLoading, setHeadToHeadLoading] = useState(false)

  const [matchType, setMatchType] = useState<MatchType>('singles')

  const [playerAId, setPlayerAId] = useState('')
  const [playerBId, setPlayerBId] = useState('')

  const [teamA1Id, setTeamA1Id] = useState('')
  const [teamA2Id, setTeamA2Id] = useState('')
  const [teamB1Id, setTeamB1Id] = useState('')
  const [teamB2Id, setTeamB2Id] = useState('')

  const [ratingView, setRatingView] = useState<RatingView>('overall')
  const [headToHead, setHeadToHead] = useState<HeadToHeadState | null>(null)

  useEffect(() => {
    void loadPlayers()
  }, [])

useEffect(() => {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)

  const playerAFromUrl = params.get('playerA') || ''
  const playerBFromUrl = params.get('playerB') || ''

  if (playerAFromUrl) setPlayerAId(playerAFromUrl)
  if (playerBFromUrl) setPlayerBId(playerBFromUrl)
}, [])

  useEffect(() => {
    if (matchType === 'singles') {
      setTeamA1Id('')
      setTeamA2Id('')
      setTeamB1Id('')
      setTeamB2Id('')
    } else {
      setPlayerAId('')
      setPlayerBId('')
    }
    setHeadToHead(null)
  }, [matchType])

  useEffect(() => {
    if (matchType === 'singles') {
      if (playerAId && playerBId && playerAId !== playerBId) {
        void loadSinglesHeadToHead(playerAId, playerBId)
      } else {
        setHeadToHead(null)
      }
      return
    }

    if (
      teamA1Id &&
      teamA2Id &&
      teamB1Id &&
      teamB2Id &&
      areUniqueIds([teamA1Id, teamA2Id, teamB1Id, teamB2Id])
    ) {
      void loadDoublesHeadToHead([teamA1Id, teamA2Id], [teamB1Id, teamB2Id])
    } else {
      setHeadToHead(null)
    }
  }, [matchType, playerAId, playerBId, teamA1Id, teamA2Id, teamB1Id, teamB2Id])

  async function loadPlayers() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          location,
          overall_dynamic_rating,
          singles_dynamic_rating,
          doubles_dynamic_rating
        `)
        .order('name', { ascending: true })

      if (error) {
        throw new Error(error.message)
      }

      setPlayers((data || []) as Player[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  async function loadSinglesHeadToHead(playerAIdValue: string, playerBIdValue: string) {
    setHeadToHeadLoading(true)

    try {
      const { data: aRefs, error: aRefsError } = await supabase
        .from('match_players')
        .select('match_id')
        .eq('player_id', playerAIdValue)

      if (aRefsError) throw new Error(aRefsError.message)

      const matchIds = [...new Set((aRefs || []).map((row) => row.match_id))]

      if (matchIds.length === 0) {
        setEmptyHeadToHead()
        return
      }

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

      if (matchesError) throw new Error(matchesError.message)

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

      const typedMatches = (matchesData || []) as MatchRow[]
      const typedParticipants = (participantsData || []) as MatchPlayerRow[]

      const participantsByMatchId = new Map<string, MatchPlayerRow[]>()

      for (const participant of typedParticipants) {
        const existing = participantsByMatchId.get(participant.match_id) ?? []
        existing.push(participant)
        participantsByMatchId.set(participant.match_id, existing)
      }

      let total = 0
      let winsA = 0
      let winsB = 0
      let singlesA = 0
      let singlesB = 0
      let doublesA = 0
      let doublesB = 0
      let lastMatch: HeadToHeadState['lastMatch'] = null

      for (const match of typedMatches) {
        const participants = participantsByMatchId.get(match.id) ?? []

        const participantA = participants.find((p) => p.player_id === playerAIdValue)
        const participantB = participants.find((p) => p.player_id === playerBIdValue)

        if (!participantA || !participantB) continue
        if (participantA.side === participantB.side) continue

        total += 1

        const playerAWon = participantA.side === match.winner_side

        if (playerAWon) {
          winsA += 1
          if (match.match_type === 'singles') singlesA += 1
          else doublesA += 1
        } else {
          winsB += 1
          if (match.match_type === 'singles') singlesB += 1
          else doublesB += 1
        }

        if (
          !lastMatch ||
          new Date(match.match_date).getTime() > new Date(lastMatch.matchDate).getTime()
        ) {
          lastMatch = {
            matchDate: match.match_date,
            matchType: match.match_type,
            score: match.score,
            winner: playerAWon ? 'A' : 'B',
          }
        }
      }

      setHeadToHead({
        total,
        winsA,
        winsB,
        singlesA,
        singlesB,
        doublesA,
        doublesB,
        lastMatch,
      })
    } catch (err) {
      console.error('Failed to load singles head-to-head', err)
      setHeadToHead(null)
    } finally {
      setHeadToHeadLoading(false)
    }
  }

  async function loadDoublesHeadToHead(teamAIds: string[], teamBIds: string[]) {
    setHeadToHeadLoading(true)

    try {
      const { data: teamARefs, error: teamARefsError } = await supabase
        .from('match_players')
        .select('match_id')
        .in('player_id', teamAIds)

      if (teamARefsError) throw new Error(teamARefsError.message)

      const candidateMatchIds = [...new Set((teamARefs || []).map((row) => row.match_id))]

      if (candidateMatchIds.length === 0) {
        setEmptyHeadToHead()
        return
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          match_date,
          match_type,
          score,
          winner_side
        `)
        .in('id', candidateMatchIds)
        .eq('match_type', 'doubles')

      if (matchesError) throw new Error(matchesError.message)

      const doublesMatchIds = (matchesData || []).map((m) => m.id)

      if (doublesMatchIds.length === 0) {
        setEmptyHeadToHead()
        return
      }

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
        .in('match_id', doublesMatchIds)

      if (participantsError) throw new Error(participantsError.message)

      const typedMatches = (matchesData || []) as MatchRow[]
      const typedParticipants = (participantsData || []) as MatchPlayerRow[]
      const participantsByMatchId = new Map<string, MatchPlayerRow[]>()

      for (const participant of typedParticipants) {
        const existing = participantsByMatchId.get(participant.match_id) ?? []
        existing.push(participant)
        participantsByMatchId.set(participant.match_id, existing)
      }

      const normalizedTeamA = normalizeIdSet(teamAIds)
      const normalizedTeamB = normalizeIdSet(teamBIds)

      let total = 0
      let winsA = 0
      let winsB = 0
      let singlesA = 0
      let singlesB = 0
      let doublesA = 0
      let doublesB = 0
      let lastMatch: HeadToHeadState['lastMatch'] = null

      for (const match of typedMatches) {
        const participants = participantsByMatchId.get(match.id) ?? []

        const sideAIds = participants.filter((p) => p.side === 'A').map((p) => p.player_id)
        const sideBIds = participants.filter((p) => p.side === 'B').map((p) => p.player_id)

        const normalizedSideA = normalizeIdSet(sideAIds)
        const normalizedSideB = normalizeIdSet(sideBIds)

        let teamASide: MatchSide | null = null

        if (normalizedSideA === normalizedTeamA && normalizedSideB === normalizedTeamB) {
          teamASide = 'A'
        } else if (normalizedSideA === normalizedTeamB && normalizedSideB === normalizedTeamA) {
          teamASide = 'B'
        } else {
          continue
        }

        total += 1

        const teamAWon = teamASide === match.winner_side

        if (teamAWon) {
          winsA += 1
          doublesA += 1
        } else {
          winsB += 1
          doublesB += 1
        }

        if (
          !lastMatch ||
          new Date(match.match_date).getTime() > new Date(lastMatch.matchDate).getTime()
        ) {
          lastMatch = {
            matchDate: match.match_date,
            matchType: match.match_type,
            score: match.score,
            winner: teamAWon ? 'A' : 'B',
          }
        }
      }

      setHeadToHead({
        total,
        winsA,
        winsB,
        singlesA,
        singlesB,
        doublesA,
        doublesB,
        lastMatch,
      })
    } catch (err) {
      console.error('Failed to load doubles head-to-head', err)
      setHeadToHead(null)
    } finally {
      setHeadToHeadLoading(false)
    }
  }

  function setEmptyHeadToHead() {
    setHeadToHead({
      total: 0,
      winsA: 0,
      winsB: 0,
      singlesA: 0,
      singlesB: 0,
      doublesA: 0,
      doublesB: 0,
      lastMatch: null,
    })
  }

  const playerA = useMemo(
    () => players.find((player) => player.id === playerAId) || null,
    [players, playerAId]
  )

  const playerB = useMemo(
    () => players.find((player) => player.id === playerBId) || null,
    [players, playerBId]
  )

  const teamA1 = useMemo(
    () => players.find((player) => player.id === teamA1Id) || null,
    [players, teamA1Id]
  )
  const teamA2 = useMemo(
    () => players.find((player) => player.id === teamA2Id) || null,
    [players, teamA2Id]
  )
  const teamB1 = useMemo(
    () => players.find((player) => player.id === teamB1Id) || null,
    [players, teamB1Id]
  )
  const teamB2 = useMemo(
    () => players.find((player) => player.id === teamB2Id) || null,
    [players, teamB2Id]
  )

  const singlesSelected = !!playerA && !!playerB && playerAId !== playerBId
  const doublesSelected =
    !!teamA1 &&
    !!teamA2 &&
    !!teamB1 &&
    !!teamB2 &&
    areUniqueIds([teamA1Id, teamA2Id, teamB1Id, teamB2Id])

  const availablePlayersForA = useMemo(
    () => players.filter((player) => player.id !== playerBId),
    [players, playerBId]
  )

  const availablePlayersForB = useMemo(
    () => players.filter((player) => player.id !== playerAId),
    [players, playerAId]
  )

  const availableTeamA1 = useMemo(
    () => players.filter((player) => ![teamA2Id, teamB1Id, teamB2Id].includes(player.id)),
    [players, teamA2Id, teamB1Id, teamB2Id]
  )

  const availableTeamA2 = useMemo(
    () => players.filter((player) => ![teamA1Id, teamB1Id, teamB2Id].includes(player.id)),
    [players, teamA1Id, teamB1Id, teamB2Id]
  )

  const availableTeamB1 = useMemo(
    () => players.filter((player) => ![teamA1Id, teamA2Id, teamB2Id].includes(player.id)),
    [players, teamA1Id, teamA2Id, teamB2Id]
  )

  const availableTeamB2 = useMemo(
    () => players.filter((player) => ![teamA1Id, teamA2Id, teamB1Id].includes(player.id)),
    [players, teamA1Id, teamA2Id, teamB1Id]
  )

  const comparison = useMemo<ComparisonState | null>(() => {
    if (matchType === 'singles') {
      if (!singlesSelected || !playerA || !playerB) return null

      const left = getSelectedRating(playerA, ratingView)
      const right = getSelectedRating(playerB, ratingView)
      const gap = Math.abs(left - right)

      return {
        leftLabel: playerA.name,
        rightLabel: playerB.name,
        leftLocation: playerA.location || 'No location set',
        rightLocation: playerB.location || 'No location set',
        leftRatings: {
          overall: getSelectedRating(playerA, 'overall'),
          singles: getSelectedRating(playerA, 'singles'),
          doubles: getSelectedRating(playerA, 'doubles'),
        },
        rightRatings: {
          overall: getSelectedRating(playerB, 'overall'),
          singles: getSelectedRating(playerB, 'singles'),
          doubles: getSelectedRating(playerB, 'doubles'),
        },
        leftSelected: left,
        rightSelected: right,
        gap,
        higherRatedLabel:
          left === right
            ? 'Even matchup'
            : left > right
              ? `${playerA.name} leads`
              : `${playerB.name} leads`,
        leftProfileHref: `/players/${playerA.id}`,
        rightProfileHref: `/players/${playerB.id}`,
      }
    }

    if (!doublesSelected || !teamA1 || !teamA2 || !teamB1 || !teamB2) return null

    const teamALabel = `${teamA1.name} / ${teamA2.name}`
    const teamBLabel = `${teamB1.name} / ${teamB2.name}`

    const teamARatings = {
      overall: average([getSelectedRating(teamA1, 'overall'), getSelectedRating(teamA2, 'overall')]),
      singles: average([getSelectedRating(teamA1, 'singles'), getSelectedRating(teamA2, 'singles')]),
      doubles: average([getSelectedRating(teamA1, 'doubles'), getSelectedRating(teamA2, 'doubles')]),
    }

    const teamBRatings = {
      overall: average([getSelectedRating(teamB1, 'overall'), getSelectedRating(teamB2, 'overall')]),
      singles: average([getSelectedRating(teamB1, 'singles'), getSelectedRating(teamB2, 'singles')]),
      doubles: average([getSelectedRating(teamB1, 'doubles'), getSelectedRating(teamB2, 'doubles')]),
    }

    const left =
      ratingView === 'overall'
        ? teamARatings.overall
        : ratingView === 'singles'
          ? teamARatings.singles
          : teamARatings.doubles

    const right =
      ratingView === 'overall'
        ? teamBRatings.overall
        : ratingView === 'singles'
          ? teamBRatings.singles
          : teamBRatings.doubles

    const gap = Math.abs(left - right)

    return {
      leftLabel: teamALabel,
      rightLabel: teamBLabel,
      leftLocation: 'Team A',
      rightLocation: 'Team B',
      leftRatings: teamARatings,
      rightRatings: teamBRatings,
      leftSelected: left,
      rightSelected: right,
      gap,
      higherRatedLabel:
        left === right
          ? 'Even matchup'
          : left > right
            ? `${teamALabel} leads`
            : `${teamBLabel} leads`,
      leftProfileHref: null,
      rightProfileHref: null,
    }
  }, [
    matchType,
    singlesSelected,
    doublesSelected,
    playerA,
    playerB,
    teamA1,
    teamA2,
    teamB1,
    teamB2,
    ratingView,
  ])

  const projection = useMemo(() => {
    if (!comparison) return null

    const leftWinProbability = expectedScore(comparison.leftSelected, comparison.rightSelected)
    const rightWinProbability = 1 - leftWinProbability

    const likelyWinner =
      leftWinProbability === rightWinProbability
        ? 'Even'
        : leftWinProbability > rightWinProbability
          ? comparison.leftLabel
          : comparison.rightLabel

    return {
      leftWinProbability,
      rightWinProbability,
      likelyWinner,
      confidenceLabel: getConfidenceLabel(Math.abs(leftWinProbability - rightWinProbability)),
    }
  }, [comparison])

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Matchup Comparison</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Compare singles players or doubles teams across overall, singles, or doubles dynamic ratings.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={modeContainerStyle}>
          <button
            onClick={() => setMatchType('singles')}
            style={{
              ...segmentButtonStyle,
              ...(matchType === 'singles' ? activeSegmentButtonStyle : {}),
            }}
          >
            Singles
          </button>
          <button
            onClick={() => setMatchType('doubles')}
            style={{
              ...segmentButtonStyle,
              ...(matchType === 'doubles' ? activeSegmentButtonStyle : {}),
            }}
          >
            Doubles
          </button>
        </div>

        <div style={toolbarStyle}>
          {matchType === 'singles' ? (
            <div style={selectGridStyle}>
              <div>
                <label style={labelStyle}>Player A</label>
                <select
                  value={playerAId}
                  onChange={(e) => setPlayerAId(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="">Select player</option>
                  {availablePlayersForA.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Player B</label>
                <select
                  value={playerBId}
                  onChange={(e) => setPlayerBId(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="">Select player</option>
                  {availablePlayersForB.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div style={doublesGridStyle}>
              <div>
                <label style={labelStyle}>Team A - Player 1</label>
                <select
                  value={teamA1Id}
                  onChange={(e) => setTeamA1Id(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="">Select player</option>
                  {availableTeamA1.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Team A - Player 2</label>
                <select
                  value={teamA2Id}
                  onChange={(e) => setTeamA2Id(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="">Select player</option>
                  {availableTeamA2.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Team B - Player 1</label>
                <select
                  value={teamB1Id}
                  onChange={(e) => setTeamB1Id(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="">Select player</option>
                  {availableTeamB1.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Team B - Player 2</label>
                <select
                  value={teamB2Id}
                  onChange={(e) => setTeamB2Id(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="">Select player</option>
                  {availableTeamB2.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div style={segmentContainerStyle}>
            <button
              onClick={() => setRatingView('overall')}
              style={{
                ...segmentButtonStyle,
                ...(ratingView === 'overall' ? activeSegmentButtonStyle : {}),
              }}
            >
              Overall
            </button>
            <button
              onClick={() => setRatingView('singles')}
              style={{
                ...segmentButtonStyle,
                ...(ratingView === 'singles' ? activeSegmentButtonStyle : {}),
              }}
            >
              Singles
            </button>
            <button
              onClick={() => setRatingView('doubles')}
              style={{
                ...segmentButtonStyle,
                ...(ratingView === 'doubles' ? activeSegmentButtonStyle : {}),
              }}
            >
              Doubles
            </button>
          </div>
        </div>

        {error && (
          <div style={errorBoxStyle}>
            <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
          </div>
        )}

        {loading ? (
          <div style={{ marginTop: '18px', color: '#64748b' }}>Loading players...</div>
        ) : !comparison ? (
          <div style={emptyStateStyle}>
            {matchType === 'singles'
              ? `Select two different players to compare their ${ratingView} ratings.`
              : `Select four different players to compare doubles teams using ${ratingView} ratings.`}
          </div>
        ) : (
          <>
            <div style={comparisonGridStyle}>
              <div style={playerCardStyle}>
                <div style={playerCardHeaderStyle}>
                  <div>
                    <div style={playerNameStyle}>{comparison.leftLabel}</div>
                    <div style={playerMetaStyle}>{comparison.leftLocation}</div>
                  </div>

                  {comparison.leftProfileHref ? (
                    <Link href={comparison.leftProfileHref} style={profileLinkStyle}>
                      View Profile
                    </Link>
                  ) : null}
                </div>

                <div style={ratingGridStyle}>
                  <RatingPill
                    label="Overall"
                    value={comparison.leftRatings.overall}
                    active={ratingView === 'overall'}
                  />
                  <RatingPill
                    label="Singles"
                    value={comparison.leftRatings.singles}
                    active={ratingView === 'singles'}
                  />
                  <RatingPill
                    label="Doubles"
                    value={comparison.leftRatings.doubles}
                    active={ratingView === 'doubles'}
                  />
                </div>

                <div style={highlightBoxStyle}>
                  <div style={highlightLabelStyle}>Selected Rating</div>
                  <div style={highlightValueStyle}>
                    {formatRating(comparison.leftSelected)}
                  </div>
                </div>
              </div>

              <div style={centerComparisonCardStyle}>
                <div style={vsBadgeStyle}>VS</div>

                <div style={gapCardStyle}>
                  <div style={gapLabelStyle}>{capitalize(ratingView)} Rating Gap</div>
                  <div style={gapValueStyle}>
                    {formatRating(comparison.gap)}
                  </div>
                  <div style={gapMetaStyle}>{comparison.higherRatedLabel}</div>
                </div>
              </div>

              <div style={playerCardStyle}>
                <div style={playerCardHeaderStyle}>
                  <div>
                    <div style={playerNameStyle}>{comparison.rightLabel}</div>
                    <div style={playerMetaStyle}>{comparison.rightLocation}</div>
                  </div>

                  {comparison.rightProfileHref ? (
                    <Link href={comparison.rightProfileHref} style={profileLinkStyle}>
                      View Profile
                    </Link>
                  ) : null}
                </div>

                <div style={ratingGridStyle}>
                  <RatingPill
                    label="Overall"
                    value={comparison.rightRatings.overall}
                    active={ratingView === 'overall'}
                  />
                  <RatingPill
                    label="Singles"
                    value={comparison.rightRatings.singles}
                    active={ratingView === 'singles'}
                  />
                  <RatingPill
                    label="Doubles"
                    value={comparison.rightRatings.doubles}
                    active={ratingView === 'doubles'}
                  />
                </div>

                <div style={highlightBoxStyle}>
                  <div style={highlightLabelStyle}>Selected Rating</div>
                  <div style={highlightValueStyle}>
                    {formatRating(comparison.rightSelected)}
                  </div>
                </div>
              </div>
            </div>

            <div style={summaryCardStyle}>
              <h2 style={{ marginTop: 0 }}>Quick Read</h2>
              <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>
                In <strong>{ratingView}</strong>,{' '}
                {comparison.leftSelected === comparison.rightSelected
                  ? `${comparison.leftLabel} and ${comparison.rightLabel} are currently even at ${formatRating(comparison.leftSelected)}.`
                  : comparison.leftSelected > comparison.rightSelected
                    ? `${comparison.leftLabel} leads ${comparison.rightLabel} by ${formatRating(comparison.gap)} points.`
                    : `${comparison.rightLabel} leads ${comparison.leftLabel} by ${formatRating(comparison.gap)} points.`}
              </p>
            </div>

            {projection && (
              <div style={summaryCardStyle}>
                <h2 style={{ marginTop: 0 }}>Projection</h2>

                <div style={projectionGridStyle}>
                  <div style={projectionStatCardStyle}>
                    <div style={projectionLabelStyle}>{comparison.leftLabel} win likelihood</div>
                    <div style={projectionValueStyle}>
                      {(projection.leftWinProbability * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div style={projectionStatCardStyle}>
                    <div style={projectionLabelStyle}>{comparison.rightLabel} win likelihood</div>
                    <div style={projectionValueStyle}>
                      {(projection.rightWinProbability * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div style={projectionStatCardStyle}>
                    <div style={projectionLabelStyle}>Projected winner</div>
                    <div style={projectionValueStyle}>{projection.likelyWinner}</div>
                  </div>

                  <div style={projectionStatCardStyle}>
                    <div style={projectionLabelStyle}>Projection confidence</div>
                    <div style={projectionValueStyle}>{projection.confidenceLabel}</div>
                  </div>
                </div>

                <p style={{ marginTop: '14px', color: '#64748b', lineHeight: 1.6 }}>
                  This projection is based on the selected dynamic rating gap only. It is a simple estimate,
                  not a validated historical accuracy score.
                </p>
              </div>
            )}

            <div style={summaryCardStyle}>
              <h2 style={{ marginTop: 0 }}>Head-to-Head</h2>

              {headToHeadLoading ? (
                <p style={{ margin: 0, color: '#64748b' }}>Loading head-to-head...</p>
              ) : !headToHead || headToHead.total === 0 ? (
                <p style={{ margin: 0, color: '#64748b' }}>No head-to-head matches found.</p>
              ) : (
                <>
                  <div style={projectionGridStyle}>
                    <div style={projectionStatCardStyle}>
                      <div style={projectionLabelStyle}>Total Matches</div>
                      <div style={projectionValueStyle}>{headToHead.total}</div>
                    </div>

                    <div style={projectionStatCardStyle}>
                      <div style={projectionLabelStyle}>Overall Record</div>
                      <div style={projectionValueStyle}>
                        {headToHead.winsA} - {headToHead.winsB}
                      </div>
                      <div style={miniMetaStyle}>
                        {comparison.leftLabel} vs {comparison.rightLabel}
                      </div>
                    </div>

                    <div style={projectionStatCardStyle}>
                      <div style={projectionLabelStyle}>Singles Record</div>
                      <div style={projectionValueStyle}>
                        {headToHead.singlesA} - {headToHead.singlesB}
                      </div>
                    </div>

                    <div style={projectionStatCardStyle}>
                      <div style={projectionLabelStyle}>Doubles Record</div>
                      <div style={projectionValueStyle}>
                        {headToHead.doublesA} - {headToHead.doublesB}
                      </div>
                    </div>
                  </div>

                  {headToHead.lastMatch && (
                    <p style={{ marginTop: '14px', color: '#334155', lineHeight: 1.6 }}>
                      <strong>Last match:</strong> {headToHead.lastMatch.matchDate} •{' '}
                      {capitalize(headToHead.lastMatch.matchType)} • {headToHead.lastMatch.score} • Winner:{' '}
                      {headToHead.lastMatch.winner === 'A'
                        ? comparison.leftLabel
                        : comparison.rightLabel}
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function RatingPill({
  label,
  value,
  active,
}: {
  label: string
  value: number
  active: boolean
}) {
  return (
    <div
      style={{
        ...ratingPillStyle,
        ...(active ? activeRatingPillStyle : {}),
      }}
    >
      <div style={ratingPillLabelStyle}>{label}</div>
      <div style={ratingPillValueStyle}>{formatRating(value)}</div>
    </div>
  )
}

function getSelectedRating(player: Player, view: RatingView) {
  if (view === 'singles') {
    return toRatingNumber(player.singles_dynamic_rating, 3.5)
  }

  if (view === 'doubles') {
    return toRatingNumber(player.doubles_dynamic_rating, 3.5)
  }

  return toRatingNumber(player.overall_dynamic_rating, 3.5)
}

function toRatingNumber(value: number | null | undefined, fallback = 3.5) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function formatRating(value: number) {
  return value.toFixed(2)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function expectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / RATING_DIVISOR))
}

function getConfidenceLabel(probabilityGap: number) {
  if (probabilityGap >= 0.35) return 'High'
  if (probabilityGap >= 0.2) return 'Medium'
  return 'Low'
}

function average(values: number[]) {
  if (values.length === 0) return 3.5
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function areUniqueIds(ids: string[]) {
  const filtered = ids.filter(Boolean)
  return filtered.length === new Set(filtered).size
}

function normalizeIdSet(ids: string[]) {
  return [...ids].sort().join('|')
}

const mainStyle = {
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
  maxWidth: '1250px',
  margin: '0 auto',
  background: '#f8fafc',
  minHeight: '100vh',
}

const navRowStyle = {
  display: 'flex',
  gap: '12px',
  marginBottom: '24px',
  flexWrap: 'wrap' as const,
}

const navLinkStyle = {
  padding: '10px 14px',
  border: '1px solid #dbeafe',
  borderRadius: '999px',
  textDecoration: 'none',
  color: '#1e3a8a',
  background: '#eff6ff',
  fontWeight: 600,
}

const heroCardStyle = {
  background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
  color: 'white',
  borderRadius: '20px',
  padding: '28px',
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.20)',
  marginBottom: '22px',
}

const cardStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
  marginBottom: '22px',
}

const modeContainerStyle = {
  display: 'inline-flex',
  gap: '8px',
  padding: '6px',
  background: '#eff6ff',
  borderRadius: '16px',
  border: '1px solid #dbeafe',
  marginBottom: '18px',
}

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap' as const,
}

const selectGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '12px',
  flex: 1,
  minWidth: '320px',
}

const doublesGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  flex: 1,
  minWidth: '320px',
}

const labelStyle = {
  display: 'block',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: '8px',
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '14px',
  fontSize: '15px',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
  background: 'white',
}

const segmentContainerStyle = {
  display: 'flex',
  gap: '8px',
  padding: '6px',
  background: '#eff6ff',
  borderRadius: '16px',
  border: '1px solid #dbeafe',
}

const segmentButtonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: '12px',
  background: 'transparent',
  color: '#1e3a8a',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '14px',
}

const activeSegmentButtonStyle = {
  background: '#2563eb',
  color: 'white',
}

const errorBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#fee2e2',
  border: '1px solid #fca5a5',
  color: '#991b1b',
}

const emptyStateStyle = {
  marginTop: '18px',
  padding: '18px',
  borderRadius: '16px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: '#64748b',
}

const comparisonGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 1fr) minmax(180px, 220px) minmax(280px, 1fr)',
  gap: '18px',
  marginTop: '22px',
}

const playerCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const playerCardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '16px',
}

const playerNameStyle = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 800,
}

const playerMetaStyle = {
  color: '#64748b',
  fontSize: '14px',
  marginTop: '4px',
}

const profileLinkStyle = {
  display: 'inline-block',
  padding: '8px 10px',
  borderRadius: '10px',
  background: '#eff6ff',
  color: '#1d4ed8',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '13px',
  whiteSpace: 'nowrap' as const,
}

const ratingGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(90px, 1fr))',
  gap: '10px',
  marginBottom: '16px',
}

const ratingPillStyle = {
  background: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '12px',
}

const activeRatingPillStyle = {
  border: '1px solid #93c5fd',
  background: '#eff6ff',
}

const ratingPillLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  marginBottom: '4px',
}

const ratingPillValueStyle = {
  color: '#0f172a',
  fontSize: '20px',
  fontWeight: 800,
}

const highlightBoxStyle = {
  background: 'white',
  border: '1px solid #dbeafe',
  borderRadius: '16px',
  padding: '16px',
}

const highlightLabelStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginBottom: '6px',
}

const highlightValueStyle = {
  color: '#1d4ed8',
  fontSize: '32px',
  fontWeight: 900,
}

const centerComparisonCardStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
}

const vsBadgeStyle = {
  width: '72px',
  height: '72px',
  borderRadius: '999px',
  background: '#2563eb',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  fontSize: '22px',
  boxShadow: '0 12px 24px rgba(37, 99, 235, 0.20)',
}

const gapCardStyle = {
  width: '100%',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
  textAlign: 'center' as const,
}

const gapLabelStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginBottom: '6px',
}

const gapValueStyle = {
  color: '#0f172a',
  fontSize: '32px',
  fontWeight: 900,
}

const gapMetaStyle = {
  color: '#1d4ed8',
  fontSize: '14px',
  fontWeight: 700,
  marginTop: '8px',
}

const summaryCardStyle = {
  marginTop: '20px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const projectionGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
}

const projectionStatCardStyle = {
  background: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '14px',
}

const projectionLabelStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginBottom: '6px',
}

const projectionValueStyle = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 800,
}

const miniMetaStyle = {
  color: '#64748b',
  fontSize: '12px',
  marginTop: '6px',
}