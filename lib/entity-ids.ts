function normalizeOptionalPart(value: string | null | undefined) {
  return (value || '').trim()
}

export function buildScopedTeamEntityId({
  competitionLayer,
  teamName,
  leagueName,
  flight,
}: {
  competitionLayer?: string | null
  teamName: string
  leagueName?: string | null
  flight?: string | null
}) {
  return [
    normalizeOptionalPart(competitionLayer),
    teamName.trim(),
    normalizeOptionalPart(leagueName),
    normalizeOptionalPart(flight),
  ].join('__')
}

export function buildScopedLeagueEntityId({
  competitionLayer,
  leagueName,
  flight,
  section,
  district,
}: {
  competitionLayer?: string | null
  leagueName?: string | null
  flight?: string | null
  section?: string | null
  district?: string | null
}) {
  return [
    normalizeOptionalPart(competitionLayer),
    normalizeOptionalPart(leagueName),
    normalizeOptionalPart(flight),
    normalizeOptionalPart(section),
    normalizeOptionalPart(district),
  ].join('__')
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
