import { seasonMatchLabel, type SeasonScope } from './season-kickoff'
import type { TeamSeasonMatch } from './team-season-calendar'

/** Public team scope only: never put an individual's response/calendar token in a group message. */
export function seasonGroupPath(scope: SeasonScope, matchId = '') {
  return `/team-availability?${new URLSearchParams({ ...scope, ...(matchId ? { match: matchId } : {}) })}`
}

export function seasonGroupMessage(scope: SeasonScope, link: string, match?: TeamSeasonMatch, deadline = '') {
  const opponent = match?.home_team === scope.team ? match.away_team : match?.home_team
  return `Team — please mark Yes, No, or Not sure ${match ? `for our match vs ${opponent || 'opponent TBD'} (${seasonMatchLabel(match)})` : `for the upcoming ${scope.team} season matches`}${deadline.trim() ? ` by ${deadline.trim()}` : ''}.\n\n${link}\n\nSign in to answer for yourself. You can also fill in other season dates you know and add matches and times to Apple, Google, or your TiQ calendar. Update your answers any time. Availability helps us plan; the final lineup follows separately.`
}
