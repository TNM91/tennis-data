export type PlayerSearchContextCoverage = 'all' | 'some' | 'none'

export function getPlayerSearchContextCoverage(
  players: ReadonlyArray<{ recent_match_team?: string | null }>,
): PlayerSearchContextCoverage {
  const withContext = players.filter((player) => Boolean(player.recent_match_team?.trim())).length
  if (withContext === 0) return 'none'
  return withContext === players.length ? 'all' : 'some'
}

export function getPlayerSearchCountBand(count: number): '1-8' | '9-16' | '17-24' {
  if (count <= 8) return '1-8'
  if (count <= 16) return '9-16'
  return '17-24'
}
