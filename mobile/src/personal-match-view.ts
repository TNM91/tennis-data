import type { SupabaseClient } from '@supabase/supabase-js'
import { Clipboard } from '@capacitor/clipboard'
import { localCalendarDate } from './calendar-data'
import { mountPersonalRecentForm } from './lab-recent-form'
import { html } from './match-details'
import { matchDate } from './recent-results'
import { loadCaptainScorecards } from './captain-court-data'
import type { PostedCourtScorecard } from '../../lib/native-court-result-contract'
import { inferTiqBestOfThreeWinner } from '../../lib/tiq-scoring'
import { loadCalendarScorecard, loadPersonalMatches, MatchChanged, personalMatchDraft, removePersonalMatch, savePersonalMatch,
  type CalendarScorecardSeed, type PersonalMatch, type PersonalMatchDraft } from './personal-match-data'

const formatName = (format: PersonalMatch['format']) => format === 'singles' ? 'Singles' : 'Doubles'
type LogScorecard = PersonalMatch | PostedCourtScorecard
type UnsubmittedScorecard = { match_date: string; opponent: string; format: string; outcome: string; score: string }
type CalendarScorecardDraft = { seed: CalendarScorecardSeed; fields: UnsubmittedScorecard }
export type PersonalMatchFormSession = { unsubmitted?: UnsubmittedScorecard; calendarDrafts?: Map<string, CalendarScorecardDraft> }

function resumeCalendarScorecard(session: PersonalMatchFormSession, seed: CalendarScorecardSeed) {
  const cached = session.calendarDrafts?.get(seed.calendarMatchId)
  if (!cached) return
  if (cached.seed.date === seed.date && cached.seed.opponent === seed.opponent && cached.seed.format === seed.format) return cached.fields
  session.calendarDrafts?.delete(seed.calendarMatchId)
}

const scorecardCopyControls = `<button type="button" class="secondary" data-copy-scorecard>Copy scorecard</button>
  <p role="status" data-scorecard-copy-status hidden></p>`

function scorecardCopyText(match: LogScorecard) {
  const lines = [`${formatName(match.format)} vs ${match.opponent}`, `${matchDate(match.match_date)} · ${match.outcome}`, `Score ${match.score}`]
  if ('scoreOrder' in match) lines.push(`Captain posted · Court ${match.court}`, `Score order ${match.scoreOrder}`)
  return lines.join('\n')
}

function savedScorecardRow(match: LogScorecard, index: number) {
  const captain = 'scoreOrder' in match
  return `<li><button type="button" class="secondary lab-saved-scorecard" data-open-scorecard="${index}" data-scorecard-id="${html(match.id)}"
    aria-label="Open scorecard for ${html(match.opponent)}" aria-describedby="lab-scorecard-meta-${index} lab-scorecard-result-${index}">
    <span class="lab-saved-scorecard-copy">
      <strong>${html(match.opponent)}</strong>
      <span id="lab-scorecard-meta-${index}">
        <small class="lab-saved-scorecard-meta"><span>${formatName(match.format)}</span> <span>${html(matchDate(match.match_date))}</span></small>
        ${captain ? `<small class="lab-saved-scorecard-meta"><span>Captain posted</span> <span>Court ${match.court}</span></small>` : ''}
      </span>
    </span>
    <span class="lab-saved-scorecard-result" id="lab-scorecard-result-${index}">
      <span class="${match.outcome === 'Won' ? 'result-won' : 'result-lost'}">${match.outcome}</span>
      <strong>${html(match.score)}</strong>
      ${captain ? `<small>Team order<span class="sr-only"> · ${html(match.scoreOrder)}</span></small>` : ''}
    </span>
    <span class="lab-saved-scorecard-chevron" aria-hidden="true">›</span>
  </button></li>`
}

function recentOpponents(matches: PersonalMatch[]) {
  const opponents = new Map<string, PersonalMatch>()
  for (const match of matches) {
    const key = `${match.format}:${match.opponent.toLowerCase()}`
    if (opponents.has(key)) continue
    opponents.set(key, match)
    if (opponents.size === 3) break
  }
  return [...opponents.values()]
}

