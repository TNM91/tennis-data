'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import CoordinatorSubnav from '@/app/components/coordinator-subnav'
import SiteShell from '@/app/components/site-shell'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import {
  getTiqLeagueById,
  listTiqLeagues,
  listTiqPlayerLeagueEntries,
  type TiqPlayerLeagueEntryRecord,
} from '@/lib/tiq-league-service'
import type { TiqLeagueRecord } from '@/lib/tiq-league-registry'
import {
  deleteTiqIndividualLeagueResult,
  listTiqIndividualLeagueResults,
  saveTiqIndividualLeagueResult,
  type TiqIndividualLeagueResultRecord,
  type TiqLeagueStorageSource as TiqResultStorageSource,
} from '@/lib/tiq-individual-results-service'
import { buildTiqIndividualLeagueSummaries } from '@/lib/tiq-individual-results-summary'
import { completeTiqIndividualSuggestionsForPair } from '@/lib/tiq-individual-suggestions-service'
import {
  getTiqIndividualCompetitionFormatExperience,
  getTiqIndividualCompetitionFormatLabel,
} from '@/lib/tiq-individual-format'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/captain-formatters'

type ResultParticipantOption = {
  value: string
  playerId: string
  playerName: string
}

type PlayerResultStanding = {
  rank: number
  playerId: string
  playerName: string
  wins: number
  losses: number
  matches: number
  recentForm: Array<'W' | 'L'>
  uniqueOpponents: number
  possibleOpponents: number
  completionRate: number | null
}

type ResultReviewFilter = 'all' | 'edited' | 'clean'
type ResultDateFilter = 'all' | 'week' | 'month'

const pageWrap: CSSProperties = { maxWidth: 1000, margin: '0 auto', padding: '32px 16px' }
const heading: CSSProperties = { fontSize: 32, fontWeight: 900, marginBottom: 8, letterSpacing: 0 }
const subheading: CSSProperties = { color: '#b8c7dc', fontSize: 15, lineHeight: 1.55, marginBottom: 0, maxWidth: 700 }
const introCard: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(13, 31, 55, 0.92), rgba(6, 17, 33, 0.96))',
  border: '1px solid rgba(124, 167, 255, 0.18)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 22,
}
const card: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '18px 20px',
  marginBottom: 14,
}
const detailsCard: CSSProperties = { ...card, display: 'grid', gap: 12 }
const detailsSummary: CSSProperties = {
  cursor: 'pointer',
  listStyle: 'none',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}
const sectionTitle: CSSProperties = { fontSize: 16, fontWeight: 800, marginBottom: 14, marginTop: 28 }
const row: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }
const fieldWrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 190px' }
const labelStyle: CSSProperties = { fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }
const inputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f1f5f9',
  fontSize: 14,
}
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 82, resize: 'vertical' }
const btnPrimary: CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: '#9be11d',
  color: '#0a0a0a',
  fontWeight: 800,
  fontSize: 14,
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const btnSecondary: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
  color: '#e2e8f0',
  fontWeight: 700,
  fontSize: 13,
  border: '1px solid rgba(255,255,255,0.10)',
  cursor: 'pointer',
  textDecoration: 'none',
}
const btnDanger: CSSProperties = {
  ...btnSecondary,
  background: 'rgba(239,68,68,0.14)',
  color: '#fca5a5',
  border: '1px solid rgba(239,68,68,0.24)',
}
const disabledButton: CSSProperties = { opacity: 0.6, cursor: 'not-allowed' }
const msgOk: CSSProperties = { color: '#9be11d', fontSize: 13, marginTop: 6 }
const msgErr: CSSProperties = { color: '#f87171', fontSize: 13, marginTop: 6 }
const pill: CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', fontSize: 12, color: '#94a3b8' }
const pillGreen: CSSProperties = { ...pill, background: 'rgba(155,225,29,0.12)', color: '#9be11d' }
const pillAmber: CSSProperties = { ...pill, background: 'rgba(251,191,36,0.13)', color: '#fbbf24' }
const scorekeeperGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 18 }
const scorekeeperTile: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(124,167,255,0.14)',
  background: 'rgba(255,255,255,0.055)',
}
const tileLabel: CSSProperties = { color: '#93b7ea', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }
const tileValue: CSSProperties = { color: '#f8fbff', fontSize: 24, fontWeight: 950, marginTop: 5, lineHeight: 1.05 }
const tileText: CSSProperties = { color: '#b8c7dc', fontSize: 13, lineHeight: 1.5, marginTop: 6 }
const flowStrip: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 16 }
const flowStep: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px 1fr',
  gap: 10,
  alignItems: 'center',
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}
const flowNumber: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 32,
  height: 32,
  borderRadius: 999,
  background: 'linear-gradient(135deg, #9be11d 0%, #45e3a1 100%)',
  color: '#071425',
  fontWeight: 950,
}
const flowTitle: CSSProperties = { color: '#f8fbff', fontWeight: 900, fontSize: 14 }
const flowText: CSSProperties = { color: '#b8c7dc', fontSize: 12, marginTop: 2 }
const listWrap: CSSProperties = { display: 'grid', gap: 10 }
const resultCard: CSSProperties = {
  ...card,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}
