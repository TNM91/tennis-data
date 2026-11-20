import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assessmentContexts, assessmentNoteLimit, readCoachAssessmentDraft,
  type CoachAssessment, type CoachAssessmentDraft, type CoachObservation, type SkillObservations,
} from '../../lib/native-coach-assessment-contract'
import { readCoachCreate, type NativeCoachSnapshot, type NativeCoachStudent } from '../../lib/native-coach-contract'
import { tiqSkillLevels, tiqSkills } from '../../lib/tiq-assessment-skills'
import { CoachAssessmentError, loadCoachAssessments, shareCoachAssessment } from './coach-assessments-data'
import { assignCoachPractice, CoachWorkspaceError, type CoachSend } from './coach-workspace-data'
import { html } from './match-details'
import {comparableAssessmentContexts, mountAssessmentComparison, type AssessmentComparisonSelection} from './coach-assessment-comparison'
import {openTiqAccountHistory} from './tiq-account-view'
import {openTiqCoachAlignment} from './tiq-coach-alignment'

function observationHtml(observation: CoachObservation, self?: SkillObservations) {
  const focus = tiqSkills.find(skill => skill.id === observation.focus)
  return `<dl class="tiq-observation-skills">${tiqSkills.map(({ id, skill }) => {
    const score = observation.skills[id]
    const own = self?.[id]
    if (score === undefined) return ''
    return `<div><dt>${skill}</dt><dd>${tiqSkillLevels[score]}${own === undefined ? '' : `<small>Self · ${tiqSkillLevels[own]}</small>`}</dd></div>`
  }).join('')}</dl>
  ${focus ? `<p class="tiq-observation-focus"><strong>Practice next</strong> ${focus.skill} · ${focus.drill.title}</p>` : ''}
  ${observation.note ? `<p class="coach-written">${html(observation.note)}</p>` : ''}`
}

