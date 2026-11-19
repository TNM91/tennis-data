import {chatTimestamp as observationTime} from '../../lib/chat-timestamp'
import {assessmentContexts, type CoachAssessment, type SkillObservation} from '../../lib/native-coach-assessment-contract'
import {tiqSkillLevels, tiqSkills} from '../../lib/tiq-assessment-skills'
import {html} from './match-details'

type Context = CoachAssessment['observation']['context']
export type AssessmentComparisonSelection = {context: Context; earlier: string; later: string}
const timeOrder = (a: CoachAssessment, b: CoachAssessment) => {
  const left = observationTime(a.createdAt), right = observationTime(b.createdAt)
  return left === right ? a.id.localeCompare(b.id) : left !== null && (right === null || left > right) ? -1 : 1
}
const older = (a: CoachAssessment, b: CoachAssessment) => {
  const left = observationTime(a.createdAt), right = observationTime(b.createdAt)
  return left !== null && right !== null && left < right
}
export function contextAssessments(rows: readonly CoachAssessment[], context: Context) {
  if (new Set(rows.map(row => row.id)).size !== rows.length) return []
  return rows.filter(row => row.observation.context === context && observationTime(row.createdAt) !== null).sort(timeOrder)
}
export function comparableAssessmentContexts(rows: readonly CoachAssessment[]) {
  return (Object.keys(assessmentContexts) as Context[]).filter(context => {
    const records = contextAssessments(rows, context)
    return records.length > 1 && records.some(row => older(row, records[0]))
  }).sort((a, b) => timeOrder(contextAssessments(rows, a)[0], contextAssessments(rows, b)[0]))
}

// The caller supplies one coach's authorized history for one selected student.
export function assessmentComparison(rows: readonly CoachAssessment[], selection: AssessmentComparisonSelection) {
  const records = contextAssessments(rows, selection.context)
  const earlier = records.find(row => row.id === selection.earlier), later = records.find(row => row.id === selection.later)
  if (!earlier || !later || earlier.id === later.id || !older(earlier, later) || earlier.coach !== later.coach) return null
  const skills = tiqSkills.flatMap(({id, skill}) => {
    const before = earlier.observation.skills[id], after = later.observation.skills[id]
    if (before === undefined && after === undefined) return []
    const direction = before === undefined ? 'first' : after === undefined ? 'unobserved'
      : after > before ? 'higher' : after < before ? 'lower' : 'same'
    return [{id, skill, before, after, direction}]
  })
  return {earlier, later, skills, comparable: skills.filter(row => row.before !== undefined && row.after !== undefined).length,
    higher: skills.filter(row => row.direction === 'higher').length, lower: skills.filter(row => row.direction === 'lower').length,
    same: skills.filter(row => row.direction === 'same').length}
}

