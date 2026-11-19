import {
  assignmentNeedsCoachReview, getCoachAssignmentDueState, getCoachAssignmentReview,
  getPlayerAssignmentCheckIn, type CoachAssignment,
} from '../../lib/coach-storage'
import {html} from './match-details'

export const coachPracticeStatuses = [
  ['all', 'All practice'], ['assigned', 'Assigned'], ['review', 'Needs feedback'],
  ['reviewed', 'Feedback given'], ['completed', 'All completed'], ['draft', 'Drafts'], ['archived', 'Archived'],
] as const
export type CoachPracticeStatus = typeof coachPracticeStatuses[number][0]
export type CoachPracticeFilter = {q: string; status: CoachPracticeStatus}
export const emptyCoachPracticeFilter = (): CoachPracticeFilter => ({q: '', status: 'all'})

const needsReview = (assignment: CoachAssignment) => assignment.status === 'completed' && assignmentNeedsCoachReview(assignment)
const reviewed = (assignment: CoachAssignment) => assignment.status === 'completed' && Boolean(getCoachAssignmentReview(assignment.assignment))
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase()
const checkInTime = (assignment: CoachAssignment) => {
  const time = Date.parse(getPlayerAssignmentCheckIn(assignment.assignment)?.completedAt ?? '')
  return Number.isFinite(time) ? time : Infinity
}
const priority = (assignment: CoachAssignment) => needsReview(assignment) ? 0
  : assignment.status === 'assigned' ? 1 : assignment.status === 'completed' ? 2 : assignment.status === 'draft' ? 3 : 4

export function coachPracticeCounts(assignments: readonly CoachAssignment[]) {
  return {assigned: assignments.filter(a => a.status === 'assigned').length,
    review: assignments.filter(needsReview).length, reviewed: assignments.filter(reviewed).length}
}

export function filterCoachPractice(assignments: readonly CoachAssignment[], filter: CoachPracticeFilter) {
  const q = normalize(filter.q.trim())
  return assignments.filter(assignment => {
    const matchesStatus = filter.status === 'all' || (filter.status === 'review' ? needsReview(assignment)
      : filter.status === 'reviewed' ? reviewed(assignment) : assignment.status === filter.status)
    return matchesStatus && (!q || normalize(assignment.title).includes(q) || normalize(assignment.focus).includes(q))
  }).sort((a, b) => {
    const order = priority(a) - priority(b)
    if (order) return order
    if (needsReview(a) && needsReview(b)) return checkInTime(a) - checkInTime(b) || a.id.localeCompare(b.id)
    if (a.status === 'assigned' && b.status === 'assigned') {
      const due = a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : a.dueDate ? -1 : b.dueDate ? 1 : 0
      if (due) return due
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id)
  })
}

function practiceRows(assignments: readonly CoachAssignment[], now: Date) {
  return assignments.map(assignment => {
    const status = needsReview(assignment) ? 'Needs feedback' : reviewed(assignment) ? 'Feedback given'
      : ({assigned: 'Assigned', completed: 'Completed', draft: 'Draft', archived: 'Archived'})[assignment.status]
    const due = assignment.status === 'assigned' ? getCoachAssignmentDueState(assignment.dueDate, now) : null
    return `<button type="button" class="secondary coach-record" data-coach-assignment="${html(assignment.id)}">
      <span><strong>${html(assignment.title)}</strong>${assignment.focus ? `<span class="coach-practice-focus">${html(assignment.focus)}</span>` : ''}
      <small>${status}${due ? ` · <span data-practice-due="${due.tone}">${html(due.label)}</span>` : ''}</small></span><span aria-hidden="true">›</span></button>`
  }).join('')
}

