import type {SupabaseClient} from '@supabase/supabase-js'
import {readCoachCreate, readCoachReview, readCoachEdit, type NativeCoachSnapshot, type CoachWrite} from '../../lib/native-coach-contract'
import {getCoachAssignmentSummary, getCoachAssignmentReview, getPlayerAssignmentCheckIn, sortCoachAssignmentsForReview, assignmentNeedsCoachReview, type CoachAssignment} from '../../lib/coach-storage'
import {CoachWorkspaceError, loadCoachWorkspace, saveCoachWorkspace, type CoachSend} from './coach-workspace-data'
import {html} from './match-details'
import {openCoachInvitations} from './coach-invites-view'

type View = 'students' | 'student' | 'assignment' | 'add' | 'assign' | 'review' | 'confirm' | 'edit-student' | 'edit-assignment'
const statusLabel = (s: string) => ({active: 'Active', needs_assignment: 'Needs assignment', review_notes: 'Review notes', paused: 'Paused', draft: 'Draft', assigned: 'Assigned', completed: 'Completed', archived: 'Archived'})[s] || s
function confirmationHtml(draft: CoachWrite, state: {linked: boolean; busy: boolean; attempted: boolean; uncertain: boolean; conflict: boolean}) {
  let content = '', label = 'Save feedback'
  if ('kind' in draft) {
    if (draft.kind === 'student'||draft.kind==='edit-student') {
      label = draft.kind==='student'?'Create student record':'Save student changes'
      content = `<p>${draft.kind==='student'?'Create a coach-only roster record. No invitation is sent and no player account is connected.':'Update your student’s roster details and private coaching notes.'}</p><h3>${html(draft.name)}</h3><p>${html(draft.level)}</p>${draft.kind==='edit-student'?'<p>'+html(statusLabel(draft.status))+'</p>':''}<p class="coach-written">${html(draft.notes)}</p>`
    } else {
      label = draft.kind==='edit-assignment'?'Save assignment changes':draft.status === 'draft' ? 'Save draft' : 'Assign practice'
      content = `<p>${draft.kind==='edit-assignment'?'Update these practice details. Saved player check-ins and your feedback are retained.':draft.status === 'draft' ? 'Save a draft for your own planning.' : state.linked ? 'Make this assignment available to the connected student.' : 'Save this work to your coach roster. It appears in the student’s app after a coach connection is accepted.'} No team message or push alert is sent.</p><h3>${html(draft.title)}</h3><p>${html(draft.focus)}</p><p>${html(statusLabel(draft.status))}${draft.dueDate ? ' · Due ' + html(draft.dueDate) : ' · No due date'}</p><p class="coach-written">${html(draft.instructions)}</p><p><strong>Proof:</strong> ${html(draft.evidence || 'No extra proof requested.')}</p>`
    }
  } else content = `<p>Save feedback on the player’s completed check-in. Assignment completion stays unchanged.</p><p class="coach-written">${html(draft.note)}</p><p><strong>Next focus:</strong> ${html(draft.nextFocus)}</p>`
  return content + `<button type="button" data-coach-save ${state.busy || state.uncertain || state.conflict ? 'disabled' : ''}>${state.attempted ? 'Retry same update' : label}</button>${state.attempted ? `<button type="button" class="secondary" data-coach-check ${state.busy ? 'disabled' : ''}>Check saved work</button>` : '<button type="button" class="secondary" data-coach-edit>Edit details</button>'}`
}
export function coachAssignmentHtml(a: CoachAssignment) {
  const summary = getCoachAssignmentSummary(a.assignment), check = getPlayerAssignmentCheckIn(a.assignment), review = getCoachAssignmentReview(a.assignment)
  return `<section class="coach-plan"><small>${html(statusLabel(a.status))}${a.dueDate ? ' · Due ' + html(a.dueDate) : ''}</small><h3>${html(a.title)}</h3>${a.focus ? `<p>${html(a.focus)}</p>` : ''}${summary.detail ? `<p class="coach-written">${html(summary.detail)}</p>` : ''}${summary.volume ? `<p>${html(summary.volume)}</p>` : ''}${summary.tracker.length ? `<ul>${summary.tracker.map(t => `<li>${html(t)}</li>`).join('')}</ul>` : ''}${summary.expectedEvidence ? `<p><strong>Proof to bring:</strong> ${html(summary.expectedEvidence)}</p>` : ''}${summary.prompt ? `<p>${html(summary.prompt)}</p>` : ''}</section>${check ? `<section class="coach-proof"><h3>Player check-in</h3><p class="coach-written">${html(check.recap)}</p><p class="coach-written">${html(check.evidence)}</p></section>` : '<p>No player check-in is recorded.</p>'}${review ? `<section><h3>Your feedback</h3><p class="coach-written">${html(review.note)}</p><p><strong>Next focus:</strong> ${html(review.nextFocus)}</p></section>` : ''}`
}
export function openCoachWorkspace(client: SupabaseClient, owner: string, current: () => boolean, send?: CoachSend, trigger?: HTMLElement) {
  const previous = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const dialog = document.createElement('dialog'); dialog.className = 'captain-lineup-dialog coach-workspace-dialog'; dialog.setAttribute('aria-label', 'Coach workspace')
  let disposed = false, busy = false, version = 0, selected = '', assignmentId = '', view: View = 'students', formView: View = 'add'
  let snapshot: NativeCoachSnapshot | null = null, draft: CoachWrite | null = null, fields: Record<string, string> = {}
  let attempted = false, uncertain = false, conflict = false, notice = '', leaving = false, leaveAction: (() => void) | null = null
  let invitations: ReturnType<typeof openCoachInvitations> | null = null
  const active = () => !disposed && current(), focus = () => dialog.querySelector<HTMLElement>('h2')?.focus({preventScroll: true})
  const dispose = () => {if (disposed) return; disposed = true; invitations?.dispose(); invitations = null; version++; snapshot = null; draft = null; fields = {}; leaveAction = null; document.removeEventListener('visibilitychange', visibility); dialog.close(); dialog.remove(); if (current() && previous?.isConnected) previous.focus({preventScroll: true})}
  // Keep edits in memory through app switching; account changes still dispose the workspace.
  const visibility = () => {if (!current()) dispose()}
  const isEditing = () => ['add', 'assign', 'review', 'confirm','edit-student','edit-assignment'].includes(view)
  const requestLeave = (action?: () => void, retain = false) => {
    if (invitations?.isOpen()) {invitations.back(); return}
    if (busy) return
    if (isEditing()) {leaving = true; leaveAction = retain ? action ?? dispose : () => {dispose(); action?.()}; render(); focus()} else {dispose(); action?.()}
  }
  const clearDraft = () => {draft = null; fields = {}; attempted = uncertain = conflict = false; notice = ''; leaving = false; leaveAction = null}
  const begin = (next: View, a?: CoachAssignment) => {
    clearDraft(); view = next; formView = next
    if (next === 'review' && a) {assignmentId = a.id; const review = getCoachAssignmentReview(a.assignment); fields = {note: review?.note || '', nextFocus: review?.nextFocus || ''}}
    if(next==='edit-student'&&snapshot?.detail){const s=snapshot.detail.student;fields={name:s.name,level:s.level,notes:s.notes,status:s.status}}
    if(next==='edit-assignment'&&a){assignmentId=a.id;fields={title:a.title,focus:a.focus,dueDate:a.dueDate||'',instructions:typeof a.assignment.detail==='string'?a.assignment.detail:'',evidence:typeof a.assignment.expectedEvidence==='string'?a.assignment.expectedEvidence:''}}
    render(); focus()
  }
  const load = async (id = '') => {
    if (!active() || busy) return
    const visit = ++version; busy = true; notice = 'Loading your Coach records…'; selected = id; snapshot = null; render()
    try {const found = await loadCoachWorkspace(client, owner, () => active() && visit === version, id, send); if (active() && visit === version) {snapshot = found; view = id ? 'student' : 'students'; notice = ''}}
    catch (error) {if (active() && visit === version) notice = error instanceof CoachWorkspaceError ? error.message : 'Coach records are unavailable. Try again when connected.'}
    finally {if (active() && visit === version) {busy = false; render(); focus()}}
  }
  const field = (name: string, label: string, max: number, required = false, multiline = false, type = 'text') => `<label for="coach-${name}">${label}</label>${multiline ? `<textarea id="coach-${name}" name="${name}" maxlength="${max}" ${required ? 'required' : ''}>${html(fields[name] || '')}</textarea>` : `<input id="coach-${name}" name="${name}" type="${type}" maxlength="${max}" value="${html(fields[name] || '')}" ${required ? 'required' : ''}>`}`
  const submit = (event: SubmitEvent) => {
    event.preventDefault(); if (!active() || busy) return
    const s = snapshot?.detail?.student, a = snapshot?.detail?.assignments.find(a => a.id === assignmentId)
    try {
      if (view === 'add') draft = Object.freeze(readCoachCreate({kind: 'student', id: crypto.randomUUID(), name: fields.name || '', level: fields.level || '', notes: fields.notes || ''}))
      else if (view === 'assign' && s) draft = Object.freeze(readCoachCreate({kind: 'assignment', id: crypto.randomUUID(), student: s.id, expectedUpdatedAt: s.updatedAt, title: fields.title || '', focus: fields.focus || '', dueDate: fields.dueDate || null, instructions: fields.instructions || '', evidence: fields.evidence || '', status: (event.submitter as HTMLButtonElement | null)?.dataset.status === 'draft' ? 'draft' : 'assigned'}))
      else if (view === 'review' && s && a) draft = Object.freeze(readCoachReview({id: a.id, student: s.id, expectedUpdatedAt: a.updatedAt, note: fields.note || '', nextFocus: fields.nextFocus || ''}))
      else if(view==='edit-student'&&s)draft=Object.freeze(readCoachEdit({kind:'edit-student',id:s.id,expectedUpdatedAt:s.updatedAt,name:fields.name||'',level:fields.level||'',notes:fields.notes||'',status:fields.status||s.status}))
      else if(view==='edit-assignment'&&s&&a)draft=Object.freeze(readCoachEdit({kind:'edit-assignment',id:a.id,student:s.id,expectedUpdatedAt:a.updatedAt,title:fields.title||'',focus:fields.focus||'',dueDate:fields.dueDate||null,instructions:fields.instructions||'',evidence:fields.evidence||'',status:a.status==='draft'&&(event.submitter as HTMLButtonElement|null)?.dataset.status==='assigned'?'assigned':a.status}))
      else return
      formView = view; view = 'confirm'; notice = ''; render(); focus()
    } catch {notice = 'Complete the required fields and check your due date.'; render(); dialog.querySelector<HTMLElement>('[role="status"]')?.focus()}
  }
  const write = async (lookup: boolean) => {
    if (!draft || busy || !active() || (!lookup && (uncertain || conflict))) return
    const pending = draft; busy = true; if (!lookup) {attempted = true; uncertain = true}; notice = lookup ? 'Checking saved work…' : 'Saving your Coach update…'; render()
    try {
      const result = await saveCoachWorkspace(client, owner, active, pending, lookup, send)
      if (!active()) return
      if (result.confirmed) {snapshot = result.snapshot; selected = snapshot.detail!.student.id; clearDraft(); view = 'student'; notice = 'Saved to your Coach workspace.'}
      else {snapshot = result.snapshot; uncertain = false;conflict=conflict||!result.retryable; notice = conflict ? 'The saved record differs. Discard these edits and refresh before making another change.' : 'This exact update was not found. You can retry the same update or discard it and refresh.'}
    } catch (error) {
      if (!active()) return
      if (error instanceof CoachWorkspaceError && (error.status === 401 || error.status === 403)) {snapshot = null; draft = null; fields = {}; view = 'students'; selected = ''; notice = error.message}
      else if (lookup && error instanceof CoachWorkspaceError && error.status === 404 && 'kind' in pending && pending.kind === 'student') {uncertain = false; notice = 'This student record was not found. You can retry this same record.'}
      else {if (error instanceof CoachWorkspaceError && error.status === 409) conflict = true; notice = error instanceof CoachWorkspaceError ? error.message : 'Save not confirmed. Check saved work before retrying.'}
    } finally {if (active()) {busy = false; render(); focus()}}
  }
  const back = () => {
    if (invitations?.isOpen()) {invitations.back(); return true}
    if (busy) return true
    if (leaving) {leaving = false; leaveAction = null; render(); focus(); return true}
    if (isEditing()) {requestLeave(() => {clearDraft(); if (snapshot) {view = selected ? 'student' : 'students'; render(); focus()} else void load(selected)}, true); return true}
    if (view === 'assignment') {view = 'student'; render(); focus(); return true}
    if (selected) {clearDraft(); void load(''); return true}
    requestLeave(); return true
  }
  const render = () => {
    if (!active()) return
    const detail = snapshot?.detail, s = detail?.student, a = detail?.assignments.find(a => a.id === assignmentId)
    const heading = leaving ? 'Leave these edits?' : view === 'students' ? 'Your students' : view === 'student' ? s?.name || 'Student' : view === 'assignment' ? 'Assignment' : view === 'add' ? 'Add a student' : view === 'assign' ? 'Assign practice' : view==='edit-student'?'Edit student':view==='edit-assignment'?'Edit assignment':view === 'review' ? 'Review check-in' : 'Confirm Coach update'
    let content = ''
    if (leaving) content = `<p>${attempted ? 'The update may already be saved. Check saved work before sending it again.' : 'Your unsaved edits will be discarded.'}</p><button type="button" data-coach-keep>Keep editing</button><button type="button" class="secondary" data-coach-discard>Discard edits</button>`
    else if (view === 'confirm' && draft) {
      content = confirmationHtml(draft, {linked: Boolean(s?.linked), busy, attempted, uncertain, conflict})
    } else if (view === 'add') content = `<p>Add a student to your private coach roster. Connecting their app account is a separate invitation step.</p><form data-coach-form>${field('name', 'Player name', 150, true)}${field('level', 'Tennis level', 80)}${field('notes', 'Private coaching notes', 2000, false, true)}<button type="submit">Review student record</button></form>`
    else if (view === 'assign' && s) content = `<p>Plan the next rep for ${html(s.name)}.</p><form data-coach-form>${field('title', 'Assignment title', 180, true)}${field('focus', 'Tennis focus', 300)}${field('dueDate', 'Due date (optional)', 10, false, false, 'date')}${field('instructions', 'What to practise', 2000, true, true)}${field('evidence', 'Proof to bring back', 300, false, true)}<button type="submit" data-status="assigned">Review assignment</button><button type="submit" class="secondary" data-status="draft">Review as draft</button></form>`
    else if(view==='edit-student'&&s)content=`<form data-coach-form>${field('name','Player name',300,true)}${field('level','Tennis level',160)}${field('notes','Private coaching notes',8000,false,true)}<label for="coach-status">Student status</label><select id="coach-status" name="status">${['active','needs_assignment','review_notes','paused'].map(status=>'<option value="'+status+'" '+((fields.status||s.status)===status?'selected':'')+'>'+statusLabel(status)+'</option>').join('')}</select><button type="submit">Review student changes</button></form>`
    else if(view==='edit-assignment'&&a)content=`<p>${html(statusLabel(a.status))} practice</p><form data-coach-form>${field('title','Assignment title',300,true)}${field('focus','Tennis focus',1000)}${field('dueDate','Due date (optional)',10,false,false,'date')}${field('instructions','What to practise',8000,false,true)}${field('evidence','Proof to bring back',2000,false,true)}<button type="submit">Review assignment changes</button>${a.status==='draft'?'<button type="submit" class="secondary" data-status="assigned">Review and assign practice</button>':''}</form>`
    else if (view === 'review' && a) content = `${coachAssignmentHtml(a)}<form data-coach-form>${field('note', 'Your feedback', 700, false, true)}${field('nextFocus', 'Next tennis focus', 300, false, true)}<button type="submit">Review feedback</button></form>`
    else if (view === 'assignment' && a) content = coachAssignmentHtml(a) + '<button type="button" class="secondary" data-coach-edit-assignment>Edit assignment</button>' + (a.status === 'completed' && getPlayerAssignmentCheckIn(a.assignment) ? `<button type="button" data-coach-review>${getCoachAssignmentReview(a.assignment) ? 'Update feedback' : 'Review player check-in'}</button>` : '')
    else if (s) content = `<p class="coach-student-meta">${html([s.level, statusLabel(s.status)].filter(Boolean).join(' · '))}</p><p class="coach-connection">${s.linked ? 'Connected to a player account' : 'Roster only · an accepted coach invitation is needed before work appears in the player’s app.'}</p>${s.notes ? `<details><summary>Private coaching notes</summary><p class="coach-written">${html(s.notes)}</p></details>` : ''}<button type="button" class="secondary" data-coach-edit-student>Edit student</button><button type="button" data-coach-assign ${s.status === 'paused' ? 'disabled' : ''}>Assign practice</button>${s.status === 'paused' ? '<p>This connection is paused. Use Edit student to resume it before assigning work.</p>' : ''}<h3>Assignments</h3><p class="coach-count">${detail!.assignments.length}${detail!.moreAssignments ? '+' : ''} loaded · newest 100 at most</p><div class="coach-record-list">${sortCoachAssignmentsForReview(detail!.assignments).map((a, i) => `<button type="button" class="secondary coach-record" data-coach-assignment="${i}"><span><strong>${html(a.title)}</strong><small>${html(assignmentNeedsCoachReview(a) ? 'Check-in to review' : statusLabel(a.status))}${a.dueDate ? ' · ' + html(a.dueDate) : ''}</small></span><span aria-hidden="true">›</span></button>`).join('') || '<p>No saved assignments for this student yet.</p>'}</div>`
    else if (snapshot) content = `<p class="coach-count">${snapshot.students.length}${snapshot.moreStudents ? '+' : ''} student${snapshot.students.length === 1 && !snapshot.moreStudents ? '' : 's'} loaded · ${snapshot.students.filter(s => s.linked).length} connected</p><button type="button" data-coach-add>Add a student</button><div class="coach-record-list">${snapshot.students.map((s, i) => `<button type="button" class="secondary coach-record" data-coach-student="${i}"><span class="coach-avatar" aria-hidden="true">${html(s.name.trim().slice(0, 1).toUpperCase())}</span><span><strong>${html(s.name)}</strong><small>${html([s.level, statusLabel(s.status), s.linked ? 'Connected' : 'Roster only'].filter(Boolean).join(' · '))}</small></span><span aria-hidden="true">›</span></button>`).join('') || '<p>No students are saved to your Coach account yet. Add a roster record to start planning.</p>'}</div>${snapshot.moreStudents ? '<p>Showing your 100 most recently updated students. Older records remain in advanced Coach tools.</p>' : ''}`
    dialog.innerHTML = `<header class="coach-workspace-header"><small>Coach workspace</small><h2 tabindex="-1">${html(heading)}</h2><button type="button" class="secondary" data-coach-close ${busy ? 'disabled' : ''} aria-label="Close Coach workspace">Close</button></header>${content}<p role="status" tabindex="-1">${html(notice)}</p>${!leaving && !isEditing() ? `<div class="coach-footer"><button type="button" class="secondary" data-coach-refresh ${busy ? 'disabled' : ''}>Refresh records</button>${view !== 'students' || selected ? `<button type="button" class="secondary" data-coach-back ${busy ? 'disabled' : ''}>${view === 'assignment' ? 'Back to student' : 'All students'}</button>` : ''}</div>` : !leaving ? `<button type="button" class="secondary" data-coach-back ${busy ? 'disabled' : ''}>Back</button>` : ''}`
    dialog.querySelector('[data-coach-close]')?.addEventListener('click', () => requestLeave())
    dialog.querySelector('[data-coach-back]')?.addEventListener('click', back)
    dialog.querySelector('[data-coach-refresh]')?.addEventListener('click', () => {void load(selected)})
    dialog.querySelector('[data-coach-add]')?.addEventListener('click', () => begin('add'))
    dialog.querySelector('[data-coach-assign]')?.addEventListener('click', () => begin('assign'))
    dialog.querySelector('[data-coach-review]')?.addEventListener('click', () => {if (a) begin('review', a)})
    dialog.querySelector('[data-coach-edit-student]')?.addEventListener('click',()=>begin('edit-student'))
    dialog.querySelector('[data-coach-edit-assignment]')?.addEventListener('click',()=>{if(a)begin('edit-assignment',a)})
    if (view === 'student' && s) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = 'Student invitations'; button.dataset.coachInvites = ''
      dialog.querySelector('[data-coach-assign]')?.after(button)
      button.onclick = () => {if (!busy && !invitations?.isOpen()) invitations = openCoachInvitations(client, owner, s.id, active, button, send)}
    }
    dialog.querySelectorAll<HTMLButtonElement>('[data-coach-student]').forEach(b => {b.onclick = () => {const s = snapshot?.students[Number(b.dataset.coachStudent)]; if (s) void load(s.id)}})
    dialog.querySelectorAll<HTMLButtonElement>('[data-coach-assignment]').forEach(b => {b.onclick = () => {const a = detail && sortCoachAssignmentsForReview(detail.assignments)[Number(b.dataset.coachAssignment)]; if (a) {assignmentId = a.id; view = 'assignment'; render(); focus()}}})
    dialog.querySelector<HTMLFormElement>('[data-coach-form]')?.addEventListener('submit', submit)
    dialog.querySelectorAll<HTMLInputElement | HTMLTextAreaElement|HTMLSelectElement>('[name]').forEach(el => {el.oninput = () => {fields[el.name] = el.value}})
    dialog.querySelector('[data-coach-save]')?.addEventListener('click', () => {void write(false)})
    dialog.querySelector('[data-coach-check]')?.addEventListener('click', () => {void write(true)})
    dialog.querySelector('[data-coach-edit]')?.addEventListener('click', () => {if (!attempted) {draft = null; view = formView; render(); focus()}})
    dialog.querySelector('[data-coach-keep]')?.addEventListener('click', () => {leaving = false; leaveAction = null; render(); focus()})
    dialog.querySelector('[data-coach-discard]')?.addEventListener('click', () => {const action = leaveAction; clearDraft(); action?.()})
  }
  dialog.oncancel = e => {e.preventDefault(); back()}
  document.addEventListener('visibilitychange', visibility); document.body.append(dialog); render(); dialog.showModal(); void load()
  return {dispose, back, requestLeave, isOpen: () => !disposed}
}