function normalizedSelection(rows: readonly CoachAssessment[], selected?: AssessmentComparisonSelection | null): AssessmentComparisonSelection | null {
  const contexts = comparableAssessmentContexts(rows)
  const context = selected && contexts.includes(selected.context) ? selected.context : contexts[0]
  if (!context) return null
  const records = contextAssessments(rows, context)
  const later = records.find(row => row.id === selected?.later && records.some(other => older(other, row))) ?? records[0]
  const earlier = records.find(row => row.id === selected?.earlier && older(row, later)) ?? records.find(row => older(row, later))!
  return {context, earlier: earlier.id, later: later.id}
}
const level = (value: SkillObservation | undefined) => value === undefined ? 'Not observed' : tiqSkillLevels[value]
const labels = {higher: 'Higher observed level', lower: 'Lower observed level', same: 'Same observed level', first: 'First observation', unobserved: 'Not observed this time'}
const date = (record: CoachAssessment) => new Date(record.createdAt).toLocaleString(undefined,
  {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit'})
const dateOnly = (record: CoachAssessment) => new Date(record.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})

export function mountAssessmentComparison(host: HTMLElement, rows: readonly CoachAssessment[],
  options: {selection: AssessmentComparisonSelection | null; assigned: ReadonlySet<string>; busy: boolean;
    current: () => boolean; change: (selection: AssessmentComparisonSelection) => void; assign?: (id: string) => void}) {
  let selection = normalizedSelection(rows, options.selection)
  if (!selection) {host.innerHTML = ''; return}
  options.change({...selection})
  host.innerHTML = `<p>Compare skills you observed in the same court context.</p>
    <div class="coach-comparison-controls">
      <label for="coach-compare-context">Court context</label><select id="coach-compare-context" ${options.busy ? 'disabled' : ''}>${comparableAssessmentContexts(rows).map(context => `<option value="${context}" ${selection!.context === context ? 'selected' : ''}>${assessmentContexts[context]}</option>`).join('')}</select>
      <label for="coach-compare-later">Later assessment</label><select id="coach-compare-later" aria-describedby="coach-compare-later-time" ${options.busy ? 'disabled' : ''}></select><small id="coach-compare-later-time"></small>
      <label for="coach-compare-earlier">Earlier assessment</label><select id="coach-compare-earlier" aria-describedby="coach-compare-earlier-time" ${options.busy ? 'disabled' : ''}></select><small id="coach-compare-earlier-time"></small>
    </div><p class="coach-comparison-summary" data-comparison-summary aria-live="polite" aria-atomic="true"></p>
    <ul class="coach-comparison-skills" data-comparison-skills></ul><div class="coach-comparison-practice" data-comparison-practice></div>`
  const context = host.querySelector<HTMLSelectElement>('#coach-compare-context')!
  const later = host.querySelector<HTMLSelectElement>('#coach-compare-later')!
  const earlier = host.querySelector<HTMLSelectElement>('#coach-compare-earlier')!
  const active = () => host.isConnected && options.current() && !options.busy
  function paint() {
    if (!selection) return
    const records = contextAssessments(rows, selection.context)
    const latest = records.find(row => row.id === selection!.later)!
    const dates = new Map(records.map(record => [record.id, dateOnly(record)]))
    const sameDay = (record: CoachAssessment) => records.filter(other => dates.get(other.id) === dates.get(record.id)).length > 1
    const option = (record: CoachAssessment) => `<option value="${html(record.id)}">${html(sameDay(record) ? date(record) : dates.get(record.id)!)}</option>`
    later.innerHTML = records.filter(row => records.some(other => older(other, row))).map(option).join('')
    later.value = selection.later
    earlier.innerHTML = records.filter(row => older(row, latest)).map(option).join('')
    earlier.value = selection.earlier
    const comparison = assessmentComparison(rows, selection)
    if (!comparison) {
      host.querySelector('#coach-compare-later-time')!.textContent = ''
      host.querySelector('#coach-compare-earlier-time')!.textContent = ''
      host.querySelector('[data-comparison-summary]')!.textContent = 'Choose two assessments from the same coach and court context.'
      host.querySelector('[data-comparison-skills]')!.replaceChildren()
      host.querySelector('[data-comparison-practice]')!.replaceChildren()
      return
    }
    host.querySelector('#coach-compare-later-time')!.textContent = sameDay(comparison.later) ? date(comparison.later) : ''
    host.querySelector('#coach-compare-earlier-time')!.textContent = sameDay(comparison.earlier) ? date(comparison.earlier) : ''
    host.querySelector('[data-comparison-summary]')!.textContent = comparison.comparable
      ? `${comparison.higher} higher · ${comparison.same} same · ${comparison.lower} lower across ${comparison.comparable} skill${comparison.comparable === 1 ? '' : 's'} observed in both assessments.`
      : 'No skills were observed in both assessments. First observations are shown separately.'
    host.querySelector('[data-comparison-skills]')!.innerHTML = comparison.skills.map(row => `<li data-observation-change="${row.direction}">
      <h4>${row.skill}</h4><p>${labels[row.direction as keyof typeof labels]}</p>
      <dl><div><dt>Earlier</dt><dd>${level(row.before)}</dd></div><div><dt>Later</dt><dd>${level(row.after)}</dd></div></dl></li>`).join('')
    const focus = tiqSkills.find(skill => skill.id === comparison.later.observation.focus)
    host.querySelector('[data-comparison-practice]')!.innerHTML = focus
      ? `<h4>Later assessment’s practice priority</h4><p>${focus.skill} · ${focus.drill.title}</p><p>${focus.target}</p>${options.assigned.has(comparison.later.id)
        ? '<p>Drill assigned</p>' : options.assign ? `<button type="button" class="secondary" data-comparison-assign="${html(comparison.later.id)}" ${options.busy ? 'disabled' : ''}>Assign this drill</button>` : ''}` : ''
  }
  function update(next: AssessmentComparisonSelection) {
    const normalized = normalizedSelection(rows, next)
    if (!normalized) return
    selection = normalized; options.change({...selection}); paint()
  }
  context.onchange = () => {
    if (active() && comparableAssessmentContexts(rows).includes(context.value as Context)) update({context: context.value as Context, earlier: '', later: ''})
  }
  later.onchange = () => {if (active() && selection) update({...selection, later: later.value})}
  earlier.onchange = () => {if (active() && selection && assessmentComparison(rows, {...selection, earlier: earlier.value})) update({...selection, earlier: earlier.value})}
  host.addEventListener('click', event => {
    if (!active() || !selection || !(event.target instanceof Element)) return
    const id = event.target.closest<HTMLButtonElement>('[data-comparison-assign]')?.dataset.comparisonAssign
    if (id === selection.later && assessmentComparison(rows, selection) && !options.assigned.has(id)) options.assign?.(id)
  })
  paint()
}
