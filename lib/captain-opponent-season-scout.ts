import { normalizeTeamName, normalizeUstaRosterTeamName } from './captain-formatters'
import { validateTiqTennisMatchScore } from './tiq-scoring'
import type { CaptainLineupSlot } from './captain-lineup-format'
import type { PlayerSetScoreMatch } from './player-set-score-grid'
import { activeChampionshipYears } from './tennisrecord/current-refresh'

type Match = {
  id: string; league_name: string | null; flight: string | null; match_date: string | null
  home_team: string | null; away_team: string | null; line_number: string | null
  match_time?: string | null; facility?: string | null; match_type?: string | null
  winner_side?: 'A' | 'B' | null; score?: string | null
  source?: string | null
}
type Link = { match_id: string; player_id: string; side: 'A' | 'B' | null; seat: number | null }
export type OpponentScoutCourt = {
  key: string; label: string; slotIndex: number | null; slotType: 'singles' | 'doubles' | null
  playerIds: string[]; playerNames: string[]; result: 'W' | 'L' | null
  score: string; scoreOriented: boolean; gamesFor: number | null; gamesAgainst: number | null
  defaulted: boolean; needsReview: boolean
}
export type OpponentScoutFixture = {
  key: string; date: string; opponent: string; courts: OpponentScoutCourt[]
  wins: number; losses: number; unknown: number; expectedCourts: number
}
export type OpponentScoutLine = {
  key: string; label: string; slotIndex: number | null; appearances: number
  wins: number; losses: number; gamesFor: number; gamesAgainst: number; scoredCourts: number; defaults: number
}
export type OpponentSeasonScout = { fixtures: OpponentScoutFixture[]; lines: OpponentScoutLine[]; ready: boolean }

