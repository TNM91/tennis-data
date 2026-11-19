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
import './match-day.css'

type DraftLine = { format: LeagueScoreDiscipline; score: string; outcome: LeagueCourtOutcome; winner: string }
const blankLine=(format:LeagueScoreDiscipline):DraftLine=>({format,score:'',outcome:'played',winner:''})

export function openLeagueScores(
  client: SupabaseClient, owner: string, current: () => boolean, leagueId: string, matchId: string,
  closed: (approved: boolean, changed: boolean, destination?: 'standings') => void, send: ScenarioSend = request => CapacitorHttp.request(request),
  backLabel = 'Back to league', offerStandings = false,
) {
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog competitions-dialog league-entry-dialog league-scheduler league-score-screen'
  dialog.setAttribute('aria-labelledby', 'league-scores-title')
  const queue = !matchId
  let disposed = false, busy = false, approved = false, changed = false, selected = matchId
  let desk: LeagueScoreDesk | null = null, matches: LeagueScoreFixture[] | null = null
  let draft: DraftLine[] = [], note = '', returning = false
  let pending: LeagueScoreChange | null = null
  let edited = false, leavePrompt: HTMLDialogElement | null = null
  let status = 'Loading league scores…'
  const active = () => !disposed && current()
  const dispose = () => {disposed = true; leavePrompt?.remove(); leavePrompt = null; desk = null; matches = null; draft = []; note = ''; pending = null; dialog.remove()}
  function confirmDiscard(action: () => void) {
    if (!active() || leavePrompt) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const prompt = document.createElement('dialog'); leavePrompt = prompt
    prompt.className = 'captain-lineup-dialog league-score-discard'; prompt.setAttribute('aria-label', 'Keep unsent scores')
    prompt.innerHTML = '<h2>Keep your edits?</h2><p>Your unsent score or correction note will be discarded if you leave or reload.</p><button type="button" data-keep>Keep editing</button><button type="button" class="secondary" data-discard>Discard edits and continue</button>'
    const keep = () => {prompt.remove(); leavePrompt = null; if (active() && previous?.isConnected) previous.focus({preventScroll: true})}
    prompt.querySelector<HTMLButtonElement>('[data-keep]')!.onclick = keep
    prompt.querySelector<HTMLButtonElement>('[data-discard]')!.onclick = () => {prompt.remove(); leavePrompt = null; edited = false; if (active()) action()}
    prompt.oncancel = event => {event.preventDefault(); keep()}
    dialog.append(prompt); prompt.showModal(); prompt.querySelector<HTMLButtonElement>('[data-keep]')!.focus()
  }
  function back() {
    if (disposed) return true
    if (leavePrompt) {leavePrompt.querySelector<HTMLButtonElement>('[data-keep]')?.click(); return true}
    if (busy) return true
    if (pending) {
      showStatus('Retry the same change or reload the scorecard to check whether it saved.')
      return true
    }
    if (edited) {confirmDiscard(back); return true}
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
    desk = null; matches = null; pending = null; note = ''; returning = false; edited = false
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
      edited = false
      if (card.state === 'approved') approved = true
      status = card.state === 'approved' ? 'Score approved. League standings are updated.' :
        card.state === 'changes_requested' ? desk.leagueFormat==='individual'?'Returned to the player for correction.':
          'Returned to the captains for correction.' : 'Submitted for coordinator review.'
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
      if (action === 'return' && !reason) throw Error('Describe what needs correcting.')
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
    const title = !selected ? 'Review scores' : card?.state === 'approved' ? 'Official scorecard' : desk?.canReview ? 'Review scorecard' : 'Match scorecard'
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
      const individual = desk.leagueFormat === 'individual'
      content = `<div class="lineup-court league-scheduler-summary league-score-context"><strong>${html(match.a)} vs ${html(match.b)}</strong>
        <p>${html(date(match))}</p></div>`
      if (card) {
        const labels = { pending: 'Awaiting coordinator review', changes_requested: 'Corrections requested', approved: 'Official score' }
        content += `<p class="competition-status">${labels[card.state]}</p>`
        if (card.note) content += `<p class="entry-note">${html(card.note)}</p>`
        content += `<p class="league-score-next-step">${card.state === 'approved' ? 'This result counts in league standings.' : card.state === 'changes_requested' ?
          editable ? 'Update the scorecard using the coordinator’s note, then resubmit it.' : 'Waiting for the submitter to correct and resubmit this scorecard.' : desk.canReview ?
          'Check the court scores, then approve them or request corrections.' : 'A coordinator will review these scores before they count in standings.'}</p>`
      }
      if (editable) {
        content += `<form data-score-form><p>Enter scores in ${html(match.a)}–${html(match.b)} order.</p>
          ${draft.map((line, i) => `<fieldset class="lineup-court"><legend>${html(slot(i))}</legend>
            ${desk?.slots.length ? '' : `<label>Format<select name="format-${i}" ${controls ? '' : 'disabled'}><option value="singles"${line.format === 'singles' ? ' selected' : ''}>Singles</option>
              <option value="doubles"${line.format === 'doubles' ? ' selected' : ''}>Doubles</option></select></label>`}
            <label>${individual?'Match outcome':'Court outcome'}<select name="outcome-${i}" data-court-outcome ${controls ? '' : 'disabled'}>
              <option value="played"${line.outcome==='played'?' selected':''}>Played</option>
              <option value="walkover"${line.outcome==='walkover'?' selected':''}>Walkover</option>
              <option value="retirement"${line.outcome==='retirement'?' selected':''}>Retirement</option></select></label>
            ${line.outcome==='played'?'':`<label>${individual?'Match winner':'Team awarded the court'}<select name="winner-${i}" required ${controls?'':'disabled'}>
              <option value="">${individual?'Choose player':'Choose team'}</option><option value="A"${line.winner==='A'?' selected':''}>${html(match.a)}</option>
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
        content += `<ol class="competition-standings league-score-lines">${card.lines.map((line, i) => `<li class="lineup-court">
          <strong>${html(slot(i))}</strong><p>${html(leagueCourtResultText(line))} · ${html(line.winner === 'A' ? match.a : match.b)}</p></li>`).join('')}</ol>`
      } else {
        content += desk.canReview ? individual ? '<p>The players haven’t submitted a score yet.</p>' : '<p>The captains haven’t submitted a scorecard yet.</p>' :
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
    if (card && !editable && controls) {
      const next = document.createElement('div'); next.className = 'league-score-done-actions'
      next.innerHTML = (offerStandings && card.state === 'approved' ? '<button type="button" data-score-standings>View updated standings</button>' : '') +
        `<button type="button" ${card.state === 'approved' ? 'class="secondary" ' : ''}data-score-done>${queue && selected ? 'Return to score review' : backLabel === 'Back to match' ? 'Return to match' : backLabel === 'Back to follow-ups' ? 'Return to follow-ups' : 'Done'}</button>`
      dialog.append(next)
      next.querySelector<HTMLButtonElement>('[data-score-done]')!.onclick = back
      next.querySelector<HTMLButtonElement>('[data-score-standings]')?.addEventListener('click', () => {
        if (!active() || busy || pending) return
        dispose(); if (current()) closed(true, changed, 'standings')
      })
    }
    dialog.querySelector('[data-score-close]')?.addEventListener('click', back)
    dialog.querySelector('[data-score-refresh]')?.addEventListener('click', () => {if (edited && !pending) confirmDiscard(() => {void load()}); else void load()})
    dialog.querySelectorAll<HTMLButtonElement>('[data-score-match]').forEach(button => {
      button.onclick = () => { selected = button.dataset.scoreMatch!; void load() }
    })
    const fields = dialog.querySelector<HTMLFormElement>('[data-score-form]')
    fields?.addEventListener('input', () => {edited = true})
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
      edited = true
      remember(); render(); dialog.querySelector<HTMLElement>('[name="'+name+'"]')?.focus({preventScroll:true})
    })
    dialog.querySelector('[data-score-add]')?.addEventListener('click', () => {
      remember(); draft.push(blankLine('doubles')); edited = true; render()
      dialog.querySelector<HTMLElement>('[name="format-'+(draft.length-1)+'"]')?.focus()
    })
    dialog.querySelectorAll<HTMLButtonElement>('[data-score-remove]').forEach(button => {
      button.onclick = () => { remember(); draft.splice(Number(button.dataset.scoreRemove), 1); edited = true; render(true) }
    })
    dialog.querySelector('[data-score-approve]')?.addEventListener('click', () => commit('approve'))
    dialog.querySelector('[data-score-return]')?.addEventListener('click', () => {
      returning = true; render(); dialog.querySelector<HTMLElement>('[name="note"]')?.focus()
    })
    dialog.querySelector('[data-score-keep]')?.addEventListener('click', () => { returning = false; render(true) })
    dialog.querySelector<HTMLFormElement>('[data-score-return-form]')?.addEventListener('submit', event => {
      event.preventDefault(); note = String(new FormData(event.currentTarget as HTMLFormElement).get('note') ?? ''); commit('return')
    })
    dialog.querySelector<HTMLTextAreaElement>('[name="note"]')?.addEventListener('input', event => {note = (event.currentTarget as HTMLTextAreaElement).value; edited = true})
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
