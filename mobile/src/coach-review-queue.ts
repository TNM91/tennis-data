import {assignmentNeedsCoachReview, getPlayerAssignmentCheckIn, type CoachAssignment} from '../../lib/coach-storage'
import {html} from './match-details'

const checkInTime = (assignment: CoachAssignment) => {
  const time = Date.parse(getPlayerAssignmentCheckIn(assignment.assignment)?.completedAt ?? '')
  return Number.isFinite(time) ? time : Infinity
}

export function coachReviewQueue(assignments: readonly CoachAssignment[]) {
  return assignments.filter(assignment => assignment.status === 'completed' && assignmentNeedsCoachReview(assignment))
    .sort((a, b) => checkInTime(a) - checkInTime(b) || a.id.localeCompare(b.id))
}

export function coachReviewQueueHtml(assignments: readonly CoachAssignment[], moreAssignments = false) {
  const queue = coachReviewQueue(assignments), next = queue[0]
  if (!next) return ''
  const checkIn = getPlayerAssignmentCheckIn(next.assignment)!, time = checkInTime(next)
  const date = Number.isFinite(time) ? new Date(time) : null
  return `<section class="coach-review-queue" aria-labelledby="coach-review-queue-title">
    <h3 id="coach-review-queue-title">Check-ins to review</h3>
    <p class="coach-review-count">${queue.length} awaiting feedback${moreAssignments ? ' in the latest 100 assignments' : ''} · Oldest first</p>
    <h4 id="coach-review-next-title">${html(next.title)}</h4>
    ${date ? `<time datetime="${date.toISOString()}">Checked in ${html(date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}))}</time>` : ''}
    <p class="coach-review-recap">${html(checkIn.recap || checkIn.evidence)}</p>
    <button type="button" class="secondary" data-coach-review-next="${html(next.id)}" aria-describedby="coach-review-next-title">Review next check-in</button>
  </section>`
}
