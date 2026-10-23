export const NON_TEAM_LABELS = new Set([
  'match results',
  'home team',
  'away team',
  'visiting team',
  'team name',
  'team',
  'tbd',
  'unknown',
  'n/a',
])

export function cleanText(value: string | null | undefined) {
  const text = (value || '').trim()
  return text.length > 0 ? text : null
}

export function normalizeName(value: string | null | undefined) {
  return (cleanText(value) || '').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').toLowerCase()
}

/** Reject source headings and league metadata that have leaked into team columns. */
export function isPublicTeamDirectoryName(value: string | null | undefined, league?: string | null) {
  const name = cleanText(value)
  const normalizedName = normalizeName(value)
  const normalizedLeague = normalizeName(league)
  if (!name || normalizedName.length < 2 || NON_TEAM_LABELS.has(normalizedName)) return false
  if (normalizedLeague && normalizedName === normalizedLeague) return false
  if (/^20\d{2}\s+adult\b/i.test(name)) return false
  return true
}


/**
 * Treat TennisRecord observations as untrusted source material until their
 * team fields pass the stricter name check. Other TenAceIQ sources already
 * provide explicit schedule or upload team fields, so keep those records in
 * the directory unless the value is a known column heading.
 */
export function isPublicTeamDirectoryMatch(match: {
  homeTeam: string | null | undefined
  awayTeam: string | null | undefined
  league?: string | null
  source?: string | null
}) {
  const home = cleanText(match.homeTeam)
  const away = cleanText(match.awayTeam)
  const source = normalizeName(match.source)

  if (!home || !away || NON_TEAM_LABELS.has(normalizeName(home)) || NON_TEAM_LABELS.has(normalizeName(away))) return false

  if (source.includes('tennisrecord')) {
    return isPublicTeamDirectoryName(home, match.league) && isPublicTeamDirectoryName(away, match.league)
  }

  return true
}