export function mountPersonalMatchLog(host: HTMLElement, client: SupabaseClient, owner: string, current: () => boolean,
  formSession: PersonalMatchFormSession, seed?: CalendarScorecardSeed) {
  host.innerHTML = `<div class="lab-form-host" data-personal-form></div>
    <section aria-labelledby="personal-matches-title">
      <div class="lab-recent-heading"><h2 id="personal-matches-title" tabindex="-1">Match log</h2>
        <button type="button" data-log-match>${formSession.unsubmitted ? 'Resume scorecard' : 'Log a match'}</button></div>
      <p>Your scores and recent form sync privately to your account.</p>
      <div data-personal-editor></div>
      <div data-personal-history>
        <div data-scorecard-search hidden>
          <h3>Saved scorecards</h3>
          <label>Search loaded scorecards <input type="search" name="scorecard-opponent" maxlength="100" autocomplete="off" placeholder="Opponent name"></label>
        </div>
        <p role="status" data-scorecard-no-results hidden>No loaded scorecards match this opponent.</p>
        <div data-scorecard-list></div>
        <div data-scorecard-pagination></div>
      </div>
      <p role="status" data-captain-score-status hidden></p>
      <p role="status" data-personal-status></p>
    </section>`
  const formHost = host.querySelector<HTMLElement>('[data-personal-form]')!
  const editor = host.querySelector<HTMLElement>('[data-personal-editor]')!
  const history = host.querySelector<HTMLElement>('[data-personal-history]')!
  const searchBox = history.querySelector<HTMLElement>('[data-scorecard-search]')!
  const search = searchBox.querySelector<HTMLInputElement>('input')!
  const noResults = history.querySelector<HTMLElement>('[data-scorecard-no-results]')!
  const list = history.querySelector<HTMLElement>('[data-scorecard-list]')!
  const pagination = history.querySelector<HTMLElement>('[data-scorecard-pagination]')!
  const status = host.querySelector<HTMLElement>('[data-personal-status]')!
  const captainStatus = host.querySelector<HTMLElement>('[data-captain-score-status]')!
  const add = host.querySelector<HTMLButtonElement>('[data-log-match]')!
  const active = () => host.isConnected && current()
  let matches: PersonalMatch[] = []
  let posted: PostedCourtScorecard[] = []
  let more = false, reading = false, writing = false
  let scorecardOrigin: { id: string; button: HTMLButtonElement } | undefined

  function findHistoryRow(id: string) {
    return [...history.querySelectorAll<HTMLButtonElement>('[data-scorecard-id]')].find(button => button.dataset.scorecardId === id)
  }

  function openScorecard(match: LogScorecard, button: HTMLButtonElement) {
    if (!active() || writing || !match) return
    scorecardOrigin = { id: match.id, button }
    showScorecard(match)
  }

  function paintHistory() {
    const linked = new Set(posted.map(card => card.calendar_match_id))
    const scorecards: LogScorecard[] = [...posted, ...matches.filter(card => !card.calendar_match_id || !linked.has(card.calendar_match_id))]
      .sort((a, b) => b.match_date.localeCompare(a.match_date))
    mountPersonalRecentForm(formHost, scorecards, active, openScorecard)
    searchBox.hidden = !scorecards.length
    search.oninput = () => { if (active()) paintScorecardRows(scorecards) }
    paintScorecardRows(scorecards)
    pagination.innerHTML = more ? '<button type="button" class="secondary" data-older-scorecards>Load older matches</button>' : ''
    const older = pagination.querySelector<HTMLButtonElement>('[data-older-scorecards]')
    if (older) older.onclick = () => { void readHistory(true) }
  }

  function paintScorecardRows(scorecards: LogScorecard[]) {
    const focused = document.activeElement
    const focusedId = focused instanceof HTMLButtonElement && list.contains(focused) ? focused.dataset.scorecardId : undefined
    const term = search.value.trim().toLowerCase()
    const rows = term ? scorecards.filter(card => card.opponent.toLowerCase().includes(term)) : scorecards
    noResults.hidden = !term || !scorecards.length || rows.length > 0
    list.innerHTML = rows.length ? `<ol class="lab-saved-scorecards" role="list">${rows.map(savedScorecardRow).join('')}</ol>` : ''
    list.querySelectorAll<HTMLButtonElement>('[data-open-scorecard]').forEach(button => {
      button.onclick = () => openScorecard(rows[Number(button.dataset.openScorecard)], button)
    })
    if (focusedId) findHistoryRow(focusedId)?.focus({ preventScroll: true })
  }

  function setReading(value: boolean) {
    reading = value
    if (!active()) return
    add.disabled = value
    const rematch = editor.querySelector<HTMLButtonElement>('[data-log-rematch]')
    if (rematch) rematch.disabled = value
  }

  async function readHistory(older = false, receipt = '') {
    if (!active() || reading || writing) return
    setReading(true)
    const olderButton = history.querySelector<HTMLButtonElement>('[data-older-scorecards]')
    if (olderButton) olderButton.disabled = true
    status.textContent = older ? 'Loading older matches…' : 'Loading match history…'
    try {
      const page = await loadPersonalMatches(client, owner, active, older ? matches.at(-1) : undefined)
      if (!active()) return
      const previous = older ? new Set(matches.map(row => row.id)) : null
      matches = older ? [...new Map([...matches, ...page.matches].map(row => [row.id, row])).values()] : page.matches
      more = page.more
      if (!matches.length && !posted.length) search.value = ''
      history.querySelector('[data-refresh-matches]')?.remove()
      paintHistory()
      status.textContent = receipt || (matches.length || posted.length ? '' : 'Your first scorecard will appear here.')
      if (previous) {
        const appended = [...history.querySelectorAll<HTMLButtonElement>('[data-open-scorecard]')]
          .find(button => page.matches.some(row => row.id === button.dataset.scorecardId && !previous.has(row.id)))
        const nextFocus = appended ?? pagination.querySelector<HTMLButtonElement>('[data-older-scorecards]') ?? (searchBox.hidden ? add : search)
        nextFocus.focus()
      }
    } catch {
      if (!active()) return
      status.textContent = `${receipt ? receipt + ' ' : ''}Couldn’t load ${older ? 'older matches' : 'your match history'}.`
      if (olderButton?.isConnected) olderButton.disabled = false
      if (!older && !history.querySelector('[data-refresh-matches]')) {
        history.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-refresh-matches>Retry history</button>')
        history.querySelector<HTMLButtonElement>('[data-refresh-matches]')!.onclick = () => { void readHistory() }
      }
    } finally {
      setReading(false)
    }
  }

  function bindScorecardActions(match: LogScorecard) {
    editor.querySelector<HTMLElement>('h3')!.focus()
    editor.querySelector<HTMLButtonElement>('[data-close-scorecard]')!.onclick = closeEditor
    const copy = editor.querySelector<HTMLButtonElement>('[data-copy-scorecard]')!
    const feedback = editor.querySelector<HTMLElement>('[data-scorecard-copy-status]')!
    const visible = () => active() && copy.isConnected
    let copying = false
    copy.onclick = async () => {
      if (!visible() || copying) return
      copying = true
      feedback.hidden = false
      feedback.textContent = 'Copying scorecard…'
      try {
        await Clipboard.write({ string: scorecardCopyText(match) })
        if (visible()) feedback.textContent = 'Scorecard copied.'
      } catch {
        if (visible()) feedback.textContent = 'Couldn’t copy this scorecard. Try again.'
      } finally {
        copying = false
      }
    }
  }

  function showScorecard(match: LogScorecard, ownEntry?: PersonalMatch | null) {
    if (!active() || writing || !match) return
    history.hidden = formHost.hidden = false
    add.disabled = reading
    if ('scoreOrder' in match) {
      const personal = ownEntry ?? matches.find(card => card.calendar_match_id === match.calendar_match_id)
      editor.innerHTML = `<article class="lab-first-scorecard" aria-label="Captain scorecard">
        <h3 tabindex="-1">${html(match.opponent)}</h3><p>Captain posted · Court ${match.court}</p>
        <p>${html(matchDate(match.match_date))} · ${formatName(match.format)} · ${match.outcome}</p>
        <p><strong>${html(match.score)}</strong><br>${html(match.scoreOrder)} score order</p>
        ${scorecardCopyControls}
        ${personal ? '<button type="button" class="secondary" data-personal-copy>View your private entry</button>' : ''}
        <button type="button" class="secondary" data-close-scorecard>Back to match log</button></article>`
      bindScorecardActions(match)
      const copy = editor.querySelector<HTMLButtonElement>('[data-personal-copy]')
      if (copy && personal) copy.onclick = () => showScorecard(personal)
      return
    }
    editor.innerHTML = `<article class="lab-first-scorecard" aria-label="Saved scorecard">
      <h3 tabindex="-1">${html(match.opponent)}</h3>
      <p>${html(matchDate(match.match_date))} · ${formatName(match.format)} · ${match.outcome}</p>
      ${match.calendar_match_id ? '<p>From your TenAceIQ calendar</p>' : ''}
      <p><strong>${html(match.score)}</strong></p>
      <button type="button" class="secondary" data-log-rematch ${reading ? 'disabled' : ''}>Log a rematch</button>
      ${scorecardCopyControls}
      <button type="button" class="secondary" data-edit-match>Edit scorecard</button>
      <button type="button" class="secondary" data-remove-match>Remove scorecard</button>
      <button type="button" class="secondary" data-close-scorecard>Back to match log</button>
    </article>`
    bindScorecardActions(match)
    editor.querySelector<HTMLButtonElement>('[data-log-rematch]')!.onclick = () => showEditor(null, { previous: match })
    editor.querySelector<HTMLButtonElement>('[data-edit-match]')!.onclick = () => showEditor(match)
    editor.querySelector<HTMLButtonElement>('[data-remove-match]')!.onclick = () => confirmRemoval(match)
  }

  function closeEditor() {
    editor.replaceChildren()
    history.hidden = formHost.hidden = false
    add.disabled = reading
    const origin = scorecardOrigin
    scorecardOrigin = undefined
    const target = origin && (origin.button.isConnected ? origin.button : findHistoryRow(origin.id))
    if (target) target.focus()
    else add.focus({ preventScroll: true })
  }

  function showEditor(match: PersonalMatch | null, seed?: CalendarScorecardSeed | { previous: PersonalMatch } | { resume: UnsubmittedScorecard }) {
    if (!active() || writing || reading) return
    const calendarSeed = seed && 'calendarMatchId' in seed ? seed : undefined
    const previous = seed && 'previous' in seed ? seed.previous : undefined
    const resumed = calendarSeed ? resumeCalendarScorecard(formSession, calendarSeed) : seed && 'resume' in seed ? seed.resume : undefined
    const canResume = !match && !previous
    const prefill = match ?? calendarSeed ?? previous
    const recent = prefill ? [] : recentOpponents(matches)
    const title = match ? 'Edit scorecard' : previous ? 'Log a rematch' : resumed ? 'Resume scorecard' : 'Log a match'
    history.hidden = formHost.hidden = add.disabled = true
    editor.innerHTML = `<form class="lab-first-scorecard" data-match-editor>
      <h3 tabindex="-1">${title}</h3>
      ${calendarSeed ? '<p>Match details from your TenAceIQ calendar.</p>' : ''}
      <fieldset>
        <legend class="sr-only">Match details</legend>
        <label>Match date <input type="date" name="match_date" required max="${localCalendarDate()}"></label>
        ${recent.length ? `<details data-recent-opponents><summary>Recent opponents</summary>${recent.map(saved =>
          `<button type="button" class="secondary" data-reuse-opponent>${html(saved.opponent)} · ${formatName(saved.format)}</button>`).join('')}</details>` : ''}
        <label>Opponent or doubles team <input name="opponent" maxlength="100" required></label>
        <label for="personal-match-format">Format</label>
        <select id="personal-match-format" name="format" required><option value="">Choose format</option><option value="singles">Singles</option><option value="doubles">Doubles</option></select>
        <label>Score <input name="score" maxlength="64" placeholder="6-4 6-3" aria-describedby="personal-score-tip" required></label>
        <p id="personal-score-tip">Enter your side’s score first in each set for a result suggestion.</p>
        <button type="button" class="secondary" data-use-score-result hidden></button>
        <label for="personal-match-outcome">Result</label>
        <select id="personal-match-outcome" name="outcome" required><option value="">Choose result</option><option>Won</option><option>Lost</option></select>
      </fieldset>
      <p role="status" data-match-feedback></p>
      <button type="submit" data-save-scorecard>Save scorecard</button>
      <button type="button" class="secondary" data-cancel-scorecard>Cancel</button>
    </form>`
    const form = editor.querySelector<HTMLFormElement>('form')!
    const fields = form.querySelector<HTMLFieldSetElement>('fieldset')!
    const feedback = form.querySelector<HTMLElement>('[data-match-feedback]')!
    const save = form.querySelector<HTMLButtonElement>('[data-save-scorecard]')!
    const cancel = form.querySelector<HTMLButtonElement>('[data-cancel-scorecard]')!
    for (const [field, value] of Object.entries(resumed ?? { match_date: match?.match_date ?? calendarSeed?.date ?? localCalendarDate(),
      opponent: prefill?.opponent ?? '', format: prefill?.format ?? '',
      outcome: match?.outcome ?? '', score: match?.score ?? '' })) {
      const input = form.elements.namedItem(field) as HTMLInputElement | HTMLSelectElement
      input.value = value
    }
    let draft: PersonalMatchDraft | undefined
    const remember = () => {
      if (!canResume || !active() || writing || draft) return
      const formValues = new FormData(form)
      const value = (name: keyof UnsubmittedScorecard) => String(formValues.get(name) ?? '')
      const draftFields = { match_date: value('match_date'), opponent: value('opponent'), format: value('format'),
        outcome: value('outcome'), score: value('score') }
      if (calendarSeed) {
        formSession.calendarDrafts ??= new Map()
        formSession.calendarDrafts.set(calendarSeed.calendarMatchId, { seed: calendarSeed, fields: draftFields })
      } else formSession.unsubmitted = draftFields
    }
    const clearRemembered = () => {
      if (!canResume) return
      if (calendarSeed) formSession.calendarDrafts?.delete(calendarSeed.calendarMatchId)
      else {
        formSession.unsubmitted = undefined
        add.textContent = 'Log a match'
      }
    }
    if (canResume) {
      form.addEventListener('input', remember)
      form.addEventListener('change', remember)
    }
    const score = form.querySelector<HTMLInputElement>('[name="score"]')!
    const picker = form.querySelector<HTMLDetailsElement>('[data-recent-opponents]')
    if (picker) {
      const opponent = form.querySelector<HTMLInputElement>('[name="opponent"]')!
      const format = form.querySelector<HTMLSelectElement>('[name="format"]')!
      picker.querySelectorAll<HTMLButtonElement>('[data-reuse-opponent]').forEach((button, index) => {
        button.onclick = () => {
          if (!active() || writing) return
          opponent.value = recent[index].opponent
          format.value = recent[index].format
          remember()
          picker.open = false
          score.focus()
        }
      })
    }
    const outcome = form.querySelector<HTMLSelectElement>('[name="outcome"]')!
    const useResult = form.querySelector<HTMLButtonElement>('[data-use-score-result]')!
    let suggested: PersonalMatch['outcome'] | undefined
    const refreshSuggestion = () => {
      const winner = outcome.value ? undefined : inferTiqBestOfThreeWinner(score.value)
      suggested = winner === 'A' ? 'Won' : winner === 'B' ? 'Lost' : undefined
      useResult.hidden = !suggested
      if (suggested) useResult.textContent = suggested === 'Won' ? 'Mark as won' : 'Mark as lost'
    }
    score.addEventListener('input', refreshSuggestion)
    outcome.addEventListener('change', refreshSuggestion)
    refreshSuggestion()
    useResult.onclick = () => {
      if (!suggested) return
      outcome.value = suggested
      remember()
      outcome.focus()
      refreshSuggestion()
    }
    cancel.onclick = () => {
      if (writing) return
      clearRemembered()
      if (draft || calendarSeed) { closeEditor(); void readHistory(); return }
      const returnTo = match ?? previous
      if (returnTo) showScorecard(returnTo)
      else closeEditor()
    }
    form.onsubmit = async event => {
      event.preventDefault()
      if (!active() || writing || reading) return
      try { draft ??= personalMatchDraft(new FormData(form), match, calendarSeed) }
      catch (error) { feedback.textContent = error instanceof Error ? error.message : 'Check your scorecard.'; return }
      clearRemembered()
      writing = fields.disabled = save.disabled = cancel.disabled = true
      feedback.textContent = 'Saving your scorecard…'
      let saved: PersonalMatch | undefined
      try { saved = await savePersonalMatch(client, owner, draft, active) }
      catch (error) {
        if (!active()) return
        feedback.textContent = error instanceof MatchChanged ? error.message : 'Save unconfirmed. Retry the same scorecard, or reload your match log.'
        save.disabled = error instanceof MatchChanged
        save.textContent = 'Retry save'
        cancel.textContent = 'Back to match log'
      } finally {
        writing = false
        if (active()) cancel.disabled = false
      }
      if (!saved || !active()) return
      matches = matches.filter(row => row.id !== saved.id)
      paintHistory()
      showScorecard(saved)
      void readHistory(false, 'Scorecard saved.')
    }
    form.querySelector<HTMLElement>('h3')!.focus()
  }

  function confirmRemoval(match: PersonalMatch) {
    editor.innerHTML = `<div class="lab-first-scorecard"><h3 tabindex="-1">Remove this scorecard?</h3>
      <p>Remove ${html(match.opponent)} from your match log and recent form.</p>
      <button type="button" data-confirm-removal>Remove scorecard</button>
      <button type="button" class="secondary" data-keep-scorecard>Keep scorecard</button>
      <p role="status" data-remove-feedback></p></div>`
    editor.querySelector<HTMLElement>('h3')!.focus()
    const remove = editor.querySelector<HTMLButtonElement>('[data-confirm-removal]')!
    const keep = editor.querySelector<HTMLButtonElement>('[data-keep-scorecard]')!
    keep.onclick = () => showScorecard(match)
    remove.onclick = async () => {
      if (!active() || writing || reading) return
      writing = remove.disabled = keep.disabled = add.disabled = true
      let removed = false
      try { await removePersonalMatch(client, owner, match, active); removed = true }
      catch (error) {
        if (!active()) return
        if (error instanceof MatchChanged) { closeEditor(); writing = false; void readHistory(false, error.message); return }
        editor.querySelector('[data-remove-feedback]')!.textContent = 'Removal unconfirmed. Try again.'
      } finally {
        writing = false
        if (active()) remove.disabled = keep.disabled = add.disabled = false
      }
      if (!active() || !removed) return
      matches = matches.filter(row => row.id !== match.id)
      paintHistory()
      closeEditor()
      void readHistory(false, 'Scorecard removed.')
    }
  }

  async function openCalendarMatch(calendarSeed: CalendarScorecardSeed) {
    if (!active()) return
    add.disabled = true
    editor.replaceChildren()
    status.textContent = 'Opening your calendar scorecard…'
    try {
      const saved = await loadCalendarScorecard(client, owner, calendarSeed, active)
      if (calendarSeed.calendarMatchId.includes(':court:')) await captainLoad
      if (!active()) return
      status.textContent = ''
      const captain = posted.find(card => card.calendar_match_id === calendarSeed.calendarMatchId)
      if (captain || saved) formSession.calendarDrafts?.delete(calendarSeed.calendarMatchId)
      if (captain) { showScorecard(captain, saved); void readHistory() }
      else if (saved) { showScorecard(saved); void readHistory() }
      else showEditor(null, calendarSeed)
    } catch {
      if (!active()) return
      add.disabled = false
      status.textContent = 'Couldn’t check this calendar scorecard. Try again before logging it.'
      editor.innerHTML = '<button type="button" class="secondary" data-retry-calendar-scorecard>Retry calendar scorecard</button>'
      const retry = editor.querySelector<HTMLButtonElement>('[data-retry-calendar-scorecard]')!
      retry.onclick = () => { void openCalendarMatch(calendarSeed) }
      retry.focus()
    }
  }

  const captainLoad = loadCaptainScorecards(client, owner, active).then(cards => {
    if (!active()) return
    posted = cards
    if (!posted.length) return
    if (status.textContent === 'Your first scorecard will appear here.') status.textContent = ''
    paintHistory()
  }).catch(() => {
    if (!active()) return
    captainStatus.textContent = 'Captain scores couldn’t load.'
    captainStatus.hidden = false
  })
  add.onclick = () => {
    scorecardOrigin = undefined
    const resume = formSession.unsubmitted
    showEditor(null, resume ? { resume } : undefined)
  }
  if (seed) void openCalendarMatch(seed)
  else void readHistory()
}