export function openCoachAssessments(client: SupabaseClient, owner: string, current: () => boolean,
  options: { trigger: HTMLElement; student?: NativeCoachStudent; self?: SkillObservations; assignmentIds?: string[];
    onDrillAssigned?: (snapshot: NativeCoachSnapshot) => void }, send?: CoachSend) {
  const { trigger, student, self, assignmentIds, onDrillAssigned } = options
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog coach-workspace-dialog tiq-coach-assessments'
  dialog.setAttribute('aria-label', 'Coach assessments')
  let view: 'list' | 'form' | 'review' = 'list'
  let rows: CoachAssessment[] = []
  let draft: CoachAssessmentDraft | null = null
  let busy = false, disposed = false, attempted = false, conflict = false, leaving = false, edited = false
  let notice = ''
  const assignedDrills = new Set(assignmentIds)
  let latestWorkspace: NativeCoachSnapshot | null = null
  let assigningDrill = false
  let comparisonSelection: AssessmentComparisonSelection | null = null, comparisonOpen = false
  let playerRatings: ReturnType<typeof openTiqAccountHistory> | null = null
  let alignment: ReturnType<typeof openTiqCoachAlignment> | null = null
  const active = () => !disposed && current() && trigger.isConnected

  function dispose() {
    if (disposed) return
    disposed = true
    playerRatings?.dispose(); playerRatings = null
    alignment?.dispose(); alignment = null
    draft = null
    rows = []
    comparisonSelection = null
    comparisonOpen = false
    dialog.close()
    dialog.remove()
    if (current() && trigger.isConnected) trigger.focus({ preventScroll: true })
    if (current() && latestWorkspace) onDrillAssigned?.(latestWorkspace)
  }

  function back() {
    if (alignment?.isOpen()) return alignment.back()
    if (playerRatings?.isOpen()) return playerRatings.back()
    if (busy && (view !== 'list' || assigningDrill)) return true
    if (view === 'list') dispose()
    else if (leaving) {
      leaving = false
      dialog.querySelector<HTMLDialogElement>('[data-assessment-discard]')?.close()
      dialog.querySelector<HTMLElement>('[data-assessment-close]')?.focus()
    } else if (view === 'review' && !attempted) {
      view = 'form'
      render()
    } else if (edited || attempted) {
      leaving = true
      const confirm = dialog.querySelector<HTMLDialogElement>('[data-assessment-discard]')!
      confirm.querySelector('p')!.textContent = attempted ? 'This assessment may already be shared. Check the history after leaving.' : 'Your unsent assessment will be discarded.'
      confirm.showModal()
    } else {
      view = 'list'
      render()
    }
    return true
  }

  async function load(shared = false) {
    if (busy || !active()) return
    busy = true
    rows = []
    notice = shared ? 'Assessment shared. Loading history…' : 'Loading coach assessments…'
    render(false)
    try {
      rows = await loadCoachAssessments(client, owner, active, student?.id ?? null, send)
      notice = shared ? 'Shared in the player’s My Lab.' : ''
    } catch {
      notice = shared ? 'Assessment shared. Refresh to load the history.' : 'Coach assessments couldn’t load. Try refreshing.'
    } finally {
      busy = false
      if (active()) render()
    }
  }

  async function share() {
    if (!draft || busy || conflict || !active()) return
    busy = attempted = true
    notice = 'Sharing assessment…'
    render(false)
    try {
      await shareCoachAssessment(client, owner, active, draft, send)
    } catch (error) {
      if (!active()) return
      busy = false
      conflict = error instanceof CoachAssessmentError && [400, 401, 403, 409].includes(error.status)
      notice = conflict ? (error as CoachAssessmentError).message : 'Share wasn’t confirmed. Retry this same assessment to check it.'
      render()
      return
    }
    if (!active()) return
    busy = attempted = edited = false
    draft = null
    view = 'list'
    void load(true)
  }

  async function assignDrill(id: string) {
    const assessment = rows.find(row => row.id === id)
    const skill = tiqSkills.find(item => item.id === assessment?.observation.focus)
    if (!student?.linked || student.status === 'paused' || !assessment || !skill || busy || !active()) return
    busy = assigningDrill = true
    notice = 'Assigning drill…'
    render(false)
    try {
      const assignment = readCoachCreate({ kind: 'assignment', id: assessment.id, student: student.id,
        expectedUpdatedAt: student.updatedAt, title: skill.drill.title, focus: skill.skill, instructions: skill.target,
        dueDate: null, evidence: '', status: 'assigned', assessmentDrill: skill.id })
      if (assignment.kind !== 'assignment') return
      latestWorkspace = await assignCoachPractice(client, owner, active, assignment, send)
      assignedDrills.add(id)
      notice = 'Drill assigned in the player’s My Lab.'
    } catch (error) {
      notice = error instanceof CoachWorkspaceError && error.status === 409
        ? 'Close assessments and refresh the student record before assigning this drill.'
        : 'The drill assignment couldn’t be confirmed. Try this same drill again.'
    } finally {
      busy = assigningDrill = false
      if (active()) render()
    }
  }

  function formHtml() {
    const previous = draft?.observation
    return `<p>Rate the skills you observed. Open a skill for a court check and rating guide.</p>
      <form data-assessment-form>
        <label for="tiq-assessment-context">What did you observe?</label>
        <select id="tiq-assessment-context" name="context">${Object.entries(assessmentContexts).map(([id, label]) =>
          `<option value="${id}" ${previous?.context === id ? 'selected' : ''}>${label}</option>`).join('')}</select>
        <div class="tiq-observed-skills">${tiqSkills.map(({ id, skill, check, levels }) => {
          const observed = previous?.skills[id]
          return `<details><summary>${skill}<span data-observed-level>${observed === undefined ? 'Not observed' : tiqSkillLevels[observed]}</span></summary>
            <p>${check}</p><label for="tiq-assessment-${id}">${skill} level</label>
            <select id="tiq-assessment-${id}" name="${id}"><option value="">Not observed</option>
              ${levels.map((level, index) => `<option value="${index}" ${observed === index ? 'selected' : ''}>${tiqSkillLevels[index]} · ${level}</option>`).join('')}
            </select></details>`
        }).join('')}</div>
        <label for="tiq-assessment-focus">Practice priority</label>
        <select id="tiq-assessment-focus" name="focus"><option value="">No priority selected</option>
          ${tiqSkills.map(({ id, skill }) => `<option value="${id}" ${previous?.focus === id ? 'selected' : ''}>${skill}</option>`).join('')}
        </select>
        <label for="tiq-assessment-note">Note to player</label>
        <textarea id="tiq-assessment-note" name="note" rows="3" maxlength="${assessmentNoteLimit}" placeholder="What did you see? What should they try next?">${html(previous?.note ?? '')}</textarea>
        <p role="status" data-assessment-status></p><button type="submit">Review assessment</button>
      </form>`
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!student || view !== 'form' || !active()) return
    const form = event.currentTarget as HTMLFormElement
    const values = new FormData(form)
    const skills = Object.fromEntries(tiqSkills.flatMap(({ id }) => {
      const value = values.get(id)
      return typeof value === 'string' && value !== '' ? [[id, Number(value)]] : []
    }))
    const status = form.querySelector<HTMLElement>('[data-assessment-status]')!
    if (!Object.keys(skills).length) { status.textContent = 'Choose a level for at least one observed skill.'; return }
    const focus = values.get('focus') || null
    if (typeof focus === 'string' && !Object.hasOwn(skills, focus)) { status.textContent = 'Choose an observed skill for the practice priority.'; return }
    draft = readCoachAssessmentDraft({ id: draft?.id ?? crypto.randomUUID(), student: student.id, linkUpdatedAt: student.updatedAt,
      observation: { context: values.get('context'), skills, focus, note: values.get('note') } })
    edited = true
    view = 'review'
    render()
  }

  function render(focus = true) {
    if (!active()) return
    const comparable = Boolean(student && comparableAssessmentContexts(rows).length)
    const heading = view === 'form' ? 'Assess skills' : view === 'review' ? 'Review assessment' : 'Coach assessments'
    const content = view === 'form' ? formHtml() : view === 'review' && draft ? `
      <p>Shares this ${assessmentContexts[draft.observation.context].toLowerCase()} assessment with ${html(student!.name)} in My Lab.</p>
      ${observationHtml(draft.observation)}
      <button type="button" data-assessment-share ${busy || conflict ? 'disabled' : ''}>${attempted ? 'Retry same assessment' : 'Share assessment'}</button>` : `
      <button type="button" class="secondary" data-alignment ${busy ? 'disabled' : ''}>Player &amp; coach view</button>
      ${student ? `<button type="button" data-assessment-new ${busy ? 'disabled' : ''}>New assessment</button>
        ${student.linked && student.status !== 'paused' ? `<button type="button" class="secondary" data-player-tiq ${busy ? 'disabled' : ''}>Player self-assessments</button>` : ''}` : '<p>See what your connected coaches observed and what to practice next.</p>'}
      ${comparable ? `<details class="coach-assessment-comparison" ${comparisonOpen ? 'open' : ''}><summary>Compare skill observations</summary><div data-assessment-comparison></div></details>`
        : student && rows.length ? '<p class="coach-assessment-scope">Share a later assessment in the same court context to compare observations.</p>' : ''}
      ${rows.length ? `<p class="coach-assessment-scope">${rows.length === 12 ? 'Latest 12 shared assessments' : rows.length + ' shared assessment' + (rows.length === 1 ? '' : 's')}</p>` : ''}
      <div class="tiq-assessment-history">${rows.map(({ id, createdAt, coach, observation }, index) => `
        <details ${index === 0 ? 'open' : ''}><summary>${student ? assessmentContexts[observation.context] : html(coach)}<small>
          ${html(new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}${student ? '' : ' · ' + assessmentContexts[observation.context]}
        </small></summary>${observationHtml(observation, self)}
        ${student?.linked && student.status !== 'paused' && observation.focus
          ? assignedDrills.has(id) ? '<p>Drill assigned</p>' : `<button type="button" data-assign-drill="${html(id)}" ${busy ? 'disabled' : ''}>Assign drill</button>`
          : ''}</details>`).join('') || (!busy && !notice ? '<p>No shared assessments yet.</p>' : '')}</div>
      <button type="button" class="secondary" data-assessment-refresh ${busy ? 'disabled' : ''}>Refresh assessments</button>`
    dialog.innerHTML = `<header class="coach-workspace-header"><small>${student ? html(student.name) : 'Your TiQ'}</small><h2 tabindex="-1">${heading}</h2>
      <button type="button" data-assessment-close class="secondary" ${busy && (view !== 'list' || assigningDrill) ? 'disabled' : ''}>${view === 'list' ? 'Close' : 'Back'}</button></header>
      ${content}<p role="status">${html(notice)}</p>
      <dialog class="native-coach-decision" data-assessment-discard aria-label="Leave assessment"><h2>Leave assessment?</h2><p></p>
        <button type="button" data-assessment-keep>Keep editing</button><button type="button" class="secondary" data-assessment-leave>Leave assessment</button></dialog>`
    dialog.querySelector<HTMLButtonElement>('[data-assessment-close]')!.onclick = back
    const comparison = dialog.querySelector<HTMLDetailsElement>('.coach-assessment-comparison')
    const comparisonHost = comparison?.querySelector<HTMLElement>('[data-assessment-comparison]')
    if (comparison && comparisonHost && student) {
      comparison.ontoggle = () => {if (comparison.isConnected && active() && view === 'list') comparisonOpen = comparison.open}
      mountAssessmentComparison(comparisonHost, rows, {selection: comparisonSelection, assigned: assignedDrills, busy,
        current: () => active() && view === 'list', change: selection => {comparisonSelection = selection},
        assign: student.linked && student.status !== 'paused' ? id => {comparisonOpen = comparison.open; void assignDrill(id)} : undefined})
    }
    const confirm = dialog.querySelector<HTMLDialogElement>('[data-assessment-discard]')!
    confirm.oncancel = event => { event.preventDefault(); back() }
    dialog.querySelector<HTMLButtonElement>('[data-assessment-keep]')!.onclick = back
    dialog.querySelector<HTMLButtonElement>('[data-assessment-leave]')!.onclick = () => {
      leaving = edited = attempted = conflict = false
      draft = null
      view = 'list'
      void load()
    }
    const form = dialog.querySelector<HTMLFormElement>('[data-assessment-form]')
    if (form) {
      form.onsubmit = submit
      form.oninput = event => {
        edited = true
        const input = event.target
        if (!(input instanceof HTMLSelectElement)) return
        const level = input.closest('details')?.querySelector('[data-observed-level]')
        if (level) level.textContent = input.value === '' ? 'Not observed' : tiqSkillLevels[Number(input.value)]
      }
    }
    dialog.querySelector('[data-assessment-new]')?.addEventListener('click', () => {
      if (busy) return
      notice = ''
      view = 'form'
      render()
    })
    dialog.querySelector('[data-assessment-share]')?.addEventListener('click', () => { void share() })
    dialog.querySelector('[data-assessment-refresh]')?.addEventListener('click', () => { void load() })
    dialog.querySelector<HTMLButtonElement>('[data-player-tiq]')?.addEventListener('click', event => {
      if (!busy && active() && student) playerRatings = openTiqAccountHistory(client, owner, active, event.currentTarget as HTMLElement, {student}, send)
    })
    dialog.querySelector<HTMLButtonElement>('[data-alignment]')?.addEventListener('click', event => {
      if (!busy && active()) alignment = openTiqCoachAlignment(client, owner, active, event.currentTarget as HTMLElement,
        {student, assigned: updated => {latestWorkspace = updated}}, send)
    })
    dialog.querySelectorAll<HTMLButtonElement>('[data-assign-drill]').forEach(button => {
      button.onclick = () => { void assignDrill(button.dataset.assignDrill ?? '') }
    })
    if (focus) {
      dialog.scrollTo(0, 0)
      dialog.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    }
  }

  dialog.oncancel = event => { event.preventDefault(); back() }
  document.body.append(dialog)
  dialog.showModal()
  void load()
  return { dispose, back, isOpen: () => !disposed, requestLeave(action?: () => void) {
    if(alignment?.isOpen()||playerRatings?.isOpen()){back();return}
    if (view === 'list') { dispose(); action?.() } else back()
  } }
}
