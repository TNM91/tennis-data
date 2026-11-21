import {chatTimestamp} from '../../lib/chat-timestamp'
import {tiqSkillLevels, tiqSkills} from '../../lib/tiq-assessment-skills'
import {estimateTiqScore, type TiqAssessment} from '../../lib/tiq-self-assessment'
import {html} from './match-details'
import {tiqAssessmentChoiceLabel} from './tiq-assessment-label'

export type TiqProgressSelection = {earlier: string; later: string}
const older = (a: TiqAssessment, b: TiqAssessment) => a.date < b.date || a.date === b.date
  && chatTimestamp(a.createdAt)! < chatTimestamp(b.createdAt)!

// Only the current owner's, or the selected coach connection's, loaded history belongs here.
export function orderedTiqProgress(rows: readonly TiqAssessment[]) {
  if (new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => chatTimestamp(row.createdAt) === null)) return []
  return [...rows].sort((a, b) => older(a, b) ? 1 : older(b, a) ? -1 : a.id.localeCompare(b.id))
}

export function tiqProgressComparison(rows: readonly TiqAssessment[], selection: TiqProgressSelection) {
  const records = orderedTiqProgress(rows)
  const earlier = records.find(row => row.id === selection.earlier), later = records.find(row => row.id === selection.later)
  if (!earlier || !later || earlier.id === later.id || !older(earlier, later)) return null
  const skills = tiqSkills.map(({id, skill}) => ({id, skill, before: earlier.answers[id], after: later.answers[id],
    direction: later.answers[id] > earlier.answers[id] ? 'higher' : later.answers[id] < earlier.answers[id] ? 'lower' : 'same'}))
  return {earlier, later, skills,
    before: estimateTiqScore(skills.map(skill => skill.before)), after: estimateTiqScore(skills.map(skill => skill.after)),
    higher: skills.filter(skill => skill.direction === 'higher').length,
    lower: skills.filter(skill => skill.direction === 'lower').length,
    same: skills.filter(skill => skill.direction === 'same').length}
}

export function tiqProgressSelection(rows: readonly TiqAssessment[], selected: TiqProgressSelection | null = null): TiqProgressSelection | null {
  const records = orderedTiqProgress(rows)
  if (selected && tiqProgressComparison(records, selected)) return {...selected}
  const later = records[0], earlier = later && records.find(row => older(row, later))
  return earlier ? {earlier: earlier.id, later: later.id} : null
}

const savedDate = (entry: TiqAssessment) => new Date(entry.createdAt).toLocaleString(undefined,
  {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit'})

export function mountTiqProgressComparison(host: HTMLElement, rows: readonly TiqAssessment[], options: {
  selection: TiqProgressSelection | null; moreAvailable: boolean; current: () => boolean; changed: (selection: TiqProgressSelection) => void;
}) {
  const records = orderedTiqProgress(rows)
  let selection = tiqProgressSelection(records, options.selection)
  if (!selection) {host.replaceChildren(); return}
  options.changed({...selection})
  host.innerHTML = `<p class="tiq-progress-scope">Choose from ${records.length} self-assessments.${options.moreAvailable ? ' Load earlier assessments for more dates.' : ''}</p>
    <div class="tiq-progress-controls">
      <div><label for="tiq-progress-later">Later assessment</label><select id="tiq-progress-later" data-tiq-later aria-describedby="tiq-later-saved"></select><small id="tiq-later-saved"></small></div>
      <div><label for="tiq-progress-earlier">Earlier assessment</label><select id="tiq-progress-earlier" data-tiq-earlier aria-describedby="tiq-earlier-saved"></select><small id="tiq-earlier-saved"></small></div>
    </div>
    <div class="tiq-progress-scores" data-tiq-progress-scores></div>
    <p class="tiq-progress-summary" data-tiq-progress-summary role="status" aria-atomic="true"></p>
    <p class="tiq-progress-note">Changes reflect the player’s own answers. TiQ is rounded, so review the skill levels too.</p>
    <ul class="tiq-progress-skills" data-tiq-progress-skills></ul>`
  const laterSelect = host.querySelector<HTMLSelectElement>('[data-tiq-later]')!
  const earlierSelect = host.querySelector<HTMLSelectElement>('[data-tiq-earlier]')!
  const option = (entry: TiqAssessment) => `<option value="${html(entry.id)}">${html(tiqAssessmentChoiceLabel(entry, records))}</option>`
  function paint() {
    if (!selection) return
    const comparison = tiqProgressComparison(records, selection)
    if (!comparison) {host.replaceChildren(); return}
    laterSelect.innerHTML = records.filter(row => records.some(other => older(other, row))).map(option).join('')
    laterSelect.value = selection.later
    earlierSelect.innerHTML = records.filter(row => older(row, comparison.later)).map(option).join('')
    earlierSelect.value = selection.earlier
    host.querySelector('#tiq-later-saved')!.textContent = 'Saved ' + savedDate(comparison.later)
    host.querySelector('#tiq-earlier-saved')!.textContent = 'Saved ' + savedDate(comparison.earlier)
    host.querySelector('[data-tiq-progress-scores]')!.innerHTML = `<div><small>Earlier TiQ</small><strong>${comparison.before}<span> / 10</span></strong></div>
      <div><small>Later TiQ</small><strong>${comparison.after}<span> / 10</span></strong></div>`
    host.querySelector('[data-tiq-progress-summary]')!.textContent = `${comparison.higher} higher · ${comparison.same} same · ${comparison.lower} lower self-rated skills.`
    host.querySelector('[data-tiq-progress-skills]')!.innerHTML = comparison.skills.map(skill => `<li data-tiq-change="${skill.direction}">
      <div class="tiq-progress-skill-heading"><h4>${skill.skill}</h4><span>${skill.direction === 'same' ? 'Same self-rating' : skill.direction === 'higher' ? 'Higher self-rating' : 'Lower self-rating'}</span></div>
      <dl><div><dt>Earlier</dt><dd>${tiqSkillLevels[skill.before]}</dd></div><div><dt>Later</dt><dd>${tiqSkillLevels[skill.after]}</dd></div></dl></li>`).join('')
  }
  const active = () => host.isConnected && options.current()
  laterSelect.onchange = () => {
    if (!selection || !active()) return
    const later = records.find(row => row.id === laterSelect.value)
    if (!later) return
    const earlier = records.find(row => row.id === selection!.earlier && older(row, later)) ?? records.find(row => older(row, later))
    if (!earlier) return
    selection = {later: later.id, earlier: earlier.id}; options.changed({...selection}); paint()
  }
  earlierSelect.onchange = () => {
    if (!selection || !active()) return
    const next = {...selection, earlier: earlierSelect.value}
    if (!tiqProgressComparison(records, next)) return
    selection = next; options.changed({...selection}); paint()
  }
  paint()
}
