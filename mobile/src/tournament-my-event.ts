import type {TournamentDetail, TournamentMatch} from '../../lib/native-tournaments-contract'
import {formatTournamentEventDate, formatTournamentEventTime} from '../../lib/tournament-event-presentation'
import {tournamentCalendarMatchId} from '../../lib/player-competition-schedule'
import type {TournamentCalendarMatch} from './calendar-view'
import {appleMapsVenueHref} from './calendar-data'
import {competitionScheduleClock, competitionScheduleHtml} from './competition-match-card'
import {html} from './match-details'
import {tournamentCourtLabel, tournamentDrawRoundLabel, tournamentEntrantMatches, tournamentScheduleDay, tournamentScheduleTime, tournamentViewMatches} from './tournament-match-filters'

const opponent = (match: TournamentMatch, entrant: string) => match.a === entrant ? match.b : match.a

export function tournamentMyEvent(detail: TournamentDetail, entrant: string, allowCalendar: boolean): {content: string; calendarMatch?: TournamentCalendarMatch; venueHref?: string} {
  const division = detail.active
  if (!division || detail.drawNotice) return {content:'<p role="status">Your draw details are unavailable. Refresh or check with the event desk.</p>'}

  const zone = division.details.timeZone || detail.root.details.timeZone
  const now = zone ? competitionScheduleClock(zone) : null
  const matches = tournamentEntrantMatches(detail.matches, entrant)
  const results = matches.filter(match => match.winner).reverse()
  const pending = matches.filter(match => !match.winner)
  const scheduled = tournamentViewMatches(pending, 'schedule')
  const hasPassed = (match: TournamentMatch) => {
    const day = tournamentScheduleDay(match), time = tournamentScheduleTime(match.time)
    return Boolean(now && day && (day < now.day || day === now.day && time && time < now.time))
  }
  // A later knockout round can't take precedence over an unresolved earlier round.
  const next = division.status === 'completed' || detail.root.status === 'completed' ? undefined
    : division.format === 'round_robin' ? scheduled.find(match => !hasPassed(match)) ?? pending.find(match => !scheduled.includes(match)) ?? scheduled[0]
    : pending.sort((a, b) => a.round - b.round)[0]
  const nextOpponent = next ? opponent(next, entrant) : ''
  const waitingForOpponent = next && (!nextOpponent || (/^Winner (?:R\d+\.\d+|Group [A-Z](?: \(pending\))*)$/.test(nextOpponent)
    && !detail.standings.some(row => row.name === nextOpponent)))
  const canShowSlot = next && !waitingForOpponent && !hasPassed(next)
  const date = canShowSlot ? tournamentScheduleDay(next) : ''
  const time = canShowSlot ? tournamentScheduleTime(next.time) : ''
  const court = canShowSlot ? tournamentCourtLabel(next.court) : ''
  const eventLocation = detail.root.location.trim()
  const eventVenue = detail.root.details.venueName || eventLocation
  const eventAddress = detail.root.details.venueAddress || ''
  const divisionVenue = division.details.venueName || division.location.trim()
  const divisionAddress = division.details.venueAddress || ''
  const sharedVenue = (!divisionAddress || divisionAddress === eventAddress) && (!divisionVenue
    || divisionVenue.toLowerCase() === eventVenue.toLowerCase()
    || (!division.details.venueName && divisionVenue.toLowerCase() === eventLocation.toLowerCase()))
  const venueName = sharedVenue ? eventVenue || divisionVenue : divisionVenue
  const address = divisionAddress || (sharedVenue ? eventAddress : '')
  const venueHref = date && address ? appleMapsVenueHref(address) : ''
  const calendarMatch = allowCalendar && next?.id && date >= '1900-01-01' && date <= '2199-12-31'
    ? {id:tournamentCalendarMatchId(division.id,next.id), date, time}
    : undefined

  const content = `<section class="competition-fixture tournament-pass-ticket" aria-labelledby="tournament-next-match">
    <h3 id="tournament-next-match">Next match</h3>
    ${next ? `<p class="competition-date">${html(tournamentDrawRoundLabel(next))}</p>` : ''}
    <p class="tournament-pass-opponent">${next ? waitingForOpponent ? 'Opponent to be confirmed' : `vs ${html(nextOpponent)}` : 'No upcoming match posted'}</p>
    ${canShowSlot ? competitionScheduleHtml(date ? formatTournamentEventDate(date) : 'Date to be confirmed', formatTournamentEventTime(time), court || 'Court to be confirmed') : ''}
    ${time ? `<p class="tournament-pass-note">${zone ? `Event time · ${html(zone)}` : 'Event time zone to be confirmed'}</p>` : ''}
    ${next && hasPassed(next) ? '<p class="tournament-pass-note">The published start has passed. Check with the event desk for a new time or result.</p>' : ''}
    ${venueName || address ? `<p class="tournament-pass-venue">${html(venueName || address)}${venueName && address && address !== venueName ? `<br>${html(address)}` : ''}</p>` : ''}
    ${calendarMatch ? '<button type="button" class="secondary tournament-pass-action" data-event-calendar>View in Calendar<span aria-hidden="true">›</span></button>' : ''}
    ${venueHref ? '<button type="button" class="secondary tournament-pass-action" data-event-venue>Find venue in Apple Maps<span aria-hidden="true">↗</span></button><p role="status" class="tournament-pass-note" data-event-venue-status></p>' : ''}
  </section>
  <div class="tournament-pass-results" aria-labelledby="tournament-my-results" role="region">
    <h3 id="tournament-my-results">Your results</h3>
    ${results.length ? `<ol role="list">${results.map(match => `<li><p><small>${html(tournamentDrawRoundLabel(match))}</small><strong>vs ${html(opponent(match, entrant))}</strong></p><p><small data-won="${match.winner === entrant}">${match.winner === entrant ? 'Win' : 'Loss'}</small><strong>${html(match.score || 'Score pending')}</strong></p></li>`).join('')}</ol>` : '<p>No results posted yet.</p>'}
  </div>`
  return {content, calendarMatch, venueHref}
}
