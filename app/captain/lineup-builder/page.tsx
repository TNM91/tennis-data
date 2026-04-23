'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import CaptainFormField from '@/app/components/captain-form-field'
import CaptainSubnav from '@/app/components/captain-subnav'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import {
  buildCaptainScopedHref,
  readCaptainResumeState,
  writeCaptainResumeState,
} from '@/lib/captain-memory'
import { readCaptainWeekNotes } from '@/lib/captain-week-notes'
import { getClientAuthState } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'
import { useTheme } from '@/app/components/theme-provider'
import { formatDate, formatRating, uniqueSorted } from '@/lib/captain-formatters'
import { type UserRole } from '@/lib/roles'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type PlayerRow = {
  id: string
  name: string
  location: string | null
  flight: string | null
  preferred_role: string | null
  lineup_notes: string | null
  singles_rating: number | null
  singles_dynamic_rating: number | null
  singles_usta_dynamic_rating: number | null
  doubles_rating: number | null
  doubles_dynamic_rating: number | null
  doubles_usta_dynamic_rating: number | null
  overall_rating: number | null
  overall_dynamic_rating: number | null
  overall_usta_dynamic_rating: number | null
}

type AvailabilityRow = {
  id: string
  match_date: string | null
  team_name: string | null
  league_name: string | null
  flight: string | null
  player_id: string
  status: string | null
  notes: string | null
}

type MatchTeamRow = {
  id: string
  league_name: string | null
  flight: string | null
  match_date: string | null
  home_team: string | null
  away_team: string | null
  line_number: string | null
}

type MatchPlayerLinkRow = {
  match_id: string
  player_id: string
  side: 'A' | 'B' | null
}

type SlotPlayer = {
  playerId: string
  playerName: string
}

type LineupSlot = {
  id: string
  label: string
  slotType: 'singles' | 'doubles'
  players: SlotPlayer[]
}

type ScenarioRow = {
  id: string
  scenario_name: string
  league_name: string | null
  flight: string | null
  match_date: string | null
  team_name: string | null
  opponent_team: string | null
  slots_json: unknown
  opponent_slots_json: unknown
  notes: string | null
}

type PredictionSnapshotInsert = {
  scenario_id: string | null
  scenario_name: string
  league_name: string | null
  flight: string | null
  match_date: string | null
  team_name: string | null
  opponent_team: string | null
  projected_team_win_pct: number | null
  projected_score_for: number | null
  projected_score_against: number | null
  favored_lines: number
  underdog_lines: number
  swing_line_label: string | null
  strongest_line_label: string | null
  weakest_line_label: string | null
  confidence_score: number | null
  confidence_tier: string | null
  slots_json: unknown
  opponent_slots_json: unknown
  line_projections_json: unknown
  notes: string | null
  source: string
}

type PoolPlayer = PlayerRow & {
  availabilityStatus: string | null
  availabilityNotes: string | null
}

type OptimizerMode = 'best' | 'safe' | 'upside'

type LineProjection = {
  label: string
  slotType: 'singles' | 'doubles'
  teamPlayers: SlotPlayer[]
  opponentPlayers: SlotPlayer[]
  playerCount: number
  yourStrength: number | null
  opponentStrength: number | null
  yourRating: number | null
  opponentRating: number | null
  diff: number | null
  projection: number | null
}

type LineupStrengthAnalysis = {
  lines: LineProjection[]
  avgDiff: number
  projection: number
}

type OptimizedLineupPlan = {
  mode: OptimizerMode
  title: string
  subtitle: string
  slots: LineupSlot[]
  bench: PoolPlayer[]
  analysis: LineupStrengthAnalysis
  score: number
}

type RecommendationCard = {
  title: string
  body: string
  tone: 'good' | 'warn' | 'info'
}

const DEFAULT_TEAM_SLOTS: LineupSlot[] = [
  createSinglesSlot('s1', 'Singles 1'),
  createSinglesSlot('s2', 'Singles 2'),
  createSinglesSlot('s3', 'Singles 3'),
  createDoublesSlot('d1', 'Doubles 1'),
  createDoublesSlot('d2', 'Doubles 2'),
]

const DEFAULT_OPPONENT_SLOTS: LineupSlot[] = [
  createSinglesSlot('os1', 'Singles 1'),
  createSinglesSlot('os2', 'Singles 2'),
  createSinglesSlot('os3', 'Singles 3'),
  createDoublesSlot('od1', 'Doubles 1'),
  createDoublesSlot('od2', 'Doubles 2'),
]

function createSinglesSlot(id: string, label: string): LineupSlot {
  return {
    id,
    label,
    slotType: 'singles',
    players: [{ playerId: '', playerName: '' }],
  }
}

function createDoublesSlot(id: string, label: string): LineupSlot {
  return {
    id,
    label,
    slotType: 'doubles',
    players: [
      { playerId: '', playerName: '' },
      { playerId: '', playerName: '' },
    ],
  }
}

