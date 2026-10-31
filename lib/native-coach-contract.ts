import {readCoachLessonRecipe,type CoachLessonRecipe} from './coach-lesson-recipe'
import type {CoachAssignment, CoachStudentStatus} from './coach-storage'

export type NativeCoachStudent = {
  id: string; name: string; level: string; identity: string; status: CoachStudentStatus
  linked: boolean; notes: string; updatedAt: string; email?:string;phone?:string;contactPreference?:string
}
export type NativeCoachSnapshot = {
  owner: string; checkedAt: string; students: NativeCoachStudent[]; moreStudents: boolean
  detail: {student: NativeCoachStudent; assignments: CoachAssignment[]; moreAssignments: boolean} | null
}
export type CoachCreate =
  | {kind: 'student'; id: string; name: string; level: string; notes: string}
  | {kind: 'assignment'; id: string; student: string; expectedUpdatedAt: string; title: string; focus: string; dueDate: string | null; instructions: string; evidence: string; status: 'draft' | 'assigned';recipe?:CoachLessonRecipe}
export type CoachReview = {id: string; student: string; expectedUpdatedAt: string; note: string; nextFocus: string}
export type CoachEdit =
  | {kind:'edit-student';id:string;expectedUpdatedAt:string;name:string;level:string;notes:string;status:CoachStudentStatus;identity?:string;email?:string;phone?:string;contactPreference?:string}
  | {kind:'edit-assignment';id:string;student:string;expectedUpdatedAt:string;title:string;focus:string;dueDate:string|null;instructions:string;evidence:string;status:CoachAssignment['status']}
