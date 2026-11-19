import type {SupabaseClient} from '@supabase/supabase-js'
import {formatCalendarDay} from '../../lib/calendar-date'
import {getPlayerAssignmentCheckIn} from '../../lib/coach-storage'
import {assessmentContexts, type CoachAssessment} from '../../lib/native-coach-assessment-contract'
import {tiqSkillLevels, tiqSkills} from '../../lib/tiq-assessment-skills'
import {loadCoachAssessments} from './coach-assessments-data'
import {loadTrainingHistory, type TrainingSession} from './level-up-data'
import {openLevelUp} from './level-up-view'
import {html} from './match-details'
import {assessmentPractice, playerObservations, playerPracticePriority, savedPracticeWeek, selfSkill, skillLevelChange,
  type ProgressContext, type SelfAssessmentHistory} from './player-progress-model'
import {starterResult, starterStorage} from './starter-tiq'
import {loadTrainingCoachWork, type TrainingCoachWork} from './training-inbox-data'
import './player-progress.css'

type Source<T> = {value: T | null; busy: boolean; failed: boolean; version: number}
const source = <T>(): Source<T> => ({value: null, busy: false, failed: false, version: 0})
const dated = (row: CoachAssessment) => `<span>${html(row.coach)}</span><time datetime="${html(row.createdAt)}">${html(new Date(row.createdAt).toLocaleString(undefined, {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit'}))}</time>`
const level = (value: number | undefined) => value === undefined ? 'Not observed' : tiqSkillLevels[value]
export function openPlayerProgress(client: SupabaseClient, owner: string, current: () => boolean, trigger: HTMLElement, retake: () => void) {
  const dialog = document.createElement('dialog'); dialog.className = 'captain-lineup-dialog player-progress-dialog'
  dialog.setAttribute('aria-label', 'Your progress')
  dialog.innerHTML = '<header class="player-progress-header"><div><small>My Lab</small><h2 tabindex="-1">Your progress</h2></div><button type="button" class="secondary" data-progress-close aria-label="Close your progress">Close</button></header><div class="player-progress-body"></div>'
  const body = dialog.querySelector<HTMLElement>('.player-progress-body')!
  const self = source<SelfAssessmentHistory>(), observations = source<CoachAssessment[]>(), practice = source<TrainingSession[]>(), work = source<TrainingCoachWork>()
  let disposed = false, context: ProgressContext | undefined, changesOpen = false, restoreFocus = ''
  let child: ReturnType<typeof openLevelUp> | null = null, returnKey = ''
  const active = () => !disposed && current() && trigger.isConnected && dialog.isConnected
  const actionable = () => active() && !child?.isOpen()
  function dispose() {
    if (disposed) return
    disposed = true; child?.dispose(); child = null
    self.value = null; observations.value = null; practice.value = null; work.value = null
    dialog.remove()
    if (current() && trigger.isConnected) trigger.focus({preventScroll: true})
  }
  const back = () => {if (child?.isOpen()) child.back(); else dispose(); return true}
  dialog.querySelector<HTMLButtonElement>('[data-progress-close]')!.onclick = back
  dialog.oncancel = event => {event.preventDefault(); back()}
  function finishPractice(coach = false) {
    child = null
    if (!active()) return
    render(returnKey)
    void readPractice()
    if (coach) {void readWork(); void readObservations()}
  }
  function startPractice(button: HTMLButtonElement, mode: 'priority' | 'history' | 'coach') {
    if (!actionable()) return
    if (mode === 'priority' && (self.busy || observations.busy || work.busy)) return
    const selected = playerObservations(observations.value ?? [], context)
    const priority = playerPracticePriority(self.value, selected.latest)
    returnKey = button.dataset.progressKey ?? ''; button.focus({preventScroll: true})
    if (mode === 'history') {
      child = openLevelUp(client, owner, active, 'progress', {cardId: '', identitySlug: '', onClose: () => finishPractice()})
    } else {
      const assignment = priority ? assessmentPractice(work.value, priority.assessment, priority.drill.id) : undefined
      if (mode === 'coach' || assignment) child = openLevelUp(client, owner, active,
        {view: 'coach', ...(mode === 'priority' && assignment ? {assignmentId: assignment.id} : {}), onClose: () => finishPractice(true)})
      else if (priority) child = openLevelUp(client, owner, active, 'catalog',
        {cardId: priority.drill.id, identitySlug: '', onClose: () => finishPractice()})
    }
  }
  function render(focusKey = '') {
    if (!active()) return
    const focused = body.contains(document.activeElement) ? (document.activeElement as HTMLElement)?.dataset.progressKey : ''
    if (dialog.contains(document.activeElement) && !body.contains(document.activeElement)) restoreFocus = ''
    const scroll = dialog.scrollTop
    const saved = self.value?.history, result = saved ? starterResult(saved.current.answers) : null
    const selected = playerObservations(observations.value ?? [], context)
    if (!observations.busy && !observations.failed) context = selected.context
    const latest = selected.latest, priority = playerPracticePriority(self.value, latest)
    const assignment = priority ? assessmentPractice(work.value, priority.assessment, priority.drill.id) : undefined
    const summary = practice.value ? savedPracticeWeek(practice.value) : null
    body.innerHTML = `<section class="player-progress-self" aria-label="Self-assessment">
      <small class="player-progress-eyebrow">Self-assessed TiQ</small>
      ${result && saved ? `<div class="player-progress-rating"><strong>${result.score}<span> / 10</span></strong><span>${html(result.level)}</span></div>
        <p>Saved ${html(formatCalendarDay(saved.current.date))} · Private on this device</p>
        ${saved.previous ? `<p class="player-progress-previous">Previously ${starterResult(saved.previous.answers).score} / 10 · ${html(formatCalendarDay(saved.previous.date))}</p>` : '<p>Retake after more match play to compare your answers.</p>'}`
        : `<h3>${self.failed ? 'Self-assessment couldn’t load' : self.busy ? 'Loading self-assessment…' : self.value?.legacy ? 'Update your saved level' : 'Find your starting point'}</h3>
          <p>${self.failed ? 'Your saved rating hasn’t been changed.' : 'Answer tennis-specific questions to save your private 1–10 self-rating.'}</p>`}
      <button type="button" class="secondary" data-progress-self data-progress-key="self" ${self.busy ? 'disabled' : ''}>${self.failed ? 'Retry self-assessment' : result ? 'Retake self-assessment' : 'Start self-assessment'}</button>
    </section>
    <section class="player-progress-observations" aria-label="Coach observations">
      <div class="player-progress-section-heading"><h3>Coach observations</h3><span>${observations.value?.length === 12 ? 'Latest 12 shared' : observations.value?.length ? observations.value.length + ' shared' : ''}</span></div>
      ${observations.busy ? '<p role="status">Loading coach observations…</p>' : observations.failed ? '<p role="status">Coach observations couldn’t load. Retry to check current access.</p><button type="button" class="secondary" data-progress-observations data-progress-key="observations">Retry coach observations</button>' : latest ? `
        <label for="player-progress-context">Court context</label><select id="player-progress-context" data-progress-key="context">${selected.contexts.map(value => `<option value="${value}" ${value === context ? 'selected' : ''}>${assessmentContexts[value]}</option>`).join('')}</select>
        <div class="player-progress-source"><small>Latest observation</small>${dated(latest)}</div>
        <ul class="player-progress-skills" aria-label="Your answers and coach observations">${tiqSkills.map(({id, skill}) => {
          const own = selfSkill(self.value, id), observed = latest.observation.skills[id]
          return `<li><h4>${skill}</h4><dl><div><dt>Your answer</dt><dd>${own === undefined ? 'Not assessed' : level(own)}</dd></div><div><dt>Coach observed</dt><dd>${level(observed)}</dd></div></dl></li>`
        }).join('')}</ul>
        ${latest.observation.note ? `<p class="player-progress-coach-note">${html(latest.observation.note)}</p>` : ''}
        ${selected.earlier ? `<details class="player-progress-changes" ${changesOpen ? 'open' : ''}><summary>Changes in this court context</summary>
          <div class="player-progress-source"><small>Earlier observation</small>${dated(selected.earlier)}</div>
          <p>Compare the two observations with your coach. Different coaches and playing conditions can affect observed levels.</p>
          <ul>${selected.changes.map(change => `<li data-progress-change="${change.direction}"><h4>${change.skill}</h4><p>${skillLevelChange(change.before, change.after)}</p><dl><div><dt>Earlier</dt><dd>${level(change.before)}</dd></div><div><dt>Latest</dt><dd>${level(change.after)}</dd></div></dl></li>`).join('')}</ul>
          </details>`
          : '<p>Another shared observation in this court context will make a comparison available.</p>'}` : '<p>No shared coach observations yet. Your connected coach can assess observed skills and share a practice priority.</p>'}
    </section>
    <section class="player-progress-priority" aria-label="Practice next">
      <small class="player-progress-eyebrow">Practice next</small>
      ${priority ? `<h3>${html(priority.drill.title)}</h3><p>${html(priority.target)}</p><p class="player-progress-attribution">${priority.source === 'coach' ? `${html(priority.assessment.coach)} · ${assessmentContexts[priority.assessment.observation.context]} · ${html(new Date(priority.assessment.createdAt).toLocaleDateString())}` : 'From your latest self-assessment'}</p>
        ${assignment ? `<p>${assignment.status === 'completed' || getPlayerAssignmentCheckIn(assignment.assignment) ? 'Coach practice has a saved check-in.' : 'Assigned by your coach. Open it to practice and send your check-in.'}</p>` : ''}
        <button type="button" data-progress-practice data-progress-key="practice" ${self.busy || observations.busy || work.busy ? 'disabled' : ''}>${self.busy || observations.busy || work.busy ? 'Checking practice priority…' : assignment ? 'Open coach practice' : 'Preview practice drill'}</button>`
        : '<h3>Choose your first focus</h3><p>Complete your self-assessment or ask your coach for an observation to get a practice priority.</p>'}
      <button type="button" class="secondary" data-progress-coach data-progress-key="coach" ${work.busy ? 'disabled' : ''}>Open coach assignments</button>
      ${work.failed ? '<p role="status">Assigned practice couldn’t be checked. Open coach assignments to retry before sending a check-in.</p>' : ''}
    </section>
    <section class="player-progress-practice" aria-label="Saved practice">
      <h3>Saved practice</h3><p class="player-progress-window">Last 7 days · Sessions saved to your account</p>
      ${practice.busy ? '<p role="status">Loading saved practice…</p>' : practice.failed ? '<p role="status">Saved practice couldn’t load. Your sessions haven’t been changed.</p><button type="button" class="secondary" data-progress-history-retry data-progress-key="history-retry">Retry saved practice</button>' : summary ? `
        <dl class="player-progress-totals"><div><dt>Sessions</dt><dd>${summary.count}</dd></div><div><dt>Practice days</dt><dd>${summary.activeDays} / 7</dd></div><div><dt>Timed min</dt><dd>${summary.minutes}</dd></div></dl>
        <ol class="player-progress-days" aria-label="Saved practice by day">${summary.days.map(day => `<li data-practiced="${day.count > 0}" aria-label="${html(formatCalendarDay(day.date))}: ${day.count} saved ${day.count === 1 ? 'session' : 'sessions'}"><span aria-hidden="true">${html(new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, {weekday: 'narrow'}))}</span><b aria-hidden="true">${day.count || '–'}</b></li>`).join('')}</ol>
        ${summary.latest ? `<p>Latest saved · ${html(summary.latest.drillTitle)} · ${html(new Date(summary.latest.completedAt).toLocaleDateString())}</p>` : '<p>No saved sessions yet. Start with the practice priority above.</p>'}
        <p class="player-progress-coverage">${practice.value?.length === 80 ? 'Based on your latest 80 saved sessions. Older sessions may fall in this week.' : `${practice.value?.length ?? 0} saved sessions loaded.`} Coach check-ins and unsaved practice are separate.</p>` : ''}
      <button type="button" class="secondary" data-progress-history data-progress-key="history">Open practice history</button>
    </section><p class="player-progress-rating-note">Practice records show consistency. They don’t automatically raise TiQ. Self-ratings change when you retake; coach observations remain separate.</p>
    <button type="button" class="secondary" data-progress-refresh data-progress-key="refresh" ${[self, observations, practice, work].some(item => item.busy) ? 'disabled' : ''}>Refresh progress</button>`
    const next = body.querySelector<HTMLElement>('.player-progress-priority')!, savedPractice = body.querySelector<HTMLElement>('.player-progress-practice')!
    body.querySelector('.player-progress-self')!.after(next, savedPractice)
    body.querySelector<HTMLSelectElement>('select')?.addEventListener('change', event => {if (!actionable()) return; context = (event.target as HTMLSelectElement).value as ProgressContext; changesOpen = false; render('context')})
    const changes = body.querySelector<HTMLDetailsElement>('.player-progress-changes')
    if (changes) changes.ontoggle = () => {if (changes.isConnected) changesOpen = changes.open}
    body.querySelector<HTMLButtonElement>('[data-progress-self]')!.onclick = () => {if (!actionable()) return; if (self.failed) void readSelf(); else {dispose(); retake()}}
    body.querySelector('[data-progress-observations]')?.addEventListener('click', event => {if (actionable()) {(event.currentTarget as HTMLElement).focus({preventScroll: true}); void readObservations()}})
    body.querySelector('[data-progress-history-retry]')?.addEventListener('click', event => {if (actionable()) {(event.currentTarget as HTMLElement).focus({preventScroll: true}); void readPractice()}})
    body.querySelector<HTMLButtonElement>('[data-progress-practice]')?.addEventListener('click', event => startPractice(event.currentTarget as HTMLButtonElement, 'priority'))
    body.querySelector<HTMLButtonElement>('[data-progress-coach]')!.onclick = event => startPractice(event.currentTarget as HTMLButtonElement, 'coach')
    body.querySelector<HTMLButtonElement>('[data-progress-history]')!.onclick = event => startPractice(event.currentTarget as HTMLButtonElement, 'history')
    body.querySelector<HTMLButtonElement>('[data-progress-refresh]')!.onclick = event => {if (actionable()) {(event.currentTarget as HTMLElement).focus({preventScroll: true}); refresh()}}
    dialog.scrollTop = scroll
    let key = focusKey || focused || restoreFocus
    if (key === 'observations' && !observations.busy && !observations.failed) key = selected.latest ? 'context' : 'coach'
    if (key === 'history-retry' && !practice.busy && !practice.failed) key = 'history'
    if (key && !child?.isOpen()) {
      const destination = body.querySelector<HTMLButtonElement | HTMLSelectElement>(`[data-progress-key="${key}"]`)
      if (destination && !destination.disabled) {destination.focus({preventScroll: true}); restoreFocus = ''}
      else restoreFocus = key
    }
  }
  async function read<T>(state: Source<T>, load: (isCurrent: () => boolean) => Promise<T>) {
    if (!active() || state.busy) return
    const visit = ++state.version, valid = () => active() && visit === state.version
    state.busy = true; state.failed = false; state.value = null; render()
    try {const value = await load(valid); if (valid()) state.value = value}
    catch {if (valid()) state.failed = true}
    finally {if (valid()) {state.busy = false; render()}}
  }
  const readSelf = () => read(self, async valid => {const saved = await starterStorage(owner).read(); if (!valid()) throw Error('Visit closed'); return saved})
  const readObservations = () => read(observations, async valid => {
    const rows = await loadCoachAssessments(client, owner, valid, null)
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error('Duplicate observations')
    return rows
  })
  const readPractice = () => read(practice, valid => loadTrainingHistory(client, owner, valid))
  const readWork = () => read(work, valid => loadTrainingCoachWork(client, owner, valid))
  const refresh = () => {void readSelf(); void readObservations(); void readPractice(); void readWork()}
  document.body.append(dialog); dialog.showModal(); refresh(); dialog.querySelector<HTMLElement>('h2')!.focus({preventScroll: true})
  return {dispose, back, isOpen: () => !disposed, requestLeave(action?: () => void) {if (child?.isOpen()) child.back(); else {dispose(); action?.()}}}
}
