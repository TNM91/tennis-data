import { buildTeamProfileHref } from './team-routes'

// Use the already imported team schedule; never route a calendar action back
// through a fresh upload or change the user's team membership.
export function buildScheduleCalendarHref(team: string, league = '', flight = '') {
  if (!team.trim()) return '/compete/teams'
  return `${buildTeamProfileHref(team.trim(), { layer: 'usta', league, flight })}#team-schedule`
}
