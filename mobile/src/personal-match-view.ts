import type { SupabaseClient } from '@supabase/supabase-js'
import { localCalendarDate } from './calendar-data'
import { mountPersonalRecentForm } from './lab-recent-form'
import { html } from './match-details'
import { matchDate } from './recent-results'
import { loadPersonalMatches, MatchChanged, personalMatchDraft, removePersonalMatch, savePersonalMatch,
  type PersonalMatch, type PersonalMatchDraft } from './personal-match-data'

const formatName = (format: PersonalMatch['format']) => format === 'singles' ? 'Singles' : 'Doubles'

export function mountPersonalMatchLog(host: HTMLElement, client: SupabaseClient, owner: string, current: () => boolean) {
  host.innerHTML = `<div class="lab-form-host" data-personal-form></div>
    <section aria-labelledby="personal-matches-title">
      <div class="lab-recent-heading"><h2 id="personal-matches-title" tabindex="-1">Match log</h2>
        <button type="button" data-log-match>Log a match</button></div>
      <p>Your scores and recent form sync privately to your account.</p>
      <div data-personal-editor></div>
      <div data-personal-history></div>
      <p role="status" data-personal-status></p>
    </section>`
  const formHost = host.querySelector<HTMLElement>('[data-personal-form]')!
  const editor = host.querySelector<HTMLElement>('[data-personal-editor]')!
  const history = host.querySelector<HTMLElement>('[data-personal-history]')!
  const status = host.querySelector<HTMLElement>('[data-personal-status]')!
  const add = host.querySelector<HTMLButtonElement>('[data-log-match]')!
  const active = () => host.isConnected && current()
  let matches: PersonalMatch[] = []
  let more = false, reading = false, writing = false

  function paintHistory() {
    mountPersonalRecentForm(formHost, matches, active, showScorecard)
    history.innerHTML = matches.length ? `<h3>Saved scorecards</h3><ol class="matches">${matches.map((match, index) =>
      `<li><strong>${html(match.opponent)}</strong><p>${match.outcome} · ${formatName(match.format)} · ${html(matchDate(match.match_date))}</p>
      <button type="button" class="secondary" data-open-scorecard="${index}">Open scorecard<span class="sr-only"> for ${html(match.opponent)}</span></button></li>`).join('')}</ol>` : ''
    if (more) history.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-older-scorecards>Load older matches</button>')
    history.querySelectorAll<HTMLButtonElement>('[data-open-scorecard]').forEach(button => {
      button.onclick = () => showScorecard(matches[Number(button.dataset.openScorecard)])
    })
    const older = history.querySelector<HTMLButtonElement>('[data-older-scorecards]')
    if (older) older.onclick = () => { void readHistory(true) }
  }

  async function readHistory(older = false, receipt = '') {
    if (!active() || reading || writing) return
    reading = true
    add.disabled = true
    const olderButton = history.querySelector<HTMLButtonElement>('[data-older-scorecards]')
    if (olderButton) olderButton.disabled = true
    status.textContent = older ? 'Loading older matches…' : 'Loading match history…'
    try {
      const page = await loadPersonalMatches(client, owner, active, older ? matches.at(-1) : undefined)
      if (!active()) return
      const previousCount = matches.length
      matches = older ? [...new Map([...matches, ...page.matches].map(row => [row.id, row])).values()] : page.matches
      more = page.more
      paintHistory()
      status.textContent = receipt || (matches.length ? '' : 'Your first scorecard will appear here.')
      if (older) history.querySelectorAll<HTMLButtonElement>('[data-open-scorecard]')[previousCount]?.focus()
    } catch {
      if (!active()) return
      status.textContent = `${receipt ? receipt + ' ' : ''}Couldn’t load ${older ? 'older matches' : 'your match history'}.`
      if (olderButton?.isConnected) olderButton.disabled = false
      if (!older && !history.querySelector('[data-refresh-matches]')) {
        history.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-refresh-matches>Retry history</button>')
        history.querySelector<HTMLButtonElement>('[data-refresh-matches]')!.onclick = () => { void readHistory() }
      }
    } finally {
      reading = false
      if (active()) add.disabled = false
    }
  }

  function showScorecard(match: PersonalMatch) {
    if (!active() || writing || !match) return
    history.hidden = formHost.hidden = false
    add.disabled = reading
    editor.innerHTML = `<article class="lab-first-scorecard" aria-label="Saved scorecard">
      <h3 tabindex="-1">${html(match.opponent)}</h3>
      <p>${html(matchDate(match.match_date))} · ${formatName(match.format)} · ${match.outcome}</p>
      <p><strong>${html(match.score)}</strong></p>
      <button type="button" class="secondary" data-edit-match>Edit scorecard</button>
      <button type="button" class="secondary" data-remove-match>Remove scorecard</button>
      <button type="button" class="secondary" data-close-scorecard>Back to match log</button>
    </article>`
    editor.querySelector<HTMLElement>('h3')!.focus()
    editor.querySelector<HTMLButtonElement>('[data-edit-match]')!.onclick = () => showEditor(match)
    editor.querySelector<HTMLButtonElement>('[data-remove-match]')!.onclick = () => confirmRemoval(match)
    editor.querySelector<HTMLButtonElement>('[data-close-scorecard]')!.onclick = closeEditor
  }

  function closeEditor() {
    editor.replaceChildren()
    history.hidden = formHost.hidden = false
    add.disabled = reading
    add.focus({ preventScroll: true })
  }

  function showEditor(match: PersonalMatch | null) {
    if (!active() || writing || reading) return
    history.hidden = formHost.hidden = add.disabled = true
    editor.innerHTML = `<form class="lab-first-scorecard" data-match-editor>
      <h3 tabindex="-1">${match ? 'Edit scorecard' : 'Log a match'}</h3>
      <fieldset>
        <legend class="sr-only">Match details</legend>
        <label>Match date <input type="date" name="match_date" required max="${localCalendarDate()}"></label>
        <label>Opponent or doubles team <input name="opponent" maxlength="100" required></label>
        <label for="personal-match-format">Format</label>
        <select id="personal-match-format" name="format" required><option value="">Choose format</option><option value="singles">Singles</option><option value="doubles">Doubles</option></select>
        <label for="personal-match-outcome">Result</label>
        <select id="personal-match-outcome" name="outcome" required><option value="">Choose result</option><option>Won</option><option>Lost</option></select>
        <label>Score <input name="score" maxlength="64" placeholder="6-4 6-3" required></label>
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
    for (const [field, value] of Object.entries({ match_date: match?.match_date ?? localCalendarDate(), opponent: match?.opponent ?? '',
      format: match?.format ?? '', outcome: match?.outcome ?? '', score: match?.score ?? '' })) {
      const input = form.elements.namedItem(field) as HTMLInputElement | HTMLSelectElement
      input.value = value
    }
    let draft: PersonalMatchDraft | undefined
    cancel.onclick = () => {
      if (writing) return
      if (draft) { closeEditor(); void readHistory(); return }
      if (match) showScorecard(match)
      else closeEditor()
    }
    form.onsubmit = async event => {
      event.preventDefault()
      if (!active() || writing || reading) return
      try { draft ??= personalMatchDraft(new FormData(form), match) }
      catch (error) { feedback.textContent = error instanceof Error ? error.message : 'Check your scorecard.'; return }
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

  add.onclick = () => showEditor(null)
  void readHistory()
}