export type CoachWrite=CoachCreate|CoachReview|CoachEdit
export const coachRecord = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid coach record')
  return v as Record<string, unknown>
}
const text = (v: unknown, max: number, required = false) => {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw Error('Invalid coach text')
  return v
}
export const coachId = (v: unknown) => {
  const id = text(v, 120, true)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(id)) throw Error('Invalid coach identifier')
  return id
}
const stamp = (v: unknown) => {const s = text(v, 80, true); if (!Number.isFinite(Date.parse(s))) throw Error('Invalid coach update'); return s}
const date = (v: unknown): string | null => {
  if (v === null) return null
  const s = text(v, 10, true)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) throw Error('Invalid due date')
  return s
}
const bool = (v: unknown) => {if (typeof v !== 'boolean') throw Error('Invalid coach flag'); return v}
const keys = (r: Record<string, unknown>, allowed: string[]) => {if (Object.keys(r).some(k => !allowed.includes(k))) throw Error('Unexpected coach field')}
function unique<T extends {id: string}>(rows: T[]) {if (new Set(rows.map(r => r.id)).size !== rows.length) throw Error('Duplicate coach records'); return rows}
function student(v: unknown): NativeCoachStudent {
  const r = coachRecord(v)
  if (!['active', 'needs_assignment', 'review_notes', 'paused'].includes(String(r.status))) throw Error('Invalid student status')
  return {id: coachId(r.id), name: text(r.name, 300, true), level: text(r.level, 160), identity: text(r.identity, 240), status: r.status as CoachStudentStatus, linked: bool(r.linked), notes: text(r.notes, 8000),email:text(r.email??'',320),phone:text(r.phone??'',80),contactPreference:text(r.contactPreference??'in_app',20), updatedAt: stamp(r.updatedAt)}
}
function assignment(v: unknown, selected: string): CoachAssignment {
  const r = coachRecord(v), data = coachRecord(r.assignment)
  if (r.studentLinkId !== selected || !['draft', 'assigned', 'completed', 'archived'].includes(String(r.status)) || JSON.stringify(data).length > 32000) throw Error('Invalid coach assignment')
  return {id: coachId(r.id), studentLinkId: selected, title: text(r.title, 300, true), focus: text(r.focus, 1000), dueDate: date(r.dueDate), status: r.status as CoachAssignment['status'], assignment: data, updatedAt: stamp(r.updatedAt)}
}
export function readNativeCoach(value: unknown, owner: string, selected = ''): NativeCoachSnapshot {
  const r = coachRecord(value)
  if (r.ok !== true || !owner || r.owner !== owner || !Array.isArray(r.students) || r.students.length > 100 || JSON.stringify(r).length > 600000) throw Error('Coach account changed')
  const students = unique(r.students.map(student))
  let detail: NativeCoachSnapshot['detail'] = null
  if (selected) {
    const d = coachRecord(r.detail), s = student(d.student)
    if (s.id !== selected || !Array.isArray(d.assignments) || d.assignments.length > 100) throw Error('Coach selection changed')
    detail = {student: s, assignments: unique(d.assignments.map(v => assignment(v, selected))), moreAssignments: bool(d.moreAssignments)}
  } else if (r.detail !== null) throw Error('Unexpected coach detail')
  return {owner, checkedAt: stamp(r.checkedAt), students, moreStudents: bool(r.moreStudents), detail}
}
export function readCoachCreate(value: unknown): CoachCreate {
  const r = coachRecord(value), id = coachId(r.id)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw Error('Invalid new record')
  if (r.kind === 'student') {
    keys(r, ['kind', 'id', 'name', 'level', 'notes'])
    return {kind: 'student', id, name: text(r.name, 150, true).trim(), level: text(r.level, 80).trim(), notes: text(r.notes, 2000).trim()}
  }
  if (r.kind !== 'assignment' || (r.status !== 'draft' && r.status !== 'assigned')) throw Error('Invalid assignment request')
  keys(r, ['kind', 'id', 'student', 'expectedUpdatedAt', 'title', 'focus', 'dueDate', 'instructions', 'evidence', 'status','recipe'])
  return {kind: 'assignment', id, student: coachId(r.student), expectedUpdatedAt: stamp(r.expectedUpdatedAt), title: text(r.title, 180, true).trim(), focus: text(r.focus, 300).trim(), dueDate: date(r.dueDate), instructions: text(r.instructions, 2000, true).trim(), evidence: text(r.evidence, 300).trim(), status: r.status,...(r.recipe===undefined?{}:{recipe:readCoachLessonRecipe(r.recipe)})}
}
export function readCoachReview(value: unknown): CoachReview {
  const r = coachRecord(value)
  keys(r, ['id', 'student', 'expectedUpdatedAt', 'note', 'nextFocus'])
  const review = {id: coachId(r.id), student: coachId(r.student), expectedUpdatedAt: stamp(r.expectedUpdatedAt), note: text(r.note, 700).trim(), nextFocus: text(r.nextFocus, 300).trim()}
  if (!review.note && !review.nextFocus) throw Error('Add coach feedback')
  return review
}
export function readCoachEdit(value:unknown):CoachEdit {
 const r=coachRecord(value),id=coachId(r.id),expectedUpdatedAt=stamp(r.expectedUpdatedAt)
 if(r.kind==='edit-student'){
  keys(r,['kind','id','expectedUpdatedAt','name','level','notes','status','identity','email','phone','contactPreference'])
  if(!['active','needs_assignment','review_notes','paused'].includes(String(r.status)))throw Error('Invalid student status')
  if(r.contactPreference!==undefined&&!['in_app','text','both'].includes(String(r.contactPreference)))throw Error('Invalid contact preference')
  if(r.email!==undefined&&r.email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email)))throw Error('Invalid email')
  return {...(r.identity===undefined?{}:{identity:text(r.identity,240)}),...(r.email===undefined?{}:{email:text(r.email,320)}),...(r.phone===undefined?{}:{phone:text(r.phone,80)}),...(r.contactPreference===undefined?{}:{contactPreference:text(r.contactPreference,20)}),kind:r.kind,id,expectedUpdatedAt,name:text(r.name,300,true).trim(),level:text(r.level,160).trim(),notes:text(r.notes,8000).trim(),status:r.status as CoachStudentStatus}
 }
 if(r.kind!=='edit-assignment'||!['draft','assigned','completed','archived'].includes(String(r.status)))throw Error('Invalid assignment edit')
 keys(r,['kind','id','student','expectedUpdatedAt','title','focus','dueDate','instructions','evidence','status'])
 return {kind:r.kind,id,student:coachId(r.student),expectedUpdatedAt,title:text(r.title,300,true).trim(),focus:text(r.focus,1000).trim(),dueDate:date(r.dueDate),instructions:text(r.instructions,8000).trim(),evidence:text(r.evidence,2000).trim(),status:r.status as CoachAssignment['status']}
}
