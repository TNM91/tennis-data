import type { CaptainLineupSlot } from './captain-lineup-format'
import type { OpponentSeasonScout } from './captain-opponent-season-scout'

export function compareRecentOpponentLineups(
  scout: OpponentSeasonScout,
  slots: CaptainLineupSlot[],
  project: (team: CaptainLineupSlot, opponent: CaptainLineupSlot, index: number) => number | null,
) {
  const fixtures = scout.ready ? [...scout.fixtures].sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key)).slice(0, 4) : []
  return {
    fixtureCount: fixtures.length,
    courts: slots.map((slot, index) => {
      const required = slot.slotType === 'singles' ? 1 : 2
      const ids = slot.players.map((player) => player.playerId)
      const complete = ids.length === required && ids.every(Boolean) && new Set(ids).size === required
      const weeks = fixtures.map((fixture) => {
        const candidates = fixture.courts.filter((court) => court.slotIndex === index)
        const court = candidates.length === 1 ? candidates[0] : undefined
        const usable = complete && court && court.slotType === slot.slotType && !court.needsReview && !court.defaulted
          && (court.result || /\d+\s*[-–]\s*\d+/.test(court.score))
          && court.playerIds.length === required && court.playerIds.every(Boolean) && new Set(court.playerIds).size === required
        const opponent = usable ? { ...slot, players: court.playerIds.map((playerId, seat) => ({ playerId, playerName: court.playerNames[seat] || 'Player' })) } : null
        const estimate = opponent ? project(slot, opponent, index) : null
        const probability = typeof estimate === 'number' && Number.isFinite(estimate) && estimate >= 0 && estimate <= 1 ? estimate : null
        return { key: fixture.key, date: fixture.date, opponent: fixture.opponent, names: court?.playerNames || [], result: court?.result || null, score: court?.score || '', probability }
      })
      const values = weeks.flatMap((week) => week.probability === null ? [] : [week.probability])
      const minimum = values.length ? Math.min(...values) : null
      const maximum = values.length ? Math.max(...values) : null
      const status = !complete ? 'Complete your court' : !values.length ? 'Needs recorded players and ratings'
        : values.length === 1 ? 'One matchup recorded'
        : minimum! >= 0.5 ? 'Favored across recorded weeks'
        : maximum! < 0.5 ? 'Underdog across recorded weeks' : 'Changes with their lineup'
      return { id: slot.id, index, label: slot.label, slotType: slot.slotType, names: slot.players.map((player) => player.playerName).filter(Boolean), weeks, assessed: values.length, minimum, maximum, status }
    }),
  }
}

export type RecentLineupComparison = ReturnType<typeof compareRecentOpponentLineups>
