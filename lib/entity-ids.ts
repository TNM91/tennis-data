function normalizeOptionalPart(value: string | null | undefined) {
  return (value || '').trim()
}

export function buildTeamEntityId(
  teamName: string,
  leagueName?: string | null,
  flight?: string | null,
) {
  return `${teamName.trim()}__${normalizeOptionalPart(leagueName)}__${normalizeOptionalPart(flight)}`
}

export function buildLeagueEntityId(
  leagueName?: string | null,
  flight?: string | null,
  section?: string | null,
  district?: string | null,
) {
  return `${normalizeOptionalPart(leagueName)}__${normalizeOptionalPart(flight)}__${normalizeOptionalPart(section)}__${normalizeOptionalPart(district)}`
}
