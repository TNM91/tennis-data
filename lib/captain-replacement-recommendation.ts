import { isPlayerEligibleForCaptainRating } from './captain-lineup-format'

export type CaptainReplacementPlayer = {
  id: string
  name: string
  appearances: number
  wins: number
  losses: number
  singlesDynamic: number | null
  doublesDynamic: number | null
  overallBase: number | null
  overallUstaDynamic: number | null
  ratingStatus: string | null
}

export type CaptainReplacementLineupRow = {
  courtLabel: string
  slotType: string
  players: string[]
}

export type CaptainReplacementPairing = {
  names: string[]
  appearances: number
  wins: number
  losses: number
}

export type CaptainReplacementAvailability = {
  name: string
  status: string
}

export type CaptainReplacementRecommendation = {
  playerId: string
  playerName: string
  courtLabel: string
  slotType: 'singles' | 'doubles'
  ratingLevel: number | null
  primaryRating: number | null
  availabilityStatus: 'available' | 'unknown'
  needsConfirmation: boolean
  partnerName: string
  partnerAppearances: number
  reason: string
}

export type CaptainSuggestedSwapSlot = {
  id: string
  label: string
  players: Array<{
    playerId: string
    playerName: string
  }>
}

export type CaptainSuggestedSwapFailure =
  | 'court-not-found'
  | 'outgoing-player-not-found'
  | 'replacement-already-assigned'
  | 'replacement-unavailable'
  | 'replacement-ineligible'

export type CaptainSuggestedSwapResult<TSlot extends CaptainSuggestedSwapSlot> =
  | {
      ok: true
      slots: TSlot[]
      slotId: string
      playerIndex: number
      outgoingPlayerName: string
      replacementPlayerName: string
      needsConfirmation: boolean
    }
  | {
      ok: false
      reason: CaptainSuggestedSwapFailure
    }

export type CaptainSuggestedSwapProjectionChange = {
  before: number
  after: number
  delta: number
}

export type CaptainSuggestedSwapImpact = {
  court: CaptainSuggestedSwapProjectionChange | null
  overall: CaptainSuggestedSwapProjectionChange | null
}

