'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import CaptainFormField from '@/app/components/captain-form-field'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import LockedPlanPage from '@/app/components/locked-plan-page'
import { useAuth } from '@/app/components/auth-provider'
import CaptainSuitePanel from '@/app/components/captain-suite-panel'
import CaptainMatchWeekRail from '@/app/components/captain-match-week-rail'
import {
  buildCaptainScopedHref,
  chooseLatestCaptainResumeState,
  hasExplicitCaptainRouteScope,
  loadCaptainResumeStateFromCloud,
  readCaptainResumeState,
  resolveCaptainMatchContext,
  syncCaptainResumeState,
} from '@/lib/captain-memory'
import { readCaptainWeekNotes } from '@/lib/captain-week-notes'
import { readCaptainWeekStatus } from '@/lib/captain-week-status'
import { buildTeamRoomHref } from '@/lib/team-room'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'
import { buildSmsHref, formatDate, formatRating, uniqueSorted, cleanText, normalizeTeamName, prepareSmsBodyForNativeComposer } from '@/lib/captain-formatters'
import { buildProductAccessState } from '@/lib/access-model'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import {
  buildCaptainLineupSlots,
  fitCaptainLineupSlotsToFormat,
  getCaptainLineupFormatKey,
  getTriLevelRatings,
  isPlayerEligibleForCaptainRating,
  type CaptainLineupSlot,
} from '@/lib/captain-lineup-format'
import {
  TEAM_MATCH_FORMATS,
  getTeamMatchFormatSummary,
  normalizeTeamMatchFormatId,
  resolveTeamMatchFormat,
  type TeamMatchFormatId,
} from '@/lib/competition-format-registry'
import {
  getCompetitionPairRatingIssues,
  isCompetitionPairRatingEligible,
  isCompetitionPlayerRatingEligible,
  normalizeTeamCompetitionRulesOverride,
  resolveTeamCompetitionRules,
  type TeamCompetitionRules,
} from '@/lib/competition-rules'
import {
  getMixedPairEligibilityIssues,
  getPlayerEligibilitySourceLabel,
  isMixedPairEligible,
  normalizeMixedPairRole,
  normalizePlayerRatingSource,
  type MixedPairRole,
  type PlayerRatingSource,
} from '@/lib/player-eligibility'
import {
  CAPTAIN_DIRECT_COURT_TEXT_STORAGE_KEY,
  CAPTAIN_LINEUP_HANDOFF_STORAGE_KEY,
  buildPlayerPotentialLineupAvailabilityMessage,
  getCaptainLineupDraftStorageKey,
  readCaptainLineupBuilderDraft,
  readCaptainDirectCourtTextHandoff,
  type CaptainDirectCourtTextHandoff,
  type CaptainLineupBuilderDraft,
  type CaptainLineupHandoff,
} from '@/lib/captain-lineup-handoff'
import {
  normalizeCaptainRosterContactKey,
  selectCaptainContactRowsForScope,
  type CaptainRosterContactRow,
} from '@/lib/captain-roster-contacts'
import {
  applyCaptainSuggestedSwap,
  buildCaptainSuggestedSwapImpact,
  type CaptainSuggestedSwapImpact,
} from '@/lib/captain-replacement-recommendation'
import { readPrivateClientSnapshot, writePrivateClientSnapshot } from '@/lib/private-client-snapshot'

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
  rating_source: PlayerRatingSource | string | null
  mixed_pair_role: MixedPairRole | string | null
  roster_age_division?: string | null
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
  match_time: string | null
  facility: string | null
  home_team: string | null
  away_team: string | null
  line_number: string | null
}

type MatchPlayerLinkRow = {
  match_id: string
  player_id: string
  side: 'A' | 'B' | null
  seat: number | null
}

type TeamRosterMemberRow = {
  team_name: string | null
  player_id: string | null
  player_name: string | null
  league_name: string | null
  flight: string | null
  rating_source: PlayerRatingSource | string | null
  mixed_pair_role: MixedPairRole | string | null
  age_division: string | null
}

type TiqTeamLeagueFormatRow = {
  league_name: string | null
  flight: string | null
  team_match_format_id: string | null
  competition_rules: unknown
}

type SlotPlayer = {
  playerId: string
  playerName: string
}

type PreparedCourtText = {
  key: string
  playerId: string
  playerName: string
  phone: string
  requestUrl: string
  href: string
  body: string
}

type BuilderMode = 'manual' | 'insights'

type LineupSlot = CaptainLineupSlot

type SuggestedSwapDraft = {
  previousSlots: LineupSlot[]
  slotId: string
  playerIndex: number
  replacementPlayerId: string
  outgoingPlayerName: string
  replacementPlayerName: string
  courtLabel: string
  needsConfirmation: boolean
}

