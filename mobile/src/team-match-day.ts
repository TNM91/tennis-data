import {formatCaptainPracticeTime} from '../../lib/captain-practice-invite'
import {html} from './match-details'
import {matchDate} from './recent-results'
import {currentTeamPlan, matchAvailabilityLabel, ownTeamCourt, teamMatchOverview} from './team-hub'
import type {NativeTeamRoom} from './team-room-data'

function nextMatchAction(room: NativeTeamRoom, owner: string) {
  const plan = currentTeamPlan(room), card = plan?.card
  if (room.chatReady && card) {
    if (card.replacement?.canRespond) return {target: '#team-match-replacement', label: 'Review lineup change'}
    if (card.published && room.finalLineupReview?.currentUserRequired && !room.finalLineupReview.currentUserSeen) {
      return {target: '[data-final-ack]', label: 'Review final lineup'}
    }
    if (!card.published && !plan.response) return {target: '#team-match-availability', label: 'Reply with availability'}
    if (!card.published && card.cardType === 'projected_lineup' && card.lineupVersion && !card.acknowledged) {
      return {target: '[data-lineup-ack]', label: 'Review shared lineup'}
    }
    const court = ownTeamCourt(room, owner)
    if (card.published && court && !card.arrivals?.some(arrival => arrival.profileId === owner && arrival.courtLabel === court.courtLabel && arrival.status === 'here')) {
      return {target: '#team-match-arrival', label: 'Update arrival'}
    }
  }
  if (room.canManage && !room.chatRoom) return {target: '[data-team-tab="Captain"]', label: 'Open Captain tools'}
  return null
}

export function teamMatchTicketHtml(room: NativeTeamRoom, owner: string) {
  const next = teamMatchOverview(room), plan = currentTeamPlan(room), court = ownTeamCourt(room, owner)
  const action = nextMatchAction(room, owner)
  return `<section class="team-match-ticket" aria-labelledby="team-match-heading">
    <h2 id="team-match-heading" tabindex="-1">Next team match</h2>
    ${next ? `<p class="team-match-opponent">${next.opponent ? `vs ${html(next.opponent)}` : 'Opponent to be confirmed'}</p>
      <div class="team-match-schedule"><p><strong>${html(matchDate(next.matchDate))}</strong> · ${html(formatCaptainPracticeTime(next.matchTime) || 'Time to be confirmed')}</p><p>${html(next.facility || 'Facility to be confirmed')}</p></div>`
    : '<p>No upcoming match is recorded for this team.</p>'}
    ${plan ? `<dl class="team-match-summary"><div><dt>Your availability</dt><dd>${matchAvailabilityLabel(plan.response)}</dd></div>
      ${court ? `<div><dt>${plan.card?.published ? 'Your court' : 'Proposed court'}</dt><dd>${html(court.courtLabel)}</dd></div>` : ''}</dl>`
    : next ? '<p class="rating-context">Your captain hasn’t shared a match plan yet.</p>' : ''}
    ${action ? `<button type="button" data-team-match-next="${html(action.target)}">${action.label}<span aria-hidden="true">›</span></button>` : ''}
    <p role="status" id="match-action-status"></p><button type="button" class="secondary" id="match-action-retry" hidden>Retry same match reply</button>
  </section>`
}
