'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SiteShell from '@/app/components/site-shell'

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
  const [screenWidth, setScreenWidth] = useState(1280)

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

          const leftRating = average(
            sideAPlayers.map((player) => getSelectedRating(player, engineView)),
          )
          const rightRating = average(
            sideBPlayers.map((player) => getSelectedRating(player, engineView)),
          )
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
    [players, playerAId],
  )
  const playerB = useMemo(
    () => players.find((player) => player.id === playerBId) || null,
    [players, playerBId],
  )
  const teamA1 = useMemo(
    () => players.find((player) => player.id === teamA1Id) || null,
    [players, teamA1Id],
  )
  const teamA2 = useMemo(
    () => players.find((player) => player.id === teamA2Id) || null,
    [players, teamA2Id],
  )
  const teamB1 = useMemo(
    () => players.find((player) => player.id === teamB1Id) || null,
    [players, teamB1Id],
  )
  const teamB2 = useMemo(
    () => players.find((player) => player.id === teamB2Id) || null,
    [players, teamB2Id],
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
    [players, playerBId],
  )
  const availablePlayersForB = useMemo(
    () => players.filter((player) => player.id !== playerAId),
    [players, playerAId],
  )

  const availableTeamA1 = useMemo(
    () => players.filter((player) => ![teamA2Id, teamB1Id, teamB2Id].includes(player.id)),
    [players, teamA2Id, teamB1Id, teamB2Id],
  )
  const availableTeamA2 = useMemo(
    () => players.filter((player) => ![teamA1Id, teamB1Id, teamB2Id].includes(player.id)),
    [players, teamA1Id, teamB1Id, teamB2Id],
  )
  const availableTeamB1 = useMemo(
    () => players.filter((player) => ![teamA1Id, teamA2Id, teamB2Id].includes(player.id)),
    [players, teamA1Id, teamA2Id, teamB2Id],
  )
  const availableTeamB2 = useMemo(
    () => players.filter((player) => ![teamA1Id, teamA2Id, teamB1Id].includes(player.id)),
    [players, teamA1Id, teamA2Id, teamB1Id],
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
  }, [matchType, singlesSelected, doublesSelected, playerA, playerB, teamA1, teamA2, teamB1, teamB2])

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
            : comparison.rightRatings.doubles),
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

    const likelyWinner = leftWinProbability === rightWinProbability ? 'Even' : favoriteLabel

    return {
      leftWinProbability,
      rightWinProbability,
      likelyWinner,
      confidenceLabel: getConfidenceLabel(favoriteProbability),
      upsetIndicator: getUpsetIndicator(favoriteProbability),
      expectedOutcome: getExpectedOutcomeText(favoriteProbability, favoriteLabel, underdogLabel),
      ratingDiffText: `${formatRating(comparison.gap)} pts`,
      favoriteEdgeText: `${formatPercent(favoriteProbability)} vs ${formatPercent(underdogProbability)}`,
      favoriteLabel,
      underdogLabel,
    }
  }, [comparison])

  const recommendationText = useMemo(() => {
    if (!projection || !comparison) return ''

    const favoriteProbability = Math.max(
      projection.leftWinProbability,
      projection.rightWinProbability,
    )

    if (favoriteProbability >= 0.75) {
      return `${projection.favoriteLabel} should be treated as a strong anchor match. If this is part of a lineup decision, this is one of your cleaner spots to trust the favorite.`
    }

    if (favoriteProbability >= 0.66) {
      return `${projection.favoriteLabel} has a real edge here. This should lean favorite, but it is still competitive enough that placement and partner context matter.`
    }

    if (favoriteProbability >= 0.58) {
      return `${projection.favoriteLabel} is favored, but this is still very live. Treat this as a swing match where lineup context, court assignment, and recent form can shift the outcome.`
    }

    return `This matchup is close to even. Treat it as a true swing match and avoid assuming either side is safe.`
  }, [projection, comparison])

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '14px 16px 22px' : '10px 18px 24px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
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

  const dynamicEngineCard: CSSProperties = {
    ...engineCard,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicToolbarTop: CSSProperties = {
    ...toolbarTop,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
  }

  const dynamicSelectorGrid: CSSProperties = {
    ...selectorGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : matchType === 'singles'
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicCompareGrid: CSSProperties = {
    ...compareGrid,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1fr) 220px minmax(0, 1fr)',
  }

  const dynamicCenterColumn: CSSProperties = {
    ...centerColumn,
    order: isTablet ? -1 : 0,
  }

  const dynamicRatingGrid: CSSProperties = {
    ...ratingGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicMetricGrid: CSSProperties = {
    ...metricGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicDecisionBanner: CSSProperties = {
    ...decisionBanner,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
  }

  const dynamicDecisionRight: CSSProperties = {
    ...decisionRight,
    alignItems: isMobile ? 'flex-start' : 'flex-end',
    width: isMobile ? '100%' : 'auto',
  }

  return (
    <SiteShell active="/matchup">
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Matchup comparison</div>
              <h1 style={dynamicHeroTitle}>Compare singles players or doubles teams.</h1>
              <p style={dynamicHeroText}>
                See rating gaps, projected win probability, confidence, upset risk, model
                accuracy, and head-to-head history before match day.
              </p>

              <div style={heroHintRow}>
                <span style={heroHintPill}>{capitalize(matchType)} mode</span>
                <span style={heroHintPill}>{capitalize(ratingView)} display</span>
                <span style={heroHintPill}>{capitalize(getEngineRatingView(matchType))} engine</span>
              </div>
            </div>

            <div style={dynamicEngineCard}>
              <div style={engineLabel}>Projection engine</div>
              <div style={engineValue}>{capitalize(getEngineRatingView(matchType))}</div>
              <div style={engineText}>
                Projections always use match-type-specific dynamic ratings even when the on-screen
                comparison display is switched to overall, singles, or doubles.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={contentWrap}>
        <article style={controlsCard}>
          <div style={dynamicToolbarTop}>
            <div style={toggleStack}>
              <div style={toggleLabel}>Match type</div>
              <div style={toggleGroup}>
                <button
                  onClick={() => setMatchType('singles')}
                  style={{
                    ...toggleButton,
                    ...(matchType === 'singles' ? toggleButtonGreen : {}),
                  }}
                >
                  Singles
                </button>
                <button
                  onClick={() => setMatchType('doubles')}
                  style={{
                    ...toggleButton,
                    ...(matchType === 'doubles' ? toggleButtonGreen : {}),
                  }}
                >
                  Doubles
                </button>
              </div>
            </div>

            <div style={toggleStack}>
              <div style={toggleLabel}>Display ratings</div>
              <div style={toggleGroup}>
                <button
                  onClick={() => setRatingView('overall')}
                  style={{
                    ...toggleButton,
                    ...(ratingView === 'overall' ? toggleButtonBlue : {}),
                  }}
                >
                  Overall
                </button>
                <button
                  onClick={() => setRatingView('singles')}
                  style={{
                    ...toggleButton,
                    ...(ratingView === 'singles' ? toggleButtonBlue : {}),
                  }}
                >
                  Singles
                </button>
                <button
                  onClick={() => setRatingView('doubles')}
                  style={{
                    ...toggleButton,
                    ...(ratingView === 'doubles' ? toggleButtonBlue : {}),
                  }}
                >
                  Doubles
                </button>
              </div>
            </div>
          </div>

          {matchType === 'singles' ? (
            <div style={dynamicSelectorGrid}>
              <SelectField
                label="Player A"
                value={playerAId}
                onChange={setPlayerAId}
                options={availablePlayersForA}
                disabled={loading}
              />
              <SelectField
                label="Player B"
                value={playerBId}
                onChange={setPlayerBId}
                options={availablePlayersForB}
                disabled={loading}
              />
            </div>
          ) : (
            <div style={dynamicSelectorGrid}>
              <SelectField
                label="Team A · Player 1"
                value={teamA1Id}
                onChange={setTeamA1Id}
                options={availableTeamA1}
                disabled={loading}
              />
              <SelectField
                label="Team A · Player 2"
                value={teamA2Id}
                onChange={setTeamA2Id}
                options={availableTeamA2}
                disabled={loading}
              />
              <SelectField
                label="Team B · Player 1"
                value={teamB1Id}
                onChange={setTeamB1Id}
                options={availableTeamB1}
                disabled={loading}
              />
              <SelectField
                label="Team B · Player 2"
                value={teamB2Id}
                onChange={setTeamB2Id}
                options={availableTeamB2}
                disabled={loading}
              />
            </div>
          )}

          {error ? <div style={errorBanner}>{error}</div> : null}

          {loading ? (
            <div style={emptyState}>Loading players...</div>
          ) : !comparison ? (
            <div style={emptyState}>
              {matchType === 'singles'
                ? 'Select two different players to compare.'
                : 'Select four different players to compare doubles teams.'}
            </div>
          ) : (
            <>
              {projection ? (
                <div style={dynamicDecisionBanner}>
                  <div>
                    <div style={decisionLabel}>Matchup edge</div>
                    <div style={decisionWinner}>{projection.likelyWinner}</div>
                    <div style={decisionSub}>
                      {projection.favoriteEdgeText} · {projection.confidenceLabel} confidence
                    </div>
                  </div>

                  <div style={dynamicDecisionRight}>
                    <div style={decisionPill}>{projection.upsetIndicator}</div>

                    <div style={decisionCtaRow}>
                      <Link href="/captain/lineup-builder" style={ctaPrimary}>
                        Build lineup
                      </Link>
                      <Link href="/captain/messaging" style={ctaSecondary}>
                        Send to team
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}

              <div style={dynamicCompareGrid}>
                <CompareCard
                  title={comparison.leftLabel}
                  subtitle={comparison.leftLocation}
                  ratings={comparison.leftRatings}
                  projectionRating={comparison.leftSelected}
                  ratingView={ratingView}
                  projectionView={comparison.engineRatingView}
                  profileHref={comparison.leftProfileHref}
                  favored={comparison.favoredSide === 'left'}
                  dynamicRatingGrid={dynamicRatingGrid}
                />

                <div style={dynamicCenterColumn}>
                  <div style={vsBadge}>VS</div>

                  <div style={gapCard}>
                    <div style={gapLabel}>{capitalize(ratingView)} rating gap</div>
                    <div style={gapValue}>{formatRating(displayGap)}</div>
                    <div style={gapMeta}>{displayHigherRatedLabel}</div>
                  </div>
                </div>

                <CompareCard
                  title={comparison.rightLabel}
                  subtitle={comparison.rightLocation}
                  ratings={comparison.rightRatings}
                  projectionRating={comparison.rightSelected}
                  ratingView={ratingView}
                  projectionView={comparison.engineRatingView}
                  profileHref={comparison.rightProfileHref}
                  favored={comparison.favoredSide === 'right'}
                  dynamicRatingGrid={dynamicRatingGrid}
                />
              </div>

              {projection ? (
                <article style={summaryCard}>
                  <h2 style={projectionSectionTitle}>Match projection</h2>

                  <div style={dynamicMetricGrid}>
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
                    <MetricCard label="Projection gap" value={projection.ratingDiffText} />
                    <MetricCard label="Favorite edge" value={projection.favoriteEdgeText} />
                  </div>

                  <div style={calloutCard}>
                    <div>
                      <div style={calloutTitle}>{projection.expectedOutcome}</div>
                      <div style={calloutSub}>
                        Favorite: <strong>{projection.favoriteLabel}</strong> · Underdog:{' '}
                        <strong>{projection.underdogLabel}</strong>
                      </div>
                    </div>

                    <div style={upsetPill}>{projection.upsetIndicator}</div>
                  </div>

                  <div style={recommendationCard}>
                    <div style={recommendationTitle}>Recommended move</div>
                    <div style={recommendationTextStyle}>{recommendationText}</div>
                  </div>
                </article>
              ) : null}

              <article style={summaryCard}>
                <div style={summaryHead}>
                  <h2 style={sectionTitle}>Model accuracy</h2>
                  <div style={metaNote}>Based on recent {matchType} matches</div>
                </div>

                {accuracyLoading ? (
                  <p style={paragraph}>Calculating accuracy...</p>
                ) : accuracy.sampleSize === 0 ? (
                  <p style={paragraph}>Not enough history yet.</p>
                ) : (
                  <>
                    <div style={dynamicMetricGrid}>
                      <MetricCard label="Overall" value={formatNullablePercent(accuracy.overall)} />
                      <MetricCard
                        label="High confidence"
                        value={formatNullablePercent(accuracy.high)}
                      />
                      <MetricCard
                        label="Medium confidence"
                        value={formatNullablePercent(accuracy.medium)}
                      />
                      <MetricCard label="Low confidence" value={formatNullablePercent(accuracy.low)} />
                    </div>

                    <p style={{ ...paragraph, marginTop: '16px' }}>
                      Sample size: <strong>{accuracy.sampleSize}</strong>. This checks how often the
                      current rating favorite would have been correct on recent historical matchups.
                    </p>
                  </>
                )}
              </article>

              <article style={summaryCard}>
                <h2 style={sectionTitle}>Head-to-head</h2>

                {headToHeadLoading ? (
                  <p style={paragraph}>Loading head-to-head...</p>
                ) : !headToHead || headToHead.total === 0 ? (
                  <p style={paragraph}>No head-to-head matches found.</p>
                ) : (
                  <>
                    <div style={dynamicMetricGrid}>
                      <MetricCard label="Total matches" value={String(headToHead.total)} />
                      <MetricCard
                        label="Overall record"
                        value={`${headToHead.winsA} - ${headToHead.winsB}`}
                        sub={`${comparison.leftLabel} vs ${comparison.rightLabel}`}
                      />
                      <MetricCard
                        label="Singles record"
                        value={`${headToHead.singlesA} - ${headToHead.singlesB}`}
                      />
                      <MetricCard
                        label="Doubles record"
                        value={`${headToHead.doublesA} - ${headToHead.doublesB}`}
                      />
                    </div>

                    {headToHead.lastMatch ? (
                      <p style={{ ...paragraph, marginTop: '16px' }}>
                        <strong>Last match:</strong> {formatDate(headToHead.lastMatch.matchDate)} ·{' '}
                        {capitalize(headToHead.lastMatch.matchType)} ·{' '}
                        {headToHead.lastMatch.score || 'No score entered'} · Winner:{' '}
                        {headToHead.lastMatch.winner === 'A'
                          ? comparison.leftLabel
                          : comparison.rightLabel}
                      </p>
                    ) : null}
                  </>
                )}
              </article>
            </>
          )}
        </article>
      </section>
    </SiteShell>
  )
}

function CompareCard({
  title,
  subtitle,
  ratings,
  projectionRating,
  ratingView,
  projectionView,
  profileHref,
  favored,
  dynamicRatingGrid,
}: {
  title: string
  subtitle: string
  ratings: { overall: number; singles: number; doubles: number }
  projectionRating: number
  ratingView: RatingView
  projectionView: RatingView
  profileHref: string | null
  favored: boolean
  dynamicRatingGrid: CSSProperties
}) {
  return (
    <div
      style={{
        ...compareCard,
        ...(favored ? favoredCompareCard : {}),
      }}
    >
      <div style={compareHead}>
        <div>
          <div style={compareTitle}>{title}</div>
          <div style={compareSubtitle}>{subtitle}</div>
        </div>

        {profileHref ? (
          <Link href={profileHref} style={miniGhostButton}>
            View profile
          </Link>
        ) : null}
      </div>

      <div style={dynamicRatingGrid}>
        <RatingPill label="Overall" value={ratings.overall} active={ratingView === 'overall'} />
        <RatingPill label="Singles" value={ratings.singles} active={ratingView === 'singles'} />
        <RatingPill label="Doubles" value={ratings.doubles} active={ratingView === 'doubles'} />
      </div>

      <div style={highlightBox}>
        <div style={highlightLabel}>
          {projectionView === 'singles' ? 'Singles projection rating' : 'Doubles projection rating'}
        </div>
        <div style={highlightValue}>{formatRating(projectionRating)}</div>
      </div>
    </div>
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
    <div
      style={{
        ...ratingPill,
        ...(active ? ratingPillActive : {}),
      }}
    >
      <div style={ratingPillLabel}>{label}</div>
      <div style={ratingPillValue}>{formatRating(value)}</div>
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
    <div style={metricCard}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
      {sub ? <div style={metricSub}>{sub}</div> : null}
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Player[]
  disabled: boolean
}) {
  return (
    <div>
      <label style={inputLabel}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
        disabled={disabled}
      >
        <option value="">Select player</option>
        {options.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
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
  underdogLabel: string,
) {
  if (favoriteProbability >= 0.75) return `${favoriteLabel} is a strong favorite over ${underdogLabel}.`
  if (favoriteProbability >= 0.66) return `${favoriteLabel} has a clear edge over ${underdogLabel}.`
  if (favoriteProbability >= 0.58) return `${favoriteLabel} is favored, but ${underdogLabel} is very live.`
  if (favoriteProbability >= 0.52) return `${favoriteLabel} has a slight edge in a tight matchup.`
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
    'linear-gradient(180deg, rgba(26,54,104,0.52) 0%, rgba(17,36,72,0.72) 22%, rgba(12,27,52,0.82) 100%)',
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

const engineCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const engineLabel: CSSProperties = {
  color: 'rgba(217,231,255,0.82)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const engineValue: CSSProperties = {
  marginTop: '8px',
  color: '#ffffff',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const engineText: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(219,234,254,0.88)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '0 18px 0',
}

const controlsCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(133,168,229,0.16)',
  background:
    'radial-gradient(circle at top right, rgba(184,230,26,0.12), transparent 34%), linear-gradient(135deg, rgba(8,34,75,0.98) 0%, rgba(4,18,45,0.98) 58%, rgba(7,36,46,0.98) 100%)',
  boxShadow: '0 28px 60px rgba(2,8,23,0.28)',
  minWidth: 0,
  marginBottom: '16px',
}

const toolbarTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: '18px',
}

const toggleStack: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const toggleLabel: CSSProperties = {
  color: 'rgba(198,216,248,0.84)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const toggleGroup: CSSProperties = {
  display: 'inline-flex',
  gap: '8px',
  flexWrap: 'wrap',
  padding: '6px',
  borderRadius: '20px',
  background: 'linear-gradient(180deg, rgba(18,35,68,0.92) 0%, rgba(11,24,49,0.9) 100%)',
  border: '1px solid rgba(128,174,255,0.18)',
  boxShadow: '0 12px 26px rgba(8,23,48,0.16), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const toggleButton: CSSProperties = {
  border: 0,
  borderRadius: '14px',
  background: 'transparent',
  color: 'rgba(224,236,249,0.78)',
  padding: '12px 18px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
  letterSpacing: '-0.01em',
  transition: 'all 180ms ease',
}

const toggleButtonGreen: CSSProperties = {
  background: 'linear-gradient(135deg, #67f19a 0%, #b8e61a 100%)',
  color: '#06172f',
  boxShadow: '0 14px 28px rgba(184,230,26,0.24), inset 0 1px 0 rgba(255,255,255,0.34)',
}

const toggleButtonBlue: CSSProperties = {
  background: 'linear-gradient(135deg, #2f6ff5 0%, #61a6ff 100%)',
  color: '#ffffff',
  boxShadow: '0 14px 28px rgba(74,163,255,0.22), inset 0 1px 0 rgba(255,255,255,0.24)',
}

const selectorGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '16px',
}

const inputLabel: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'rgba(198,216,248,0.84)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '52px',
  borderRadius: '18px',
  border: '1px solid rgba(138,182,255,0.16)',
  background: 'rgba(10,20,40,0.6)',
  color: '#f7fbff',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 700,
  outline: 'none',
}

const errorBanner: CSSProperties = {
  marginBottom: '16px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.18)',
  color: '#fecaca',
  fontWeight: 700,
  fontSize: '14px',
}

const emptyState: CSSProperties = {
  borderRadius: '18px',
  padding: '18px',
  background: 'linear-gradient(180deg, rgba(38,67,118,0.46) 0%, rgba(22,40,78,0.58) 100%)',
  border: '1px solid rgba(128,174,255,0.14)',
  color: 'rgba(224,236,249,0.78)',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 600,
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const decisionBanner: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '20px',
  flexWrap: 'wrap',
  marginBottom: '18px',
  padding: '20px',
  borderRadius: '22px',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12) 0%, rgba(20,40,80,0.9) 100%)',
  border: '1px solid rgba(155,225,29,0.25)',
  boxShadow: '0 20px 50px rgba(155,225,29,0.15)',
}

