import { nativeTournamentDraw } from './native-tournaments'

export function tournamentTitleContenders(division: Record<string, unknown>) {
  if (division.status !== 'completed') return []
  const { matches, standings, drawNotice } = nativeTournamentDraw(division)
  if (drawNotice || !matches.length || matches.some(match => !match.winner || match.ready === false)) return []
  if (division.format === 'single_elimination') return [matches.at(-1)!.winner]
  if (division.format === 'round_robin') return standings.filter(row => row.wins === standings[0]?.wins).map(row => row.name)
  return []
}
