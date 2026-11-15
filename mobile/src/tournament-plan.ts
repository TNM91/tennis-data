import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCalendarDay } from '../../lib/calendar-date'
import { tournamentDraftFormats } from '../../lib/native-tournament-draft-contract'
import { readTournamentPlan, readTournamentScore, readTournamentSlot, tournamentSlotMinutes, type TournamentPlan, type TournamentPlanWrite, type TournamentScore } from '../../lib/native-tournament-plan-contract'
import { tennisMatchScoreText } from '../../lib/tennis-match-result'
import { formatTournamentEventTime } from '../../lib/tournament-event-presentation'
import type { TournamentMatch } from '../../lib/native-tournaments-contract'
import { scenarioOwner, type ScenarioSend } from './captain-scenarios-data'
import { html } from './match-details'
import { openTournamentEntry } from './tournament-entry-view'
import type { createTournamentPractice } from './tournament-practice'
import { openTournamentTrophy } from './tournament-trophy'
import { tournamentCourtLabel } from './tournament-match-filters'

const errors: Record<string, string> = {
  stale: 'The draw or schedule changed. Refresh it before saving again.',
  review: 'Review pending requests and confirm at least two entries before publishing.',
  court: 'That court is already booked during this slot. Choose a different time or court.',
  player: 'A player in this match is already scheduled during this slot.',
  round: 'Leave at least an hour between a match and the next round it feeds.',
  closed: 'This match is no longer available to schedule. Refresh the draw.',
  not_ready: 'Wait until both sides are known before entering the result.',
  downstream: 'A later match involving this winner already has a result. You can correct the score while keeping the recorded winner.',
  trophy_locked: 'Withdraw the champion trophy before changing a match winner.',
  invalid: 'Choose a time and court on or after the tournament date.',
}

type ResultEditor = { match: TournamentMatch; draft: Omit<TournamentScore, 'side'> & { side: TournamentScore['side'] | '' } }

