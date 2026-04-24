'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdsenseSlot from '@/app/components/adsense-slot'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import SiteShell from '@/app/components/site-shell'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { formatDate, formatRating } from '@/lib/captain-formatters'
import { type UserRole } from '@/lib/roles'

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
  overall_usta_dynamic_rating?: number | null
  singles_usta_dynamic_rating?: number | null
  doubles_usta_dynamic_rating?: number | null
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
    overall: number | null
    singles: number | null
    doubles: number | null
  }
  rightRatings: {
    overall: number | null
    singles: number | null
    doubles: number | null
  }
  leftUstaRatings: {
    overall: number | null
    singles: number | null
    doubles: number | null
  }
  rightUstaRatings: {
    overall: number | null
    singles: number | null
    doubles: number | null
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
  matchTier: string
  isSwingMatch: boolean
  captainInsight: string
  swapImpactHint: string
}

type AccuracyState = {
  overall: number | null
  high: number | null
  medium: number | null
  low: number | null
  sampleSize: number
}

const RATING_DIVISOR = 0.45
const MATCHUP_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_MATCHUP_INLINE || null

function hasValidRating(value: number | null | undefined): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

export default function MatchupPage() {
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [headToHeadLoading, setHeadToHeadLoading] = useState(false)
  const [accuracyLoading, setAccuracyLoading] = useState(false)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  const [matchType, setMatchType] = useState<MatchType>('singles')

  const [playerAId, setPlayerAId] = useState('')
  const [playerBId, setPlayerBId] = useState('')

  const [teamA1Id, setTeamA1Id] = useState('')
  const [teamA2Id, setTeamA2Id] = useState('')
  const [teamB1Id, setTeamB1Id] = useState('')
  const [teamB2Id, setTeamB2Id] = useState('')

  const [ratingView, setRatingView] = useState<RatingView>('overall')
  const [headToHead, setHeadToHead] = useState<HeadToHeadState | null>(null)
  const urlReadyRef = useRef(false)
  const [accuracy, setAccuracy] = useState<AccuracyState>({
    overall: null,
    high: null,
    medium: null,
    low: null,
    sampleSize: 0,
  })
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  useEffect(() => {
    void loadPlayers()
  }, [])

  useEffect(() => {
    let active = true

    async function loadAuth() {
      try {
        const authState = await getClientAuthState()
        if (!active) return
        setRole(authState.role)
        setEntitlements(authState.entitlements)
      } catch {
        if (!active) return
        setRole('public')
        setEntitlements(null)
      }
    }

    void loadAuth()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const typeFromUrl = params.get('type')
    if (typeFromUrl === 'doubles') setMatchType('doubles')

    const playerAFromUrl = params.get('playerA') || ''
    const playerBFromUrl = params.get('playerB') || ''
    if (playerAFromUrl) setPlayerAId(playerAFromUrl)
    if (playerBFromUrl) setPlayerBId(playerBFromUrl)

    const a1 = params.get('a1') || ''
    const a2 = params.get('a2') || ''
    const b1 = params.get('b1') || ''
    const b2 = params.get('b2') || ''
    if (a1) setTeamA1Id(a1)
    if (a2) setTeamA2Id(a2)
    if (b1) setTeamB1Id(b1)
    if (b2) setTeamB2Id(b2)

    urlReadyRef.current = true
  }, [])

  useEffect(() => {
    if (!urlReadyRef.current || typeof window === 'undefined') return
    const params = new URLSearchParams()
    params.set('type', matchType)
    if (matchType === 'singles') {
      if (playerAId) params.set('playerA', playerAId)
      if (playerBId) params.set('playerB', playerBId)
    } else {
      if (teamA1Id) params.set('a1', teamA1Id)
      if (teamA2Id) params.set('a2', teamA2Id)
      if (teamB1Id) params.set('b1', teamB1Id)
      if (teamB2Id) params.set('b2', teamB2Id)
    }
    const search = params.toString()
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
  }, [matchType, playerAId, playerBId, teamA1Id, teamA2Id, teamB1Id, teamB2Id])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchType, playerAId, playerBId, teamA1Id, teamA2Id, teamB1Id, teamB2Id])

  useEffect(() => {
    if (!players.length) return
    void loadPredictionAccuracy()
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          doubles_dynamic_rating,
          overall_usta_dynamic_rating,
          singles_usta_dynamic_rating,
          doubles_usta_dynamic_rating
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

      const [
        { data: matchesData, error: matchesError },
        { data: participantsData, error: participantsError },
      ] = await Promise.all([
        supabase
          .from('matches')
          .select(`
            id,
            match_date,
            match_type,
            score,
            winner_side
          `)
          .in('id', matchIds),
        supabase
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
          .in('match_id', matchIds),
      ])

      if (matchesError) throw new Error(matchesError.message)
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
      const singlesA = 0
      const singlesB = 0
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
          if (!hasValidRating(leftRating) || !hasValidRating(rightRating)) continue
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

          const leftRatings = sideAPlayers.map((player) => getSelectedRating(player, engineView))
          const rightRatings = sideBPlayers.map((player) => getSelectedRating(player, engineView))

          if (!leftRatings.every(hasValidRating) || !rightRatings.every(hasValidRating)) continue

          const leftRating = average(leftRatings)
          const rightRating = average(rightRatings)
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

  const hasSinglesSelection = !!playerA && !!playerB && playerAId !== playerBId
  const hasDoublesSelection =
    !!teamA1 &&
    !!teamA2 &&
    !!teamB1 &&
    !!teamB2 &&
    areUniqueIds([teamA1Id, teamA2Id, teamB1Id, teamB2Id])
  const selectionCount =
    matchType === 'singles'
      ? [playerAId, playerBId].filter(Boolean).length
      : [teamA1Id, teamA2Id, teamB1Id, teamB2Id].filter(Boolean).length
  const selectionTarget = matchType === 'singles' ? 2 : 4
  const selectionProgressText = `${selectionCount} of ${selectionTarget} slots selected`
  const selectionGuidance =
    matchType === 'singles'
      ? 'Pick two different players to see the projection, edge, and head-to-head history.'
      : 'Pick four different players to compare doubles teams and see partner-aware projections.'

  const insufficientDataMessage = useMemo(() => {
    if (matchType === 'singles') {
      if (!hasSinglesSelection) return ''
      const left = playerA ? getSelectedRating(playerA, getEngineRatingView(matchType)) : null
      const right = playerB ? getSelectedRating(playerB, getEngineRatingView(matchType)) : null
      if (!hasValidRating(left) || !hasValidRating(right)) {
        return 'Not enough rating data to generate a projection for this singles matchup.'
      }
      return ''
    }

    if (!hasDoublesSelection) return ''

    const ratings = [
      teamA1 ? getSelectedRating(teamA1, 'doubles') : null,
      teamA2 ? getSelectedRating(teamA2, 'doubles') : null,
      teamB1 ? getSelectedRating(teamB1, 'doubles') : null,
      teamB2 ? getSelectedRating(teamB2, 'doubles') : null,
    ]

    if (!ratings.every(hasValidRating)) {
      return 'Not enough doubles rating data to generate a projection for this team matchup.'
    }

    return ''
  }, [matchType, hasSinglesSelection, hasDoublesSelection, playerA, playerB, teamA1, teamA2, teamB1, teamB2])

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

      if (!hasValidRating(left) || !hasValidRating(right)) return null

      const leftOverall = getSelectedRating(playerA, 'overall')
      const leftSingles = getSelectedRating(playerA, 'singles')
      const leftDoubles = getSelectedRating(playerA, 'doubles')
      const rightOverall = getSelectedRating(playerB, 'overall')
      const rightSingles = getSelectedRating(playerB, 'singles')
      const rightDoubles = getSelectedRating(playerB, 'doubles')
      const gap = Math.abs(left - right)

      return {
        leftLabel: playerA.name,
        rightLabel: playerB.name,
        leftLocation: playerA.location || 'No location set',
        rightLocation: playerB.location || 'No location set',
        leftRatings: {
          overall: leftOverall,
          singles: leftSingles,
          doubles: leftDoubles,
        },
        rightRatings: {
          overall: rightOverall,
          singles: rightSingles,
          doubles: rightDoubles,
        },
        leftUstaRatings: {
          overall: playerA.overall_usta_dynamic_rating ?? null,
          singles: playerA.singles_usta_dynamic_rating ?? null,
          doubles: playerA.doubles_usta_dynamic_rating ?? null,
        },
        rightUstaRatings: {
          overall: playerB.overall_usta_dynamic_rating ?? null,
          singles: playerB.singles_usta_dynamic_rating ?? null,
          doubles: playerB.doubles_usta_dynamic_rating ?? null,
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

    const teamAOverallRatings = [getSelectedRating(teamA1, 'overall'), getSelectedRating(teamA2, 'overall')]
    const teamASinglesRatings = [getSelectedRating(teamA1, 'singles'), getSelectedRating(teamA2, 'singles')]
    const teamADoublesRatings = [getSelectedRating(teamA1, 'doubles'), getSelectedRating(teamA2, 'doubles')]

    const teamBOverallRatings = [getSelectedRating(teamB1, 'overall'), getSelectedRating(teamB2, 'overall')]
    const teamBSinglesRatings = [getSelectedRating(teamB1, 'singles'), getSelectedRating(teamB2, 'singles')]
    const teamBDoublesRatings = [getSelectedRating(teamB1, 'doubles'), getSelectedRating(teamB2, 'doubles')]

    const leftEngineRatings = teamADoublesRatings
    const rightEngineRatings = teamBDoublesRatings

    if (
      !leftEngineRatings.every(hasValidRating) ||
      !rightEngineRatings.every(hasValidRating)
    ) {
      return null
    }

    const teamALabel = `${teamA1.name} / ${teamA2.name}`
    const teamBLabel = `${teamB1.name} / ${teamB2.name}`

    const teamARatings = {
      overall: teamAOverallRatings.every(hasValidRating) ? average(teamAOverallRatings) : null,
      singles: teamASinglesRatings.every(hasValidRating) ? average(teamASinglesRatings) : null,
      doubles: teamADoublesRatings.every(hasValidRating) ? average(teamADoublesRatings) : null,
    }

    const teamBRatings = {
      overall: teamBOverallRatings.every(hasValidRating) ? average(teamBOverallRatings) : null,
      singles: teamBSinglesRatings.every(hasValidRating) ? average(teamBSinglesRatings) : null,
      doubles: teamBDoublesRatings.every(hasValidRating) ? average(teamBDoublesRatings) : null,
    }

    const left = average(leftEngineRatings)
    const right = average(rightEngineRatings)
    const gap = Math.abs(left - right)

    return {
      leftLabel: teamALabel,
      rightLabel: teamBLabel,
      leftLocation: 'Team A',
      rightLocation: 'Team B',
      leftRatings: teamARatings,
      rightRatings: teamBRatings,
      leftUstaRatings: {
        overall: [teamA1.overall_usta_dynamic_rating ?? null, teamA2.overall_usta_dynamic_rating ?? null].every(hasValidRating) ? average([teamA1.overall_usta_dynamic_rating!, teamA2.overall_usta_dynamic_rating!]) : null,
        singles: [teamA1.singles_usta_dynamic_rating ?? null, teamA2.singles_usta_dynamic_rating ?? null].every(hasValidRating) ? average([teamA1.singles_usta_dynamic_rating!, teamA2.singles_usta_dynamic_rating!]) : null,
        doubles: [teamA1.doubles_usta_dynamic_rating ?? null, teamA2.doubles_usta_dynamic_rating ?? null].every(hasValidRating) ? average([teamA1.doubles_usta_dynamic_rating!, teamA2.doubles_usta_dynamic_rating!]) : null,
      },
      rightUstaRatings: {
        overall: [teamB1.overall_usta_dynamic_rating ?? null, teamB2.overall_usta_dynamic_rating ?? null].every(hasValidRating) ? average([teamB1.overall_usta_dynamic_rating!, teamB2.overall_usta_dynamic_rating!]) : null,
        singles: [teamB1.singles_usta_dynamic_rating ?? null, teamB2.singles_usta_dynamic_rating ?? null].every(hasValidRating) ? average([teamB1.singles_usta_dynamic_rating!, teamB2.singles_usta_dynamic_rating!]) : null,
        doubles: [teamB1.doubles_usta_dynamic_rating ?? null, teamB2.doubles_usta_dynamic_rating ?? null].every(hasValidRating) ? average([teamB1.doubles_usta_dynamic_rating!, teamB2.doubles_usta_dynamic_rating!]) : null,
      },
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
    if (!comparison) return null

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

    if (!hasValidRating(left) || !hasValidRating(right)) return null
    return Math.abs(left - right)
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

    if (!hasValidRating(left) || !hasValidRating(right)) return 'Insufficient rating data'
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
      matchTier: getMatchTier(favoriteProbability),
      isSwingMatch: isSwingMatch(favoriteProbability),
      captainInsight: getCaptainInsight(favoriteProbability, favoriteLabel, underdogLabel),
      swapImpactHint: getSwapImpactHint(favoriteProbability, comparison.gap),
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
                <CopyLinkButton />
              </div>

              {!access.canUseAdvancedPlayerInsights ? (
                <div style={{ marginTop: 18, maxWidth: 560 }}>
                  <UpgradePrompt
                    planId="player_plus"
                    compact
                    headline="Want clearer matchup answers before match day?"
                    body="Unlock Player+ to go beyond raw comparison and use deeper projections, opponent context, and where-you-should-play guidance."
                    ctaLabel="Unlock Player+"
                    ctaHref="/pricing"
                    secondaryLabel="See Player+ value"
                    secondaryHref="/pricing"
                    footnote="Best for players who want matchup comparisons to turn into better decisions, not just interesting numbers."
                  />
                </div>
              ) : null}
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

            <div style={selectionProgressCard}>
              <div style={selectionProgressLabel}>Comparison readiness</div>
              <div style={selectionProgressValue}>{selectionProgressText}</div>
              <div style={selectionProgressTextStyle}>{selectionGuidance}</div>
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
            <>
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
              {(teamA1Id || teamA2Id || teamB1Id || teamB2Id) ? (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                  <SwapSidesButton
                    onClick={() => {
                      const [a1, a2, b1, b2] = [teamA1Id, teamA2Id, teamB1Id, teamB2Id]
                      setTeamA1Id(b1)
                      setTeamA2Id(b2)
                      setTeamB1Id(a1)
                      setTeamB2Id(a2)
                    }}
                  />
                </div>
              ) : null}
            </>
          )}

          {error ? (
            <div style={errorBanner}>
              <div>{error}</div>
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => void loadPlayers()} style={retryButtonStyle}>
                  Retry matchup load
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div style={emptyState}>Loading players...</div>
          ) : !comparison ? (
            <div style={emptyState}>
              <div style={emptyStateTitle}>Build the matchup first</div>
              <div style={emptyStateText}>
                {insufficientDataMessage ||
                  (matchType === 'singles'
                    ? 'Select two different players to compare.'
                    : 'Select four different players to compare doubles teams.')}
              </div>
              <div style={emptyStateHint}>
                Tip: start with your projected court assignment, then use the probability and swing-match signals to decide whether you need a safer or higher-upside option.
              </div>
              <button
                type="button"
                style={resetButton}
                onClick={() => {
                  setPlayerAId('')
                  setPlayerBId('')
                  setTeamA1Id('')
                  setTeamA2Id('')
                  setTeamB1Id('')
                  setTeamB2Id('')
                  setHeadToHead(null)
                }}
              >
                Reset selections
              </button>
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
                  ustaRatings={comparison.leftUstaRatings}
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
                  ustaRatings={comparison.rightUstaRatings}
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

                  <div style={recommendationCard}>
                    <div style={recommendationTitle}>Match intelligence</div>
                    <div style={intelligenceTierRow}>
                      <span style={intelligenceTierPill}>{projection.matchTier}</span>
                      {projection.isSwingMatch ? (
                        <span style={intelligenceWarningPill}>Swing court</span>
                      ) : null}
                    </div>
                    <div style={recommendationTextStyle}>{projection.captainInsight}</div>
                    <div style={intelligenceHintBox}>
                      <div style={intelligenceHintLabel}>Swap impact</div>
                      <div style={intelligenceHintText}>{projection.swapImpactHint}</div>
                    </div>
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
                  <div style={emptyHeadToHeadCard}>
                    <div style={emptyHeadToHeadTitle}>No direct head-to-head history yet.</div>
                    <p style={emptyHeadToHeadText}>
                      The projection still uses current ratings, but there are no recorded matches for this
                      exact singles pairing or doubles team matchup.
                    </p>
                    <div style={emptyHeadToHeadActions}>
                      <Link href="/players" style={miniGhostButton}>
                        Browse players
                      </Link>
                      <Link href="/rankings" style={miniGhostButton}>
                        Check rankings
                      </Link>
                    </div>
                  </div>
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
      {!loading && !error ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>How to read matchup output</div>
            <h2 style={sectionTitle}>Use matchup as a decision aid, not a guarantee.</h2>
            <p style={editorialText}>
              The projection is most useful when you combine probability, confidence, head-to-head
              history, and the surrounding roster decision. This page helps you compare options and
              spot swing courts, but it should still sit inside a wider lineup or scouting conversation.
            </p>
            <div style={editorialGrid}>
              <div style={editorialCard}>
                <div style={editorialCardLabel}>Best use</div>
                <div style={editorialCardValue}>Compare options</div>
                <div style={editorialCardText}>Great for deciding between close lineup alternatives.</div>
              </div>
              <div style={editorialCard}>
                <div style={editorialCardLabel}>Strongest signals</div>
                <div style={editorialCardValue}>Gap + confidence</div>
                <div style={editorialCardText}>Those usually matter more than a single flashy percentage alone.</div>
              </div>
              <div style={editorialCard}>
                <div style={editorialCardLabel}>Next move</div>
                <div style={editorialCardValue}>Apply team context</div>
                <div style={editorialCardText}>Take the result into captain tools when the decision affects a full lineup.</div>
              </div>
            </div>
          </article>
        </section>
      ) : null}
      <div style={{ marginTop: 12 }}>
        <AdsenseSlot slot={MATCHUP_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
      </div>
    </SiteShell>
  )
}

function CompareCard({
  title,
  subtitle,
  ratings,
  ustaRatings,
  projectionRating,
  ratingView,
  projectionView,
  profileHref,
  favored,
  dynamicRatingGrid,
}: {
  title: string
  subtitle: string
  ratings: { overall: number | null; singles: number | null; doubles: number | null }
  ustaRatings: { overall: number | null; singles: number | null; doubles: number | null }
  projectionRating: number | null
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

      <div style={{ marginBottom: 6, fontSize: 11, color: '#888', fontWeight: 600, letterSpacing: '0.04em' }}>TIQ DYNAMIC</div>
      <div style={dynamicRatingGrid}>
        <RatingPill label="Overall" value={ratings.overall} active={ratingView === 'overall'} />
        <RatingPill label="Singles" value={ratings.singles} active={ratingView === 'singles'} />
        <RatingPill label="Doubles" value={ratings.doubles} active={ratingView === 'doubles'} />
      </div>

      <div style={{ marginTop: 10, marginBottom: 6, fontSize: 11, color: '#888', fontWeight: 600, letterSpacing: '0.04em' }}>USTA DYNAMIC</div>
      <div style={dynamicRatingGrid}>
        <RatingPill label="Overall" value={ustaRatings.overall} active={ratingView === 'overall'} />
        <RatingPill label="Singles" value={ustaRatings.singles} active={ratingView === 'singles'} />
        <RatingPill label="Doubles" value={ustaRatings.doubles} active={ratingView === 'doubles'} />
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
  value: number | null
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

function CopyLinkButton() {
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        borderRadius: '999px',
        border: `1px solid ${copied ? 'rgba(155,225,29,0.35)' : hovered ? 'rgba(116,190,255,0.30)' : 'rgba(116,190,255,0.14)'}`,
        background: copied ? 'rgba(155,225,29,0.08)' : hovered ? 'rgba(116,190,255,0.07)' : 'rgba(255,255,255,0.03)',
        color: copied ? '#d8ffa8' : hovered ? '#cde1ff' : 'rgba(210,226,244,0.68)',
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 160ms ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {copied ? '✓ Copied' : '⎘ Copy link'}
    </button>
  )
}

function SwapSidesButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '10px 20px',
        borderRadius: '999px',
        border: `1px solid ${hovered ? 'rgba(155,225,29,0.38)' : 'rgba(116,190,255,0.18)'}`,
        background: hovered ? 'rgba(155,225,29,0.08)' : 'rgba(255,255,255,0.04)',
        color: hovered ? '#d8ffa8' : 'rgba(214,228,246,0.82)',
        fontSize: '13px',
        fontWeight: 800,
        cursor: 'pointer',
        transition: 'all 160ms ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        letterSpacing: '-0.01em',
      }}
    >
      ↕ Swap sides
    </button>
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

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getSelectedRating(player: Player, view: RatingView): number | null {
  if (view === 'singles') return hasValidRating(player.singles_dynamic_rating) ? player.singles_dynamic_rating : null
  if (view === 'doubles') return hasValidRating(player.doubles_dynamic_rating) ? player.doubles_dynamic_rating : null
  return hasValidRating(player.overall_dynamic_rating) ? player.overall_dynamic_rating : null
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

function getMatchTier(favoriteProbability: number) {
  if (favoriteProbability >= 0.75) return 'Anchor Match'
  if (favoriteProbability >= 0.66) return 'Strong Lean'
  if (favoriteProbability >= 0.58) return 'Lean Match'
  if (favoriteProbability >= 0.52) return 'Swing Match'
  return 'Toss-up'
}

function isSwingMatch(favoriteProbability: number) {
  return favoriteProbability >= 0.45 && favoriteProbability <= 0.55
}

function getCaptainInsight(
  favoriteProbability: number,
  favoriteLabel: string,
  underdogLabel: string,
) {
  if (favoriteProbability >= 0.75) {
    return `${favoriteLabel} should be treated as an anchor court. This is one of your cleaner spots to trust the favorite and use elsewhere to absorb risk.`
  }
  if (favoriteProbability >= 0.66) {
    return `${favoriteLabel} has a meaningful edge over ${underdogLabel}. This is a favorable court, but placement and surrounding lineup context still matter.`
  }
  if (favoriteProbability >= 0.58) {
    return `${favoriteLabel} is favored, but not safely. This is a leverage court where a small lineup change or opponent adjustment can change the tie picture.`
  }
  if (favoriteProbability >= 0.52) {
    return `This is a swing court. Treat it as one of the likely tie-deciding matches and be careful about where you expose weaker lineup spots around it.`
  }
  return `This is a true toss-up. Do not count this court as secure for either side without stronger lineup context or scouting.`
}

function getSwapImpactHint(favoriteProbability: number, ratingGap: number) {
  if (favoriteProbability >= 0.75 && ratingGap >= 0.25) {
    return 'Low swap urgency. This court is already carrying a strong edge.'
  }
  if (favoriteProbability >= 0.66) {
    return 'Moderate swap value. A stronger opponent assignment could still tighten this court.'
  }
  if (favoriteProbability >= 0.58) {
    return 'Meaningful swap opportunity. A better placement here can improve your overall tie odds.'
  }
  if (favoriteProbability >= 0.52) {
    return 'High swap sensitivity. Even a small move could flip this court.'
  }
  return 'Maximum swap sensitivity. This matchup is close enough that player placement likely decides it.'
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

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '30px',
  background: 'var(--shell-panel-bg-strong)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-card)',
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
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '7px 11px',
  borderRadius: '999px',
  color: 'var(--home-eyebrow-color)',
  background: 'var(--home-eyebrow-bg)',
  border: '1px solid var(--home-eyebrow-border)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 88%, var(--brand-blue-2) 12%)',
  boxShadow: 'var(--shadow-soft)',
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
  border: '1px solid var(--shell-panel-border)',
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-green) 12%, transparent), transparent 34%), var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-card)',
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
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--home-control-shadow)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
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

