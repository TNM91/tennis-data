import type {TiqTournamentRecord,TiqTournamentMatchPreview,TiqTournamentMatchResult,TiqTournamentMatchSchedule,TiqTournamentStanding} from './tiq-tournament-registry'
import {buildGroupPlayoffs} from './tournament-group-playoffs'
const cleanText=(v?:string)=>(v||'').replace(/\s+/g,' ').trim()
const normalizeEntrants=(v:string[])=>[...new Set(v.map(cleanText).filter(Boolean))]
export function buildSingleEliminationPreview(
  entrants: string[],
  results: Record<string, TiqTournamentMatchResult> = {},
  schedule: Record<string, TiqTournamentMatchSchedule> = {},
): TiqTournamentMatchPreview[] {
  const field = normalizeEntrants(entrants)
  if (field.length < 2) return []

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(field.length)))
  const seeded = [...field, ...Array.from({ length: bracketSize - field.length }, () => 'Bye')]
  const matches: TiqTournamentMatchPreview[] = []
  const winnersByMatch = new Map<string, string>()

  for (let index = 0; index < bracketSize / 2; index += 1) {
    const id = buildMatchId(1, index + 1)
    const sideA = seeded[index]
    const sideB = seeded[bracketSize - 1 - index]
    const result = results[id]
    const byeWinner = sideA === 'Bye' ? sideB : sideB === 'Bye' ? sideA : ''
    const winner = byeWinner || result?.winner || ''
    if (winner) winnersByMatch.set(id, winner)
    matches.push({
      id,
      round: 1,
      court: index + 1,
      label: 'Round 1',
      sideA,
      sideB,
      result: result || (byeWinner ? { winner: byeWinner, score: 'Bye', updatedAt: '' } : undefined),
      schedule: schedule[id],
    })
  }

  let remaining = bracketSize / 4
  let round = 2
  while (remaining >= 1) {
    for (let index = 0; index < remaining; index += 1) {
      const id = buildMatchId(round, index + 1)
      const previousLeft = buildMatchId(round - 1, index * 2 + 1)
      const previousRight = buildMatchId(round - 1, index * 2 + 2)
      const sideA = winnersByMatch.get(previousLeft) || `Winner R${round - 1}.${index * 2 + 1}`
      const sideB = winnersByMatch.get(previousRight) || `Winner R${round - 1}.${index * 2 + 2}`
      const result = results[id]
      if (result?.winner && result.winner === sideA || result?.winner && result.winner === sideB) {
        winnersByMatch.set(id, result.winner)
      }
      matches.push({
        id,
        round,
        court: index + 1,
        label: remaining === 1 ? 'Final' : `Round ${round}`,
        sideA,
        sideB,
        result,
        schedule: schedule[id],
      })
    }
    remaining /= 2
    round += 1
  }

  return matches
}

export function buildRoundRobinPreview(
  entrants: string[],
  results: Record<string, TiqTournamentMatchResult> = {},
  schedule: Record<string, TiqTournamentMatchSchedule> = {},
): TiqTournamentMatchPreview[] {
  const field = normalizeEntrants(entrants)
  if (field.length < 2) return []

  const rotating = field.length % 2 === 0 ? [...field] : [...field, 'Bye']
  const rounds = rotating.length - 1
  const half = rotating.length / 2
  const matches: TiqTournamentMatchPreview[] = []

  for (let round = 1; round <= rounds; round += 1) {
    for (let index = 0; index < half; index += 1) {
      const sideA = rotating[index]
      const sideB = rotating[rotating.length - 1 - index]
      if (sideA !== 'Bye' && sideB !== 'Bye') {
        const court = index + 1
        const id = buildMatchId(round, court)
        matches.push({
          id,
          round,
          court,
          label: `Round ${round}`,
          sideA,
          sideB,
          result: results[id],
          schedule: schedule[id],
        })
      }
    }
    rotating.splice(1, 0, rotating.pop() || '')
  }

  return matches
}

