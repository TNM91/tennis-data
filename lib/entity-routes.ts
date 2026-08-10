export function buildPlayerDetailHref(playerId?: string | null, playerName?: string | null) {
  const normalizedId = playerId?.trim()
  if (normalizedId) return `/players/${encodeURIComponent(normalizedId)}`

  const normalizedName = playerName?.trim()
  if (!normalizedName) return '/explore/players'

  return `/explore/players?q=${encodeURIComponent(normalizedName)}`
}

export function buildTiqLeagueDetailHref(leagueId: string) {
  const normalizedId = leagueId.trim()
  if (!normalizedId) return '/explore/leagues'

  const encodedId = encodeURIComponent(normalizedId)
  return `/explore/leagues/tiq/${encodedId}?league_id=${encodedId}`
}
