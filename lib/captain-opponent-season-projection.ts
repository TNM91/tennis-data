import type { CaptainLineupSlot } from './captain-lineup-format'
import type { OpponentScoutCourt, OpponentSeasonScout } from './captain-opponent-season-scout'

export type OpponentSeasonCandidate = {
  key: string
  playerIds: string[]
  playerNames: string[]
  appearances: number
  wins: number
  losses: number
  unknown: number
  latestDate: string
  latestOpponent: string
  latestCourt: OpponentScoutCourt
}
export type OpponentSeasonProjection = {
  slots: CaptainLineupSlot[]
  filled: number
  fixtureCount: number
  courts: Array<{
    slotIndex: number
    label: string
    selected: OpponentSeasonCandidate | null
    candidates: OpponentSeasonCandidate[]
    preserved: boolean
  }>
}

// Scout fixtures are already restricted to this opponent, season, league, flight,
// and dates before the selected match. Count complete observed courts, not players.
export function projectOpponentSeasonLineup<T extends { id: string; name: string }>(
  scout: OpponentSeasonScout,
  slots: CaptainLineupSlot[],
  pool: T[],
  eligible: (players: T[], slot: CaptainLineupSlot) => boolean,
): OpponentSeasonProjection {
  const fixtures = scout.ready ? [...scout.fixtures].sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key)).slice(0, 4) : []
  const playersById = new Map(pool.map((player) => [player.id, player]))
  const assigned = new Set(slots.flatMap((slot) => slot.players.map((player) => player.playerId).filter(Boolean)))
  const courts = slots.map((slot, slotIndex) => {
    const candidatesByKey = new Map<string, OpponentSeasonCandidate>()
    for (const fixture of fixtures) {
      const court = fixture.courts.find((row) => row.slotIndex === slotIndex)
      const required = slot.slotType === 'singles' ? 1 : 2
      if (!court || court.slotType !== slot.slotType || court.needsReview || court.defaulted || (!court.result && !/\d+\s*[-–]\s*\d+/.test(court.score)) || court.playerIds.length !== required || new Set(court.playerIds).size !== required || court.playerIds.some((id) => !id)) continue
      const key = [...court.playerIds].sort().join('|')
      const candidate = candidatesByKey.get(key) || {
        key, playerIds: court.playerIds, playerNames: court.playerNames,
        appearances: 0, wins: 0, losses: 0, unknown: 0,
        latestDate: fixture.date, latestOpponent: fixture.opponent, latestCourt: court,
      }
      candidate.appearances++
      if (court.result === 'W') candidate.wins++
      else if (court.result === 'L') candidate.losses++
      else candidate.unknown++
      candidatesByKey.set(key, candidate)
    }
    const candidates = [...candidatesByKey.values()].sort((a, b) => b.appearances - a.appearances || b.latestDate.localeCompare(a.latestDate) || a.key.localeCompare(b.key))
    return { slotIndex, label: slot.label, selected: null as OpponentSeasonCandidate | null, candidates, preserved: slot.players.some((player) => Boolean(player.playerId || player.playerName.trim())) }
  })
  let filled = 0
  const nextSlots = slots.map((slot) => ({ ...slot, players: slot.players.map((player) => ({ ...player })) }))
  const fits = (candidate: OpponentSeasonCandidate, slot: CaptainLineupSlot) => {
    const currentIds = slot.players.map((player) => player.playerId).filter(Boolean)
    if (slot.players.some((player) => !player.playerId && player.playerName.trim())) return false
    if (!currentIds.every((id) => candidate.playerIds.includes(id))) return false
    if (candidate.playerIds.some((id) => assigned.has(id) && !currentIds.includes(id))) return false
    const players = candidate.playerIds.map((id) => playersById.get(id))
    return players.every((player): player is T => Boolean(player)) && eligible(players, slot)
  }
  // Assign the most repeated court combinations first, rather than letting court
  // order move a regular pair merely because a player also made a one-off start.
  const priority = courts.map((court) => ({ court, best: court.candidates.find((candidate) => fits(candidate, nextSlots[court.slotIndex])) }))
    .sort((a, b) => (b.best?.appearances || 0) - (a.best?.appearances || 0) || (b.best?.latestDate || '').localeCompare(a.best?.latestDate || '') || a.court.slotIndex - b.court.slotIndex)
  for (const { court } of priority) {
    const slot = nextSlots[court.slotIndex]
    const currentIds = slot.players.map((player) => player.playerId).filter(Boolean)
    if (slot.players.some((player) => !player.playerId && player.playerName.trim())) continue
    const selected = court.candidates.find((candidate) => fits(candidate, slot))
    if (!selected) continue
    court.selected = selected
    const remaining = selected.playerIds.filter((id) => !currentIds.includes(id))
    slot.players = slot.players.map((existing) => {
      if (existing.playerId || existing.playerName.trim()) return existing
      const id = remaining.shift()
      const player = id ? playersById.get(id) : null
      if (!player) return existing
      filled++; assigned.add(player.id)
      return { playerId: player.id, playerName: player.name }
    })
  }
  return { slots: nextSlots, filled, courts, fixtureCount: fixtures.length }
}