const decisionLabel: CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  color: 'rgba(200,220,255,0.7)',
  fontWeight: 800,
  letterSpacing: '0.1em',
}

const decisionWinner: CSSProperties = {
  marginTop: '6px',
  fontSize: '28px',
  fontWeight: 900,
  color: '#fff',
  lineHeight: 1.05,
  letterSpacing: '-0.04em',
}

const decisionSub: CSSProperties = {
  marginTop: '6px',
  fontSize: '14px',
  color: 'rgba(220,235,255,0.8)',
  lineHeight: 1.6,
  fontWeight: 600,
}

const decisionRight: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  alignItems: 'flex-end',
}

const decisionPill: CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.15)',
  padding: '8px 12px',
  borderRadius: '999px',
  fontWeight: 800,
  fontSize: '12px',
  color: '#eff8ff',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const decisionCtaRow: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const ctaPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 16px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  color: '#08111d',
  fontWeight: 900,
  textDecoration: 'none',
  border: '1px solid rgba(155,225,29,0.30)',
  boxShadow: '0 10px 22px rgba(155,225,29,0.14)',
}

const ctaSecondary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 16px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.18)',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'rgba(255,255,255,0.04)',
}

const compareGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  alignItems: 'stretch',
}

const compareCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const favoredCompareCard: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.34)',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const compareHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '16px',
}

const compareTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '24px',
  lineHeight: 1.15,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const compareSubtitle: CSSProperties = {
  marginTop: '6px',
  color: 'rgba(224,236,249,0.78)',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 500,
}

const miniGhostButton: CSSProperties = {
  whiteSpace: 'nowrap',
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

const ratingGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
  marginBottom: '16px',
}

const ratingPill: CSSProperties = {
  borderRadius: '16px',
  padding: '14px 14px',
  background: 'rgba(18,34,64,0.85)',
  border: '1px solid rgba(116,190,255,0.18)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
}

const ratingPillActive: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(26,56,108,0.92) 0%, rgba(16,31,59,0.92) 100%)',
  borderColor: 'rgba(74,163,255,0.28)',
  boxShadow: '0 10px 24px rgba(37,91,227,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const ratingPillLabel: CSSProperties = {
  color: 'rgba(197,213,234,0.72)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 700,
}

const ratingPillValue: CSSProperties = {
  marginTop: '4px',
  color: '#f4f9ff',
  fontSize: '20px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const highlightBox: CSSProperties = {
  borderRadius: '16px',
  padding: '16px',
  background: 'rgba(18,34,64,0.9)',
  border: '1px solid rgba(116,190,255,0.18)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
}

const highlightLabel: CSSProperties = {
  color: 'rgba(197,213,234,0.72)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 700,
}

