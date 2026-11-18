import {getCoachAssignmentReview, getPlayerAssignmentCheckIn, type CoachAssignment} from '../../lib/coach-storage'
import {html} from './match-details'

// Form limits use UTF-16 length; keep a whole character at the boundary.
const fit = (value: string, max: number) => value.slice(0, max).replace(/[\uD800-\uDBFF]$/, '')

export function coachFollowUpFields(source: CoachAssignment) {
  const review = getCoachAssignmentReview(source.assignment)
  if (source.status !== 'completed' || !getPlayerAssignmentCheckIn(source.assignment) || !review?.nextFocus.trim()) return null
  const cue = review.nextFocus.trim()
  return {title: fit('Follow-up: ' + source.title, 180), focus: fit(cue, 300), instructions: fit(cue, 2000), dueDate: '', evidence: ''}
}

export function coachFollowUpHtml(source: CoachAssignment | undefined, paused = false) {
  const fields = source && coachFollowUpFields(source)
  if (!source || !fields) return ''
  return `<section class="coach-follow-up" aria-labelledby="coach-follow-up-title">
    <h3 id="coach-follow-up-title">Next practice</h3>
    <small>From ${html(source.title)}</small>
    <p class="coach-written" id="coach-follow-up-focus">${html(fields.instructions)}</p>
    <button type="button" class="secondary" data-coach-follow-up="${html(source.id)}" aria-describedby="coach-follow-up-focus" ${paused ? 'disabled' : ''}>Plan follow-up</button>
    ${paused ? '<p>Resume this connection in Edit student before assigning practice.</p>' : ''}
  </section>`
}
