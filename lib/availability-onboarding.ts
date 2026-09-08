import { isSafeLocalNextHref } from './plan-intent'
import { normalizeTeamRoomKey } from './team-room'
import type { TeamConnection } from './team-profile-links'

/** Public team context only. Never propagate private player/calendar tokens. */
export function getAvailabilityEntry(value: string | null | undefined) {
  if (!value || value.length > 2000) return null
  const safe = isSafeLocalNextHref(value, '')
  if (!safe) return null
  const url = new URL(safe, 'https://tenaceiq.invalid')
  if (url.pathname !== '/team-availability') return null
  const params = new URLSearchParams()
  for (const key of ['team', 'league', 'flight', 'seasonKey', 'match']) {
    const part = url.searchParams.get(key)?.trim() || ''
    if (part.length > 300) return null
    if (part || key === 'flight') params.set(key, part)
  }
  if (!params.get('team') || !params.get('league') || !params.get('seasonKey')) return null
  return { href: `/team-availability?${params}`, team: params.get('team')!, league: params.get('league')!, flight: params.get('flight') || '', match: params.get('match') || '' }
}

export function matchesAvailabilityTeam(connection: TeamConnection, href: string) {
  const entry = getAvailabilityEntry(href)
  return Boolean(entry && !connection.archivedAt
    && normalizeTeamRoomKey(connection.teamName) === normalizeTeamRoomKey(entry.team)
    && normalizeTeamRoomKey(connection.leagueName) === normalizeTeamRoomKey(entry.league)
    && normalizeTeamRoomKey(connection.flight) === normalizeTeamRoomKey(entry.flight))
}