export function mountCoachPracticeTracker(host: HTMLElement, assignments: readonly CoachAssignment[], more: boolean,
  initial: CoachPracticeFilter, current: () => boolean, change: (filter: CoachPracticeFilter) => void,
  open: (id: string) => void) {
  let filter = {...initial}
  const counts = coachPracticeCounts(assignments)
  const shortcuts = coachPracticeStatuses.filter(([id]) => id === 'assigned' || id === 'review' || id === 'reviewed')
  host.innerHTML = `<section class="coach-practice-tracker" aria-labelledby="coach-practice-title">
    <h3 id="coach-practice-title">Practice tracker</h3>
    <p class="coach-practice-scope" id="coach-practice-scope">${more ? 'Latest ' + assignments.length + ' assignments · older work isn’t included' : assignments.length + ' assignment' + (assignments.length === 1 ? '' : 's') + ' loaded'}</p>
    <div class="coach-practice-summary" aria-label="Practice quick views">${shortcuts.map(([status, label]) =>
      `<button type="button" class="secondary" data-practice-status="${status}" aria-pressed="${filter.status === status}"><strong>${counts[status as keyof typeof counts]}</strong><span>${label}</span></button>`).join('')}</div>
    <form class="coach-practice-controls" role="search" aria-label="Find practice">
      <label for="coach-practice-query">Search loaded practice</label>
      <input id="coach-practice-query" type="search" maxlength="100" value="${html(filter.q)}" placeholder="Title or focus" aria-describedby="coach-practice-scope">
      <label for="coach-practice-status">Practice status</label><select id="coach-practice-status">${coachPracticeStatuses.map(([status,label]) => `<option value="${status}" ${filter.status === status ? 'selected' : ''}>${label}</option>`).join('')}</select>
      <button type="button" class="secondary" data-practice-clear>Clear practice filters</button>
    </form>
    <p class="coach-practice-result-count" role="status" aria-live="polite" aria-atomic="true" data-practice-count></p>
    <div class="coach-record-list" data-practice-results></div></section>`
  const search = host.querySelector<HTMLInputElement>('#coach-practice-query')!
  const select = host.querySelector<HTMLSelectElement>('#coach-practice-status')!
  const clear = host.querySelector<HTMLButtonElement>('[data-practice-clear]')!
  const results = host.querySelector<HTMLElement>('[data-practice-results]')!
  const active = () => host.isConnected && current()
  const paint = () => {
    const rows = filterCoachPractice(assignments, filter)
    host.querySelector<HTMLElement>('[data-practice-count]')!.textContent = `${rows.length} assignment${rows.length === 1 ? '' : 's'} shown`
    results.innerHTML = practiceRows(rows, new Date()) || `<p>${assignments.length ? 'No loaded practice matches this view. Try another status or clear the filters.' : 'No assignments are loaded for this student yet.'}</p>`
    host.querySelectorAll<HTMLButtonElement>('[data-practice-status]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.practiceStatus === filter.status)))
    clear.disabled = !filter.q && filter.status === 'all'
    clear.hidden = clear.disabled
  }
  search.addEventListener('input', () => {
    if (!active()) return
    filter = {...filter, q: search.value}; change({...filter}); paint()
  })
  select.addEventListener('change', () => {
    if (!active() || !coachPracticeStatuses.some(([status]) => status === select.value)) return
    filter = {...filter, status: select.value as CoachPracticeStatus}; change({...filter}); paint()
  })
  host.querySelector('form')!.addEventListener('submit', event => event.preventDefault())
  host.addEventListener('click', event => {
    if (!active() || !(event.target instanceof Element)) return
    const shortcut = event.target.closest<HTMLButtonElement>('[data-practice-status]')
    if (shortcut) {
      const status = shortcut.dataset.practiceStatus as CoachPracticeStatus
      if (!coachPracticeStatuses.some(([id]) => id === status)) return
      filter = {...filter, status: filter.status === status ? 'all' : status}; select.value = filter.status
      change({...filter}); paint(); return
    }
    if (event.target.closest('[data-practice-clear]')) {
      filter = emptyCoachPracticeFilter(); search.value = ''; select.value = 'all'
      change({...filter}); paint(); search.focus({preventScroll: true}); return
    }
    const id = event.target.closest<HTMLButtonElement>('[data-coach-assignment]')?.dataset.coachAssignment
    if (id && filterCoachPractice(assignments, filter).some(assignment => assignment.id === id)) open(id)
  })
  paint()
}
