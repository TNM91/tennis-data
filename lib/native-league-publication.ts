import { isLeagueDraftRevision } from './native-league-draft-contract'

export const nativeLeaguePrefix = 'tiq-native-league-'
export function nativeLeaguePublicationId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(nativeLeaguePrefix) &&
    isLeagueDraftRevision(value.slice(nativeLeaguePrefix.length))
}

export function isPublishedNativeLeague(row: Record<string, unknown>) {
  return nativeLeaguePublicationId(row.id) && row.is_public === true &&
    ['active', 'completed', 'archived'].includes(String(row.season_status))
}

export function publishedLeagueRegistrationOpen(row: Record<string, unknown>) {
  if (row.season_status !== 'active' || typeof row.ends_on !== 'string' || typeof row.schedule_time_zone !== 'string') return false
  const local = new Intl.DateTimeFormat('en', {
    timeZone: row.schedule_time_zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts()
  const date = Object.fromEntries(local.map(part => [part.type, part.value]))
  return row.ends_on >= `${date.year}-${date.month}-${date.day}`
}
