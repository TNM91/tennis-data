import {coachSnapshot} from './native-coach'
import {buildCoachAssignmentReview, type CoachAssignment} from '../../lib/coach-storage'
import {readCoachCreate, readCoachReview,readCoachEdit} from '../../lib/native-coach-contract'
import {readCoachConnectionIntent,type CoachConnection} from '../../lib/native-coach-connection-contract'
import {readCoachInviteIntent, type CoachInvitation} from '../../lib/native-coach-invite-contract'
const seed = coachSnapshot('student-one')
const students = seed.students
const assignments = new Map<string, CoachAssignment[]>([['student-one', seed.detail!.assignments]])
let lose = false, race = false, denied = false, writes = 0
const invitations = new Map<string, CoachInvitation[]>()
let connection:CoachConnection={owner:seed.owner,name:'Alex Rivera',level:'4.0',message:'Bring your return practice check-in.',expiresAt:'2030-01-01T00:00:00Z',state:'ready',revision:'a'.repeat(64)}
export function coachPreviewConnectionRequest(body?:BodyInit|null):Response{
 const intent=readCoachConnectionIntent(JSON.parse(String(body)))
 if(intent.token==='wrong-email')return Response.json({}, {status:403})
 if(intent.action==='accept'){
  writes++;const counter=document.querySelector('[data-coach-writes]');if(counter)counter.textContent='Coach writes: '+writes
  if(intent.revision!==connection.revision)return Response.json({}, {status:409})
  connection={...connection,state:'connected',revision:'b'.repeat(64)}
  if(lose){lose=false;throw Error('Synthetic connection confirmation lost')}
 }
 return Response.json({ok:true,...connection})
}
export function coachPreviewInvitesRequest(method: string, url: URL, body?: BodyInit | null): Response {
 if (denied) return Response.json({ok: false}, {status: 403})
 let selected = url.searchParams.get('student') || ''
 if (method !== 'GET') {
  const draft = readCoachInviteIntent(JSON.parse(String(body))); selected = draft.student
  writes++; const counter = document.querySelector('[data-coach-writes]'); if (counter) counter.textContent = 'Coach writes: ' + writes
  const rows = invitations.get(selected) || []
  if (draft.action === 'create') {if (!rows.some(i => i.id === draft.id)) rows.unshift({id: draft.id, student: selected, email: draft.email, message: draft.message, status: 'pending', expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), updatedAt: new Date().toISOString(), href: 'https://www.tenaceiq.com/coach/invite/77777777-7777-4777-8777-777777777777'})}
  else {const i = rows.find(i => i.id === draft.id); if (!i || i.updatedAt !== draft.expectedUpdatedAt || i.status !== 'pending') return Response.json({}, {status: 409}); i.status = 'revoked'; i.updatedAt = new Date(Date.parse(i.updatedAt) + 1).toISOString(); i.href = ''}
  invitations.set(selected, rows)
  if (lose) {lose = false; throw Error('Synthetic invitation confirmation lost')}
 }
 const s = students.find(s => s.id === selected)
 if (!s) return Response.json({}, {status: 404})
 return Response.json({ok: true, owner: seed.owner, student: {id: s.id, name: s.name, linked: s.linked, paused: s.status === 'paused', updatedAt: s.updatedAt}, invites: invitations.get(selected) || [], more: false})
}
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
   const value=JSON.parse(String(body))
   const draft='kind' in value?readCoachEdit(value):readCoachReview(value)
   if('kind' in draft&&draft.kind==='edit-student'){
    selected=draft.id;const s=students.find(s=>s.id===draft.id)
    if(!s)return Response.json({}, {status:404})
    if(race){s.updatedAt=new Date(Date.parse(s.updatedAt)+1).toISOString();race=false}
    if(s.updatedAt!==draft.expectedUpdatedAt)return Response.json({}, {status:409})
    Object.assign(s,{name:draft.name,level:draft.level,notes:draft.notes,status:draft.status,updatedAt:new Date(Math.max(Date.now(),Date.parse(s.updatedAt)+1)).toISOString()})
   }else{
   selected = draft.student
   const a = assignments.get(selected)?.find(a => a.id === draft.id)
   if (!a) return Response.json({ok: false}, {status: 404})
   if (race) {a.updatedAt = new Date().toISOString(); a.assignment.playerCheckIn = {recap: 'Newer player proof', evidence: '5/5', completedAt: a.updatedAt}; race = false}
   if (a.updatedAt !== draft.expectedUpdatedAt) return Response.json({ok: false}, {status: 409})
   if('kind' in draft){Object.assign(a,{title:draft.title,focus:draft.focus,dueDate:draft.dueDate,status:draft.status});a.assignment={...a.assignment,detail:draft.instructions,expectedEvidence:draft.evidence}}
   else a.assignment = buildCoachAssignmentReview(a.assignment, draft)
   a.updatedAt = new Date(Math.max(Date.now(),Date.parse(a.updatedAt)+1)).toISOString()
   }
  }
  if (lose) {lose = false; throw Error('Synthetic Coach confirmation lost')}
 }
 const s = students.find(s => s.id === selected)
 if (selected && !s) return Response.json({ok: false}, {status: 404})
 return Response.json({ok: true, owner: seed.owner, checkedAt: new Date().toISOString(), students, moreStudents: false, detail: selected && s ? {student: s, assignments: assignments.get(selected) || [], moreAssignments: false} : null})
}
