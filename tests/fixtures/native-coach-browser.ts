import {coachSnapshot} from './native-coach'
import {buildCoachAssignmentReview, type CoachAssignment} from '../../lib/coach-storage'
import {readCoachCreate, readCoachReview} from '../../lib/native-coach-contract'
const seed = coachSnapshot('student-one')
const students = seed.students
const assignments = new Map<string, CoachAssignment[]>([['student-one', seed.detail!.assignments]])
let lose = false, race = false, denied = false, writes = 0
export function coachPreviewControls(host: HTMLElement) {
 host.insertAdjacentHTML('beforeend', '<button type="button" data-coach-lose>Lose next Coach confirmation</button><button type="button" data-coach-race>Change Coach check-in before save</button><button type="button" data-coach-deny>Disable Coach access</button><p data-coach-writes>Coach writes: 0</p>')
 host.querySelector('[data-coach-lose]')?.addEventListener('click', () => {lose = true})
 host.querySelector('[data-coach-race]')?.addEventListener('click', () => {race = true})
 host.querySelector('[data-coach-deny]')?.addEventListener('click', () => {denied = true})
}
export function coachPreviewRequest(method: string, url: URL, body?: BodyInit | null): Response {
 if (denied) return Response.json({ok: false}, {status: 403})
 let selected = url.searchParams.get('student') || ''
 if (method !== 'GET') {
  writes++; const counter = document.querySelector('[data-coach-writes]'); if (counter) counter.textContent = 'Coach writes: ' + writes
  if (method === 'POST') {
   const draft = readCoachCreate(JSON.parse(String(body)))
   if (draft.kind === 'student') {
    selected = draft.id
    if (!students.some(s => s.id === draft.id)) students.unshift({id: draft.id, name: draft.name, level: draft.level, notes: draft.notes, identity: 'relentless-competitor-4-0', linked: false, status: 'needs_assignment', updatedAt: new Date().toISOString()})
    assignments.set(draft.id, [])
   } else {
    selected = draft.student
    const rows = assignments.get(selected) || []
    if (!rows.some(a => a.id === draft.id)) rows.unshift({id: draft.id, studentLinkId: selected, title: draft.title, focus: draft.focus, dueDate: draft.dueDate, status: draft.status, assignment: {detail: draft.instructions, expectedEvidence: draft.evidence}, updatedAt: new Date().toISOString()})
    assignments.set(selected, rows)
   }
  } else {
   const draft = readCoachReview(JSON.parse(String(body))); selected = draft.student
   const a = assignments.get(selected)?.find(a => a.id === draft.id)
   if (!a) return Response.json({ok: false}, {status: 404})
   if (race) {a.updatedAt = new Date().toISOString(); a.assignment.playerCheckIn = {recap: 'Newer player proof', evidence: '5/5', completedAt: a.updatedAt}; race = false}
   if (a.updatedAt !== draft.expectedUpdatedAt) return Response.json({ok: false}, {status: 409})
   a.assignment = buildCoachAssignmentReview(a.assignment, draft); a.updatedAt = new Date().toISOString()
  }
  if (lose) {lose = false; throw Error('Synthetic Coach confirmation lost')}
 }
 const s = students.find(s => s.id === selected)
 if (selected && !s) return Response.json({ok: false}, {status: 404})
 return Response.json({ok: true, owner: seed.owner, checkedAt: new Date().toISOString(), students, moreStudents: false, detail: selected && s ? {student: s, assignments: assignments.get(selected) || [], moreAssignments: false} : null})
}