const editorialPanel: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '24px',
  borderRadius: '26px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
}

const editorialText: CSSProperties = {
  margin: 0,
  color: 'rgba(220,233,248,0.78)',
  fontSize: '15px',
  lineHeight: 1.8,
  maxWidth: '860px',
}

const editorialGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const editorialCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '18px',
  borderRadius: '20px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
  border: '1px solid rgba(116,190,255,0.12)',
}

const editorialCardLabel: CSSProperties = {
  color: 'rgba(188,208,232,0.78)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const editorialCardValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '24px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const editorialCardText: CSSProperties = {
  color: 'rgba(215,229,247,0.76)',
  fontSize: '13px',
  lineHeight: 1.65,
}

const retryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 800,
  cursor: 'pointer',
}

const emptyState: CSSProperties = {
  borderRadius: '18px',
  padding: '18px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--shell-copy-muted)',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 600,
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const emptyStateTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '24px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
  marginBottom: '10px',
}

const emptyStateText: CSSProperties = {
  color: 'var(--foreground)',
  lineHeight: 1.65,
  marginBottom: '10px',
}

const emptyStateHint: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  marginBottom: '14px',
}

const resetButton: CSSProperties = {
  minHeight: '42px',
  padding: '0 16px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.22) 0%, rgba(27,62,120,0.18) 100%)',
  color: '#e7eefb',
  fontWeight: 800,
  fontSize: '13px',
  cursor: 'pointer',
}