export function buildOpponentSetScorePlayers(scout: OpponentSeasonScout) {
  const players = new Map<string, { id: string; name: string; matches: PlayerSetScoreMatch[] }>()
  for (const fixture of scout.fixtures) for (const court of fixture.courts) {
    if (!court.slotType) continue
    court.playerIds.forEach((id, index) => {
      const player = players.get(id) || { id, name: court.playerNames[index] || 'Player not linked', matches: [] }
      player.matches.push({ id: `${fixture.key}:${court.key}`, matchType: court.slotType!, score: court.score, result: court.needsReview ? null : court.result, date: fixture.date, opponent: fixture.opponent, partner: court.slotType === 'doubles' ? court.playerNames.filter((_name, partnerIndex) => partnerIndex !== index).join(' / ') : null })
      players.set(id, player)
    })
  }
  return [...players.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

// Imports include both winner-first and home-first scores. A complete score and
// the declared winner together establish orientation; partial scores cannot.
export function opponentCourtScore(score: string | null | undefined, winner: 'A' | 'B' | null | undefined, side: 'A' | 'B') {
  const raw = (score || '').trim()
  const parsed = validateTiqTennisMatchScore(raw)
  const result = winner ? winner === side ? 'W' as const : 'L' as const : null
  if (!parsed.valid || !winner) return { score: raw, scoreOriented: false, gamesFor: null, gamesAgainst: null, result }
  const firstWon = parsed.parsedSets.filter((set) => set.sideAGames > set.sideBGames).length === 2
  const flip = firstWon !== (result === 'W')
  const games = parsed.parsedSets.filter((set) => set.kind !== 'match_tiebreak')
  return {
    score: raw.replace(/–/g, '-').replace(/(\d{1,2})-(\d{1,2})(\([^)]*\))?/g, (_token, a, b, annotation = '') => `${flip ? b : a}-${flip ? a : b}${annotation}`),
    scoreOriented: true,
    gamesFor: games.reduce((sum, set) => sum + (flip ? set.sideBGames : set.sideAGames), 0),
    gamesAgainst: games.reduce((sum, set) => sum + (flip ? set.sideAGames : set.sideBGames), 0), result,
  }
}

export function buildOpponentSeasonScout(input: {
  opponent: string; aliases?: string[]; league: string; flight: string; beforeDate: string
  matches: Match[]; links: Link[]; players: Array<{ id: string; name: string }>; slots: CaptainLineupSlot[]
}): OpponentSeasonScout {
  const { opponent, league, flight, beforeDate, slots } = input
  if (!opponent.trim() || !league.trim() || !flight.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)) return { fixtures: [], lines: [], ready: false }
  const verifiedAliases = (input.aliases || []).some((alias) => normalizeUstaRosterTeamName(alias) === normalizeUstaRosterTeamName(opponent)) ? input.aliases || [] : []
  const names = new Set([opponent, ...verifiedAliases].map(normalizeUstaRosterTeamName))
  const years = league.match(/\b20\d{2}\b/g) || [beforeDate.slice(0, 4)]
  const playerNames = new Map(input.players.map((player) => [player.id, player.name]))
  const links = new Map<string, Link[]>()
  for (const link of input.links) links.set(link.match_id, [...(links.get(link.match_id) || []), link])
  const groups = new Map<string, { date: string; opponent: string; matches: Array<{ match: Match; side: 'A' | 'B' }> }>()
  for (const match of new Map(input.matches.map((row) => [row.id, row])).values()) {
    const date = (match.match_date || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= beforeDate) continue
    // Fall play can belong to the following championship year. The exact
    // league/flight still scopes the season; its year is not the calendar year.
    const matchSeasons = activeChampionshipYears(new Date(`${date}T00:00:00Z`)).map(String)
    if (!years.some((year) => matchSeasons.includes(year))) continue
    if (normalizeTeamName(match.league_name) !== normalizeTeamName(league) || normalizeTeamName(match.flight) !== normalizeTeamName(flight)) continue
    const home = names.has(normalizeUstaRosterTeamName(match.home_team))
    const away = names.has(normalizeUstaRosterTeamName(match.away_team))
    if (home === away || !match.line_number) continue
    const other = (home ? match.away_team : match.home_team) || 'Opponent not recorded'
    const key = [date, normalizeUstaRosterTeamName(other), match.match_time || '', normalizeTeamName(match.facility)].join('|')
    const group = groups.get(key) || { date, opponent: other, matches: [] }
    group.matches.push({ match, side: home ? 'A' : 'B' })
    groups.set(key, group)
  }
  const fixtures: OpponentScoutFixture[] = []
  for (const [key, group] of groups) {
    const courts = new Map<string, OpponentScoutCourt>()
    const typedRelative = group.matches.some(({ match }) => match.source === 'tennisrecord')
      || group.matches.some(({ match }) => group.matches.some(({ match: other }) => match.line_number === other.line_number && match.match_type && other.match_type && match.match_type !== other.match_type))
    for (const { match, side } of group.matches) {
      const number = Number(match.line_number)
      if (!Number.isInteger(number) || number < 1) continue
      const kind = /singles/i.test(match.match_type || '') ? 'singles' : /doubles/i.test(match.match_type || '') ? 'doubles' : null
      // TennisRecord numbers each discipline separately; captain scorecards use
      // the full lineup order. Source metadata distinguishes the conventions.
      const typedIndex = kind ? slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.slotType === kind)[number - 1]?.index : undefined
      const globalIndex = slots[number - 1] && (!kind || slots[number - 1].slotType === kind) ? number - 1 : undefined
      const slotIndex = (match.source === 'captain_upload' ? globalIndex : typedRelative ? typedIndex : globalIndex ?? typedIndex) ?? null
      const courtKey = slotIndex === null ? `${number}:${kind || 'unknown'}` : `slot:${slotIndex}`
      const playerIds = [...new Set((links.get(match.id) || []).filter((link) => link.side === side).sort((a, b) => (a.seat || 0) - (b.seat || 0)).map((link) => link.player_id))]
      const court: OpponentScoutCourt = {
        key: courtKey, label: slotIndex === null ? `Line ${number}${kind ? ` · ${kind === 'singles' ? 'Singles' : 'Doubles'}` : ''}` : slots[slotIndex].label,
        slotIndex, slotType: kind, playerIds, playerNames: playerIds.map((id) => playerNames.get(id) || 'Player not linked'),
        ...opponentCourtScore(match.score, match.winner_side, side), defaulted: /default|walkover|\bw\/?o\b/i.test(match.score || ''), needsReview: false,
      }
      const existing = courts.get(courtKey)
      if (existing && JSON.stringify([existing.playerIds, existing.result, existing.score]) !== JSON.stringify([court.playerIds, court.result, court.score])) {
        courts.set(courtKey, { ...existing, needsReview: true, result: null, gamesFor: null, gamesAgainst: null })
      } else if (!existing) courts.set(courtKey, court)
    }
    const rows = [...courts.values()].sort((a, b) => (a.slotIndex ?? 999) - (b.slotIndex ?? 999) || a.key.localeCompare(b.key, undefined, { numeric: true }))
    if (rows.length) fixtures.push({ key, date: group.date, opponent: group.opponent, courts: rows, wins: rows.filter((court) => court.result === 'W').length, losses: rows.filter((court) => court.result === 'L').length, unknown: rows.filter((court) => !court.result).length, expectedCourts: slots.length })
  }
  fixtures.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key))
  const lines = new Map<string, OpponentScoutLine>()
  for (const fixture of fixtures) for (const court of fixture.courts) {
    const line = lines.get(court.key) || { key: court.key, label: court.label, slotIndex: court.slotIndex, appearances: 0, wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, scoredCourts: 0, defaults: 0 }
    line.appearances++
    if (court.result === 'W') line.wins++
    if (court.result === 'L') line.losses++
    if (court.defaulted) line.defaults++
    if (court.gamesFor !== null && court.gamesAgainst !== null) { line.gamesFor += court.gamesFor; line.gamesAgainst += court.gamesAgainst; line.scoredCourts++ }
    lines.set(court.key, line)
  }
  return { fixtures, lines: [...lines.values()], ready: true }
}

export function fillOpponentSeasonDraft<T extends { id: string; name: string }>(slots: CaptainLineupSlot[], fixture: OpponentScoutFixture, pool: T[], eligible: (player: T, slot: CaptainLineupSlot) => boolean) {
  const assigned = new Set(slots.flatMap((slot) => slot.players.map((player) => player.playerId).filter(Boolean)))
  const playersById = new Map(pool.map((player) => [player.id, player]))
  let filled = 0
  const nextSlots = slots.map((slot, index) => {
    const court = fixture.courts.find((row) => row.slotIndex === index && !row.needsReview)
    if (!court || (court.slotType && court.slotType !== slot.slotType)) return slot
    const candidates = court.playerIds.map((id) => playersById.get(id)).filter((player): player is T => !!player && !assigned.has(player.id) && eligible(player, slot))
    return { ...slot, players: slot.players.map((existing) => {
      if (existing.playerId || existing.playerName.trim()) return existing
      const next = candidates.find((player) => !assigned.has(player.id))
      if (!next) return existing
      assigned.add(next.id); filled++
      return { playerId: next.id, playerName: next.name }
    }) }
  })
  return { slots: nextSlots, filled }
}