function normalizeName(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function normalizeAvailability(value: string | null | undefined) {
  const status = (value || '').trim().toLowerCase()
  if (status === 'available' || status === 'yes' || status === 'in' || status === 'confirmed') return 'available'
  if (status === 'maybe' || status === 'limited') return 'maybe'
  if (status === 'unavailable' || status === 'no' || status === 'out' || status === 'declined') return 'unavailable'
  return 'unknown'
}

function getCourtRating(label: string) {
  const match = label.match(/(?:^|\D)([2-7]\.[05])(?:\D|$)/)
  return match ? Number(match[1]) : null
}

function getPrimaryRating(player: CaptainReplacementPlayer, slotType: 'singles' | 'doubles') {
  return slotType === 'singles'
    ? player.singlesDynamic ?? player.overallUstaDynamic ?? player.overallBase
    : player.doublesDynamic ?? player.overallUstaDynamic ?? player.overallBase
}

function winRate(wins: number, losses: number) {
  const total = wins + losses
  return total ? wins / total : 0.5
}

function getPairingRead(
  playerName: string,
  partnerName: string,
  pairings: CaptainReplacementPairing[],
) {
  if (!partnerName) return null
  const playerKey = normalizeName(playerName)
  const partnerKey = normalizeName(partnerName)
  return pairings.find((pairing) => {
    const keys = pairing.names.map(normalizeName)
    return keys.includes(playerKey) && keys.includes(partnerKey)
  }) ?? null
}

function formatRating(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : ''
}

export function buildCaptainReplacementRecommendation(input: {
  unavailablePlayerName: string
  lineupRow: CaptainReplacementLineupRow
  lineupRows: CaptainReplacementLineupRow[]
  roster: CaptainReplacementPlayer[]
  availability: CaptainReplacementAvailability[]
  pairings?: CaptainReplacementPairing[]
}): CaptainReplacementRecommendation | null {
  const unavailableKey = normalizeName(input.unavailablePlayerName)
  if (!unavailableKey) return null

  const courtLabel = input.lineupRow.courtLabel.trim() || 'this court'
  const slotType = `${input.lineupRow.slotType} ${courtLabel}`.toLowerCase().includes('single') ? 'singles' : 'doubles'
  const ratingLevel = getCourtRating(courtLabel)
  const assignedKeys = new Set(
    input.lineupRows.flatMap((row) => row.players).map(normalizeName).filter(Boolean),
  )
  const availabilityByName = new Map(
    input.availability.map((entry) => [normalizeName(entry.name), normalizeAvailability(entry.status)] as const),
  )
  const partnerName = slotType === 'doubles'
    ? input.lineupRow.players.find((name) => normalizeName(name) !== unavailableKey)?.trim() || ''
    : ''

  const eligible = input.roster
    .filter((player) => {
      const playerKey = normalizeName(player.name)
      if (!playerKey || playerKey === unavailableKey || assignedKeys.has(playerKey)) return false
      const status = availabilityByName.get(playerKey) || 'unknown'
      if (status === 'maybe' || status === 'unavailable') return false
      return isPlayerEligibleForCaptainRating(player.overallBase, ratingLevel)
    })
    .map((player) => {
      const availabilityStatus = availabilityByName.get(normalizeName(player.name)) === 'available'
        ? 'available' as const
        : 'unknown' as const
      const primaryRating = getPrimaryRating(player, slotType)
      const pairing = slotType === 'doubles'
        ? getPairingRead(player.name, partnerName, input.pairings || [])
        : null
      const ratingSignal = primaryRating ?? 0
      const recordSignal = winRate(player.wins, player.losses) * 0.08
      const experienceSignal = Math.min(player.appearances, 10) * 0.006
      const trendSignal = player.ratingStatus === 'Bump Up Pace' || player.ratingStatus === 'Trending Up'
        ? 0.05
        : player.ratingStatus === 'At Risk' || player.ratingStatus === 'Drop Watch' ? -0.05 : 0
      const pairingSignal = pairing
        ? winRate(pairing.wins, pairing.losses) * 0.12 + Math.min(pairing.appearances, 5) * 0.012
        : 0

      return {
        player,
        availabilityStatus,
        primaryRating,
        pairing,
        score: ratingSignal + recordSignal + experienceSignal + trendSignal + pairingSignal,
      }
    })

  const confirmed = eligible.filter((candidate) => candidate.availabilityStatus === 'available')
  const pool = confirmed.length ? confirmed : eligible
  const best = pool.sort((left, right) =>
    right.score - left.score || right.player.appearances - left.player.appearances || left.player.name.localeCompare(right.player.name),
  )[0]
  if (!best) return null

  const reasonParts = [
    best.availabilityStatus === 'available' ? 'Confirmed In' : 'Availability not confirmed',
    `${slotType === 'singles' ? 'Singles' : 'Doubles'}${formatRating(best.primaryRating) ? ` ${formatRating(best.primaryRating)}` : ' fit'}`,
  ]
  if (best.pairing && partnerName) {
    reasonParts.push(`${best.pairing.appearances} match${best.pairing.appearances === 1 ? '' : 'es'} with ${partnerName}`)
  } else if (best.player.appearances > 0) {
    reasonParts.push(`${best.player.wins}-${best.player.losses} team record`)
  }

  return {
    playerId: best.player.id,
    playerName: best.player.name,
    courtLabel,
    slotType,
    ratingLevel,
    primaryRating: best.primaryRating,
    availabilityStatus: best.availabilityStatus,
    needsConfirmation: best.availabilityStatus !== 'available',
    partnerName,
    partnerAppearances: best.pairing?.appearances ?? 0,
    reason: reasonParts.join(' · '),
  }
}

export function buildCaptainReplacementLineupHref(
  baseHref: string,
  input: { outPlayer: string; replacementPlayer: string; replacementPlayerId?: string; courtLabel: string },
) {
  const url = new URL(baseHref, 'https://tenaceiq.local')
  url.searchParams.set('replace', input.outPlayer)
  url.searchParams.set('replacement', input.replacementPlayer)
  if (input.replacementPlayerId) url.searchParams.set('replacementId', input.replacementPlayerId)
  url.searchParams.set('court', input.courtLabel)
  url.hash = 'captain-lineup-handoff'
  return `${url.pathname}${url.search}${url.hash}`
}

export function applyCaptainSuggestedSwap<TSlot extends CaptainSuggestedSwapSlot>(input: {
  slots: TSlot[]
  courtLabel: string
  outgoingPlayerName: string
  replacement: {
    playerId: string
    playerName: string
    availabilityStatus?: string | null
    eligibleForCourt: boolean
  }
}): CaptainSuggestedSwapResult<TSlot> {
  const courtKey = normalizeName(input.courtLabel)
  const matchingCourts = input.slots.filter((slot) => normalizeName(slot.label) === courtKey)
  if (matchingCourts.length !== 1) return { ok: false, reason: 'court-not-found' }

  const targetSlot = matchingCourts[0]
  const outgoingKey = normalizeName(input.outgoingPlayerName)
  const outgoingIndexes = targetSlot.players
    .map((player, index) => normalizeName(player.playerName) === outgoingKey ? index : -1)
    .filter((index) => index >= 0)
  if (outgoingIndexes.length !== 1) return { ok: false, reason: 'outgoing-player-not-found' }

  const replacementId = input.replacement.playerId.trim()
  const replacementKey = normalizeName(input.replacement.playerName)
  const alreadyAssigned = input.slots.some((slot) => slot.players.some((player) =>
    (replacementId && player.playerId === replacementId)
    || (replacementKey && normalizeName(player.playerName) === replacementKey),
  ))
  if (alreadyAssigned) return { ok: false, reason: 'replacement-already-assigned' }

  const availabilityStatus = normalizeAvailability(input.replacement.availabilityStatus)
  if (availabilityStatus === 'maybe' || availabilityStatus === 'unavailable') {
    return { ok: false, reason: 'replacement-unavailable' }
  }
  if (!input.replacement.eligibleForCourt) return { ok: false, reason: 'replacement-ineligible' }

  const outgoingIndex = outgoingIndexes[0]
  const slots = input.slots.map((slot) => {
    if (slot.id !== targetSlot.id) return slot
    return {
      ...slot,
      players: slot.players.map((player, index) => index === outgoingIndex
        ? { playerId: replacementId, playerName: input.replacement.playerName }
        : player),
    }
  }) as TSlot[]

  return {
    ok: true,
    slots,
    slotId: targetSlot.id,
    playerIndex: outgoingIndex,
    outgoingPlayerName: targetSlot.players[outgoingIndex].playerName,
    replacementPlayerName: input.replacement.playerName,
    needsConfirmation: availabilityStatus === 'unknown',
  }
}

export function buildCaptainSuggestedSwapImpact(input: {
  beforeCourtProjection: number | null | undefined
  afterCourtProjection: number | null | undefined
  beforeOverallProjection: number | null | undefined
  afterOverallProjection: number | null | undefined
  beforeProjectedCourtCount: number
  afterProjectedCourtCount: number
}): CaptainSuggestedSwapImpact {
  const buildChange = (
    before: number | null | undefined,
    after: number | null | undefined,
  ): CaptainSuggestedSwapProjectionChange | null => {
    if (
      typeof before !== 'number'
      || !Number.isFinite(before)
      || typeof after !== 'number'
      || !Number.isFinite(after)
    ) return null
    return { before, after, delta: after - before }
  }

  const court = buildChange(input.beforeCourtProjection, input.afterCourtProjection)
  return {
    court,
    overall: court && input.beforeProjectedCourtCount > 0 && input.afterProjectedCourtCount > 0
      ? buildChange(input.beforeOverallProjection, input.afterOverallProjection)
      : null,
  }
}