const highlightValue: CSSProperties = {
  marginTop: '6px',
  color: '#9bd2ff',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const centerColumn: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '16px',
}

const vsBadge: CSSProperties = {
  width: '76px',
  height: '76px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #255be3 0%, #3fa7ff 100%)',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '22px',
  lineHeight: 1,
  fontWeight: 900,
  boxShadow: '0 14px 30px rgba(37,91,227,0.22)',
}

const gapCard: CSSProperties = {
  width: '100%',
  textAlign: 'center',
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const gapLabel: CSSProperties = {
  color: 'rgba(217,231,255,0.82)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const gapValue: CSSProperties = {
  marginTop: '6px',
  color: '#ffffff',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const gapMeta: CSSProperties = {
  marginTop: '6px',
  color: '#d9f84a',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 800,
}

const summaryCard: CSSProperties = {
  marginTop: '16px',
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '22px',
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: '-0.02em',
}

const projectionSectionTitle: CSSProperties = {
  ...sectionTitle,
  fontSize: '28px',
  lineHeight: 1.08,
  letterSpacing: '-0.03em',
}

const paragraph: CSSProperties = {
  margin: '12px 0 0',
  color: 'rgba(224,236,249,0.78)',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 500,
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
  marginTop: '16px',
}

const metricCard: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
}

const metricLabel: CSSProperties = {
  color: 'rgba(217,231,255,0.82)',
  fontSize: '13px',
  marginBottom: '8px',
  fontWeight: 700,
}

const metricValue: CSSProperties = {
  color: '#ffffff',
  fontSize: '28px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const metricSub: CSSProperties = {
  marginTop: '6px',
  color: 'rgba(197,213,234,0.72)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 600,
}

const calloutCard: CSSProperties = {
  marginTop: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  flexWrap: 'wrap',
  borderRadius: '16px',
  padding: '16px',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12) 0%, rgba(20,40,80,0.85) 100%)',
  border: '1px solid rgba(155,225,29,0.25)',
}

const calloutTitle: CSSProperties = {
  color: '#f4f9ff',
  fontSize: '16px',
  lineHeight: 1.45,
  fontWeight: 800,
}

const calloutSub: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(220,233,248,0.78)',
  fontSize: '14px',
  lineHeight: 1.6,
  fontWeight: 500,
}

const upsetPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '10px 12px',
  background: 'rgba(10,20,35,0.42)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: '#ecf8ff',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const recommendationCard: CSSProperties = {
  marginTop: '16px',
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(9,20,39,0.44)',
  border: '1px solid rgba(116,190,255,0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
}

const recommendationTitle: CSSProperties = {
  color: '#f4f9ff',
  fontSize: '14px',
  lineHeight: 1.2,
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const recommendationTextStyle: CSSProperties = {
  marginTop: '8px',
  color: 'rgba(220,233,248,0.78)',
  fontSize: '14px',
  lineHeight: 1.72,
  fontWeight: 500,
}

const summaryHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
}

const metaNote: CSSProperties = {
  color: '#93c5fd',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 700,
}