export function openTournamentPlan(
  client: SupabaseClient, owner: string, event: string, current: () => boolean, send: ScenarioSend,
  trigger: HTMLElement, close: () => void, practice?: ReturnType<typeof createTournamentPractice>,
) {
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog competitions-dialog league-entry-dialog tournament-entry-dialog'
  dialog.setAttribute('aria-labelledby', 'tournament-plan-title')
  let plan: TournamentPlan | null = null
  let editor: TournamentMatch | null = null
  let resultEditor: ResultEditor | null = null
  let review: ReturnType<typeof openTournamentEntry> | null = null
  let trophy: ReturnType<typeof openTournamentTrophy> | null = null
  let busy = false
  let disposed = false
  let confirm = false
  let pending: TournamentPlanWrite | null = null
  let notice = ''
  let error = false
  let refreshRequired = false
  const active = () => !disposed && current()
  const focus = (selector: string) => dialog.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
  const top = () => { dialog.scrollTop = 0 }

  function dispose() {
    if (disposed) return
    disposed = true
    review?.dispose()
    trophy?.dispose()
    review = null
    dialog.remove()
    close()
    if (current() && trigger.isConnected) trigger.focus({ preventScroll: true })
  }

  function back() {
    if (review?.isOpen()) return review.back()
    if (trophy?.isOpen()) return trophy.back()
    if (busy) return true
    if (editor || resultEditor || confirm) {
      editor = null
      resultEditor = null
      confirm = false
      pending = null
      notice = ''
      render()
      top()
      focus('h2')
    } else dispose()
    return true
  }

  async function request(division?: string, write?: TournamentPlanWrite) {
    if (practice) return practice.plan(division, write)
    const session = await scenarioOwner(client, owner, active)
    const query = new URLSearchParams({ event, ...(division && !write ? { division } : {}) })
    const response = await send({
      url: 'https://www.tenaceiq.com/api/mobile/first-party/tournaments/plan?' + query,
      method: write ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + session.access_token, 'Cache-Control': 'no-store',
        ...(write ? { 'Content-Type': 'application/json' } : {}) },
      ...(write ? { data: write } : {}),
      webFetchExtra: { cache: 'no-store' }, disableRedirects: true, responseType: 'json',
      connectTimeout: 12000, readTimeout: 15000,
    })
    await scenarioOwner(client, owner, active)
    const value = response.data
    if (value?.scope === 'first-party' && value.ok === false && Object.hasOwn(errors, value.code)) throw Error(value.code)
    if (response.status !== 200 || value?.scope !== 'first-party' || value.ok !== true ||
        value.owner !== owner || value.event !== event) throw Error('unavailable')
    const result = readTournamentPlan(value.plan)
    if ((write?.division ?? division) && result.division !== (write?.division ?? division) ||
        (plan && result.id !== plan.id)) throw Error('unavailable')
    if (write?.action === 'publish' && result.divisions.find(item => item.id === result.division)?.status === 'open') {
      throw Error('unavailable')
    }
    if (write?.action === 'slot') {
      const match = result.matches.find(item => item.id === write.match)
      const slot = write.slot ?? { date: '', time: '', court: '' }
      if (!match || match.date !== slot.date || match.time !== slot.time || match.court !== slot.court) throw Error('unavailable')
    }
    if (write?.action === 'result') {
      const match = result.matches.find(item => item.id === write.match)
      const { outcome, score, side } = write.result
      if (!match || match.a !== write.sides[0] || match.b !== write.sides[1] ||
          match.winner !== (side === 'A' ? match.a : match.b) || match.score !== score ||
          (match.outcome ?? 'played') !== outcome) throw Error('unavailable')
    }
    return result
  }

  async function run(division?: string, write?: TournamentPlanWrite, reload = false) {
    if (!active() || busy) return
    busy = true
    notice = write ? 'Saving…' : 'Loading draw and courts…'
    error = false
    if (write) pending = write
    render()
    try {
      plan = await request(division, write)
      if (!active()) return
      editor = null
      resultEditor = null
      confirm = false
      pending = null
      refreshRequired = false
      notice = write?.action === 'publish' ? (practice ? 'Practice draw published.' : 'Draw published. Entries are closed for this division.') :
        write?.action === 'slot' ? (write.slot ? 'Court assignment saved to the tournament schedule.' : 'Court assignment cleared.') :
        write?.action === 'result' ? 'Result saved. The draw is up to date.' : ''
    } catch (failure) {
      if (!active()) return
      const code = failure instanceof Error ? failure.message : ''
      error = true
      notice = errors[code] ?? (write ? 'Couldn’t confirm the save. Retry to check the same change.' : 'Couldn’t load the draw and courts. Refresh to try again.')
      if (Object.hasOwn(errors, code)) pending = null
      refreshRequired ||= ['stale', 'closed', 'review', 'not_ready'].includes(code)
    } finally {
      busy = false
      if (active()) {
        render()
        if (notice && (write || reload || error)) {
          top()
          focus('[data-plan-notice]')
        }
        else if (!division || reload) focus('h2')
        else focus('[data-plan-division]')
      }
    }
  }

  function formAlert(message: string) {
    error = true
    notice = message
    const alert = dialog.querySelector<HTMLElement>('[data-plan-notice]')!
    alert.hidden = false
    alert.setAttribute('role', 'alert')
    alert.textContent = notice
    top()
    focus('[data-plan-notice]')
  }

  function render() {
    const division = plan?.divisions.find(item => item.id === plan?.division)
    const locked = busy || refreshRequired || !!pending
    const view = resultEditor ? resultEditor.match.winner ? 'Edit result' : 'Record result' :
      editor ? 'Assign match' : confirm ? 'Publish draw' : 'Draw & courts'
    const matches = plan?.matches ?? []
    const assigned = matches.filter(match => match.court && match.time && match.date).length
    dialog.innerHTML = `<header class="competition-header">
      <button type="button" class="secondary" data-plan-back ${busy ? 'disabled' : ''}>${editor || resultEditor || confirm ? 'Back to draw' : practice ? 'End practice' : 'Back to tournament'}</button>
      <button type="button" class="secondary" data-plan-refresh ${busy ? 'disabled' : ''}>Refresh</button>
    </header>
    <div class="competition-hero entry-hero"><h2 id="tournament-plan-title" tabindex="-1">${view}</h2>
      ${plan ? `<p>${html(plan.name)} · ${html(plan.zone.replaceAll('_', ' '))}</p>` : ''}
      ${practice ? '<p>Sample players only. Changes are cleared when you end practice.</p>' : ''}
    </div>
    <p role="${error ? 'alert' : 'status'}" tabindex="-1" data-plan-notice${notice ? '' : ' hidden'}>${html(notice)}</p>
    ${pending && !busy ? '<button type="button" data-plan-retry>Retry save</button>' : ''}
    ${plan && division ? confirm ? `
      <section class="entry-receipts" aria-label="Publish draw"><article>
        <strong>${html(division.name)}</strong><p>${practice ? 'Publish these sample pairings to start scheduling matches.' :
          'Players will see these pairings. Publishing closes entries for this division and locks its approved field.'}</p>
        <button type="button" data-plan-publish ${locked ? 'disabled' : ''}>Publish draw</button>
      </article></section>` : resultEditor ? resultForm(resultEditor, locked) :
      editor ? matchForm(editor, plan, locked, matches.some(match => match.id === editor?.id && !!match.court)) : `
      <fieldset class="entry-fields"><legend>Division</legend><label>Choose division<select data-plan-division ${locked ? 'disabled' : ''}>
        ${plan.divisions.map(item => `<option value="${html(item.id)}"${division.id === item.id ? ' selected' : ''}>${html(item.name)}</option>`).join('')}
      </select></label></fieldset>
      <section class="entry-receipts" aria-label="Draw status"><article>
        <strong>${division.status === 'open' ? 'Approved entries' : division.status === 'completed' ? 'Division complete' : 'Published draw'}</strong>
        <p>${division.entries} approved · ${html(tournamentDraftFormats[division.format])}${division.status === 'open'
          ? ` · ${division.pending} pending` : division.status === 'completed'
            ? ` · ${matches.length} results` : ` · ${assigned} of ${matches.length} assigned`}</p>
        ${division.status === 'open' ? `
          ${practice ? '' : `<button type="button" class="secondary" data-plan-review ${locked ? 'disabled' : ''}>Review entries</button>`}
          ${division.drawNotice ? `<p>${html(division.drawNotice)}</p>` : !matches.length ? '<p>Approve at least two entries to preview pairings.</p>' :
            division.pending ? '<p>Review pending requests before publishing.</p>' :
            `<button type="button" data-plan-confirm ${locked ? 'disabled' : ''}>Review and publish draw</button>`}` :
          division.status === 'scheduled' ? `<p>${tournamentSlotMinutes}-minute slots${practice ? '' : ' · Saved times and courts appear in the player schedule.'}</p>` : ''}
        ${division.status === 'completed' ? `<button type="button" data-plan-trophy ${locked ? 'disabled' : ''}>Champion trophy</button>` : ''}
      </article></section>
      ${matches.length ? `<section class="entry-receipts" aria-label="${division.status === 'open' ? 'Draw preview' : 'Matches'}">${matches.map(match => `<article>
        <small>${html(match.label)}</small><strong>${html(match.a)} vs ${html(match.b)}</strong>
        ${division.status === 'open' ? '' : match.winner
          ? `<p>${html([match.winner + ' won', tennisMatchScoreText(match.score, match.outcome)].filter(Boolean).join(' · '))}</p>`
          : `<p>${match.court && match.time && match.date
            ? html([formatCalendarDay(match.date), formatTournamentEventTime(match.time), tournamentCourtLabel(match.court)].join(' · ')) : 'Awaiting time and court'}</p>`}
        ${match.playerOverlap ? '<p class="entry-note">A player has an overlapping match. Review this assignment.</p>' : ''}
        ${division.status !== 'open' && match.ready !== false
          ? `<button type="button" class="secondary" data-plan-score="${match.id}" ${locked ? 'disabled' : ''}>${match.winner ? 'Edit result' : 'Record result'}<span class="sr-only"> for ${html(match.a)} vs ${html(match.b)}</span></button>` : ''}
        ${division.status === 'scheduled' && !match.winner
          ? `<button type="button" class="secondary" data-plan-edit="${match.id}" ${locked ? 'disabled' : ''}>${match.court ? 'Edit assignment' : 'Assign time and court'}<span class="sr-only"> for ${html(match.a)} vs ${html(match.b)}</span></button>` : ''}
      </article>`).join('')}</section>` : ''}
    ` : ''}`

    dialog.querySelector('[data-plan-back]')?.addEventListener('click', back)
    dialog.querySelector('[data-plan-refresh]')?.addEventListener('click', () => { void run(plan?.division, undefined, true) })
    if (!plan || !division) return
    const base = { division: division.id, revision: plan.revision }
    dialog.querySelector<HTMLSelectElement>('[data-plan-division]')?.addEventListener('change', event => {
      void run((event.currentTarget as HTMLSelectElement).value)
    })
    dialog.querySelector('[data-plan-review]')?.addEventListener('click', event => {
      if (!plan || review?.isOpen()) return
      review = openTournamentEntry(client, owner, active, plan.id, division.id, () => {
        review = null
        void run(division.id)
      }, send, event.currentTarget as HTMLElement, { allowCalendar: false, organizerOnly: true, backLabel: 'Back to draw' })
    })
    dialog.querySelector('[data-plan-trophy]')?.addEventListener('click', click => {
      if (trophy?.isOpen()) return
      trophy = openTournamentTrophy(client, owner, event, division.id, active, send,
        click.currentTarget as HTMLElement, () => { trophy = null }, practice?.trophy)
    })
    dialog.querySelector('[data-plan-confirm]')?.addEventListener('click', () => {
      confirm = true
      render()
      top()
      focus('h2')
    })
    dialog.querySelector('[data-plan-publish]')?.addEventListener('click', () => {
      void run(division.id, { ...base, action: 'publish' })
    })
    dialog.querySelectorAll<HTMLButtonElement>('[data-plan-edit]').forEach(button => {
      button.onclick = () => {
        editor = matches.find(match => match.id === button.dataset.planEdit) ?? null
        render()
        top()
        focus('h2')
      }
    })
    dialog.querySelectorAll<HTMLButtonElement>('[data-plan-score]').forEach(button => {
      button.onclick = () => {
        const match = matches.find(item => item.id === button.dataset.planScore)
        if (!match) return
        resultEditor = { match, draft: {
          outcome: match.outcome ?? 'played', score: match.score,
          side: match.winner ? (match.winner === match.a ? 'A' : 'B') : '',
        } }
        error = false
        notice = ''
        render()
        top()
        focus('h2')
      }
    })
    const scoreForm = dialog.querySelector<HTMLFormElement>('[data-plan-result-form]')
    if (scoreForm && resultEditor) {
      const draft = resultEditor.draft
      const read = () => {
        const fields = new FormData(scoreForm)
        const outcome = fields.get('outcome')
        const side = fields.get('side')
        draft.outcome = outcome === 'walkover' || outcome === 'retirement' ? outcome : 'played'
        if (fields.has('side')) draft.side = side === 'A' || side === 'B' ? side : ''
        if (fields.has('score')) draft.score = String(fields.get('score') ?? '')
      }
      scoreForm.querySelector('[name="outcome"]')?.addEventListener('change', () => {
        read()
        render()
        focus('[name="outcome"]')
      })
      scoreForm.onsubmit = event => {
        event.preventDefault()
        if (!resultEditor || locked) return
        read()
        try {
          const result = readTournamentScore({
            outcome: draft.outcome, score: draft.outcome === 'walkover' ? '' : draft.score,
            ...(draft.outcome !== 'played' ? { side: draft.side } : {}),
          })
          const { id, a, b } = resultEditor.match
          void run(division.id, { ...base, action: 'result', match: id, sides: [a, b], result })
        } catch (failure) {
          formAlert(failure instanceof Error ? failure.message : 'Check the match result.')
        }
      }
    }
    const form = dialog.querySelector<HTMLFormElement>('[data-plan-form]')
    if (form && editor) {
      const currentMatch = matches.find(match => match.id === editor?.id)
      form.onsubmit = event => {
        event.preventDefault()
        if (!editor || locked) return
        const fields = Object.fromEntries(new FormData(form))
        try {
          const slot = readTournamentSlot(fields)
          editor = { ...editor, ...slot }
          void run(division.id, { ...base, action: 'slot', match: editor.id, slot })
        } catch {
          formAlert('Choose a valid date, start time and court.')
        }
      }
      if (currentMatch?.court) dialog.querySelector('[data-plan-clear]')?.addEventListener('click', () => {
        void run(division.id, { ...base, action: 'slot', match: currentMatch.id, slot: null })
      })
    }
    dialog.querySelector('[data-plan-retry]')?.addEventListener('click', () => {
      if (pending) void run(pending.division, pending)
    })
  }

  dialog.oncancel = event => { event.preventDefault(); back() }
  document.body.append(dialog)
  dialog.showModal()
  void run()
  return { dispose, back, isOpen: () => !disposed }
}