type SavedLineupChangeDelivery = {
  messageId: string
  href: string
  courtLabel: string
  outgoingPlayerName: string
  replacementPlayerName: string
  affectedNames: string[]
  pending: boolean
  notifiedCount: number
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

type ManualRosterPlayer = PlayerRow & {
  manualTeamName: string
  manualLeagueName: string
  manualFlight: string
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

type CourtMapTone = 'good' | 'warn' | 'info' | 'muted'

type AppliedLineupNotice = {
  title: string
  changedCourts: number
  filledCourts: number
  totalCourts: number
}

type HistoricalLineupSuggestion = {
  matchDate: string
  opponent: string
  courts: Array<{ lineNumber: number; playerIds: string[] }>
  returningPlayerCount: number
}

type AvailabilityConfirmationStage = 'idle' | 'saving-lineup' | 'preparing-replies' | 'opening-messages'

type CourtAskSignal = {
  label: string
  detail: string
  tone: 'ready' | 'waiting' | 'confirmed' | 'maybe' | 'out' | 'warning' | 'muted'
}

function getSaveAndAskLabel(stage: AvailabilityConfirmationStage) {
  if (stage === 'saving-lineup') return 'Saving lineup...'
  if (stage === 'preparing-replies') return 'Preparing replies...'
  if (stage === 'opening-messages') return 'Opening messages...'
  return 'Save & ask players'
}

const DEFAULT_TEAM_SLOTS: LineupSlot[] = buildCaptainLineupSlots('', '', 'team')
const DEFAULT_OPPONENT_SLOTS: LineupSlot[] = buildCaptainLineupSlots('', '', 'opponent')

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

type CaptainMessageTextContactRow = {
  team_name: string | null
  league_name: string | null
  flight: string | null
  full_name: string | null
  phone: string | null
  opt_in_text: boolean | null
}

type LineupBuilderPayload = {
  ok?: boolean
  message?: string
  players?: PlayerRow[]
  matches?: MatchTeamRow[]
  matchPlayers?: MatchPlayerLinkRow[]
  historicalLineMatches?: MatchTeamRow[]
  historicalLineMatchPlayers?: MatchPlayerLinkRow[]
  rosterMembers?: TeamRosterMemberRow[]
  availability?: AvailabilityRow[]
  captainRosterContacts?: CaptainRosterContactRow[]
  captainMessageContacts?: CaptainMessageTextContactRow[]
  savedScenarios?: ScenarioRow[]
  tiqTeamLeagueFormats?: TiqTeamLeagueFormatRow[]
}

const CAPTAIN_LINEUP_SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000
const CAPTAIN_LINEUP_REQUEST_TIMEOUT_MS = 12_000

function buildRosterPlayerIdSet(
  targetTeam: string,
  matches: MatchTeamRow[],
  matchPlayers: MatchPlayerLinkRow[],
  availabilityRows: AvailabilityRow[],
  rosterMembers: TeamRosterMemberRow[],
) {
  const normalizedTarget = normalizeTeamName(targetTeam)
  if (!normalizedTarget) return new Set<string>()
  const filteredMatches = matches.filter((match) => {
    const home = normalizeTeamName(match.home_team)
    const away = normalizeTeamName(match.away_team)
    if (home !== normalizedTarget && away !== normalizedTarget) return false
    return true
  })

  const sideByMatchId = new Map<string, 'A' | 'B'>()
  for (const match of filteredMatches) {
    const home = normalizeTeamName(match.home_team)
    const away = normalizeTeamName(match.away_team)
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
    if (normalizeTeamName(row.team_name) !== normalizedTarget) continue
    ids.add(row.player_id)
  }

  for (const row of getScopedRosterMembers(targetTeam, rosterMembers)) {
    if (!row.player_id) continue
    ids.add(row.player_id)
  }

  return ids
}

function getScopedRosterMembers(
  targetTeam: string,
  rosterMembers: TeamRosterMemberRow[],
) {
  const normalizedTarget = normalizeTeamName(targetTeam)
  const teamRosterMembers = rosterMembers.filter((row) => (
    Boolean(row.player_id) && normalizeTeamName(row.team_name) === normalizedTarget
  ))
  return teamRosterMembers
}

function buildRosterEligibilityByPlayerId(
  targetTeam: string,
  rosterMembers: TeamRosterMemberRow[],
) {
  return new Map(getScopedRosterMembers(targetTeam, rosterMembers)
    .filter((row) => Boolean(row.player_id))
    .map((row) => [row.player_id as string, row]))
}

function filterPlayerPoolByRoster(
  playerPool: PoolPlayer[],
  rosterIds: Set<string>,
  eligibilityByPlayerId = new Map<string, TeamRosterMemberRow>(),
) {
  if (!rosterIds.size) return []
  return playerPool
    .filter((player) => rosterIds.has(player.id))
    .map((player) => {
      const roster = eligibilityByPlayerId.get(player.id)
      if (!roster) return player
      const rosterRatingSource = normalizePlayerRatingSource(roster.rating_source)
      const rosterMixedPairRole = normalizeMixedPairRole(roster.mixed_pair_role)
      return {
        ...player,
        rating_source: rosterRatingSource === 'unknown'
          ? normalizePlayerRatingSource(player.rating_source)
          : rosterRatingSource,
        mixed_pair_role: rosterMixedPairRole === 'unknown'
          ? normalizeMixedPairRole(player.mixed_pair_role)
          : rosterMixedPairRole,
        roster_age_division: roster.age_division,
      }
    })
}

function createManualRosterPlayer(
  name: string,
  scope: { teamName: string; leagueName: string; flight: string },
): ManualRosterPlayer {
  const playerKey = [normalizeTeamName(scope.teamName), normalizeTeamName(name)]
    .map((value) => encodeURIComponent(value))
    .join(':')

  return {
    id: `manual-roster:${playerKey}`,
    name,
    location: null,
    flight: scope.flight || null,
    preferred_role: null,
    lineup_notes: 'Entered manually for this lineup.',
    singles_rating: null,
    singles_dynamic_rating: null,
    singles_usta_dynamic_rating: null,
    doubles_rating: null,
    doubles_dynamic_rating: null,
    doubles_usta_dynamic_rating: null,
    overall_rating: null,
    overall_dynamic_rating: null,
    overall_usta_dynamic_rating: null,
    rating_source: 'self',
    mixed_pair_role: 'unknown',
    roster_age_division: null,
    manualTeamName: scope.teamName,
    manualLeagueName: scope.leagueName,
    manualFlight: scope.flight,
  }
}

function restoreManualRosterPlayers(draft: CaptainLineupBuilderDraft | null | undefined) {
  return (draft?.manualRosterEntries ?? []).map((entry) => createManualRosterPlayer(entry.name, {
    teamName: entry.teamName,
    leagueName: entry.leagueName,
    flight: entry.flight,
  }))
}

function buildTeamSummaryUploadHref(context: {
  teamName: string
  leagueName: string
  flight: string
  returnTo: string
}) {
  const params = new URLSearchParams({
    intent: 'upload-source',
    context: ['Captain lineup', context.teamName, context.leagueName, context.flight].filter(Boolean).join(' - '),
    type: 'team_summary',
    help: '1',
    returnTo: context.returnTo,
  })
  return `/data-assist?${params.toString()}#upload`
}

function formatMatchContext(match: MatchTeamRow | null) {
  if (!match) return 'No schedule match selected'
  const pieces = [
    formatDate(match.match_date),
    cleanText(match.match_time),
    cleanText(match.facility),
  ].filter(Boolean)
  return pieces.join(' - ') || 'Schedule details pending'
}

function getOpponentForTeam(match: MatchTeamRow, teamName: string) {
  const selected = teamName.trim().toLowerCase()
  const home = (match.home_team ?? '').trim()
  const away = (match.away_team ?? '').trim()
  if (home.toLowerCase() === selected) return away
  if (away.toLowerCase() === selected) return home
  return ''
}

function isSameScope(match: MatchTeamRow, values: { leagueName: string; flight: string; teamName: string }) {
  if (values.leagueName && (match.league_name ?? '').trim() !== values.leagueName) return false
  if (values.flight && (match.flight ?? '').trim() !== values.flight) return false
  if (!values.teamName) return true
  const team = values.teamName.trim().toLowerCase()
  return (match.home_team ?? '').trim().toLowerCase() === team || (match.away_team ?? '').trim().toLowerCase() === team
}


function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${Math.round(value * 100)}%`
}

function formatProjectionPointDelta(value: number) {
  const points = Math.round(value * 100)
  if (points === 0) return 'No projected change'
  return `${points > 0 ? '+' : ''}${points} pts`
}

function availabilityRank(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase()
  if (normalized === 'available' || normalized === 'yes' || normalized === 'in') return 0
  if (normalized === 'maybe' || normalized === 'limited') return 1
  if (normalized === 'unknown' || normalized === '') return 2
  if (normalized === 'unavailable' || normalized === 'no' || normalized === 'out') return 3
  return 2
}

function availabilityLabel(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase()
  if (normalized === 'available' || normalized === 'yes' || normalized === 'in' || normalized === 'confirmed') return 'Confirmed'
  if (normalized === 'maybe' || normalized === 'limited') return 'Maybe'
  if (normalized === 'unavailable' || normalized === 'no' || normalized === 'out' || normalized === 'declined') return 'Out'
  return 'No response'
}

function getCourtAskSignal({
  replyLabel,
  prepared,
  opened,
  preparing,
  needsPhone,
}: {
  replyLabel: ReturnType<typeof availabilityLabel>
  prepared: boolean
  opened: boolean
  preparing: boolean
  needsPhone: boolean
}): CourtAskSignal {
  if (replyLabel === 'Confirmed') {
    return { label: 'Confirmed', detail: 'Reply received. This player stays protected in your lineup.', tone: 'confirmed' }
  }
  if (replyLabel === 'Maybe') {
    return { label: 'Maybe · review', detail: 'Reply received. Keep this court flexible until they confirm.', tone: 'maybe' }
  }
  if (replyLabel === 'Out') {
    return { label: 'No · replace', detail: 'Reply received. Choose another player for this court.', tone: 'out' }
  }
  if (needsPhone) {
    return { label: 'Mobile needed', detail: 'Add a mobile number to prepare this player’s private Ask.', tone: 'warning' }
  }
  if (prepared && opened) {
    return { label: 'Ask sent · waiting', detail: 'TiQ is checking for their reply while you keep building.', tone: 'waiting' }
  }
  if (prepared) {
    return { label: 'Ask ready', detail: 'Tap Ask below to open a prefilled message.', tone: 'ready' }
  }
  if (preparing) {
    return { label: 'Preparing Ask', detail: 'Securing this player’s one-tap reply link now.', tone: 'waiting' }
  }
  return { label: 'Ask pending', detail: 'Prepare this player’s private Ask when you are ready.', tone: 'muted' }
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
  if (normalized === 'maybe' || normalized === 'limited') {
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
    const ratingLevel =
      typeof obj.ratingLevel === 'number' && Number.isFinite(obj.ratingLevel)
        ? obj.ratingLevel
        : undefined

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
      ...(ratingLevel !== undefined ? { ratingLevel } : {}),
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

function getPlayerBaseRating(player: PlayerRow) {
  return player.overall_rating ?? player.doubles_rating ?? null
}

function isPlayerEligibleForSlot(player: PlayerRow, slot: LineupSlot, rules?: TeamCompetitionRules) {
  if (rules) {
    return isCompetitionPlayerRatingEligible(rules, getPlayerBaseRating(player), slot.ratingLevel)
  }
  return isPlayerEligibleForCaptainRating(getPlayerBaseRating(player), slot.ratingLevel)
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

function filledSlotPlayerCount(players: SlotPlayer[]) {
  return players.filter((player) => player.playerId).length
}

function isProjectedLineComplete(line: LineProjection) {
  return (
    filledSlotPlayerCount(line.teamPlayers) === line.playerCount &&
    filledSlotPlayerCount(line.opponentPlayers) === line.playerCount
  )
}

function formatLineGap(line: LineProjection) {
  return typeof line.diff === 'number' ? `${line.diff >= 0 ? '+' : ''}${line.diff.toFixed(2)}` : '-'
}

function formatSlotPlayerNames(players: SlotPlayer[], fallback: string) {
  const names = players.map((player) => player.playerName).filter(Boolean)
  return names.length ? names.join(' / ') : fallback
}

function slotPlayerSignature(players: SlotPlayer[]) {
  return players
    .map((player) => player.playerId || player.playerName)
    .filter(Boolean)
    .sort()
    .join('|')
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
  mode: 'balanced' | 'ceiling' = 'balanced',
  rules?: TeamCompetitionRules,
) {
  const nextSlots = cloneSlots(baseSlots)
  const available = [...playerPool]
  const used = new Set<string>()

  const pickBest = (slot: LineupSlot) => {
    const ranked = available
      .filter((player) => !used.has(player.id))
      .filter((player) => isPlayerEligibleForSlot(player, slot, rules))
      .map((player) => ({
        player,
        score:
          scorePoolPlayerForSlot(player, slot.slotType) +
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
      const best = pickBest(slot)
      slot.players = [{ playerId: best?.id ?? '', playerName: best?.name ?? '' }]
      continue
    }

    const eligible = available
      .filter((player) => !used.has(player.id))
      .filter((player) => isPlayerEligibleForSlot(player, slot, rules))
    const pairCandidates: Array<{ first: PoolPlayer; second: PoolPlayer; score: number }> = []
    for (let left = 0; left < eligible.length; left += 1) {
      for (let right = left + 1; right < eligible.length; right += 1) {
        const first = eligible[left]
        const second = eligible[right]
        if (rules && !isCompetitionPairRatingEligible(
          rules,
          [getPlayerBaseRating(first), getPlayerBaseRating(second)],
          slot.ratingLevel,
        )) continue
        if (rules && !isMixedPairEligible(
          rules.requiresMixedPair,
          [first.mixed_pair_role, second.mixed_pair_role],
        )) continue
        pairCandidates.push({
          first,
          second,
          score: scorePoolPlayerForSlot(first, 'doubles') + scorePoolPlayerForSlot(second, 'doubles'),
        })
      }
    }
    const pair = pairCandidates.sort((left, right) => right.score - left.score)[0]
    const first = pair?.first ?? null
    const second = pair?.second ?? null
    if (first) used.add(first.id)
    if (second) used.add(second.id)
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
  mode: OptimizerMode,
  rules?: TeamCompetitionRules,
): OptimizedLineupPlan {
  const teamSlots = cloneSlots(baseSlots)
  const used = new Set<string>()
  const totalNeeded = teamSlots.reduce((sum, slot) => sum + (slot.slotType === 'doubles' ? 2 : 1), 0)

  const sortedPool = [...playerPool]
    .sort((a, b) => {
      const aOverall = a.overall_dynamic_rating ?? a.overall_rating ?? 0
      const bOverall = b.overall_dynamic_rating ?? b.overall_rating ?? 0
      return bOverall - aOverall
    })
  const hasRatingCourts = teamSlots.some((slot) => typeof slot.ratingLevel === 'number')
  const topPool = hasRatingCourts
    ? sortedPool
    : sortedPool.slice(0, Math.max(totalNeeded + 6, 12))

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

  const doublesSlots = teamSlots
    .map((slot, index) => ({ slot, index }))
    .filter((item) => item.slot.slotType === 'doubles')

  const orderedDoublesSlots =
    hasRatingCourts
      ? doublesSlots.map((item) => item.index)
      : opponentDoublesByStrength.length === doublesSlots.length
      ? opponentDoublesByStrength.map((item) => item.index)
      : doublesSlots.map((item) => item.index)

  orderedDoublesSlots.forEach((slotIndex) => {
    if (typeof slotIndex !== 'number') return
    const slot = teamSlots[slotIndex]
    const eligiblePlayers = topPool
      .filter((player) => !used.has(player.id))
      .filter((player) => isPlayerEligibleForSlot(player, slot, rules))
    const pairCandidates: Array<{ a: PoolPlayer; b: PoolPlayer; score: number }> = []

    for (let i = 0; i < eligiblePlayers.length; i += 1) {
      for (let j = i + 1; j < eligiblePlayers.length; j += 1) {
        const a = eligiblePlayers[i]
        const b = eligiblePlayers[j]
        if (rules && !isCompetitionPairRatingEligible(
          rules,
          [getPlayerBaseRating(a), getPlayerBaseRating(b)],
          slot.ratingLevel,
        )) continue
        if (rules && !isMixedPairEligible(
          rules.requiresMixedPair,
          [a.mixed_pair_role, b.mixed_pair_role],
        )) continue
        pairCandidates.push({ a, b, score: rankDoubles(a, b) })
      }
    }

    const pair = pairCandidates.sort((a, b) => b.score - a.score)[0]
    if (!pair) {
      teamSlots[slotIndex].players = [
        { playerId: '', playerName: '' },
        { playerId: '', playerName: '' },
      ]
      return
    }

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
        ? "Places your most reliable strength into the opponent's strongest lines to reduce collapse risk."
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
  playerPool: PoolPlayer[],
  rules?: TeamCompetitionRules,
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

  const pickBest = (slot: LineupSlot) => {
    const ranked = playerPool
      .filter((player) => !used.has(player.id))
      .filter((player) => isPlayerEligibleForSlot(player, slot, rules))
      .map((player) => ({ player, score: scoreForFill(player, slot.slotType) }))
      .sort((a, b) => b.score - a.score)

    const best = ranked[0]?.player ?? null
    if (best) used.add(best.id)
    return best
  }

  next.forEach((slot) => {
    slot.players = slot.players.map((player) => {
      if (player.playerId) return player
      const best = pickBest(slot)
      return {
        playerId: best?.id ?? '',
        playerName: best?.name ?? '',
      }
    })
  })

  return next
}

function getLineupWarnings(
  teamSlots: LineupSlot[],
  opponentSlots: LineupSlot[],
  players: PlayerRow[],
  rules?: TeamCompetitionRules,
) {
  const warnings: string[] = []

  const validateSlots = (slots: LineupSlot[], sideLabel: string) => {
    for (const slot of slots) {
      const filled = slot.players.filter((player) => player.playerId)
      if (slot.slotType === 'singles' && filled.length < 1) warnings.push(`${sideLabel} ${slot.label} is missing a player.`)
      if (slot.slotType === 'doubles' && filled.length < 2) warnings.push(`${sideLabel} ${slot.label} needs two players.`)

      const ids = filled.map((player) => player.playerId)
      if (new Set(ids).size !== ids.length) warnings.push(`${sideLabel} ${slot.label} contains the same player twice.`)

      for (const selected of filled) {
        const player = players.find((candidate) => candidate.id === selected.playerId)
        if (
          player &&
          rules &&
          rules.ratingRule !== 'open' &&
          rules.ratingRule !== 'local_rules' &&
          typeof getPlayerBaseRating(player) !== 'number'
        ) {
          warnings.push(`${selected.playerName || 'Selected player'} needs a rating before TiQ can confirm eligibility.`)
        }
        if (
          player &&
          sideLabel === 'Your' &&
          rules &&
          rules.ratingRule !== 'open' &&
          normalizePlayerRatingSource(player.rating_source) === 'self'
        ) {
          warnings.push(`${selected.playerName || 'Selected player'} is self-rated. Confirm league eligibility before finalizing.`)
        }
        if (player && sideLabel === 'Your' && rules?.ageDivision) {
          if (player.roster_age_division && player.roster_age_division !== rules.ageDivision) {
            warnings.push(`${selected.playerName || 'Selected player'} is verified for ${player.roster_age_division}, not ${rules.ageDivision}.`)
          }
        }
        if (player && !isPlayerEligibleForSlot(player, slot, rules)) {
          warnings.push(
            typeof slot.ratingLevel === 'number'
              ? `${selected.playerName || 'Selected player'} is not eligible for ${slot.label}.`
              : `${selected.playerName || 'Selected player'} is outside this league’s saved rating level.`,
          )
        }
      }

      if (rules && slot.slotType === 'doubles' && filled.length === 2) {
        const selectedPlayers = filled.map((selected) => players.find((candidate) => candidate.id === selected.playerId))
        const pairIssues = getCompetitionPairRatingIssues(
          rules,
          selectedPlayers.map((player) => player ? getPlayerBaseRating(player) : null),
          slot.ratingLevel,
        )
        pairIssues.forEach((issue) => warnings.push(`${sideLabel} ${slot.label}: ${issue}`))
        getMixedPairEligibilityIssues(
          rules.requiresMixedPair,
          selectedPlayers.map((player) => player?.mixed_pair_role),
        ).forEach((issue) => warnings.push(`${sideLabel} ${slot.label}: ${issue}`))
      }
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

function readInitialLineupBuilderContext(routeSearch: string, userId?: string | null) {
  const params = new URLSearchParams(routeSearch)
  const resumeState = typeof window === 'undefined' ? null : readCaptainResumeState(userId)
  const matchContext = resolveCaptainMatchContext(params)
  const hasExplicitRouteScope = hasExplicitCaptainRouteScope(params)

  return {
    hasExplicitRouteScope,
    competitionLayer: params.get('layer') || resumeState?.competitionLayer || '',
    team: params.get('team') || resumeState?.team || '',
    league: params.get('league') || resumeState?.league || '',
    flight: params.get('flight') || resumeState?.flight || '',
    eventDate: matchContext.eventDate,
    opponentTeam: matchContext.opponentTeam,
    matchId: matchContext.matchId,
    scenario: params.get('scenario') || params.get('left') || resumeState?.scenarioId || '',
    pairIds: (params.get('pair') || '').split(',').map((value) => value.trim()).filter(Boolean),
    singleId: params.get('single') || '',
    matchFormat: params.get('matchFormat') || 'auto',
    replacePlayer: params.get('replace') || '',
    replacementPlayer: params.get('replacement') || '',
    replacementPlayerId: params.get('replacementId') || '',
    replacementCourt: params.get('court') || '',
    mode: params.get('mode') || '',
    source: params.get('source') || '',
      availabilityOnly: false,
  }
}

export default function LineupBuilderPage() {
  const searchParams = useSearchParams()
  const routeSearch = searchParams.toString()
  const builderContextKey = hasExplicitCaptainRouteScope(new URLSearchParams(routeSearch))
    ? `captain-scope:${routeSearch}`
    : 'captain-resume'

  return (
    <SiteShell active="/captain">
      <LineupBuilderContent key={builderContextKey} routeSearch={routeSearch} />
    </SiteShell>
  )
}

function isFutureJwtError(message: string | null | undefined) {
  return (message || '').toLowerCase().includes('jwt issued at future')
}

// A freshly issued mobile session can take a couple of seconds to be accepted
// by every Supabase/PostgREST node. Retrying immediately treats that short
// propagation window as a lost roster, which is the opposite of what a
// captain needs while building a lineup.
const FUTURE_JWT_SETTLE_DELAY_MS = 3_000
const MAX_FUTURE_JWT_RECOVERY_ATTEMPTS = 2

function LineupBuilderContent({ routeSearch }: { routeSearch: string }) {
  const router = useRouter()
  const { role, entitlements, authResolved, userId, session } = useAuth()
  const initialContext = readInitialLineupBuilderContext(routeSearch, userId)
  const persistedDirectCourtTextHandoff = typeof window === 'undefined'
    ? null
    : readCaptainDirectCourtTextHandoff(window.localStorage.getItem(CAPTAIN_DIRECT_COURT_TEXT_STORAGE_KEY))
  const persistedDeviceBuilderDraft = typeof window === 'undefined'
    ? null
    : readCaptainLineupBuilderDraft(window.localStorage.getItem(getCaptainLineupDraftStorageKey(userId)))
  // A Team card is a deliberate route choice. Never let a recoverable draft
  // from another team replace that selection after mobile auth settles.
  const persistedBuilderDraft = initialContext.hasExplicitRouteScope
    ? null
    : (persistedDirectCourtTextHandoff?.builderDraft ?? persistedDeviceBuilderDraft)
  const persistedManualRosterDraft = persistedDirectCourtTextHandoff?.builderDraft ?? persistedDeviceBuilderDraft
  const initialCompetitionLayer = initialContext.competitionLayer || persistedBuilderDraft?.competitionLayer || ''
  const initialLeagueName = initialContext.league || persistedBuilderDraft?.leagueName || ''
  const initialFlight = initialContext.flight || persistedBuilderDraft?.flight || ''
  const initialTeamName = initialContext.team || persistedBuilderDraft?.teamName || ''
  const initialOpponentTeam = initialContext.opponentTeam || persistedBuilderDraft?.opponentTeam || ''
  const initialMatchDate = initialContext.eventDate || persistedBuilderDraft?.matchDate || ''
  const initialMatchId = initialContext.matchId || persistedBuilderDraft?.selectedMatchId || ''
  const initialMatchFormat = initialContext.matchFormat !== 'auto'
    ? initialContext.matchFormat
    : persistedBuilderDraft?.matchFormat || 'auto'

  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [matches, setMatches] = useState<MatchTeamRow[]>([])
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayerLinkRow[]>([])
  const [historicalLineMatches, setHistoricalLineMatches] = useState<MatchTeamRow[]>([])
  const [historicalLineMatchPlayers, setHistoricalLineMatchPlayers] = useState<MatchPlayerLinkRow[]>([])
  const [rosterMembers, setRosterMembers] = useState<TeamRosterMemberRow[]>([])
  const [teamRosterPlayers, setTeamRosterPlayers] = useState<PlayerRow[]>([])
  const [scopedRosterPlayerIds, setScopedRosterPlayerIds] = useState<string[]>([])
  const [availability, setAvailability] = useState<AvailabilityRow[]>([])
  const [captainRosterContacts, setCaptainRosterContacts] = useState<CaptainRosterContactRow[]>([])
  const [captainMessageContacts, setCaptainMessageContacts] = useState<CaptainMessageTextContactRow[]>([])
  const [savedScenarios, setSavedScenarios] = useState<ScenarioRow[]>([])
  const [tiqTeamLeagueFormats, setTiqTeamLeagueFormats] = useState<TiqTeamLeagueFormatRow[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmationStage, setConfirmationStage] = useState<AvailabilityConfirmationStage>('idle')
  const preparingConfirmation = confirmationStage !== 'idle'
  const saveAndAskLabel = getSaveAndAskLabel(confirmationStage)
  const [askingCourtId, setAskingCourtId] = useState('')
  const [preparedCourtTexts, setPreparedCourtTexts] = useState<Record<string, PreparedCourtText>>({})
  const [openedCourtTextKeys, setOpenedCourtTextKeys] = useState<string[]>([])
  const [missingPhonePlayerKeys, setMissingPhonePlayerKeys] = useState<string[]>([])
  const [inlinePhoneByPlayerKey, setInlinePhoneByPlayerKey] = useState<Record<string, string>>({})
  const [savingPhonePlayerKey, setSavingPhonePlayerKey] = useState('')
  const preparingCourtTextKeysRef = useRef(new Set<string>())
  const [directCourtTextHandoff, setDirectCourtTextHandoff] = useState<CaptainDirectCourtTextHandoff | null>(
    initialContext.hasExplicitRouteScope ? null : persistedDirectCourtTextHandoff,
  )
  const [refreshingReplies, setRefreshingReplies] = useState(false)
  const [trackingSnapshot, setTrackingSnapshot] = useState(false)
  const [deletingScenarioId, setDeletingScenarioId] = useState('')
  const [loadingScenarioId, setLoadingScenarioId] = useState('')
  const [currentScenarioId, setCurrentScenarioId] = useState(persistedBuilderDraft?.scenarioId || '')
  const [comparisonScenarioId, setComparisonScenarioId] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [smsFallback, setSmsFallback] = useState<{ href: string; playerName: string } | null>(null)
  const [recoveringSecureSession, setRecoveringSecureSession] = useState(false)
  const [appliedLineupNotice, setAppliedLineupNotice] = useState<AppliedLineupNotice | null>(null)
  const [suggestedSwapDraft, setSuggestedSwapDraft] = useState<SuggestedSwapDraft | null>(null)
  const [savedLineupChangeDelivery, setSavedLineupChangeDelivery] = useState<SavedLineupChangeDelivery | null>(null)
  const [notifyingLineupChange, setNotifyingLineupChange] = useState(false)

  const [competitionLayer, setCompetitionLayer] = useState(initialCompetitionLayer)
  const [leagueName, setLeagueName] = useState(initialLeagueName)
  const [selectedMatchFormatId, setSelectedMatchFormatId] = useState<TeamMatchFormatId | 'auto'>(
    initialMatchFormat === 'auto' ? 'auto' : normalizeTeamMatchFormatId(initialMatchFormat)
  )
  const [flight, setFlight] = useState(initialFlight)
  const [teamName, setTeamName] = useState(initialTeamName)
  const [opponentTeam, setOpponentTeam] = useState(initialOpponentTeam)
  const [matchDate, setMatchDate] = useState(initialMatchDate)
  const [selectedMatchId, setSelectedMatchId] = useState(initialMatchId)
  const [scenarioName, setScenarioName] = useState(persistedBuilderDraft?.scenarioName || '')
  const [notes, setNotes] = useState(persistedBuilderDraft?.notes || '')
  const [refreshTick, setRefreshTick] = useState(0)
  const [manualRosterPlayers, setManualRosterPlayers] = useState<ManualRosterPlayer[]>(() =>
    restoreManualRosterPlayers(persistedManualRosterDraft)
  )
  const [manualRosterText, setManualRosterText] = useState('')
  const [manualRosterOpen, setManualRosterOpen] = useState(false)
  const [manualOpponentRosterText, setManualOpponentRosterText] = useState('')
  const [manualOpponentRosterOpen, setManualOpponentRosterOpen] = useState(false)
  const [builderMode, setBuilderMode] = useState<BuilderMode>('manual')
  const [expandedTeamSlotId, setExpandedTeamSlotId] = useState('')
  const [matchSetupOpen, setMatchSetupOpen] = useState(
    () => !(initialTeamName && initialOpponentTeam && initialMatchDate)
  )
  const didAutoCollapseMatchSetupRef = useRef(false)

  const [availabilityOnly, setAvailabilityOnly] = useState(initialContext.availabilityOnly)
  const [hideUnavailable, setHideUnavailable] = useState(false)
  const replacementHandoff = useMemo(
    () => initialContext.replacePlayer && initialContext.replacementPlayer && initialContext.replacementCourt
      ? {
          outPlayer: initialContext.replacePlayer,
          replacementPlayer: initialContext.replacementPlayer,
          replacementPlayerId: initialContext.replacementPlayerId,
          courtLabel: initialContext.replacementCourt,
        }
      : null,
    [
      initialContext.replacePlayer,
      initialContext.replacementCourt,
      initialContext.replacementPlayer,
      initialContext.replacementPlayerId,
    ]
  )
  const backupHandoff = useMemo(
    () => initialContext.mode === 'backup' && initialContext.replacePlayer && initialContext.replacementCourt
      ? { playerName: initialContext.replacePlayer, courtLabel: initialContext.replacementCourt }
      : null,
    [initialContext.mode, initialContext.replacePlayer, initialContext.replacementCourt],
  )
  const [teamSlots, setTeamSlots] = useState<LineupSlot[]>(() =>
    normalizeSavedSlots(persistedBuilderDraft?.teamSlots).length
      ? normalizeSavedSlots(persistedBuilderDraft?.teamSlots)
      : buildCaptainLineupSlots(initialLeagueName, initialFlight, 'team', initialMatchFormat)
  )
  const teamSlotsRef = useRef(teamSlots)
  const [opponentSlots, setOpponentSlots] = useState<LineupSlot[]>(() =>
    normalizeSavedSlots(persistedBuilderDraft?.opponentSlots).length
      ? normalizeSavedSlots(persistedBuilderDraft?.opponentSlots)
      : buildCaptainLineupSlots(initialLeagueName, initialFlight, 'opponent', initialMatchFormat)
  )
  const [opponentCourtSetupPromptOpen, setOpponentCourtSetupPromptOpen] = useState(false)
  const [mobileForecastOpen, setMobileForecastOpen] = useState(false)
  const [activeLineupFormatKey, setActiveLineupFormatKey] = useState(() =>
    getCaptainLineupFormatKey(initialLeagueName, initialFlight, initialMatchFormat)
  )
  const [lockedSlotIds, setLockedSlotIds] = useState<string[]>([])
  const [lockedPlayerIds, setLockedPlayerIds] = useState<string[]>([])
  const [releasedConfirmedPlayerIds, setReleasedConfirmedPlayerIds] = useState<string[]>([])

  const [prefillScenarioId] = useState(initialContext.scenario)
  const [prefillPairIds] = useState<string[]>(initialContext.pairIds)
  const [prefillSingleId] = useState(initialContext.singleId)
  const [prefillApplied, setPrefillApplied] = useState(false)
  const [scopedResumeResolved, setScopedResumeResolved] = useState(false)
  const scopedResumeAppliedRef = useRef(false)
  const savedLineupRestoreAppliedRef = useRef(false)
  const backupFocusHandledRef = useRef(false)
  const lastReplyRefreshRef = useRef(0)
  const futureJwtRefreshAttemptedRef = useRef(0)
  const localBuilderDraftRestoredRef = useRef(Boolean(persistedBuilderDraft))
  const localBuilderDraftWriteReadyRef = useRef(Boolean(persistedBuilderDraft))

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])
  const isCaptainAccess = access.canUseCaptainWorkflow
  const isPreviewMode = role === 'member'
  const storedTiqLeagueFormat = useMemo(() => {
    const normalizedLeague = normalizeTeamName(leagueName)
    const normalizedFlight = normalizeTeamName(flight)
    return tiqTeamLeagueFormats.find((record) =>
      normalizeTeamName(record.league_name || '') === normalizedLeague &&
      (!normalizedFlight || !record.flight || normalizeTeamName(record.flight) === normalizedFlight)
    ) || null
  }, [flight, leagueName, tiqTeamLeagueFormats])
  // A TiQ League Coordinator can explicitly configure a TiQ league's court
  // format. That configuration must never replace the format supplied by a
  // connected USTA league such as Tri-Level, Mixed, or Combo.
  const isTiqLeagueContext = competitionLayer === 'tiq'
  const storedTiqMatchFormatId = isTiqLeagueContext
    ? storedTiqLeagueFormat?.team_match_format_id || ''
    : ''
  const effectiveMatchFormatId = selectedMatchFormatId === 'auto'
    ? storedTiqMatchFormatId || 'auto'
    : selectedMatchFormatId
  const resolvedMatchFormat = useMemo(
    () => resolveTeamMatchFormat({ leagueName, flight, explicitFormatId: effectiveMatchFormatId }),
    [effectiveMatchFormatId, flight, leagueName]
  )
  const competitionRules = useMemo(
    () => resolveTeamCompetitionRules({
      leagueName,
      flight,
      explicitFormatId: effectiveMatchFormatId,
      competitionLayer,
      rulesOverride: isTiqLeagueContext
        ? normalizeTeamCompetitionRulesOverride(storedTiqLeagueFormat?.competition_rules)
        : undefined,
    }),
    [competitionLayer, effectiveMatchFormatId, flight, isTiqLeagueContext, leagueName, storedTiqLeagueFormat?.competition_rules],
  )
  const matchFormatSummary = useMemo(() => getTeamMatchFormatSummary(resolvedMatchFormat), [resolvedMatchFormat])
  const triLevelRatings = useMemo(() => getTriLevelRatings(leagueName, flight), [flight, leagueName])
  const isTriLevel = resolvedMatchFormat.id === 'tri_level' || resolvedMatchFormat.id === 'mixed_tri_level'
  const isFixedLineupFormat = resolvedMatchFormat.id !== 'custom' && resolvedMatchFormat.inferredBy !== 'default'
  const lineupFormatKey = useMemo(
    () => getCaptainLineupFormatKey(leagueName, flight, effectiveMatchFormatId),
    [effectiveMatchFormatId, flight, leagueName]
  )
  const currentBuilderDraft = useMemo<CaptainLineupBuilderDraft>(() => ({
    competitionLayer,
    leagueName,
    flight,
    teamName,
    opponentTeam,
    matchDate,
    selectedMatchId,
    matchFormat: selectedMatchFormatId,
    scenarioId: currentScenarioId,
    scenarioName,
    notes,
    teamSlots: cloneSlots(teamSlots),
    opponentSlots: cloneSlots(opponentSlots),
    manualRosterEntries: manualRosterPlayers.slice(-80).map((player) => ({
      name: player.name,
      teamName: player.manualTeamName,
      leagueName: player.manualLeagueName,
      flight: player.manualFlight,
    })),
  }), [
    competitionLayer,
    currentScenarioId,
    flight,
    leagueName,
    matchDate,
    manualRosterPlayers,
    notes,
    opponentSlots,
    opponentTeam,
    scenarioName,
    selectedMatchFormatId,
    selectedMatchId,
    teamName,
    teamSlots,
  ])
  const backupFocusSlot = useMemo(() => {
    if (!backupHandoff) return null
    const courtKey = normalizeTeamName(backupHandoff.courtLabel)
    return teamSlots.find((slot) => normalizeTeamName(slot.label) === courtKey) || null
  }, [backupHandoff, teamSlots])
  const backupSelectionDraft = useMemo(() => {
    if (!backupHandoff || !suggestedSwapDraft) return null
    return normalizeTeamName(suggestedSwapDraft.courtLabel) === normalizeTeamName(backupHandoff.courtLabel)
      && normalizeTeamName(suggestedSwapDraft.outgoingPlayerName) === normalizeTeamName(backupHandoff.playerName)
      ? suggestedSwapDraft
      : null
  }, [backupHandoff, suggestedSwapDraft])

  useEffect(() => {
    if (lineupFormatKey === activeLineupFormatKey) return

    setTeamSlots(buildCaptainLineupSlots(leagueName, flight, 'team', effectiveMatchFormatId))
    setOpponentSlots(buildCaptainLineupSlots(leagueName, flight, 'opponent', effectiveMatchFormatId))
    setActiveLineupFormatKey(lineupFormatKey)
    setLockedSlotIds([])
    setLockedPlayerIds([])
    setReleasedConfirmedPlayerIds([])
    setAppliedLineupNotice(null)
    setSuggestedSwapDraft(null)
    setSavedLineupChangeDelivery(null)

    setMessage(`${resolvedMatchFormat.label} set: ${matchFormatSummary.courts} court${matchFormatSummary.courts === 1 ? '' : 's'}.`)
  }, [activeLineupFormatKey, effectiveMatchFormatId, flight, leagueName, lineupFormatKey, matchFormatSummary.courts, resolvedMatchFormat.label])

  useEffect(() => {
    if (!authResolved || !userId || typeof window === 'undefined' || localBuilderDraftRestoredRef.current) return

    if (initialContext.hasExplicitRouteScope) {
      localBuilderDraftRestoredRef.current = true
      return
    }

    const storedDraft = readCaptainLineupBuilderDraft(
      window.localStorage.getItem(getCaptainLineupDraftStorageKey(userId))
    )
    localBuilderDraftRestoredRef.current = true
    if (!storedDraft) return

    localBuilderDraftWriteReadyRef.current = false
    const restoredTeamSlots = normalizeSavedSlots(storedDraft.teamSlots)
    const restoredOpponentSlots = normalizeSavedSlots(storedDraft.opponentSlots)
    const restoredMatchFormat = storedDraft.matchFormat === 'auto'
      ? 'auto'
      : normalizeTeamMatchFormatId(storedDraft.matchFormat)

    setCompetitionLayer(storedDraft.competitionLayer)
    setLeagueName(storedDraft.leagueName)
    setFlight(storedDraft.flight)
    setTeamName(storedDraft.teamName)
    setOpponentTeam(storedDraft.opponentTeam)
    setMatchDate(storedDraft.matchDate)
    setSelectedMatchId(storedDraft.selectedMatchId)
    setSelectedMatchFormatId(restoredMatchFormat)
    setCurrentScenarioId(storedDraft.scenarioId)
    setScenarioName(storedDraft.scenarioName)
    setNotes(storedDraft.notes)
    const restoredManualRosterPlayers = restoreManualRosterPlayers(storedDraft)
    if (restoredManualRosterPlayers.length) {
      setManualRosterPlayers((current) => {
        const currentIds = new Set(current.map((player) => player.id))
        return [...current, ...restoredManualRosterPlayers.filter((player) => !currentIds.has(player.id))]
      })
    }
    if (restoredTeamSlots.length) setTeamSlots(restoredTeamSlots)
    if (restoredOpponentSlots.length) setOpponentSlots(restoredOpponentSlots)
    setActiveLineupFormatKey(getCaptainLineupFormatKey(
      storedDraft.leagueName,
      storedDraft.flight,
      restoredMatchFormat,
    ))
    setMessage('Draft restored on this device.')
  }, [authResolved, initialContext.hasExplicitRouteScope, userId])

  useEffect(() => {
    if (!authResolved || !userId || typeof window === 'undefined' || !localBuilderDraftRestoredRef.current) return
    if (!localBuilderDraftWriteReadyRef.current) {
      localBuilderDraftWriteReadyRef.current = true
      return
    }

    window.localStorage.setItem(getCaptainLineupDraftStorageKey(userId), JSON.stringify({
      ...currentBuilderDraft,
      updatedAt: new Date().toISOString(),
    }))
  }, [authResolved, currentBuilderDraft, userId])

  useEffect(() => {
    if (loading || !backupFocusSlot || backupFocusHandledRef.current) return
    backupFocusHandledRef.current = true
    window.requestAnimationFrame(() => {
      document.getElementById(`captain-lineup-slot-${backupFocusSlot.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }, [backupFocusSlot, loading])

  useEffect(() => {
    if (!appliedLineupNotice) return

    window.requestAnimationFrame(() => {
      document.getElementById('captain-lineup-applied-next')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }, [appliedLineupNotice])

  useEffect(() => {
    if (!authResolved || role !== 'public') return
    router.replace('/login?plan=captain&next=%2Fcaptain%2Flineup-builder')
  }, [authResolved, role, router])

  useEffect(() => {
    if (!authResolved || scopedResumeAppliedRef.current) return
    if (initialContext.hasExplicitRouteScope) {
      scopedResumeAppliedRef.current = true
      setScopedResumeResolved(true)
      return
    }
    if (localBuilderDraftRestoredRef.current) {
      scopedResumeAppliedRef.current = true
      setScopedResumeResolved(true)
      return
    }
    if (!userId || !session?.access_token) {
      scopedResumeAppliedRef.current = true
      setScopedResumeResolved(true)
      return
    }
    scopedResumeAppliedRef.current = true

    let active = true
    void (async () => {
      const localState = readCaptainResumeState(userId)
      const cloudState = await loadCaptainResumeStateFromCloud(session.access_token)
      const resumeState = chooseLatestCaptainResumeState(localState, cloudState)
      if (!active || !resumeState) return

      setCompetitionLayer(resumeState.competitionLayer || '')
      setTeamName(resumeState.team || '')
      setLeagueName(resumeState.league || '')
      setFlight(resumeState.flight || '')
      setPrefillApplied(false)
    })().finally(() => {
      if (active) setScopedResumeResolved(true)
    })

    return () => { active = false }
  }, [authResolved, initialContext.hasExplicitRouteScope, session?.access_token, userId])

  useEffect(() => {
    if (!scopedResumeResolved || (!teamName && !leagueName && !flight)) return

    const scenarioId = currentScenarioId || prefillScenarioId || undefined
    const matchId = selectedMatchId || initialContext.matchId || undefined
    const lineupCount = teamSlots.filter((slot) => slot.players.some((player) => player.playerId)).length
    const weekStatus = readCaptainWeekStatus({
      team: teamName,
      league: leagueName,
      flight,
      eventDate: matchDate,
      opponentTeam,
    })?.status
    const lastHref = buildCaptainScopedHref('/captain/lineup-builder', {
      competitionLayer: competitionLayer || undefined,
      team: teamName,
      league: leagueName,
      flight,
      date: matchDate || undefined,
      opponent: opponentTeam || undefined,
      matchId,
      scenarioId,
    })
    void syncCaptainResumeState({
      competitionLayer: competitionLayer || undefined,
      team: teamName,
      league: leagueName,
      flight,
      lastTool: 'lineup-builder',
      lastToolLabel: 'Lineup Builder',
      eventDate: matchDate || undefined,
      opponentTeam: opponentTeam || undefined,
      matchId,
      scenarioId,
      weekStatus,
      lineupCount,
      lastHref,
    }, userId, session?.access_token)
  }, [competitionLayer, currentScenarioId, flight, initialContext.matchId, leagueName, matchDate, opponentTeam, prefillScenarioId, scopedResumeResolved, selectedMatchId, session?.access_token, teamName, teamSlots, userId])

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

  const applyBuilderPayload = useCallback((result: LineupBuilderPayload) => {
    const nextMatches = result.matches ?? []
    const nextMatchPlayers = result.matchPlayers ?? []
    setPlayers(result.players ?? [])
    setMatches(nextMatches)
    setMatchPlayers(nextMatchPlayers)
    setHistoricalLineMatches(result.historicalLineMatches ?? [])
    setHistoricalLineMatchPlayers(result.historicalLineMatchPlayers ?? [])
    setRosterMembers(result.rosterMembers ?? [])
    setTeamRosterPlayers(result.players ?? [])
    setAvailability(result.availability ?? [])
    setCaptainRosterContacts(result.captainRosterContacts ?? [])
    setCaptainMessageContacts(result.captainMessageContacts ?? [])
    setSavedScenarios(result.savedScenarios ?? [])
    setTiqTeamLeagueFormats(result.tiqTeamLeagueFormats ?? [])

    const sideByMatchId = new Map<string, 'A' | 'B'>()
    const normalizedTeam = normalizeTeamName(teamName)
    for (const match of nextMatches) {
      if (normalizeTeamName(match.home_team) === normalizedTeam) sideByMatchId.set(match.id, 'A')
      else if (normalizeTeamName(match.away_team) === normalizedTeam) sideByMatchId.set(match.id, 'B')
    }
    const scopedIds = new Set<string>()
    for (const row of nextMatchPlayers) {
      if (row.player_id && sideByMatchId.get(row.match_id) === row.side) scopedIds.add(row.player_id)
    }
    setScopedRosterPlayerIds([...scopedIds])
  }, [teamName])

  const refreshBuilderData = useCallback(async (quiet = false) => {
    if (!quiet) {
      setError('')
      setMessage('')
    }
    const accessToken = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token
    if (!accessToken) {
      setLoading(false)
      setError('Sign in to load your Captain lineup.')
      return false
    }

    const params = new URLSearchParams()
    if (teamName) params.set('team', teamName)
    if (leagueName) params.set('league', leagueName)
    if (flight) params.set('flight', flight)
    if (opponentTeam) params.set('opponent', opponentTeam)

    const snapshotScope = [normalizeTeamName(teamName), normalizeTeamName(leagueName), normalizeTeamName(flight), normalizeTeamName(opponentTeam)].join('__')
    const snapshot = readPrivateClientSnapshot<LineupBuilderPayload>({
      namespace: 'captain-lineup',
      userId,
      scope: snapshotScope,
      maxAgeMs: CAPTAIN_LINEUP_SNAPSHOT_MAX_AGE_MS,
      allowStale: true,
    })
    if (snapshot) {
      applyBuilderPayload(snapshot.value)
      setLoading(false)
      if (snapshot.stale && !quiet) setMessage('Showing your saved lineup while live team data refreshes.')
    } else {
      setLoading(true)
    }

    let response: Response
    let result: LineupBuilderPayload
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), CAPTAIN_LINEUP_REQUEST_TIMEOUT_MS)
    try {
      response = await fetch(`/api/captain/lineup-builder?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal: controller.signal,
      })
      result = await response.json() as typeof result
    } catch {
      setLoading(false)
      if (snapshot) {
        if (!quiet) setMessage('Showing your saved lineup while live team data reconnects.')
      } else {
        setError('Your lineup data could not be reached. Please try again.')
      }
      return false
    } finally {
      window.clearTimeout(timeout)
    }

    const primaryError = !response.ok ? result.message || 'Your lineup data could not be loaded.' : ''
    if (primaryError && isFutureJwtError(primaryError)) {
      // Keep the existing lineup context intact while the newly-issued token
      // settles. The observed mobile window is longer than a single paint, so
      // do not expose an empty-roster/setup state between attempts.
      futureJwtRefreshAttemptedRef.current += 1
      setRecoveringSecureSession(true)
      setMessage('Securing your team data…')

      if (futureJwtRefreshAttemptedRef.current <= MAX_FUTURE_JWT_RECOVERY_ATTEMPTS) {
        await supabase.auth.refreshSession()
        window.setTimeout(() => setRefreshTick((current) => current + 1), FUTURE_JWT_SETTLE_DELAY_MS)
        return false
      }

      setError('Your secure session is still reconnecting. Your saved team and lineup have been kept in place.')
      setLoading(false)
      return false
    }

    if (primaryError) {
      futureJwtRefreshAttemptedRef.current = 0
      setRecoveringSecureSession(false)
      if (!quiet || !snapshot) setError(primaryError)
    } else {
      futureJwtRefreshAttemptedRef.current = 0
      setRecoveringSecureSession(false)
      applyBuilderPayload(result)
      writePrivateClientSnapshot({
        namespace: 'captain-lineup',
        userId,
        scope: snapshotScope,
        value: result,
      })
    }

    setLoading(false)
    return !primaryError
  }, [applyBuilderPayload, flight, leagueName, opponentTeam, session?.access_token, teamName, userId])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    void refreshBuilderData()
  }, [authResolved, role, refreshTick, refreshBuilderData])

  const refreshAvailabilityReplies = useCallback(async (quiet = false) => {
    if (refreshingReplies) return
    setRefreshingReplies(true)
    if (!quiet) setMessage('Refreshing player replies...')
    const loaded = await refreshBuilderData(quiet)
    if (loaded && !quiet) setMessage('Player replies are up to date.')
    setRefreshingReplies(false)
  }, [refreshBuilderData, refreshingReplies])

  useEffect(() => {
    if (!authResolved || role === 'public' || typeof window === 'undefined') return

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - lastReplyRefreshRef.current < 5000) return
      lastReplyRefreshRef.current = now
      void refreshAvailabilityReplies(true)
    }

    window.addEventListener('focus', refreshWhenVisible)
    window.addEventListener('pageshow', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      window.removeEventListener('pageshow', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [authResolved, refreshAvailabilityReplies, role])

  const leagueOptions = useMemo(
    () =>
      uniqueSorted([
        ...matches.map((row) => row.league_name),
        ...rosterMembers.map((row) => row.league_name),
        ...availability.map((row) => row.league_name),
        ...savedScenarios.map((row) => row.league_name),
      ]),
    [availability, matches, rosterMembers, savedScenarios]
  )

  const flightOptions = useMemo(
    () =>
      uniqueSorted([
        ...matches.map((row) => row.flight),
        ...rosterMembers.map((row) => row.flight),
        ...availability.map((row) => row.flight),
        ...players.map((row) => row.flight),
        ...savedScenarios.map((row) => row.flight),
      ]),
    [availability, matches, players, rosterMembers, savedScenarios]
  )

  const teamOptions = useMemo(
    () =>
      uniqueSorted([
        ...rosterMembers.map((row) => row.team_name),
        ...availability.map((row) => row.team_name),
        ...savedScenarios.map((row) => row.team_name),
        ...matches.flatMap((row) => [row.home_team, row.away_team]),
      ]),
    [availability, matches, rosterMembers, savedScenarios]
  )

  const scopedMatchOptions = useMemo(() => {
    return matches.filter((match) => isSameScope(match, {
      leagueName: teamName ? '' : leagueName,
      flight: teamName ? '' : flight,
      teamName,
    }))
  }, [flight, leagueName, matches, teamName])

  const selectedMatch = useMemo(() => {
    return scopedMatchOptions.find((match) => match.id === selectedMatchId) ?? null
  }, [scopedMatchOptions, selectedMatchId])
  const selectedFormatLeagueName = selectedMatch?.league_name || leagueName
  const selectedFormatFlight = selectedMatch?.flight || flight

  useEffect(() => {
    if (!teamName || !scopedMatchOptions.length) return
    if (selectedMatchId && scopedMatchOptions.some((match) => match.id === selectedMatchId)) return

    const requestedMatch =
      scopedMatchOptions.find((match) => {
        if (matchDate && match.match_date !== matchDate) return false
        if (opponentTeam && getOpponentForTeam(match, teamName) !== opponentTeam) return false
        return Boolean(matchDate || opponentTeam)
      }) ?? null

    if (requestedMatch) {
      setSelectedMatchId(requestedMatch.id)
      return
    }

    const now = new Date()
    const nextMatch =
      scopedMatchOptions
        .filter((match) => match.match_date && new Date(match.match_date).getTime() >= now.getTime() - 86400000)
        .sort((a, b) => new Date(a.match_date || '').getTime() - new Date(b.match_date || '').getTime())[0] ??
      scopedMatchOptions[0]

    if (nextMatch) setSelectedMatchId(nextMatch.id)
  }, [matchDate, opponentTeam, scopedMatchOptions, selectedMatchId, teamName])

  useEffect(() => {
    if (!selectedMatch || !teamName) return
    const opponent = getOpponentForTeam(selectedMatch, teamName)
    if (opponent) setOpponentTeam(opponent)
    if (selectedMatch.match_date) setMatchDate(selectedMatch.match_date)
    if (selectedMatch.league_name && selectedMatch.league_name !== leagueName) {
      setLeagueName(selectedMatch.league_name)
    }
    if (selectedMatch.flight && selectedMatch.flight !== flight) {
      setFlight(selectedMatch.flight)
    }
  }, [flight, leagueName, selectedMatch, teamName])

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
      return dateMatch && teamMatch && leagueMatch
    })
  }, [availability, matchDate, teamName, leagueName])

  const availabilityMap = useMemo(() => {
    const map = new Map<string, { status: string | null; notes: string | null }>()
    for (const row of availabilityForSelection) {
      map.set(row.player_id, { status: row.status, notes: row.notes })
    }
    return map
  }, [availabilityForSelection])
  const openedCourtTextKeySet = useMemo(() => new Set(openedCourtTextKeys), [openedCourtTextKeys])
  const hasPendingCourtReplies = useMemo(() => Object.values(preparedCourtTexts).some((preparedText) => (
    openedCourtTextKeySet.has(preparedText.key) &&
    availabilityLabel(availabilityMap.get(preparedText.playerId)?.status) === 'No response'
  )), [availabilityMap, openedCourtTextKeySet, preparedCourtTexts])

  useEffect(() => {
    setPreparedCourtTexts({})
    setOpenedCourtTextKeys([])
    preparingCourtTextKeysRef.current.clear()
  }, [flight, leagueName, matchDate, teamName])

  useEffect(() => {
    teamSlotsRef.current = teamSlots
  }, [teamSlots])

  useEffect(() => {
    if (!hasPendingCourtReplies || !authResolved || role === 'public' || typeof window === 'undefined') return

    const refreshPendingReplies = () => {
      if (document.visibilityState === 'hidden') return
      void refreshAvailabilityReplies(true)
    }
    const interval = window.setInterval(refreshPendingReplies, 20_000)
    return () => window.clearInterval(interval)
  }, [authResolved, hasPendingCourtReplies, refreshAvailabilityReplies, role])

  const teamRoomReplyCounts = useMemo(() => {
    if (initialContext.source !== 'team_room') return null
    let yes = 0
    let maybe = 0
    let no = 0
    for (const row of availabilityForSelection) {
      const status = (row.status || '').trim().toLowerCase()
      if (status === 'available' || status === 'yes' || status === 'in') yes += 1
      else if (status === 'maybe' || status === 'limited') maybe += 1
      else if (status === 'unavailable' || status === 'no' || status === 'out') no += 1
    }
    return { yes, maybe, no, total: yes + maybe + no }
  }, [availabilityForSelection, initialContext.source])

  const rosterBackedPlayers = useMemo(() => {
    const playersById = new Map(players.map((player) => [player.id, player]))
    for (const player of teamRosterPlayers) playersById.set(player.id, player)
    return Array.from(playersById.values())
  }, [players, teamRosterPlayers])

  const availablePlayerPool = useMemo<PoolPlayer[]>(() => {
    return rosterBackedPlayers
      .map((player) => {
        const availabilityEntry = availabilityMap.get(player.id)
        return {
          ...player,
          availabilityStatus: availabilityEntry?.status ?? null,
          availabilityNotes: availabilityEntry?.notes ?? null,
        }
      })
      .filter((player) => {
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
  }, [rosterBackedPlayers, availabilityMap, availabilityOnly, availabilityForSelection.length, hideUnavailable])

  const myRosterPlayerIds = useMemo(() => {
    const ids = buildRosterPlayerIdSet(teamName, matches, matchPlayers, availability, rosterMembers)
    for (const playerId of scopedRosterPlayerIds) ids.add(playerId)
    return ids
  }, [teamName, matches, matchPlayers, availability, rosterMembers, scopedRosterPlayerIds])

  const opponentRosterPlayerIds = useMemo(
    () => buildRosterPlayerIdSet(opponentTeam, historicalLineMatches, historicalLineMatchPlayers, [], []),
    [historicalLineMatchPlayers, historicalLineMatches, opponentTeam]
  )

  const myRosterEligibilityByPlayerId = useMemo(
    () => buildRosterEligibilityByPlayerId(teamName, rosterMembers),
    [rosterMembers, teamName],
  )

  const opponentRosterEligibilityByPlayerId = useMemo(
    () => buildRosterEligibilityByPlayerId(opponentTeam, rosterMembers),
    [opponentTeam, rosterMembers],
  )

  const scopedManualRosterPlayers = useMemo(
    () => manualRosterPlayers.filter((player) =>
      normalizeTeamName(player.manualTeamName) === normalizeTeamName(teamName) &&
      player.manualLeagueName === leagueName &&
      player.manualFlight === flight
    ),
    [flight, leagueName, manualRosterPlayers, teamName]
  )
  const scopedManualOpponentRosterPlayers = useMemo(
    () => manualRosterPlayers.filter((player) =>
      normalizeTeamName(player.manualTeamName) === normalizeTeamName(opponentTeam) &&
      player.manualLeagueName === leagueName &&
      player.manualFlight === flight
    ),
    [flight, leagueName, manualRosterPlayers, opponentTeam]
  )

  const myPlayerPool = useMemo<PoolPlayer[]>(() => {
    const importedRoster = filterPlayerPoolByRoster(availablePlayerPool, myRosterPlayerIds, myRosterEligibilityByPlayerId)
    const importedIds = new Set(importedRoster.map((player) => player.id))
    const manualRoster = scopedManualRosterPlayers
      .filter((player) => !importedIds.has(player.id))
      .map((player) => ({
        ...player,
        availabilityStatus: null,
        availabilityNotes: null,
      }))
    return [...importedRoster, ...manualRoster]
  }, [availablePlayerPool, myRosterEligibilityByPlayerId, myRosterPlayerIds, scopedManualRosterPlayers])

  const captainRosterContactsForTeam = useMemo(
    () => selectCaptainContactRowsForScope({
      rows: captainRosterContacts,
      team: teamName,
      league: leagueName,
      flight,
    }),
    [captainRosterContacts, flight, leagueName, teamName],
  )
  const directTextContactByName = useMemo(() => {
    const directContacts = new Map<string, { phone: string }>()
    for (const contact of captainRosterContactsForTeam) {
      const key = normalizeCaptainRosterContactKey(contact.full_name)
      if (key && contact.phone?.trim()) directContacts.set(key, { phone: contact.phone.trim() })
    }
    for (const contact of selectCaptainContactRowsForScope({
      rows: captainMessageContacts,
      team: teamName,
      league: leagueName,
      flight,
    })) {
      const key = normalizeCaptainRosterContactKey(contact.full_name)
      if (key && contact.phone?.trim() && contact.opt_in_text !== false && !directContacts.has(key)) {
        directContacts.set(key, { phone: contact.phone.trim() })
      }
    }
    return directContacts
  }, [captainMessageContacts, captainRosterContactsForTeam, flight, leagueName, teamName])
  const nextDirectCourtTextPlayer = useMemo(() => {
    if (!directCourtTextHandoff) return null
    return directCourtTextHandoff.players.find((player) =>
      !directCourtTextHandoff.openedPlayerKeys.includes(normalizeCaptainRosterContactKey(player.playerName))
    ) ?? null
  }, [directCourtTextHandoff])
  const hasPreparedDirectCourtText = useMemo(() => {
    if (!directCourtTextHandoff) return false
    return Object.values(preparedCourtTexts).some((preparedText) =>
      normalizeCaptainRosterContactKey(preparedText.playerName) ===
      normalizeCaptainRosterContactKey(directCourtTextHandoff.players[0]?.playerName || ''),
    )
  }, [directCourtTextHandoff, preparedCourtTexts])

  const myAvailabilitySummary = useMemo(() => {
    let confirmed = 0
    let maybe = 0
    let out = 0
    let noResponse = 0
    for (const player of myPlayerPool) {
      const label = availabilityLabel(player.availabilityStatus)
      if (label === 'Confirmed') confirmed += 1
      else if (label === 'Maybe') maybe += 1
      else if (label === 'Out') out += 1
      else noResponse += 1
    }
    return { confirmed, maybe, out, noResponse }
  }, [myPlayerPool])

  const opponentPlayerPool = useMemo<PoolPlayer[]>(() => {
    const importedRoster = filterPlayerPoolByRoster(
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
      opponentRosterPlayerIds,
      opponentRosterEligibilityByPlayerId,
    )
    const importedIds = new Set(importedRoster.map((player) => player.id))
    const manualRoster = scopedManualOpponentRosterPlayers
      .filter((player) => !importedIds.has(player.id))
      .map((player) => ({
        ...player,
        availabilityStatus: null,
        availabilityNotes: null,
      }))
    return [...importedRoster, ...manualRoster]
  }, [opponentRosterEligibilityByPlayerId, opponentRosterPlayerIds, players, scopedManualOpponentRosterPlayers])

  const opponentManualPlayerIdSet = useMemo(
    () => new Set(scopedManualOpponentRosterPlayers.map((player) => player.id)),
    [scopedManualOpponentRosterPlayers],
  )
  const importedOpponentRosterCount = useMemo(
    () => opponentPlayerPool.filter((player) => !opponentManualPlayerIdSet.has(player.id)).length,
    [opponentManualPlayerIdSet, opponentPlayerPool],
  )

  const builderPlayers = useMemo<PlayerRow[]>(() => {
    const enrichedById = new Map<string, PlayerRow>()
    for (const player of players) enrichedById.set(player.id, player)
    for (const player of opponentPlayerPool) enrichedById.set(player.id, player)
    for (const player of myPlayerPool) enrichedById.set(player.id, player)
    for (const player of scopedManualRosterPlayers) enrichedById.set(player.id, player)
    for (const player of scopedManualOpponentRosterPlayers) enrichedById.set(player.id, player)
    return Array.from(enrichedById.values())
  }, [myPlayerPool, opponentPlayerPool, players, scopedManualOpponentRosterPlayers, scopedManualRosterPlayers])

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
  const confirmedAssignedPlayerIdSet = useMemo(() => {
    const ids = new Set<string>()
    for (const slot of teamSlots) {
      for (const player of slot.players) {
        if (!player.playerId) continue
        if (availabilityLabel(availabilityMap.get(player.playerId)?.status) === 'Confirmed') {
          ids.add(player.playerId)
        }
      }
    }
    return ids
  }, [availabilityMap, teamSlots])
  const releasedConfirmedPlayerIdSet = useMemo(
    () => new Set(releasedConfirmedPlayerIds),
    [releasedConfirmedPlayerIds],
  )
  const autoLockedConfirmedPlayerIdSet = useMemo(
    () => new Set([...confirmedAssignedPlayerIdSet].filter((playerId) => !releasedConfirmedPlayerIdSet.has(playerId))),
    [confirmedAssignedPlayerIdSet, releasedConfirmedPlayerIdSet],
  )
  const lockedPlayerIdSet = useMemo(
    () => new Set([...lockedPlayerIds, ...autoLockedConfirmedPlayerIdSet]),
    [autoLockedConfirmedPlayerIdSet, lockedPlayerIds],
  )
  const activePlayerLockCount = lockedPlayerIdSet.size
  const activeLockCount = lockedSlotIds.length + activePlayerLockCount

  useEffect(() => {
    setReleasedConfirmedPlayerIds((current) => {
      const next = current.filter((playerId) => confirmedAssignedPlayerIdSet.has(playerId))
      return next.length === current.length ? current : next
    })
  }, [confirmedAssignedPlayerIdSet])

  const suggestedSwapPlayer = useMemo(() => {
    if (!replacementHandoff) return null
    const replacementName = normalizeTeamName(replacementHandoff.replacementPlayer)
    return myPlayerPool.find((player) =>
      (replacementHandoff.replacementPlayerId && player.id === replacementHandoff.replacementPlayerId)
      || normalizeTeamName(player.name) === replacementName
    ) ?? null
  }, [myPlayerPool, replacementHandoff])

  const suggestedSwapCourt = useMemo(() => {
    if (!replacementHandoff) return null
    const courtName = normalizeTeamName(replacementHandoff.courtLabel)
    const matchingCourts = teamSlots.filter((slot) => normalizeTeamName(slot.label) === courtName)
    return matchingCourts.length === 1 ? matchingCourts[0] : null
  }, [replacementHandoff, teamSlots])

  function applySuggestedSwap() {
    if (!replacementHandoff) return
    if (!suggestedSwapPlayer) {
      setMessage('')
      setError(`${replacementHandoff.replacementPlayer} is not in this team's roster. Refresh the Team Summary before applying the swap.`)
      return
    }

    const result = applyCaptainSuggestedSwap({
      slots: teamSlots,
      courtLabel: replacementHandoff.courtLabel,
      outgoingPlayerName: replacementHandoff.outPlayer,
      replacement: {
        playerId: suggestedSwapPlayer.id,
        playerName: suggestedSwapPlayer.name,
        availabilityStatus: suggestedSwapPlayer.availabilityStatus,
        eligibleForCourt: suggestedSwapCourt ? isPlayerEligibleForSlot(suggestedSwapPlayer, suggestedSwapCourt, competitionRules) : false,
      },
    })

    if (!result.ok) {
      const failureMessages = {
        'court-not-found': `The ${replacementHandoff.courtLabel} court is not in the loaded lineup. Load the saved lineup and try again.`,
        'outgoing-player-not-found': `${replacementHandoff.outPlayer} is no longer assigned to ${replacementHandoff.courtLabel}.`,
        'replacement-already-assigned': `${suggestedSwapPlayer.name} is already assigned to another court.`,
        'replacement-unavailable': `${suggestedSwapPlayer.name} is marked Maybe or Out and cannot replace a confirmed player yet.`,
        'replacement-ineligible': `${suggestedSwapPlayer.name} is not eligible for ${replacementHandoff.courtLabel}.`,
      } satisfies Record<typeof result.reason, string>
      setMessage('')
      setError(failureMessages[result.reason])
      return
    }

    setSuggestedSwapDraft({
      previousSlots: cloneSlots(teamSlots),
      slotId: result.slotId,
      playerIndex: result.playerIndex,
      replacementPlayerId: suggestedSwapPlayer.id,
      outgoingPlayerName: result.outgoingPlayerName,
      replacementPlayerName: result.replacementPlayerName,
      courtLabel: replacementHandoff.courtLabel,
      needsConfirmation: result.needsConfirmation,
    })
    setSavedLineupChangeDelivery(null)
    setTeamSlots(result.slots)
    setError('')
    setMessage(
      `Draft swap applied: ${result.replacementPlayerName} for ${result.outgoingPlayerName} on ${replacementHandoff.courtLabel}. Review it, then save the potential lineup.`
    )
  }

  function undoSuggestedSwap() {
    if (!suggestedSwapDraft) return
    const previousSlot = suggestedSwapDraft.previousSlots.find((slot) => slot.id === suggestedSwapDraft.slotId)
    const previousPlayer = previousSlot?.players[suggestedSwapDraft.playerIndex]
    if (!previousPlayer) return
    const currentPlayer = teamSlots
      .find((slot) => slot.id === suggestedSwapDraft.slotId)
      ?.players[suggestedSwapDraft.playerIndex]
    if (currentPlayer?.playerId !== suggestedSwapDraft.replacementPlayerId) {
      setSuggestedSwapDraft(null)
      setError('')
      setMessage('That court changed after the suggestion was applied, so there is nothing left to undo.')
      return
    }
    setTeamSlots((current) => current.map((slot) => {
      if (slot.id !== suggestedSwapDraft.slotId) return slot
      return {
        ...slot,
        players: slot.players.map((player, index) => (
          index === suggestedSwapDraft.playerIndex && player.playerId === suggestedSwapDraft.replacementPlayerId
            ? { ...previousPlayer }
            : player
        )),
      }
    }))
    setSuggestedSwapDraft(null)
    setError('')
    setMessage('Suggested swap undone. Your saved lineup was never changed.')
  }

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

  const lineupBuilderReturnHref = useMemo(
    () => buildCaptainScopedHref('/captain/lineup-builder', {
      competitionLayer,
      league: leagueName,
      flight,
      team: teamName,
      date: matchDate,
      opponent: opponentTeam,
    }),
    [competitionLayer, flight, leagueName, matchDate, opponentTeam, teamName]
  )

  const teamBriefHref = useMemo(
    () => buildCaptainScopedHref('/captain/team-brief', {
      competitionLayer,
      league: leagueName,
      flight,
      team: teamName,
      date: matchDate,
      opponent: opponentTeam,
    }),
    [competitionLayer, flight, leagueName, matchDate, opponentTeam, teamName]
  )

  const teamContactsHref = useMemo(() => {
    const baseHref = buildCaptainScopedHref('/captain/messaging', {
      competitionLayer,
      league: leagueName,
      flight,
      team: teamName,
      date: matchDate,
      opponent: opponentTeam,
    })
    return `${baseHref}${baseHref.includes('?') ? '&' : '?'}contactView=all#captain-contact-manager`
  }, [competitionLayer, flight, leagueName, matchDate, opponentTeam, teamName])

  const teamRoomHref = useMemo(
    () => buildTeamRoomHref({ teamName, leagueName, flight }),
    [flight, leagueName, teamName],
  )

  const teamSummaryUploadHref = useMemo(
    () => buildTeamSummaryUploadHref({
      teamName,
      leagueName,
      flight,
      returnTo: lineupBuilderReturnHref,
    }),
    [flight, leagueName, lineupBuilderReturnHref, teamName]
  )
  const opponentSummaryUploadHref = useMemo(
    () => buildTeamSummaryUploadHref({
      teamName: opponentTeam,
      leagueName,
      flight,
      returnTo: lineupBuilderReturnHref,
    }),
    [flight, leagueName, lineupBuilderReturnHref, opponentTeam]
  )

  function toggleLockedSlot(slotId: string) {
    setLockedSlotIds((current) =>
      current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId]
    )
  }

  function toggleLockedPlayer(playerId: string) {
    if (!playerId) return
    if (confirmedAssignedPlayerIdSet.has(playerId)) {
      setReleasedConfirmedPlayerIds((current) =>
        current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
      )
      return
    }
    const willLock = !lockedPlayerIdSet.has(playerId)
    setLockedPlayerIds((current) => willLock ? [...current, playerId] : current.filter((id) => id !== playerId))
    if (willLock) void markLockedPlayerAvailable(playerId)
  }

  async function markLockedPlayerAvailable(playerId: string) {
    if (!teamName || !matchDate) {
      setError('Choose the team and match before marking a player available.')
      return
    }

    const previousAvailability = availability
    const optimisticRow: AvailabilityRow = {
      id: availabilityMap.get(playerId) ? `captain-confirmed:${playerId}` : `captain-confirmed:${Date.now()}:${playerId}`,
      match_date: matchDate,
      team_name: teamName,
      league_name: leagueName || null,
      flight: flight || null,
      player_id: playerId,
      status: 'available',
      notes: 'Confirmed by captain from Lineup Builder.',
    }
    setAvailability((current) => [
      ...current.filter((row) => !(row.match_date === matchDate && row.team_name === teamName && row.player_id === playerId)),
      optimisticRow,
    ])

    try {
      const accessToken = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token
      if (!accessToken) throw new Error('Sign in again before marking a player available.')
      const response = await fetch('/api/captain/lineup-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ teamName, leagueName, flight, matchDate, playerId }),
      })
      const result = await response.json() as { ok?: boolean; message?: string; availability?: AvailabilityRow }
      if (!response.ok || !result.ok || !result.availability) throw new Error(result.message || 'Availability could not be saved.')
      setAvailability((current) => [
        ...current.filter((row) => !(row.match_date === matchDate && row.team_name === teamName && row.player_id === playerId)),
        result.availability as AvailabilityRow,
      ])
      setMessage('Player marked Yes and protected in this lineup.')
      setError('')
    } catch (caught) {
      setAvailability(previousAvailability)
      setError(caught instanceof Error ? caught.message : 'Availability could not be saved.')
    }
  }

  function clearLocks() {
    setLockedSlotIds([])
    setLockedPlayerIds([])
    setReleasedConfirmedPlayerIds([])
  }

  function getPlayerById(playerId: string) {
    return builderPlayers.find((player) => player.id === playerId) ?? null
  }

  function addManualRosterPlayers() {
    if (!teamName.trim()) {
      setError('Choose your team before entering roster players.')
      return
    }

    const enteredNames = uniqueSorted(
      manualRosterText
        .split(/\r?\n|;/)
        .map((name) => cleanText(name))
        .filter(Boolean)
    )
    const seenNames = new Set<string>()
    const names = enteredNames.filter((name) => {
      const key = normalizeTeamName(name)
      if (!key || seenNames.has(key)) return false
      seenNames.add(key)
      return true
    })

    if (!names.length) {
      setError('Enter at least one player name, one player per line.')
      return
    }

    const existingNames = new Set(myPlayerPool.map((player) => normalizeTeamName(player.name)))
    const newPlayers = names
      .filter((name) => !existingNames.has(normalizeTeamName(name)))
      .map((name) => createManualRosterPlayer(name, { teamName, leagueName, flight }))

    if (!newPlayers.length) {
      setError('Those players are already in this lineup roster.')
      return
    }

    setManualRosterPlayers((current) => [...current, ...newPlayers])
    setManualRosterText('')
    setManualRosterOpen(false)
    setError('')
    setMessage(`${newPlayers.length} player${newPlayers.length === 1 ? '' : 's'} added for this lineup. Upload the Team Summary for ratings, then add Player Roster later if you want team contacts.`)
  }

  function addManualOpponentRosterPlayers() {
    if (!opponentTeam.trim()) {
      setError('Choose an opponent before entering their players.')
      return
    }

    const enteredNames = uniqueSorted(
      manualOpponentRosterText
        .split(/\r?\n|;/)
        .map((name) => cleanText(name))
        .filter(Boolean)
    )
    const seenNames = new Set<string>()
    const names = enteredNames.filter((name) => {
      const key = normalizeTeamName(name)
      if (!key || seenNames.has(key)) return false
      seenNames.add(key)
      return true
    })

    if (!names.length) {
      setError('Enter at least one opponent name, one player per line.')
      return
    }

    const existingNames = new Set(opponentPlayerPool.map((player) => normalizeTeamName(player.name)))
    const newPlayers = names
      .filter((name) => !existingNames.has(normalizeTeamName(name)))
      .map((name) => createManualRosterPlayer(name, { teamName: opponentTeam, leagueName, flight }))

    if (!newPlayers.length) {
      setError('Those opponents are already available in this matchup.')
      return
    }

    setManualRosterPlayers((current) => [...current, ...newPlayers])
    setManualOpponentRosterText('')
    setManualOpponentRosterOpen(false)
    setError('')
    setMessage(`${newPlayers.length} opponent${newPlayers.length === 1 ? '' : 's'} added for this matchup. Upload their TennisLink Team Summary later to connect TiQ ratings.`)
  }

  function openOpponentCourts() {
    setBuilderMode('insights')
    setOpponentCourtSetupPromptOpen(true)
    window.requestAnimationFrame(() => {
      document.getElementById('opponent-lineup')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function openMatchForecast() {
    setBuilderMode('insights')
    setMobileForecastOpen(true)
    window.requestAnimationFrame(() => {
      document.getElementById('captain-lineup-match-forecast')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function setSlotPlayer(
    side: 'team' | 'opponent',
    slotId: string,
    playerIndex: number,
    playerId: string
  ) {
    if (side === 'team' && backupHandoff) {
      const sourceSlots = backupSelectionDraft?.previousSlots ?? teamSlots
      const sourceSlot = sourceSlots.find((slot) => slot.id === slotId)
      const outgoingIndex = sourceSlot?.players.findIndex((player) =>
        normalizeTeamName(player.playerName) === normalizeTeamName(backupHandoff.playerName)
      ) ?? -1
      const targetsBackup = sourceSlot
        && normalizeTeamName(sourceSlot.label) === normalizeTeamName(backupHandoff.courtLabel)
        && outgoingIndex === playerIndex

      if (targetsBackup) {
        if (!playerId) {
          setTeamSlots(cloneSlots(sourceSlots))
          setSuggestedSwapDraft(null)
          setSavedLineupChangeDelivery(null)
          setError('')
          setMessage('Backup cleared. Choose an available player for this court.')
          return
        }

        const replacement = myPlayerPool.find((player) => player.id === playerId) ?? null
        const result = replacement
          ? applyCaptainSuggestedSwap({
              slots: sourceSlots,
              courtLabel: backupHandoff.courtLabel,
              outgoingPlayerName: backupHandoff.playerName,
              replacement: {
                playerId: replacement.id,
                playerName: replacement.name,
                availabilityStatus: replacement.availabilityStatus,
                eligibleForCourt: isPlayerEligibleForSlot(replacement, sourceSlot, competitionRules),
              },
            })
          : null

        if (!result?.ok) {
          setError('Choose an available, eligible player who is not already assigned.')
          setMessage('')
          return
        }

        setSuggestedSwapDraft({
          previousSlots: cloneSlots(sourceSlots),
          slotId: result.slotId,
          playerIndex: result.playerIndex,
          replacementPlayerId: playerId,
          outgoingPlayerName: result.outgoingPlayerName,
          replacementPlayerName: result.replacementPlayerName,
          courtLabel: backupHandoff.courtLabel,
          needsConfirmation: result.needsConfirmation,
        })
        setSavedLineupChangeDelivery(null)
        setTeamSlots(result.slots)
        setError('')
        setMessage(`Backup selected: ${result.replacementPlayerName} for ${result.outgoingPlayerName}. Save to return to this court in Team Room.`)
        return
      }
    }

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

    if (side === 'team') {
      const nextSlots = update(teamSlots)
      setTeamSlots(nextSlots)
      setError('')
      const selectedSlot = nextSlots.find((slot) => slot.id === slotId)
      if (selectedSlot) {
        // Refresh every selected player's prepared text when a court changes.
        // A doubles partner may be chosen after the first private text is
        // prepared, and the outgoing message must include that partner.
        selectedSlot.players
          .filter((player) => player.playerId && player.playerName.trim())
          .forEach((selectedPlayer) => {
            // Persist the private reply link while the captain continues
            // building. The later Ask control is a physical sms: link, so iOS
            // receives it directly from that tap instead of cancelling an
            // in-flight request.
            void askProposedCourtPlayers(selectedSlot, selectedPlayer, { silent: true })
          })
      }
    } else {
      setOpponentSlots(update(opponentSlots))
      setMobileForecastOpen(false)
      setError('')
    }
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
    setActiveLineupFormatKey('standard')
    setAppliedLineupNotice(null)
    setSuggestedSwapDraft(null)
    setSavedLineupChangeDelivery(null)
    setDirectCourtTextHandoff(null)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CAPTAIN_DIRECT_COURT_TEXT_STORAGE_KEY)
      window.localStorage.removeItem(getCaptainLineupDraftStorageKey(userId))
    }
    clearLocks()
    setMessage('Builder reset.')
    setError('')
  }
  async function saveAndConfirmPotentialLineupAvailability() {
    if (!teamName || !matchDate) {
      setError('Choose the team and match before asking players.')
      setMessage('')
      return
    }

    const invitedPlayers = teamSlots
      .flatMap((slot) => slot.players)
      .filter((player) => player.playerName.trim())
      .filter((player, index, all) =>
        all.findIndex((candidate) =>
          candidate.playerId === player.playerId ||
          candidate.playerName.trim().toLowerCase() === player.playerName.trim().toLowerCase()
        ) === index
      )

    if (!invitedPlayers.length) {
      setError('Add at least one player to the potential lineup first.')
      setMessage('')
      return
    }

    setConfirmationStage('saving-lineup')
    setError('')
    setMessage('Saving this potential lineup...')

    const savedScenario = await saveScenario(false, true)
    if (!savedScenario) {
      setConfirmationStage('idle')
      return
    }

    setConfirmationStage('preparing-replies')
    setMessage('Preparing player replies...')

    let availabilityRequestUrl = ''
    let availabilityRequestId = ''
    let playerRequestUrls: CaptainLineupHandoff['playerRequestUrls'] = []
    let teamRoomCardPosted = false
    let teamRoomCardHref = ''
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (accessToken) {
      try {
        const response = await fetch('/api/captain/availability-requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            scenarioId: savedScenario.id,
            teamName,
            leagueName,
            flight,
            matchDate,
            opponentTeam,
            matchTime: selectedMatch?.match_time || '',
            facility: selectedMatch?.facility || '',
            slots: teamSlots,
            invitedPlayers,
          }),
        })
        const result = await response.json() as {
          requestId?: string
          requestUrl?: string
          playerRequestUrls?: CaptainLineupHandoff['playerRequestUrls']
        }
        if (response.ok) {
          availabilityRequestId = result.requestId || ''
          availabilityRequestUrl = result.requestUrl || ''
          playerRequestUrls = result.playerRequestUrls ?? []
        }

        if (response.ok) {
          const teamRoomResponse = await fetch('/api/team-rooms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              action: 'post_match_card',
              teamName,
              leagueName,
              flight,
              card: {
                cardType: 'projected_lineup',
                title: 'Projected lineup — can you play?',
                matchDate,
                opponent: opponentTeam,
                matchTime: selectedMatch?.match_time || '',
                facility: selectedMatch?.facility || '',
                matchId: selectedMatch?.id || '',
                availabilityRequestId,
                availabilityRequestUrl,
                lineup: teamSlots.map((slot) => ({
                  label: slot.label,
                  players: slot.players.map((player) => player.playerName).filter(Boolean),
                })),
              },
            }),
          })
          const teamRoomResult = await teamRoomResponse.json() as {
            ok?: boolean
            messageId?: string
            href?: string
          }
          const teamRoomMessageId = teamRoomResult.messageId || ''
          teamRoomCardPosted = teamRoomResponse.ok && teamRoomResult.ok === true && Boolean(teamRoomMessageId)
          if (teamRoomCardPosted) {
            const hrefUrl = new URL(
              teamRoomResult.href || buildTeamRoomHref({ teamName, leagueName, flight }),
              window.location.origin,
            )
            hrefUrl.searchParams.set('message', teamRoomMessageId)
            hrefUrl.hash = `match-card-${encodeURIComponent(teamRoomMessageId)}`
            teamRoomCardHref = `${hrefUrl.pathname}${hrefUrl.search}${hrefUrl.hash}`
          }
        }
      } catch {
        // Messaging still works if the shareable response link cannot be created.
      }
    }

    const handoff: CaptainLineupHandoff = {
      version: 1,
      intent: 'confirm-availability',
      scenario: { ...savedScenario, slots_json: teamSlots },
      match: {
        date: matchDate,
        time: selectedMatch?.match_time || '',
        facility: selectedMatch?.facility || '',
        opponent: opponentTeam,
      },
      availabilityRequestUrl,
      availabilityRequestId,
      playerRequestUrls,
      createdAt: new Date().toISOString(),
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CAPTAIN_LINEUP_HANDOFF_STORAGE_KEY, JSON.stringify(handoff))
      window.localStorage.setItem('tenace_selected_scenario', JSON.stringify(handoff.scenario))
      window.localStorage.setItem('tenace_flow_source', 'lineup_builder')
    }

    setConfirmationStage('opening-messages')
    setMessage('Opening Team Room...')
    if (teamRoomCardPosted) {
      router.push(teamRoomCardHref)
      return
    }
    const messagingHref = buildCaptainScopedHref('/captain/messaging', {
      competitionLayer,
      team: teamName,
      league: leagueName,
      flight,
      date: matchDate,
      opponent: opponentTeam,
    })
    router.push(`${messagingHref}${messagingHref.includes('?') ? '&' : '?'}source=lineup_builder`)
  }

  function saveDirectCourtTextHandoff(next: CaptainDirectCourtTextHandoff | null) {
    setDirectCourtTextHandoff(next)
    if (typeof window === 'undefined') return
    if (next) window.localStorage.setItem(CAPTAIN_DIRECT_COURT_TEXT_STORAGE_KEY, JSON.stringify(next))
    else window.localStorage.removeItem(CAPTAIN_DIRECT_COURT_TEXT_STORAGE_KEY)
  }

  function openNativeSmsHandoff(contactPhone: string, playerName: string, body: string) {
    const href = buildSmsHref([contactPhone], body)
    setSmsFallback({ href, playerName })
    const copied = prepareSmsBodyForNativeComposer(body)
    setMessage(
      copied
        ? `Opening Messages for ${playerName}. Your TiQ invitation is copied—paste it to send.`
        : `Opening Messages for ${playerName}. If it does not open, use the Open Messages link below.`,
    )

    // Keep this synchronous with the captain's physical tap. iOS blocks custom
    // app handoffs that happen after an awaited request or delayed callback.
    window.location.href = href
  }

  function openDirectCourtText(
    player: CaptainDirectCourtTextHandoff['players'][number],
    handoffOverride?: CaptainDirectCourtTextHandoff,
  ) {
    const activeHandoff = handoffOverride ?? directCourtTextHandoff
    if (!activeHandoff) return
    const playerKey = normalizeCaptainRosterContactKey(player.playerName)
    const contact = directTextContactByName.get(playerKey)
    if (!contact?.phone?.trim()) {
      setError(`Add a mobile number for ${player.playerName} before opening their private text.`)
      setMessage('')
      return
    }

    const next = {
      ...activeHandoff,
      openedPlayerKeys: Array.from(new Set([...activeHandoff.openedPlayerKeys, playerKey])),
    }
    saveDirectCourtTextHandoff(next)
    setError('')
    setMessage(`Opening a private availability text for ${player.playerName}.`)
    const body = buildPlayerPotentialLineupAvailabilityMessage({
      playerName: player.playerName,
      teamName,
      opponent: activeHandoff.match.opponent,
      dateText: formatDate(activeHandoff.match.date),
      time: activeHandoff.match.time,
      facility: activeHandoff.match.facility,
      slotsJson: activeHandoff.slotsJson,
      availabilityRequestUrl: player.requestUrl,
    })
    openNativeSmsHandoff(contact.phone, player.playerName, body)
  }

  function getPreparedCourtTextKey(slot: LineupSlot, invitedPlayer: LineupSlot['players'][number]) {
    return [
      normalizeTeamName(teamName),
      normalizeTeamName(leagueName),
      normalizeTeamName(flight),
      matchDate,
      slot.id,
      invitedPlayer.playerId || normalizeCaptainRosterContactKey(invitedPlayer.playerName),
    ].join(':')
  }

  function markPreparedCourtTextOpened(preparedText: PreparedCourtText) {
    const playerKey = normalizeCaptainRosterContactKey(preparedText.playerName)
    setOpenedCourtTextKeys((current) => Array.from(new Set([...current, preparedText.key])))
    if (directCourtTextHandoff) {
      saveDirectCourtTextHandoff({
        ...directCourtTextHandoff,
        openedPlayerKeys: Array.from(new Set([...directCourtTextHandoff.openedPlayerKeys, playerKey])),
      })
    }

    setError('')
    setSmsFallback({ href: preparedText.href, playerName: preparedText.playerName })
    setMessage(`Opening Messages for ${preparedText.playerName}.`)
  }

  async function askProposedCourtPlayers(
    slot: LineupSlot,
    invitedPlayer: LineupSlot['players'][number],
    options: { silent?: boolean; contactPhone?: string } = {},
  ) {
    if (!teamName || !matchDate) {
      setError('Choose the team and match before asking a player.')
      setMessage('')
      return
    }

    const invitedPlayers = invitedPlayer.playerName.trim() ? [invitedPlayer] : []

    if (!invitedPlayers.length) {
      setError('Choose a player for this court before asking availability.')
      setMessage('')
      return
    }

    const playerKey = normalizeCaptainRosterContactKey(invitedPlayer.playerName)
    const contactPhone = options.contactPhone?.trim() || directTextContactByName.get(playerKey)?.phone?.trim() || ''
    if (!contactPhone) {
      if (options.silent) return
      setMissingPhonePlayerKeys((current) => current.includes(playerKey) ? current : [...current, playerKey])
      setError(`Add a mobile number for ${invitedPlayer.playerName} before opening their private text.`)
      setMessage('')
      return
    }

    const preparedKey = getPreparedCourtTextKey(slot, invitedPlayer)
    const existingPreparedText = preparedCourtTexts[preparedKey]
    if (existingPreparedText) {
      const refreshedBody = buildPlayerPotentialLineupAvailabilityMessage({
        playerName: invitedPlayer.playerName,
        teamName,
        opponent: opponentTeam,
        dateText: formatDate(matchDate),
        time: selectedMatch?.match_time || '',
        facility: selectedMatch?.facility || '',
        slotsJson: [slot],
        availabilityRequestUrl: existingPreparedText.requestUrl,
      })
      if (refreshedBody !== existingPreparedText.body || contactPhone !== existingPreparedText.phone) {
        setPreparedCourtTexts((current) => ({
          ...current,
          [preparedKey]: {
            ...existingPreparedText,
            phone: contactPhone,
            href: buildSmsHref([contactPhone], refreshedBody),
            body: refreshedBody,
          },
        }))
      }
      return
    }

    if (typeof window === 'undefined' || !window.crypto?.randomUUID) {
      if (options.silent) return
      setError('This browser could not prepare a secure reply link. Please update your browser and try again.')
      setMessage('')
      return
    }

    // The Builder can be open while Supabase refreshes its access token. Read
    // the current session here instead of treating a momentarily stale React
    // auth value as a missing captain session.
    let accessToken = session?.access_token
    if (!accessToken) {
      const { data: sessionData } = await supabase.auth.getSession()
      accessToken = sessionData.session?.access_token
    }
    if (!accessToken) {
      if (options.silent) return
      setError('Sign in again before sending availability texts.')
      setMessage('')
      return
    }

    if (preparingCourtTextKeysRef.current.has(preparedKey)) return

    preparingCourtTextKeysRef.current.add(preparedKey)
    if (!options.silent) {
      setAskingCourtId(slot.id)
      setError('')
    }
    const preservedOpponentSlots = cloneSlots(opponentSlots)
    const responseToken = window.crypto.randomUUID()
    try {
      const response = await fetch('/api/captain/availability-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          scenarioId: currentScenarioId,
          teamName,
          leagueName,
          flight,
          matchDate,
          opponentTeam,
          matchTime: selectedMatch?.match_time || '',
          facility: selectedMatch?.facility || '',
          slots: [slot],
          invitedPlayers: invitedPlayers.map((player) => ({
            ...player,
            responseToken: player.playerId === invitedPlayer.playerId && player.playerName === invitedPlayer.playerName
              ? responseToken
              : undefined,
          })),
          inviteMode: 'append',
        }),
      })
      const result = await response.json().catch(() => null) as {
        message?: string
        requestId?: string
        playerRequestUrls?: Array<{ playerId?: string; playerName?: string; requestUrl?: string }>
      } | null
      if (!response.ok) throw new Error(result?.message || 'The private reply link could not be saved.')

      const requestUrl = result?.playerRequestUrls?.find((entry) =>
        (entry.playerId && entry.playerId === invitedPlayer.playerId) ||
        normalizeCaptainRosterContactKey(entry.playerName || '') === playerKey,
      )?.requestUrl
      if (!requestUrl) throw new Error('The private reply link was not returned. Please try again.')

      // A partner can be placed or locked while this secure link is being
      // prepared. Read the current court before composing the actual text.
      const currentSlot = teamSlotsRef.current.find((candidate) => candidate.id === slot.id) ?? slot
      const currentPlayer = currentSlot.players.find((player) => player.playerId === invitedPlayer.playerId) ?? invitedPlayer
      const body = buildPlayerPotentialLineupAvailabilityMessage({
        playerName: currentPlayer.playerName,
        teamName,
        opponent: opponentTeam,
        dateText: formatDate(matchDate),
        time: selectedMatch?.match_time || '',
        facility: selectedMatch?.facility || '',
        slotsJson: [currentSlot],
        availabilityRequestUrl: requestUrl,
      })
      const directTextHandoff: CaptainDirectCourtTextHandoff = {
        version: 1,
        courtId: currentSlot.id,
        courtLabel: currentSlot.label,
        requestId: result?.requestId || '',
        match: {
          date: matchDate,
          time: selectedMatch?.match_time || '',
          facility: selectedMatch?.facility || '',
          opponent: opponentTeam,
        },
        slotsJson: [currentSlot],
        players: [{
          playerId: currentPlayer.playerId,
          playerName: currentPlayer.playerName,
          requestUrl,
        }],
        openedPlayerKeys: [],
        builderDraft: {
          ...currentBuilderDraft,
          teamSlots: cloneSlots(teamSlotsRef.current),
          opponentSlots: preservedOpponentSlots,
          updatedAt: new Date().toISOString(),
        },
      }
      saveDirectCourtTextHandoff(directTextHandoff)
      setPreparedCourtTexts((current) => ({
        ...current,
        [preparedKey]: {
          key: preparedKey,
          playerId: currentPlayer.playerId,
          playerName: currentPlayer.playerName,
          phone: contactPhone,
          requestUrl,
          href: buildSmsHref([contactPhone], body),
          body,
        },
      }))
      setMissingPhonePlayerKeys((current) => current.filter((key) => key !== playerKey))
    } catch (caught) {
      preparingCourtTextKeysRef.current.delete(preparedKey)
      if (!options.silent) {
        setError(caught instanceof Error ? caught.message : 'The private reply link could not be saved. Please try again.')
        setMessage('')
      }
    } finally {
      if (!options.silent) setAskingCourtId((current) => current === slot.id ? '' : current)
    }
  }

  async function saveCourtPlayerPhone(slot: LineupSlot, invitedPlayer: LineupSlot['players'][number]) {
    const playerKey = normalizeCaptainRosterContactKey(invitedPlayer.playerName)
    const phone = (inlinePhoneByPlayerKey[playerKey] || '').trim()
    if (!phone) {
      setError(`Add a mobile number for ${invitedPlayer.playerName}.`)
      return
    }
    if (!teamName) {
      setError('Choose the team before saving a player mobile number.')
      return
    }
    if (!userId) {
      setError('Your secure session is still loading. Please try saving the number again in a moment.')
      return
    }

    setSavingPhonePlayerKey(playerKey)
    setError('')
    try {
      const accessToken = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token
      if (!accessToken) throw new Error('Sign in again before saving this mobile number.')

      const existingContact = captainRosterContactsForTeam.find((contact) => (
        normalizeCaptainRosterContactKey(contact.full_name) === playerKey
      ))
      const response = await fetch('/api/captain/team-contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId: existingContact?.id || '',
          teamName,
          leagueName,
          flight,
          fullName: invitedPlayer.playerName.trim(),
          phone,
          role: existingContact?.role || 'Player',
          isCaptain: existingContact?.is_captain || false,
        }),
      })
      const result = await response.json() as { ok?: boolean; message?: string; contact?: CaptainRosterContactRow }
      if (!response.ok || !result.ok || !result.contact) {
        throw new Error(result.message || `Could not save ${invitedPlayer.playerName}'s mobile number.`)
      }
      const contact = result.contact

      setCaptainRosterContacts((current) => [
        ...current.filter((row) => !(
          normalizeCaptainRosterContactKey(row.team_name) === normalizeCaptainRosterContactKey(teamName) &&
          normalizeCaptainRosterContactKey(row.full_name) === playerKey &&
          normalizeCaptainRosterContactKey(row.league_name) === normalizeCaptainRosterContactKey(leagueName) &&
          normalizeCaptainRosterContactKey(row.flight) === normalizeCaptainRosterContactKey(flight)
        )),
        contact,
      ])
      setInlinePhoneByPlayerKey((current) => {
        const next = { ...current }
        delete next[playerKey]
        return next
      })
      setMissingPhonePlayerKeys((current) => current.filter((key) => key !== playerKey))
      await askProposedCourtPlayers(slot, invitedPlayer, { contactPhone: phone })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not save ${invitedPlayer.playerName}'s mobile number.`)
      setMessage('')
    } finally {
      setSavingPhonePlayerKey((current) => current === playerKey ? '' : current)
    }
  }

  useEffect(() => {
    if (!authResolved || !teamName || !matchDate || !teamSlots.length) return

    // Draft restoration should be just as ready to text as a fresh player
    // selection. This only prepares the secure reply link; it never opens
    // Messages or sends anything until the captain taps Ask.
    teamSlots.forEach((slot) => {
      slot.players
        .filter((player) => player.playerId && player.playerName.trim())
        .forEach((player) => {
          void askProposedCourtPlayers(slot, player, { silent: true })
        })
    })
  // The preparation callback intentionally stays out of this dependency list:
  // it is recreated as normal Builder state changes, while this effect should
  // retry only when restored lineup data or authenticated scope changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authResolved,
    captainMessageContacts,
    captainRosterContacts,
    currentScenarioId,
    flight,
    leagueName,
    matchDate,
    opponentTeam,
    selectedMatch?.facility,
    selectedMatch?.match_time,
    session?.access_token,
    teamName,
    teamSlots,
  ])

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

  function buildScenarioPayload(nextScenarioName = scenarioName.trim()) {
    return {
      scenario_name: nextScenarioName,
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
    () => compareLineupStrength(teamSlots, opponentSlots, builderPlayers),
    [builderPlayers, opponentSlots, teamSlots]
  )

  const comparisonCandidates = useMemo(
    () => scenarioOptions.filter((scenario) => {
      if (scenario.id === currentScenarioId) return false
      if (matchDate && scenario.match_date !== matchDate) return false
      if (opponentTeam && scenario.opponent_team !== opponentTeam) return false
      return true
    }),
    [currentScenarioId, matchDate, opponentTeam, scenarioOptions]
  )

  const comparisonScenario = useMemo(
    () => comparisonCandidates.find((scenario) => scenario.id === comparisonScenarioId) ?? comparisonCandidates[0] ?? null,
    [comparisonCandidates, comparisonScenarioId]
  )

  const lineupVersionComparison = useMemo(() => {
    if (!comparisonScenario) return null

    const baselineAnalysis = compareLineupStrength(
      normalizeSavedSlots(comparisonScenario.slots_json),
      normalizeSavedSlots(comparisonScenario.opponent_slots_json),
      builderPlayers
    )

    const courts = analysis.lines.map((line, index) => {
      const baseline = baselineAnalysis.lines[index]
      const yourChanged = slotPlayerSignature(line.teamPlayers) !== slotPlayerSignature(baseline?.teamPlayers ?? [])
      const opponentChanged = slotPlayerSignature(line.opponentPlayers) !== slotPlayerSignature(baseline?.opponentPlayers ?? [])
      const before = baseline?.projection ?? null
      const after = line.projection
      const delta = typeof before === 'number' && typeof after === 'number' ? after - before : null

      return {
        label: line.label,
        yourChanged,
        opponentChanged,
        before,
        after,
        delta,
        beforePlayers: formatSlotPlayerNames(baseline?.teamPlayers ?? [], 'Team spots open'),
        afterPlayers: formatSlotPlayerNames(line.teamPlayers, 'Team spots open'),
      }
    })

    const changedCourts = courts.filter((court) => court.yourChanged || court.opponentChanged)
    const biggestShift = [...courts]
      .filter((court) => typeof court.delta === 'number')
      .sort((left, right) => Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0))[0] ?? null
    const playerSwap = changedCourts.find((court) => court.yourChanged) ?? null
    const overallDelta = analysis.projection - baselineAnalysis.projection
    const fullyProjected = analysis.lines.every((line) => typeof line.projection === 'number') &&
      baselineAnalysis.lines.length === analysis.lines.length &&
      baselineAnalysis.lines.every((line) => typeof line.projection === 'number')
    const recommendation = !fullyProjected
      ? 'Fill both lineups before relying on the comparison.'
      : overallDelta >= 0.03
        ? 'Carry the current draft forward. It improves the match outlook.'
        : overallDelta <= -0.03
          ? 'Reconsider the current draft. The saved version projects better.'
          : changedCourts.length
            ? 'Refine the current draft. The versions are close, so protect the swing court.'
            : 'No material lineup change. Save a new version only when the plan changes.'

    return {
      baselineName: comparisonScenario.scenario_name || 'Saved version',
      baselineProjection: baselineAnalysis.projection,
      overallDelta,
      changedCourts,
      biggestShift,
      playerSwap,
      recommendation,
      fullyProjected,
    }
  }, [analysis, builderPlayers, comparisonScenario])

  const suggestedSwapImpact = useMemo<CaptainSuggestedSwapImpact | null>(() => {
    if (!suggestedSwapDraft) return null
    const targetCourtIndex = suggestedSwapDraft.previousSlots.findIndex((slot) => slot.id === suggestedSwapDraft.slotId)
    const beforeAnalysis = compareLineupStrength(suggestedSwapDraft.previousSlots, opponentSlots, builderPlayers)
    const countProjectedCourts = (lineupAnalysis: LineupStrengthAnalysis) => (
      lineupAnalysis.lines.filter((line) => typeof line.projection === 'number').length
    )
    return buildCaptainSuggestedSwapImpact({
      beforeCourtProjection: beforeAnalysis.lines[targetCourtIndex]?.projection,
      afterCourtProjection: analysis.lines[targetCourtIndex]?.projection,
      beforeOverallProjection: beforeAnalysis.projection,
      afterOverallProjection: analysis.projection,
      beforeProjectedCourtCount: countProjectedCourts(beforeAnalysis),
      afterProjectedCourtCount: countProjectedCourts(analysis),
    })
  }, [analysis, builderPlayers, opponentSlots, suggestedSwapDraft])

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
      label: countedLines ? `${projectedWins.toFixed(1)} - ${projectedLosses.toFixed(1)}` : '-',
    }
  }, [analysis.lines])

  const incompleteLines = useMemo(
    () => analysis.lines.filter((line) => !isProjectedLineComplete(line)),
    [analysis.lines]
  )

  const confidenceScore = useMemo(() => {
    const completionScore = analysis.lines.length
      ? analysis.lines.filter((line) => {
          return isProjectedLineComplete(line)
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

  const captainDecisionQueue = useMemo<RecommendationCard[]>(() => {
    const cards: RecommendationCard[] = []
    const firstIncompleteLine = incompleteLines[0] ?? null

    if (firstIncompleteLine) {
      const teamMissing = Math.max(0, firstIncompleteLine.playerCount - filledSlotPlayerCount(firstIncompleteLine.teamPlayers))
      const opponentMissing = Math.max(0, firstIncompleteLine.playerCount - filledSlotPlayerCount(firstIncompleteLine.opponentPlayers))

      cards.push({
        title: 'Fill first',
        body: `${firstIncompleteLine.label} needs ${teamMissing} team spot(s) and ${opponentMissing} opponent spot(s) before the read is fully trustworthy.`,
        tone: 'warn',
      })
    }

    if (weakestLine && typeof weakestLine.diff === 'number' && weakestLine.diff < 0) {
      cards.push({
        title: 'Protect',
        body: `${weakestLine.label} is underwater at ${formatLineGap(weakestLine)}. Try a safer pair or spend your strongest available player here.`,
        tone: 'warn',
      })
    }

    if (bestLine && typeof bestLine.diff === 'number') {
      cards.push({
        title: 'Preserve',
        body: `${bestLine.label} is your cleanest edge at ${formatLineGap(bestLine)}. Keep this court stable unless you need help elsewhere.`,
        tone: 'good',
      })
    }

    if (swingLine) {
      cards.push({
        title: 'Decide',
        body: `${swingLine.label} is closest to even. A small player swap here has the highest chance to move the team score.`,
        tone: 'info',
      })
    }

    if (!cards.length) {
      cards.push({
        title: 'Build the first read',
        body: 'Add players on both sides, then use the optimizer to turn this draft into a lineup you can compare and send.',
        tone: 'info',
      })
    }

    return cards.slice(0, 4)
  }, [bestLine, incompleteLines, swingLine, weakestLine])

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
        body: `${weakestOpponentLine.label} is the opponent's weakest projected line. If you want to attack a court, start there.`,
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

  async function syncSavedSuggestedSwapToTeamRoom(draft: SuggestedSwapDraft) {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token || ''
    if (!accessToken || !teamName || !matchDate) return null
    try {
      const response = await fetch('/api/team-rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'post_match_card',
          teamName,
          leagueName,
          flight,
          silent: true,
          changeContext: {
            courtLabel: draft.courtLabel,
            outgoingPlayerName: draft.outgoingPlayerName,
            replacementPlayerName: draft.replacementPlayerName,
          },
          card: {
            cardType: 'projected_lineup',
            title: 'Projected lineup — can you play?',
            matchDate,
            opponent: opponentTeam,
            matchTime: selectedMatch?.match_time || '',
            facility: selectedMatch?.facility || '',
            matchId: selectedMatch?.id || '',
            lineup: teamSlots.map((slot) => ({
              label: slot.label,
              players: slot.players.map((player) => player.playerName).filter(Boolean),
            })),
          },
        }),
      })
      const payload = await response.json() as {
        ok?: boolean
        messageId?: string
        href?: string
        lineupChangeNotice?: {
          courtLabel?: string
          outgoingPlayerName?: string
          replacementPlayerName?: string
          affectedNames?: string[]
        } | null
      }
      if (!response.ok || !payload.ok || !payload.messageId || !payload.lineupChangeNotice) return null
      const hrefUrl = new URL(payload.href || buildTeamRoomHref({ teamName, leagueName, flight }), window.location.origin)
      hrefUrl.searchParams.set('message', payload.messageId)
      hrefUrl.searchParams.set('court', payload.lineupChangeNotice.courtLabel || draft.courtLabel)
      hrefUrl.hash = `match-card-${encodeURIComponent(payload.messageId)}`
      return {
        messageId: payload.messageId,
        href: `${hrefUrl.pathname}${hrefUrl.search}${hrefUrl.hash}`,
        courtLabel: payload.lineupChangeNotice.courtLabel || draft.courtLabel,
        outgoingPlayerName: payload.lineupChangeNotice.outgoingPlayerName || draft.outgoingPlayerName,
        replacementPlayerName: payload.lineupChangeNotice.replacementPlayerName || draft.replacementPlayerName,
        affectedNames: Array.isArray(payload.lineupChangeNotice.affectedNames)
          ? payload.lineupChangeNotice.affectedNames.filter(Boolean)
          : [draft.outgoingPlayerName, draft.replacementPlayerName],
        pending: true,
        notifiedCount: 0,
      } satisfies SavedLineupChangeDelivery
    } catch {
      return null
    }
  }

  async function notifySavedLineupChange() {
    if (!savedLineupChangeDelivery?.pending || notifyingLineupChange) return
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token || ''
    if (!accessToken) {
      setError('Sign in again before notifying players.')
      return
    }
    setNotifyingLineupChange(true)
    setError('')
    try {
      const response = await fetch('/api/team-rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'notify_lineup_change',
          teamName,
          leagueName,
          flight,
          messageId: savedLineupChangeDelivery.messageId,
        }),
      })
      const payload = await response.json() as {
        ok?: boolean
        message?: string
        notifiedCount?: number
        notificationIds?: string[]
        directShareNames?: string[]
        shareText?: string
      }
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'The lineup update could not be sent.')
      const notificationIds = Array.isArray(payload.notificationIds) ? payload.notificationIds.filter(Boolean) : []
      if (notificationIds.length) {
        await fetch('/api/internal-notifications/email-fallback', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationIds }),
        }).catch(() => null)
      }
      const directShareNames = Array.isArray(payload.directShareNames) ? payload.directShareNames.filter(Boolean) : []
      let copiedForDirectShare = false
      if (directShareNames.length && payload.shareText && navigator.clipboard) {
        copiedForDirectShare = await navigator.clipboard.writeText(payload.shareText).then(() => true).catch(() => false)
      }
      const notifiedCount = Math.max(0, Number(payload.notifiedCount) || 0)
      setSavedLineupChangeDelivery((current) => current ? { ...current, pending: false, notifiedCount } : current)
      setMessage(
        `${notifiedCount ? `Notified ${notifiedCount} connected player${notifiedCount === 1 ? '' : 's'}.` : 'Lineup change marked ready to share.'}`
        + (directShareNames.length
          ? copiedForDirectShare
            ? ` Update copied for ${directShareNames.join(', ')}.`
            : ` Share the update directly with ${directShareNames.join(', ')}.`
          : ''),
      )
    } catch (notifyError) {
      setError(notifyError instanceof Error ? notifyError.message : 'The lineup update could not be sent.')
    } finally {
      setNotifyingLineupChange(false)
    }
  }

  async function saveScenario(asNew = false, quiet = false): Promise<ScenarioRow | null> {
    setSaving(true)
    setError('')
    if (!quiet) setMessage('')
    const swapToSync = !quiet ? suggestedSwapDraft : null

    if (!isCaptainAccess) {
      setSaving(false)
      setError('Upgrade to Captain tier to save scenarios.')
      return null
    }

    const generatedName = `Potential lineup - ${formatDate(matchDate || null)}${opponentTeam ? ` vs ${opponentTeam}` : ''}`
    const nextScenarioName = scenarioName.trim() || generatedName
    if (!scenarioName.trim()) setScenarioName(nextScenarioName)

    const normalizedName = nextScenarioName.toLowerCase()
    const duplicate = savedScenarios.find((scenario) => {
      const sameName = scenario.scenario_name.trim().toLowerCase() === normalizedName
      const sameTeam = (scenario.team_name ?? '') === (teamName || '')
      const sameDate = (scenario.match_date ?? '') === (matchDate || '')
      return sameName && sameTeam && sameDate
    })

    if (duplicate && asNew) {
      setSaving(false)
      setError('A scenario with this name already exists for this team and match date.')
      return null
    }

    const payload = buildScenarioPayload(nextScenarioName)
    const targetScenarioId = !asNew ? currentScenarioId || duplicate?.id || '' : ''

    if (targetScenarioId) {
      const { data: updated, error: updateError } = await supabase
        .from('lineup_scenarios')
        .update(payload)
        .eq('id', targetScenarioId)
        .select('id, scenario_name, league_name, flight, match_date, team_name, opponent_team, slots_json, opponent_slots_json, notes')
        .single()
      if (updateError) {
        setSaving(false)
        setError(updateError.message)
        return null
      }

      setCurrentScenarioId(targetScenarioId)
      await refreshSavedScenarios()
      await trackPredictionSnapshot('scenario-update', targetScenarioId, true)
      const syncedChange = swapToSync ? await syncSavedSuggestedSwapToTeamRoom(swapToSync) : null
      if (syncedChange) setSavedLineupChangeDelivery(syncedChange)
      setSaving(false)
      if (swapToSync && backupHandoff && !syncedChange) {
        setMessage('')
        setError('The backup was saved, but Team Room could not be updated. Tap Save backup & return to try again.')
        return updated as ScenarioRow
      }
      setSuggestedSwapDraft(null)
      if (syncedChange && backupHandoff) {
        setMessage('Backup saved. Opening the affected court in Team Room...')
        router.push(syncedChange.href)
        return updated as ScenarioRow
      }
      if (!quiet) setMessage(
        syncedChange
          ? 'Potential lineup updated. Team Chat is ready to notify the affected players.'
          : swapToSync ? 'Potential lineup updated. Open Team Chat to share the court change.' : 'Potential lineup updated.'
      )
      return updated as ScenarioRow
    }

    const { data, error: insertError } = await supabase
      .from('lineup_scenarios')
      .insert(payload)
      .select('id, scenario_name, league_name, flight, match_date, team_name, opponent_team, slots_json, opponent_slots_json, notes')
      .single()
    if (insertError) {
      setSaving(false)
      setError(insertError.message)
      return null
    }

    if (data?.id) setCurrentScenarioId(data.id)
    await refreshSavedScenarios()
    await trackPredictionSnapshot(asNew ? 'scenario-save-new' : 'scenario-save', data?.id ?? null, true)
    const syncedChange = swapToSync ? await syncSavedSuggestedSwapToTeamRoom(swapToSync) : null
    if (syncedChange) setSavedLineupChangeDelivery(syncedChange)
    setSaving(false)
    if (swapToSync && backupHandoff && !syncedChange) {
      setMessage('')
      setError('The backup was saved, but Team Room could not be updated. Tap Save backup & return to try again.')
      return data as ScenarioRow
    }
    setSuggestedSwapDraft(null)
    if (syncedChange && backupHandoff) {
      setMessage('Backup saved. Opening the affected court in Team Room...')
      router.push(syncedChange.href)
      return data as ScenarioRow
    }
    if (!quiet) setMessage(
      syncedChange
        ? 'Potential lineup saved. Team Chat is ready to notify the affected players.'
        : swapToSync
          ? 'Potential lineup saved. Open Team Chat to share the court change.'
          : asNew ? 'Potential lineup saved as a new version.' : 'Potential lineup saved.'
    )
    return data as ScenarioRow
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
    const knownPlayerIds = new Set(players.map((player) => player.id))
    const recoveredManualPlayers = uniqueSorted(
      loadedTeamSlots
        .flatMap((slot) => slot.players)
        .filter((player) => player.playerId && player.playerName && !knownPlayerIds.has(player.playerId))
        .map((player) => player.playerName)
    ).map((name) => createManualRosterPlayer(name, {
      teamName: scenario.team_name ?? '',
      leagueName: scenario.league_name ?? '',
      flight: scenario.flight ?? '',
    }))

    if (recoveredManualPlayers.length) {
      setManualRosterPlayers((current) => {
        const currentIds = new Set(current.map((player) => player.id))
        return [...current, ...recoveredManualPlayers.filter((player) => !currentIds.has(player.id))]
      })
    }

    const scenarioLeague = scenario.league_name ?? ''
    const scenarioFlight = scenario.flight ?? ''
    setTeamSlots(fitCaptainLineupSlotsToFormat(loadedTeamSlots, scenarioLeague, scenarioFlight, 'team', effectiveMatchFormatId))
    setOpponentSlots(fitCaptainLineupSlotsToFormat(loadedOpponentSlots, scenarioLeague, scenarioFlight, 'opponent', effectiveMatchFormatId))
    setActiveLineupFormatKey(getCaptainLineupFormatKey(scenarioLeague, scenarioFlight, effectiveMatchFormatId))
    setAppliedLineupNotice(null)
    setSuggestedSwapDraft(null)
    clearLocks()

    setLoadingScenarioId('')
    setMessage('Scenario loaded into the builder.')
  }

  useEffect(() => {
    if (savedLineupRestoreAppliedRef.current || !scopedResumeResolved || !savedScenarios.length || prefillScenarioId) return

    const hasDraftAssignments = teamSlots.some((slot) => slot.players.some((player) => player.playerId || player.playerName))
    if (hasDraftAssignments) {
      savedLineupRestoreAppliedRef.current = true
      return
    }

    const isInCurrentScope = (scenario: ScenarioRow) => (
      (!teamName || scenario.team_name === teamName)
      && (!leagueName || scenario.league_name === leagueName)
      && (!flight || scenario.flight === flight)
      && (!matchDate || scenario.match_date === matchDate)
      && (!opponentTeam || scenario.opponent_team === opponentTeam)
    )
    const hasCourtAssignments = (scenario: ScenarioRow) => normalizeSavedSlots(scenario.slots_json)
      .some((slot) => slot.players.some((player) => player.playerId || player.playerName))
    const currentScenario = currentScenarioId
      ? savedScenarios.find((scenario) => scenario.id === currentScenarioId) ?? null
      : null
    const scopedScenario = savedScenarios.find((scenario) => isInCurrentScope(scenario) && hasCourtAssignments(scenario)) ?? null
    const fallbackScenario = !teamName && !leagueName && !flight && !matchDate && !opponentTeam
      ? savedScenarios.find(hasCourtAssignments) ?? null
      : null
    const scenarioToRestore = currentScenario ?? scopedScenario ?? fallbackScenario

    savedLineupRestoreAppliedRef.current = true
    if (!scenarioToRestore) return
    void loadScenario(scenarioToRestore.id)
    setMessage('Saved lineup restored. Your draft will keep saving on this phone.')
  // The restore is intentionally a one-time handoff after the scoped state and saved scenarios are both ready.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScenarioId, flight, leagueName, matchDate, opponentTeam, prefillScenarioId, savedScenarios, scopedResumeResolved, teamName, teamSlots])

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

  const lineupWarnings = useMemo(
    () => getLineupWarnings(teamSlots, opponentSlots, builderPlayers, competitionRules),
    [builderPlayers, competitionRules, opponentSlots, teamSlots]
  )

  const optimizerTeamSlots = useMemo(
    () => fitCaptainLineupSlotsToFormat(teamSlots, selectedFormatLeagueName, selectedFormatFlight, 'team', effectiveMatchFormatId),
    [effectiveMatchFormatId, selectedFormatFlight, selectedFormatLeagueName, teamSlots]
  )
  const optimizerOpponentSlots = useMemo(
    () => fitCaptainLineupSlotsToFormat(opponentSlots, selectedFormatLeagueName, selectedFormatFlight, 'opponent', effectiveMatchFormatId),
    [effectiveMatchFormatId, opponentSlots, selectedFormatFlight, selectedFormatLeagueName]
  )

  const eliteRecommendation = useMemo(() => {
    const balanced = recommendLineupFromPool(optimizerTeamSlots, myPlayerPool, 'balanced', competitionRules)
    return {
      slots: balanced.slots,
      bench: balanced.bench.slice(0, 6),
      analysis: compareLineupStrength(balanced.slots, optimizerOpponentSlots, builderPlayers),
    }
  }, [builderPlayers, competitionRules, myPlayerPool, optimizerOpponentSlots, optimizerTeamSlots])

  const optimizedPlans = useMemo(() => {
    return [
      optimizeLineupFromPool(optimizerTeamSlots, myPlayerPool, optimizerOpponentSlots, builderPlayers, 'best', competitionRules),
      optimizeLineupFromPool(optimizerTeamSlots, myPlayerPool, optimizerOpponentSlots, builderPlayers, 'safe', competitionRules),
      optimizeLineupFromPool(optimizerTeamSlots, myPlayerPool, optimizerOpponentSlots, builderPlayers, 'upside', competitionRules),
    ]
  }, [builderPlayers, competitionRules, myPlayerPool, optimizerOpponentSlots, optimizerTeamSlots])

  const bestOptimizedPlan = optimizedPlans[0] ?? null

  function showAppliedLineupNotice(title: string, nextSlots: LineupSlot[]) {
    const currentById = new Map(teamSlots.map((slot) => [slot.id, slot]))
    const changedCourts = nextSlots.filter((slot) => {
      const current = currentById.get(slot.id)
      if (!current) return true
      return current.players.map((player) => player.playerId).join('|') !==
        slot.players.map((player) => player.playerId).join('|')
    }).length
    const filledCourts = nextSlots.filter((slot) =>
      slot.players.every((player) => Boolean(player.playerId))
    ).length

    setAppliedLineupNotice({
      title,
      changedCourts,
      filledCourts,
      totalCourts: nextSlots.length,
    })
  }

  function applyOptimizedPlan(mode: OptimizerMode) {
    const plan = optimizedPlans.find((item) => item.mode === mode)
    if (!plan) return

    const nextSlots = rebuildCandidateWithLocks(
      plan.slots,
      teamSlots,
      lockedSlotIdSet,
      lockedPlayerIdSet,
      myPlayerPool,
      competitionRules,
    )

    const formatSafeSlots = fitCaptainLineupSlotsToFormat(
      nextSlots,
      selectedFormatLeagueName,
      selectedFormatFlight,
      'team',
      effectiveMatchFormatId
    )
    const incompleteCourts = formatSafeSlots.filter((slot) =>
      slot.players.some((player) => !player.playerId)
    )

    setTeamSlots(formatSafeSlots)
    focusTeamCourtsAfterBuild(formatSafeSlots)
    showAppliedLineupNotice(plan.title, formatSafeSlots)
    setMessage(`${plan.title} applied${activeLockCount ? ' with locks preserved' : ''}.`)
    setError(incompleteCourts.length
      ? `Best lineup filled ${formatSafeSlots.length - incompleteCourts.length} of ${formatSafeSlots.length} courts. Add more eligible players or turn off Availability only.`
      : '')
  }

  function applyRecommendedTeamLineup() {
    const next = recommendLineupFromPool(teamSlots, myPlayerPool, 'balanced', competitionRules)
    const rebuilt = rebuildCandidateWithLocks(
      next.slots,
      teamSlots,
      lockedSlotIdSet,
      lockedPlayerIdSet,
      myPlayerPool,
      competitionRules,
    )
    const formatSafeSlots = fitCaptainLineupSlotsToFormat(
      rebuilt,
      selectedFormatLeagueName,
      selectedFormatFlight,
      'team',
      effectiveMatchFormatId
    )
    setTeamSlots(formatSafeSlots)
    focusTeamCourtsAfterBuild(formatSafeSlots)
    showAppliedLineupNotice('Balanced lineup', formatSafeSlots)
    setMessage(`Balanced recommendation applied${activeLockCount ? ' around your locks' : ''}.`)
    setError('')
  }

  function focusTeamCourts(nextSlots: LineupSlot[] = teamSlots, preferredCourtId = '') {
    if (typeof window === 'undefined') return

    const firstPopulatedCourt = nextSlots.find((slot) => slot.players.some((player) => player.playerId))
    const courtToOpen = preferredCourtId || firstPopulatedCourt?.id || nextSlots[0]?.id || ''
    if (isMobile && courtToOpen) setExpandedTeamSlotId(courtToOpen)

    // Hash links were unreliable here on mobile Safari: the URL changed, but
    // the captain remained in the decision panel. Open the specific court and
    // scroll to it after React has painted the expanded editor instead.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = courtToOpen
          ? document.getElementById(`captain-lineup-slot-${courtToOpen}`)
          : document.getElementById('captain-lineup-courts')
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  function focusTeamCourtsAfterBuild(nextSlots: LineupSlot[] = teamSlots) {
    if (!isMobile) return
    focusTeamCourts(nextSlots)
  }

  function rebuildAroundLocks() {
    const rebuilt = rebuildCandidateWithLocks(
      teamSlots,
      teamSlots,
      lockedSlotIdSet,
      lockedPlayerIdSet,
      myPlayerPool,
      competitionRules,
    )
    setTeamSlots(rebuilt)
    setMessage('Lineup rebuilt around your locked lines and players.')
    setError('')
  }

  function applyRecommendedOpponentLineup() {
    if (!opponentPlayerPool.length) {
      setError('No opponent roster is connected for this matchup yet. Add opponent players or import a prior scorecard before TiQ can project their courts.')
      setMessage('')
      return
    }
    const next = recommendLineupFromPool(opponentSlots, opponentPlayerPool, 'ceiling', competitionRules)
    setOpponentSlots(next.slots)
    const incompleteCourts = next.slots.filter((slot) => slot.players.some((player) => !player.playerId))
    setMessage(incompleteCourts.length
      ? `Projected opponent lineup filled ${next.slots.length - incompleteCourts.length} of ${next.slots.length} courts from ${opponentPlayerPool.length} known opponent players.`
      : `Projected opponent lineup applied from ${opponentPlayerPool.length} known opponent players.`)
    setError(incompleteCourts.length
      ? 'TiQ needs more opponent roster data to finish every projected court.'
      : '')
  }

  const currentScenario = savedScenarios.find((scenario) => scenario.id === currentScenarioId) ?? null
  const hasCoreContext = !!teamName && !!opponentTeam && !!matchDate
  const matchSetupSummary = hasCoreContext
    ? `${teamName} vs ${opponentTeam} · ${formatDate(matchDate || null)}`
    : 'Choose your team and scheduled match to fill in opponent and date.'
  useEffect(() => {
    if (!hasCoreContext || didAutoCollapseMatchSetupRef.current) return
    didAutoCollapseMatchSetupRef.current = true
    setMatchSetupOpen(false)
  }, [hasCoreContext])
  const hasComparisonCandidates = scenarioOptions.length > 1
  const teamCourtProgress = useMemo(() => teamSlots.map((slot) => {
    const selectedPlayers = slot.players.filter((player) => player.playerId || player.playerName.trim()).length
    return {
      id: slot.id,
      label: slot.label,
      selectedPlayers,
      requiredPlayers: slot.players.length,
      openPlayers: Math.max(0, slot.players.length - selectedPlayers),
    }
  }), [teamSlots])
  const teamAssignedPlayerCount = teamCourtProgress.reduce((total, court) => total + court.selectedPlayers, 0)
  const teamRequiredPlayerCount = teamCourtProgress.reduce((total, court) => total + court.requiredPlayers, 0)
  const completedTeamCourtCount = teamCourtProgress.filter((court) => court.openPlayers === 0).length
  const firstOpenTeamCourt = teamCourtProgress.find((court) => court.openPlayers > 0) ?? null
  const teamLineupComplete = completedTeamCourtCount === teamCourtProgress.length && teamRequiredPlayerCount > 0
  const lineupHasAssignments = teamAssignedPlayerCount > 0
  const opponentAssignedPlayerCount = opponentSlots.reduce(
    (total, slot) => total + slot.players.filter((player) => player.playerId || player.playerName.trim()).length,
    0,
  )
  const opponentRequiredPlayerCount = opponentSlots.reduce((total, slot) => total + slot.players.length, 0)
  const opponentLineupComplete = opponentRequiredPlayerCount > 0 && opponentAssignedPlayerCount === opponentRequiredPlayerCount
  const recentHistoricalLineup = useMemo<HistoricalLineupSuggestion | null>(() => {
    const normalizedTeam = normalizeTeamName(teamName)
    if (!normalizedTeam || !historicalLineMatches.length || !historicalLineMatchPlayers.length) return null

    const currentRosterIds = new Set(myPlayerPool.map((player) => player.id))
    const historicalMatches = historicalLineMatches.filter((match) => {
      const home = normalizeTeamName(match.home_team)
      const away = normalizeTeamName(match.away_team)
      if (home !== normalizedTeam && away !== normalizedTeam) return false
      if (!match.match_date || (matchDate && match.match_date >= matchDate)) return false
      if (leagueName && match.league_name && match.league_name !== leagueName) return false
      if (flight && match.flight && match.flight !== flight) return false
      return true
    })

    const grouped = new Map<string, { matchDate: string; opponent: string; lines: MatchTeamRow[] }>()
    for (const match of historicalMatches) {
      const opponent = normalizeTeamName(match.home_team) === normalizedTeam ? match.away_team : match.home_team
      const key = [match.match_date, normalizeTeamName(opponent), match.match_time || '', match.facility || ''].join('|')
      const group = grouped.get(key) ?? { matchDate: match.match_date || '', opponent: opponent || 'your opponent', lines: [] }
      group.lines.push(match)
      grouped.set(key, group)
    }

    const groups = [...grouped.values()].sort((a, b) => b.matchDate.localeCompare(a.matchDate))
    for (const group of groups) {
      const courts = group.lines
        .map((match, fallbackIndex) => {
          const expectedSide = normalizeTeamName(match.home_team) === normalizedTeam ? 'A' : 'B'
          const playerIds = historicalLineMatchPlayers
            .filter((player) => player.match_id === match.id && player.side === expectedSide && currentRosterIds.has(player.player_id))
            .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99))
            .map((player) => player.player_id)
          return { lineNumber: Number(match.line_number) || fallbackIndex + 1, playerIds }
        })
        .filter((court) => court.playerIds.length)
        .sort((a, b) => a.lineNumber - b.lineNumber)

      const returningPlayerCount = new Set(courts.flatMap((court) => court.playerIds)).size
      if (courts.length && returningPlayerCount) {
        return { matchDate: group.matchDate, opponent: group.opponent, courts, returningPlayerCount }
      }
    }
    return null
  }, [flight, historicalLineMatchPlayers, historicalLineMatches, leagueName, matchDate, myPlayerPool, teamName])
  const recentHistoricalLineupDetail = recentHistoricalLineup
    ? `${formatDate(recentHistoricalLineup.matchDate)} vs ${recentHistoricalLineup.opponent} · fills open spots only`
    : ''

  const recentHistoricalOpponentLineup = useMemo<HistoricalLineupSuggestion | null>(() => {
    const normalizedTeam = normalizeTeamName(opponentTeam)
    if (!normalizedTeam || !historicalLineMatches.length || !historicalLineMatchPlayers.length) return null

    const currentRosterIds = new Set(opponentPlayerPool.map((player) => player.id))
    const historicalMatches = historicalLineMatches.filter((match) => {
      const home = normalizeTeamName(match.home_team)
      const away = normalizeTeamName(match.away_team)
      if (home !== normalizedTeam && away !== normalizedTeam) return false
      if (!match.match_date || (matchDate && match.match_date >= matchDate)) return false
      if (leagueName && match.league_name && match.league_name !== leagueName) return false
      if (flight && match.flight && match.flight !== flight) return false
      return true
    })

    const grouped = new Map<string, { matchDate: string; opponent: string; lines: MatchTeamRow[] }>()
    for (const match of historicalMatches) {
      const opponent = normalizeTeamName(match.home_team) === normalizedTeam ? match.away_team : match.home_team
      const key = [match.match_date, normalizeTeamName(opponent), match.match_time || '', match.facility || ''].join('|')
      const group = grouped.get(key) ?? { matchDate: match.match_date || '', opponent: opponent || 'their opponent', lines: [] }
      group.lines.push(match)
      grouped.set(key, group)
    }

    const groups = [...grouped.values()].sort((a, b) => b.matchDate.localeCompare(a.matchDate))
    for (const group of groups) {
      const courts = group.lines
        .map((match, fallbackIndex) => {
          const expectedSide = normalizeTeamName(match.home_team) === normalizedTeam ? 'A' : 'B'
          const playerIds = historicalLineMatchPlayers
            .filter((player) => player.match_id === match.id && player.side === expectedSide && currentRosterIds.has(player.player_id))
            .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99))
            .map((player) => player.player_id)
          return { lineNumber: Number(match.line_number) || fallbackIndex + 1, playerIds }
        })
        .filter((court) => court.playerIds.length)
        .sort((a, b) => a.lineNumber - b.lineNumber)

      const returningPlayerCount = new Set(courts.flatMap((court) => court.playerIds)).size
      if (courts.length && returningPlayerCount) {
        return { matchDate: group.matchDate, opponent: group.opponent, courts, returningPlayerCount }
      }
    }
    return null
  }, [flight, historicalLineMatchPlayers, historicalLineMatches, leagueName, matchDate, opponentPlayerPool, opponentTeam])

  function applyRecentHistoricalLineup() {
    if (!recentHistoricalLineup) return
    const playerById = new Map(myPlayerPool.map((player) => [player.id, player]))
    const alreadyAssignedPlayerIds = new Set(teamSlots.flatMap((slot) => slot.players.map((player) => player.playerId).filter(Boolean)))
    let filled = 0
    const nextSlots = teamSlots.map((slot, index) => {
      const historicalCourt = recentHistoricalLineup.courts.find((court) => court.lineNumber === index + 1)
        ?? recentHistoricalLineup.courts[index]
      if (!historicalCourt) return slot
      const remainingPlayerIds = [...historicalCourt.playerIds]
      const players = slot.players.map((player) => {
        if (player.playerId || player.playerName.trim()) return player
        const nextPlayerIndex = remainingPlayerIds.findIndex((playerId) => !alreadyAssignedPlayerIds.has(playerId))
        const nextPlayerId = nextPlayerIndex >= 0 ? remainingPlayerIds.splice(nextPlayerIndex, 1)[0] : undefined
        const nextPlayer = nextPlayerId ? playerById.get(nextPlayerId) : null
        if (!nextPlayer) return player
        alreadyAssignedPlayerIds.add(nextPlayer.id)
        filled += 1
        return { playerId: nextPlayer.id, playerName: nextPlayer.name }
      })
      return { ...slot, players }
    })

    if (!filled) {
      setMessage('Your court choices are already filled, so no recent players were added.')
      setError('')
      return
    }
    setTeamSlots(nextSlots)
    setMessage(`Filled ${filled} open player${filled === 1 ? '' : 's'} from the ${formatDate(recentHistoricalLineup.matchDate)} lineup vs ${recentHistoricalLineup.opponent}. Your existing court choices stayed in place.`)
    setError('')
  }

  function applyRecentHistoricalOpponentLineup() {
    if (!recentHistoricalOpponentLineup) return
    const playerById = new Map(opponentPlayerPool.map((player) => [player.id, player]))
    const alreadyAssignedPlayerIds = new Set(opponentSlots.flatMap((slot) => slot.players.map((player) => player.playerId).filter(Boolean)))
    let filled = 0
    const nextSlots = opponentSlots.map((slot, index) => {
      const historicalCourt = recentHistoricalOpponentLineup.courts.find((court) => court.lineNumber === index + 1)
        ?? recentHistoricalOpponentLineup.courts[index]
      if (!historicalCourt) return slot
      const remainingPlayerIds = [...historicalCourt.playerIds]
      const players = slot.players.map((player) => {
        if (player.playerId || player.playerName.trim()) return player
        const nextPlayerIndex = remainingPlayerIds.findIndex((playerId) => !alreadyAssignedPlayerIds.has(playerId))
        const nextPlayerId = nextPlayerIndex >= 0 ? remainingPlayerIds.splice(nextPlayerIndex, 1)[0] : undefined
        const nextPlayer = nextPlayerId ? playerById.get(nextPlayerId) : null
        if (!nextPlayer) return player
        alreadyAssignedPlayerIds.add(nextPlayer.id)
        filled += 1
        return { playerId: nextPlayer.id, playerName: nextPlayer.name }
      })
      return { ...slot, players }
    })

    setOpponentCourtSetupPromptOpen(false)
    if (!filled) {
      setMessage('Those opponent courts already have players selected, so the historic prefill did not replace them.')
      setError('')
      return
    }
    setOpponentSlots(nextSlots)
    setMessage(`Prefilled ${filled} open opponent spot${filled === 1 ? '' : 's'} from ${opponentTeam}'s ${formatDate(recentHistoricalOpponentLineup.matchDate)} lineup. Review or adjust any court before forecasting.`)
    setError('')
  }
  const builderReadiness = [
    {
      label: 'Potential lineup named',
      done: true,
      detail: scenarioName.trim() || 'A match-based name will be added when you save.',
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
  const assignedTeamReplySummary = useMemo(() => {
    const playerById = new Map(builderPlayers.map((player) => [player.id, player]))
    const availabilityByPlayerId = new Map(myPlayerPool.map((player) => [player.id, player.availabilityStatus]))
    const assigned = new Map<string, { name: string; label: ReturnType<typeof availabilityLabel> }>()

    for (const slot of teamSlots) {
      for (const selection of slot.players) {
        const playerId = selection.playerId.trim()
        const playerName = selection.playerName.trim()
        const key = playerId || playerName.toLowerCase()
        if (!key || assigned.has(key)) continue
        const player = playerId ? playerById.get(playerId) : undefined
        assigned.set(key, {
          name: player?.name || playerName || 'Player',
          label: availabilityLabel(playerId ? availabilityByPlayerId.get(playerId) : null),
        })
      }
    }

    const players = Array.from(assigned.values())
    const confirmed = players.filter((player) => player.label === 'Confirmed')
    const maybe = players.filter((player) => player.label === 'Maybe')
    const out = players.filter((player) => player.label === 'Out')
    const waiting = players.filter((player) => player.label === 'No response')
    return { players, confirmed, maybe, out, waiting }
  }, [builderPlayers, myPlayerPool, teamSlots])
  const finalLineupReady = teamLineupComplete
    && assignedTeamReplySummary.players.length > 0
    && assignedTeamReplySummary.confirmed.length === assignedTeamReplySummary.players.length
  const finalLineupReadinessTitle = finalLineupReady
    ? 'Every court is set and every selected player is in.'
    : !teamLineupComplete
      ? `${completedTeamCourtCount} of ${teamCourtProgress.length} courts are set.`
      : assignedTeamReplySummary.waiting.length
        ? `${assignedTeamReplySummary.waiting.length} selected player${assignedTeamReplySummary.waiting.length === 1 ? '' : 's'} still need${assignedTeamReplySummary.waiting.length === 1 ? 's' : ''} to reply.`
        : assignedTeamReplySummary.maybe.length
          ? `${assignedTeamReplySummary.maybe.length} selected player${assignedTeamReplySummary.maybe.length === 1 ? ' is' : 's are'} still maybe.`
          : assignedTeamReplySummary.out.length
            ? `${assignedTeamReplySummary.out.length} selected player${assignedTeamReplySummary.out.length === 1 ? ' is' : 's are'} out — adjust that court.`
            : 'Name a player on a court to start the final check.'
  const finalLineupReadinessDetail = finalLineupReady
    ? 'Review it in Team Room, then send the complete lineup with match details when you are ready.'
    : firstOpenTeamCourt
      ? `Finish ${firstOpenTeamCourt.label}: choose ${firstOpenTeamCourt.openPlayers} more player${firstOpenTeamCourt.openPlayers === 1 ? '' : 's'}.`
    : assignedTeamReplySummary.waiting.length
      ? `Waiting on ${assignedTeamReplySummary.waiting.slice(0, 2).map((player) => player.name).join(' and ')}${assignedTeamReplySummary.waiting.length > 2 ? ` and ${assignedTeamReplySummary.waiting.length - 2} more` : ''}.`
      : 'A player is selectable before they reply, but only an In reply clears the final lineup check.'
  const mobileLineupPulse = [
    {
      label: 'Courts',
      value: `${teamAssignedPlayerCount}/${teamRequiredPlayerCount}`,
      detail: teamLineupComplete ? 'Courts set' : firstOpenTeamCourt ? `Finish ${firstOpenTeamCourt.label}` : 'Choose players',
    },
    {
      label: 'Replies',
      value: `${assignedTeamReplySummary.confirmed.length}/${assignedTeamReplySummary.players.length}`,
      detail: assignedTeamReplySummary.players.length ? 'Players in' : 'Choose players',
    },
    {
      label: 'Roster',
      value: `${myPlayerPool.length}`,
      detail: myPlayerPool.length ? 'Full team pool' : 'Needs players',
    },
  ]
  const mobileCourtMap = analysis.lines.map((line) => {
    const probability = typeof line.projection === 'number' ? line.projection : null
    const edge = typeof line.diff === 'number' ? line.diff : null
    const status: 'Needs data' | 'Edge' | 'Protect' | 'Swing' = probability === null
      ? 'Needs data'
      : probability >= 0.58
        ? 'Edge'
        : probability <= 0.42
          ? 'Protect'
          : 'Swing'

    return {
      label: line.label,
      status,
      value: probability === null ? '-' : formatPercent(probability),
      detail: edge === null
        ? 'Complete both sides'
        : `${edge >= 0 ? '+' : ''}${edge.toFixed(2)} rating edge`,
      tone: (status === 'Edge' ? 'good' : status === 'Protect' ? 'warn' : status === 'Swing' ? 'info' : 'muted') as CourtMapTone,
    }
  })

  if (!authResolved) {
    return (
      <div style={pageWrap}>
        <div style={surfaceCard}>Loading lineup builder...</div>
      </div>
    )
  }

  if (role === 'public') {
    return null
  }

  if (!isCaptainAccess) {
    return (
      <LockedPlanPage
        active="/captain"
        withinShell
        planId="captain"
        headline="Still building lineups manually?"
        body="Captain unlocks saved scenarios, smarter lineup iterations, and prediction tracking so you can move from availability chaos to a clearer match-day plan."
        ctaLabel="Build Smarter Lineups"
        secondaryLabel="Back to Captain"
        secondaryHref="/captain"
      />
    )
  }

  return (
    <div style={pageWrap}>
         {!isMobile ? <CaptainSuitePanel active="lineup" teamLabel={teamName || 'Team week'} /> : null}
         <CaptainMatchWeekRail
           current="lineup"
           scope={{
             competitionLayer,
             team: teamName,
             league: leagueName,
             flight,
             date: matchDate,
             opponent: opponentTeam,
           }}
         />
         <section style={builderControlShellStyle(isMobile)} aria-label="Lineup controls">
          <span aria-hidden="true" style={watermarkStyle} />
          <div style={builderControlHeaderStyle}>
            <div>
              <p style={sectionKicker}>Lineup controls</p>
              <h1 style={builderControlTitleStyle}>Build a potential lineup.</h1>
              <div style={builderDraftStatusStyle} role="status" aria-live="polite">
                <span style={miniPillGreenStyle}>Draft saved on this phone</span>
                {currentScenarioId ? <span style={miniPillBlueStyle}>Saved lineup version</span> : null}
              </div>
            </div>
            <span style={lineupHasAssignments ? miniPillGreenStyle : miniPillSlateStyle}>
              {lineupHasAssignments ? `${teamAssignedPlayerCount}/${teamRequiredPlayerCount} selected` : 'Start lineup'}
            </span>
          </div>

          {isSmallMobile ? (
            <div style={builderMobileActionStackStyle}>
              {lineupHasAssignments ? (
                <PrimaryBtn onClick={() => saveScenario(false)} disabled={saving}>
                  {saving ? 'Saving...' : currentScenarioId ? 'Update saved lineup' : 'Save lineup'}
                </PrimaryBtn>
              ) : (
                <Link href="#captain-lineup-courts" style={primaryButton}>Build lineup</Link>
              )}
              <details style={builderMoreActionsStyle}>
                <summary style={builderMoreActionsSummaryStyle}>More lineup actions</summary>
                <div style={builderMoreActionsBodyStyle}>
                  <PrimaryBtn onClick={() => void saveAndConfirmPotentialLineupAvailability()} disabled={saving || preparingConfirmation}>
                    {saveAndAskLabel}
                  </PrimaryBtn>
                  <Link href={compareHref} style={hasComparisonCandidates ? primaryButton : disabledLinkButtonStyle}>Compare versions</Link>
                  <GhostBtn onClick={resetBuilder}>Reset Builder</GhostBtn>
                </div>
              </details>
            </div>
          ) : (
            <div style={builderControlRowStyle(isSmallMobile)}>
              <PrimaryBtn onClick={() => saveScenario(false)} disabled={saving}>
                {saving ? 'Saving...' : currentScenarioId ? 'Update lineup version' : 'Save lineup version'}
              </PrimaryBtn>
              <Link href={compareHref} style={hasComparisonCandidates ? primaryButton : disabledLinkButtonStyle}>Compare versions</Link>
              <PrimaryBtn onClick={() => void saveAndConfirmPotentialLineupAvailability()} disabled={saving || preparingConfirmation}>
                {saveAndAskLabel}
              </PrimaryBtn>
              <GhostBtn onClick={resetBuilder}>Reset Builder</GhostBtn>
            </div>
          )}
        </section>

        <section style={builderInsightToggleStyle} aria-label="Matchup insights">
          <div style={builderInsightCopyStyle}>
            <div>
              <p style={sectionKicker}>Optional</p>
              <h2 style={sectionTitleSmall}>Scouting &amp; matchup forecast</h2>
              <p style={subtleHelperTextStyle}>Build your lineup first. Open this when you want to project the opponent or see the match read.</p>
            </div>
            <span style={builderMode === 'insights' ? miniPillGreenStyle : miniPillSlateStyle}>
              {builderMode === 'insights' ? 'Open' : 'Optional'}
            </span>
          </div>
          <button
            type="button"
            aria-pressed={builderMode === 'insights'}
            onClick={() => {
              const openingInsights = builderMode !== 'insights'
              setBuilderMode(openingInsights ? 'insights' : 'manual')
              if (openingInsights) {
                window.requestAnimationFrame(() => {
                  document.getElementById('captain-lineup-insights')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                })
              }
            }}
            style={builderInsightButtonStyle}
          >
            {builderMode === 'insights' ? 'Back to my lineup' : 'Open matchup insights'}
          </button>
        </section>

        {!!message && <div role="status" aria-live="polite" style={bannerGreenStyle}>{message}</div>}
        {smsFallback ? (
          <div style={smsFallbackStyle}>
            <span style={smsFallbackCopyStyle}>If Messages did not open, tap once more.</span>
            <a href={smsFallback.href} style={smsFallbackLinkStyle}>
              Open Messages for {smsFallback.playerName.split(' ')[0] || 'player'}
            </a>
          </div>
        ) : null}
        {!!error && (
          <div role="alert" style={warningCardStyle}>
            <div>{error}</div>
            <div style={{ marginTop: 12 }}>
              <GhostSmallBtn onClick={() => setRefreshTick((current) => current + 1)}>Retry builder load</GhostSmallBtn>
            </div>
          </div>
        )}
        {savedLineupChangeDelivery ? (
          <section id="saved-lineup-change" style={savedLineupChangeStyle} aria-label="Saved lineup change delivery">
            <div style={savedLineupChangeCopyStyle}>
              <p style={sectionKicker}>Team Chat updated</p>
              <strong>
                {savedLineupChangeDelivery.replacementPlayerName} replaces {savedLineupChangeDelivery.outgoingPlayerName}
              </strong>
              <span>
                {savedLineupChangeDelivery.courtLabel}. {savedLineupChangeDelivery.pending
                  ? 'Nothing was sent yet. Notify only the players affected by this court.'
                  : savedLineupChangeDelivery.notifiedCount
                    ? `Sent to ${savedLineupChangeDelivery.notifiedCount} connected player${savedLineupChangeDelivery.notifiedCount === 1 ? '' : 's'}.`
                    : 'The direct-share update is ready.'}
              </span>
            </div>
            <div style={savedLineupChangeActionsStyle}>
              {savedLineupChangeDelivery.pending ? (
                <PrimaryBtn onClick={() => void notifySavedLineupChange()} disabled={notifyingLineupChange}>
                  {notifyingLineupChange
                    ? 'Notifying...'
                    : `Notify ${savedLineupChangeDelivery.affectedNames.length} affected`}
                </PrimaryBtn>
              ) : (
                <span style={miniPillGreenStyle}>Update sent</span>
              )}
              <GhostLink href={savedLineupChangeDelivery.href}>Open Team Chat</GhostLink>
            </div>
          </section>
        ) : null}
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
        {teamName && !loading && !recoveringSecureSession && !myPlayerPool.length ? (
          <section style={rosterRecoveryCardStyle} aria-labelledby="lineup-roster-setup-title">
            <div style={rosterRecoveryHeaderStyle}>
              <div>
                <p style={sectionKicker}>Roster needed</p>
                <h2 id="lineup-roster-setup-title" style={sectionTitleSmall}>Add your players to build this lineup.</h2>
                <p style={sectionBodyTextStyle}>
                  Upload the Team Summary, or enter player names now and connect ratings later.
                </p>
              </div>
              <span style={miniPillWarnStyle}>Setup required</span>
            </div>

            <div style={rosterRecoveryActionGridStyle}>
              <Link href={teamSummaryUploadHref} style={primaryButton}>Upload Team Summary</Link>
              <button
                type="button"
                onClick={() => setManualRosterOpen((current) => !current)}
                style={ghostButton}
                aria-expanded={manualRosterOpen}
                aria-controls="manual-lineup-roster"
              >
                {manualRosterOpen ? 'Close manual entry' : 'Enter players manually'}
              </button>
            </div>

            {manualRosterOpen ? (
              <div id="manual-lineup-roster" style={manualRosterEntryStyle}>
                <label htmlFor="manual-lineup-roster-names" style={labelStyle}>Player names</label>
                <textarea
                  id="manual-lineup-roster-names"
                  value={manualRosterText}
                  onChange={(event) => setManualRosterText(event.target.value)}
                  placeholder={'Alex Morgan\nJordan Lee\nTaylor Smith'}
                  rows={6}
                  style={manualRosterTextareaStyle}
                />
                <p style={subtleHelperTextStyle}>
                  Enter one player per line. These names save with this lineup; upload the Team Summary later to connect ratings. Add Player Roster only when you want team contact details.
                </p>
                <PrimaryBtn onClick={addManualRosterPlayers}>Add players to lineup</PrimaryBtn>
              </div>
            ) : null}

            <details style={rosterExportHelpStyle}>
              <summary style={rosterExportSummaryStyle}>How to export a Team Summary from TennisLink</summary>
              <ol style={rosterExportStepsStyle}>
                <li>Sign in to USTA TennisLink and open your league team.</li>
                <li>Open <strong>Team Summary</strong>.</li>
                <li>Choose <strong>Send To Excel</strong> and save the TeamSummary .xls file.</li>
                <li>Return here and choose <strong>Upload Team Summary</strong>. TiQ will bring you back to Build Lineup after import.</li>
                <li>Optional: if you are the captain, upload your <strong>Player Roster</strong> later to add the team contacts TennisLink provides.</li>
              </ol>
              <Link href="/resources/usta-upload#quick-guide" style={rosterExportVideoLinkStyle}>
                Watch the 1-minute Team Summary video guide
              </Link>
            </details>
          </section>
        ) : null}
        {opponentTeam ? (
          opponentPlayerPool.length ? (
            <section
              style={{
                ...opponentRosterReadyStyle,
                gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : opponentRosterReadyStyle.gridTemplateColumns,
              }}
              aria-label="Opponent roster ready"
            >
              <div style={opponentRosterRecoveryCopyStyle}>
                <span style={miniPillBlueStyle}>Opponent roster</span>
                <strong>{opponentPlayerPool.length} player{opponentPlayerPool.length === 1 ? '' : 's'} ready for {opponentTeam}.</strong>
                <span>{importedOpponentRosterCount ? 'TiQ ratings are available where matched.' : 'Names are ready now; upload the TennisLink Team Summary to connect TiQ ratings.'}</span>
              </div>
              <div style={opponentRosterRecoveryActionsStyle}>
                {!importedOpponentRosterCount ? <Link href={opponentSummaryUploadHref} style={ghostButton}>Add TennisLink roster</Link> : null}
                <button type="button" onClick={openOpponentCourts} style={primaryButton}>Set opponent courts</button>
              </div>
            </section>
          ) : (
            <section
              style={{
                ...opponentRosterRecoveryStyle,
                gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : opponentRosterRecoveryStyle.gridTemplateColumns,
              }}
              aria-label="Opponent roster options"
            >
              <div style={opponentRosterRecoveryCopyStyle}>
                <span style={miniPillBlueStyle}>Opponent roster</span>
                <strong>{opponentTeam} has not been added yet.</strong>
                <span>Enter names now, or add its TennisLink Team Summary for TiQ ratings.</span>
              </div>
              <div style={opponentRosterRecoveryActionsStyle}>
                <button
                  type="button"
                  onClick={() => setManualOpponentRosterOpen((current) => !current)}
                  style={ghostButton}
                  aria-expanded={manualOpponentRosterOpen}
                  aria-controls="manual-opponent-roster"
                >
                  {manualOpponentRosterOpen ? 'Close names' : 'Enter names'}
                </button>
                <Link href={opponentSummaryUploadHref} style={primaryButton}>Upload TennisLink roster</Link>
              </div>
              {manualOpponentRosterOpen ? (
                <div id="manual-opponent-roster" style={opponentRosterManualEntryStyle}>
                  <label htmlFor="manual-opponent-roster-names" style={labelStyle}>Opponent names</label>
                  <textarea
                    id="manual-opponent-roster-names"
                    value={manualOpponentRosterText}
                    onChange={(event) => setManualOpponentRosterText(event.target.value)}
                    placeholder={'Player one\nPlayer two'}
                    rows={3}
                    style={opponentRosterTextareaStyle}
                  />
                  <div style={opponentRosterManualActionsStyle}>
                    <span style={subtleHelperTextStyle}>One player per line. You can add ratings later.</span>
                    <PrimaryBtn onClick={addManualOpponentRosterPlayers}>Add opponents</PrimaryBtn>
                  </div>
                </div>
              ) : null}
            </section>
          )
        ) : null}

        {replacementHandoff ? (
          <section
            id="captain-lineup-handoff"
            style={{
              ...replacementHandoffStyle,
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : replacementHandoffStyle.gridTemplateColumns,
            }}
            aria-label="Suggested availability change"
          >
            <div style={replacementHandoffCopyStyle}>
              <p style={sectionKicker}>Suggested availability change</p>
              <strong>
                {suggestedSwapDraft ? 'Draft applied: ' : ''}
                {replacementHandoff.replacementPlayer} for {replacementHandoff.courtLabel}
              </strong>
              {suggestedSwapDraft ? (
                <span aria-live="polite">
                  Unsaved — review the court, then save the potential lineup.
                  {suggestedSwapDraft.needsConfirmation ? ` ${replacementHandoff.replacementPlayer}'s availability still needs confirmation.` : ''}
                </span>
              ) : (
                <span>
                  {replacementHandoff.outPlayer} is no longer confirmed. Apply this one change as an unsaved draft, then review and save it.
                </span>
              )}
              {suggestedSwapDraft ? suggestedSwapImpact?.court ? (
                <div style={suggestedSwapImpactGridStyle} aria-label="Projected draft impact">
                  <div style={suggestedSwapImpactCardStyle}>
                    <span style={suggestedSwapImpactLabelStyle}>Court win chance</span>
                    <strong>
                      {formatPercent(suggestedSwapImpact.court.before)} to {formatPercent(suggestedSwapImpact.court.after)}
                    </strong>
                    <small style={
                      suggestedSwapImpact.court.delta > 0
                        ? suggestedSwapImpactPositiveStyle
                        : suggestedSwapImpact.court.delta < 0
                          ? suggestedSwapImpactNegativeStyle
                          : suggestedSwapImpactNeutralStyle
                    }>
                      {formatProjectionPointDelta(suggestedSwapImpact.court.delta)}
                    </small>
                  </div>
                  {suggestedSwapImpact.overall ? (
                    <div style={suggestedSwapImpactCardStyle}>
                      <span style={suggestedSwapImpactLabelStyle}>Match win chance</span>
                      <strong>
                        {formatPercent(suggestedSwapImpact.overall.before)} to {formatPercent(suggestedSwapImpact.overall.after)}
                      </strong>
                      <small style={
                        suggestedSwapImpact.overall.delta > 0
                          ? suggestedSwapImpactPositiveStyle
                          : suggestedSwapImpact.overall.delta < 0
                            ? suggestedSwapImpactNegativeStyle
                            : suggestedSwapImpactNeutralStyle
                      }>
                        {formatProjectionPointDelta(suggestedSwapImpact.overall.delta)}
                      </small>
                    </div>
                  ) : null}
                </div>
              ) : (
                <small style={suggestedSwapImpactUnavailableStyle}>
                  Add the opponent court and player ratings to see the projected impact.
                </small>
              ) : null}
            </div>
            <div style={replacementHandoffActionsStyle}>
              <PrimaryBtn onClick={applySuggestedSwap} disabled={Boolean(suggestedSwapDraft) || loading || loadingScenarioId !== ''}>
                {suggestedSwapDraft ? 'Draft applied' : 'Apply suggested swap'}
              </PrimaryBtn>
              <GhostBtn onClick={() => focusTeamCourts(teamSlots, suggestedSwapCourt?.id)}>
                Review court
              </GhostBtn>
              {suggestedSwapDraft ? <GhostBtn onClick={undoSuggestedSwap}>Undo</GhostBtn> : null}
            </div>
          </section>
        ) : null}

        {isMobile ? (
          <>
            <section style={mobileCourtFocusStyle} aria-label="Lineup next decision">
              <div>
                <p style={sectionKicker}>Next decision</p>
                <h2 style={mobileCourtFocusTitleStyle}>{finalLineupReady ? 'Ready to send.' : finalLineupReadinessTitle}</h2>
                <p style={mobileCourtFocusTextStyle}>
                  {finalLineupReady
                    ? 'Every selected player is in. Send one clear lineup and match update to the team.'
                    : finalLineupReadinessDetail}
                </p>
                <div style={mobileLineupPulseStyle} aria-label="Lineup readiness pulse">
                  {mobileLineupPulse.map((item) => (
                    <div key={item.label} style={mobileLineupPulseCardStyle}>
                      <span style={mobileLineupPulseLabelStyle}>{item.label}</span>
                      <strong style={mobileLineupPulseValueStyle}>{item.value}</strong>
                      <small style={mobileLineupPulseDetailStyle}>{item.detail}</small>
                    </div>
                  ))}
                </div>
                {builderMode === 'insights' && mobileCourtMap.length ? (
                  <div style={mobileCourtMapShellStyle} aria-label="Court map">
                    <div style={mobileCourtMapHeaderStyle}>
                      <span style={mobileCourtMapTitleStyle}>Court map</span>
                      <span style={mobileCourtMapHintStyle}>Where to lean in</span>
                    </div>
                    <div style={mobileCourtMapGridStyle}>
                      {mobileCourtMap.map((court) => (
                        <div key={court.label} style={mobileCourtMapCardStyle(court.tone)}>
                          <span style={mobileCourtMapLabelStyle}>{court.label}</span>
                          <div style={mobileCourtMapValueRowStyle}>
                            <strong style={mobileCourtMapValueStyle}>{court.value}</strong>
                            <span style={mobileCourtMapStatusStyle(court.tone)}>{court.status}</span>
                          </div>
                          <span style={mobileCourtMapDetailStyle}>{court.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div style={mobileCourtFocusActionsStyle}>
                {finalLineupReady ? (
                  <Link href={teamRoomHref} style={primaryButton}>Send lineup to team</Link>
                ) : firstOpenTeamCourt ? (
                  <GhostBtn onClick={() => focusTeamCourts(teamSlots, firstOpenTeamCourt.id)}>Finish {firstOpenTeamCourt.label}</GhostBtn>
                ) : (
                  <GhostBtn onClick={() => focusTeamCourts()}>Review player replies</GhostBtn>
                )}
                {builderMode === 'manual' ? (
                  <GhostBtn onClick={openOpponentCourts}>Scout opponent &amp; forecast</GhostBtn>
                ) : (
                  <GhostBtn onClick={() => setBuilderMode('manual')}>Back to my lineup</GhostBtn>
                )}
                {recentHistoricalLineup ? (
                  <GhostBtn onClick={applyRecentHistoricalLineup}>Use recent lineup</GhostBtn>
                ) : null}
                <GhostBtn onClick={() => focusTeamCourts()}>Review courts</GhostBtn>
              </div>
            </section>

            {lineupHasAssignments ? (
              <section style={mobileFinalLineupPanelStyle} aria-label="Final lineup status" role="status" aria-live="polite">
                <div style={mobileFinalLineupHeaderStyle}>
                  <div style={mobileFinalLineupCopyStyle}>
                    <p style={sectionKicker}>Final lineup</p>
                    <strong>{finalLineupReadinessTitle}</strong>
                    <span>{finalLineupReadinessDetail}</span>
                  </div>
                  <span style={finalLineupReady ? miniPillGreenStyle : miniPillBlueStyle}>
                    {assignedTeamReplySummary.confirmed.length}/{assignedTeamReplySummary.players.length} in
                  </span>
                </div>
                <div style={mobileFinalLineupActionsStyle}>
                  {finalLineupReady ? (
                    <Link href={teamRoomHref} style={primaryButton}>Send lineup to team</Link>
                  ) : (
                    <GhostBtn onClick={() => focusTeamCourts()}>Review player replies</GhostBtn>
                  )}
                  <GhostBtn onClick={() => focusTeamCourts()}>Edit courts</GhostBtn>
                </div>
              </section>
            ) : null}
          </>
        ) : builderMode === 'insights' ? <section style={decisionBoardShellStyle}>
          <div style={decisionBoardHeaderStyle}>
            <div>
              <p style={sectionKicker}>Captain scorecard</p>
              <h2 style={decisionBoardTitleStyle}>Start with the decision.</h2>
              <p style={sectionBodyTextStyle}>
                Read the match, adjust the court that matters, then save or send the lineup.
              </p>
            </div>
            <span style={confidenceScore.value >= 0.75 ? miniPillGreenStyle : confidenceScore.value < 0.55 ? miniPillWarnStyle : miniPillBlueStyle}>
              {confidenceScore.label}
            </span>
          </div>

          <div style={decisionBoardGridStyle}>
            <div style={decisionHeroCardStyle}>
              <div style={decisionCardLabelStyle}>Projected result</div>
              <div style={decisionHeroValueStyle}>{expectedScoreline.label}</div>
              <div style={decisionCardTextStyle}>
                {formatPercent(analysis.projection)} win chance - {projectionTier(analysis.projection)}
              </div>
              <div style={decisionProgressTrackStyle}>
                <span style={{ ...decisionProgressFillStyle, width: `${Math.max(2, Math.min(100, Math.round(analysis.projection * 100)))}%` }} />
              </div>
            </div>

            <div style={decisionCompactCardStyle}>
              <div style={decisionCardLabelStyle}>Best edge</div>
              <div style={decisionCardValueStyle}>{bestLine?.label ?? 'Complete lineup'}</div>
              <div style={decisionCardTextStyle}>
                {bestLine && typeof bestLine.diff === 'number'
                  ? `${bestLine.diff >= 0 ? '+' : ''}${bestLine.diff.toFixed(2)} rating edge`
                  : 'Add both sides to reveal your strongest court.'}
              </div>
            </div>

            <div style={decisionCompactCardStyle}>
              <div style={decisionCardLabelStyle}>Court to watch</div>
              <div style={decisionCardValueStyle}>{swingLine?.label ?? weakestLine?.label ?? 'Not ready'}</div>
              <div style={decisionCardTextStyle}>
                {swingLine
                  ? 'Likeliest court to decide the match.'
                  : weakestLine
                    ? 'Biggest current pressure point.'
                    : 'Build more courts to unlock risk guidance.'}
              </div>
            </div>
          </div>

          <p style={optimizerActionHelpStyle}>
            {isTriLevel
              ? `Builds one eligible doubles pair for each level: ${triLevelRatings.map((rating) => rating.toFixed(1)).join(', ')}.`
              : 'Fills or replaces unlocked courts with the strongest projected lineup.'}{' '}
            This is a potential lineup. Review it, then confirm each player&apos;s availability before finalizing.
          </p>

          <div role="status" aria-live="polite" style={finalLineupReady ? bannerGreenStyle : bannerBlueStyle}>
            <div style={finalLineupGateHeaderStyle}>
              <div style={finalLineupGateCopyStyle}>
                <p style={sectionKicker}>Final lineup check</p>
                <strong>{finalLineupReadinessTitle}</strong>
                <span>{finalLineupReadinessDetail}</span>
              </div>
              <span style={finalLineupReady ? miniPillGreenStyle : miniPillBlueStyle}>
                {assignedTeamReplySummary.confirmed.length}/{assignedTeamReplySummary.players.length} in
              </span>
            </div>
            <div style={finalLineupGateActionsStyle}>
              {finalLineupReady ? (
                <GhostLink href={teamRoomHref}>Review final lineup</GhostLink>
              ) : (
                <GhostBtn onClick={() => focusTeamCourts()}>Review player replies</GhostBtn>
              )}
              <GhostBtn onClick={() => focusTeamCourts()}>Review courts</GhostBtn>
            </div>
          </div>

          <div style={decisionBoardActionRowStyle}>
            <PrimaryBtn onClick={() => applyOptimizedPlan('best')}>Apply best lineup</PrimaryBtn>
            <GhostBtn onClick={() => applyOptimizedPlan('safe')}>Reduce risk</GhostBtn>
            <GhostBtn onClick={() => void saveAndConfirmPotentialLineupAvailability()} disabled={saving || preparingConfirmation}>
              {saveAndAskLabel}
            </GhostBtn>
            <GhostBtn onClick={() => void refreshAvailabilityReplies()} disabled={refreshingReplies}>
              {refreshingReplies ? 'Refreshing replies...' : 'Refresh replies'}
            </GhostBtn>
            <GhostLink href={compareHref}>Compare versions</GhostLink>
            <GhostLink href={teamBriefHref}>Open team brief</GhostLink>
          </div>

          {appliedLineupNotice ? (
            <div id="captain-lineup-applied-next" role="status" aria-live="polite" style={appliedLineupNoticeStyle}>
              <div>
                <strong>{appliedLineupNotice.title} applied.</strong>{' '}
                {appliedLineupNotice.changedCourts
                  ? `${appliedLineupNotice.changedCourts} court${appliedLineupNotice.changedCourts === 1 ? '' : 's'} changed.`
                  : 'Your current court assignments were already the best match.'}{' '}
                {appliedLineupNotice.filledCourts} of {appliedLineupNotice.totalCourts} courts are complete.
              </div>
              <div style={appliedLineupNoticeFooterStyle}>
                <div style={appliedLineupNextCopyStyle}>
                  <strong>Next: ask your players</strong>
                  <span>Saves this lineup, then opens messages with the players and match details ready.</span>
                </div>
                <div style={appliedLineupActionStyle}>
                  <PrimaryBtn onClick={() => void saveAndConfirmPotentialLineupAvailability()} disabled={saving || preparingConfirmation}>
                    {saveAndAskLabel}
                  </PrimaryBtn>
                  <GhostBtn onClick={() => focusTeamCourts()}>Review lineup</GhostBtn>
                </div>
              </div>
            </div>
          ) : null}
        </section> : <section style={decisionBoardShellStyle} aria-label="Your lineup next">
          <div style={decisionBoardHeaderStyle}>
            <div>
              <p style={sectionKicker}>Your lineup next</p>
              <h2 style={decisionBoardTitleStyle}>{finalLineupReady ? 'Ready to send.' : finalLineupReadinessTitle}</h2>
              <p style={sectionBodyTextStyle}>Finish your courts and confirm your players. Opponent scouting is optional.</p>
            </div>
            <span style={finalLineupReady ? miniPillGreenStyle : miniPillBlueStyle}>{teamAssignedPlayerCount}/{teamRequiredPlayerCount} selected</span>
          </div>

          <div style={decisionBoardGridStyle}>
            <div style={decisionHeroCardStyle}>
              <div style={decisionCardLabelStyle}>Your courts</div>
              <div style={decisionHeroValueStyle}>{completedTeamCourtCount}/{teamCourtProgress.length}</div>
              <div style={decisionCardTextStyle}>{teamLineupComplete ? 'Every court has a pair.' : firstOpenTeamCourt ? `${firstOpenTeamCourt.label} still needs ${firstOpenTeamCourt.openPlayers} player${firstOpenTeamCourt.openPlayers === 1 ? '' : 's'}.` : 'Choose your players.'}</div>
            </div>
            <div style={decisionCompactCardStyle}>
              <div style={decisionCardLabelStyle}>Player replies</div>
              <div style={decisionCardValueStyle}>{assignedTeamReplySummary.confirmed.length}/{assignedTeamReplySummary.players.length} in</div>
              <div style={decisionCardTextStyle}>{assignedTeamReplySummary.waiting.length ? `${assignedTeamReplySummary.waiting.length} still need to reply.` : assignedTeamReplySummary.maybe.length ? `${assignedTeamReplySummary.maybe.length} are still maybe.` : assignedTeamReplySummary.out.length ? 'Replace any player marked out.' : 'Replies are ready.'}</div>
            </div>
            <div style={decisionCompactCardStyle}>
              <div style={decisionCardLabelStyle}>Opponent scouting</div>
              <div style={decisionCardValueStyle}>Optional</div>
              <div style={decisionCardTextStyle}>Open it when you want matchup projections and court edges.</div>
            </div>
            {recentHistoricalLineup ? (
              <div style={decisionCompactCardStyle}>
                <div style={decisionCardLabelStyle}>Recent team history</div>
                <div style={decisionCardValueStyle}>{recentHistoricalLineup.returningPlayerCount} returning</div>
                <div style={decisionCardTextStyle}>{recentHistoricalLineupDetail}</div>
              </div>
            ) : null}
          </div>

          <div style={decisionBoardActionRowStyle}>
            {finalLineupReady ? (
              <Link href={teamRoomHref} style={primaryButton}>Send lineup to team</Link>
            ) : firstOpenTeamCourt ? (
              <GhostBtn onClick={() => focusTeamCourts(teamSlots, firstOpenTeamCourt.id)}>Finish {firstOpenTeamCourt.label}</GhostBtn>
            ) : (
              <GhostBtn onClick={() => focusTeamCourts()}>Review player replies</GhostBtn>
            )}
            {recentHistoricalLineup ? (
              <GhostBtn onClick={applyRecentHistoricalLineup}>Use recent lineup</GhostBtn>
            ) : null}
            <GhostBtn onClick={openOpponentCourts}>Scout opponent &amp; forecast</GhostBtn>
            <GhostBtn onClick={() => focusTeamCourts()}>Review my courts</GhostBtn>
            <GhostLink href={compareHref}>Compare versions</GhostLink>
          </div>
        </section>}

        {lineupVersionComparison && comparisonScenario ? (
          <section id="captain-lineup-version-compare" style={lineupVersionCompareShellStyle} aria-label="Saved lineup comparison">
            <div style={lineupVersionCompareHeaderStyle}>
              <div>
                <p style={sectionKicker}>Version compare</p>
                <h2 style={sectionTitleSmall}>What changed?</h2>
                <p style={sectionBodyTextStyle}>Working draft vs {lineupVersionComparison.baselineName}. Review the difference before you ask the team.</p>
              </div>
              <label style={lineupVersionCompareSelectLabelStyle} htmlFor="lineup-version-compare-select">
                <span>Compare against</span>
                <select
                  id="lineup-version-compare-select"
                  value={comparisonScenario.id}
                  onChange={(event) => setComparisonScenarioId(event.target.value)}
                  style={lineupVersionCompareSelectStyle}
                >
                  {comparisonCandidates.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>{scenario.scenario_name || 'Untitled saved version'}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={lineupVersionCompareGridStyle}>
              <div style={lineupVersionCompareCardStyle('info')}>
                <span style={lineupVersionCompareLabelStyle}>Match outlook</span>
                <strong style={lineupVersionCompareValueStyle}>
                  {lineupVersionComparison.fullyProjected
                    ? `${formatPercent(lineupVersionComparison.baselineProjection)} to ${formatPercent(analysis.projection)}`
                    : 'Needs both lineups'}
                </strong>
                <span style={lineupVersionCompareDetailStyle}>
                  {lineupVersionComparison.fullyProjected
                    ? formatProjectionPointDelta(lineupVersionComparison.overallDelta)
                    : 'Complete team and opponent courts first'}
                </span>
              </div>
              <div style={lineupVersionCompareCardStyle(lineupVersionComparison.changedCourts.length ? 'good' : 'muted')}>
                <span style={lineupVersionCompareLabelStyle}>Courts changed</span>
                <strong style={lineupVersionCompareValueStyle}>{lineupVersionComparison.changedCourts.length}</strong>
                <span style={lineupVersionCompareDetailStyle}>
                  {lineupVersionComparison.changedCourts.length ? 'Player or opponent assignments moved' : 'Same court assignments'}
                </span>
              </div>
              <div style={lineupVersionCompareCardStyle(lineupVersionComparison.biggestShift?.delta && lineupVersionComparison.biggestShift.delta < 0 ? 'warn' : 'info')}>
                <span style={lineupVersionCompareLabelStyle}>Biggest shift</span>
                <strong style={lineupVersionCompareValueStyle}>{lineupVersionComparison.biggestShift?.label ?? 'No court read'}</strong>
                <span style={lineupVersionCompareDetailStyle}>
                  {typeof lineupVersionComparison.biggestShift?.delta === 'number'
                    ? formatProjectionPointDelta(lineupVersionComparison.biggestShift.delta)
                    : 'No projection change yet'}
                </span>
              </div>
            </div>

            <div style={lineupVersionCompareCallStyle}>
              <span style={lineupVersionCompareLabelStyle}>Captain call</span>
              <strong>{lineupVersionComparison.recommendation}</strong>
              {lineupVersionComparison.playerSwap ? (
                <span>
                  {lineupVersionComparison.playerSwap.label}: {lineupVersionComparison.playerSwap.beforePlayers} → {lineupVersionComparison.playerSwap.afterPlayers}
                </span>
              ) : null}
            </div>

            {lineupVersionComparison.changedCourts.length ? (
              <div style={lineupVersionCompareCourtGridStyle}>
                {lineupVersionComparison.changedCourts.slice(0, 4).map((court) => (
                  <div key={court.label} style={lineupVersionCompareCourtStyle}>
                    <span style={lineupVersionCompareLabelStyle}>{court.label}</span>
                    <strong>{court.beforePlayers} → {court.afterPlayers}</strong>
                    <span style={lineupVersionCompareDetailStyle}>
                      {typeof court.delta === 'number'
                        ? `${formatPercent(court.before)} to ${formatPercent(court.after)} · ${formatProjectionPointDelta(court.delta)}`
                        : 'Complete both court reads to see the impact'}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <details style={isMobile ? hiddenMobileContextStyle : surfaceCard}>
          <summary style={detailsSummaryStyle}>
            <div>
              <p style={sectionKicker}>Match context</p>
              <h3 style={sectionTitleSmall}>Team, opponent, date</h3>
            </div>
            <span style={miniPillBlueStyle}>{currentScenarioId ? 'saved scenario' : 'draft scenario'}</span>
          </summary>

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
              <div style={contextSummaryLabelStyle}>Time / location</div>
              <div style={contextSummaryValueStyle}>{formatMatchContext(selectedMatch)}</div>
            </div>
            <div style={contextSummaryCardStyle}>
              <div style={contextSummaryLabelStyle}>Scenario</div>
              <div style={contextSummaryValueStyle}>{scenarioName.trim() || 'Untitled scenario'}</div>
            </div>
          </div>

          <div style={contextSummaryInsightStyle}>
            {!teamName || !opponentTeam || !matchDate
              ? 'Choose a team and scheduled match so the opponent, date, time, and location stay tied to imported schedule data.'
              : 'Your scenario is tied to an imported schedule match, so save, compare, and messaging can use the same match context.'}
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
        </details>

        <details style={isMobile ? hiddenMobileContextStyle : surfaceCard}>
          <summary style={detailsSummaryStyle}>
            <div>
              <p style={sectionKicker}>Builder readiness</p>
              <h3 style={sectionTitleSmall}>Setup checklist</h3>
            </div>
            <span style={miniPillBlueStyle}>{readinessCompleteCount}/4 complete</span>
          </summary>

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
              : 'Finish the setup items above first, then save and compare real lineup decisions instead of placeholders.'}
          </div>
        </details>

        <div style={builderLayoutResponsive(isTablet)}>
          <div style={columnStyle}>
            <details
              open={matchSetupOpen}
              onToggle={(event) => setMatchSetupOpen(event.currentTarget.open)}
              style={surfaceCardStrong}
            >
              <summary style={detailsSummaryStyle}>
                <div>
                  <p style={sectionKicker}>Match setup</p>
                  <h2 style={sectionTitle}>{hasCoreContext ? 'Match ready' : 'Pick the match'}</h2>
                  <p style={sectionBodyTextStyle}>
                    {matchSetupSummary}
                  </p>
                </div>
                <span style={hasCoreContext ? miniPillGreenStyle : miniPillBlueStyle}>
                  {hasCoreContext ? 'Ready' : 'Needs match'}
                </span>
              </summary>

              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Match details</p>
                  <h3 style={sectionTitleSmall}>Edit this match</h3>
                  <p style={sectionBodyTextStyle}>
                    Choose the team and match. A clear name is added automatically if you leave it blank.
                  </p>
                </div>

                <div style={actionRowStyle}>
                  <PrimaryBtn onClick={() => saveScenario(false)} disabled={saving}>
                    {saving ? 'Saving...' : currentScenarioId ? 'Update potential lineup' : 'Save potential lineup'}
                  </PrimaryBtn>
                  <GhostBtn onClick={() => saveScenario(true)} disabled={saving}>Save as new</GhostBtn>
                  <GhostBtn onClick={() => void trackPredictionSnapshot('manual-track')} disabled={trackingSnapshot}>
                    {trackingSnapshot ? 'Tracking...' : 'Track snapshot'}
                  </GhostBtn>
                </div>
              </div>

              <div style={filtersGridStyle}>
                <Field label="Lineup name (optional)" htmlFor="lineup-builder-scenario-name">
                  <input id="lineup-builder-scenario-name" value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} style={inputStyle} placeholder="Added automatically" />
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
                <Field label="Match format" htmlFor="lineup-builder-match-format" hint="Detected from USTA names or loaded from a TiQ league. Change it only when local rules use a different scorecard.">
                  <select
                    id="lineup-builder-match-format"
                    value={selectedMatchFormatId}
                    onChange={(event) => setSelectedMatchFormatId(event.target.value as TeamMatchFormatId | 'auto')}
                    style={inputStyle}
                  >
                    <option value="auto">Automatic · {resolvedMatchFormat.label}</option>
                    {TEAM_MATCH_FORMATS.map((format) => (
                      <option key={format.id} value={format.id}>{format.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Match date" htmlFor="lineup-builder-date">
                  <input id="lineup-builder-date" type="date" value={matchDate} readOnly style={readOnlyInputStyle} />
                </Field>
                <Field label="Team" htmlFor="lineup-builder-team">
                  <input
                    id="lineup-builder-team"
                    list="team-options"
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value)
                      setSelectedMatchId('')
                    }}
                    style={inputStyle}
                    placeholder="Your team"
                  />
                  <datalist id="team-options">
                    {teamOptions.map((item) => <option key={item} value={item} />)}
                  </datalist>
                </Field>
                <Field label="Scheduled match" htmlFor="lineup-builder-match" hint="Opponent, date, time, and location are driven by imported schedule data.">
                  <select
                    id="lineup-builder-match"
                    value={selectedMatchId}
                    onChange={(e) => setSelectedMatchId(e.target.value)}
                    style={inputStyle}
                    disabled={!teamName || scopedMatchOptions.length === 0}
                  >
                    <option value="">Select scheduled match</option>
                    {scopedMatchOptions.map((match) => {
                      const opponent = getOpponentForTeam(match, teamName) || [match.home_team, match.away_team].filter(Boolean).join(' vs ')
                      return (
                        <option key={match.id} value={match.id}>
                          {opponent} - {formatMatchContext(match)}
                        </option>
                      )
                    })}
                  </select>
                </Field>
                <Field label="Opponent" htmlFor="lineup-builder-opponent">
                  <input id="lineup-builder-opponent" value={opponentTeam} readOnly style={readOnlyInputStyle} placeholder="Select a scheduled match" />
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
                  placeholder="Anything captains should remember for this build..."
                />
              </Field>

              {!isCaptainAccess ? (
                <UpgradePrompt
                  planId="captain"
                  compact
                  headline="Need to save versions and track lineup decisions?"
                  body="Captain turns this from a draft board into a real weekly lineup plan with saved scenarios, prediction tracking, and a cleaner path into comparison and messaging."
                  ctaLabel="Unlock Captain"
                  ctaHref="/pricing"
                  secondaryLabel="See Captain plan"
                  secondaryHref="/pricing"
                />
              ) : null}

              <div style={toggleRowStyle}>
                <label style={checkLabelStyle}>
                  <input type="checkbox" checked={availabilityOnly} onChange={(e) => setAvailabilityOnly(e.target.checked)} />
                  Show only players who replied
                </label>
                <label style={checkLabelStyle}>
                  <input type="checkbox" checked={hideUnavailable} onChange={(e) => setHideUnavailable(e.target.checked)} />
                  Hide players marked out
                </label>
              </div>
            </details>

            <details style={surfaceCard}>
              <summary style={detailsSummaryStyle}>
                <div>
                  <p style={sectionKicker}>Saved versions</p>
                  <h3 style={sectionTitleSmall}>Load or manage lineup drafts</h3>
                </div>
                <span style={miniPillBlueStyle}>{scenarioOptions.length} in scope</span>
              </summary>

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
                        {loadingScenarioId === scenario.id ? 'Loading...' : 'Load'}
                      </GhostSmallBtn>
                      <GhostSmallBtn onClick={() => void deleteScenario(scenario.id)} disabled={deletingScenarioId === scenario.id}>
                        {deletingScenarioId === scenario.id ? 'Deleting...' : 'Delete'}
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
            </details>

            <section id="captain-lineup-courts" style={surfaceCardStrong}>
              {backupHandoff ? (
                <div id="captain-backup-handoff" style={backupHandoffStyle} role="status">
                  <div>
                    <p style={sectionKicker}>Match-day backup</p>
                    <strong>{backupSelectionDraft
                      ? `${backupSelectionDraft.replacementPlayerName} replaces ${backupHandoff.playerName}`
                      : `Prepare backup for ${backupHandoff.playerName}`}</strong>
                    <span>{backupSelectionDraft
                      ? `${backupHandoff.courtLabel} is ready. Save it to return to Team Room and send the court update.`
                      : `${backupHandoff.courtLabel} is highlighted. Available players are already filtered. Choose one below.`}</span>
                  </div>
                  {backupSelectionDraft ? (
                    <PrimaryBtn onClick={() => void saveScenario(false)} disabled={saving}>
                      {saving ? 'Saving backup...' : 'Save backup & return'}
                    </PrimaryBtn>
                  ) : <span style={miniPillWarnStyle}>Choose player</span>}
                </div>
              ) : null}
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Your lineup</p>
                  <h2 style={sectionTitle}>Build your team courts</h2>
                </div>
                <div style={actionRowStyle}>
                  {!isFixedLineupFormat ? (
                    <>
                    <GhostSmallBtn onClick={() => addSlot('team', 'singles')}>+ Singles</GhostSmallBtn>
                    <GhostSmallBtn onClick={() => addSlot('team', 'doubles')}>+ Doubles</GhostSmallBtn>
                    </>
                  ) : null}
                  <GhostLink href={teamContactsHref}>Team contacts</GhostLink>
                </div>
              </div>

              {teamRoomReplyCounts && !loading ? (
                <div role="status" aria-live="polite" style={teamRoomReplyCounts.total ? bannerGreenStyle : bannerBlueStyle}>
                  {teamRoomReplyCounts.total
                    ? `Team replies applied: ${teamRoomReplyCounts.yes} In${teamRoomReplyCounts.maybe ? ` · ${teamRoomReplyCounts.maybe} Maybe` : ''}. Out players are hidden.`
                    : 'No linked replies yet. Showing the full roster.'}
                </div>
              ) : null}

              {hasPendingCourtReplies ? (
                <div role="status" aria-live="polite" style={bannerBlueStyle}>
                  Waiting for player replies. TiQ is checking automatically while this Builder stays open.
                </div>
              ) : null}

              {directCourtTextHandoff && !hasPreparedDirectCourtText ? (
                <div role="status" aria-live="polite" style={directCourtTextBannerStyle}>
                  <div style={directCourtTextCopyStyle}>
                    <p style={sectionKicker}>Private court check</p>
                    <strong>{nextDirectCourtTextPlayer
                      ? `${directCourtTextHandoff.courtLabel}: text ${nextDirectCourtTextPlayer.playerName} next.`
                      : `${directCourtTextHandoff.courtLabel}: every selected player has been texted.`}</strong>
                    <span>{nextDirectCourtTextPlayer
                      ? 'The Builder keeps this court in place while you privately confirm this player.'
                      : 'Keep building the rest of the lineup. Replies will refresh when you return.'}</span>
                  </div>
                  <div style={directCourtTextActionStyle}>
                    {nextDirectCourtTextPlayer ? (
                      <PrimaryBtn onClick={() => openDirectCourtText(nextDirectCourtTextPlayer)}>
                        Text {nextDirectCourtTextPlayer.playerName.split(' ')[0]}
                      </PrimaryBtn>
                    ) : (
                      <GhostBtn onClick={() => saveDirectCourtTextHandoff(null)}>Clear check</GhostBtn>
                    )}
                  </div>
                </div>
              ) : null}

              {isFixedLineupFormat ? (
                <div style={triLevelFormatStyle}>
                  <strong>{resolvedMatchFormat.label} · {matchFormatSummary.courts} courts</strong>
                  <span>
                    {isTriLevel
                      ? triLevelRatings.length === 3
                        ? `One court at each level: ${triLevelRatings.map((rating) => rating.toFixed(1)).join(' · ')}. Choose two eligible players for each court.`
                        : 'Three doubles courts, one for each level. Add the three levels to the league or flight name to enforce player ratings.'
                      : `${resolvedMatchFormat.description} ${matchFormatSummary.players} players fill the scorecard.`}
                  </span>
                  <span><strong>{competitionRules.eligibilityTitle}.</strong> {competitionRules.eligibilityDetail}</span>
                </div>
              ) : null}

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
                    autoLockedPlayerIds={autoLockedConfirmedPlayerIdSet}
                    releasedConfirmedPlayerIds={releasedConfirmedPlayerIdSet}
                    fixedFormat={isFixedLineupFormat}
                    competitionRules={competitionRules}
                    onAskPlayers={askProposedCourtPlayers}
                    onSavePlayerPhone={saveCourtPlayerPhone}
                    missingPhonePlayerKeys={new Set(missingPhonePlayerKeys)}
                    inlinePhoneByPlayerKey={inlinePhoneByPlayerKey}
                    onInlinePhoneChange={(playerKey, value) => setInlinePhoneByPlayerKey((current) => ({ ...current, [playerKey]: value }))}
                    savingPhonePlayerKey={savingPhonePlayerKey}
                    getPreparedCourtText={(targetSlot, player) => preparedCourtTexts[getPreparedCourtTextKey(targetSlot, player)]}
                    onOpenPreparedCourtText={markPreparedCourtTextOpened}
                  openedCourtTextKeys={openedCourtTextKeySet}
                  askingPlayers={askingCourtId === slot.id}
                  focused={backupFocusSlot?.id === slot.id}
                  isMobileLayout={isMobile}
                  expanded={!isMobile || backupFocusSlot?.id === slot.id || expandedTeamSlotId === slot.id}
                  onToggleExpanded={() => setExpandedTeamSlotId((current) => current === slot.id ? '' : slot.id)}
                />
                ))}
              </div>
            </section>
          </div>

          <div style={columnStyle}>
            <details id="captain-lineup-insights" open={builderMode === 'insights'} style={surfaceCardStrong}>
              <summary style={detailsSummaryStyle}>
                <div>
                  <p style={sectionKicker}>Opponent + insights</p>
                  <h2 style={sectionTitleSmall}>Project the matchup</h2>
                </div>
                <span style={miniPillBlueStyle}>{builderMode === 'insights' ? 'Open' : 'Optional'}</span>
              </summary>
            <section id="opponent-lineup" style={surfaceCardStrong}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Opponent lineup</p>
                  <h2 style={sectionTitle}>Project the other side</h2>
                </div>
                {!isFixedLineupFormat ? (
                  <div style={actionRowStyle}>
                    <GhostSmallBtn onClick={() => addSlot('opponent', 'singles')}>+ Singles</GhostSmallBtn>
                    <GhostSmallBtn onClick={() => addSlot('opponent', 'doubles')}>+ Doubles</GhostSmallBtn>
                  </div>
                ) : null}
              </div>

              {opponentCourtSetupPromptOpen ? (
                <section style={opponentCourtSetupChoiceStyle} aria-label="Choose opponent court setup">
                  <div>
                    <p style={sectionKicker}>Start opponent courts</p>
                    <h3 style={sectionTitleSmall}>How do you want to begin?</h3>
                    <p style={sectionBodyTextStyle}>Use their latest known courts as a quick draft, or choose the players yourself.</p>
                  </div>
                  <div style={actionRowStyleWrap}>
                    {recentHistoricalOpponentLineup ? (
                      <PrimaryBtn onClick={applyRecentHistoricalOpponentLineup}>
                        Prefill from last lineup
                      </PrimaryBtn>
                    ) : null}
                    <GhostBtn onClick={() => {
                      setOpponentCourtSetupPromptOpen(false)
                      setMessage('Choose the opponent players and courts you expect. You can adjust them any time.')
                      setError('')
                    }}>
                      Select players manually
                    </GhostBtn>
                  </div>
                  {recentHistoricalOpponentLineup ? (
                    <div style={opponentCourtSetupHistoryStyle}>
                      <strong>{recentHistoricalOpponentLineup.returningPlayerCount} returning player{recentHistoricalOpponentLineup.returningPlayerCount === 1 ? '' : 's'}</strong>
                      <span>Latest known lineup: {formatDate(recentHistoricalOpponentLineup.matchDate)} vs {recentHistoricalOpponentLineup.opponent}. Existing court choices stay in place.</span>
                    </div>
                  ) : (
                    <p style={subtleHelperTextStyle}>No prior opponent lineup is available yet, so manual selection is ready.</p>
                  )}
                </section>
              ) : null}

              {isFixedLineupFormat ? (
                <div style={triLevelFormatStyle}>
                  <strong>Project the same {resolvedMatchFormat.label.toLowerCase()}</strong>
                  <span>{resolvedMatchFormat.slots.map((slot) => slot.label).join(' · ')}</span>
                </div>
              ) : null}

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
                    autoLockedPlayerIds={new Set()}
                    releasedConfirmedPlayerIds={new Set()}
                    fixedFormat={isFixedLineupFormat}
                    competitionRules={competitionRules}
                    onAskPlayers={undefined}
                    askingPlayers={false}
                    isMobileLayout={isMobile}
                  />
                ))}
              </div>

              {opponentAssignedPlayerCount ? (
                <div role="status" aria-live="polite" style={{ ...bannerBlueStyle, marginTop: 16 }}>
                  <strong>{opponentLineupComplete ? 'Opponent lineup projected.' : 'Opponent courts updated.'}</strong>{' '}
                  {opponentAssignedPlayerCount}/{opponentRequiredPlayerCount} opponent player spots selected.{' '}
                  <button type="button" onClick={openMatchForecast} style={inlineActionButtonStyle}>
                    View matchup forecast
                  </button>
                </div>
              ) : null}
            </section>

            {!isMobile || !teamLineupComplete ? <details style={surfaceCardStrong}>
              <summary style={detailsSummaryStyle}>
                <div>
                  <p style={sectionKicker}>{teamLineupComplete ? 'Lineup tools' : 'Auto-build'}</p>
                  <h2 style={sectionTitleSmall}>{teamLineupComplete ? 'Rebuild only if you need to' : 'Build a recommended draft'}</h2>
                </div>
                <span style={teamLineupComplete ? miniPillGreenStyle : miniPillBlueStyle}>
                  {teamLineupComplete ? 'Your courts set' : `${activeLockCount} lock${activeLockCount === 1 ? '' : 's'}`}
                </span>
              </summary>
              <p style={sectionBodyTextStyle}>
                {teamLineupComplete
                  ? 'Your lineup is already built. Open this only to rebuild unlocked courts, adjust locks, or review alternates.'
                  : 'TiQ fills a balanced first draft from your roster and keeps any court or player locks in place. Review the courts after it builds.'}
              </p>

              {!teamLineupComplete ? <PrimaryBtn onClick={applyRecommendedTeamLineup}>Auto-build my lineup</PrimaryBtn> : null}

              <details style={surfaceCard}>
                <summary style={detailsSummaryStyle}>
                  <div>
                    <p style={sectionKicker}>Build options</p>
                    <h3 style={sectionTitleSmall}>Locks, opponent, and alternates</h3>
                  </div>
                  <span style={miniPillSlateStyle}>{activeLockCount} lock{activeLockCount === 1 ? '' : 's'}</span>
                </summary>

                <div style={actionRowStyleWrap}>
                  {teamLineupComplete ? <GhostBtn onClick={applyRecommendedTeamLineup}>Rebuild unlocked courts</GhostBtn> : null}
                  <GhostBtn onClick={rebuildAroundLocks}>Rebuild around locks</GhostBtn>
                  <GhostBtn onClick={clearLocks}>Reset locks</GhostBtn>
                  {opponentPlayerPool.length ? <GhostBtn onClick={applyRecommendedOpponentLineup}>Auto-fill opponent</GhostBtn> : null}
                </div>

                <div style={heroBadgeRowStyleCompact}>
                  <span style={badgeGreen}>Recommended win chance {formatPercent(eliteRecommendation.analysis.projection)}</span>
                  <span style={badgeBlue}>Edge {analysis.avgDiff.toFixed(2)}</span>
                  <span style={badgeSlate}>{eliteRecommendation.bench.length} alternates</span>
                </div>

                <div style={lockPanelStyle}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Locks</p>
                      <h3 style={sectionTitleSmall}>What stays in place</h3>
                    </div>
                    <span style={miniPillSlateStyle}>{activeLockCount} active</span>
                  </div>
                  <div style={lockGridStyle}>
                    <div style={lockSummaryCardStyle}>
                      <div style={lockSummaryLabelStyle}>Locked lines</div>
                      <div style={lockSummaryValueStyle}>{lockedSlotIds.length}</div>
                      <div style={lockSummaryTextStyle}>Keep whole courts exactly as built.</div>
                    </div>
                    <div style={lockSummaryCardStyle}>
                      <div style={lockSummaryLabelStyle}>Locked players</div>
                      <div style={lockSummaryValueStyle}>{activePlayerLockCount}</div>
                      <div style={lockSummaryTextStyle}>Confirmed players lock automatically. Unlock one only when you need to move them.</div>
                    </div>
                  </div>
                </div>

                {lineupWarnings.length ? (
                  <div style={stackStyle}>{lineupWarnings.map((warning) => <div key={warning} style={warningCardStyle}>{warning}</div>)}</div>
                ) : <div style={bannerGreenStyle}>No lineup conflicts detected.</div>}

                <div style={{ marginTop: 16 }}>
                  <div style={sectionKicker}>Alternates</div>
                  <div style={stackStyleCompact}>
                    {eliteRecommendation.bench.length ? eliteRecommendation.bench.map((player) => {
                      const rStatus = getLineupRatingStatus(player)
                      return (
                        <div key={player.id} style={listCardStyleCompact}>
                          <div>
                            <div style={listTitleStyle}>{player.name}</div>
                            <div style={listMetaStyle}>TiQ {formatRating(player.overall_dynamic_rating ?? player.overall_rating)} · USTA {formatRating(player.overall_usta_dynamic_rating ?? player.overall_rating)}</div>
                          </div>
                          <div style={rightPillStackStyle}>
                            <span style={{ ...miniPillSlateStyle, ...statusTone(player.availabilityStatus) }}>{player.availabilityStatus || 'unknown'}</span>
                            {rStatus ? <span style={getLineupStatusStyle(rStatus)}>{rStatus}</span> : null}
                          </div>
                        </div>
                      )
                    }) : <p style={mutedTextStyle}>No alternates are left after the recommendation fills the lineup.</p>}
                  </div>
                </div>
              </details>
            </details> : null}

            {!isMobile ? <details style={surfaceCardStrong}>
              <summary style={detailsSummaryStyle}>
                <div>
                  <p style={sectionKicker}>Match insight</p>
                  <h2 style={sectionTitle}>How to win this match</h2>
                </div>
                <span style={miniPillBlueStyle}>{formatPercent(analysis.projection)} outlook</span>
              </summary>

              <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                <div style={bannerBlueStyle}>
                  <strong>Match outlook:</strong> {projectionTier(analysis.projection)} - {formatPercent(analysis.projection)} win probability
                </div>

                {bestLine ? (
                  <div style={bannerGreenStyle}>
                    <strong>Best edge:</strong> {bestLine.label} ({typeof bestLine.diff === 'number' ? `${bestLine.diff >= 0 ? '+' : ''}${bestLine.diff.toFixed(2)}` : '-'})
                  </div>
                ) : null}

                {weakestLine ? (
                  <div style={warningCardStyle}>
                    <strong>Biggest risk:</strong> {weakestLine.label} ({typeof weakestLine.diff === 'number' ? `${weakestLine.diff >= 0 ? '+' : ''}${weakestLine.diff.toFixed(2)}` : '-'})
                  </div>
                ) : null}

                {swingLine ? (
                  <div style={bannerBlueStyle}>
                    <strong>Swing match:</strong> {swingLine.label} - this likely decides the match
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
            </details> : null}

            {!isMobile ? <details style={surfaceCard}>
              <summary style={detailsSummaryStyle}>
                <div>
                  <p style={sectionKicker}>More strategies</p>
                  <h3 style={sectionTitleSmall}>Compare optimizer options</h3>
                </div>
                <span style={miniPillSlateStyle}>{bestOptimizedPlan ? `${bestOptimizedPlan.score.toFixed(1)} top score` : '-'}</span>
              </summary>

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
            </details> : null}
            </details>
          </div>

          {builderMode === 'insights' ? <div style={columnStyle}>
            <details
              id="captain-lineup-match-forecast"
              open={isMobile ? mobileForecastOpen : true}
              onToggle={(event) => {
                if (isMobile) setMobileForecastOpen(event.currentTarget.open)
              }}
              style={isMobile ? surfaceCardStrong : desktopInsightsDisclosureStyle}
            >
              <summary style={isMobile ? detailsSummaryStyle : desktopInsightsDisclosureSummaryStyle}>
                <div>
                  <p style={sectionKicker}>Match forecast</p>
                  <h2 style={sectionTitleSmall}>Scorecard, strategy, and next steps</h2>
                </div>
                <span style={miniPillBlueStyle}>{formatPercent(analysis.projection)} outlook</span>
              </summary>
              <div style={isMobile ? stackStyle : columnStyle}>
            <section style={surfaceCardStrong}>
              <p style={sectionKicker}>Scorecard</p>
              <h2 style={sectionTitle}>What this lineup says</h2>

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
                {analysis.lines.map((line) => {
                  const pct = typeof line.projection === 'number' ? Math.round(line.projection * 100) : null
                  const isFavored = pct !== null && pct >= 50
                  const isSwing = pct !== null && pct >= 45 && pct <= 55
                  return (
                    <div key={line.label} style={{ ...listCardStyleCompact, flexDirection: 'column' as const, gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                        <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          <div style={listTitleStyle}>{line.label}{isSwing ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'rgba(250,204,21,0.12)', color: '#fde047', border: '1px solid rgba(250,204,21,0.22)' }}>swing</span> : null}</div>
                          <div style={listMetaStyle}>
                            You {formatRating(line.yourRating)} - Opp {formatRating(line.opponentRating)} - {typeof line.diff === 'number' ? `${line.diff >= 0 ? '+' : ''}${line.diff.toFixed(2)}` : '-'}
                          </div>
                          <div style={listMetaStyle}>
                            {formatSlotPlayerNames(line.teamPlayers, 'Team spots open')} vs {formatSlotPlayerNames(line.opponentPlayers, 'Opponent spots open')}
                          </div>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 900, color: isFavored ? '#86efac' : pct !== null ? '#fca5a5' : 'var(--shell-copy-muted)', flexShrink: 0 }}>
                          {pct !== null ? `${pct}%` : '-'}
                        </span>
                      </div>
                      {pct !== null ? (
                        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: isFavored ? 'linear-gradient(90deg,rgba(52,211,153,0.5),rgba(134,239,172,0.7))' : 'linear-gradient(90deg,rgba(239,68,68,0.4),rgba(252,165,165,0.55))', borderRadius: 999, transition: 'width 300ms ease', minWidth: 4 }} />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
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

              <div style={decisionQueueGridStyle}>
                {captainDecisionQueue.map((card) => (
                  <div key={card.title} style={toneCardStyle(card.tone)}>
                    <div style={actionPlanLabelStyle}>{card.title}</div>
                    <div style={listMetaStyleStrong}>{card.body}</div>
                  </div>
                ))}
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
                  <p style={sectionKicker}>Why</p>
                  <h3 style={sectionTitleSmall}>What stands out</h3>
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
                  <p style={sectionKicker}>Next actions</p>
                  <h3 style={sectionTitleSmall}>Save, compare, send</h3>
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
                  {saving ? 'Saving...' : 'Save lineup version'}
                </PrimaryBtn>
                <GhostBtn onClick={() => saveScenario(true)} disabled={saving}>Save as new</GhostBtn>
                <GhostBtn onClick={() => void trackPredictionSnapshot('command-deck-track')} disabled={trackingSnapshot}>
                  {trackingSnapshot ? 'Tracking...' : 'Track snapshot'}
                </GhostBtn>
                <PrimaryBtn onClick={() => void saveAndConfirmPotentialLineupAvailability()} disabled={saving || preparingConfirmation}>
                  {saveAndAskLabel}
                </PrimaryBtn>
                <GhostLink href={compareHref}>Compare versions</GhostLink>
              </div>
              <p style={subtleHelperTextStyle}>Your draft saves automatically on this phone. Save a version when you are ready to compare it, share it, or track replies.</p>

              {!isCaptainAccess ? (
                <div style={{ marginTop: 16 }}>
                  <UpgradePrompt
                    planId="captain"
                    compact
                    headline="Want this lineup to move cleanly from build to execution?"
                    body="Captain is the unlock that connects save states, prediction history, scenario comparison, and team messaging so lineup work actually reduces weekly chaos."
                    ctaLabel="Build Smarter Lineups"
                    ctaHref="/pricing"
                    secondaryLabel="Compare plans"
                    secondaryHref="/pricing"
                  />
                </div>
              ) : null}
            </section>

            <details style={surfaceCard}>
              <summary style={detailsSummaryStyle}>
                <div>
                  <p style={sectionKicker}>Player pool</p>
                  <h3 style={sectionTitleSmall}>Team roster</h3>
                </div>
                <span style={miniPillSlateStyle}>{myPlayerPool.length} team players</span>
              </summary>

              <div style={stackStyleCompact}>
                {myPlayerPool.length ? (
                  <p style={subtleHelperTextStyle}>
                    {myAvailabilitySummary.confirmed} confirmed · {myAvailabilitySummary.maybe} maybe · {myAvailabilitySummary.noResponse} no response · {myAvailabilitySummary.out} out. No-response players remain selectable; Save &amp; ask players sends their confirmation request.
                  </p>
                ) : null}
                {myPlayerPool.length ? myPlayerPool.map((player) => {
                  const rStatus = getLineupRatingStatus(player)
                  const eligibilityLabels = getPlayerEligibilitySourceLabel({
                    ratingSource: player.rating_source,
                    ageDivision: player.roster_age_division,
                    mixedPairRole: competitionRules.requiresMixedPair ? player.mixed_pair_role : 'unknown',
                  })
                  return (
                    <div key={player.id} style={listCardStyleCompact}>
                      <div>
                        <div style={listTitleStyle}>{player.name}</div>
                        <div style={listMetaStyle}>
                          OVR {formatRating(player.overall_dynamic_rating ?? player.overall_rating)} - S {formatRating(player.singles_dynamic_rating ?? player.singles_rating)} - D {formatRating(player.doubles_dynamic_rating ?? player.doubles_rating)}{player.location ? ` - ${player.location}` : ''}
                        </div>
                        {player.lineup_notes ? <div style={tinyNoteStyle}>{player.lineup_notes}</div> : null}
                        {eligibilityLabels.length ? <div style={tinyNoteStyle}>{eligibilityLabels.join(' · ')}</div> : null}
                      </div>

                      <div style={rightPillStackStyle}>
                        <span style={{ ...miniPillSlateStyle, ...statusTone(player.availabilityStatus) }}>
                          {availabilityLabel(player.availabilityStatus)}
                        </span>
                        {rStatus ? <span style={getLineupStatusStyle(rStatus)}>{rStatus}</span> : null}
                        {teamAssignedPlayerIds.has(player.id) ? <span style={miniPillBlueStyle}>assigned</span> : null}
                      </div>
                    </div>
                  )
                }) : (
                  <div style={stackStyleCompact}>
                    <p style={mutedTextStyle}>
                      {loading ? 'Loading player pool...' : 'No players match the current scope.'}
                    </p>
                    {!loading ? (
                      <p style={subtleHelperTextStyle}>
                        Check the team, league, flight, and availability toggles first. This builder stays tightly scoped, so an empty pool usually means the context is too narrow or the roster has not been linked yet.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </details>
              </div>
            </details>
          </div> : (
            <div style={columnStyle}>
              <details style={surfaceCard}>
                <summary style={detailsSummaryStyle}>
                  <div>
                    <p style={sectionKicker}>Insights</p>
                    <h3 style={sectionTitleSmall}>Recommendations and matchup stats</h3>
                  </div>
                  <span style={miniPillBlueStyle}>{formatPercent(analysis.projection)} outlook</span>
                </summary>
                <p style={sectionBodyTextStyle}>
                  Keep building yourself, or switch on TiQ insights to compare recommended lineups, opponent matchups, and the rating evidence behind each option.
                </p>
                <div style={{ marginTop: 14 }}>
                  <PrimaryBtn onClick={() => setBuilderMode('insights')}>Open TiQ insights</PrimaryBtn>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
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
  autoLockedPlayerIds,
  releasedConfirmedPlayerIds,
  fixedFormat,
  competitionRules,
  onAskPlayers,
  onSavePlayerPhone,
  missingPhonePlayerKeys,
  inlinePhoneByPlayerKey,
  onInlinePhoneChange,
  savingPhonePlayerKey,
  getPreparedCourtText,
  onOpenPreparedCourtText,
  openedCourtTextKeys,
  askingPlayers,
  focused = false,
  isMobileLayout = false,
  expanded = true,
  onToggleExpanded,
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
  autoLockedPlayerIds: Set<string>
  releasedConfirmedPlayerIds: Set<string>
  fixedFormat: boolean
  competitionRules: TeamCompetitionRules
  onAskPlayers?: (slot: LineupSlot, player: LineupSlot['players'][number]) => void
  onSavePlayerPhone?: (slot: LineupSlot, player: LineupSlot['players'][number]) => void
  missingPhonePlayerKeys?: Set<string>
  inlinePhoneByPlayerKey?: Record<string, string>
  onInlinePhoneChange?: (playerKey: string, value: string) => void
  savingPhonePlayerKey?: string
  getPreparedCourtText?: (slot: LineupSlot, player: LineupSlot['players'][number]) => PreparedCourtText | undefined
  onOpenPreparedCourtText?: (preparedText: PreparedCourtText) => void
  openedCourtTextKeys?: Set<string>
  askingPlayers: boolean
  focused?: boolean
  isMobileLayout?: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
}) {
  const selectablePlayerPool = playerPool.filter((player) =>
    isPlayerEligibleForSlot(player, slot, competitionRules) || slot.players.some((selected) => selected.playerId === player.id)
  )
  const selectedPlayers = slot.players.filter((player) => player.playerId && player.playerName.trim())
  const askablePlayers = selectedPlayers.filter((player) => {
    const selectedPoolPlayer = playerPool.find((poolPlayer) => poolPlayer.id === player.playerId)
    return availabilityLabel(selectedPoolPlayer?.availabilityStatus) !== 'Confirmed'
  })
  const compactSelectionSummary = selectedPlayers.length
    ? selectedPlayers.map((player) => player.playerName).join(' · ')
    : slot.players.length === 1 ? 'Choose a player' : `Choose ${slot.players.length} players`
  const compactReplySummary = selectedPlayers.length
    ? selectedPlayers.map((player) => {
        const selectedPoolPlayer = playerPool.find((poolPlayer) => poolPlayer.id === player.playerId)
        return availabilityLabel(selectedPoolPlayer?.availabilityStatus)
      }).join(' · ')
    : 'Needs players'
  const showCompactMobileCourt = isMobileLayout && !expanded
  return (
    <div
      id={`captain-lineup-slot-${slot.id}`}
      style={focused ? { ...slotCardStyle, ...focusedSlotCardStyle } : slotCardStyle}
      tabIndex={focused ? -1 : undefined}
    >
      {showCompactMobileCourt ? (
        <button
          type="button"
          aria-expanded={false}
          aria-controls={`captain-lineup-slot-editor-${slot.id}`}
          onClick={onToggleExpanded}
          style={compactCourtTriggerStyle}
        >
          <span style={compactCourtTriggerHeaderStyle}>
            <span style={compactCourtLabelStyle}>{slot.label}</span>
            <span style={miniPillSlateStyle}>{selectedPlayers.length}/{slot.players.length} set</span>
          </span>
          <span style={compactCourtSelectionStyle}>{compactSelectionSummary}</span>
          <span style={compactCourtTriggerFooterStyle}>
            <span style={compactCourtStatusStyle}>{compactReplySummary}</span>
            <span style={compactCourtEditStyle}>Edit court</span>
          </span>
        </button>
      ) : (
        <div id={`captain-lineup-slot-editor-${slot.id}`} style={slotEditorBodyStyle}>
          <div style={slotHeaderStyle}>
            <div style={slotHeaderLeftStyle}>
              {fixedFormat ? (
                <strong style={fixedSlotLabelStyle}>{slot.label}</strong>
              ) : (
                <input
                  aria-label={`${side} slot label`}
                  value={slot.label}
                  onChange={(e) => onLabelChange(side, slot.id, e.target.value)}
                  style={slotLabelInputStyle}
                />
              )}
              <span style={miniPillSlateStyle}>{slot.slotType}</span>
              {side === 'team' ? (
                <button type="button" aria-pressed={lockedSlotIds.has(slot.id)} style={lockedSlotIds.has(slot.id) ? pillButtonActive : pillButton} onClick={() => toggleLockedSlot(slot.id)}>
                  {lockedSlotIds.has(slot.id) ? 'line locked' : 'lock line'}
                </button>
              ) : null}
            </div>

            <div style={slotHeaderActionsStyle}>
              {isMobileLayout && onToggleExpanded ? (
                <GhostSmallBtn onClick={onToggleExpanded}>Done</GhostSmallBtn>
              ) : null}
              {!fixedFormat ? <GhostSmallBtn onClick={() => onRemove(side, slot.id)}>Remove</GhostSmallBtn> : null}
            </div>
          </div>

          <div style={slotPlayersGridStyle}>
        {slot.players.map((player, index) => {
          const selectedPoolPlayer = player.playerId
            ? playerPool.find((poolPlayer) => poolPlayer.id === player.playerId)
            : null
          const selectedReplyLabel = side === 'team'
            ? availabilityLabel(selectedPoolPlayer?.availabilityStatus)
            : 'No response'
          const selectedReplyStyle = selectedReplyLabel === 'Confirmed'
            ? selectedPlayerInFieldStyle
            : selectedReplyLabel === 'Out'
              ? selectedPlayerOutFieldStyle
              : undefined
          const playerKey = normalizeCaptainRosterContactKey(player.playerName)
          const needsPhone = Boolean(missingPhonePlayerKeys?.has(playerKey))
          const isAutoLocked = autoLockedPlayerIds.has(player.playerId)
          const isConfirmedReleased = selectedReplyLabel === 'Confirmed' && releasedConfirmedPlayerIds.has(player.playerId)
          const preparedCourtText = side === 'team' && player.playerId
            ? getPreparedCourtText?.(slot, player)
            : undefined
          const askSignal = side === 'team' && player.playerId
            ? getCourtAskSignal({
                replyLabel: selectedReplyLabel,
                prepared: Boolean(preparedCourtText),
                opened: Boolean(preparedCourtText && openedCourtTextKeys?.has(preparedCourtText.key)),
                preparing: askingPlayers,
                needsPhone,
              })
            : null
          const showAskSignal = !isMobileLayout || askSignal?.tone !== 'ready'

          return (
            <div
              key={`${slot.id}-${index}`}
              style={selectedReplyLabel === 'Confirmed'
                ? { ...slotPlayerRowStyle, ...confirmedPlayerRowStyle }
                : slotPlayerRowStyle}
            >
              <select
                aria-label={`${slot.label} player ${index + 1}`}
                value={player.playerId}
                onChange={(e) => onPlayerChange(side, slot.id, index, e.target.value)}
                style={selectedReplyStyle
                  ? { ...(isMobileLayout ? mobileSelectInputStyle : inputStyle), ...selectedReplyStyle }
                  : isMobileLayout ? mobileSelectInputStyle : inputStyle}
              >
                <option value="">Select player</option>
                {player.playerId && !selectedPoolPlayer ? (
                  <option value={player.playerId}>{player.playerName || 'Saved player'} · saved draft</option>
                ) : null}
                {selectablePlayerPool.map((poolPlayer) => {
                  const disabled =
                    poolPlayer.id !== player.playerId &&
                    assignedPlayerIds.has(poolPlayer.id) &&
                    side === 'team'

                  return (
                    <option key={poolPlayer.id} value={poolPlayer.id} disabled={disabled}>
                      {poolPlayer.name} · {availabilityLabel(poolPlayer.availabilityStatus)} · {typeof slot.ratingLevel === 'number' ? `NTRP ${formatRating(getPlayerBaseRating(poolPlayer))}` : `OVR ${formatRating(poolPlayer.overall_dynamic_rating ?? poolPlayer.overall_rating)}`}
                    </option>
                  )
                })}
              </select>

              {side === 'team' && player.playerId ? (
                <div style={isMobileLayout
                  ? {
                      ...mobileSlotPlayerActionRowStyle,
                      gridTemplateColumns: showAskSignal ? 'minmax(0, 1fr) auto' : 'auto',
                      justifyContent: showAskSignal ? undefined : 'start',
                    }
                  : slotPlayerActionRowStyle}>
                  {showAskSignal && askSignal ? (
                    <span style={courtAskSignalStyle(askSignal.tone)} title={askSignal.detail}>
                      {askSignal.label}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-pressed={lockedPlayerIds.has(player.playerId)}
                    aria-label={isAutoLocked
                      ? `${player.playerName} is confirmed and locked. Unlock player.`
                      : isConfirmedReleased
                        ? `Re-lock confirmed player ${player.playerName}.`
                        : undefined}
                    style={lockedPlayerIds.has(player.playerId)
                      ? isAutoLocked
                        ? { ...confirmedPlayerLockButtonStyle, ...(isMobileLayout ? mobilePlayerLockButtonStyle : {}) }
                        : { ...pillButtonActive, ...(isMobileLayout ? mobilePlayerLockButtonStyle : {}) }
                      : { ...pillButton, ...(isMobileLayout ? mobilePlayerLockButtonStyle : {}) }}
                    onClick={() => toggleLockedPlayer(player.playerId)}
                  >
                    {lockedPlayerIds.has(player.playerId)
                      ? isAutoLocked ? 'Unlock' : 'Locked'
                      : isConfirmedReleased ? 'Re-lock' : 'Yes & lock'}
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
          </div>

          {side === 'team' && onAskPlayers && askablePlayers.length ? (
        <div style={isMobileLayout
          ? {
              ...mobileReplacementHandoffActionsStyle,
              gridTemplateColumns: askablePlayers.length === 1 ? 'minmax(0, 1fr)' : mobileReplacementHandoffActionsStyle.gridTemplateColumns,
            }
          : replacementHandoffActionsStyle}>
          {askablePlayers.map((player) => {
            const preparedText = getPreparedCourtText?.(slot, player)
            const playerKey = normalizeCaptainRosterContactKey(player.playerName)
            const needsPhone = Boolean(missingPhonePlayerKeys?.has(playerKey))
            if (preparedText && onOpenPreparedCourtText) {
              return (
                <a
                  key={player.playerId || player.playerName}
                  href={preparedText.href}
                  onClick={() => onOpenPreparedCourtText(preparedText)}
                  style={isMobileLayout ? mobileSmsFallbackLinkStyle : smsFallbackLinkStyle}
                >
                  Ask {player.playerName.split(' ')[0]}
                </a>
              )
            }

            return (
              <div
                key={player.playerId || player.playerName}
                style={isMobileLayout
                  ? needsPhone ? mobileCourtAskControlWithPhoneStyle : mobileCourtAskControlStyle
                  : courtAskControlStyle}
              >
                <GhostSmallBtn onClick={() => onAskPlayers(slot, player)} disabled={askingPlayers} fullWidth={isMobileLayout}>
                  {askingPlayers ? 'Preparing...' : `Ask ${player.playerName.split(' ')[0]}`}
                </GhostSmallBtn>
                {needsPhone && onSavePlayerPhone && onInlinePhoneChange ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      onSavePlayerPhone(slot, player)
                    }}
                    style={isMobileLayout ? mobileCourtPhoneFormStyle : courtPhoneFormStyle}
                  >
                    <label htmlFor={`captain-lineup-phone-${slot.id}-${playerKey}`} style={courtPhoneLabelStyle}>
                      Add {player.playerName.split(' ')[0]}’s mobile number
                    </label>
                    <input
                      id={`captain-lineup-phone-${slot.id}-${playerKey}`}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={inlinePhoneByPlayerKey?.[playerKey] || ''}
                      onChange={(event) => onInlinePhoneChange(playerKey, event.target.value)}
                      placeholder="Mobile number"
                      required
                      style={inputStyle}
                    />
                    <GhostSmallBtn type="submit" disabled={savingPhonePlayerKey === playerKey} fullWidth={isMobileLayout}>
                      {savingPhonePlayerKey === playerKey ? 'Saving mobile...' : 'Save mobile & prepare Ask'}
                    </GhostSmallBtn>
                  </form>
                ) : null}
              </div>
            )
          })}
          <span style={isMobileLayout ? mobileCourtAskHelperStyle : mutedTextStyle}>
            Private reply links stay with this court.
          </span>
        </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '18px 0 64px',
  display: 'grid',
  gap: 18,
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
}

const replacementHandoffStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 14,
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(155, 225, 29, 0.28)',
  background: 'linear-gradient(135deg, rgba(155, 225, 29, 0.12), rgba(49, 154, 230, 0.08))',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const replacementHandoffCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
}

const replacementHandoffActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
}

const mobileReplacementHandoffActionsStyle: CSSProperties = {
  ...replacementHandoffActionsStyle,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  alignItems: 'stretch',
  width: '100%',
  gap: 10,
}

const savedLineupChangeStyle: CSSProperties = {
  ...replacementHandoffStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  border: '1px solid rgba(116, 190, 255, 0.3)',
  background: 'linear-gradient(135deg, rgba(116, 190, 255, 0.11), rgba(155, 225, 29, 0.07))',
}

const savedLineupChangeCopyStyle: CSSProperties = {
  ...replacementHandoffCopyStyle,
}

const savedLineupChangeActionsStyle: CSSProperties = {
  ...replacementHandoffActionsStyle,
  justifyContent: 'flex-end',
}

const suggestedSwapImpactGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  marginTop: 4,
  minWidth: 0,
}

const suggestedSwapImpactCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: '3px 8px',
  minWidth: 0,
  border: '1px solid rgba(155, 225, 29, 0.2)',
  borderRadius: 12,
  background: 'rgba(5, 15, 30, 0.48)',
  padding: '9px 10px',
}

const suggestedSwapImpactLabelStyle: CSSProperties = {
  gridColumn: '1 / -1',
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const suggestedSwapImpactPositiveStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: 'nowrap',
}

const suggestedSwapImpactNegativeStyle: CSSProperties = {
  color: '#fca5a5',
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: 'nowrap',
}

const suggestedSwapImpactNeutralStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: 'nowrap',
}

const suggestedSwapImpactUnavailableStyle: CSSProperties = {
  marginTop: 3,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
}

const builderControlShellStyle = (isMobile: boolean): CSSProperties => ({
  position: 'relative',
  display: 'grid',
  gap: isMobile ? 14 : 16,
  padding: isMobile ? 18 : 22,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2,8,23,0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflow: 'hidden',
})

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 'clamp(-92px, -7vw, -34px)',
  bottom: 'clamp(-112px, -10vw, -52px)',
  width: 'clamp(230px, 30vw, 420px)',
  aspectRatio: '1552 / 1614',
  background: 'url("/brand/web/header-iq-compact.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}

const builderControlHeaderStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
}

const builderControlTitleStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.45rem, 2.5vw, 2.1rem)',
  lineHeight: 1.08,
  letterSpacing: 0,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const builderDraftStatusStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  alignItems: 'center',
  marginTop: 10,
  minWidth: 0,
}

const builderControlRowStyle = (isSmallMobile: boolean): CSSProperties => ({
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: isSmallMobile
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 12,
  minWidth: 0,
})

const builderMobileActionStackStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 8,
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  borderRadius: 18,
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%), var(--shell-chip-bg))',
}

const builderMoreActionsStyle: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  borderRadius: 14,
  background: 'var(--shell-chip-bg)',
  overflow: 'hidden',
}

const builderMoreActionsSummaryStyle: CSSProperties = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 12px',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
}

const builderMoreActionsBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '0 8px 8px',
}

const builderLayoutResponsive = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
  gap: 22,
  minWidth: 0,
})

const builderInsightToggleStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: '14px 16px',
  borderRadius: 18,
  border: '1px solid rgba(96,165,250,0.2)',
  background: 'rgba(8,13,28,0.48)',
  minWidth: 0,
}

const builderInsightCopyStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const builderInsightButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minWidth: 0,
  minHeight: 44,
  padding: '10px 14px',
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.28)',
  background: 'rgba(30,64,175,0.18)',
  color: '#dbeafe',
  fontSize: 14,
  fontWeight: 900,
  overflowWrap: 'anywhere',
  cursor: 'pointer',
}

const desktopInsightsDisclosureStyle: CSSProperties = {
  display: 'contents',
  minWidth: 0,
}

const desktopInsightsDisclosureSummaryStyle: CSSProperties = {
  display: 'none',
}

const columnStyle: CSSProperties = {
  display: 'grid',
  gap: 22,
  alignContent: 'start',
  minWidth: 0,
}

const surfaceCardStrong: CSSProperties = {
  borderRadius: 26,
  padding: 22,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8,13,28,0.64)',
  boxShadow: '0 18px 45px rgba(2,8,23,0.30)',
  minWidth: 0,
}

const surfaceCard: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8,13,28,0.60)',
  boxShadow: '0 16px 42px rgba(2,8,23,0.26)',
  minWidth: 0,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 18,
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionKicker: CSSProperties = {
  margin: 0,
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const sectionTitle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--foreground)',
  fontSize: 26,
  lineHeight: 1.08,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const sectionTitleSmall: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground)',
  fontSize: 20,
  lineHeight: 1.1,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const sectionBodyTextStyle: CSSProperties = {
  marginTop: 10,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
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
  colorScheme: 'dark',
  minWidth: 0,
  boxSizing: 'border-box',
}

const mobileSelectInputStyle: CSSProperties = {
  ...inputStyle,
  padding: '0 38px 0 12px',
  fontSize: 15,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const readOnlyInputStyle: CSSProperties = {
  ...inputStyle,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  cursor: 'default',
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
  minWidth: 0,
}

const labelStyle: CSSProperties = {
  display: 'block',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
  overflowWrap: 'anywhere',
}

const filtersGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const contextSummaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const contextSummaryCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const contextSummaryLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const contextSummaryValueStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 800,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const contextSummaryInsightStyle: CSSProperties = {
  marginTop: 14,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const sharedNotesCardStyle: CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gap: 14,
  padding: '16px 18px',
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const sharedNotesBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const sharedNotesLabelStyle: CSSProperties = {
  color: '#dbeafe',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const sharedNotesTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const toggleRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 18,
  marginTop: 16,
  minWidth: 0,
}

const checkLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 44,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  flexWrap: 'wrap',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 46,
  padding: '0 18px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  textDecoration: 'none',
  cursor: 'pointer',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 46,
  padding: '0 18px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 800,
  textDecoration: 'none',
  cursor: 'pointer',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
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
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const actionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const actionRowStyleWrap: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  marginTop: 14,
  minWidth: 0,
}

const stackStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const stackStyleCompact: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
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
  flexWrap: 'wrap',
  minWidth: 0,
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
  flexWrap: 'wrap',
  minWidth: 0,
}

const listTitleStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 800,
  fontSize: 15,
  overflowWrap: 'anywhere',
}

const listMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 4,
  overflowWrap: 'anywhere',
}

const listMetaStyleStrong: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
  marginTop: 4,
  overflowWrap: 'anywhere',
}

const tinyNoteStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  marginTop: 6,
  overflowWrap: 'anywhere',
}

const slotCardStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 16,
  minWidth: 0,
}

const slotEditorBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const compactCourtTriggerStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  width: '100%',
  minWidth: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'var(--foreground)',
  textAlign: 'left',
  cursor: 'pointer',
}

const compactCourtTriggerHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const compactCourtLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const compactCourtSelectionStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 14,
  lineHeight: 1.4,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const compactCourtTriggerFooterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const compactCourtStatusStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const compactCourtEditStyle: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 900,
  whiteSpace: 'nowrap',
}

const focusedSlotCardStyle: CSSProperties = {
  border: '2px solid color-mix(in srgb, var(--brand-green) 72%, var(--shell-panel-border))',
  boxShadow: '0 0 0 4px color-mix(in srgb, var(--brand-green) 12%, transparent)',
}

const backupHandoffStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 12,
  alignItems: 'center',
  marginBottom: 14,
  border: '1px solid rgba(251, 191, 36, 0.34)',
  borderRadius: 14,
  background: 'rgba(120, 53, 15, 0.2)',
  padding: 12,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.45,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const slotHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const slotHeaderLeftStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
  minWidth: 0,
}

const slotLabelInputStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg-strong)',
  color: 'var(--foreground)',
  padding: '8px 12px',
  width: 'min(100%, 180px)',
  minWidth: 0,
  outline: 'none',
}

const fixedSlotLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const triLevelFormatStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  marginBottom: 14,
  padding: '13px 15px',
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 30%, var(--shell-panel-border) 70%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const slotPlayersGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const slotPlayerRowStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const confirmedPlayerRowStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 72%, transparent)',
  borderRadius: 16,
  padding: 10,
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(16,185,129,0.04))',
  boxShadow: '0 0 0 2px color-mix(in srgb, var(--brand-green) 10%, transparent)',
}

const slotPlayerActionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const mobileSlotPlayerActionRowStyle: CSSProperties = {
  ...slotPlayerActionRowStyle,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'stretch',
  width: '100%',
}

const slotHeaderActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const mobilePlayerLockButtonStyle: CSSProperties = {
  minHeight: 32,
  minWidth: 78,
  padding: '0 11px',
  whiteSpace: 'nowrap',
}

const courtAskControlStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  maxWidth: '100%',
}

const mobileCourtAskControlStyle: CSSProperties = {
  ...courtAskControlStyle,
  width: '100%',
  gridTemplateColumns: 'minmax(0, 1fr)',
}

const mobileCourtAskControlWithPhoneStyle: CSSProperties = {
  ...mobileCourtAskControlStyle,
  gridColumn: '1 / -1',
}

const mobileCourtAskHelperStyle: CSSProperties = {
  gridColumn: '1 / -1',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
}

const courtPhoneFormStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 8,
  minWidth: 0,
  maxWidth: '100%',
  padding: 10,
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 34%, var(--shell-panel-border) 66%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-chip-bg) 92%)',
}

const mobileCourtPhoneFormStyle: CSSProperties = {
  ...courtPhoneFormStyle,
  width: '100%',
  boxSizing: 'border-box',
  padding: 12,
  gap: 10,
}

const courtPhoneLabelStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const selectedPlayerInFieldStyle: CSSProperties = {
  border: '2px solid var(--brand-green)',
  boxShadow: '0 0 0 3px color-mix(in srgb, var(--brand-green) 15%, transparent)',
}

const selectedPlayerOutFieldStyle: CSSProperties = {
  border: '2px solid #fb7185',
  boxShadow: '0 0 0 3px rgba(251, 113, 133, 0.14)',
}

const tableHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  marginBottom: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const detailsSummaryStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  cursor: 'pointer',
  listStyle: 'none',
  marginBottom: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const decisionSnapshotGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 12,
  marginTop: 10,
  minWidth: 0,
}

const decisionBoardShellStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
  minWidth: 0,
}

const lineupVersionCompareShellStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 20,
  borderRadius: 24,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-panel-border) 72%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-blue-2) 10%, var(--shell-panel-bg-strong) 90%), var(--shell-chip-bg))',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
  minWidth: 0,
}

const lineupVersionCompareHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
  minWidth: 0,
}

const lineupVersionCompareSelectLabelStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 'min(100%, 220px)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const lineupVersionCompareSelectStyle: CSSProperties = {
  ...inputStyle,
  height: 40,
  fontSize: 13,
  fontWeight: 800,
}

const lineupVersionCompareGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

function lineupVersionCompareCardStyle(tone: CourtMapTone): CSSProperties {
  const palette = tone === 'good'
    ? { border: 'rgba(134, 239, 172, 0.3)', background: 'rgba(22, 101, 52, 0.15)' }
    : tone === 'warn'
      ? { border: 'rgba(252, 165, 165, 0.3)', background: 'rgba(127, 29, 29, 0.15)' }
      : tone === 'info'
        ? { border: 'rgba(125, 211, 252, 0.28)', background: 'rgba(3, 105, 161, 0.14)' }
        : { border: 'var(--shell-panel-border)', background: 'var(--shell-chip-bg)' }

  return {
    display: 'grid',
    gap: 5,
    minWidth: 0,
    padding: 14,
    borderRadius: 17,
    border: `1px solid ${palette.border}`,
    background: palette.background,
  }
}

const lineupVersionCompareLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const lineupVersionCompareValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 950,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const lineupVersionCompareDetailStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 750,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const lineupVersionCompareCallStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  padding: '14px 16px',
  borderRadius: 17,
  border: '1px solid color-mix(in srgb, var(--brand-green) 27%, var(--shell-panel-border) 73%)',
  background: 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const lineupVersionCompareCourtGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const lineupVersionCompareCourtStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 13,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const mobileCourtFocusStyle: CSSProperties = {
  display: 'grid',
  gap: 13,
  padding: '18px',
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-green) 32%, var(--shell-panel-border) 68%)',
  background: 'linear-gradient(145deg, color-mix(in srgb, var(--brand-green) 11%, var(--shell-panel-bg-strong) 89%), var(--shell-panel-bg))',
  boxShadow: '0 18px 42px rgba(2, 10, 24, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
}

const mobileCourtFocusTitleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
}

const mobileCourtFocusTextStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
}

const mobileCourtFocusActionsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 8,
  minWidth: 0,
}

const mobileFinalLineupPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 13,
  padding: 16,
  borderRadius: 20,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 10%, var(--shell-panel-bg) 90%), var(--shell-chip-bg))',
  boxShadow: '0 14px 34px rgba(2, 10, 24, 0.16)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const mobileFinalLineupHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const mobileFinalLineupCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  flex: '1 1 220px',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
}

const mobileFinalLineupActionsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 8,
  minWidth: 0,
}

const mobileLineupPulseStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  marginTop: 13,
  minWidth: 0,
}

const mobileLineupPulseCardStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  minHeight: 78,
  padding: '10px 8px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 24%, var(--shell-panel-border) 76%)',
  borderRadius: 14,
  background: 'linear-gradient(145deg, color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-panel-bg) 92%), var(--shell-chip-bg))',
}

const mobileLineupPulseLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const mobileLineupPulseValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 950,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const mobileLineupPulseDetailStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 750,
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
}

const mobileCourtMapShellStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 14,
  minWidth: 0,
}

const mobileCourtMapHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
}

const mobileCourtMapTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.03em',
  overflowWrap: 'anywhere',
}

const mobileCourtMapHintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 750,
  textAlign: 'right',
  overflowWrap: 'anywhere',
}

const mobileCourtMapGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))',
  gap: 7,
  minWidth: 0,
}

function mobileCourtMapCardStyle(tone: CourtMapTone): CSSProperties {
  const palette = tone === 'good'
    ? { border: 'rgba(134, 239, 172, 0.32)', background: 'rgba(22, 101, 52, 0.16)' }
    : tone === 'warn'
      ? { border: 'rgba(252, 165, 165, 0.32)', background: 'rgba(127, 29, 29, 0.16)' }
      : tone === 'info'
        ? { border: 'rgba(125, 211, 252, 0.3)', background: 'rgba(3, 105, 161, 0.14)' }
        : { border: 'var(--shell-panel-border)', background: 'var(--shell-chip-bg)' }

  return {
    display: 'grid',
    gap: 4,
    padding: '10px',
    borderRadius: 13,
    border: `1px solid ${palette.border}`,
    background: palette.background,
    minWidth: 0,
  }
}

const mobileCourtMapLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const mobileCourtMapValueRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  minWidth: 0,
}

const mobileCourtMapValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 17,
  fontWeight: 950,
  lineHeight: 1,
  overflowWrap: 'anywhere',
}

function mobileCourtMapStatusStyle(tone: CourtMapTone): CSSProperties {
  return {
    color: tone === 'good' ? '#86efac' : tone === 'warn' ? '#fca5a5' : tone === 'info' ? '#7dd3fc' : 'var(--shell-copy-muted)',
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    textAlign: 'right',
    overflowWrap: 'anywhere',
  }
}

const mobileCourtMapDetailStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 750,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
}

const hiddenMobileContextStyle: CSSProperties = {
  display: 'none',
}

const decisionBoardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  minWidth: 0,
}

const decisionBoardTitleStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.6rem, 2.6vw, 2.35rem)',
  lineHeight: 1.04,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const decisionBoardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const decisionHeroCardStyle: CSSProperties = {
  borderRadius: 20,
  padding: 18,
  display: 'grid',
  gap: 8,
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  minWidth: 0,
}

const decisionCompactCardStyle: CSSProperties = {
  borderRadius: 20,
  padding: 18,
  display: 'grid',
  gap: 8,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const decisionHeroValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2rem, 4vw, 3.5rem)',
  lineHeight: 0.95,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const decisionProgressTrackStyle: CSSProperties = {
  position: 'relative',
  height: 10,
  overflow: 'hidden',
  borderRadius: 999,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const decisionProgressFillStyle: CSSProperties = {
  position: 'absolute',
  inset: '0 auto 0 0',
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--brand-blue-2), var(--brand-green), var(--brand-lime))',
  minWidth: 3,
}

const decisionBoardActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const optimizerActionHelpStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const appliedLineupNoticeStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: '15px 17px',
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground)',
  fontSize: 14,
  lineHeight: 1.55,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const appliedLineupNoticeFooterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
  color: 'var(--shell-copy-muted)',
  minWidth: 0,
}

const appliedLineupNextCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
}

const appliedLineupActionStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const finalLineupGateHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const finalLineupGateCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  flex: '1 1 260px',
}

const finalLineupGateActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
  marginTop: 12,
}

const directCourtTextBannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  padding: '15px 17px',
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const directCourtTextCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  flex: '1 1 240px',
  color: 'var(--foreground)',
  fontSize: 14,
  lineHeight: 1.55,
}

const directCourtTextActionStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const decisionCardBaseStyle: CSSProperties = {
  borderRadius: 20,
  padding: 18,
  display: 'grid',
  gap: 8,
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
}

const decisionCardGoodStyle: CSSProperties = {
  ...decisionCardBaseStyle,
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
}

const decisionCardBlueStyle: CSSProperties = {
  ...decisionCardBaseStyle,
  background: 'color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-chip-bg) 92%)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-panel-border) 72%)',
}

const decisionCardSlateStyle: CSSProperties = {
  ...decisionCardBaseStyle,
  background: 'var(--shell-chip-bg)',
}

const decisionCardLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const decisionCardValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const decisionCardTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.62,
  overflowWrap: 'anywhere',
}

const actionPlanGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 12,
  marginTop: 4,
  minWidth: 0,
}

const decisionQueueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 10,
  marginTop: 12,
  minWidth: 0,
}

const actionPlanCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const actionPlanLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const actionPlanValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const actionPlanTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.62,
  overflowWrap: 'anywhere',
}

const actionPlanInsightStyle: CSSProperties = {
  marginTop: 14,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.7,
  overflowWrap: 'anywhere',
}

const scenarioDeckGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 12,
  marginTop: 4,
  minWidth: 0,
}

const scenarioDeckCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const scenarioDeckLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const scenarioDeckValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const scenarioDeckTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.62,
  overflowWrap: 'anywhere',
}

const scenarioDeckButtonRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  marginTop: 14,
  minWidth: 0,
}

const projectionHeroStyle: CSSProperties = {
  borderRadius: 22,
  padding: 20,
  background: 'color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-chip-bg) 92%)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-panel-border) 72%)',
  marginTop: 14,
  marginBottom: 14,
  minWidth: 0,
}

const projectionValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 44,
  lineHeight: 1,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const projectionTierStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontWeight: 800,
  marginTop: 8,
  fontSize: 15,
  overflowWrap: 'anywhere',
}

const pillRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const miniPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontSize: '12px',
  fontWeight: 800,
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const miniPillSlateStyle: CSSProperties = {
  ...miniPillStyle,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
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

const miniPillWarnStyle: CSSProperties = {
  ...miniPillStyle,
  background: 'rgba(251, 191, 36, 0.14)',
  color: '#fde68a',
  border: '1px solid rgba(251, 191, 36, 0.24)',
}

const selectedPlayerInPillStyle: CSSProperties = {
  ...miniPillGreenStyle,
  border: '1px solid var(--brand-green)',
}

const selectedPlayerOutPillStyle: CSSProperties = {
  ...miniPillStyle,
  background: 'rgba(251, 113, 133, 0.14)',
  color: '#fecdd3',
  border: '1px solid rgba(251, 113, 133, 0.66)',
}

const courtAskReadyPillStyle: CSSProperties = {
  ...miniPillBlueStyle,
  minHeight: 32,
  fontSize: 11,
}

const courtAskWaitingPillStyle: CSSProperties = {
  ...miniPillGreenStyle,
  minHeight: 32,
  fontSize: 11,
  border: '1px solid rgba(155, 225, 29, 0.54)',
}

function courtAskSignalStyle(tone: CourtAskSignal['tone']): CSSProperties {
  const base: CSSProperties = {
    ...miniPillStyle,
    minHeight: 32,
    fontSize: 11,
    textAlign: 'left',
  }
  if (tone === 'confirmed') return { ...base, ...selectedPlayerInPillStyle }
  if (tone === 'ready') return { ...base, ...courtAskReadyPillStyle }
  if (tone === 'waiting') return { ...base, ...courtAskWaitingPillStyle }
  if (tone === 'maybe') return { ...base, ...miniPillWarnStyle }
  if (tone === 'out') return { ...base, ...selectedPlayerOutPillStyle }
  if (tone === 'warning') return { ...base, ...miniPillWarnStyle, border: '1px solid rgba(251, 191, 36, 0.58)' }
  return { ...base, ...miniPillSlateStyle }
}

const badgeGreen: CSSProperties = { ...miniPillGreenStyle }
const badgeBlue: CSSProperties = { ...miniPillBlueStyle }
const badgeSlate: CSSProperties = { ...miniPillSlateStyle }

const heroBadgeRowStyleCompact: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 16,
  minWidth: 0,
}

const lockPanelStyle: CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: 20,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const lockGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const lockSummaryCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const lockSummaryLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const lockSummaryValueStyle: CSSProperties = {
  color: '#f8fafc',
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1,
  overflowWrap: 'anywhere',
}

const lockSummaryTextStyle: CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const bannerBlueStyle: CSSProperties = {
  borderRadius: 18,
  padding: '14px 16px',
  background: 'rgba(37, 99, 235, 0.16)',
  border: '1px solid rgba(37, 99, 235, 0.26)',
  color: '#dbeafe',
  overflowWrap: 'anywhere',
}

const inlineActionButtonStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'var(--brand-blue-2)',
  font: 'inherit',
  fontWeight: 900,
  textDecoration: 'underline',
  cursor: 'pointer',
}

const bannerGreenStyle: CSSProperties = {
  borderRadius: 18,
  padding: '14px 16px',
  background: 'rgba(34, 197, 94, 0.14)',
  border: '1px solid rgba(34, 197, 94, 0.24)',
  color: '#dcfce7',
  overflowWrap: 'anywhere',
}

const smsFallbackStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 34%, var(--shell-panel-border) 66%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 10%, var(--shell-chip-bg) 90%)',
}

const smsFallbackCopyStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 700,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const smsFallbackLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 40,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 800,
  textDecoration: 'none',
  cursor: 'pointer',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
  flex: '0 1 auto',
}

const mobileSmsFallbackLinkStyle: CSSProperties = {
  ...smsFallbackLinkStyle,
  width: '100%',
  minHeight: 44,
  boxSizing: 'border-box',
  padding: '10px 14px',
}

const rosterRecoveryCardStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  borderRadius: 22,
  padding: '18px',
  background: 'linear-gradient(145deg, rgba(120, 53, 15, 0.30), rgba(8, 13, 28, 0.78))',
  border: '1px solid rgba(251, 191, 36, 0.28)',
  boxShadow: '0 18px 42px rgba(2, 8, 23, 0.28)',
}

const opponentRosterRecoveryStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  padding: '13px 15px',
  borderRadius: 18,
  border: '1px solid rgba(37, 99, 235, 0.30)',
  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.14), rgba(8, 13, 28, 0.74))',
}

const opponentRosterReadyStyle: CSSProperties = {
  ...opponentRosterRecoveryStyle,
  minWidth: 0,
  border: '1px solid rgba(155, 225, 29, 0.42)',
  background: 'linear-gradient(135deg, rgba(70, 119, 25, 0.20), rgba(8, 13, 28, 0.74))',
}

const opponentRosterRecoveryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const opponentRosterRecoveryActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const opponentRosterManualEntryStyle: CSSProperties = {
  display: 'grid',
  gridColumn: '1 / -1',
  gap: 8,
  minWidth: 0,
  paddingTop: 10,
  borderTop: '1px solid rgba(147, 197, 253, 0.18)',
}

const opponentRosterTextareaStyle: CSSProperties = {
  ...textareaStyle,
  minHeight: 88,
}

const opponentRosterManualActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const opponentCourtSetupChoiceStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 18,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 52%, var(--shell-panel-border) 48%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-blue-2) 13%, var(--shell-panel-bg) 87%), var(--shell-panel-bg))',
}

const opponentCourtSetupHistoryStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: '12px 14px',
  borderRadius: 14,
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 32%, var(--shell-panel-border) 68%)',
  color: 'var(--shell-copy)',
  fontSize: 14,
  lineHeight: 1.45,
}

const rosterRecoveryHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  minWidth: 0,
}

const rosterRecoveryActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const manualRosterEntryStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(147, 197, 253, 0.20)',
  background: 'rgba(8, 13, 28, 0.64)',
}

const manualRosterTextareaStyle: CSSProperties = {
  ...textareaStyle,
  minHeight: 132,
}

const rosterExportHelpStyle: CSSProperties = {
  minWidth: 0,
  borderTop: '1px solid rgba(251, 191, 36, 0.20)',
  paddingTop: 12,
}

const rosterExportSummaryStyle: CSSProperties = {
  color: '#fde68a',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 850,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const rosterExportStepsStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  margin: '12px 0 0',
  paddingLeft: 22,
  color: '#e2e8f0',
  fontSize: 13,
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const rosterExportVideoLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  maxWidth: '100%',
  marginTop: 12,
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.3,
  textAlign: 'center',
  textDecoration: 'none',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const warningCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: '14px 16px',
  background: 'rgba(239, 68, 68, 0.14)',
  border: '1px solid rgba(239, 68, 68, 0.24)',
  color: '#fee2e2',
  overflowWrap: 'anywhere',
}

const mutedTextStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 14,
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
}

const subtleHelperTextStyle: CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const rightPillStackStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  justifyItems: 'end',
  minWidth: 0,
}

type LineupRatingStatus = 'Bump Up Pace' | 'Trending Up' | 'Holding' | 'At Risk' | 'Drop Watch'

function getLineupRatingStatus(player: { overall_rating: number | null; overall_usta_dynamic_rating: number | null }): LineupRatingStatus | null {
  const base = player.overall_rating
  const usta = player.overall_usta_dynamic_rating
  if (base == null || usta == null) return null
  const diff = usta - base
  if (diff >= 0.15) return 'Bump Up Pace'
  if (diff >= 0.07) return 'Trending Up'
  if (diff > -0.07) return 'Holding'
  if (diff > -0.15) return 'At Risk'
  return 'Drop Watch'
}

function getLineupStatusStyle(status: LineupRatingStatus): CSSProperties {
  switch (status) {
    case 'Bump Up Pace': return { background: 'rgba(155,225,29,0.14)', color: '#d9f84a', border: '1px solid rgba(155,225,29,0.26)', borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', whiteSpace: 'normal' as const }
    case 'Trending Up':  return { background: 'rgba(52,211,153,0.12)', color: '#a7f3d0', border: '1px solid rgba(52,211,153,0.22)', borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', whiteSpace: 'normal' as const }
    case 'Holding':      return { background: 'rgba(63,167,255,0.10)', color: '#bfdbfe', border: '1px solid rgba(63,167,255,0.20)', borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', whiteSpace: 'normal' as const }
    case 'At Risk':      return { background: 'rgba(251,146,60,0.12)', color: '#fed7aa', border: '1px solid rgba(251,146,60,0.22)', borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', whiteSpace: 'normal' as const }
    case 'Drop Watch':   return { background: 'rgba(239,68,68,0.12)', color: '#fecaca', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', whiteSpace: 'normal' as const }
  }
}

const pillButton: CSSProperties = {
  ...miniPillSlateStyle,
  minHeight: 44,
  cursor: 'pointer',
  border: '1px solid rgba(148, 163, 184, 0.22)',
}

const pillButtonActive: CSSProperties = {
  ...miniPillGreenStyle,
  minHeight: 44,
  cursor: 'pointer',
}

const confirmedPlayerLockButtonStyle: CSSProperties = {
  ...pillButtonActive,
  border: '1px solid var(--brand-green)',
  background: 'rgba(155,225,29,0.16)',
  boxShadow: '0 0 0 2px color-mix(in srgb, var(--brand-green) 15%, transparent)',
  color: '#efffbc',
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

function GhostSmallBtn({
  onClick,
  disabled,
  children,
  type = 'button',
  fullWidth = false,
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  type?: 'button' | 'submit'
  fullWidth?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...ghostButtonSmallButton, ...(fullWidth ? { width: '100%', boxSizing: 'border-box', padding: '10px 12px' } : {}), ...(hovered && !disabled ? { background: 'rgba(25,38,62,0.98)', transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(2,8,28,0.32)' } : {}), ...(disabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