function cloneSlots(slots: LineupSlot[]) {
  return slots.map((slot) => ({
    ...slot,
    players: slot.players.map((player) => ({ ...player })),
  }))
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildRosterPlayerIdSet(
  targetTeam: string,
  matches: MatchTeamRow[],
  matchPlayers: MatchPlayerLinkRow[],
  availabilityRows: AvailabilityRow[],
  filters: { leagueName: string; flight: string }
) {
  const normalizedTarget = targetTeam.trim().toLowerCase()
  if (!normalizedTarget) return new Set<string>()

  const filteredMatches = matches.filter((match) => {
    const home = (match.home_team ?? '').trim().toLowerCase()
    const away = (match.away_team ?? '').trim().toLowerCase()
    if (home !== normalizedTarget && away !== normalizedTarget) return false
    if (filters.leagueName && (match.league_name ?? '').trim() !== filters.leagueName) return false
    if (filters.flight && (match.flight ?? '').trim() !== filters.flight) return false
    return true
  })

  const sideByMatchId = new Map<string, 'A' | 'B'>()
  for (const match of filteredMatches) {
    const home = (match.home_team ?? '').trim().toLowerCase()
    const away = (match.away_team ?? '').trim().toLowerCase()
    if (home === normalizedTarget) sideByMatchId.set(match.id, 'A')
    else if (away === normalizedTarget) sideByMatchId.set(match.id, 'B')
  }

  const ids = new Set<string>()

  for (const row of matchPlayers) {
    const expectedSide = sideByMatchId.get(row.match_id)
    if (!expectedSide || row.side !== expectedSide || !row.player_id) continue
    ids.add(row.player_id)
  }

  for (const row of availabilityRows) {
    if (!row.player_id) continue
    if ((row.team_name ?? '').trim().toLowerCase() !== normalizedTarget) continue
    if (filters.leagueName && (row.league_name ?? '').trim() !== filters.leagueName) continue
    if (filters.flight && (row.flight ?? '').trim() !== filters.flight) continue
    ids.add(row.player_id)
  }

  return ids
}

function filterPlayerPoolByRoster(playerPool: PoolPlayer[], rosterIds: Set<string>) {
  if (!rosterIds.size) return []
  return playerPool.filter((player) => rosterIds.has(player.id))
}


function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function availabilityRank(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase()
  if (normalized === 'available' || normalized === 'yes' || normalized === 'in') return 0
  if (normalized === 'maybe') return 1
  if (normalized === 'unknown' || normalized === '') return 2
  if (normalized === 'unavailable' || normalized === 'no' || normalized === 'out') return 3
  return 2
}

function reliabilityWeight(status: string | null | undefined) {
  const rank = availabilityRank(status)
  if (rank === 0) return 1
  if (rank === 1) return 0.82
  if (rank === 2) return 0.66
  return 0.35
}

function statusTone(status: string | null | undefined): CSSProperties {
  const normalized = (status ?? '').trim().toLowerCase()
  if (normalized === 'available' || normalized === 'yes' || normalized === 'in') {
    return {
      background: 'rgba(72, 187, 120, 0.16)',
      color: '#d1fae5',
      border: '1px solid rgba(72, 187, 120, 0.32)',
    }
  }
  if (normalized === 'maybe') {
    return {
      background: 'rgba(245, 158, 11, 0.16)',
      color: '#fde68a',
      border: '1px solid rgba(245, 158, 11, 0.32)',
    }
  }
  if (normalized === 'unavailable' || normalized === 'no' || normalized === 'out') {
    return {
      background: 'rgba(239, 68, 68, 0.16)',
      color: '#fecaca',
      border: '1px solid rgba(239, 68, 68, 0.32)',
    }
  }
  return {
    background: 'rgba(37, 99, 235, 0.14)',
    color: '#bfdbfe',
    border: '1px solid rgba(37, 99, 235, 0.28)',
  }
}

function normalizeSavedSlots(raw: unknown): LineupSlot[] {
  if (!raw || !Array.isArray(raw)) return []

  return raw.map((item, index) => {
    const obj =
      typeof item === 'object' && item !== null
        ? (item as Record<string, unknown>)
        : {}

    const slotType = obj.slotType === 'doubles' ? 'doubles' : 'singles'
    const label = cleanText(obj.label) || `Slot ${index + 1}`
    const id = cleanText(obj.id) || `slot-${index + 1}`

    const rawPlayers = Array.isArray(obj.players) ? obj.players : []
    const players = rawPlayers.map((player) => {
      const entry =
        typeof player === 'object' && player !== null
          ? (player as Record<string, unknown>)
          : {}
      return {
        playerId: cleanText(entry.playerId),
        playerName: cleanText(entry.playerName),
      }
    })

    return {
      id,
      label,
      slotType,
      players:
        slotType === 'doubles'
          ? [
              players[0] ?? { playerId: '', playerName: '' },
              players[1] ?? { playerId: '', playerName: '' },
            ]
          : [players[0] ?? { playerId: '', playerName: '' }],
    }
  })
}

function selectedLineStrength(slot: LineupSlot, players: PlayerRow[]) {
  const selected = slot.players
    .map((slotPlayer) => players.find((player) => player.id === slotPlayer.playerId))
    .filter(Boolean) as PlayerRow[]

  if (!selected.length) return null

  if (slot.slotType === 'singles') {
    const first = selected[0]
    return (
      first.singles_dynamic_rating ??
      first.singles_rating ??
      first.overall_dynamic_rating ??
      first.overall_rating
    )
  }

  const values = selected
    .map((player) => player.doubles_dynamic_rating ?? player.doubles_rating ?? player.overall_dynamic_rating ?? player.overall_rating)
    .filter((value): value is number => typeof value === 'number')

  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function probabilityFromDiff(diff: number | null | undefined) {
  if (typeof diff !== 'number' || Number.isNaN(diff)) return null
  return 1 / (1 + Math.exp(-diff * 3.2))
}

function projectionTier(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Unknown'
  if (value >= 0.7) return 'Strong edge'
  if (value >= 0.58) return 'Lean your side'
  if (value >= 0.42) return 'Toss-up'
  if (value >= 0.3) return 'Need help elsewhere'
  return 'Clear underdog'
}

function compareLineupStrength(
  teamSlots: LineupSlot[],
  opponentSlots: LineupSlot[],
  players: PlayerRow[]
): LineupStrengthAnalysis {
  const lines: LineProjection[] = teamSlots.map((slot, index) => {
    const opponentSlot = opponentSlots[index]
    const yourStrength = selectedLineStrength(slot, players)
    const opponentStrength = opponentSlot ? selectedLineStrength(opponentSlot, players) : null
    const diff =
      typeof yourStrength === 'number' && typeof opponentStrength === 'number'
        ? yourStrength - opponentStrength
        : null

    return {
      label: slot.label,
      slotType: slot.slotType,
      teamPlayers: slot.players.map((player) => ({ ...player })),
      opponentPlayers: opponentSlot ? opponentSlot.players.map((player) => ({ ...player })) : [],
      playerCount: slot.slotType === 'doubles' ? 2 : 1,
      yourStrength,
      opponentStrength,
      yourRating: yourStrength,
      opponentRating: opponentStrength,
      diff,
      projection: probabilityFromDiff(diff),
    }
  })

  const diffs = lines.map((line) => line.diff).filter((value): value is number => typeof value === 'number')
  const avgDiff = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0
  const projection = 1 / (1 + Math.exp(-avgDiff * 3.2))

  return { lines, avgDiff, projection }
}

function scorePoolPlayerForSlot(player: PoolPlayer, slotType: 'singles' | 'doubles') {
  const primary =
    slotType === 'singles'
      ? player.singles_dynamic_rating ?? player.singles_rating ?? player.overall_dynamic_rating ?? player.overall_rating ?? 0
      : player.doubles_dynamic_rating ?? player.doubles_rating ?? player.overall_dynamic_rating ?? player.overall_rating ?? 0

  const secondary =
    slotType === 'singles'
      ? player.doubles_dynamic_rating ?? player.overall_dynamic_rating ?? player.overall_rating ?? 0
      : player.singles_dynamic_rating ?? player.overall_dynamic_rating ?? player.overall_rating ?? 0

  const roleBoost =
    slotType === 'singles'
      ? (player.preferred_role ?? '').toLowerCase().includes('single') ? 0.12 : 0
      : (player.preferred_role ?? '').toLowerCase().includes('double') ? 0.12 : 0

  return primary * 1.1 + secondary * 0.12 + roleBoost
}

function recommendLineupFromPool(
  baseSlots: LineupSlot[],
  playerPool: PoolPlayer[],
  mode: 'balanced' | 'ceiling' = 'balanced'
) {
  const nextSlots = cloneSlots(baseSlots)
  const available = [...playerPool]
  const used = new Set<string>()

  const pickBest = (slotType: 'singles' | 'doubles') => {
    const ranked = available
      .filter((player) => !used.has(player.id))
      .map((player) => ({
        player,
        score:
          scorePoolPlayerForSlot(player, slotType) +
          reliabilityWeight(player.availabilityStatus) * 0.18 +
          (mode === 'ceiling' ? (player.overall_dynamic_rating ?? player.overall_rating ?? 0) * 0.04 : 0),
      }))
      .sort((a, b) => b.score - a.score)

    const best = ranked[0]?.player ?? null
    if (best) used.add(best.id)
    return best
  }

  for (const slot of nextSlots) {
    if (slot.slotType === 'singles') {
      const best = pickBest('singles')
      slot.players = [{ playerId: best?.id ?? '', playerName: best?.name ?? '' }]
      continue
    }

    const first = pickBest('doubles')
    const second = pickBest('doubles')
    slot.players = [
      { playerId: first?.id ?? '', playerName: first?.name ?? '' },
      { playerId: second?.id ?? '', playerName: second?.name ?? '' },
    ]
  }

  const bench = available.filter((player) => !used.has(player.id))
  return { slots: nextSlots, bench }
}

function lineupOptimizerScore(
  slots: LineupSlot[],
  pool: PoolPlayer[],
  opponentSlots: LineupSlot[],
  players: PlayerRow[],
  mode: OptimizerMode
) {
  const analysis = compareLineupStrength(slots, opponentSlots, players)
  const filledCount = slots.reduce((sum, slot) => sum + slot.players.filter((player) => player.playerId).length, 0)
  const totalCount = slots.reduce((sum, slot) => sum + (slot.slotType === 'doubles' ? 2 : 1), 0)
  const completeness = totalCount ? filledCount / totalCount : 0

  const usedIds = new Set(slots.flatMap((slot) => slot.players.map((player) => player.playerId)).filter(Boolean))

  const reliabilityValues = pool
    .filter((player) => usedIds.has(player.id))
    .map((player) => reliabilityWeight(player.availabilityStatus))

  const reliability = reliabilityValues.length
    ? reliabilityValues.reduce((sum, value) => sum + value, 0) / reliabilityValues.length
    : 0

  const favoredLines = analysis.lines.filter((line) => typeof line.projection === 'number' && line.projection >= 0.5).length
  const underdogLines = analysis.lines.filter((line) => typeof line.projection === 'number' && line.projection < 0.5).length
  const weakestProjection = analysis.lines.reduce((lowest, line) => Math.min(lowest, typeof line.projection === 'number' ? line.projection : 1), 1)
  const strongestProjection = analysis.lines.reduce((highest, line) => Math.max(highest, typeof line.projection === 'number' ? line.projection : 0), 0)
  const swingLineCount = analysis.lines.filter((line) => {
    const value = typeof line.projection === 'number' ? line.projection : null
    return typeof value === 'number' && value >= 0.42 && value <= 0.58
  }).length

  const safeBias =
    mode === 'safe'
      ? reliability * 30 + completeness * 22 + weakestProjection * 24 - underdogLines * 3
      : 0

  const upsideBias =
    mode === 'upside'
      ? strongestProjection * 26 + favoredLines * 6 + Math.max(0, analysis.avgDiff) * 10
      : 0

  const bestBias =
    mode === 'best'
      ? reliability * 10 + favoredLines * 5 + swingLineCount * 4 + completeness * 12
      : 0

  const score =
    analysis.projection * 100 +
    analysis.avgDiff * 18 +
    completeness * 16 +
    safeBias +
    upsideBias +
    bestBias

  return { analysis, score }
}

function optimizeLineupFromPool(
  baseSlots: LineupSlot[],
  playerPool: PoolPlayer[],
  opponentSlots: LineupSlot[],
  players: PlayerRow[],
  mode: OptimizerMode
): OptimizedLineupPlan {
  const teamSlots = cloneSlots(baseSlots)
  const used = new Set<string>()
  const totalNeeded = teamSlots.reduce((sum, slot) => sum + (slot.slotType === 'doubles' ? 2 : 1), 0)

  const topPool = [...playerPool]
    .sort((a, b) => {
      const aOverall = a.overall_dynamic_rating ?? a.overall_rating ?? 0
      const bOverall = b.overall_dynamic_rating ?? b.overall_rating ?? 0
      return bOverall - aOverall
    })
    .slice(0, Math.max(totalNeeded + 6, 12))

  const opponentSinglesByStrength = opponentSlots
    .map((slot, index) => ({ slot, index, strength: selectedLineStrength(slot, players) ?? 3.5 }))
    .filter((item) => item.slot.slotType === 'singles')
    .sort((a, b) => {
      if (mode === 'upside') return a.strength - b.strength
      return b.strength - a.strength
    })

  const opponentDoublesByStrength = opponentSlots
    .map((slot, index) => ({ slot, index, strength: selectedLineStrength(slot, players) ?? 3.5 }))
    .filter((item) => item.slot.slotType === 'doubles')
    .sort((a, b) => {
      if (mode === 'upside') return a.strength - b.strength
      return b.strength - a.strength
    })

  const rankSingles = (player: PoolPlayer) => {
    const singlesValue =
      player.singles_dynamic_rating ??
      player.singles_rating ??
      player.overall_dynamic_rating ??
      player.overall_rating ??
      0
    const overallValue = player.overall_dynamic_rating ?? player.overall_rating ?? 0
    const reliability = reliabilityWeight(player.availabilityStatus)
    const roleBoost = (player.preferred_role ?? '').toLowerCase().includes('single') ? 0.18 : 0

    if (mode === 'safe') return singlesValue * 1.1 + overallValue * 0.12 + reliability * 0.6 + roleBoost
    if (mode === 'upside') return singlesValue * 1.18 + overallValue * 0.24 + roleBoost
    return singlesValue * 1.14 + overallValue * 0.18 + reliability * 0.26 + roleBoost
  }

  const rankDoubles = (a: PoolPlayer, b: PoolPlayer) => {
    const aD =
      a.doubles_dynamic_rating ?? a.doubles_rating ?? a.overall_dynamic_rating ?? a.overall_rating ?? 0
    const bD =
      b.doubles_dynamic_rating ?? b.doubles_rating ?? b.overall_dynamic_rating ?? b.overall_rating ?? 0
    const avg = (aD + bD) / 2
    const balance = 1 - Math.min(0.4, Math.abs(aD - bD) / 4)
    const reliability =
      (reliabilityWeight(a.availabilityStatus) + reliabilityWeight(b.availabilityStatus)) / 2
    const roleBoost =
      ((a.preferred_role ?? '').toLowerCase().includes('double') ? 0.14 : 0) +
      ((b.preferred_role ?? '').toLowerCase().includes('double') ? 0.14 : 0)

    if (mode === 'safe') return avg * 1.06 + balance * 0.45 + reliability * 0.55 + roleBoost
    if (mode === 'upside') return avg * 1.18 + Math.max(aD, bD) * 0.1 + roleBoost
    return avg * 1.11 + balance * 0.28 + reliability * 0.22 + roleBoost
  }

  const singlesCandidates = topPool
    .filter((player) => !used.has(player.id))
    .map((player) => ({ player, score: rankSingles(player) }))
    .sort((a, b) => b.score - a.score)

  const singlesSlots = teamSlots
    .map((slot, index) => ({ slot, index }))
    .filter((item) => item.slot.slotType === 'singles')

  const selectedSingles = singlesCandidates.slice(0, singlesSlots.length).map((item) => item.player)

  const orderedSinglesSlots =
    opponentSinglesByStrength.length === singlesSlots.length
      ? opponentSinglesByStrength.map((item) => item.index)
      : singlesSlots.map((item) => item.index)

  selectedSingles.forEach((player, orderIndex) => {
    const slotIndex = orderedSinglesSlots[orderIndex]
    if (typeof slotIndex !== 'number') return
    teamSlots[slotIndex].players = [{ playerId: player.id, playerName: player.name }]
    used.add(player.id)
  })

  const remainingAfterSingles = topPool.filter((player) => !used.has(player.id))
  const doublesSlots = teamSlots
    .map((slot, index) => ({ slot, index }))
    .filter((item) => item.slot.slotType === 'doubles')

  const pairCandidates: Array<{ a: PoolPlayer; b: PoolPlayer; score: number }> = []
  for (let i = 0; i < remainingAfterSingles.length; i += 1) {
    for (let j = i + 1; j < remainingAfterSingles.length; j += 1) {
      const a = remainingAfterSingles[i]
      const b = remainingAfterSingles[j]
      pairCandidates.push({ a, b, score: rankDoubles(a, b) })
    }
  }

  pairCandidates.sort((a, b) => b.score - a.score)

  const selectedPairs: Array<{ a: PoolPlayer; b: PoolPlayer; score: number }> = []
  const pairUsed = new Set<string>()
  for (const pair of pairCandidates) {
    if (pairUsed.has(pair.a.id) || pairUsed.has(pair.b.id)) continue
    selectedPairs.push(pair)
    pairUsed.add(pair.a.id)
    pairUsed.add(pair.b.id)
    if (selectedPairs.length >= doublesSlots.length) break
  }

  const orderedDoublesSlots =
    opponentDoublesByStrength.length === doublesSlots.length
      ? opponentDoublesByStrength.map((item) => item.index)
      : doublesSlots.map((item) => item.index)

  selectedPairs.forEach((pair, orderIndex) => {
    const slotIndex = orderedDoublesSlots[orderIndex]
    if (typeof slotIndex !== 'number') return
    teamSlots[slotIndex].players = [
      { playerId: pair.a.id, playerName: pair.a.name },
      { playerId: pair.b.id, playerName: pair.b.name },
    ]
    used.add(pair.a.id)
    used.add(pair.b.id)
  })

  const bench = topPool.filter((player) => !used.has(player.id))
  const scored = lineupOptimizerScore(teamSlots, playerPool, opponentSlots, players, mode)

  const title =
    mode === 'best'
      ? 'Best opponent-aware lineup'
      : mode === 'safe'
        ? 'Counter-stack lineup'
        : 'Attack weak lines lineup'

  const subtitle =
    mode === 'best'
      ? 'Balanced to maximize total projected match win chance against the current opponent build.'
      : mode === 'safe'
        ? 'Places your most reliable strength into the opponent’s strongest lines to reduce collapse risk.'
        : 'Targets weaker opponent lines to create bigger expected wins and higher-upside court stacking.'

  return {
    mode,
    title,
    subtitle,
    slots: teamSlots,
    bench: bench.slice(0, 6),
    analysis: scored.analysis,
    score: scored.score,
  }
}

function rebuildCandidateWithLocks(
  candidateSlots: LineupSlot[],
  currentSlots: LineupSlot[],
  lockedSlotIds: Set<string>,
  lockedPlayerIds: Set<string>,
  playerPool: PoolPlayer[]
) {
  const next = cloneSlots(candidateSlots)
  const currentMap = new Map(currentSlots.map((slot) => [slot.id, cloneSlots([slot])[0]]))
  const used = new Set<string>()

  const scoreForFill = (player: PoolPlayer, slotType: 'singles' | 'doubles') =>
    scorePoolPlayerForSlot(player, slotType) + reliabilityWeight(player.availabilityStatus) * 0.15

  next.forEach((slot, index) => {
    if (!lockedSlotIds.has(slot.id)) return
    const current = currentMap.get(slot.id)
    if (!current) return
    next[index] = current
    current.players.forEach((player) => {
      if (player.playerId) used.add(player.playerId)
    })
  })

  next.forEach((slot) => {
    if (lockedSlotIds.has(slot.id)) return
    const current = currentMap.get(slot.id)
    if (!current) return

    slot.players = slot.players.map((player, idx) => {
      const lockedCurrent = current.players[idx]
      if (
        lockedCurrent?.playerId &&
        lockedPlayerIds.has(lockedCurrent.playerId) &&
        !used.has(lockedCurrent.playerId)
      ) {
        used.add(lockedCurrent.playerId)
        return { ...lockedCurrent }
      }
      return player
    })
  })

  next.forEach((slot) => {
    slot.players = slot.players.map((player) => {
      if (!player.playerId) return player
      if (used.has(player.playerId)) return { playerId: '', playerName: '' }
      used.add(player.playerId)
      return player
    })
  })

  const pickBest = (slotType: 'singles' | 'doubles') => {
    const ranked = playerPool
      .filter((player) => !used.has(player.id))
      .map((player) => ({ player, score: scoreForFill(player, slotType) }))
      .sort((a, b) => b.score - a.score)

    const best = ranked[0]?.player ?? null
    if (best) used.add(best.id)
    return best
  }

  next.forEach((slot) => {
    slot.players = slot.players.map((player) => {
      if (player.playerId) return player
      const best = pickBest(slot.slotType)
      return {
        playerId: best?.id ?? '',
        playerName: best?.name ?? '',
      }
    })
  })

  return next
}

function getLineupWarnings(teamSlots: LineupSlot[], opponentSlots: LineupSlot[]) {
  const warnings: string[] = []

  const validateSlots = (slots: LineupSlot[], sideLabel: string) => {
    for (const slot of slots) {
      const filled = slot.players.filter((player) => player.playerId)
      if (slot.slotType === 'singles' && filled.length < 1) warnings.push(`${sideLabel} ${slot.label} is missing a player.`)
      if (slot.slotType === 'doubles' && filled.length < 2) warnings.push(`${sideLabel} ${slot.label} needs two players.`)

      const ids = filled.map((player) => player.playerId)
      if (new Set(ids).size !== ids.length) warnings.push(`${sideLabel} ${slot.label} contains the same player twice.`)
    }
  }

  validateSlots(teamSlots, 'Your')
  validateSlots(opponentSlots, 'Opponent')
  return Array.from(new Set(warnings))
}

function toneCardStyle(tone: 'good' | 'warn' | 'info'): CSSProperties {
  if (tone === 'good') return bannerGreenStyle
  if (tone === 'warn') return warningCardStyle
  return bannerBlueStyle
}

export default function LineupBuilderPage() {
  const router = useRouter()
  const { theme } = useTheme()

  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [matches, setMatches] = useState<MatchTeamRow[]>([])
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayerLinkRow[]>([])
  const [availability, setAvailability] = useState<AvailabilityRow[]>([])
  const [savedScenarios, setSavedScenarios] = useState<ScenarioRow[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [trackingSnapshot, setTrackingSnapshot] = useState(false)
  const [deletingScenarioId, setDeletingScenarioId] = useState('')
  const [loadingScenarioId, setLoadingScenarioId] = useState('')
  const [currentScenarioId, setCurrentScenarioId] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [competitionLayer, setCompetitionLayer] = useState('')
  const [leagueName, setLeagueName] = useState('')
  const [flight, setFlight] = useState('')
  const [teamName, setTeamName] = useState('')
  const [opponentTeam, setOpponentTeam] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [scenarioName, setScenarioName] = useState('')
  const [notes, setNotes] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [availabilityOnly, setAvailabilityOnly] = useState(true)
  const [hideUnavailable, setHideUnavailable] = useState(true)
  const [teamSlots, setTeamSlots] = useState<LineupSlot[]>(cloneSlots(DEFAULT_TEAM_SLOTS))
  const [opponentSlots, setOpponentSlots] = useState<LineupSlot[]>(cloneSlots(DEFAULT_OPPONENT_SLOTS))
  const [lockedSlotIds, setLockedSlotIds] = useState<string[]>([])
  const [lockedPlayerIds, setLockedPlayerIds] = useState<string[]>([])

  const [prefillScenarioId, setPrefillScenarioId] = useState('')
  const [prefillPairIds, setPrefillPairIds] = useState<string[]>([])
  const [prefillSingleId, setPrefillSingleId] = useState('')
  const [prefillApplied, setPrefillApplied] = useState(false)

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const heroArtworkSrc = theme === 'dark'
    ? '/df190aef-4a8e-4587-bce8-7e2e22655646.png'
    : '/151c73b4-3ea5-4ef5-82df-470da3b99f27.png'
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])
  const isCaptainAccess = access.canUseCaptainWorkflow
  const isPreviewMode = role === 'member'

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      try {
        const authState = await getClientAuthState()

        if (!mounted) return

        if (!authState.user) {
          setRole('public')
          setAuthLoading(false)
          return
        }

        if (!mounted) return

        setRole(authState.role)
        setEntitlements(authState.entitlements)
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }

    void loadRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadRole()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const resumeState = readCaptainResumeState()
    const scenario = params.get('scenario') || params.get('left') || ''
    const nextCompetitionLayer = params.get('layer') || resumeState?.competitionLayer || ''
    const team = params.get('team') || resumeState?.team || ''
    const league = params.get('league') || resumeState?.league || ''
    const nextFlight = params.get('flight') || resumeState?.flight || ''
    const nextDate = params.get('date') || resumeState?.eventDate || ''
    const opponent = params.get('opponent') || resumeState?.opponentTeam || ''
    const pair = (params.get('pair') || '').split(',').map((value) => value.trim()).filter(Boolean)
    const single = params.get('single') || ''

    if (scenario) setPrefillScenarioId(scenario)
    if (nextCompetitionLayer) setCompetitionLayer(nextCompetitionLayer)
    if (team) setTeamName(team)
    if (league) setLeagueName(league)
    if (nextFlight) setFlight(nextFlight)
    if (nextDate) setMatchDate(nextDate)
    if (opponent) setOpponentTeam(opponent)
    if (pair.length) setPrefillPairIds(pair)
    if (single) setPrefillSingleId(single)
  }, [])

  useEffect(() => {
    if (!teamName && !leagueName && !flight) return

    writeCaptainResumeState({
      competitionLayer: competitionLayer || undefined,
      team: teamName,
      league: leagueName,
      flight,
      lastTool: 'lineup-builder',
      lastToolLabel: 'Lineup Builder',
      eventDate: matchDate || undefined,
      opponentTeam: opponentTeam || undefined,
    })
  }, [competitionLayer, flight, leagueName, matchDate, opponentTeam, teamName])

  const sharedCaptainNotes = useMemo(
    () =>
      readCaptainWeekNotes({
        team: teamName,
        league: leagueName,
        flight,
        eventDate: matchDate,
        opponentTeam,
      }),
    [flight, leagueName, matchDate, opponentTeam, teamName]
  )

  function appendSharedScenarioNotes(nextNotes: string) {
    const trimmed = nextNotes.trim()
    if (!trimmed) return

    setNotes((current) => {
      const currentTrimmed = current.trim()
      if (!currentTrimmed) return trimmed
      if (currentTrimmed.includes(trimmed)) return current
      return `${currentTrimmed}\n\n${trimmed}`
    })
  }

  const refreshBuilderData = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')

    const [playersResult, matchesResult, matchPlayersResult, availabilityResult, scenariosResult] = await Promise.all([
      supabase
        .from('players')
        .select(`
          id,
          name,
          location,
          flight,
          preferred_role,
          lineup_notes,
          singles_rating,
          singles_dynamic_rating,
          singles_usta_dynamic_rating,
          doubles_rating,
          doubles_dynamic_rating,
          doubles_usta_dynamic_rating,
          overall_rating,
          overall_dynamic_rating,
          overall_usta_dynamic_rating
        `)
        .order('name', { ascending: true }),
      supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          match_date,
          home_team,
          away_team,
          line_number
        `)
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .limit(400),
      supabase
        .from('match_players')
        .select(`
          match_id,
          player_id,
          side
        `)
        .limit(4000),
      supabase
        .from('lineup_availability')
        .select(`
          id,
          match_date,
          team_name,
          league_name,
          flight,
          player_id,
          status,
          notes
        `)
        .order('match_date', { ascending: false }),
      supabase
        .from('lineup_scenarios')
        .select(`
          id,
          scenario_name,
          league_name,
          flight,
          match_date,
          team_name,
          opponent_team,
          slots_json,
          opponent_slots_json,
          notes
        `)
        .order('match_date', { ascending: false })
        .order('scenario_name', { ascending: true }),
    ])

    if (playersResult.error) {
      setError(playersResult.error.message)
    } else if (matchesResult.error) {
      setError(matchesResult.error.message)
    } else if (matchPlayersResult.error) {
      setError(matchPlayersResult.error.message)
    } else if (availabilityResult.error) {
      setError(availabilityResult.error.message)
    } else if (scenariosResult.error) {
      setError(scenariosResult.error.message)
    } else {
      setPlayers((playersResult.data ?? []) as PlayerRow[])
      setMatches((matchesResult.data ?? []) as MatchTeamRow[])
      setMatchPlayers((matchPlayersResult.data ?? []) as MatchPlayerLinkRow[])
      setAvailability((availabilityResult.data ?? []) as AvailabilityRow[])
      setSavedScenarios((scenariosResult.data ?? []) as ScenarioRow[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (authLoading || role === 'public') return
    void refreshBuilderData()
  }, [authLoading, role, refreshTick, refreshBuilderData])

  const leagueOptions = useMemo(
    () =>
      uniqueSorted([
        ...availability.map((row) => row.league_name),
        ...savedScenarios.map((row) => row.league_name),
      ]),
    [availability, savedScenarios]
  )

  const flightOptions = useMemo(
    () =>
      uniqueSorted([
        ...availability.map((row) => row.flight),
        ...players.map((row) => row.flight),
        ...savedScenarios.map((row) => row.flight),
      ]),
    [availability, players, savedScenarios]
  )

  const teamOptions = useMemo(
    () =>
      uniqueSorted([
        ...availability.map((row) => row.team_name),
        ...savedScenarios.map((row) => row.team_name),
        ...matches.flatMap((row) => [row.home_team, row.away_team]),
      ]),
    [availability, savedScenarios, matches]
  )

  const scenarioOptions = useMemo(() => {
    return savedScenarios.filter((scenario) => {
      const leagueMatch = !leagueName || scenario.league_name === leagueName
      const flightMatch = !flight || scenario.flight === flight
      const teamMatch = !teamName || scenario.team_name === teamName
      return leagueMatch && flightMatch && teamMatch
    })
  }, [savedScenarios, leagueName, flight, teamName])

  const availabilityForSelection = useMemo(() => {
    return availability.filter((row) => {
      const dateMatch = !matchDate || row.match_date === matchDate
      const teamMatch = !teamName || row.team_name === teamName
      const leagueMatch = !leagueName || row.league_name === leagueName
      const flightMatch = !flight || row.flight === flight
      return dateMatch && teamMatch && leagueMatch && flightMatch
    })
  }, [availability, matchDate, teamName, leagueName, flight])

  const availabilityMap = useMemo(() => {
    const map = new Map<string, { status: string | null; notes: string | null }>()
    for (const row of availabilityForSelection) {
      map.set(row.player_id, { status: row.status, notes: row.notes })
    }
    return map
  }, [availabilityForSelection])

  const availablePlayerPool = useMemo<PoolPlayer[]>(() => {
    return players
      .map((player) => {
        const availabilityEntry = availabilityMap.get(player.id)
        return {
          ...player,
          availabilityStatus: availabilityEntry?.status ?? null,
          availabilityNotes: availabilityEntry?.notes ?? null,
        }
      })
      .filter((player) => {
        if (flight && player.flight && player.flight !== flight) return false
        if (availabilityOnly && availabilityForSelection.length > 0) return availabilityMap.has(player.id)
        return true
      })
      .filter((player) => {
        if (!hideUnavailable) return true
        const normalized = (player.availabilityStatus ?? '').trim().toLowerCase()
        if (!availabilityOnly && !normalized) return true
        return normalized !== 'unavailable' && normalized !== 'no' && normalized !== 'out'
      })
      .sort((a, b) => {
        const statusCompare = availabilityRank(a.availabilityStatus) - availabilityRank(b.availabilityStatus)
        if (statusCompare !== 0) return statusCompare

        const ratingA = a.overall_dynamic_rating ?? a.overall_rating ?? -999
        const ratingB = b.overall_dynamic_rating ?? b.overall_rating ?? -999
        if (ratingB !== ratingA) return ratingB - ratingA
        return a.name.localeCompare(b.name)
      })
  }, [players, availabilityMap, flight, availabilityOnly, availabilityForSelection.length, hideUnavailable])

  const myRosterPlayerIds = useMemo(
    () =>
      buildRosterPlayerIdSet(teamName, matches, matchPlayers, availability, {
        leagueName,
        flight,
      }),
    [teamName, matches, matchPlayers, availability, leagueName, flight]
  )

  const opponentRosterPlayerIds = useMemo(
    () =>
      buildRosterPlayerIdSet(opponentTeam, matches, matchPlayers, availability, {
        leagueName,
        flight,
      }),
    [opponentTeam, matches, matchPlayers, availability, leagueName, flight]
  )

  const myPlayerPool = useMemo<PoolPlayer[]>(() => {
    return filterPlayerPoolByRoster(availablePlayerPool, myRosterPlayerIds)
  }, [availablePlayerPool, myRosterPlayerIds])

  const opponentPlayerPool = useMemo<PoolPlayer[]>(() => {
    return filterPlayerPoolByRoster(
      players
        .map((player) => ({
          ...player,
          availabilityStatus: null,
          availabilityNotes: null,
        }))
        .sort((a, b) => {
          const ratingA = a.overall_dynamic_rating ?? a.overall_rating ?? -999
          const ratingB = b.overall_dynamic_rating ?? b.overall_rating ?? -999
          if (ratingB !== ratingA) return ratingB - ratingA
          return a.name.localeCompare(b.name)
        }),
      opponentRosterPlayerIds
    )
  }, [players, opponentRosterPlayerIds])

  const teamAssignedPlayerIds = useMemo(() => {
    const ids = new Set<string>()
    for (const slot of teamSlots) {
      for (const player of slot.players) {
        if (player.playerId) ids.add(player.playerId)
      }
    }
    return ids
  }, [teamSlots])

  const opponentAssignedPlayerIds = useMemo(() => {
    const ids = new Set<string>()
    for (const slot of opponentSlots) {
      for (const player of slot.players) {
        if (player.playerId) ids.add(player.playerId)
      }
    }
    return ids
  }, [opponentSlots])

  const lockedSlotIdSet = useMemo(() => new Set(lockedSlotIds), [lockedSlotIds])
  const lockedPlayerIdSet = useMemo(() => new Set(lockedPlayerIds), [lockedPlayerIds])

  const compareHref = useMemo(() => {
    const baseHref = buildCaptainScopedHref('/captain/scenario-builder', {
      competitionLayer,
      league: leagueName,
      flight,
      team: teamName,
      date: matchDate,
      opponent: opponentTeam,
    })

    if (!currentScenarioId) return baseHref

    const separator = baseHref.includes('?') ? '&' : '?'
    return `${baseHref}${separator}left=${encodeURIComponent(currentScenarioId)}`
  }, [competitionLayer, currentScenarioId, flight, leagueName, matchDate, opponentTeam, teamName])

  function toggleLockedSlot(slotId: string) {
    setLockedSlotIds((current) =>
      current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId]
    )
  }

  function toggleLockedPlayer(playerId: string) {
    if (!playerId) return
    setLockedPlayerIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    )
  }

  function clearLocks() {
    setLockedSlotIds([])
    setLockedPlayerIds([])
  }

  function getPlayerById(playerId: string) {
    return players.find((player) => player.id === playerId) ?? null
  }

  function setSlotPlayer(
    side: 'team' | 'opponent',
    slotId: string,
    playerIndex: number,
    playerId: string
  ) {
    const update = (slots: LineupSlot[]) =>
      slots.map((slot) => {
        if (slot.id !== slotId) return slot
        const nextPlayers = slot.players.map((player, index) => {
          if (index !== playerIndex) return player
          const matchedPlayer = getPlayerById(playerId)
          return {
            playerId,
            playerName: matchedPlayer?.name ?? '',
          }
        })
        return { ...slot, players: nextPlayers }
      })

    if (side === 'team') setTeamSlots((current) => update(current))
    else setOpponentSlots((current) => update(current))
  }

  function setSlotLabel(side: 'team' | 'opponent', slotId: string, label: string) {
    const update = (slots: LineupSlot[]) =>
      slots.map((slot) => (slot.id === slotId ? { ...slot, label } : slot))
    if (side === 'team') setTeamSlots((current) => update(current))
    else setOpponentSlots((current) => update(current))
  }

  function addSlot(side: 'team' | 'opponent', slotType: 'singles' | 'doubles') {
    const id = `${side}-${slotType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const labelBase = slotType === 'singles' ? 'Singles' : 'Doubles'
    const source = side === 'team' ? teamSlots : opponentSlots
    const nextCount = source.filter((slot) => slot.slotType === slotType).length + 1
    const newSlot =
      slotType === 'singles'
        ? createSinglesSlot(id, `${labelBase} ${nextCount}`)
        : createDoublesSlot(id, `${labelBase} ${nextCount}`)

    if (side === 'team') setTeamSlots((current) => [...current, newSlot])
    else setOpponentSlots((current) => [...current, newSlot])
  }

  function removeSlot(side: 'team' | 'opponent', slotId: string) {
    if (side === 'team') setTeamSlots((current) => current.filter((slot) => slot.id !== slotId))
    else setOpponentSlots((current) => current.filter((slot) => slot.id !== slotId))
  }

  function resetBuilder() {
    setCurrentScenarioId('')
    setCompetitionLayer('')
    setScenarioName('')
    setLeagueName('')
    setFlight('')
    setTeamName('')
    setOpponentTeam('')
    setMatchDate('')
    setNotes('')
    setTeamSlots(cloneSlots(DEFAULT_TEAM_SLOTS))
    setOpponentSlots(cloneSlots(DEFAULT_OPPONENT_SLOTS))
    clearLocks()
    setMessage('Builder reset.')
    setError('')
  }
function sendCurrentScenarioToMessaging() {
  if (!currentScenarioId) {
    setError('Save or load a scenario before sending it to messaging.')
    setMessage('')
    return
  }

  const activeScenario =
    savedScenarios.find((scenario) => scenario.id === currentScenarioId) ?? null

  if (!activeScenario) {
    setError('The active scenario could not be found. Save the scenario first, then try again.')
    setMessage('')
    return
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem('tenace_selected_scenario', JSON.stringify(activeScenario))
    window.localStorage.setItem('tenace_flow_source', 'lineup_builder')
  }

  const params = new URLSearchParams()
  params.set('source', 'lineup_builder')

  const baseHref = buildCaptainScopedHref('/captain/messaging', {
    competitionLayer,
    team: teamName,
    league: leagueName,
    flight,
    date: matchDate,
    opponent: opponentTeam,
  })

  router.push(`${baseHref}${baseHref.includes('?') ? '&' : '?'}${params.toString()}`)
}
  async function refreshSavedScenarios() {
    const { data, error: nextError } = await supabase
      .from('lineup_scenarios')
      .select(`
        id,
        scenario_name,
        league_name,
        flight,
        match_date,
        team_name,
        opponent_team,
        slots_json,
        opponent_slots_json,
        notes
      `)
      .order('match_date', { ascending: false })
      .order('scenario_name', { ascending: true })

    if (nextError) {
      setError(nextError.message)
      return []
    }

    const rows = (data ?? []) as ScenarioRow[]
    setSavedScenarios(rows)
    return rows
  }

  function buildScenarioPayload() {
    return {
      scenario_name: scenarioName.trim(),
      league_name: leagueName || null,
      flight: flight || null,
      match_date: matchDate || null,
      team_name: teamName || null,
      opponent_team: opponentTeam || null,
      slots_json: teamSlots,
      opponent_slots_json: opponentSlots,
      notes: notes.trim() || null,
    }
  }

  const analysis = useMemo(
    () => compareLineupStrength(teamSlots, opponentSlots, players),
    [teamSlots, opponentSlots, players]
  )

  const favoredLines = useMemo(
    () => analysis.lines.filter((line) => typeof line.projection === 'number' && line.projection >= 0.5).length,
    [analysis.lines]
  )

  const underdogLines = useMemo(
    () => analysis.lines.filter((line) => typeof line.projection === 'number' && line.projection < 0.5).length,
    [analysis.lines]
  )

  const bestLine = useMemo(() => {
    const scored = analysis.lines
      .filter((line) => typeof line.diff === 'number')
      .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0))
    return scored[0] ?? null
  }, [analysis.lines])

  const weakestLine = useMemo(() => {
    const scored = analysis.lines
      .filter((line) => typeof line.diff === 'number')
      .sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0))
    return scored[0] ?? null
  }, [analysis.lines])

  const swingLine = useMemo(() => {
    const scored = analysis.lines
      .filter((line) => typeof line.projection === 'number' && line.projection >= 0.45 && line.projection <= 0.55)
      .sort((a, b) => Math.abs((a.projection ?? 0.5) - 0.5) - Math.abs((b.projection ?? 0.5) - 0.5))
    return scored[0] ?? null
  }, [analysis.lines])

  const weakestOpponentLine = useMemo(() => {
    const scored = analysis.lines
      .filter((line) => typeof line.opponentStrength === 'number')
      .sort((a, b) => (a.opponentStrength ?? 0) - (b.opponentStrength ?? 0))
    return scored[0] ?? null
  }, [analysis.lines])

  const expectedScoreline = useMemo(() => {
    const projectedWins = analysis.lines
      .map((line) => line.projection)
      .filter((value): value is number => typeof value === 'number')
      .reduce((sum, value) => sum + value, 0)

    const countedLines = analysis.lines.filter((line) => typeof line.projection === 'number').length
    const projectedLosses = countedLines - projectedWins

    return {
      projectedWins,
      projectedLosses,
      countedLines,
      label: countedLines ? `${projectedWins.toFixed(1)} - ${projectedLosses.toFixed(1)}` : '—',
    }
  }, [analysis.lines])

  const confidenceScore = useMemo(() => {
    const completionScore = analysis.lines.length
      ? analysis.lines.filter((line) => {
          const teamFilled = line.teamPlayers.filter((player) => player.playerId).length === line.playerCount
          const oppFilled = line.opponentPlayers.filter((player) => player.playerId).length === line.playerCount
          return teamFilled && oppFilled
        }).length / analysis.lines.length
      : 0

    const availabilityResolved = myPlayerPool.length
      ? myPlayerPool.filter((player) => {
          const normalized = (player.availabilityStatus ?? '').trim().toLowerCase()
          return normalized === 'available' || normalized === 'yes' || normalized === 'in' || normalized === 'maybe'
        }).length / myPlayerPool.length
      : 1

    const avgGap =
      analysis.lines.map((line) => Math.abs(line.diff ?? 0)).reduce((sum, value) => sum + value, 0) /
      Math.max(analysis.lines.length, 1)

    const gapScore = Math.max(0, Math.min(1, avgGap / 0.75))
    const score = completionScore * 0.45 + availabilityResolved * 0.2 + gapScore * 0.35

    return {
      value: score,
      label: `${Math.round(score * 100)}%`,
      tier: score >= 0.75 ? 'High confidence' : score >= 0.55 ? 'Moderate confidence' : 'Low confidence',
    }
  }, [analysis.lines, myPlayerPool])

  const explainabilityCards = useMemo<RecommendationCard[]>(() => {
    const cards: RecommendationCard[] = []

    if (bestLine && typeof bestLine.diff === 'number') {
      cards.push({
        title: 'Strongest edge',
        body: `${bestLine.label} is your biggest projected advantage at ${bestLine.diff >= 0 ? '+' : ''}${bestLine.diff.toFixed(2)} with ${formatPercent(bestLine.projection)} win probability.`,
        tone: 'good',
      })
    }

    if (weakestLine && typeof weakestLine.diff === 'number') {
      cards.push({
        title: 'Biggest risk',
        body: `${weakestLine.label} is your toughest court right now at ${weakestLine.diff >= 0 ? '+' : ''}${weakestLine.diff.toFixed(2)}. This line needs the most attention before you lock.`,
        tone: 'warn',
      })
    }

    if (swingLine) {
      cards.push({
        title: 'Swing match',
        body: `${swingLine.label} is closest to even at ${formatPercent(swingLine.projection)}. Small player swaps here are the most likely to flip the overall result.`,
        tone: 'info',
      })
    }

    if (weakestOpponentLine) {
      cards.push({
        title: 'Opponent weakness',
        body: `${weakestOpponentLine.label} is the opponent’s weakest projected line. If you want to attack a court, start there.`,
        tone: 'good',
      })
    }

    cards.push({
      title: 'Expected scoreline',
      body: `This lineup projects to ${expectedScoreline.label} with ${favoredLines} favored line(s) and ${underdogLines} underdog line(s).`,
      tone: 'info',
    })

    cards.push({
      title: 'Projection confidence',
      body: `${confidenceScore.tier} based on lineup completeness, availability confidence, and the size of your projected gaps.`,
      tone: confidenceScore.value >= 0.75 ? 'good' : confidenceScore.value < 0.55 ? 'warn' : 'info',
    })

    return cards.slice(0, 6)
  }, [bestLine, weakestLine, swingLine, weakestOpponentLine, expectedScoreline, favoredLines, underdogLines, confidenceScore])

  function buildPredictionTrackingPayload(source: string, scenarioIdOverride?: string | null): PredictionSnapshotInsert {
    return {
      scenario_id: scenarioIdOverride ?? (currentScenarioId || null),
      scenario_name: scenarioName.trim() || 'Untitled Scenario',
      league_name: leagueName || null,
      flight: flight || null,
      match_date: matchDate || null,
      team_name: teamName || null,
      opponent_team: opponentTeam || null,
      projected_team_win_pct: typeof analysis.projection === 'number' ? analysis.projection : null,
      projected_score_for: expectedScoreline.countedLines ? expectedScoreline.projectedWins : null,
      projected_score_against: expectedScoreline.countedLines ? expectedScoreline.projectedLosses : null,
      favored_lines: favoredLines,
      underdog_lines: underdogLines,
      swing_line_label: swingLine?.label ?? null,
      strongest_line_label: bestLine?.label ?? null,
      weakest_line_label: weakestLine?.label ?? null,
      confidence_score: confidenceScore.value,
      confidence_tier: confidenceScore.tier,
      slots_json: teamSlots,
      opponent_slots_json: opponentSlots,
      line_projections_json: analysis.lines.map((line) => ({
        label: line.label,
        slotType: line.slotType,
        teamPlayers: line.teamPlayers,
        opponentPlayers: line.opponentPlayers,
        yourRating: line.yourRating,
        opponentRating: line.opponentRating,
        diff: line.diff,
        projection: line.projection,
      })),
      notes: notes.trim() || null,
      source,
    }
  }

  async function trackPredictionSnapshot(source: string, scenarioIdOverride?: string | null, silent = false) {
    if (!isCaptainAccess) {
      if (!silent) setError('Captain tier required to track predictions.')
      return false
    }

    setTrackingSnapshot(true)
    const payload = buildPredictionTrackingPayload(source, scenarioIdOverride)
    const { error: insertError } = await supabase.from('lineup_prediction_snapshots').insert(payload)
    setTrackingSnapshot(false)

    if (insertError) {
      if (!silent) setError(insertError.message)
      return false
    }

    if (!silent) {
      setMessage('Prediction snapshot tracked successfully.')
      setError('')
    }
    return true
  }

  async function saveScenario(asNew = false) {
    setSaving(true)
    setError('')
    setMessage('')

    if (!isCaptainAccess) {
      setSaving(false)
      setError('Upgrade to Captain tier to save scenarios.')
      return
    }

    if (!scenarioName.trim()) {
      setSaving(false)
      setError('Please enter a scenario name.')
      return
    }

    const normalizedName = scenarioName.trim().toLowerCase()
    const duplicate = savedScenarios.find((scenario) => {
      const sameName = scenario.scenario_name.trim().toLowerCase() === normalizedName
      const sameTeam = (scenario.team_name ?? '') === (teamName || '')
      const sameDate = (scenario.match_date ?? '') === (matchDate || '')
      return sameName && sameTeam && sameDate
    })

    if (duplicate && (asNew || duplicate.id !== currentScenarioId)) {
      setSaving(false)
      setError('A scenario with this name already exists for this team and match date.')
      return
    }

    const payload = buildScenarioPayload()

    if (currentScenarioId && !asNew) {
      const { error: updateError } = await supabase.from('lineup_scenarios').update(payload).eq('id', currentScenarioId)
      setSaving(false)

      if (updateError) {
        setError(updateError.message)
        return
      }

      await refreshSavedScenarios()
      const tracked = await trackPredictionSnapshot('scenario-update', currentScenarioId, true)
      setMessage(tracked ? 'Scenario updated and prediction snapshot tracked.' : 'Scenario updated successfully.')
      return
    }

    const { data, error: insertError } = await supabase.from('lineup_scenarios').insert(payload).select('id').single()
    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    if (data?.id) setCurrentScenarioId(data.id)
    await refreshSavedScenarios()
    const tracked = await trackPredictionSnapshot(asNew ? 'scenario-save-new' : 'scenario-save', data?.id ?? null, true)
    setMessage(
      tracked
        ? asNew
          ? 'Scenario saved as new and prediction snapshot tracked.'
          : 'Scenario saved and prediction snapshot tracked.'
        : asNew
          ? 'Scenario saved as new successfully.'
          : 'Scenario saved successfully.'
    )
  }

  async function deleteScenario(scenarioId: string) {
    if (!isCaptainAccess) {
      setError('Captain tier required to delete scenarios.')
      return
    }

    const confirmed = window.confirm('Delete this saved scenario?')
    if (!confirmed) return

    setDeletingScenarioId(scenarioId)
    setError('')
    setMessage('')

    const { error: deleteError } = await supabase.from('lineup_scenarios').delete().eq('id', scenarioId)
    setDeletingScenarioId('')

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    const deletedCurrent = scenarioId === currentScenarioId
    await refreshSavedScenarios()

    if (deletedCurrent) {
      setCurrentScenarioId('')
      setMessage('Scenario deleted. Builder is now in new scenario mode.')
    } else {
      setMessage('Scenario deleted successfully.')
    }
  }

  async function loadScenario(scenarioId: string) {
    setLoadingScenarioId(scenarioId)
    setError('')
    setMessage('')

    const scenario = savedScenarios.find((row) => row.id === scenarioId)
    if (!scenario) {
      setLoadingScenarioId('')
      setError('Scenario not found.')
      return
    }

    setCurrentScenarioId(scenario.id)
    setScenarioName(scenario.scenario_name ?? '')
    setLeagueName(scenario.league_name ?? '')
    setFlight(scenario.flight ?? '')
    setMatchDate(scenario.match_date ?? '')
    setTeamName(scenario.team_name ?? '')
    setOpponentTeam(scenario.opponent_team ?? '')
    setNotes(scenario.notes ?? '')

    const loadedTeamSlots = normalizeSavedSlots(scenario.slots_json)
    const loadedOpponentSlots = normalizeSavedSlots(scenario.opponent_slots_json)

    setTeamSlots(loadedTeamSlots.length ? loadedTeamSlots : cloneSlots(DEFAULT_TEAM_SLOTS))
    setOpponentSlots(loadedOpponentSlots.length ? loadedOpponentSlots : cloneSlots(DEFAULT_OPPONENT_SLOTS))
    clearLocks()

    setLoadingScenarioId('')
    setMessage('Scenario loaded into the builder.')
  }

  useEffect(() => {
    if (prefillApplied) return

    if (prefillScenarioId) {
      const scenario = savedScenarios.find((item) => item.id === prefillScenarioId)
      if (!scenario) return
      void loadScenario(prefillScenarioId)
      setPrefillApplied(true)
      return
    }

    if (prefillSingleId || prefillPairIds.length) {
      setTeamSlots((current) => {
        const next = cloneSlots(current)

        if (prefillSingleId) {
          const player = getPlayerById(prefillSingleId)
          const firstSingles = next.find((slot) => slot.slotType === 'singles')
          if (player && firstSingles) {
            firstSingles.players = [{ playerId: player.id, playerName: player.name }]
          }
        }

        if (prefillPairIds.length) {
          const pairPlayers = prefillPairIds.map((id) => getPlayerById(id)).filter(Boolean) as PlayerRow[]
          const firstDoubles = next.find((slot) => slot.slotType === 'doubles')
          if (pairPlayers.length && firstDoubles) {
            firstDoubles.players = [
              { playerId: pairPlayers[0]?.id ?? '', playerName: pairPlayers[0]?.name ?? '' },
              { playerId: pairPlayers[1]?.id ?? '', playerName: pairPlayers[1]?.name ?? '' },
            ]
          }
        }

        return next
      })

      setMessage('Analytics context loaded into the lineup builder.')
      setPrefillApplied(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillApplied, prefillScenarioId, prefillSingleId, prefillPairIds, savedScenarios, players])

  const lineupWarnings = useMemo(() => getLineupWarnings(teamSlots, opponentSlots), [teamSlots, opponentSlots])

  const eliteRecommendation = useMemo(() => {
    const balanced = recommendLineupFromPool(teamSlots, myPlayerPool, 'balanced')
    return {
      slots: balanced.slots,
      bench: balanced.bench.slice(0, 6),
      analysis: compareLineupStrength(balanced.slots, opponentSlots, players),
    }
  }, [teamSlots, myPlayerPool, opponentSlots, players])

  const optimizedPlans = useMemo(() => {
    return [
      optimizeLineupFromPool(teamSlots, myPlayerPool, opponentSlots, players, 'best'),
      optimizeLineupFromPool(teamSlots, myPlayerPool, opponentSlots, players, 'safe'),
      optimizeLineupFromPool(teamSlots, myPlayerPool, opponentSlots, players, 'upside'),
    ]
  }, [teamSlots, myPlayerPool, opponentSlots, players])

  const bestOptimizedPlan = optimizedPlans[0] ?? null

  function applyOptimizedPlan(mode: OptimizerMode) {
    const plan = optimizedPlans.find((item) => item.mode === mode)
    if (!plan) return

    const nextSlots = rebuildCandidateWithLocks(
      plan.slots,
      teamSlots,
      lockedSlotIdSet,
      lockedPlayerIdSet,
      myPlayerPool
    )

    setTeamSlots(nextSlots)
    setMessage(`${plan.title} applied${lockedSlotIds.length || lockedPlayerIds.length ? ' with locks preserved' : ''}.`)
    setError('')
  }

  function applyRecommendedTeamLineup() {
    const next = recommendLineupFromPool(teamSlots, myPlayerPool, 'balanced')
    const rebuilt = rebuildCandidateWithLocks(
      next.slots,
      teamSlots,
      lockedSlotIdSet,
      lockedPlayerIdSet,
      myPlayerPool
    )
    setTeamSlots(rebuilt)
    setMessage(`Balanced recommendation applied${lockedSlotIds.length || lockedPlayerIds.length ? ' around your locks' : ''}.`)
    setError('')
  }

  function rebuildAroundLocks() {
    const rebuilt = rebuildCandidateWithLocks(
      teamSlots,
      teamSlots,
      lockedSlotIdSet,
      lockedPlayerIdSet,
      myPlayerPool
    )
    setTeamSlots(rebuilt)
    setMessage('Lineup rebuilt around your locked lines and players.')
    setError('')
  }

  function applyRecommendedOpponentLineup() {
    const next = recommendLineupFromPool(opponentSlots, opponentPlayerPool, 'ceiling')
    setOpponentSlots(next.slots)
    setMessage('Projected opponent lineup applied.')
    setError('')
  }

  const heroStats = [
    { label: 'Scenario mode', value: currentScenarioId ? 'Editing saved scenario' : 'New scenario' },
    { label: 'Player pool', value: `${myPlayerPool.length} team players` },
    { label: 'Saved versions', value: `${scenarioOptions.length} scenarios` },
    { label: 'Win chance', value: formatPercent(analysis.projection) },
  ]

  const currentScenario = savedScenarios.find((scenario) => scenario.id === currentScenarioId) ?? null
  const hasScenarioName = !!scenarioName.trim()
  const hasCoreContext = !!teamName && !!opponentTeam && !!matchDate
  const hasComparisonCandidates = scenarioOptions.length > 1
  const lineupHasAssignments = teamSlots.some((slot) => slot.players.some((player) => player.playerId))
  const builderReadiness = [
    {
      label: 'Scenario named',
      done: hasScenarioName,
      detail: hasScenarioName ? scenarioName.trim() : 'Give this build a name before you save or compare it.',
    },
    {
      label: 'Match context set',
      done: hasCoreContext,
      detail: hasCoreContext ? `${teamName} vs ${opponentTeam} on ${formatDate(matchDate || null)}` : 'Add team, opponent, and match date so the scenario stays trustworthy later.',
    },
    {
      label: 'Lineup started',
      done: lineupHasAssignments,
      detail: lineupHasAssignments ? 'At least one court has player assignments in place.' : 'Start with one singles or doubles court to give the optimizer something real to work with.',
    },
    {
      label: 'Comparison ready',
      done: hasComparisonCandidates,
      detail: hasComparisonCandidates ? `${scenarioOptions.length} saved versions are ready to compare.` : 'Save another version in this same scope to unlock a meaningful side-by-side comparison.',
    },
  ]
  const readinessCompleteCount = builderReadiness.filter((item) => item.done).length
  const lineupSignals = [
    {
      label: 'Builder state',
      value: currentScenarioId ? 'Editing saved version' : 'New build',
      note: 'Treat this page as the place where the real match version gets shaped before you compare or send it.',
    },
    {
      label: 'Readiness',
      value: `${readinessCompleteCount}/${builderReadiness.length} checks`,
      note: 'Good lineup work starts with real context, then moves into assignments, saving, and comparison.',
    },
    {
      label: 'Best next move',
      value: hasComparisonCandidates ? 'Build or compare' : 'Save a second version',
      note: hasComparisonCandidates
        ? 'Once the build is real, compare versions before you message the team.'
        : 'Save another version in the same scope so the scenario workflow becomes useful.',
    },
  ]

  const dynamicQuickStartCard: CSSProperties = {
    ...quickStartCard,
    position: 'relative',
    overflow: 'hidden',
    minHeight: isTablet ? 320 : 360,
    background:
      theme === 'dark'
        ? 'linear-gradient(180deg, rgba(16,31,63,0.82), rgba(9,21,43,0.92))'
        : 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(239,246,255,0.98))',
    border:
      theme === 'dark'
        ? '1px solid rgba(116,190,255,0.12)'
        : '1px solid rgba(148,163,184,0.18)',
    boxShadow:
      theme === 'dark'
        ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
        : '0 16px 38px rgba(15,23,42,0.08)',
  }

  const lineupVisualStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
  }

  const lineupVisualMaskStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background:
      theme === 'dark'
        ? 'linear-gradient(135deg, rgba(8,18,38,0.26) 8%, rgba(8,18,38,0.76) 50%, rgba(8,18,38,0.94) 100%)'
        : 'linear-gradient(135deg, rgba(255,255,255,0.18) 8%, rgba(255,255,255,0.78) 52%, rgba(248,250,252,0.94) 100%)',
  }

  const lineupVisualContentStyle: CSSProperties = {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gap: 14,
  }

  if (authLoading) {
    return (
      <SiteShell active="/captain">
        <div style={pageWrap}>
          <div style={surfaceCard}>Loading lineup builder...</div>
        </div>
      </SiteShell>
    )
  }

  if (role === 'public') {
    router.replace('/login')
    return null
  }

  return (
    <SiteShell active="/captain">
      <div style={pageWrap}>
        <section style={heroShellResponsive(isTablet, isMobile)}>
          <div>
            <div style={eyebrow}>Captain tools</div>
            <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Lineup Builder</h1>
            <p style={heroTextStyle}>
              Build match-day lineups, work from availability-aware player pools, save multiple scenarios,
              compare versions, and pressure-test your expected edge line by line.
            </p>

            <div style={heroButtonRowStyle}>
              <Link href={compareHref} style={hasComparisonCandidates ? primaryButton : disabledLinkButtonStyle}>Compare Saved Scenarios</Link>
              <GhostBtn onClick={resetBuilder}>Reset Builder</GhostBtn>
              <GhostBtn onClick={() => setRefreshTick((current) => current + 1)}>
                {loading ? 'Refreshing...' : 'Refresh data'}
              </GhostBtn>
            </div>

            <div style={heroMetricGridStyle(isSmallMobile)}>
              {heroStats.map((stat) => (
                <MetricStat key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </div>

            <section style={signalGridStyle(isSmallMobile)}>
              {lineupSignals.map((signal) => (
                <article key={signal.label} style={signalCardStyle}>
                  <div style={signalLabelStyle}>{signal.label}</div>
                  <div style={signalValueStyle}>{signal.value}</div>
                  <div style={signalNoteStyle}>{signal.note}</div>
                </article>
              ))}
            </section>
          </div>

          <div style={dynamicQuickStartCard}>
            <div style={lineupVisualStyle}>
              <Image
                src={heroArtworkSrc}
                alt="TenAceIQ lineup builder concept art"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 34vw"
                style={{ objectFit: 'cover', objectPosition: isTablet ? 'center center' : '72% center' }}
              />
              <div style={lineupVisualMaskStyle} />
            </div>

            <div style={lineupVisualContentStyle}>
              <p style={sectionKicker}>Builder workflow</p>
              <h2 style={quickStartTitle}>Set the match context, build, save, compare</h2>
              <div style={workflowListStyle}>
                {[
                  ['1', 'Define the match context', 'League, flight, team, opponent, and date drive the scenario.'],
                  ['2', 'Build both sides', 'Create your lineup and capture the likely opponent projection.'],
                  ['3', 'Save and compare', 'Keep multiple versions and review them side by side.'],
                ].map(([step, title, text]) => (
                  <div key={step} style={workflowRowStyle}>
                    <div style={workflowNumberStyle}>{step}</div>
                    <div>
                      <div style={workflowTitleStyle}>{title}</div>
                      <div style={workflowTextStyle}>{text}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 18 }}>
                <span style={miniPillSlateStyle}>
                  {currentScenario ? `Loaded: ${currentScenario.scenario_name}` : 'No scenario loaded'}
                </span>
              </div>
            </div>
          </div>
        </section>

        <CaptainSubnav
          title="Lineup Builder inside the captain command center"
          description="Stay anchored to availability, scenarios, messaging, and season management while you build the strongest team sheet."
          tierLabel={access.captainTierLabel}
          tierActive={access.captainSubscriptionActive}
        />

        {!!message && <div role="status" aria-live="polite" style={bannerGreenStyle}>{message}</div>}
        {!!error && (
          <div role="alert" style={warningCardStyle}>
            <div>{error}</div>
            <div style={{ marginTop: 12 }}>
              <GhostSmallBtn onClick={() => setRefreshTick((current) => current + 1)}>Retry builder load</GhostSmallBtn>
            </div>
          </div>
        )}
        {isPreviewMode ? (
          <UpgradePrompt
            planId="captain"
            headline="Still building lineups manually?"
            body="Captain unlocks saved scenarios, smarter lineup iterations, and prediction tracking so you can move from availability chaos to a clearer match-day plan."
            ctaLabel="Build Smarter Lineups"
            ctaHref="/pricing"
            secondaryLabel="Keep exploring"
            compact
          />
        ) : null}
        {teamName && !myPlayerPool.length ? (
          <div style={warningCardStyle}>
            No linked roster was found for {teamName}. This builder now stays team-scoped, so it will not fall back to the full system player pool.
          </div>
        ) : null}
        {opponentTeam && !opponentPlayerPool.length ? (
          <div style={bannerBlueStyle}>
            No linked opponent roster was found for {opponentTeam} yet. Opponent auto-fill will stay empty until imported matches link that team to players.
          </div>
        ) : null}

        <section style={surfaceCard}>
          <div style={tableHeaderStyle}>
            <div>
              <p style={sectionKicker}>Match context summary</p>
              <h3 style={sectionTitleSmall}>Everything driving this build</h3>
            </div>
            <span style={miniPillBlueStyle}>{currentScenarioId ? 'saved scenario' : 'draft scenario'}</span>
          </div>

          <div style={contextSummaryGridStyle}>
            <div style={contextSummaryCardStyle}>
              <div style={contextSummaryLabelStyle}>League</div>
              <div style={contextSummaryValueStyle}>{leagueName || 'Not set'}</div>
            </div>
            <div style={contextSummaryCardStyle}>
              <div style={contextSummaryLabelStyle}>Flight</div>
              <div style={contextSummaryValueStyle}>{flight || 'Not set'}</div>
            </div>
            <div style={contextSummaryCardStyle}>
              <div style={contextSummaryLabelStyle}>Team</div>
              <div style={contextSummaryValueStyle}>{teamName || 'Not set'}</div>
            </div>
            <div style={contextSummaryCardStyle}>
              <div style={contextSummaryLabelStyle}>Opponent</div>
              <div style={contextSummaryValueStyle}>{opponentTeam || 'Not set'}</div>
            </div>
            <div style={contextSummaryCardStyle}>
              <div style={contextSummaryLabelStyle}>Match date</div>
              <div style={contextSummaryValueStyle}>{formatDate(matchDate || null)}</div>
            </div>
            <div style={contextSummaryCardStyle}>
              <div style={contextSummaryLabelStyle}>Scenario</div>
              <div style={contextSummaryValueStyle}>{scenarioName.trim() || 'Untitled scenario'}</div>
            </div>
          </div>

          <div style={contextSummaryInsightStyle}>
            {!teamName || !opponentTeam || !matchDate
              ? 'Set the missing match context fields so saved scenarios and comparisons stay easier to trust later.'
              : 'Your scenario has enough context to save, compare, and track prediction snapshots with more confidence.'}
          </div>

          {sharedCaptainNotes?.weeklyNotes || sharedCaptainNotes?.opponentNotes ? (
            <div style={sharedNotesCardStyle}>
              <div style={tableHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Captain memory notes</p>
                  <h3 style={sectionTitleSmall}>Bring the saved weekly plan into this build</h3>
                </div>
                <span style={miniPillBlueStyle}>Shared context</span>
              </div>

              {sharedCaptainNotes?.weeklyNotes ? (
                <div style={sharedNotesBlockStyle}>
                  <div style={sharedNotesLabelStyle}>Weekly prep notes</div>
                  <div style={sharedNotesTextStyle}>{sharedCaptainNotes.weeklyNotes}</div>
                  <GhostSmallBtn onClick={() => appendSharedScenarioNotes(sharedCaptainNotes.weeklyNotes)}>Add to scenario notes</GhostSmallBtn>
                </div>
              ) : null}

              {sharedCaptainNotes?.opponentNotes ? (
                <div style={sharedNotesBlockStyle}>
                  <div style={sharedNotesLabelStyle}>Opponent scouting notes</div>
                  <div style={sharedNotesTextStyle}>{sharedCaptainNotes.opponentNotes}</div>
                  <GhostSmallBtn onClick={() => appendSharedScenarioNotes(sharedCaptainNotes.opponentNotes)}>Add scouting notes</GhostSmallBtn>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section style={surfaceCard}>
          <div style={tableHeaderStyle}>
            <div>
              <p style={sectionKicker}>Builder readiness</p>
              <h3 style={sectionTitleSmall}>What is ready and what still needs attention</h3>
            </div>
            <span style={miniPillBlueStyle}>{readinessCompleteCount}/4 complete</span>
          </div>

          <div style={decisionSnapshotGridStyle}>
            {builderReadiness.map((item) => (
              <div key={item.label} style={item.done ? decisionCardGoodStyle : decisionCardSlateStyle}>
                <div style={decisionCardLabelStyle}>{item.label}</div>
                <div style={decisionCardValueStyle}>{item.done ? 'Ready' : 'Needs setup'}</div>
                <div style={decisionCardTextStyle}>{item.detail}</div>
              </div>
            ))}
          </div>

          <div style={actionPlanInsightStyle}>
            {readinessCompleteCount === builderReadiness.length
              ? 'This build has enough structure to save, compare, and push forward into weekly messaging with confidence.'
              : 'Finish the setup items above first, then use save and compare as decision tools instead of placeholders.'}
          </div>
        </section>

        <div style={builderLayoutResponsive(isTablet)}>
          <div style={columnStyle}>
            <section style={surfaceCardStrong}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Scenario setup</p>
                  <h2 style={sectionTitle}>Match and scenario details</h2>
                  <p style={sectionBodyTextStyle}>
                    Save multiple versions for the same team/date and compare them later.
                  </p>
                </div>

                <div style={actionRowStyle}>
                  <PrimaryBtn onClick={() => saveScenario(false)} disabled={saving}>
                    {saving ? 'Saving…' : currentScenarioId ? 'Update Scenario' : 'Save Scenario'}
                  </PrimaryBtn>
                  <GhostBtn onClick={() => saveScenario(true)} disabled={saving}>Save as New</GhostBtn>
                  <GhostBtn onClick={() => void trackPredictionSnapshot('manual-track')} disabled={trackingSnapshot}>
                    {trackingSnapshot ? 'Tracking…' : 'Track Snapshot'}
                  </GhostBtn>
                </div>
              </div>

              <div style={filtersGridStyle}>
                <Field label="Scenario name" htmlFor="lineup-builder-scenario-name">
                  <input id="lineup-builder-scenario-name" value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} style={inputStyle} placeholder="Spring Week 4 best build" />
                </Field>
                <Field label="League" htmlFor="lineup-builder-league">
                  <input id="lineup-builder-league" list="league-options" value={leagueName} onChange={(e) => setLeagueName(e.target.value)} style={inputStyle} placeholder="League name" />
                  <datalist id="league-options">
                    {leagueOptions.map((item) => <option key={item} value={item} />)}
                  </datalist>
                </Field>
                <Field label="Flight" htmlFor="lineup-builder-flight">
                  <input id="lineup-builder-flight" list="flight-options" value={flight} onChange={(e) => setFlight(e.target.value)} style={inputStyle} placeholder="Flight" />
                  <datalist id="flight-options">
                    {flightOptions.map((item) => <option key={item} value={item} />)}
                  </datalist>
                </Field>
                <Field label="Match date" htmlFor="lineup-builder-date">
                  <input id="lineup-builder-date" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Team" htmlFor="lineup-builder-team">
                  <input id="lineup-builder-team" list="team-options" value={teamName} onChange={(e) => setTeamName(e.target.value)} style={inputStyle} placeholder="Your team" />
                  <datalist id="team-options">
                    {teamOptions.map((item) => <option key={item} value={item} />)}
                  </datalist>
                </Field>
                <Field label="Opponent" htmlFor="lineup-builder-opponent">
                  <input id="lineup-builder-opponent" value={opponentTeam} onChange={(e) => setOpponentTeam(e.target.value)} style={inputStyle} placeholder="Opponent team" />
                </Field>
              </div>

              <Field
                label="Notes"
                htmlFor="lineup-builder-notes"
                hint="Capture partner logic, availability context, or court-specific reminders before you save this version."
              >
                <textarea
                  id="lineup-builder-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={textareaStyle}
                  rows={4}
                  placeholder="Anything captains should remember for this build…"
                />
              </Field>

              <div style={toggleRowStyle}>
                <label style={checkLabelStyle}>
                  <input type="checkbox" checked={availabilityOnly} onChange={(e) => setAvailabilityOnly(e.target.checked)} />
                  Availability-only player pool
                </label>
                <label style={checkLabelStyle}>
                  <input type="checkbox" checked={hideUnavailable} onChange={(e) => setHideUnavailable(e.target.checked)} />
                  Hide unavailable players
                </label>
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Saved scenarios</p>
                  <h2 style={sectionTitle}>Load, overwrite, or delete saved versions</h2>
                </div>
                <span style={miniPillBlueStyle}>{scenarioOptions.length} in scope</span>
              </div>

              <div style={stackStyle}>
                {scenarioOptions.length ? scenarioOptions.map((scenario) => (
                  <div key={scenario.id} style={listCardStyleCompact}>
                    <div>
                      <div style={listTitleStyle}>{scenario.scenario_name}</div>
                      <div style={listMetaStyle}>
                        {scenario.team_name || 'No team'} - {scenario.opponent_team || 'No opponent'} - {formatDate(scenario.match_date)}
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <GhostSmallBtn onClick={() => void loadScenario(scenario.id)} disabled={loadingScenarioId === scenario.id}>
                        {loadingScenarioId === scenario.id ? 'Loading…' : 'Load'}
                      </GhostSmallBtn>
                      <GhostSmallBtn onClick={() => void deleteScenario(scenario.id)} disabled={deletingScenarioId === scenario.id}>
                        {deletingScenarioId === scenario.id ? 'Deleting…' : 'Delete'}
                      </GhostSmallBtn>
                    </div>
                  </div>
                )) : (
                  <div style={stackStyleCompact}>
                    <p style={mutedTextStyle}>No saved scenarios match the current filters yet.</p>
                    <p style={subtleHelperTextStyle}>
                      Save this build as your first version, or broaden the league, flight, team, or date context above to bring more scenarios back into scope.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section style={surfaceCardStrong}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Your lineup</p>
                  <h2 style={sectionTitle}>Build your team courts</h2>
                </div>
                <div style={actionRowStyle}>
                  <GhostSmallBtn onClick={() => addSlot('team', 'singles')}>+ Singles</GhostSmallBtn>
                  <GhostSmallBtn onClick={() => addSlot('team', 'doubles')}>+ Doubles</GhostSmallBtn>
                </div>
              </div>

              <div style={stackStyle}>
                {teamSlots.map((slot) => (
                  <SlotEditor
                    key={slot.id}
                    side="team"
                    slot={slot}
                    playerPool={myPlayerPool}
                    assignedPlayerIds={teamAssignedPlayerIds}
                    onPlayerChange={setSlotPlayer}
                    onLabelChange={setSlotLabel}
                    onRemove={removeSlot}
                    toggleLockedSlot={toggleLockedSlot}
                    toggleLockedPlayer={toggleLockedPlayer}
                    lockedSlotIds={lockedSlotIdSet}
                    lockedPlayerIds={lockedPlayerIdSet}
                  />
                ))}
              </div>
            </section>
          </div>

          <div style={columnStyle}>
            <section style={surfaceCardStrong}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Opponent lineup</p>
                  <h2 style={sectionTitle}>Project the other side</h2>
                </div>
                <div style={actionRowStyle}>
                  <GhostSmallBtn onClick={() => addSlot('opponent', 'singles')}>+ Singles</GhostSmallBtn>
                  <GhostSmallBtn onClick={() => addSlot('opponent', 'doubles')}>+ Doubles</GhostSmallBtn>
                </div>
              </div>

              <div style={stackStyle}>
                {opponentSlots.map((slot) => (
                  <SlotEditor
                    key={slot.id}
                    side="opponent"
                    slot={slot}
                    playerPool={opponentPlayerPool}
                    assignedPlayerIds={opponentAssignedPlayerIds}
                    onPlayerChange={setSlotPlayer}
                    onLabelChange={setSlotLabel}
                    onRemove={removeSlot}
                    toggleLockedSlot={() => undefined}
                    toggleLockedPlayer={() => undefined}
                    lockedSlotIds={new Set()}
                    lockedPlayerIds={new Set()}
                  />
                ))}
              </div>
            </section>

            <section style={surfaceCardStrong}>
              <p style={sectionKicker}>Elite builder assist</p>
              <h2 style={sectionTitle}>Auto-build, warnings, and bench ideas</h2>
              <p style={sectionBodyTextStyle}>
                Use the recommendation engine to fill the strongest balanced lineup from the current pool, then review
                conflicts before saving.
              </p>

              <div style={actionRowStyleWrap}>
                <PrimaryBtn onClick={applyRecommendedTeamLineup}>Apply Balanced Build</PrimaryBtn>
                <GhostBtn onClick={applyRecommendedOpponentLineup}>Auto-Fill Opponent</GhostBtn>
                <GhostBtn onClick={rebuildAroundLocks}>Rebuild Around Locks</GhostBtn>
                <GhostBtn onClick={clearLocks}>Clear Locks</GhostBtn>
              </div>

              <div style={heroBadgeRowStyleCompact}>
                <span style={badgeGreen}>Recommended win chance {formatPercent(eliteRecommendation.analysis.projection)}</span>
                <span style={badgeBlue}>Edge {analysis.avgDiff.toFixed(2)}</span>
                <span style={badgeSlate}>{eliteRecommendation.bench.length} bench options</span>
              </div>

              <div style={lockPanelStyle}>
                <div style={tableHeaderStyle}>
                  <div>
                    <p style={sectionKicker}>Lock + rebuild intelligence</p>
                    <h3 style={sectionTitleSmall}>What is fixed and what can still move</h3>
                  </div>
                  <span style={miniPillSlateStyle}>
                    {lockedSlotIds.length + lockedPlayerIds.length} lock{lockedSlotIds.length + lockedPlayerIds.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={lockGridStyle}>
                  <div style={lockSummaryCardStyle}>
                    <div style={lockSummaryLabelStyle}>Locked lines</div>
                    <div style={lockSummaryValueStyle}>{lockedSlotIds.length}</div>
                    <div style={lockSummaryTextStyle}>
                      Preserve whole courts exactly as currently built during rebuilds.
                    </div>
                  </div>

                  <div style={lockSummaryCardStyle}>
                    <div style={lockSummaryLabelStyle}>Locked players</div>
                    <div style={lockSummaryValueStyle}>{lockedPlayerIds.length}</div>
                    <div style={lockSummaryTextStyle}>
                      Keep specific players in the lineup while the rest of the build adjusts around them.
                    </div>
                  </div>
                </div>

                {(lockedSlotIds.length || lockedPlayerIds.length) ? (
                  <div style={stackStyleCompact}>
                    {lockedSlotIds.length ? (
                      <div style={listCardStyleCompact}>
                        <div>
                          <div style={listTitleStyle}>Locked lines</div>
                          <div style={listMetaStyle}>
                            {teamSlots
                              .filter((slot) => lockedSlotIdSet.has(slot.id))
                              .map((slot) => slot.label)
                              .join(' - ')}
                          </div>
                        </div>
                        <span style={miniPillBlueStyle}>line locks</span>
                      </div>
                    ) : null}

                    {lockedPlayerIds.length ? (
                      <div style={listCardStyleCompact}>
                        <div>
                          <div style={listTitleStyle}>Locked players</div>
                          <div style={listMetaStyle}>
                            {players
                              .filter((player) => lockedPlayerIdSet.has(player.id))
                              .map((player) => player.name)
                              .join(' - ')}
                          </div>
                        </div>
                        <span style={miniPillGreenStyle}>player locks</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={bannerBlueStyle}>
                    No locks are active. Use line lock to preserve a whole court, or player lock to anchor specific players before rebuilding.
                  </div>
                )}

                <div style={lockInsightStyle}>
                  {lockedSlotIds.length || lockedPlayerIds.length
                    ? 'Rebuilds will preserve your locked structure first, then fill the rest of the lineup from the current player pool.'
                    : 'Nothing is pinned yet, so optimizer actions can freely rebalance your entire lineup.'}
                </div>
              </div>

              {lineupWarnings.length ? (
                <div style={stackStyle}>
                  {lineupWarnings.map((warning) => <div key={warning} style={warningCardStyle}>{warning}</div>)}
                </div>
              ) : (
                <div style={bannerGreenStyle}>No lineup conflicts detected. Slots are filled cleanly with no duplicate player assignments inside a line.</div>
              )}

              <div style={{ marginTop: 16 }}>
                <div style={sectionKicker}>Bench / alternates</div>
                <div style={stackStyleCompact}>
                  {eliteRecommendation.bench.length ? eliteRecommendation.bench.map((player) => (
                    <div key={player.id} style={listCardStyleCompact}>
                      <div>
                        <div style={listTitleStyle}>{player.name}</div>
                        <div style={listMetaStyle}>
                          TIQ {formatRating(player.overall_dynamic_rating ?? player.overall_rating)} | USTA {formatRating(player.overall_usta_dynamic_rating ?? player.overall_rating)} - S {formatRating(player.singles_dynamic_rating ?? player.singles_rating)} - D {formatRating(player.doubles_dynamic_rating ?? player.doubles_rating)}
                        </div>
                      </div>
                      <span style={{ ...miniPillSlateStyle, ...statusTone(player.availabilityStatus) }}>
                        {player.availabilityStatus || 'unknown'}
                      </span>
                    </div>
                  )) : (
                    <p style={mutedTextStyle}>No bench players are left after the recommendation engine fills the lineup.</p>
                  )}
                </div>
              </div>
            </section>

            <section style={surfaceCardStrong}>
              <p style={sectionKicker}>Optimizer command center</p>
              <h2 style={sectionTitle}>How to win this match</h2>

              <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                <div style={bannerBlueStyle}>
                  <strong>Match outlook:</strong> {projectionTier(analysis.projection)} — {formatPercent(analysis.projection)} win probability
                </div>

                {bestLine ? (
                  <div style={bannerGreenStyle}>
                    <strong>Best edge:</strong> {bestLine.label} ({typeof bestLine.diff === 'number' ? `${bestLine.diff >= 0 ? '+' : ''}${bestLine.diff.toFixed(2)}` : '—'})
                  </div>
                ) : null}

                {weakestLine ? (
                  <div style={warningCardStyle}>
                    <strong>Biggest risk:</strong> {weakestLine.label} ({typeof weakestLine.diff === 'number' ? `${weakestLine.diff >= 0 ? '+' : ''}${weakestLine.diff.toFixed(2)}` : '—'})
                  </div>
                ) : null}

                {swingLine ? (
                  <div style={bannerBlueStyle}>
                    <strong>Swing match:</strong> {swingLine.label} — this likely decides the match
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <PrimaryBtn onClick={() => applyOptimizedPlan('best')}>
                  Apply Best Strategy
                </PrimaryBtn>

                <GhostBtn onClick={() => applyOptimizedPlan('safe')}>Play It Safe</GhostBtn>
                <GhostBtn onClick={() => applyOptimizedPlan('upside')}>Max Upside</GhostBtn>
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={tableHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Optimizer plans</p>
                  <h3 style={sectionTitleSmall}>Three different lineup strategies</h3>
                </div>
                <span style={miniPillSlateStyle}>{bestOptimizedPlan ? `${bestOptimizedPlan.score.toFixed(1)} top score` : '—'}</span>
              </div>

              <div style={stackStyle}>
                {optimizedPlans.map((plan) => (
                  <div key={plan.mode} style={listCardStyle}>
                    <div>
                      <div style={listTitleStyle}>{plan.title}</div>
                      <div style={listMetaStyle}>{plan.subtitle}</div>
                      <div style={pillRowStyle}>
                        <span style={miniPillGreenStyle}>Win {formatPercent(plan.analysis.projection)}</span>
                        <span style={miniPillBlueStyle}>Avg diff {plan.analysis.avgDiff.toFixed(2)}</span>
                        <span style={miniPillSlateStyle}>{plan.bench.length} bench</span>
                      </div>
                    </div>
                    <GhostSmallBtn onClick={() => applyOptimizedPlan(plan.mode)}>Apply</GhostSmallBtn>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div style={columnStyle}>
            <section style={surfaceCardStrong}>
              <p style={sectionKicker}>Captain decision snapshot</p>
              <h2 style={sectionTitle}>What this lineup says right now</h2>

              <div style={decisionSnapshotGridStyle}>
                <div style={decisionCardGoodStyle}>
                  <div style={decisionCardLabelStyle}>Best strategy</div>
                  <div style={decisionCardValueStyle}>
                    {bestOptimizedPlan?.title ?? 'No optimizer result'}
                  </div>
                  <div style={decisionCardTextStyle}>
                    {bestOptimizedPlan?.subtitle ?? 'Run the optimizer to compare build directions.'}
                  </div>
                </div>

                <div style={decisionCardBlueStyle}>
                  <div style={decisionCardLabelStyle}>Expected result</div>
                  <div style={decisionCardValueStyle}>{expectedScoreline.label}</div>
                  <div style={decisionCardTextStyle}>
                    {favoredLines} favored line(s), {underdogLines} underdog line(s), with {confidenceScore.tier.toLowerCase()}.
                  </div>
                </div>

                <div style={decisionCardSlateStyle}>
                  <div style={decisionCardLabelStyle}>Captain takeaway</div>
                  <div style={decisionCardValueStyle}>
                    {swingLine ? swingLine.label : bestLine ? bestLine.label : 'Keep building'}
                  </div>
                  <div style={decisionCardTextStyle}>
                    {swingLine
                      ? 'This is the most likely court to decide the match.'
                      : bestLine
                        ? 'This is your clearest current edge.'
                        : 'Complete both sides to unlock clearer match guidance.'}
                  </div>
                </div>
              </div>
            </section>

            <section style={surfaceCardStrong}>
              <p style={sectionKicker}>Projection</p>
              <h2 style={sectionTitle}>Match-level outlook</h2>

              <div style={projectionHeroStyle}>
                <div style={projectionValueStyle}>{formatPercent(analysis.projection)}</div>
                <div style={projectionTierStyle}>{projectionTier(analysis.projection)}</div>
              </div>

              <div style={pillRowStyle}>
                <span style={miniPillGreenStyle}>Favored lines {favoredLines}</span>
                <span style={miniPillSlateStyle}>Underdog lines {underdogLines}</span>
                <span style={miniPillBlueStyle}>Confidence {confidenceScore.label}</span>
              </div>

              <div style={stackStyle}>
                {analysis.lines.map((line) => (
                  <div key={line.label} style={listCardStyleCompact}>
                    <div>
                      <div style={listTitleStyle}>{line.label}</div>
                      <div style={listMetaStyle}>
                        Your {formatRating(line.yourRating)} - Opp {formatRating(line.opponentRating)} - Diff {typeof line.diff === 'number' ? `${line.diff >= 0 ? '+' : ''}${line.diff.toFixed(2)}` : '—'}
                      </div>
                    </div>
                    <span style={typeof line.projection === 'number' && line.projection >= 0.5 ? miniPillGreenStyle : miniPillSlateStyle}>
                      {formatPercent(line.projection)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={tableHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Expected scoreline</p>
                  <h3 style={sectionTitleSmall}>{expectedScoreline.label}</h3>
                </div>
                <span style={miniPillGreenStyle}>Expected scoreline {expectedScoreline.label}</span>
              </div>
              <p style={sectionBodyTextStyle}>
                This rolls up the individual court probabilities into a match-level expectation.
                Use it as a directional planning tool, not a guarantee.
              </p>
            </section>

            <section style={surfaceCardStrong}>
              <div style={tableHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Captain action plan</p>
                  <h3 style={sectionTitleSmall}>What to do before you lock this lineup</h3>
                </div>
                <span style={miniPillGreenStyle}>{confidenceScore.tier}</span>
              </div>

              <div style={actionPlanGridStyle}>
                <div style={actionPlanCardStyle}>
                  <div style={actionPlanLabelStyle}>Primary move</div>
                  <div style={actionPlanValueStyle}>
                    {bestOptimizedPlan?.title ?? 'Run optimizer'}
                  </div>
                  <div style={actionPlanTextStyle}>
                    {bestOptimizedPlan?.subtitle ?? 'Use the optimizer plans to surface your strongest starting point.'}
                  </div>
                </div>

                <div style={actionPlanCardStyle}>
                  <div style={actionPlanLabelStyle}>Court to watch</div>
                  <div style={actionPlanValueStyle}>
                    {swingLine?.label ?? weakestLine?.label ?? 'Complete lineup'}
                  </div>
                  <div style={actionPlanTextStyle}>
                    {swingLine
                      ? 'This is the court most likely to flip the final result.'
                      : weakestLine
                        ? 'This is your biggest current pressure point.'
                        : 'Add more players on both sides to unlock court-level guidance.'}
                  </div>
                </div>

                <div style={actionPlanCardStyle}>
                  <div style={actionPlanLabelStyle}>Bench lever</div>
                  <div style={actionPlanValueStyle}>
                    {eliteRecommendation.bench[0]?.name ?? 'No bench option'}
                  </div>
                  <div style={actionPlanTextStyle}>
                    {eliteRecommendation.bench[0]
                      ? 'Top alternate from the current recommendation if you need to adjust late.'
                      : 'The recommended lineup currently uses the available player pool tightly.'}
                  </div>
                </div>
              </div>

              <div style={actionPlanInsightStyle}>
                {favoredLines > underdogLines
                  ? 'You currently have more favored lines than underdog lines. Preserve your strongest edge and focus your last decisions around the swing court.'
                  : 'This build is still fragile. Use the optimizer plans and lock system to reduce risk before you save or track a snapshot.'}
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={tableHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Why the model likes or dislikes this build</p>
                  <h3 style={sectionTitleSmall}>Explainability cards</h3>
                </div>
                <span style={miniPillBlueStyle}>Auto-generated</span>
              </div>

              <div style={stackStyle}>
                {explainabilityCards.map((card) => (
                  <div key={card.title} style={toneCardStyle(card.tone)}>
                    <div style={listTitleStyle}>{card.title}</div>
                    <div style={listMetaStyleStrong}>{card.body}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={surfaceCardStrong}>
              <div style={tableHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Scenario command deck</p>
                  <h3 style={sectionTitleSmall}>Save, compare, and track with less friction</h3>
                </div>
                <span style={miniPillBlueStyle}>{currentScenarioId ? 'active scenario' : 'draft mode'}</span>
              </div>

              <div style={scenarioDeckGridStyle}>
                <div style={scenarioDeckCardStyle}>
                  <div style={scenarioDeckLabelStyle}>Current scenario</div>
                  <div style={scenarioDeckValueStyle}>{scenarioName.trim() || 'Untitled scenario'}</div>
                  <div style={scenarioDeckTextStyle}>
                    {currentScenario
                      ? `Loaded from saved scenario on ${formatDate(currentScenario.match_date)}.`
                      : 'This build is still in draft mode until you save it.'}
                  </div>
                </div>

                <div style={scenarioDeckCardStyle}>
                  <div style={scenarioDeckLabelStyle}>Comparison ready</div>
                  <div style={scenarioDeckValueStyle}>{scenarioOptions.length} scenario{scenarioOptions.length === 1 ? '' : 's'}</div>
                  <div style={scenarioDeckTextStyle}>
                    Use scenario comparison to pressure-test different builds for the same match context.
                  </div>
                </div>

                <div style={scenarioDeckCardStyle}>
                  <div style={scenarioDeckLabelStyle}>Prediction tracking</div>
                  <div style={scenarioDeckValueStyle}>{confidenceScore.label}</div>
                  <div style={scenarioDeckTextStyle}>
                    Track snapshots whenever the build materially changes so your prediction history stays useful.
                  </div>
                </div>
              </div>

              <div style={scenarioDeckButtonRowStyle}>
                <PrimaryBtn onClick={() => saveScenario(false)} disabled={saving}>
                  {saving ? 'Saving…' : currentScenarioId ? 'Update Current Scenario' : 'Save Current Scenario'}
                </PrimaryBtn>
                <GhostBtn onClick={() => saveScenario(true)} disabled={saving}>Save as New Version</GhostBtn>
                <GhostBtn onClick={() => void trackPredictionSnapshot('command-deck-track')} disabled={trackingSnapshot}>
                  {trackingSnapshot ? 'Tracking…' : 'Track Prediction Snapshot'}
                </GhostBtn>
                <PrimaryBtn onClick={sendCurrentScenarioToMessaging}>
                  Send to Messaging
                </PrimaryBtn>
                <GhostLink href={compareHref}>Open Scenario Comparison</GhostLink>
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={tableHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Player pool</p>
                  <h3 style={sectionTitleSmall}>Availability-aware ranking</h3>
                </div>
                <span style={miniPillSlateStyle}>{myPlayerPool.length} team players</span>
              </div>

              <div style={stackStyleCompact}>
                {myPlayerPool.length ? myPlayerPool.map((player) => (
                  <div key={player.id} style={listCardStyleCompact}>
                    <div>
                      <div style={listTitleStyle}>{player.name}</div>
                      <div style={listMetaStyle}>
                        OVR {formatRating(player.overall_dynamic_rating ?? player.overall_rating)} - S {formatRating(player.singles_dynamic_rating ?? player.singles_rating)} - D {formatRating(player.doubles_dynamic_rating ?? player.doubles_rating)}{player.location ? ` - ${player.location}` : ''}
                      </div>
                      {player.lineup_notes ? <div style={tinyNoteStyle}>{player.lineup_notes}</div> : null}
                    </div>

                    <div style={rightPillStackStyle}>
                      <span style={{ ...miniPillSlateStyle, ...statusTone(player.availabilityStatus) }}>
                        {player.availabilityStatus || 'unknown'}
                      </span>
                      {teamAssignedPlayerIds.has(player.id) ? <span style={miniPillBlueStyle}>assigned</span> : null}
                    </div>
                  </div>
                )) : (
                  <div style={stackStyleCompact}>
                    <p style={mutedTextStyle}>
                      {loading ? 'Loading player pool…' : 'No players match the current scope.'}
                    </p>
                    {!loading ? (
                      <p style={subtleHelperTextStyle}>
                        Check the team, league, flight, and availability toggles first. This builder stays tightly scoped, so an empty pool usually means the context is too narrow or the roster has not been linked yet.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </SiteShell>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <CaptainFormField
      label={label}
      htmlFor={htmlFor}
      hint={hint}
      hintStyle={subtleHelperTextStyle}
      labelStyle={labelStyle}
    >
      {children}
    </CaptainFormField>
  )
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroMetricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyleHero}>{value}</div>
    </div>
  )
}

function SlotEditor({
  side,
  slot,
  playerPool,
  assignedPlayerIds,
  onPlayerChange,
  onLabelChange,
  onRemove,
  toggleLockedSlot,
  toggleLockedPlayer,
  lockedSlotIds,
  lockedPlayerIds,
}: {
  side: 'team' | 'opponent'
  slot: LineupSlot
  playerPool: PoolPlayer[]
  assignedPlayerIds: Set<string>
  onPlayerChange: (side: 'team' | 'opponent', slotId: string, playerIndex: number, playerId: string) => void
  onLabelChange: (side: 'team' | 'opponent', slotId: string, label: string) => void
  onRemove: (side: 'team' | 'opponent', slotId: string) => void
  toggleLockedSlot: (slotId: string) => void
  toggleLockedPlayer: (playerId: string) => void
  lockedSlotIds: Set<string>
  lockedPlayerIds: Set<string>
}) {
  return (
    <div style={slotCardStyle}>
      <div style={slotHeaderStyle}>
        <div style={slotHeaderLeftStyle}>
          <input
            aria-label={`${side} slot label`}
            value={slot.label}
            onChange={(e) => onLabelChange(side, slot.id, e.target.value)}
            style={slotLabelInputStyle}
          />
          <span style={miniPillSlateStyle}>{slot.slotType}</span>
          {side === 'team' ? (
            <button type="button" aria-pressed={lockedSlotIds.has(slot.id)} style={lockedSlotIds.has(slot.id) ? pillButtonActive : pillButton} onClick={() => toggleLockedSlot(slot.id)}>
              {lockedSlotIds.has(slot.id) ? 'line locked' : 'lock line'}
            </button>
          ) : null}
        </div>

        <GhostSmallBtn onClick={() => onRemove(side, slot.id)}>Remove</GhostSmallBtn>
      </div>

      <div style={slotPlayersGridStyle}>
        {slot.players.map((player, index) => (
          <div key={`${slot.id}-${index}`} style={slotPlayerRowStyle}>
              <select
                aria-label={`${slot.label} player ${index + 1}`}
                value={player.playerId}
                onChange={(e) => onPlayerChange(side, slot.id, index, e.target.value)}
                style={inputStyle}
            >
              <option value="">Select player</option>
              {playerPool.map((poolPlayer) => {
                const disabled =
                  poolPlayer.id !== player.playerId &&
                  assignedPlayerIds.has(poolPlayer.id) &&
                  side === 'team'

                return (
                  <option key={poolPlayer.id} value={poolPlayer.id} disabled={disabled}>
                    {poolPlayer.name} - OVR {formatRating(poolPlayer.overall_dynamic_rating ?? poolPlayer.overall_rating)}
                  </option>
                )
              })}
            </select>

            {side === 'team' && player.playerId ? (
              <button
                type="button"
                aria-pressed={lockedPlayerIds.has(player.playerId)}
                style={lockedPlayerIds.has(player.playerId) ? pillButtonActive : pillButton}
                onClick={() => toggleLockedPlayer(player.playerId)}
              >
                {lockedPlayerIds.has(player.playerId) ? 'player locked' : 'lock player'}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

const pageWrap: CSSProperties = {
  padding: '24px 24px 56px',
  display: 'grid',
  gap: 24,
}

const heroShellResponsive = (isTablet: boolean, isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : '1.3fr 0.9fr',
  gap: isMobile ? 16 : 22,
  padding: isMobile ? 18 : 26,
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 30px 70px rgba(2, 6, 23, 0.18)',
})

const eyebrow: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 10,
}

const heroTitleResponsive = (isSmallMobile: boolean, isMobile: boolean): CSSProperties => ({
  margin: 0,
  color: 'var(--foreground)',
  fontSize: isSmallMobile ? 32 : isMobile ? 40 : 52,
  lineHeight: 1.02,
  letterSpacing: '-0.04em',
  fontWeight: 900,
})

const heroTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  fontSize: 16,
  maxWidth: 760,
  marginTop: 14,
}

const heroButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 18,
}

const heroMetricGridStyle = (isSmallMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))',
  gap: 12,
  marginTop: 22,
})

const signalGridStyle = (isSmallMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: 14,
  marginTop: 18,
})

const heroMetricCardStyle: CSSProperties = {
  borderRadius: 22,
  padding: '16px 16px 14px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minHeight: 96,
}

const signalCardStyle: CSSProperties = {
  borderRadius: 22,
  padding: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 14px 34px rgba(7,18,40,0.10)',
}

const signalLabelStyle: CSSProperties = {
  color: '#8fb7ff',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const signalValueStyle: CSSProperties = {
  marginTop: 10,
  color: 'var(--foreground)',
  fontSize: '1.24rem',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const signalNoteStyle: CSSProperties = {
  marginTop: 8,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  fontSize: '.94rem',
}

const metricLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const metricValueStyleHero: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 28,
  fontWeight: 900,
  marginTop: 10,
}

const quickStartCard: CSSProperties = {
  borderRadius: 24,
  padding: 22,
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const quickStartTitle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground)',
  fontSize: 28,
  lineHeight: 1.1,
  fontWeight: 900,
}

const workflowListStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  marginTop: 18,
}

const workflowRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr',
  gap: 12,
  alignItems: 'start',
}

const workflowNumberStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  background: 'rgba(37, 99, 235, 0.22)',
  color: '#dbeafe',
  display: 'grid',
  placeItems: 'center',
  fontWeight: 900,
}

const workflowTitleStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 800,
  fontSize: 15,
}

const workflowTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  marginTop: 4,
}

const builderLayoutResponsive = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr 1fr',
  gap: 22,
})

const columnStyle: CSSProperties = {
  display: 'grid',
  gap: 22,
  alignContent: 'start',
}

const surfaceCardStrong: CSSProperties = {
  borderRadius: 26,
  padding: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 18px 50px rgba(2, 6, 23, 0.14)',
}

const surfaceCard: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 16px 42px rgba(2, 6, 23, 0.12)',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 18,
}

const sectionKicker: CSSProperties = {
  margin: 0,
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const sectionTitle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--foreground)',
  fontSize: 26,
  lineHeight: 1.08,
  fontWeight: 900,
}

const sectionTitleSmall: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground)',
  fontSize: 20,
  lineHeight: 1.1,
  fontWeight: 800,
}

const sectionBodyTextStyle: CSSProperties = {
  marginTop: 10,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.6,
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  padding: '0 14px',
  outline: 'none',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  padding: '14px',
  outline: 'none',
  resize: 'vertical',
}

const labelStyle: CSSProperties = {
  display: 'block',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
}

const filtersGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
}

const contextSummaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
}

const contextSummaryCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  display: 'grid',
  gap: 6,
}

const contextSummaryLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const contextSummaryValueStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 800,
  letterSpacing: '-0.02em',
}

const contextSummaryInsightStyle: CSSProperties = {
  marginTop: 14,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.65,
}

const sharedNotesCardStyle: CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gap: 14,
  padding: '16px 18px',
  borderRadius: 20,
  border: '1px solid rgba(74, 222, 128, 0.16)',
  background: 'var(--shell-panel-bg)',
}

const sharedNotesBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const sharedNotesLabelStyle: CSSProperties = {
  color: '#dbeafe',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const sharedNotesTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
}

const toggleRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 18,
  marginTop: 16,
}

const checkLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 46,
  padding: '0 18px',
  borderRadius: 14,
  border: '1px solid rgba(59, 130, 246, 0.38)',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#eff6ff',
  fontWeight: 800,
  textDecoration: 'none',
  cursor: 'pointer',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 46,
  padding: '0 18px',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 800,
  textDecoration: 'none',
  cursor: 'pointer',
}

const disabledLinkButtonStyle: CSSProperties = {
  ...ghostButton,
  opacity: 0.6,
  cursor: 'not-allowed',
  pointerEvents: 'none',
}

const ghostButtonSmallButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 36,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 700,
  cursor: 'pointer',
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const actionRowStyleWrap: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 14,
}

const stackStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const stackStyleCompact: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const listCardStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 16,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'center',
}

const listCardStyleCompact: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'center',
}

const listTitleStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 800,
  fontSize: 15,
}

const listMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 4,
}

const listMetaStyleStrong: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
  marginTop: 4,
}

const tinyNoteStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  marginTop: 6,
}

const slotCardStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 16,
}

const slotHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
}

const slotHeaderLeftStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const slotLabelInputStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg-strong)',
  color: 'var(--foreground)',
  padding: '8px 12px',
  minWidth: 140,
  outline: 'none',
}

const slotPlayersGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const slotPlayerRowStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const tableHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  marginBottom: 12,
}

const decisionSnapshotGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 12,
  marginTop: 10,
}

