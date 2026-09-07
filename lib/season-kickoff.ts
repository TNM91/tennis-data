import { buildTeamSeasonCalendars, type TeamSeasonMatch } from './team-season-calendar'
import { normalizeScheduleCalendarTime } from './team-schedule-calendar'

export type SeasonScope = { team: string; league: string; flight: string; seasonKey: string }
export type SeasonReplyStatus = 'available' | 'maybe' | 'unavailable'
export type SeasonReply = { match_id: string; status: SeasonReplyStatus; match_date: string; match_time: string; responded_at?: string; invite_id?: string }
export type SeasonPlayer = { key: string; playerId: string | null; name: string }
export type SeasonInvite = { id: string; roster_key: string; player_id: string | null; player_name: string; response_token: string; revoked_at: string | null; match_ids: string[] }

export function seasonMatchLabel(match: TeamSeasonMatch) {
  const date = match.match_date ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${match.match_date}T12:00:00Z`)) : 'Date TBD'
  const time = normalizeScheduleCalendarTime(match.match_time)
  if (!time) return `${date} · Time TBD`
  const [hour, minute] = time.split(':').map(Number)
  return `${date} · ${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function seasonFixtures(scope: SeasonScope, rows: TeamSeasonMatch[]) {
  return rows.filter(row => row.league_name === scope.league && (row.flight || '') === scope.flight
    && buildTeamSeasonCalendars(scope.team, [row], '').some(season => season.key === scope.seasonKey))
    .sort((a, b) => (a.match_date || '').localeCompare(b.match_date || '') || (a.match_time || '').localeCompare(b.match_time || '') || a.id.localeCompare(b.id))
}

// Availability belongs to a fixture, not just a day. Moving its date/time asks
// the player to review again; an old Yes must not confirm a rescheduled match.
export function currentSeasonReplies(matches: TeamSeasonMatch[], replies: SeasonReply[]) {
  const byId = new Map(matches.map(match => [match.id, match]))
  return replies.filter(reply => {
    const match = byId.get(reply.match_id)
    return match && match.match_date === reply.match_date
      && normalizeScheduleCalendarTime(match.match_time) === normalizeScheduleCalendarTime(reply.match_time)
  })
}

export function seasonReadiness(matches: TeamSeasonMatch[], invites: Pick<SeasonInvite, 'id' | 'revoked_at'>[], replies: SeasonReply[]) {
  const active = new Set(invites.filter(invite => !invite.revoked_at).map(invite => invite.id))
  const valid = currentSeasonReplies(matches, replies).filter(reply => active.has(reply.invite_id || ''))
  return matches.map(match => {
    const rows = valid.filter(reply => reply.match_id === match.id)
    return { matchId: match.id, available: rows.filter(row => row.status === 'available').length,
      maybe: rows.filter(row => row.status === 'maybe').length, unavailable: rows.filter(row => row.status === 'unavailable').length,
      waiting: active.size - new Set(rows.map(row => row.invite_id)).size }
  })
}

export function seasonInviteText(team: string, name: string, link: string) {
  return `${name}, let's plan the season for ${team}. Mark the matches you can play and add the season to your calendar: ${link}\nNo TiQ login needed to reply. Availability is not a final lineup selection. Keep this personal link to update your answers.`
}

export type SeasonLineupAnswer = { id: string; match_id?: string; match_date: string | null; team_name: string | null; league_name: string | null; flight: string | null; player_id: string; status: string | null; notes: string | null; responded_at?: string | null }
export function mergeSeasonLineupAnswers(answers: SeasonLineupAnswer[]) {
  const byPlayer = new Map<string, SeasonLineupAnswer>()
  for (const answer of answers) {
    const previous = byPlayer.get(answer.player_id)
    if (!previous || (Date.parse(answer.responded_at || '') || 0) >= (Date.parse(previous.responded_at || '') || 0)) byPlayer.set(answer.player_id, answer)
  }
  return [...byPlayer.values()]
}
