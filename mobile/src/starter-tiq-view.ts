import { formatCalendarDay } from '../../lib/calendar-date'
import { tiqSkillLevels } from '../../lib/tiq-assessment-skills'
import websiteUi from '../generated/website-ui.json'
import { localCalendarDate } from './calendar-data'
import { html } from './match-details'
import type { PersonalMatch } from './personal-match-data'
import {
  legacyStarterResult, readStarterAnswers, starterQuestionGroups, starterResult, starterStorage,
  type StarterAnswers,
} from './starter-tiq'

type Scorecard = Pick<PersonalMatch, 'format' | 'outcome'>
const formatLabels = { singles: 'Singles', doubles: 'Doubles' } as const
const formats = ['singles', 'doubles'] as const

export function mountStarterTiq(
  host: HTMLElement, owner: string, current: () => boolean,
  openDrill: (id: string, trigger: HTMLButtonElement) => void,
  openMatchLog: () => void,
  openAssessments: (trigger: HTMLButtonElement, self?: StarterAnswers) => void,
) {
  const storage = starterStorage(owner)
  const active = () => current() && host.isConnected
  const focus = (selector: string) => host.querySelector<HTMLElement>(selector)?.focus()
  let saved: Awaited<ReturnType<typeof storage.read>> = { history: null, legacy: undefined }
  let step: number | null = null
  let draft: StarterAnswers = {}
  let recent: readonly Scorecard[] = []
  let busy = false

  function paintMatchForm() {
    const context = host.querySelector<HTMLElement>('[data-starter-match-form]')
    if (!context || !active()) return
    const link = context.querySelector<HTMLButtonElement>('button')!
    const summary = context.querySelector<HTMLElement>('[data-starter-match-record]')!
    summary.innerHTML = recent.length ? `
      <p>Last ${recent.length} ${recent.length === 1 ? 'scorecard' : 'scorecards'}</p>
      <dl>${formats.map(format => {
        const matches = recent.filter(match => match.format === format)
        if (!matches.length) return ''
        const wins = matches.filter(match => match.outcome === 'Won').length
        return `<div><dt>${formatLabels[format]}</dt><dd>${wins}W · ${matches.length - wins}L</dd></div>`
      }).join('')}</dl>` : ''
    link.onclick = () => { if (active()) openMatchLog() }
  }

  function editHtml() {
    if (step === null) return ''
    const group = starterQuestionGroups[step]
    const optional = step === starterQuestionGroups.length - 1
    return `<form class="starter-tiq-form" aria-labelledby="starter-tiq-step">
      <header class="starter-tiq-step">
        <p>Step ${step + 1} of ${starterQuestionGroups.length}</p>
        <progress max="${starterQuestionGroups.length}" value="${step + 1}" aria-label="Self-assessment steps"></progress>
        <h3 id="starter-tiq-step" tabindex="-1">${group.title}</h3>
        <p>${optional ? 'Answer both questions for each format you play, or skip a format.' : 'Think about what you can repeat in recent matches. Choose the closest answer.'}</p>
      </header>
      ${group.questions.map(question => `<label>${question.prompt}
        <select name="${question.id}" ${optional ? '' : 'required'}>
          <option value="">${optional ? 'Skip' : 'Choose an answer'}</option>
          ${question.answers.map((answer, index) =>
            `<option value="${index}"${draft[question.id] === index ? ' selected' : ''}>${html(answer)}</option>`).join('')}
        </select></label>`).join('')}
      <p role="status"></p>
      <div class="starter-tiq-actions">
        ${step > 0 ? '<button type="button" class="secondary" data-starter-back>Back</button>' : ''}
        <button type="submit">${optional ? 'Save my rating' : 'Continue'}</button>
        <button type="button" class="secondary" data-starter-cancel>Cancel</button>
      </div>
    </form>`
  }

  function render() {
    const { history, legacy } = saved
    const previousLevel = legacy ? legacyStarterResult(legacy) : null
    const result = history ? starterResult(history.current.answers) : null
    const recommendedDrill = result?.focus.drill ?? previousLevel?.drill
    const previous = history?.previous
    const viewing = step === null
    host.innerHTML = `<section class="lab-starter-tiq" aria-labelledby="starter-tiq-title">
      <div class="starter-tiq-heading">
        <span class="starter-tiq-icon" aria-hidden="true">${websiteUi.icons.progress}</span>
        <div>
          <h2 id="starter-tiq-title">Starter TiQ</h2>
          ${viewing && result ? `<p id="starter-tiq-context">Self-assessed · Private on this device</p>
            <div class="starter-tiq-level" tabindex="-1" aria-describedby="starter-tiq-context">
              <span class="starter-tiq-score">${result.score}<span> / 10</span></span>
              <strong>${result.level}</strong>
            </div>` : viewing && previousLevel ?
            `<p>Saved level · ${previousLevel.level}</p><p>Complete the updated assessment for a 1–10 rating.</p>` :
            viewing ? '<p>Rate six tennis skills and find a drill to try next. Singles and doubles questions are optional.</p>' : ''}
        </div>
      </div>
      ${!viewing ? editHtml() : `
        ${result ? `<p class="starter-tiq-focus">Practice focus · <strong>${result.focus.skill}</strong></p>
          ${'target' in result.focus ? `<p>${html(result.focus.target)}</p>` : ''}` : ''}
        <div class="starter-tiq-actions">
          ${result && recommendedDrill ? `<button type="button" data-starter-drill>Try ${recommendedDrill.title}</button>` : ''}
          <button type="button" ${result && recommendedDrill ? 'class="secondary" ' : ''}data-starter-edit>${result ? 'Retake' : previousLevel ? 'Update my rating' : 'Find my level'}</button>
          ${!result && recommendedDrill ? `<button type="button" class="secondary" data-starter-drill>Try ${recommendedDrill.title}</button>` : ''}
          <button type="button" class="secondary" data-starter-coach>Coach assessments</button>
          ${previousLevel ? '<button type="button" class="secondary" data-starter-clear>Clear saved assessment</button>' : ''}
        </div>
        ${previousLevel ? '<p role="status" data-starter-clear-status></p>' : ''}
        ${result ? `<details class="starter-tiq-breakdown">
          <summary>Skill breakdown</summary>
          <ul>${result.skills.map(({ id, skill, value }) => `<li>
            <span><b>${skill}</b><span>${tiqSkillLevels[value]}</span></span>
            <meter min="0" max="3" value="${value}" aria-label="${skill}: ${tiqSkillLevels[value]}"></meter>
            ${previous && previous.answers[id] !== value ? `<p>Previous · ${tiqSkillLevels[previous.answers[id]]}</p>` : ''}
          </li>`).join('')}</ul>
          ${formats.some(format => result[format] !== null) ? `<dl class="starter-tiq-formats">
            ${formats.map(format => result[format] === null ? '' :
              `<div><dt>${formatLabels[format]}</dt><dd>${result[format]} / 10</dd></div>`).join('')}
          </dl><p>Format ratings include your answers for singles or doubles.</p>` : ''}
          ${previous ? `<p>Previous self-assessment · ${starterResult(previous.answers).score} / 10 · ${html(formatCalendarDay(previous.date))}</p>` : ''}
          <button type="button" class="secondary starter-tiq-clear" data-starter-clear>Clear saved assessments</button>
          <p role="status" data-starter-clear-status></p>
        </details>
        <div class="starter-tiq-match-form" data-starter-match-form>
          <div data-starter-match-record></div>
          <button type="button" class="secondary">View match log</button>
        </div>` : ''}
      `}
    </section>`

    const form = host.querySelector<HTMLFormElement>('.starter-tiq-form')
    if (form && step !== null) {
      const group = starterQuestionGroups[step]
      const status = form.querySelector<HTMLElement>('[role="status"]')!
      const updateDraft = () => {
        const fields = new FormData(form)
        for (const { id } of group.questions) {
          const value = fields.get(id)
          if (value === '0' || value === '1' || value === '2' || value === '3') draft[id] = Number(value) as NonNullable<StarterAnswers[typeof id]>
          else delete draft[id]
        }
      }
      form.onsubmit = async event => {
        event.preventDefault()
        if (!active() || busy || step === null || !form.reportValidity()) return
        updateDraft()
        if (step < starterQuestionGroups.length - 1) {
          step++
          render()
          focus('#starter-tiq-step')
          return
        }
        const answers = readStarterAnswers(draft)
        if (!answers) {
          status.textContent = 'Answer both questions for a format or leave both blank.'
          return
        }
        const next = { current: { date: localCalendarDate(), answers }, previous: history?.current ?? null }
        const controls = form.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('button, select')
        busy = true
        controls.forEach(control => { control.disabled = true })
        status.textContent = 'Saving your rating…'
        try {
          await storage.save(next)
          if (!active()) return
          saved = { history: next, legacy: undefined }
          step = null
          render()
          focus('.starter-tiq-level')
        } catch {
          if (active()) status.textContent = 'Couldn’t save your rating. Try again.'
        } finally {
          busy = false
          controls.forEach(control => { control.disabled = false })
        }
      }
      const back = form.querySelector<HTMLButtonElement>('[data-starter-back]')
      if (back) back.onclick = () => {
        if (!active() || busy || step === null || step === 0) return
        updateDraft()
        step--
        render()
        focus('#starter-tiq-step')
      }
      form.querySelector<HTMLButtonElement>('[data-starter-cancel]')!.onclick = () => {
        if (!active() || busy) return
        step = null
        render()
        focus('[data-starter-edit]')
      }
      return
    }

    host.querySelector<HTMLButtonElement>('[data-starter-edit]')!.onclick = () => {
      if (!active() || busy) return
      draft = { ...(history?.current.answers ?? previousLevel?.prefill) }
      step = 0
      render()
      focus('#starter-tiq-step')
    }
    const drill = host.querySelector<HTMLButtonElement>('[data-starter-drill]')
    if (drill && recommendedDrill) drill.onclick = () => { if (active() && !busy) openDrill(recommendedDrill.id, drill) }
    const coach = host.querySelector<HTMLButtonElement>('[data-starter-coach]')!
    coach.onclick = () => { if (active() && !busy) openAssessments(coach, history?.current.answers) }
    const clear = host.querySelector<HTMLButtonElement>('[data-starter-clear]')
    if (clear) clear.onclick = async () => {
      if (!active() || busy) return
      busy = true
      clear.disabled = true
      const status = host.querySelector<HTMLElement>('[data-starter-clear-status]')!
      status.textContent = 'Clearing saved assessments…'
      try {
        await storage.clear()
        if (!active()) return
        saved = { history: null, legacy: undefined }
        render()
        focus('[data-starter-edit]')
      } catch {
        if (active()) status.textContent = 'Couldn’t clear the saved assessments. Try again.'
      } finally {
        busy = false
        clear.disabled = false
      }
    }
    paintMatchForm()
  }

  void storage.read().catch(() => saved).then(assessment => {
    if (!active()) return
    saved = assessment
    render()
  })
  return {
    showRecentMatches(scorecards: readonly Scorecard[]) {
      recent = scorecards.slice(0, 5)
      paintMatchForm()
    },
  }
}
