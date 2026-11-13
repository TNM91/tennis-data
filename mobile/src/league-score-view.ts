import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCalendarDay } from '../../lib/calendar-date'
import { formatCaptainPracticeTime } from '../../lib/captain-practice-invite'
import {
  leagueCourtResultText, leagueScoreLine, readLeagueScoreCard, readLeagueScoreDesk, readLeagueScoreFixture, validateLeagueScoreLines,
  type LeagueCourtOutcome, type LeagueScoreChange, type LeagueScoreDesk, type LeagueScoreDiscipline, type LeagueScoreFixture,
} from '../../lib/native-league-score-contract'
import { scenarioOwner, type ScenarioSend } from './captain-scenarios-data'
import { html } from './match-details'

type DraftLine = { format: LeagueScoreDiscipline; score: string; outcome: LeagueCourtOutcome; winner: string }
const blankLine=(format:LeagueScoreDiscipline):DraftLine=>({format,score:'',outcome:'played',winner:''})

export function openLeagueScores(
  client: SupabaseClient, owner: string, current: () => boolean, leagueId: string, matchId: string,
  closed: (approved: boolean, changed: boolean) => void, send: ScenarioSend = request => CapacitorHttp.request(request),
  backLabel = 'Back to league',
) {
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog competitions-dialog league-entry-dialog league-scheduler'
  dialog.setAttribute('aria-labelledby', 'league-scores-title')
  const queue = !matchId
  let disposed = false, busy = false, approved = false, changed = false, selected = matchId
  let desk: LeagueScoreDesk | null = null, matches: LeagueScoreFixture[] | null = null
  let draft: DraftLine[] = [], note = '', returning = false
  let pending: LeagueScoreChange | null = null
  let status = 'Loading league scores…'
  const active = () => !disposed && current()
  const dispose = () => { disposed = true; dialog.remove() }
  function back() {
    if (busy) return true
    if (pending) {
      showStatus('Retry the same change or reload the scorecard to check whether it saved.')
      return true
    }
    if (queue && selected) { selected = ''; void load(); return true }
    dispose()
    if (current()) closed(approved,changed)
    return true
  }

  async function request(change?: LeagueScoreChange) {
    const session = await scenarioOwner(client, owner, active)
    const params = new URLSearchParams({ league: leagueId, ...(selected ? { match: selected } : {}) })
    const response = await send({
      url: 'https://www.tenaceiq.com/api/mobile/first-party/competitions/scores' + (change ? '' : '?' + params),
      method: change ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + session.access_token, 'Cache-Control': 'no-store', 'X-TenAceIQ-League-Score': '2',
        ...(change ? { 'Content-Type': 'application/json' } : {}) },
      ...(change ? { data: change } : {}), disableRedirects: true, responseType: 'json',
      webFetchExtra: { cache: 'no-store' }, connectTimeout: 12000, readTimeout: 60000,
    })
    await scenarioOwner(client, owner, active)
    const data = response.data
    if (data?.releaseScope !== 'first-party') throw Error('League scores couldn’t be confirmed.')
    if (response.status !== 200) {
      if (response.status >= 500) throw Error('The change couldn’t be confirmed. Retry or reload the scorecard.')
      return { error: typeof data.message === 'string' ? data.message : 'This scorecard is unavailable.' }
    }
    if (data.ok !== true || data.owner !== owner || data.leagueId !== leagueId) throw Error('League score access changed.')
    return { data }
  }

  function showStatus(message: string) {
    status = message
    const feedback = dialog.querySelector<HTMLElement>('[data-score-status]')
    if (feedback) { feedback.textContent = message; feedback.focus() }
  }

  async function load() {
    if (!active() || busy) return
    busy = true; status = 'Loading league scores…'
    desk = null; matches = null; pending = null; note = ''; returning = false
    render()
    try {
      const { data, error } = await request()
      if (error) throw Error(error)
      if (selected) {
        desk = readLeagueScoreDesk(data.desk, selected)
        if (desk.card?.state === 'approved') approved ||= queue
        draft = desk.card?.lines.map(({ format, score, outcome, winner }) => ({ format, score, outcome:outcome??'played', winner })) ??
          desk.slots.map(({ format }) => blankLine(format))
        if (!draft.length) draft = [blankLine('doubles')]
      } else {
        if (!Array.isArray(data.matches) || data.matches.length > 100) throw Error('Score review queue is unavailable.')
        matches = data.matches.map(readLeagueScoreFixture)
      }
      status = ''
    } catch (error) {
      status = error instanceof Error ? error.message : 'League scores couldn’t load.'
    } finally {
      if (active()) { busy = false; render(true) }
    }
  }

  async function save(change: LeagueScoreChange) {
    if (!active() || busy || !desk) return
    pending = change; busy = true; status = 'Saving…'; render()
    try {
      const { data, error } = await request(change)
      if (error) { pending = null; status = error; return }
      const card = readLeagueScoreCard(data.card)
      const expected = change.action === 'submit' ? 'pending' : change.action === 'return' ? 'changes_requested' : 'approved'
      if (data.matchId !== selected || card.revision !== change.requestId || card.state !== expected) throw Error('Score receipt changed.')
      desk = { ...desk, card }
      changed = true
      pending = null; returning = false; note = ''
      if (card.state === 'approved') approved = true
      status = card.state === 'approved' ? 'Score approved. League standings are updated.' :
        card.state === 'changes_requested' ? 'Returned to the captains for correction.' : 'Submitted for coordinator review.'
    } catch {
      status = 'The change couldn’t be confirmed. Retry the same change or reload the scorecard.'
    } finally {
      if (active()) { busy = false; render(true) }
    }
  }

  function commit(action: LeagueScoreChange['action']) {
    if (!desk || busy || pending) return
    try {
      const lines = action === 'submit' ? draft.map(line => leagueScoreLine(
        line.format, line.outcome==='walkover'?'':line.score, line.outcome, line.winner,
      )) : []
      if (action === 'submit') validateLeagueScoreLines(lines, desk)
      const reason = action === 'return' ? note.trim().replace(/\s+/g, ' ') : ''
      if (action === 'return' && !reason) throw Error('Tell the captain what needs correcting.')
      void save({ action, lines, note: reason, leagueId, matchId: selected,
        fixtureVersion: desk.fixtureVersion, revision: desk.card?.revision ?? null, requestId: crypto.randomUUID() })
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'Check the scorecard.')
    }
  }

  function render(focus = false) {
    if (!active()) return
    const card = desk?.card
    const editable = desk?.canSubmit && (!card || card.state === 'changes_requested')
    const controls = !busy && !pending
    const title = !selected ? 'Review scores' : desk?.canReview ? 'Review scorecard' : 'Match scorecard'
    const date = (match: LeagueScoreFixture) => [formatCalendarDay(match.date, false),
      match.time ? formatCaptainPracticeTime(match.time) : ''].filter(Boolean).join(' · ')
    const slot = (i: number) => desk?.slots[i]?.label || 'Court ' + (i + 1)
    let content = ''
    if (!selected && matches) {
      content = matches.length ? matches.map(match => `<article class="lineup-court league-scheduler-summary">
        <strong>${html(match.a)} vs ${html(match.b)}</strong><p>${html(date(match))}</p>
        <button type="button" class="secondary" data-score-match="${html(match.id)}">Review<span class="sr-only"> ${html(match.a)} vs ${html(match.b)}</span></button>
      </article>`).join('') : '<p>No scorecards are waiting for review.</p>'
    }
    if (desk) {
      const { match } = desk
      content = `<div class="lineup-court league-scheduler-summary"><strong>${html(match.a)} vs ${html(match.b)}</strong>
        <p>${html(date(match))}</p></div>`
      if (card) {
        const labels = { pending: 'Awaiting coordinator review', changes_requested: 'Corrections requested', approved: 'Official score' }
        content += `<p class="competition-status">${labels[card.state]}</p>`
        if (card.note) content += `<p class="entry-note">${html(card.note)}</p>`
      }
      if (editable) {
        content += `<form data-score-form><p>Enter scores in ${html(match.a)}–${html(match.b)} order.</p>
          ${draft.map((line, i) => `<fieldset class="lineup-court"><legend>${html(slot(i))}</legend>
            ${desk?.slots.length ? '' : `<label>Format<select name="format-${i}" ${controls ? '' : 'disabled'}><option value="singles"${line.format === 'singles' ? ' selected' : ''}>Singles</option>
              <option value="doubles"${line.format === 'doubles' ? ' selected' : ''}>Doubles</option></select></label>`}
            <label>Court outcome<select name="outcome-${i}" data-court-outcome ${controls ? '' : 'disabled'}>
              <option value="played"${line.outcome==='played'?' selected':''}>Played</option>
              <option value="walkover"${line.outcome==='walkover'?' selected':''}>Walkover</option>
              <option value="retirement"${line.outcome==='retirement'?' selected':''}>Retirement</option></select></label>
            ${line.outcome==='played'?'':`<label>Team awarded the court<select name="winner-${i}" required ${controls?'':'disabled'}>
              <option value="">Choose team</option><option value="A"${line.winner==='A'?' selected':''}>${html(match.a)}</option>
              <option value="B"${line.winner==='B'?' selected':''}>${html(match.b)}</option></select></label>`}
            ${line.outcome==='walkover'?'<p class="rating-context">No score needed.</p>':`<label>${line.outcome==='retirement'?'Score when play stopped (optional)':'Set scores'}
              <input name="score-${i}" ${line.outcome==='played'?'required':''} maxlength="64" value="${html(line.score)}"
              placeholder="${line.outcome==='retirement'?'6-4, 2-1':'6-4, 7-5'}" autocomplete="off" ${controls?'':'disabled'}></label>`}
            ${!desk?.slots.length && draft.length > 1 && controls ? `<button type="button" class="secondary" data-score-remove="${i}">Remove court ${i+1}</button>` : ''}
          </fieldset>`).join('')}
          ${controls && !desk.slots.length && draft.length < 30 ? '<button type="button" class="secondary" data-score-add>Add court</button>' : ''}
          ${controls ? `<button type="submit">${card ? 'Resubmit scorecard' : 'Submit for review'}</button>` : ''}
        </form>`
      } else if (card) {
        content += `<ol class="competition-standings">${card.lines.map((line, i) => `<li class="lineup-court">
          <strong>${html(slot(i))}</strong><p>${html(leagueCourtResultText(line))} · ${html(line.winner === 'A' ? match.a : match.b)}</p></li>`).join('')}</ol>`
      } else {
        content += desk.canReview ? '<p>The captains haven’t submitted a scorecard yet.</p>' :
          '<p>Scores open when the match starts. If the result is already recorded, look in Results.</p>'
      }
      if (card?.state === 'pending' && desk.canReview && controls) {
        content += returning ? `<form data-score-return-form><label>What needs correcting?
          <textarea name="note" maxlength="500" required>${html(note)}</textarea></label>
          <button type="submit">Return scorecard</button><button type="button" class="secondary" data-score-keep>Back to review</button></form>`
          : '<div class="league-scheduler-actions"><button type="button" data-score-approve>Approve score</button><button type="button" class="secondary" data-score-return>Request corrections</button></div>'
      }
    }
    if (pending && !busy) content += '<button type="button" data-score-retry>Retry same change</button>'
    dialog.innerHTML = `<header class="competition-header"><button type="button" class="secondary" data-score-close ${busy ? 'disabled' : ''}>
      ${queue && selected ? 'Back to score review' : html(backLabel)}</button>
      <button type="button" class="secondary" data-score-refresh ${busy ? 'disabled' : ''}>Reload</button></header>
      <div class="entry-hero"><h2 id="league-scores-title" tabindex="-1">${title}</h2></div>
      ${content}<p role="status" tabindex="-1" data-score-status>${html(status)}</p>`
    dialog.querySelector('[data-score-close]')?.addEventListener('click', back)
    dialog.querySelector('[data-score-refresh]')?.addEventListener('click', () => { void load() })
    dialog.querySelectorAll<HTMLButtonElement>('[data-score-match]').forEach(button => {
      button.onclick = () => { selected = button.dataset.scoreMatch!; void load() }
    })
    const fields = dialog.querySelector<HTMLFormElement>('[data-score-form]')
    const remember = () => {
      if (!fields) return
      const values = new FormData(fields)
      draft = draft.map((line, i) => {
        const next=values.get('outcome-'+i), outcome=next==='walkover'||next==='retirement'?next:'played'
        return { format: values.get('format-'+i) === 'singles' ? 'singles' :
          values.has('format-'+i) ? 'doubles' : line.format, outcome,
          winner: outcome===line.outcome ? String(values.get('winner-'+i)??'') : '',
          score: outcome==='walkover'?'':String(values.get('score-'+i)??'') }
      })
    }
    fields?.addEventListener('submit', event => { event.preventDefault(); remember(); commit('submit') })
    fields?.addEventListener('change', event => {
      if (!(event.target instanceof HTMLSelectElement)||!event.target.hasAttribute('data-court-outcome')) return
      const name=event.target.name
      remember(); render(); dialog.querySelector<HTMLElement>('[name="'+name+'"]')?.focus({preventScroll:true})
    })
    dialog.querySelector('[data-score-add]')?.addEventListener('click', () => {
      remember(); draft.push(blankLine('doubles')); render()
      dialog.querySelector<HTMLElement>('[name="format-'+(draft.length-1)+'"]')?.focus()
    })
    dialog.querySelectorAll<HTMLButtonElement>('[data-score-remove]').forEach(button => {
      button.onclick = () => { remember(); draft.splice(Number(button.dataset.scoreRemove), 1); render(true) }
    })
    dialog.querySelector('[data-score-approve]')?.addEventListener('click', () => commit('approve'))
    dialog.querySelector('[data-score-return]')?.addEventListener('click', () => {
      returning = true; render(); dialog.querySelector<HTMLElement>('[name="note"]')?.focus()
    })
    dialog.querySelector('[data-score-keep]')?.addEventListener('click', () => { returning = false; render(true) })
    dialog.querySelector<HTMLFormElement>('[data-score-return-form]')?.addEventListener('submit', event => {
      event.preventDefault(); note = String(new FormData(event.currentTarget as HTMLFormElement).get('note') ?? ''); commit('return')
    })
    dialog.querySelector('[data-score-retry]')?.addEventListener('click', () => { if (pending) void save(pending) })
    if (focus) dialog.querySelector<HTMLElement>(status ? '[data-score-status]' : 'h2')?.focus()
  }

  dialog.oncancel = event => { event.preventDefault(); back() }
  document.body.append(dialog)
  render()
  dialog.showModal()
  void load()
  return { isOpen: () => !disposed, back, dispose }
}