const resultTitle: CSSProperties = { color: '#f8fbff', fontSize: 15, fontWeight: 850, marginBottom: 5 }
const resultMeta: CSSProperties = { color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }
const actionRow: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }
const insightGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 14,
  marginTop: 18,
}
const standingsList: CSSProperties = { display: 'grid', gap: 8 }
const standingRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.07)',
}
const standingRank: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  color: '#071425',
  background: '#9be11d',
  fontSize: 12,
  fontWeight: 900,
}
const standingName: CSSProperties = { color: '#f8fbff', fontWeight: 850, fontSize: 14, minWidth: 0 }
const standingSubtext: CSSProperties = { color: '#94a3b8', fontSize: 12, marginTop: 3 }
const metricStack: CSSProperties = { display: 'grid', gap: 5, justifyItems: 'end', color: '#dbeafe', fontSize: 12, fontWeight: 800 }
const emptyCard: CSSProperties = {
  ...card,
  color: '#94a3b8',
  lineHeight: 1.5,
}
const reviewToolbar: CSSProperties = {
  ...card,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 10,
  alignItems: 'end',
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label style={{ ...fieldWrap, ...(wide ? { flexBasis: '100%' } : {}) }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

function resultOpponentName(result: TiqIndividualLeagueResultRecord) {
  return result.winnerPlayerName === result.playerAName ? result.playerBName : result.playerAName
}

function participantValue(playerId: string, playerName: string) {
  return playerId || `name:${playerName}`
}

function dateInputValue(value: string) {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function isEditedResult(result: TiqIndividualLeagueResultRecord) {
  const createdTime = result.createdAt ? new Date(result.createdAt).getTime() : 0
  const updatedTime = result.updatedAt ? new Date(result.updatedAt).getTime() : 0
  if (!createdTime || !updatedTime) return false

  return updatedTime - createdTime > 1000
}

function formatResultTimestamp(value: string) {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return ''

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function resultDateIsWithinDays(value: string, days: number) {
  const parsed = value ? new Date(value).getTime() : 0
  if (!parsed) return false

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return parsed >= cutoff
}

function hasResultBetween(results: TiqIndividualLeagueResultRecord[], leftName: string, rightName: string) {
  const left = leftName.toLowerCase()
  const right = rightName.toLowerCase()

  return results.some((result) => {
    const playerA = result.playerAName.toLowerCase()
    const playerB = result.playerBName.toLowerCase()
    return (playerA === left && playerB === right) || (playerA === right && playerB === left)
  })
}

function buildPlayerResultStandings(
  entries: TiqPlayerLeagueEntryRecord[],
  leagueResults: TiqIndividualLeagueResultRecord[],
): PlayerResultStanding[] {
  const totalEntrants = entries.length

  return entries
    .map((entry) => {
      const normalizedName = entry.playerName.toLowerCase()
      const playerResults = leagueResults.filter((result) => {
        return result.playerAName.toLowerCase() === normalizedName || result.playerBName.toLowerCase() === normalizedName
      })
      const wins = playerResults.filter((result) => result.winnerPlayerName.toLowerCase() === normalizedName).length
      const losses = playerResults.length - wins
      const uniqueOpponents = new Set(
        playerResults.map((result) =>
          result.playerAName.toLowerCase() === normalizedName ? result.playerBName : result.playerAName,
        ),
      ).size
      const possibleOpponents = Math.max(totalEntrants - 1, 0)

      return {
        rank: 0,
        playerId: entry.playerId,
        playerName: entry.playerName,
        wins,
        losses,
        matches: playerResults.length,
        recentForm: playerResults.slice(0, 5).map((result) =>
          result.winnerPlayerName.toLowerCase() === normalizedName ? 'W' : 'L',
        ),
        uniqueOpponents,
        possibleOpponents,
        completionRate: possibleOpponents > 0 ? uniqueOpponents / possibleOpponents : null,
      }
    })
    .sort((left, right) => {
      if (right.wins !== left.wins) return right.wins - left.wins
      if (left.losses !== right.losses) return left.losses - right.losses
      if (right.matches !== left.matches) return right.matches - left.matches
      if (right.uniqueOpponents !== left.uniqueOpponents) return right.uniqueOpponents - left.uniqueOpponents
      return left.playerName.localeCompare(right.playerName)
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

function findNextPairing(
  standings: PlayerResultStanding[],
  leagueResults: TiqIndividualLeagueResultRecord[],
): [PlayerResultStanding, PlayerResultStanding] | null {
  if (standings.length < 2) return null

  const byNeed = [...standings].sort((left, right) => {
    if (left.matches !== right.matches) return left.matches - right.matches
    if (left.uniqueOpponents !== right.uniqueOpponents) return left.uniqueOpponents - right.uniqueOpponents
    return left.rank - right.rank
  })

  for (const left of byNeed) {
    const right = standings.find(
      (candidate) =>
        candidate.playerName !== left.playerName &&
        !hasResultBetween(leagueResults, left.playerName, candidate.playerName),
    )
    if (right) return [left, right]
  }

  return [byNeed[0], byNeed[1]]
}

function fallbackEntriesForLeague(league: TiqLeagueRecord | null): TiqPlayerLeagueEntryRecord[] {
  if (!league || league.leagueFormat !== 'individual') return []

  return (league.players || []).map((playerName) => ({
    leagueId: league.id,
    playerName,
    playerId: '',
    playerLocation: '',
    entryStatus: 'active' as const,
  }))
}

export function IndividualLeagueResultsWorkspace({
  activeRoute = '/league-coordinator',
  loginNextHref = '/league-coordinator/individual-results',
  resultsHref = '/league-coordinator/individual-results',
}: {
  activeRoute?: string
  loginNextHref?: string
  resultsHref?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialLeagueId = searchParams.get('leagueId') || searchParams.get('league_id') || ''

  const [leagues, setLeagues] = useState<TiqLeagueRecord[]>([])
  const [results, setResults] = useState<TiqIndividualLeagueResultRecord[]>([])
  const [playerEntries, setPlayerEntries] = useState<TiqPlayerLeagueEntryRecord[]>([])
  const [filterLeagueId, setFilterLeagueId] = useState(initialLeagueId)
  const [formLeagueId, setFormLeagueId] = useState(initialLeagueId)
  const [resultPlayerA, setResultPlayerA] = useState('')
  const [resultPlayerB, setResultPlayerB] = useState('')
  const [resultWinner, setResultWinner] = useState('')
  const [resultScore, setResultScore] = useState('')
  const [resultDate, setResultDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [resultNotes, setResultNotes] = useState('')
  const [editingResultId, setEditingResultId] = useState('')
  const [resultSearch, setResultSearch] = useState('')
  const [resultReviewFilter, setResultReviewFilter] = useState<ResultReviewFilter>('all')
  const [resultDateFilter, setResultDateFilter] = useState<ResultDateFilter>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [resultStorageSource, setResultStorageSource] = useState<TiqResultStorageSource>('local')
  const [canEditResults, setCanEditResults] = useState(false)
  const [accessResolved, setAccessResolved] = useState(false)
  const [accessMessage, setAccessMessage] = useState('')
  const [resultFormOpen, setResultFormOpen] = useState(false)

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === formLeagueId) || null,
    [formLeagueId, leagues],
  )
  const selectedLeagueExperience = getTiqIndividualCompetitionFormatExperience(
    selectedLeague?.individualCompetitionFormat,
  )
  const editingResult = results.find((result) => result.id === editingResultId) || null
  const visiblePlayerEntries = playerEntries.length > 0 ? playerEntries : fallbackEntriesForLeague(selectedLeague)
  const resultParticipantOptions = useMemo<ResultParticipantOption[]>(
    () => {
      const options = visiblePlayerEntries.map((entry) => ({
        value: participantValue(entry.playerId, entry.playerName),
        playerId: entry.playerId,
        playerName: entry.playerName,
      }))

      if (editingResult && editingResult.leagueId === selectedLeague?.id) {
        const editingPlayers = [
          { playerId: editingResult.playerAId, playerName: editingResult.playerAName },
          { playerId: editingResult.playerBId, playerName: editingResult.playerBName },
        ]

        editingPlayers.forEach((player) => {
          const value = participantValue(player.playerId, player.playerName)
          if (!options.some((option) => option.value === value)) {
            options.push({
              value,
              playerId: player.playerId,
              playerName: player.playerName,
            })
          }
        })
      }

      return options
    },
    [editingResult, selectedLeague?.id, visiblePlayerEntries],
  )
  const resultPlayerAOption =
    resultParticipantOptions.find((option) => option.value === resultPlayerA) || null
  const resultPlayerBOption =
    resultParticipantOptions.find((option) => option.value === resultPlayerB) || null
  const resultWinnerOptions = [resultPlayerAOption, resultPlayerBOption].filter(
    (option): option is ResultParticipantOption => Boolean(option),
  )
  const latestResult = results[0] || null
  const editedResultsCount = results.filter(isEditedResult).length
  const normalizedResultSearch = resultSearch.trim().toLowerCase()
  const visibleResults = useMemo(() => {
    return results.filter((result) => {
      const edited = isEditedResult(result)
      if (resultReviewFilter === 'edited' && !edited) return false
      if (resultReviewFilter === 'clean' && edited) return false
      if (resultDateFilter === 'week' && !resultDateIsWithinDays(result.resultDate, 7)) return false
      if (resultDateFilter === 'month' && !resultDateIsWithinDays(result.resultDate, 30)) return false

      if (!normalizedResultSearch) return true

      const league = leagues.find((item) => item.id === result.leagueId)
      const haystack = [
        result.winnerPlayerName,
        resultOpponentName(result),
        result.playerAName,
        result.playerBName,
        result.score,
        result.notes,
        league?.leagueName,
        formatDate(result.resultDate),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedResultSearch)
    })
  }, [leagues, normalizedResultSearch, resultDateFilter, resultReviewFilter, results])
  const activeResultFilterCount =
    (filterLeagueId ? 1 : 0) +
    (normalizedResultSearch ? 1 : 0) +
    (resultReviewFilter !== 'all' ? 1 : 0) +
    (resultDateFilter !== 'all' ? 1 : 0)
  const selectedLeagueResults = useMemo(
    () => (selectedLeague ? results.filter((result) => result.leagueId === selectedLeague.id) : []),
    [results, selectedLeague],
  )
  const selectedLeagueStandings = useMemo(
    () => buildPlayerResultStandings(visiblePlayerEntries, selectedLeagueResults),
    [selectedLeagueResults, visiblePlayerEntries],
  )
  const nextPairing = useMemo(
    () => findNextPairing(selectedLeagueStandings, selectedLeagueResults),
    [selectedLeagueResults, selectedLeagueStandings],
  )
  const summaryByLeague = useMemo(() => buildTiqIndividualLeagueSummaries(results), [results])
  const selectedSummary = formLeagueId ? summaryByLeague.get(formLeagueId) || null : null
  const activeParticipantCount = selectedLeague
    ? visiblePlayerEntries.length
    : leagues.reduce((sum, league) => sum + (league.players || []).length, 0)

  useEffect(() => {
    let mounted = true

    async function checkAuth() {
      const authState = await getClientAuthState()
      if (!authState.user && mounted) {
        router.replace(`/login?next=${encodeURIComponent(loginNextHref)}`)
        return
      }

      if (authState.user && mounted) {
        const access = buildProductAccessState(authState.role, authState.entitlements)
        setCanEditResults(access.canCreateTiqIndividualLeague)
        setAccessMessage(access.individualLeagueMessage)
        setAccessResolved(true)
      }
    }

    void checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void checkAuth() })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loginNextHref, router])

  const refreshResults = useCallback(async (leagueId: string) => {
    const result = await listTiqIndividualLeagueResults({ leagueId: leagueId || null })
    setResults(result.results)
    setResultStorageSource(result.source)
    if (result.warning) setError(result.warning)
  }, [])

  const refreshPlayerEntries = useCallback(async (leagueId: string) => {
    setPlayerEntries([])
    if (!leagueId) return

    const leagueResult = await getTiqLeagueById(leagueId)
    if (leagueResult.warning) setError((current) => current || leagueResult.warning || '')
    if (!leagueResult.record || leagueResult.record.leagueFormat !== 'individual') return

    const result = await listTiqPlayerLeagueEntries(leagueResult.record.id)
    setPlayerEntries(result.entries)
    if (result.warning) setError((current) => current || result.warning || '')
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const leaguesResult = await listTiqLeagues()
    const individualLeagues = leaguesResult.records.filter((league) => league.leagueFormat === 'individual')
    const nextFormLeagueId = initialLeagueId || individualLeagues[0]?.id || ''

    setLeagues(individualLeagues)
    setFormLeagueId((current) => current || nextFormLeagueId)
    if (leaguesResult.warning) setError(leaguesResult.warning)
    await Promise.all([
      refreshResults(initialLeagueId || ''),
      refreshPlayerEntries(nextFormLeagueId),
    ])
    setLoading(false)
  }, [initialLeagueId, refreshPlayerEntries, refreshResults])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  async function handleFilterChange(leagueId: string) {
    setFilterLeagueId(leagueId)
    const nextHref = leagueId ? `${resultsHref}?leagueId=${encodeURIComponent(leagueId)}` : resultsHref
    router.replace(nextHref, { scroll: false })
    setLoading(true)
    setError('')
    resetResultForm()
    await refreshResults(leagueId)
    if (leagueId) {
      setFormLeagueId(leagueId)
      await refreshPlayerEntries(leagueId)
    }
    setLoading(false)
  }

  function resetResultForm() {
    setEditingResultId('')
    setResultPlayerA('')
    setResultPlayerB('')
    setResultWinner('')
    setResultScore('')
    setResultDate(new Date().toISOString().slice(0, 10))
    setResultNotes('')
  }

  async function handleFormLeagueChange(leagueId: string) {
    setFormLeagueId(leagueId)
    resetResultForm()
    setStatus('')
    if (leagueId && filterLeagueId !== leagueId) {
      setFilterLeagueId(leagueId)
      router.replace(`${resultsHref}?leagueId=${encodeURIComponent(leagueId)}`, { scroll: false })
      await refreshResults(leagueId)
    }
    await refreshPlayerEntries(leagueId)
  }

  function handleUsePairing(left: PlayerResultStanding, right: PlayerResultStanding) {
    if (!selectedLeague) return

    setEditingResultId('')
    setResultPlayerA(participantValue(left.playerId, left.playerName))
    setResultPlayerB(participantValue(right.playerId, right.playerName))
    setResultWinner('')
    setResultScore('')
    setResultNotes('')
    setResultFormOpen(true)
    setStatus(`Loaded ${left.playerName} vs ${right.playerName}. Choose the winner and score.`)
  }

  async function handleEditResult(result: TiqIndividualLeagueResultRecord) {
    setEditingResultId(result.id)
    setFormLeagueId(result.leagueId)
    setFilterLeagueId(result.leagueId)
    router.replace(`${resultsHref}?leagueId=${encodeURIComponent(result.leagueId)}`, { scroll: false })
    await refreshPlayerEntries(result.leagueId)
    setResultPlayerA(participantValue(result.playerAId, result.playerAName))
    setResultPlayerB(participantValue(result.playerBId, result.playerBName))
    setResultWinner(participantValue(result.winnerPlayerId, result.winnerPlayerName))
    setResultScore(result.score)
    setResultDate(dateInputValue(result.resultDate))
    setResultNotes(result.notes)
    setResultFormOpen(true)
    setStatus(`Editing ${result.winnerPlayerName} over ${resultOpponentName(result)}.`)
  }

  async function handleResultSubmit() {
    if (!canEditResults) {
      setStatus(accessMessage || 'Coordinator access is required before logging individual results.')
      return
    }

    if (!selectedLeague) {
      setStatus('Choose an individual TIQ league before logging a result.')
      return
    }

    if (!resultPlayerAOption || !resultPlayerBOption) {
      setStatus('Choose two players before logging a TIQ individual result.')
      return
    }

    if (resultPlayerAOption.value === resultPlayerBOption.value) {
      setStatus('A TIQ individual result needs two different players.')
      return
    }

    const winnerOption = resultWinnerOptions.find((option) => option.value === resultWinner) || null
    if (!winnerOption) {
      setStatus('Choose the winner before saving this TIQ individual result.')
      return
    }

    setSaving(true)
    setStatus('')

    try {
      const editingExistingResult = Boolean(editingResultId)
      const saveResult = await saveTiqIndividualLeagueResult({
        resultId: editingResultId || null,
        leagueId: selectedLeague.id,
        playerAName: resultPlayerAOption.playerName,
        playerAId: resultPlayerAOption.playerId,
        playerBName: resultPlayerBOption.playerName,
        playerBId: resultPlayerBOption.playerId,
        winnerPlayerName: winnerOption.playerName,
        winnerPlayerId: winnerOption.playerId,
        score: resultScore,
        resultDate: resultDate ? new Date(`${resultDate}T12:00:00`).toISOString() : new Date().toISOString(),
        notes: resultNotes,
      })
      const completion = await completeTiqIndividualSuggestionsForPair({
        leagueId: selectedLeague.id,
        playerAName: resultPlayerAOption.playerName,
        playerBName: resultPlayerBOption.playerName,
      })

      await refreshResults(filterLeagueId)
      setResultStorageSource(saveResult.source)
      setError(saveResult.warning || completion.warning || '')
      setStatus(
        `${editingExistingResult ? 'Updated' : 'Saved'} TIQ result: ${winnerOption.playerName} over ${
          winnerOption.value === resultPlayerAOption.value ? resultPlayerBOption.playerName : resultPlayerAOption.playerName
        }.`,
      )
      resetResultForm()
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : 'Unable to save this TIQ result.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteResult(result: TiqIndividualLeagueResultRecord) {
    if (!canEditResults) return
    if (!confirm(`Delete ${result.winnerPlayerName} over ${resultOpponentName(result)}? This cannot be undone.`)) return

    const deleteResult = await deleteTiqIndividualLeagueResult(result.id)
    await refreshResults(filterLeagueId)
    if (editingResultId === result.id) resetResultForm()
    setResultStorageSource(deleteResult.source)
    setStatus(deleteResult.warning || 'Result deleted.')
  }

  async function handleClearResultFilters() {
    setResultSearch('')
    setResultReviewFilter('all')
    setResultDateFilter('all')
    if (filterLeagueId) {
      await handleFilterChange('')
    }
  }

  return (
    <SiteShell active={activeRoute}>
      <CoordinatorSubnav
        title="Individual results"
        description="Log player results for ladders, round robins, and challenge leagues without leaving Coordinator."
        tierLabel={canEditResults ? 'Player results active' : 'Coordinator results locked'}
        tierActive={canEditResults}
      />
      <div style={pageWrap}>
        <div style={introCard}>
          <div style={heading}>Record player results fast.</div>
          <div style={subheading}>
            Pick the TIQ individual league, choose both players, save the scoreline, and keep standings,
            prompts, and rating sync current.
          </div>
          <div style={scorekeeperGrid}>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Individual leagues</div>
              <div style={tileValue}>{leagues.length}</div>
              <div style={tileText}>Available result groups</div>
            </div>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Results</div>
              <div style={tileValue}>{visibleResults.length}</div>
              <div style={tileText}>
                {activeResultFilterCount ? `${results.length} total in scope` : 'All recorded player results'}
              </div>
            </div>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Latest</div>
              <div style={tileValue}>{latestResult ? formatDate(latestResult.resultDate) : '-'}</div>
              <div style={tileText}>
                {latestResult ? `${latestResult.winnerPlayerName} def. ${resultOpponentName(latestResult)}` : 'No result yet'}
              </div>
            </div>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Leader</div>
              <div style={tileValue}>{selectedSummary?.leaderName || '-'}</div>
              <div style={tileText}>{selectedSummary ? `${selectedSummary.leaderRecord} ${selectedSummary.leaderRecentForm}` : `${activeParticipantCount} players tracked`}</div>
            </div>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Corrections</div>
              <div style={tileValue}>{editedResultsCount}</div>
              <div style={tileText}>{editedResultsCount === 1 ? 'Edited player result' : 'Edited player results'}</div>
            </div>
          </div>
          <div style={flowStrip}>
            <div style={flowStep}>
              <div style={flowNumber}>1</div>
              <div><div style={flowTitle}>Pick league</div><div style={flowText}>Ladder, round robin, challenge.</div></div>
            </div>
            <div style={flowStep}>
              <div style={flowNumber}>2</div>
              <div><div style={flowTitle}>Log result</div><div style={flowText}>Players, winner, score.</div></div>
            </div>
            <div style={flowStep}>
              <div style={flowNumber}>3</div>
              <div><div style={flowTitle}>Close prompts</div><div style={flowText}>Suggestions and ratings update.</div></div>
            </div>
          </div>
        </div>

        {error ? <p style={msgErr}>{error}</p> : null}
        {status ? (
          <p style={status.startsWith('Saved') || status.startsWith('Updated') || status.startsWith('Loaded') || status.toLowerCase().includes('deleted') ? msgOk : msgErr}>
            {status}
          </p>
        ) : null}
        {accessResolved && !canEditResults ? (
          <div style={{ marginBottom: 14 }}>
            <UpgradePrompt
              planId="league"
              compact
              headline="Unlock individual result entry with TIQ League Coordinator"
              body={accessMessage || 'TIQ League Coordinator lets organizers create individual leagues, log player results, and keep standings current.'}
              ctaLabel="Run Your League on TIQ"
              secondaryLabel="Back to Coordinator"
            />
          </div>
        ) : null}

        <details
          style={detailsCard}
          open={canEditResults && (results.length === 0 || resultFormOpen)}
          onToggle={(event) => setResultFormOpen(event.currentTarget.open)}
        >
          <summary style={detailsSummary}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {editingResultId ? 'Edit player result' : 'New player result'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                {canEditResults
                  ? editingResultId
                    ? 'Update the saved scoreline, winner, date, or notes.'
                    : 'Use this for individual TIQ league matches only.'
                  : 'Result entry unlocks with individual-league Coordinator access.'}
              </div>
            </div>
            <span style={canEditResults ? pillGreen : pill}>{editingResultId ? 'Editing' : 'Add result'}</span>
          </summary>

          {canEditResults ? (
            <>
              <div style={row}>
                <Field label="League">
                  <select
                    style={inputStyle}
                    value={formLeagueId}
                    onChange={(event) => void handleFormLeagueChange(event.target.value)}
                    disabled={saving || Boolean(editingResultId)}
                  >
                    <option value="">Choose league</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>{league.leagueName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Player A">
                  <select
                    value={resultPlayerA}
                    onChange={(event) => setResultPlayerA(event.target.value)}
                    style={inputStyle}
                    disabled={saving || !selectedLeague}
                  >
                    <option value="">Choose player A</option>
                    {resultParticipantOptions.map((option) => (
                      <option key={`a-${option.value}`} value={option.value}>{option.playerName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Player B">
                  <select
                    value={resultPlayerB}
                    onChange={(event) => setResultPlayerB(event.target.value)}
                    style={inputStyle}
                    disabled={saving || !selectedLeague}
                  >
                    <option value="">Choose player B</option>
                    {resultParticipantOptions.map((option) => (
                      <option key={`b-${option.value}`} value={option.value}>{option.playerName}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={row}>
                <Field label="Winner">
                  <select
                    value={resultWinner}
                    onChange={(event) => setResultWinner(event.target.value)}
                    style={inputStyle}
                    disabled={saving}
                  >
                    <option value="">Choose winner</option>
                    {resultWinnerOptions.map((option) => (
                      <option key={`w-${option.value}`} value={option.value}>{option.playerName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Score">
                  <input
                    value={resultScore}
                    onChange={(event) => setResultScore(event.target.value)}
                    placeholder={selectedLeagueExperience.scorePlaceholder}
                    style={inputStyle}
                    disabled={saving}
                  />
                </Field>
                <Field label="Result date">
                  <input
                    type="date"
                    value={resultDate}
                    onChange={(event) => setResultDate(event.target.value)}
                    style={inputStyle}
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={row}>
                <Field label="Notes" wide>
                  <textarea
                    value={resultNotes}
                    onChange={(event) => setResultNotes(event.target.value)}
                    placeholder={selectedLeagueExperience.notesPlaceholder}
                    style={textareaStyle}
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={actionRow}>
                <button
                  type="button"
                  onClick={handleResultSubmit}
                  disabled={saving}
                  style={{ ...btnPrimary, ...(saving ? disabledButton : {}) }}
                >
                  {saving ? 'Saving result...' : editingResultId ? 'Update Result' : selectedLeagueExperience.actionLabel}
                </button>
                <span style={pillGreen}>{resultStorageSource === 'supabase' ? 'Live results' : 'Saved preview results'}</span>
                {editingResultId ? (
                  <button type="button" onClick={resetResultForm} style={btnSecondary}>
                    Cancel edit
                  </button>
                ) : null}
                {selectedLeague ? (
                  <Link href={`/explore/leagues/tiq/${encodeURIComponent(selectedLeague.id)}?league_id=${encodeURIComponent(selectedLeague.id)}`} style={btnSecondary}>
                    View league
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </details>

        <div style={insightGrid}>
          <section style={card}>
            <div style={sectionTitle}>
              {selectedLeague
                ? `${getTiqIndividualCompetitionFormatLabel(selectedLeague.individualCompetitionFormat)} standings`
                : 'Player standings'}
            </div>
            {selectedLeagueStandings.length === 0 ? (
              <div style={resultMeta}>Choose an individual league with players to see the working standings.</div>
            ) : (
              <div style={standingsList}>
                {selectedLeagueStandings.slice(0, 8).map((entry) => (
                  <div key={`${entry.playerName}-${entry.playerId || entry.rank}`} style={standingRow}>
                    <div style={standingRank}>{entry.rank}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={standingName}>{entry.playerName}</div>
                      <div style={standingSubtext}>
                        {entry.uniqueOpponents}/{entry.possibleOpponents} opponents
                        {entry.recentForm.length ? ` - ${entry.recentForm.join('')}` : ''}
                      </div>
                    </div>
                    <div style={metricStack}>
                      <span>{entry.wins}-{entry.losses}</span>
                      <span>{entry.matches} results</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={card}>
            <div style={sectionTitle}>Next useful result</div>
            {nextPairing ? (
              <>
                <div style={resultTitle}>
                  {nextPairing[0].playerName} vs {nextPairing[1].playerName}
                </div>
                <div style={resultMeta}>
                  Prioritizes players with fewer logged results and missing head-to-head coverage.
                </div>
                <div style={actionRow}>
                  <button
                    type="button"
                    onClick={() => handleUsePairing(nextPairing[0], nextPairing[1])}
                    style={btnPrimary}
                  >
                    Use pairing
                  </button>
                </div>
              </>
            ) : (
              <div style={resultMeta}>Add at least two players to get a next-result prompt.</div>
            )}
          </section>
        </div>

        <div style={sectionTitle}>Recorded player results</div>
        <div style={reviewToolbar}>
          <Field label="Find result">
            <input
              value={resultSearch}
              onChange={(event) => setResultSearch(event.target.value)}
              placeholder="Player, score, note..."
              style={inputStyle}
            />
          </Field>
          <Field label="League">
            <select
              style={inputStyle}
              value={filterLeagueId}
              onChange={(event) => void handleFilterChange(event.target.value)}
            >
              <option value="">All leagues</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>{league.leagueName}</option>
              ))}
            </select>
          </Field>
          <Field label="Review">
            <select
              style={inputStyle}
              value={resultReviewFilter}
              onChange={(event) => setResultReviewFilter(event.target.value as ResultReviewFilter)}
            >
              <option value="all">All results</option>
              <option value="edited">Corrections only</option>
              <option value="clean">Original entries</option>
            </select>
          </Field>
          <Field label="Date">
            <select
              style={inputStyle}
              value={resultDateFilter}
              onChange={(event) => setResultDateFilter(event.target.value as ResultDateFilter)}
            >
              <option value="all">Any date</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>
          </Field>
          <button type="button" onClick={() => void handleClearResultFilters()} style={btnSecondary}>
            Clear
          </button>
          <div style={{ color: '#94a3b8', fontSize: 13, gridColumn: '1 / -1' }}>
            Showing {visibleResults.length} of {results.length} result{results.length === 1 ? '' : 's'}.
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading...</p>
        ) : results.length === 0 ? (
          <div style={emptyCard}>No individual results yet. Open the form above to log the first player result.</div>
        ) : visibleResults.length === 0 ? (
          <div style={emptyCard}>No player results match the current review filters.</div>
        ) : (
          <div style={listWrap}>
            {visibleResults.map((result) => {
              const league = leagues.find((item) => item.id === result.leagueId)
              const edited = isEditedResult(result)
              const editedAt = edited ? formatResultTimestamp(result.updatedAt) : ''
              const metaParts = [
                league?.leagueName,
                result.score,
                formatDate(result.resultDate),
                editedAt ? `Edited ${editedAt}` : null,
                result.notes,
              ].filter(Boolean)

              return (
                <div key={result.id} style={resultCard}>
                  <div>
                    <div style={resultTitle}>
                      {result.winnerPlayerName} def. {resultOpponentName(result)}
                    </div>
                    <div style={resultMeta}>
                      {metaParts.join(' - ')}
                    </div>
                  </div>
                  <div style={actionRow}>
                    {edited ? <span style={pillAmber}>Edited</span> : null}
                    {result.winnerPlayerId ? (
                      <Link href={`/players/${encodeURIComponent(result.winnerPlayerId)}`} style={btnSecondary}>Winner</Link>
                    ) : null}
                    {canEditResults ? (
                      <>
                        <button type="button" onClick={() => void handleEditResult(result)} style={btnSecondary}>
                          Edit
                        </button>
                        <button type="button" onClick={() => void handleDeleteResult(result)} style={btnDanger}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
