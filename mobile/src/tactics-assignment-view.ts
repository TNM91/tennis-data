import type {SupabaseClient} from '@supabase/supabase-js'
import {readCoachCreate, type CoachCreate, type NativeCoachStudent} from '../../lib/native-coach-contract'
import type {TacticalScenarioSummary} from '../../lib/tactical/scenarioStorage'
import {assignCoachPractice, CoachWorkspaceError, loadCoachWorkspace, type CoachSend} from './coach-workspace-data'
import {html} from './match-details'

export function openTacticsAssignment(client: SupabaseClient, owner: string, current: () => boolean,
  trigger: HTMLButtonElement, saved: TacticalScenarioSummary, send?: CoachSend) {
  const dialog = document.createElement('dialog')
  dialog.className = 'native-coach-decision tactics-assignment-dialog'
  dialog.setAttribute('aria-label', 'Assign tactics board')
  dialog.innerHTML = `<h2 tabindex="-1">Assign to player</h2><p>${html(saved.name)}</p>
    <form hidden>
      <label>Player<select name="player" required><option value="">Choose a connected player</option></select></label>
      <label>Practice cue<textarea name="cue" maxlength="2000" required placeholder="What should they try on court?"></textarea></label>
      <label>Due date (optional)<input type="date" name="due"></label>
      <p class="rating-context">Shares a copy of the court and player cues in My Lab.</p>
      <button type="submit">Assign board</button>
    </form>
    <p role="status">Loading connected players…</p><button type="button" class="secondary" data-close>Close</button>`
  const form = dialog.querySelector('form')!
  const player = form.querySelector('select')!
  const submit = form.querySelector('button')!
  const status = dialog.querySelector<HTMLElement>('[role=status]')!
  const close = dialog.querySelector<HTMLButtonElement>('[data-close]')!
  let disposed = false, busy = false
  let students: NativeCoachStudent[] = []
  let pending: Extract<CoachCreate, {kind: 'assignment'}> | null = null
  const active = () => !disposed && current()
  const dispose = () => {
    if (disposed) return
    disposed = true
    dialog.close()
    dialog.remove()
    if (current() && trigger.isConnected) trigger.focus({preventScroll: true})
  }
  close.onclick = () => { if (!busy) dispose() }
  dialog.oncancel = event => { event.preventDefault(); close.click() }
  form.onsubmit = async event => {
    event.preventDefault()
    if (busy || !active()) return
    if (!pending) {
      const values = new FormData(form)
      const student = students.find(item => item.id === values.get('player'))
      if (!student) return
      try {
        const draft = readCoachCreate({kind: 'assignment', id: crypto.randomUUID(), student: student.id,
          expectedUpdatedAt: student.updatedAt, title: saved.name.slice(0, 180), focus: saved.focus.slice(0, 300),
          instructions: values.get('cue'), dueDate: values.get('due') || null, evidence: '', status: 'assigned',
          tactics: {id: saved.id, updatedAt: saved.updatedAt}})
        if (draft.kind !== 'assignment') return
        pending = draft
      } catch {
        status.textContent = 'Check the practice cue and due date.'
        return
      }
    }
    busy = true
    submit.disabled = close.disabled = true
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach(field => {
      field.disabled = true
    })
    status.textContent = 'Assigning board…'
    try {
      await assignCoachPractice(client, owner, active, pending, send)
      if (!active()) return
      form.hidden = true
      status.textContent = 'Assigned in the player’s My Lab.'
    } catch (error) {
      if (!active()) return
      if (error instanceof CoachWorkspaceError && [400, 401, 403, 409].includes(error.status)) {
        form.hidden = true
        status.textContent = 'Refresh the saved board and player connection, then try again.'
      } else {
        submit.disabled = false
        submit.textContent = 'Check assignment'
        status.textContent = 'The assignment wasn’t confirmed. Check the same assignment before sending another.'
      }
    } finally {
      busy = false
      if (active()) close.disabled = false
    }
  }
  document.body.append(dialog)
  dialog.showModal()
  dialog.querySelector('h2')!.focus()
  void loadCoachWorkspace(client, owner, active, '', send).then(snapshot => {
    if (!active()) return
    students = snapshot.students.filter(student => student.linked && student.status !== 'paused')
    for (const student of students) player.add(new Option(student.name, student.id))
    form.hidden = !students.length
    status.textContent = students.length ? '' : 'Connect a player in Coach Studio to assign a board.'
  }).catch(() => { if (active()) status.textContent = 'Connected players couldn’t load. Close and try again.' })
  return {dispose, back: () => close.click(), isOpen: () => !disposed}
}
