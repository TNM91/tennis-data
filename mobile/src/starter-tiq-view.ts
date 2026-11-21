import { formatCalendarDay } from '../../lib/calendar-date'
import type {SupabaseClient} from '@supabase/supabase-js'
import {readTiqAnswers, type TiqHistory, type TiqWrite} from '../../lib/tiq-self-assessment'
import { tiqSkillLevels } from '../../lib/tiq-assessment-skills'
import websiteUi from '../generated/website-ui.json'
import { localCalendarDate } from './calendar-data'
import { html } from './match-details'
import type { PersonalMatch } from './personal-match-data'
import {loadTiqAccount, writeTiqAccount, readPendingTiq, rememberPendingTiq, clearPendingTiq, TiqAccountError} from './tiq-account-data'
import type {DeviceAssessment} from './tiq-account-view'
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
  openProgress?: (trigger: HTMLButtonElement) => void,
  account?: {client: SupabaseClient; openPlan?: (trigger: HTMLElement) => void; openHistory: (trigger: HTMLElement, device: DeviceAssessment[], changed: (page: TiqHistory) => void, closed: () => void) => void},
) {
  const storage = starterStorage(owner)
  const active = () => current() && host.isConnected
  const focus = (selector: string) => host.querySelector<HTMLElement>(selector)?.focus()
  let saved: Awaited<ReturnType<typeof storage.read>> = { history: null, legacy: undefined }
  let step: number | null = null
  let draft: StarterAnswers = {}
  let initialDraft: StarterAnswers = {}
  let leaving = false
  let recent: readonly Scorecard[] = []
  let busy = false
  let deviceSaved: Awaited<ReturnType<typeof storage.read>> = saved
  let accountHistory: TiqHistory | null = null, accountSource = false, accountLoading = false, pendingChecked = false
  let accountNotice = '', editToAccount = false
  let pendingSave: Extract<TiqWrite, {kind: 'save'}> | null = null

  function applyAccount(page: TiqHistory) {
    accountHistory = page
    accountSource = Boolean(page.head)
    saved = page.head ? {history: {current: {date: page.head.date, answers: page.head.answers},
      previous: page.items[1] ? {date: page.items[1].date, answers: page.items[1].answers} : null}, legacy: undefined} : deviceSaved
  }
  async function refreshAccount() {
    if (!account || accountLoading || !active()) return
    accountLoading = true
    try {
      const [page, pending] = await Promise.all([loadTiqAccount(account.client, owner, active), readPendingTiq(owner)])
      if (!active()) return
      accountHistory = page; pendingSave = pending; pendingChecked = true; accountNotice = ''
      if (step === null && !document.querySelector('dialog[open]')) {applyAccount(page); render()}
    } catch {
      if (active()) {accountNotice = 'Account sync is unavailable. Device assessments are still available.'; if (step === null && !document.querySelector('dialog[open]')) render()}
    } finally {accountLoading = false}
  }

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

  function cancelAssessment() {
    step = null
    leaving = false
    draft = {}
    initialDraft = {}
    render()
    focus('[data-starter-edit]')
  }

  function editHtml() {
    if (step === null) return ''
    if (leaving) return `<form class="starter-tiq-form" aria-labelledby="starter-tiq-cancel-title" aria-describedby="starter-tiq-cancel-detail">
      <header class="starter-tiq-step"><h3 id="starter-tiq-cancel-title" tabindex="-1">Discard unsaved answers?</h3>
        <p id="starter-tiq-cancel-detail">Keep answering to finish your assessment.</p></header>
      <div class="starter-tiq-actions"><button type="button" data-starter-keep>Keep answering</button>
        <button type="button" class="secondary" data-starter-discard>Discard answers</button></div>
    </form>`
    const group = starterQuestionGroups[step]
    const optional = step === starterQuestionGroups.length - 1
    return `<form class="starter-tiq-form" aria-labelledby="starter-tiq-step">
      <header class="starter-tiq-step">
        <p>Step ${step + 1} of ${starterQuestionGroups.length}</p>
        <progress max="${starterQuestionGroups.length}" value="${step + 1}" aria-label="Self-assessment steps"></progress>
        <h3 id="starter-tiq-step" tabindex="-1">${group.title}</h3>
        <p>${optional ? 'Answer both questions for each format you play, or skip a format.' : 'Think about what you can repeat in recent matches. Choose the closest answer.'}</p>
        ${optional && account ? `<p>${editToAccount ? 'Save privately to your account across devices. Sharing with a coach is a separate choice.' : 'This assessment will be saved on this device. You can add it to your account from Rating history.'}</p>` : ''}
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
        <button type="submit">${optional ? editToAccount ? 'Save to my account' : 'Save my rating' : 'Continue'}</button>
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
    host.innerHTML = `<section class="lab-starter-tiq" aria-labelledby="starter-tiq-title" ${account ? `data-tiq-account="${accountHistory ? 'ready' : 'unavailable'}"` : ''}>
      <div class="starter-tiq-heading">
        <span class="starter-tiq-icon" aria-hidden="true">${websiteUi.icons.progress}</span>
        <div>
          <h2 id="starter-tiq-title">Your TiQ</h2>
          ${viewing && result && history ? `<p id="starter-tiq-context">Self-assessed · ${accountSource ? 'Saved to your account' : 'Private on this device'}</p>
            <div class="starter-tiq-level" tabindex="-1" aria-describedby="starter-tiq-context starter-tiq-date">
              <span class="starter-tiq-score">${result.score}<span> / 10</span></span>
              <strong>${result.level}</strong>
            </div>
            <p id="starter-tiq-date">Assessed <time datetime="${html(history.current.date)}">${html(formatCalendarDay(history.current.date))}</time></p>` : viewing && previousLevel ?
            `<p>Saved level · ${previousLevel.level}</p><p>Complete the updated assessment for a 1–10 rating.</p>` :
            viewing ? '<p>Rate six tennis skills and find a drill to try next. Singles and doubles questions are optional.</p>' : ''}
        </div>
      </div>
      ${account && viewing ? `<p class="starter-tiq-account-status" role="status">${html(pendingSave ? 'An account save needs confirmation. Open Rating history to check your kept answers.' : accountNotice)}</p>` : ''}
      ${!viewing ? editHtml() : `
        ${result ? `<p class="starter-tiq-focus">Assessment focus · <strong>${result.focus.skill}</strong></p>
          ${'target' in result.focus ? `<p>${html(result.focus.target)}</p>` : ''}` : ''}
        <div class="starter-tiq-actions">
          ${result && recommendedDrill ? `<button type="button" data-starter-drill>Try ${recommendedDrill.title}</button>` : ''}
          <button type="button" ${result && recommendedDrill ? 'class="secondary" ' : ''}data-starter-edit>${result ? 'Retake' : previousLevel ? 'Update my rating' : 'Find my level'}</button>
          ${!result && recommendedDrill ? `<button type="button" class="secondary" data-starter-drill>Try ${recommendedDrill.title}</button>` : ''}
          <button type="button" class="secondary" data-starter-coach>Coach assessments</button>
          ${openProgress ? '<button type="button" class="secondary" data-starter-progress>Your progress</button>' : ''}
          ${account ? '<button type="button" class="secondary" data-starter-account>Rating history & sharing</button>' : ''}
          ${account?.openPlan ? '<button type="button" class="secondary" data-starter-plan>My improvement plan</button>' : ''}
          ${previousLevel ? '<button type="button" class="secondary" data-starter-clear>Clear saved assessment</button>' : ''}
        </div>
        ${previousLevel ? '<p role="status" data-starter-clear-status></p>' : ''}
        ${result ? `<details class="starter-tiq-breakdown">
          <summary>Skill breakdown</summary>
          <p class="starter-tiq-explanation">Your six skill answers count equally toward your 1–10 TiQ.</p>
          <ul>${result.skills.map(({ id, skill, value }) => `<li>
            <span><b>${skill}</b><span>${tiqSkillLevels[value]}</span></span>
            <meter min="0" max="3" value="${value}" aria-label="${skill}: ${tiqSkillLevels[value]}"></meter>
            ${previous && previous.answers[id] !== value ? `<p>Previous · ${tiqSkillLevels[previous.answers[id]]}</p>` : ''}
          </li>`).join('')}</ul>
          ${formats.some(format => result[format] !== null) ? `<dl class="starter-tiq-formats">
            ${formats.map(format => result[format] === null ? '' :
              `<div><dt>${formatLabels[format]}</dt><dd>${result[format]} / 10</dd></div>`).join('')}
          </dl><p>Each format rating combines your six skill answers with your two answers for that format.</p>` : ''}
          <p>Retake the assessment to update this score. Review coach assessments and your match record alongside it.</p>
          ${previous ? `<p>Previous self-assessment · ${starterResult(previous.answers).score} / 10 · ${html(formatCalendarDay(previous.date))}</p>` : ''}
          ${!accountSource ? '<button type="button" class="secondary starter-tiq-clear" data-starter-clear>Clear saved assessments</button><p role="status" data-starter-clear-status></p>' : ''}
        </details>
        <div class="starter-tiq-match-form" data-starter-match-form>
          <div data-starter-match-record></div>
          <button type="button" class="secondary">View match log</button>
        </div>` : ''}
      `}
    </section>`

    const form = host.querySelector<HTMLFormElement>('.starter-tiq-form')
    if (form && step !== null) {
      if (leaving) {
        form.onsubmit = event => event.preventDefault()
        form.querySelector<HTMLButtonElement>('[data-starter-keep]')!.onclick = () => {
          if (!active() || busy) return
          leaving = false
          render()
          focus('#starter-tiq-step')
        }
        form.querySelector<HTMLButtonElement>('[data-starter-discard]')!.onclick = () => {
          if (active() && !busy) cancelAssessment()
        }
        return
      }
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
          if (editToAccount && account) {
            const write: Extract<TiqWrite, {kind: 'save'}> = {kind: 'save', id: crypto.randomUUID(), date: next.current.date,
              answers: readTiqAnswers(answers), expectedHead: accountHistory?.head?.id ?? null, version: 1}
            await rememberPendingTiq(owner, write)
            pendingSave = write
            if (!active()) return
            await writeTiqAccount(account.client, owner, active, write)
            if (!active()) return
            await clearPendingTiq(owner); pendingSave = null; accountSource = true
          } else {
            await storage.save(next)
            deviceSaved = {history: next, legacy: undefined}; accountSource = false
          }
          if (!active()) return
          saved = { history: next, legacy: undefined }
          step = null
          render()
          focus('.starter-tiq-level')
          if (editToAccount) void refreshAccount()
        } catch (error) {
          if (active() && editToAccount && pendingSave) {
            step = null
            accountNotice = error instanceof TiqAccountError ? error.message : 'The account save wasn’t confirmed. Your answers are kept in Rating history.'
            render(); focus('[data-starter-account]')
          } else if (active()) status.textContent = 'Couldn’t save your rating. Try again.'
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
        updateDraft()
        if (starterQuestionGroups.some(group => group.questions.some(question => draft[question.id] !== initialDraft[question.id]))) {
          leaving = true
          render()
          focus('#starter-tiq-cancel-title')
        } else cancelAssessment()
      }
      return
    }

    host.querySelector<HTMLButtonElement>('[data-starter-edit]')!.onclick = () => {
      if (!active() || busy) return
      if (pendingSave) {focus('[data-starter-account]'); return}
      editToAccount = Boolean(accountHistory && pendingChecked)
      draft = { ...(history?.current.answers ?? previousLevel?.prefill) }
      initialDraft = { ...draft }
      leaving = false
      step = 0
      render()
      focus('#starter-tiq-step')
    }
    const drill = host.querySelector<HTMLButtonElement>('[data-starter-drill]')
    if (drill && recommendedDrill) drill.onclick = () => { if (active() && !busy) openDrill(recommendedDrill.id, drill) }
    const coach = host.querySelector<HTMLButtonElement>('[data-starter-coach]')!
    coach.onclick = () => { if (active() && !busy) openAssessments(coach, history?.current.answers) }
    const progress = host.querySelector<HTMLButtonElement>('[data-starter-progress]')
    if (progress) progress.onclick = () => {if (active() && !busy) openProgress?.(progress)}
    const accountButton = host.querySelector<HTMLButtonElement>('[data-starter-account]')
    const planButton = host.querySelector<HTMLButtonElement>('[data-starter-plan]')
    if (planButton) planButton.onclick = () => {if(active() && !busy && !document.querySelector('dialog[open]')) account?.openPlan?.(planButton)}
    if (accountButton && account) accountButton.onclick = () => {
      if (!active() || busy || document.querySelector('dialog[open]')) return
      const device = deviceSaved.history ? [deviceSaved.history.current, ...(deviceSaved.history.previous ? [deviceSaved.history.previous] : [])] : []
      account.openHistory(accountButton, device, page => {if (active()) applyAccount(page)}, () => {
        if (active()) {render(); focus('[data-starter-account]'); void refreshAccount()}
      })
    }
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
        deviceSaved = saved
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
    deviceSaved = assessment
    render()
    if (account) void refreshAccount()
  })
  return {
    showRecentMatches(scorecards: readonly Scorecard[]) {
      recent = scorecards.slice(0, 5)
      paintMatchForm()
    },
  }
}