const decisionCardBaseStyle: CSSProperties = {
  borderRadius: 20,
  padding: 18,
  display: 'grid',
  gap: 8,
  border: '1px solid var(--shell-panel-border)',
}

const decisionCardGoodStyle: CSSProperties = {
  ...decisionCardBaseStyle,
  background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.12), rgba(2, 6, 23, 0.72))',
  border: '1px solid rgba(34, 197, 94, 0.22)',
}

const decisionCardBlueStyle: CSSProperties = {
  ...decisionCardBaseStyle,
  background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.14), rgba(2, 6, 23, 0.72))',
  border: '1px solid rgba(37, 99, 235, 0.22)',
}

const decisionCardSlateStyle: CSSProperties = {
  ...decisionCardBaseStyle,
  background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.10), rgba(2, 6, 23, 0.72))',
}

const decisionCardLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const decisionCardValueStyle: CSSProperties = {
  color: '#f8fafc',
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const decisionCardTextStyle: CSSProperties = {
  color: '#dbeafe',
  fontSize: 13,
  lineHeight: 1.62,
}

const actionPlanGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 12,
  marginTop: 4,
}

const actionPlanCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'rgba(2, 6, 23, 0.58)',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  display: 'grid',
  gap: 6,
}

const actionPlanLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const actionPlanValueStyle: CSSProperties = {
  color: '#f8fafc',
  fontSize: 22,
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const actionPlanTextStyle: CSSProperties = {
  color: '#dbeafe',
  fontSize: 13,
  lineHeight: 1.62,
}

const actionPlanInsightStyle: CSSProperties = {
  marginTop: 14,
  color: '#dbeafe',
  fontSize: 13,
  lineHeight: 1.7,
}

const scenarioDeckGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 12,
  marginTop: 4,
}

const scenarioDeckCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'rgba(2, 6, 23, 0.58)',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  display: 'grid',
  gap: 6,
}

const scenarioDeckLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const scenarioDeckValueStyle: CSSProperties = {
  color: '#f8fafc',
  fontSize: 22,
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const scenarioDeckTextStyle: CSSProperties = {
  color: '#dbeafe',
  fontSize: 13,
  lineHeight: 1.62,
}

const scenarioDeckButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 14,
}

const projectionHeroStyle: CSSProperties = {
  borderRadius: 22,
  padding: 20,
  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.22), rgba(59, 130, 246, 0.08))',
  border: '1px solid rgba(59, 130, 246, 0.24)',
  marginTop: 14,
  marginBottom: 14,
}

const projectionValueStyle: CSSProperties = {
  color: '#f8fafc',
  fontSize: 44,
  lineHeight: 1,
  fontWeight: 900,
}

const projectionTierStyle: CSSProperties = {
  color: '#bfdbfe',
  fontWeight: 800,
  marginTop: 8,
  fontSize: 15,
}

const pillRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const miniPillStyle: CSSProperties = {
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

const miniPillSlateStyle: CSSProperties = {
  ...miniPillStyle,
  background: 'rgba(255,255,255,0.08)',
  color: '#e2e8f0',
}

const miniPillBlueStyle: CSSProperties = {
  ...miniPillStyle,
  background: 'rgba(37, 91, 227, 0.16)',
  color: '#c7dbff',
  border: '1px solid rgba(37, 91, 227, 0.22)',
}

const miniPillGreenStyle: CSSProperties = {
  ...miniPillStyle,
  background: 'rgba(96, 221, 116, 0.16)',
  color: '#bbf7d0',
  border: '1px solid rgba(96, 221, 116, 0.22)',
}

const badgeGreen: CSSProperties = { ...miniPillGreenStyle }
const badgeBlue: CSSProperties = { ...miniPillBlueStyle }
const badgeSlate: CSSProperties = { ...miniPillSlateStyle }

const heroBadgeRowStyleCompact: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 16,
}

