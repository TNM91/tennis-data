import { buildOpponentSetScorePlayers, type OpponentSeasonScout } from './captain-opponent-season-scout'
import type { PlayerSetScoreMatch, SetScoreMode } from './player-set-score-grid'

export type OpponentCourtScorePattern = {
  id: string
  name: string
  scope: 'singles' | 'pair' | 'all-partners'
  matches: PlayerSetScoreMatch[]
}

// Recent court occupants choose the options; their score samples remain scoped
// to the already-filtered opponent season, including appearances on other lines.
export function buildOpponentCourtScorePatterns(scout: OpponentSeasonScout, slotIndex: number, mode: SetScoreMode): OpponentCourtScorePattern[] {
  if (!scout.ready) return []
  const scoreScout = { ...scout, fixtures: scout.fixtures.map((fixture) => ({ ...fixture, courts: fixture.courts.filter((court) => {
    const required = court.slotType === 'singles' ? 1 : 2
    return !court.defaulted && !court.needsReview && court.playerIds.length === required
      && court.playerIds.every(Boolean) && new Set(court.playerIds).size === required
  }) })) }
  const players = new Map(buildOpponentSetScorePlayers(scoreScout).map((player) => [player.id, player]))
  const patterns = new Map<string, OpponentCourtScorePattern>()
  const playerIds = new Set<string>()
  const fixtures = [...scout.fixtures].sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key)).slice(0, 4)
  for (const fixture of fixtures) {
    const courts = fixture.courts.filter((court) => court.slotIndex === slotIndex)
    const court = courts.length === 1 ? courts[0] : undefined
    const required = mode === 'singles' ? 1 : 2
    if (!court || court.slotType !== mode || court.defaulted || court.needsReview
      || court.playerIds.length !== required || court.playerIds.some((id) => !id) || new Set(court.playerIds).size !== required) continue
    court.playerIds.forEach((id) => playerIds.add(id))
    if (mode !== 'doubles') continue
    const ids = [...court.playerIds].sort()
    const key = JSON.stringify(ids)
    if (patterns.has(key)) continue
    const matches: PlayerSetScoreMatch[] = []
    for (const week of scoreScout.fixtures) for (const played of week.courts) {
      if (played.slotType !== 'doubles' || played.defaulted || played.needsReview || played.playerIds.length !== 2
        || new Set(played.playerIds).size !== 2 || !ids.every((id) => played.playerIds.includes(id))) continue
      matches.push({ id: `${week.key}:${played.key}`, matchType: 'doubles', score: played.score, result: played.result, date: week.date, opponent: week.opponent })
    }
    patterns.set(key, { id: `pair:${key}`, name: court.playerNames.join(' / '), scope: 'pair', matches })
  }
  for (const id of playerIds) {
    const player = players.get(id)
    if (!player) continue
    patterns.set(`player:${id}`, { id: `player:${id}`, name: player.name, scope: mode === 'singles' ? 'singles' : 'all-partners', matches: player.matches.filter((match) => match.matchType === mode) })
  }
  return [...patterns.values()]
}