const selectionProgressCard: CSSProperties = {
  borderRadius: '20px',
  padding: '14px 16px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.05)',
  minWidth: '220px',
}

const selectionProgressLabel: CSSProperties = {
  color: 'rgba(198,216,248,0.84)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const selectionProgressValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
  marginBottom: '6px',
}

const selectionProgressTextStyle: CSSProperties = {
  color: 'rgba(224,236,249,0.76)',
  fontSize: '13px',
  lineHeight: 1.6,
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

const sectionKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
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

const emptyHeadToHeadCard: CSSProperties = {
  marginTop: '12px',
  borderRadius: '18px',
  padding: '18px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
}

const emptyHeadToHeadTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '22px',
  lineHeight: 1.15,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const emptyHeadToHeadText: CSSProperties = {
  margin: '10px 0 0',
  color: 'rgba(220,233,248,0.78)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const emptyHeadToHeadActions: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '14px',
}


const intelligenceTierRow: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '10px',
}

const intelligenceTierPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '8px 12px',
  background: 'rgba(37,91,227,0.16)',
  border: '1px solid rgba(116,190,255,0.16)',
  color: '#d6e9ff',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const intelligenceWarningPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '8px 12px',
  background: 'rgba(250,204,21,0.14)',
  border: '1px solid rgba(250,204,21,0.24)',
  color: '#fde68a',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const intelligenceHintBox: CSSProperties = {
  marginTop: '12px',
  borderRadius: '14px',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const intelligenceHintLabel: CSSProperties = {
  color: '#f4f9ff',
  fontSize: '12px',
  lineHeight: 1.2,
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const intelligenceHintText: CSSProperties = {
  marginTop: '6px',
  color: 'rgba(220,233,248,0.78)',
  fontSize: '14px',
  lineHeight: 1.65,
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