const lockPanelStyle: CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.82))',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  display: 'grid',
  gap: 14,
}

const lockGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const lockSummaryCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'rgba(2, 6, 23, 0.56)',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  display: 'grid',
  gap: 6,
}

const lockSummaryLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const lockSummaryValueStyle: CSSProperties = {
  color: '#f8fafc',
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1,
}

const lockSummaryTextStyle: CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  lineHeight: 1.55,
}

const lockInsightStyle: CSSProperties = {
  color: '#dbeafe',
  fontSize: 13,
  lineHeight: 1.65,
}

const bannerBlueStyle: CSSProperties = {
  borderRadius: 18,
  padding: '14px 16px',
  background: 'rgba(37, 99, 235, 0.16)',
  border: '1px solid rgba(37, 99, 235, 0.26)',
  color: '#dbeafe',
}

const bannerGreenStyle: CSSProperties = {
  borderRadius: 18,
  padding: '14px 16px',
  background: 'rgba(34, 197, 94, 0.14)',
  border: '1px solid rgba(34, 197, 94, 0.24)',
  color: '#dcfce7',
}

const warningCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: '14px 16px',
  background: 'rgba(239, 68, 68, 0.14)',
  border: '1px solid rgba(239, 68, 68, 0.24)',
  color: '#fee2e2',
}

const mutedTextStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 14,
  lineHeight: 1.6,
}

const subtleHelperTextStyle: CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  lineHeight: 1.65,
}

const rightPillStackStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  justifyItems: 'end',
}

const pillButton: CSSProperties = {
  ...miniPillSlateStyle,
  cursor: 'pointer',
  border: '1px solid rgba(148, 163, 184, 0.22)',
}

const pillButtonActive: CSSProperties = {
  ...miniPillGreenStyle,
  cursor: 'pointer',
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        ...primaryButton,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transform: hovered && !disabled ? 'translateY(-2px)' : 'none',
        boxShadow: hovered && !disabled
          ? '0 20px 40px rgba(37,99,235,0.32)'
          : '0 12px 28px rgba(37,99,235,0.20)',
        transition: 'transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{ ...ghostButton, ...(hovered ? { background: 'rgba(25,38,62,0.98)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,8,28,0.32)' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}

function GhostBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ ...ghostButton, ...(hovered && !disabled ? { background: 'rgba(25,38,62,0.98)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,8,28,0.32)' } : {}), ...(disabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

function GhostSmallBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ ...ghostButtonSmallButton, ...(hovered && !disabled ? { background: 'rgba(25,38,62,0.98)', transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(2,8,28,0.32)' } : {}), ...(disabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