function matchForm(match: TournamentMatch, plan: TournamentPlan, locked: boolean, canClear: boolean) {
  return `<form data-plan-form>
    <fieldset class="entry-fields" ${locked ? 'disabled' : ''}><legend>${html(match.a)} vs ${html(match.b)}</legend>
      <label>Date<input type="date" name="date" min="${html(plan.date)}" value="${html(match.date || plan.date)}" required></label>
      <label>Start time<input type="time" name="time" value="${html(match.time)}" required></label>
      <label>Court<input type="text" name="court" value="${html(match.court)}" maxlength="40" placeholder="Court 1" required></label>
    </fieldset>
    <button type="submit" ${locked ? 'disabled' : ''}>Save time and court</button>
    ${canClear ? `<button type="button" class="secondary" data-plan-clear ${locked ? 'disabled' : ''}>Clear assignment</button>` : ''}
  </form>`
}

function resultForm(editor: ResultEditor, locked: boolean) {
  const { match, draft } = editor
  return `<form data-plan-result-form>
    <fieldset class="entry-fields" ${locked ? 'disabled' : ''}><legend>${html(match.a)} vs ${html(match.b)}</legend>
      <label>Outcome<select name="outcome">
        ${Object.entries({ played: 'Played', walkover: 'Walkover', retirement: 'Retirement' }).map(([value, label]) =>
          `<option value="${value}"${value === draft.outcome ? ' selected' : ''}>${label}</option>`).join('')}
      </select></label>
      ${draft.outcome !== 'played' ? `<label>Winner<select name="side" required>
        <option value="">Choose the winner</option>
        <option value="A"${draft.side === 'A' ? ' selected' : ''}>${html(match.a)}</option>
        <option value="B"${draft.side === 'B' ? ' selected' : ''}>${html(match.b)}</option>
      </select></label>` : ''}
      ${draft.outcome === 'walkover' ? '' :
        `<label>${draft.outcome === 'retirement' ? 'Score when play stopped (optional)' : 'Set scores'}
          <input name="score" type="text" maxlength="64" autocomplete="off" autocapitalize="off" spellcheck="false"
            value="${html(draft.score)}" placeholder="${draft.outcome === 'retirement' ? '6-4, 2-1' : '6-4, 7-5'}">
        </label><p>Enter ${html(match.a)}’s games first in each set.</p>`}
    </fieldset>
    <button type="submit" ${locked ? 'disabled' : ''}>Save result</button>
  </form>`
}