export function buildTournamentPreview(record: Pick<TiqTournamentRecord, 'format' | 'entrants'> & { results?: Record<string, TiqTournamentMatchResult>, schedule?: Record<string, TiqTournamentMatchSchedule> }) {
  if (record.format === 'group_playoffs') return buildTournamentGroupChampionship(record).matches
  if (record.format === 'round_robin') return buildRoundRobinPreview(record.entrants, record.results, record.schedule)
  return buildSingleEliminationPreview(record.entrants, record.results, record.schedule)
}

export function buildTournamentGroupChampionship(record: Pick<TiqTournamentRecord,'entrants'> & {results?: Record<string,TiqTournamentMatchResult>; schedule?: Record<string,TiqTournamentMatchSchedule>}) {
  return buildGroupPlayoffs({ ...record, results: record.results || {} }, { roundRobin: buildRoundRobinPreview, elimination: buildSingleEliminationPreview })
}

export function summarizeTournamentResults(record: Pick<TiqTournamentRecord, 'format' | 'entrants' | 'results'>) {
  const matches = buildTournamentPreview(record)
  const playableMatches = matches.filter((match) => match.sideA !== 'Bye' && match.sideB !== 'Bye')
  const completedMatches = playableMatches.filter((match) => Boolean(match.result?.winner))
  const champion =
    matches.find((match) => match.label === 'Final')?.result?.winner ||
    (playableMatches.length === 1 ? playableMatches[0]?.result?.winner || '' : '')

  return {
    totalMatches: playableMatches.length,
    completedMatches: completedMatches.length,
    openMatches: Math.max(0, playableMatches.length - completedMatches.length),
    champion,
  }
}

export function buildRoundRobinStandings(record: Pick<TiqTournamentRecord, 'format' | 'entrants' | 'results'>): TiqTournamentStanding[] {
  const entrants = normalizeEntrants(record.entrants)
  const rows = new Map<string, TiqTournamentStanding>(
    entrants.map((entrant) => [
      entrant,
      { entrant, played: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, gameDiff: 0, winPct: 0 },
    ]),
  )

  for (const match of buildRoundRobinPreview(entrants, record.results)) {
    const winner = cleanText(match.result?.winner)
    if (!winner) continue
    const loser = winner === match.sideA ? match.sideB : winner === match.sideB ? match.sideA : ''
    if (!loser) continue

    const winnerRow = rows.get(winner)
    const loserRow = rows.get(loser)
    if (!winnerRow || !loserRow) continue

    winnerRow.played += 1
    winnerRow.wins += 1
    loserRow.played += 1
    loserRow.losses += 1

    const games = parseTournamentScoreGames(match.result?.score || '')
    const winnerGames = winner === match.sideA ? games.sideA : games.sideB
    const loserGames = winner === match.sideA ? games.sideB : games.sideA
    winnerRow.gamesWon += winnerGames
    winnerRow.gamesLost += loserGames
    loserRow.gamesWon += loserGames
    loserRow.gamesLost += winnerGames
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      gameDiff: row.gamesWon - row.gamesLost,
      winPct: row.played ? Math.round((row.wins / row.played) * 100) : 0,
    }))
    .sort((left, right) =>
      right.wins - left.wins ||
      left.losses - right.losses ||
      right.gameDiff - left.gameDiff ||
      right.gamesWon - left.gamesWon ||
      right.winPct - left.winPct ||
      left.entrant.localeCompare(right.entrant),
    )
}

function parseTournamentScoreGames(score: string) {
  // A deciding match tiebreak and set-tiebreak points are not ordinary games.
  const sets = [...score.replace(/\([^)]*\)|\[[^\]]*\]/g, '').matchAll(/\b(\d+)\s*[-–]\s*(\d+)\b/g)]
    .map(m => [Number(m[1]),Number(m[2])]).filter(([a,b]) => Math.max(a,b)<=7)
  return {sideA:sets.reduce((n,[a])=>n+a,0),sideB:sets.reduce((n,[,b])=>n+b,0)}
}

function buildMatchId(round: number, court: number) {
  return `r${round}-m${court}`
}
