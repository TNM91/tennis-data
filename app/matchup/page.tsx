'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type RatingView = 'overall' | 'singles' | 'doubles'
type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'
type AccuracyBand = 'high' | 'medium' | 'low'

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
  favoredSide: 'left' | 'right' | 'even'
  leftProfileHref: string | null
  rightProfileHref: string | null
  engineRatingView: RatingView
}

type ProjectionState = {
  leftWinProbability: number
  rightWinProbability: number
  likelyWinner: string
  confidenceLabel: string
  upsetIndicator: string
  expectedOutcome: string
  ratingDiffText: string
  favoriteEdgeText: string
  favoriteLabel: string
  underdogLabel: string
}

type AccuracyState = {
  overall: number | null
  high: number | null
  medium: number | null
  low: number | null
  sampleSize: number
}

const DEFAULT_RATING = 3.0
const RATING_DIVISOR = 0.35

export default function MatchupPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [headToHeadLoading, setHeadToHeadLoading] = useState(false)
  const [accuracyLoading, setAccuracyLoading] = useState(false)

  const [matchType, setMatchType] = useState<MatchType>('singles')

  const [playerAId, setPlayerAId] = useState('')
  const [playerBId, setPlayerBId] = useState('')

  const [teamA1Id, setTeamA1Id] = useState('')
  const [teamA2Id, setTeamA2Id] = useState('')
  const [teamB1Id, setTeamB1Id] = useState('')
  const [teamB2Id, setTeamB2Id] = useState('')

  const [ratingView, setRatingView] = useState<RatingView>('overall')
  const [headToHead, setHeadToHead] = useState<HeadToHeadState | null>(null)
  const [accuracy, setAccuracy] = useState<AccuracyState>({
    overall: null,
    high: null,
    medium: null,
    low: null,
    sampleSize: 0,
  })

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

  useEffect(() => {
    if (!players.length) return
    void loadPredictionAccuracy()
  }, [players, matchType])

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

      if (error) throw new Error(error.message)

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

  async function loadPredictionAccuracy() {
    setAccuracyLoading(true)

    try {
      const engineView = getEngineRatingView(matchType)

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          match_date,
          match_type,
          score,
          winner_side
        `)
        .eq('match_type', matchType)
        .order('match_date', { ascending: false })
        .limit(500)

      if (matchesError) throw new Error(matchesError.message)

      const typedMatches = (matchesData || []) as MatchRow[]
      const matchIds = typedMatches.map((match) => match.id)

      if (!matchIds.length) {
        setAccuracy({
          overall: null,
          high: null,
          medium: null,
          low: null,
          sampleSize: 0,
        })
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
        .in('match_id', matchIds)

      if (participantsError) throw new Error(participantsError.message)

      const typedParticipants = (participantsData || []) as MatchPlayerRow[]
      const participantsByMatchId = new Map<string, MatchPlayerRow[]>()

      for (const participant of typedParticipants) {
        const existing = participantsByMatchId.get(participant.match_id) ?? []
        existing.push(participant)
        participantsByMatchId.set(participant.match_id, existing)
      }

      let overallTotal = 0
      let overallCorrect = 0
      let highTotal = 0
      let highCorrect = 0
      let mediumTotal = 0
      let mediumCorrect = 0
      let lowTotal = 0
      let lowCorrect = 0

      for (const match of typedMatches) {
        const participants = participantsByMatchId.get(match.id) ?? []

        if (matchType === 'singles') {
          const leftParticipant = participants.find((p) => p.side === 'A')
          const rightParticipant = participants.find((p) => p.side === 'B')
          if (!leftParticipant || !rightParticipant) continue

          const leftPlayer = players.find((player) => player.id === leftParticipant.player_id)
          const rightPlayer = players.find((player) => player.id === rightParticipant.player_id)
          if (!leftPlayer || !rightPlayer) continue

          const leftRating = getSelectedRating(leftPlayer, engineView)
          const rightRating = getSelectedRating(rightPlayer, engineView)
          if (leftRating === rightRating) continue

          const leftWinProbability = expectedScore(leftRating, rightRating)
          const predictedWinner: MatchSide = leftWinProbability >= 0.5 ? 'A' : 'B'
          const band = getAccuracyBand(leftWinProbability)
          const wasCorrect = predictedWinner === match.winner_side

          overallTotal += 1
          if (wasCorrect) overallCorrect += 1

          if (band === 'high') {
            highTotal += 1
            if (wasCorrect) highCorrect += 1
          } else if (band === 'medium') {
            mediumTotal += 1
            if (wasCorrect) mediumCorrect += 1
          } else {
            lowTotal += 1
            if (wasCorrect) lowCorrect += 1
          }
        } else {
          const sideAPlayers = participants
            .filter((p) => p.side === 'A')
            .map((p) => players.find((player) => player.id === p.player_id))
            .filter(Boolean) as Player[]

          const sideBPlayers = participants
            .filter((p) => p.side === 'B')
            .map((p) => players.find((player) => player.id === p.player_id))
            .filter(Boolean) as Player[]

          if (sideAPlayers.length !== 2 || sideBPlayers.length !== 2) continue

          const leftRating = average(sideAPlayers.map((player) => getSelectedRating(player, engineView)))
          const rightRating = average(sideBPlayers.map((player) => getSelectedRating(player, engineView)))
          if (leftRating === rightRating) continue

          const leftWinProbability = expectedScore(leftRating, rightRating)
          const predictedWinner: MatchSide = leftWinProbability >= 0.5 ? 'A' : 'B'
          const band = getAccuracyBand(leftWinProbability)
          const wasCorrect = predictedWinner === match.winner_side

          overallTotal += 1
          if (wasCorrect) overallCorrect += 1

          if (band === 'high') {
            highTotal += 1
            if (wasCorrect) highCorrect += 1
          } else if (band === 'medium') {
            mediumTotal += 1
            if (wasCorrect) mediumCorrect += 1
          } else {
            lowTotal += 1
            if (wasCorrect) lowCorrect += 1
          }
        }
      }

      setAccuracy({
        overall: toAccuracyValue(overallCorrect, overallTotal),
        high: toAccuracyValue(highCorrect, highTotal),
        medium: toAccuracyValue(mediumCorrect, mediumTotal),
        low: toAccuracyValue(lowCorrect, lowTotal),
        sampleSize: overallTotal,
      })
    } catch (err) {
      console.error('Failed to load prediction accuracy', err)
      setAccuracy({
        overall: null,
        high: null,
        medium: null,
        low: null,
        sampleSize: 0,
      })
    } finally {
      setAccuracyLoading(false)
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
    const engineRatingView = getEngineRatingView(matchType)

    if (matchType === 'singles') {
      if (!singlesSelected || !playerA || !playerB) return null

      const left = getSelectedRating(playerA, engineRatingView)
      const right = getSelectedRating(playerB, engineRatingView)
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
        favoredSide: left === right ? 'even' : left > right ? 'left' : 'right',
        leftProfileHref: `/players/${playerA.id}`,
        rightProfileHref: `/players/${playerB.id}`,
        engineRatingView,
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

    const left = teamARatings.doubles
    const right = teamBRatings.doubles
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
      favoredSide: left === right ? 'even' : left > right ? 'left' : 'right',
      leftProfileHref: null,
      rightProfileHref: null,
      engineRatingView,
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
  ])

  const displayGap = useMemo(() => {
    if (!comparison) return 0
    return Math.abs(
      (ratingView === 'overall'
        ? comparison.leftRatings.overall
        : ratingView === 'singles'
          ? comparison.leftRatings.singles
          : comparison.leftRatings.doubles) -
        (ratingView === 'overall'
          ? comparison.rightRatings.overall
          : ratingView === 'singles'
            ? comparison.rightRatings.singles
            : comparison.rightRatings.doubles)
    )
  }, [comparison, ratingView])

  const displayHigherRatedLabel = useMemo(() => {
    if (!comparison) return ''
    const left =
      ratingView === 'overall'
        ? comparison.leftRatings.overall
        : ratingView === 'singles'
          ? comparison.leftRatings.singles
          : comparison.leftRatings.doubles
    const right =
      ratingView === 'overall'
        ? comparison.rightRatings.overall
        : ratingView === 'singles'
          ? comparison.rightRatings.singles
          : comparison.rightRatings.doubles

    if (left === right) return 'Even matchup'
    return left > right ? `${comparison.leftLabel} leads` : `${comparison.rightLabel} leads`
  }, [comparison, ratingView])

  const projection = useMemo<ProjectionState | null>(() => {
    if (!comparison) return null

    const leftWinProbability = expectedScore(comparison.leftSelected, comparison.rightSelected)
    const rightWinProbability = 1 - leftWinProbability
    const favoriteProbability = Math.max(leftWinProbability, rightWinProbability)
    const underdogProbability = Math.min(leftWinProbability, rightWinProbability)

    const favoriteLabel =
      leftWinProbability >= rightWinProbability ? comparison.leftLabel : comparison.rightLabel
    const underdogLabel =
      favoriteLabel === comparison.leftLabel ? comparison.rightLabel : comparison.leftLabel

    const likelyWinner =
      leftWinProbability === rightWinProbability ? 'Even' : favoriteLabel

    return {
      leftWinProbability,
      rightWinProbability,
      likelyWinner,
      confidenceLabel: getConfidenceLabel(favoriteProbability),
      upsetIndicator: getUpsetIndicator(favoriteProbability),
      expectedOutcome: getExpectedOutcomeText(
        favoriteProbability,
        favoriteLabel,
        underdogLabel
      ),
      ratingDiffText: `${formatRating(comparison.gap)} pts`,
      favoriteEdgeText: `${formatPercent(favoriteProbability)} vs ${formatPercent(underdogProbability)}`,
      favoriteLabel,
      underdogLabel,
    }
  }, [comparison])

  return (
    <main className="page-shell-tight matchup-page">
      <div className="matchup-top-links">
        <Link href="/" className="button-ghost">Home</Link>
        <Link href="/rankings" className="button-ghost">Rankings</Link>
        <Link href="/matchup" className="button-ghost">Matchup</Link>
        <Link href="/admin" className="button-ghost">Admin</Link>
      </div>

      <section className="hero-panel matchup-hero-panel">
        <div className="hero-inner matchup-hero-inner">
          <div className="matchup-hero-copy">
            <div className="section-kicker matchup-kicker">Matchup Comparison</div>
            <h1 className="matchup-title">Compare singles players or doubles teams.</h1>
            <p className="matchup-subtitle">
              Compare dynamic ratings, projected win probability, expected outcome,
              confidence, upset watch, and head-to-head history before match day.
            </p>

            <div className="matchup-hero-badges">
              <span className="badge badge-blue">{capitalize(matchType)} mode</span>
              <span className="badge badge-slate">{capitalize(ratingView)} display</span>
              <span className="badge badge-green">
                {matchType === 'singles' ? 'Singles engine' : 'Doubles engine'}
              </span>
            </div>
          </div>

          <div className="glass-card panel-pad matchup-hero-side">
            <div className="matchup-side-title">Projection engine</div>
            <div className="matchup-side-value">{capitalize(getEngineRatingView(matchType))}</div>
            <div className="matchup-side-text">
              Projections always use match-type-specific dynamic ratings even when the on-screen
              comparison display is switched to overall, singles, or doubles.
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card panel-pad matchup-toolbar-card">
        <div className="matchup-toolbar-top">
          <div className="matchup-mode-toggle">
            <button
              onClick={() => setMatchType('singles')}
              className={`matchup-pill-btn ${matchType === 'singles' ? 'is-active' : ''}`}
            >
              Singles
            </button>
            <button
              onClick={() => setMatchType('doubles')}
              className={`matchup-pill-btn ${matchType === 'doubles' ? 'is-active' : ''}`}
            >
              Doubles
            </button>
          </div>

          <div className="matchup-mode-toggle">
            <button
              onClick={() => setRatingView('overall')}
              className={`matchup-pill-btn ${ratingView === 'overall' ? 'is-active alt' : ''}`}
            >
              Overall
            </button>
            <button
              onClick={() => setRatingView('singles')}
              className={`matchup-pill-btn ${ratingView === 'singles' ? 'is-active alt' : ''}`}
            >
              Singles
            </button>
            <button
              onClick={() => setRatingView('doubles')}
              className={`matchup-pill-btn ${ratingView === 'doubles' ? 'is-active alt' : ''}`}
            >
              Doubles
            </button>
          </div>
        </div>

        {matchType === 'singles' ? (
          <div className="matchup-select-grid">
            <div>
              <label className="label">Player A</label>
              <select
                value={playerAId}
                onChange={(e) => setPlayerAId(e.target.value)}
                className="select"
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
              <label className="label">Player B</label>
              <select
                value={playerBId}
                onChange={(e) => setPlayerBId(e.target.value)}
                className="select"
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
          <div className="matchup-doubles-grid">
            <div>
              <label className="label">Team A - Player 1</label>
              <select
                value={teamA1Id}
                onChange={(e) => setTeamA1Id(e.target.value)}
                className="select"
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
              <label className="label">Team A - Player 2</label>
              <select
                value={teamA2Id}
                onChange={(e) => setTeamA2Id(e.target.value)}
                className="select"
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
              <label className="label">Team B - Player 1</label>
              <select
                value={teamB1Id}
                onChange={(e) => setTeamB1Id(e.target.value)}
                className="select"
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
              <label className="label">Team B - Player 2</label>
              <select
                value={teamB2Id}
                onChange={(e) => setTeamB2Id(e.target.value)}
                className="select"
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

        {error ? (
          <div className="matchup-error-box">
            <p>{error}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="matchup-empty-state">Loading players...</div>
        ) : !comparison ? (
          <div className="matchup-empty-state">
            {matchType === 'singles'
              ? 'Select two different players to compare.'
              : 'Select four different players to compare doubles teams.'}
          </div>
        ) : (
          <>
            <div className="matchup-compare-grid">
              <div className={`surface-card panel-pad matchup-side-card ${comparison.favoredSide === 'left' ? 'is-favored' : ''}`}>
                <div className="matchup-side-head">
                  <div>
                    <div className="matchup-side-name">{comparison.leftLabel}</div>
                    <div className="matchup-side-meta">{comparison.leftLocation}</div>
                  </div>

                  {comparison.leftProfileHref ? (
                    <Link href={comparison.leftProfileHref} className="button-ghost matchup-profile-link">
                      View Profile
                    </Link>
                  ) : null}
                </div>

                <div className="matchup-rating-grid">
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

                <div className="matchup-highlight-box">
                  <div className="matchup-highlight-label">
                    {comparison.engineRatingView === 'singles'
                      ? 'Singles projection rating'
                      : 'Doubles projection rating'}
                  </div>
                  <div className="matchup-highlight-value">{formatRating(comparison.leftSelected)}</div>
                </div>
              </div>

              <div className="matchup-center-column">
                <div className="matchup-vs-badge">VS</div>

                <div className="surface-card-strong panel-pad matchup-gap-card">
                  <div className="matchup-gap-label">{capitalize(ratingView)} Rating Gap</div>
                  <div className="matchup-gap-value">{formatRating(displayGap)}</div>
                  <div className="matchup-gap-meta">{displayHigherRatedLabel}</div>
                </div>
              </div>

              <div className={`surface-card panel-pad matchup-side-card ${comparison.favoredSide === 'right' ? 'is-favored' : ''}`}>
                <div className="matchup-side-head">
                  <div>
                    <div className="matchup-side-name">{comparison.rightLabel}</div>
                    <div className="matchup-side-meta">{comparison.rightLocation}</div>
                  </div>

                  {comparison.rightProfileHref ? (
                    <Link href={comparison.rightProfileHref} className="button-ghost matchup-profile-link">
                      View Profile
                    </Link>
                  ) : null}
                </div>

                <div className="matchup-rating-grid">
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

                <div className="matchup-highlight-box">
                  <div className="matchup-highlight-label">
                    {comparison.engineRatingView === 'singles'
                      ? 'Singles projection rating'
                      : 'Doubles projection rating'}
                  </div>
                  <div className="matchup-highlight-value">{formatRating(comparison.rightSelected)}</div>
                </div>
              </div>
            </div>

            <div className="surface-card panel-pad matchup-summary-card">
              <h2 className="matchup-section-title">Quick Read</h2>
              <p className="matchup-paragraph">
                In <strong>{ratingView}</strong>,{' '}
                {displayHigherRatedLabel === 'Even matchup'
                  ? `${comparison.leftLabel} and ${comparison.rightLabel} are currently even.`
                  : `${displayHigherRatedLabel} by ${formatRating(displayGap)} points.`}{' '}
                Projection uses <strong>{comparison.engineRatingView}</strong> dynamic ratings because this is a{' '}
                <strong>{matchType}</strong> matchup.
              </p>
            </div>

            {projection ? (
              <div className="surface-card panel-pad matchup-summary-card">
                <h2 className="matchup-section-title">Projection</h2>

                <div className="metric-grid matchup-metric-grid">
                  <MetricCard
                    label={`${comparison.leftLabel} win probability`}
                    value={formatPercent(projection.leftWinProbability)}
                  />
                  <MetricCard
                    label={`${comparison.rightLabel} win probability`}
                    value={formatPercent(projection.rightWinProbability)}
                  />
                  <MetricCard label="Projected winner" value={projection.likelyWinner} />
                  <MetricCard label="Confidence" value={projection.confidenceLabel} />
                  <MetricCard label="Projection rating gap" value={projection.ratingDiffText} />
                  <MetricCard label="Favorite edge" value={projection.favoriteEdgeText} />
                </div>

                <div className="matchup-callout">
                  <div>
                    <div className="matchup-callout-title">{projection.expectedOutcome}</div>
                    <div className="matchup-callout-sub">
                      Favorite: <strong>{projection.favoriteLabel}</strong> · Underdog:{' '}
                      <strong>{projection.underdogLabel}</strong>
                    </div>
                  </div>

                  <div className="matchup-upset-pill">{projection.upsetIndicator}</div>
                </div>
              </div>
            ) : null}

            <div className="surface-card panel-pad matchup-summary-card">
              <div className="matchup-summary-head">
                <h2 className="matchup-section-title">Model Accuracy</h2>
                <div className="matchup-meta-note">Based on recent {matchType} matches</div>
              </div>

              {accuracyLoading ? (
                <p className="matchup-paragraph">Calculating accuracy...</p>
              ) : accuracy.sampleSize === 0 ? (
                <p className="matchup-paragraph">Not enough history yet.</p>
              ) : (
                <>
                  <div className="metric-grid matchup-metric-grid">
                    <MetricCard label="Overall" value={formatNullablePercent(accuracy.overall)} />
                    <MetricCard label="High confidence" value={formatNullablePercent(accuracy.high)} />
                    <MetricCard label="Medium confidence" value={formatNullablePercent(accuracy.medium)} />
                    <MetricCard label="Low confidence" value={formatNullablePercent(accuracy.low)} />
                  </div>

                  <p className="matchup-paragraph matchup-top-gap">
                    Sample size: <strong>{accuracy.sampleSize}</strong>. This checks how often the current
                    rating favorite would have been correct on recent historical matchups.
                  </p>
                </>
              )}
            </div>

            <div className="surface-card panel-pad matchup-summary-card">
              <h2 className="matchup-section-title">Head-to-Head</h2>

              {headToHeadLoading ? (
                <p className="matchup-paragraph">Loading head-to-head...</p>
              ) : !headToHead || headToHead.total === 0 ? (
                <p className="matchup-paragraph">No head-to-head matches found.</p>
              ) : (
                <>
                  <div className="metric-grid matchup-metric-grid">
                    <MetricCard label="Total Matches" value={String(headToHead.total)} />
                    <MetricCard
                      label="Overall Record"
                      value={`${headToHead.winsA} - ${headToHead.winsB}`}
                      sub={`${comparison.leftLabel} vs ${comparison.rightLabel}`}
                    />
                    <MetricCard
                      label="Singles Record"
                      value={`${headToHead.singlesA} - ${headToHead.singlesB}`}
                    />
                    <MetricCard
                      label="Doubles Record"
                      value={`${headToHead.doublesA} - ${headToHead.doublesB}`}
                    />
                  </div>

                  {headToHead.lastMatch ? (
                    <p className="matchup-paragraph matchup-top-gap">
                      <strong>Last match:</strong> {formatDate(headToHead.lastMatch.matchDate)} •{' '}
                      {capitalize(headToHead.lastMatch.matchType)} •{' '}
                      {headToHead.lastMatch.score || 'No score entered'} • Winner:{' '}
                      {headToHead.lastMatch.winner === 'A'
                        ? comparison.leftLabel
                        : comparison.rightLabel}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .matchup-page {
          padding-top: 1.25rem;
          padding-bottom: 2.5rem;
        }

        .matchup-top-links {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .matchup-hero-panel {
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .matchup-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(280px, 360px);
          gap: 1rem;
          align-items: stretch;
        }

        .matchup-hero-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.85rem;
        }

        .matchup-kicker {
          color: rgba(217, 231, 255, 0.82);
        }

        .matchup-title {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2rem, 4vw, 3.3rem);
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 900;
        }

        .matchup-subtitle {
          margin: 0;
          max-width: 52rem;
          color: rgba(219, 234, 254, 0.9);
          font-size: 1rem;
          line-height: 1.7;
          font-weight: 500;
        }

        .matchup-hero-badges {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 0.15rem;
        }

        .matchup-hero-side {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.65rem;
        }

        .matchup-side-title {
          color: rgba(217, 231, 255, 0.82);
          font-size: 0.8rem;
          font-weight: 700;
          line-height: 1.5;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .matchup-side-value {
          color: #ffffff;
          font-size: 2rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .matchup-side-text {
          color: rgba(219, 234, 254, 0.88);
          font-size: 0.95rem;
          line-height: 1.65;
          font-weight: 500;
        }

        .matchup-toolbar-card {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .matchup-toolbar-top {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .matchup-mode-toggle {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          padding: 0.4rem;
          border-radius: 1rem;
          background: #f8fbff;
          border: 1px solid rgba(37, 91, 227, 0.1);
        }

        .matchup-pill-btn {
          border: 0;
          border-radius: 0.8rem;
          background: transparent;
          color: #103170;
          padding: 0.82rem 1rem;
          font-size: 0.92rem;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .matchup-pill-btn:hover {
          background: rgba(37, 91, 227, 0.06);
        }

        .matchup-pill-btn.is-active {
          background: linear-gradient(135deg, #56d8ae 0%, #b8e61a 100%);
          color: #07152f;
          box-shadow: 0 12px 26px rgba(184, 230, 26, 0.22);
        }

        .matchup-pill-btn.is-active.alt {
          background: linear-gradient(135deg, #255be3 0%, #3fa7ff 100%);
          color: #ffffff;
          box-shadow: 0 12px 28px rgba(37, 91, 227, 0.2);
        }

        .matchup-select-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .matchup-doubles-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .matchup-error-box {
          border-radius: 1rem;
          padding: 0.95rem 1rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.18);
          color: #991b1b;
        }

        .matchup-error-box p {
          margin: 0;
          font-size: 0.94rem;
          line-height: 1.6;
          font-weight: 700;
        }

        .matchup-empty-state {
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #475569;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 600;
          text-align: center;
        }

        .matchup-compare-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px minmax(0, 1fr);
          gap: 1rem;
          align-items: stretch;
        }

        .matchup-side-card {
          min-width: 0;
        }

        .matchup-side-card.is-favored {
          border-color: rgba(184, 230, 26, 0.38);
          box-shadow: 0 16px 36px rgba(184, 230, 26, 0.12);
        }

        .matchup-side-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .matchup-side-name {
          color: #0f172a;
          font-size: 1.45rem;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .matchup-side-meta {
          margin-top: 0.35rem;
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.5;
          font-weight: 500;
        }

        .matchup-profile-link {
          white-space: nowrap;
        }

        .matchup-rating-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .matchup-highlight-box {
          border-radius: 1rem;
          padding: 1rem;
          background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
          border: 1px solid rgba(37, 91, 227, 0.12);
        }

        .matchup-highlight-label {
          color: #64748b;
          font-size: 0.8rem;
          line-height: 1.5;
          font-weight: 700;
        }

        .matchup-highlight-value {
          margin-top: 0.35rem;
          color: #255be3;
          font-size: 2rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .matchup-center-column {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 1rem;
        }

        .matchup-vs-badge {
          width: 4.8rem;
          height: 4.8rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #255be3 0%, #3fa7ff 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.35rem;
          line-height: 1;
          font-weight: 900;
          box-shadow: 0 14px 30px rgba(37, 91, 227, 0.22);
        }

        .matchup-gap-card {
          width: 100%;
          text-align: center;
        }

        .matchup-gap-label {
          color: rgba(217, 231, 255, 0.82);
          font-size: 0.8rem;
          line-height: 1.5;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .matchup-gap-value {
          margin-top: 0.4rem;
          color: #ffffff;
          font-size: 2rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .matchup-gap-meta {
          margin-top: 0.45rem;
          color: #d9f84a;
          font-size: 0.92rem;
          line-height: 1.5;
          font-weight: 800;
        }

        .matchup-summary-card {
          margin-top: 1rem;
        }

        .matchup-section-title {
          margin: 0;
          color: #0f172a;
          font-size: 1.35rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .matchup-paragraph {
          margin: 0.8rem 0 0;
          color: #475569;
          font-size: 0.96rem;
          line-height: 1.7;
          font-weight: 500;
        }

        .matchup-top-gap {
          margin-top: 0.95rem;
        }

        .matchup-metric-grid {
          margin-top: 1rem;
        }

        .matchup-callout {
          margin-top: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          flex-wrap: wrap;
          border-radius: 1rem;
          padding: 1rem;
          background: linear-gradient(180deg, #f7fbff 0%, #eff6ff 100%);
          border: 1px solid rgba(37, 91, 227, 0.14);
        }

        .matchup-callout-title {
          color: #0f172a;
          font-size: 1rem;
          line-height: 1.45;
          font-weight: 800;
        }

        .matchup-callout-sub {
          margin-top: 0.25rem;
          color: #475569;
          font-size: 0.9rem;
          line-height: 1.6;
          font-weight: 500;
        }

        .matchup-upset-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 0.65rem 0.8rem;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #c2410c;
          font-size: 0.76rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .matchup-summary-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .matchup-meta-note {
          color: #64748b;
          font-size: 0.8rem;
          line-height: 1.5;
          font-weight: 700;
        }

        @media (max-width: 980px) {
          .matchup-hero-inner {
            grid-template-columns: 1fr;
          }

          .matchup-compare-grid {
            grid-template-columns: 1fr;
          }

          .matchup-center-column {
            order: -1;
          }
        }

        @media (max-width: 760px) {
          .matchup-select-grid,
          .matchup-doubles-grid,
          .matchup-rating-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
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
  active?: boolean
}) {
  return (
    <div className={`matchup-rating-pill ${active ? 'is-active' : ''}`}>
      <div className="matchup-rating-pill-label">{label}</div>
      <div className="matchup-rating-pill-value">{formatRating(value)}</div>

      <style jsx>{`
        .matchup-rating-pill {
          border-radius: 1rem;
          padding: 0.9rem 0.95rem;
          background: #ffffff;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .matchup-rating-pill.is-active {
          background: #eff6ff;
          border-color: rgba(37, 91, 227, 0.22);
          box-shadow: inset 0 0 0 1px rgba(37, 91, 227, 0.04);
        }

        .matchup-rating-pill-label {
          color: #64748b;
          font-size: 0.75rem;
          line-height: 1.5;
          font-weight: 700;
        }

        .matchup-rating-pill-value {
          margin-top: 0.3rem;
          color: #0f172a;
          font-size: 1.2rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.03em;
        }
      `}</style>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="metric-card">
      <div className="matchup-metric-label">{label}</div>
      <div className="matchup-metric-value">{value}</div>
      {sub ? <div className="matchup-metric-sub">{sub}</div> : null}

      <style jsx>{`
        .matchup-metric-label {
          color: #64748b;
          font-size: 0.82rem;
          margin-bottom: 0.4rem;
          font-weight: 700;
        }

        .matchup-metric-value {
          color: #0f172a;
          font-size: clamp(1.25rem, 2vw, 1.75rem);
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .matchup-metric-sub {
          margin-top: 0.35rem;
          color: #64748b;
          font-size: 0.8rem;
          line-height: 1.5;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}

function areUniqueIds(ids: string[]) {
  const filtered = ids.filter(Boolean)
  return new Set(filtered).size === filtered.length
}

function normalizeIdSet(ids: string[]) {
  return [...ids].sort().join('|')
}

function normalizeRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_RATING
  return value
}

function average(values: number[]) {
  if (!values.length) return DEFAULT_RATING
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getSelectedRating(player: Player, view: RatingView) {
  if (view === 'singles') return normalizeRating(player.singles_dynamic_rating)
  if (view === 'doubles') return normalizeRating(player.doubles_dynamic_rating)
  return normalizeRating(player.overall_dynamic_rating)
}

function getEngineRatingView(matchType: MatchType): RatingView {
  return matchType === 'singles' ? 'singles' : 'doubles'
}

function expectedScore(leftRating: number, rightRating: number) {
  const exponent = (rightRating - leftRating) / RATING_DIVISOR
  return 1 / (1 + Math.pow(10, exponent))
}

function getConfidenceLabel(favoriteProbability: number) {
  if (favoriteProbability >= 0.75) return 'Very High'
  if (favoriteProbability >= 0.66) return 'High'
  if (favoriteProbability >= 0.58) return 'Moderate'
  if (favoriteProbability >= 0.52) return 'Low'
  return 'Toss-up'
}

function getUpsetIndicator(favoriteProbability: number) {
  if (favoriteProbability >= 0.75) return 'Major upset needed'
  if (favoriteProbability >= 0.66) return 'Upset possible'
  if (favoriteProbability >= 0.58) return 'Slight upset risk'
  return 'True coin flip'
}

function getExpectedOutcomeText(
  favoriteProbability: number,
  favoriteLabel: string,
  underdogLabel: string
) {
  if (favoriteProbability >= 0.75) {
    return `${favoriteLabel} is a strong favorite over ${underdogLabel}.`
  }
  if (favoriteProbability >= 0.66) {
    return `${favoriteLabel} has a clear edge over ${underdogLabel}.`
  }
  if (favoriteProbability >= 0.58) {
    return `${favoriteLabel} is favored, but ${underdogLabel} is very live.`
  }
  if (favoriteProbability >= 0.52) {
    return `${favoriteLabel} has a slight edge in a tight matchup.`
  }
  return `This matchup projects as nearly even.`
}

function getAccuracyBand(probabilityLeft: number): AccuracyBand {
  const favoriteProbability = Math.max(probabilityLeft, 1 - probabilityLeft)
  if (favoriteProbability >= 0.72) return 'high'
  if (favoriteProbability >= 0.6) return 'medium'
  return 'low'
}

function toAccuracyValue(correct: number, total: number) {
  if (!total) return null
  return correct / total
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatNullablePercent(value: number | null) {
  if (value === null) return '—'
  return formatPercent(value)
}

function formatRating(value: number) {
  return value.toFixed(2)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}