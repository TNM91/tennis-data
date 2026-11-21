import {getCoachAssignmentReview, getPlayerAssignmentCheckIn} from '../../lib/coach-storage'
import {readPracticeBlock, type GrowthPlan} from '../../lib/tiq-growth'
import type {TrainingCoachWork} from './training-inbox-data'
import {html} from './match-details'

export function growthCoachContext(plan: GrowthPlan, work: TrainingCoachWork | null) {
  const assignment = work?.assignments.find(row => row.id === plan.sourceAssignment)
  const link = work?.links.find(row => row.id === assignment?.studentLinkId && row.status !== 'paused')
  if (!assignment || !link) return {state:'unavailable'} as const
  const checkIn = getPlayerAssignmentCheckIn(assignment.assignment)
  if (assignment.status === 'completed' || checkIn) {
    const review = getCoachAssignmentReview(assignment.assignment)
    return review ? {state:'feedback',review} as const : {state:'waiting'} as const
  }
  if (plan.state !== 'active') return {state:'closed'} as const
  try {
    const block = readPracticeBlock(assignment.assignment.tiqGrowth)
    if (assignment.status === 'assigned' && plan.state === 'active'
      && block.skill === plan.skill && block.target === plan.target && block.sessions === plan.sessions && block.reviewDate === plan.reviewDate) {
      return {state:'ready',assignment,link} as const
    }
  } catch { /* The current assignment is no longer this practice block. */ }
  return {state:'changed'} as const
}

export function growthCoachFollowup(plan: GrowthPlan, work: TrainingCoachWork | null) {
  const context = growthCoachContext(plan,work)
  if (plan.state === 'active' || context.state !== 'feedback' || !Number.isFinite(Date.parse(context.review.reviewedAt))) return null
  const cue = context.review.nextFocus || context.review.note
  const title = work!.assignments.find(row => row.id === plan.sourceAssignment)!.title
  return {skill:plan.skill, cue, target:cue.length<=240?cue:'', reviewedAt:context.review.reviewedAt, title,
    label:context.review.nextFocus?'Coach’s next focus':'Coach feedback'}
}

export function growthCoachFollowupHtml(seed: NonNullable<ReturnType<typeof growthCoachFollowup>>) {
  return `<section class="tiq-growth-coach" aria-label="Coach feedback for next plan"><h3>${html(seed.label)}</h3><p>${html(seed.title)} · <time datetime="${html(seed.reviewedAt)}">${html(new Date(seed.reviewedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}</time></p><p class="coach-written">${html(seed.cue)}</p>${!seed.target?'<p>Your coach’s full cue is kept here. Write a shorter, measurable target below.</p>':''}</section>`
}

export function growthCoachHtml(plan: GrowthPlan, work: TrainingCoachWork | null, locked: boolean, canStartPlan=false) {
  if (!plan.sourceAssignment) return ''
  const context = growthCoachContext(plan,work)
  const body = context.state === 'ready'
    ? `<h3>Coach check-in</h3><p>Choose the practice notes you want to share, then review your check-in.</p><button type="button" class="secondary" data-checkin ${locked?'disabled':''}>Prepare coach check-in</button>`
    : context.state === 'waiting' ? '<h3>Awaiting coach feedback</h3><p>Your check-in is sent. Refresh your plan to check for feedback.</p>'
    : context.state === 'feedback' ? `<h3>Coach feedback</h3>${Number.isFinite(Date.parse(context.review.reviewedAt))?`<p><time datetime="${html(context.review.reviewedAt)}">${html(new Date(context.review.reviewedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}</time></p>`:''}<p class="coach-written">${html(context.review.note)}</p>${context.review.nextFocus?`<p><strong>Next focus</strong> ${html(context.review.nextFocus)}</p>`:''}`
    : context.state === 'closed' ? '<h3>Coach check-in</h3><p>Open My Lab → Training inbox → Coach assignments to check in on the current assignment. Your saved plan remains private.</p>'
    : context.state === 'changed' ? '<h3>Coach assignment updated</h3><p>Your private plan is still saved. Open My Lab → Training inbox → Coach assignments to review the current assignment before checking in.</p>'
    : '<h3>Coach check-in unavailable</h3><p>Your private plan is still saved. Refresh to check your current coach connection.</p>'
  const followup=canStartPlan&&growthCoachFollowup(plan,work)
  return `<section class="tiq-growth-coach" aria-label="Plan coaching">${body}${followup?`<button type="button" class="secondary" data-coach-followup ${locked?'disabled':''}>Plan next practice</button>`:''}</section>`
}
