import type { SupabaseClient } from '@supabase/supabase-js'
import { courtNumber, courtScorecardKey, readCourtSubmission, type CourtDesk, type CourtMember, type CourtSubmission } from '../../lib/native-court-result-contract'
import { inferTiqBestOfThreeWinner } from '../../lib/tiq-scoring'
import { CourtRequestError, postCourt, readCourtDesk } from './captain-court-data'
import { html } from './match-details'
import type { CalendarScorecardSeed } from './personal-match-data'
import { matchDate } from './recent-results'

function playerOptions(members: CourtMember[]) {
  return '<option value="">Choose player</option>' + members.map(member =>
    `<option value="${html(member.id)}">${html(member.name)} · ${html(member.id.slice(-6).toUpperCase())}</option>`).join('')
}

export function openCaptainCourtScores(client: SupabaseClient, owner: string, current: () => boolean, trigger: HTMLButtonElement,
  context: { league: string; fixture: string }, openPersonal?: (seed: CalendarScorecardSeed) => void) {
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog'
  dialog.setAttribute('aria-label', 'Court scores')
  let disposed = false, loading = false, posting = false, desk: CourtDesk | undefined, selected = 1, notice = ''
  const active = () => !disposed && current()
  const focus = () => dialog.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  function dispose() {
    if (disposed) return
    disposed = true
    dialog.remove()
    if (current() && trigger.isConnected) trigger.focus({ preventScroll: true })
  }
  function back() { if (!posting) dispose(); return true }

  function paint() {
    if (!active()) return
    const saved = desk?.courts.find(row => row.court === selected)
    dialog.innerHTML = `<h2 tabindex="-1">Court scores</h2>${desk ? `<h3>${html(desk.teamA)} vs ${html(desk.teamB)}</h3>
      <p>${html(matchDate(desk.date))}</p>
      <form data-court-form>
        <label for="court-number">Court number</label><select id="court-number" name="court">${Array.from({ length: 30 }, (_, n) =>
          `<option value="${n + 1}">${n + 1}${desk!.courts.some(row => row.court === n + 1) ? ' · posted' : ''}</option>`).join('')}</select>
        ${desk.captain ? `<fieldset><legend>Players and result</legend>
          <label for="court-format">Format</label><select id="court-format" name="format"><option value="singles">Singles</option><option value="doubles">Doubles</option></select>
          <label for="court-a1">${html(desk.teamA)} player 1</label><select id="court-a1" name="a1" required>${playerOptions(desk.membersA)}</select>
          <div data-second-player><label for="court-a2">${html(desk.teamA)} player 2</label><select id="court-a2" name="a2">${playerOptions(desk.membersA)}</select></div>
          <label for="court-b1">${html(desk.teamB)} player 1</label><select id="court-b1" name="b1" required>${playerOptions(desk.membersB)}</select>
          <div data-second-player><label for="court-b2">${html(desk.teamB)} player 2</label><select id="court-b2" name="b2">${playerOptions(desk.membersB)}</select></div>
          <label>Set scores (${html(desk.teamA)} first)<input name="score" required maxlength="64" placeholder="6-4 6-3"></label>
          <label for="court-winner">Winning team</label><select id="court-winner" name="winner" required><option value="">Choose winner</option><option value="A">${html(desk.teamA)}</option><option value="B">${html(desk.teamB)}</option></select>
          </fieldset><button type="submit" data-post-court>${saved ? 'Update court score' : 'Post court score'}</button>` : ''}
        ${openPersonal ? '<button type="button" class="secondary" data-personal-court>Log my score in My Lab</button>' : ''}
      </form>` : ''}
      <p role="status" data-court-status>${html(notice)}</p>
      <button type="button" class="secondary" data-court-reload ${loading ? 'disabled' : ''}>Reload court scores</button>
      <button type="button" class="secondary" data-court-close>Back to schedule</button>`
    const close = dialog.querySelector<HTMLButtonElement>('[data-court-close]')!
    const reload = dialog.querySelector<HTMLButtonElement>('[data-court-reload]')!
    close.onclick = back
    reload.onclick = () => { void load() }
    if (!desk) return
    const form = dialog.querySelector<HTMLFormElement>('form')!
    const field = (key: string) => form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement
    const feedback = dialog.querySelector<HTMLElement>('[data-court-status]')!
    const number = field('court')
    number.value = String(selected)
    number.onchange = () => { selected = Number(number.value); notice = ''; paint(); dialog.querySelector<HTMLElement>('#court-number')?.focus() }
    const personal = form.querySelector<HTMLButtonElement>('[data-personal-court]')
    if (personal) personal.onclick = () => {
      if (!active() || !desk || !courtNumber(selected) || !openPersonal) return
      const seed: CalendarScorecardSeed = { calendarMatchId: courtScorecardKey(desk.league, desk.fixture, selected),
        date: desk.date, opponent: (desk.side === 'A' ? desk.teamB : desk.teamA).slice(0, 100), format: saved?.format }
      dispose()
      openPersonal(seed)
    }
    if (!desk.captain) return
    const format = field('format')
    const showSecond = () => {
      form.querySelectorAll<HTMLElement>('[data-second-player]').forEach(section => { section.hidden = format.value !== 'doubles' })
      for (const key of ['a2', 'b2']) field(key).required = format.value === 'doubles'
    }
    for (const [key, value] of Object.entries({ format: saved?.format ?? 'singles', a1: saved?.a[0] ?? '', a2: saved?.a[1] ?? '',
      b1: saved?.b[0] ?? '', b2: saved?.b[1] ?? '', winner: saved?.winner ?? '', score: saved?.score ?? '' })) field(key).value = value
    format.onchange = showSecond
    showSecond()
    const score = field('score')
    const winner = field('winner')
    let winnerWasInferred = false
    score.oninput = () => {
      const next = inferTiqBestOfThreeWinner(score.value)
      if (next || winnerWasInferred) winner.value = next ?? ''
      winnerWasInferred = Boolean(next)
    }
    winner.onchange = () => { winnerWasInferred = false }
    let pending: CourtSubmission | undefined
    const post = form.querySelector<HTMLButtonElement>('[data-post-court]')!
    form.onsubmit = async event => {
      event.preventDefault()
      if (!active() || !desk || posting) return
      try {
        const doubles = format.value === 'doubles'
        pending ??= readCourtSubmission({ court: selected, format: format.value, a: [field('a1').value, ...(doubles ? [field('a2').value] : [])],
          b: [field('b1').value, ...(doubles ? [field('b2').value] : [])], score: score.value, winner: winner.value,
          revision: crypto.randomUUID(), expected: saved?.revision ?? null })
      } catch (error) { feedback.textContent = error instanceof Error ? error.message : 'Check the court details.'; return }
      posting = close.disabled = post.disabled = reload.disabled = number.disabled = true
      if (personal) personal.disabled = true
      form.querySelector('fieldset')!.disabled = true
      feedback.textContent = 'Posting this court score…'
      try {
        const result = await postCourt(client, owner, active, context, pending)
        if (!active()) return
        desk.courts = [...desk.courts.filter(row => row.court !== result.court), result]
        notice = 'Score posted to the confirmed players’ match logs.'
        paint()
        focus()
      } catch (error) {
        if (!active()) return
        const conflict = error instanceof CourtRequestError && error.status < 500
        feedback.textContent = conflict ? error.message : 'Post unconfirmed. Retry this same court score or reload court scores.'
        post.disabled = conflict
        post.textContent = 'Retry court score'
      } finally {
        posting = false
        if (active()) close.disabled = reload.disabled = false
      }
    }
  }

  async function load() {
    if (!active() || loading || posting) return
    loading = true
    desk = undefined
    notice = 'Checking the fixture and team rosters…'
    paint()
    try { desk = await readCourtDesk(client, owner, active, context); notice = '' }
    catch (error) { notice = error instanceof CourtRequestError ? error.message : 'Court scores are unavailable. Reload to try again.' }
    finally { loading = false; if (active()) { paint(); focus() } }
  }
  dialog.oncancel = event => { event.preventDefault(); back() }
  document.body.append(dialog)
  dialog.showModal()
  void load()
  return { dispose, back, isOpen: () => !disposed }
}
