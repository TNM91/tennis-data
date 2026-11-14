import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  defaultLeagueMatchDuration, leaguePostponement, leagueScheduleChange, readLeagueScheduleReview, readScheduledLeagueMatch,
  validateLeagueScheduleSlot, type LeaguePostponement, type LeagueScheduleChange, type LeagueScheduleReview, type LeagueScheduleSlot,
} from '../../lib/native-league-schedule-contract'
import { leagueAttentionFixture } from '../../lib/native-league-attention-contract'
import { formatCalendarDay } from '../../lib/calendar-date'
import { formatCaptainPracticeTime } from '../../lib/captain-practice-invite'
import { scenarioOwner, type ScenarioSend } from './captain-scenarios-data'
import { competitionScheduleClock } from './competition-match-card'
import { html } from './match-details'

type EditableMatch = LeagueScheduleReview['matches'][number]
type Fields = LeagueScheduleSlot & { a: string; b: string; notify: boolean }
type Receipt = { match: ReturnType<typeof readScheduledLeagueMatch>; notified: number; unreachable: number }
const durations = [30, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360]

export function openLeagueSchedule(
  client: SupabaseClient, owner: string, current: () => boolean, leagueId: string,
  close: (matchId?: string, refresh?: boolean) => void, send: ScenarioSend = options => CapacitorHttp.request(options),
  matchId = '', manage = false, postpone = false,
) {
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog competitions-dialog league-entry-dialog league-scheduler'
  dialog.setAttribute('aria-labelledby', 'league-scheduler-title')
  let disposed = false, busy = false, uncertain = false
  let review: LeagueScheduleReview | null = null, selected: EditableMatch | undefined
  let mode: 'list' | 'edit' | 'review' | 'postpone' | 'saved' = manage ? 'list' : 'edit'
  let fields: Fields | null = null, change: LeagueScheduleChange | LeaguePostponement | null = null, receipt: Receipt | null = null
  let notice = 'Loading the league schedule…'
  const active = () => !disposed && current()
  const dispose = () => { disposed = true; dialog.remove() }
  const exit = () => {
    const id = receipt?.match.id
    dispose()
    if (current()) close(id, uncertain)
  }
  const back = () => {
    if (busy) return true
    if (mode === 'review' && !uncertain) { mode = 'edit'; notice = ''; render(true) }
    else exit()
    return true
  }

  async function request(input?: LeagueScheduleChange | LeaguePostponement) {
    const session = await scenarioOwner(client, owner, active)
    const url = 'https://www.tenaceiq.com/api/mobile/first-party/competitions/schedule'
    const response = await send({
      url: input ? url : url + '?' + new URLSearchParams({ league: leagueId }),
      method: input ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + session.access_token,
        'Cache-Control': 'no-store', 'X-TenAceIQ-League-Postpone': '1', ...(input ? { 'Content-Type': 'application/json' } : {}) },
      ...(input ? { data: input } : {}), disableRedirects: true, responseType: 'json',
      webFetchExtra: { cache: 'no-store' }, connectTimeout: 12000, readTimeout: 30000,
    })
    await scenarioOwner(client, owner, active)
    const data = response.data
    if (data?.releaseScope !== 'first-party') throw Error('The league schedule couldn’t be confirmed.')
    return { status: response.status, data }
  }

  function edit(match?: EditableMatch) {
    if (!review) return
    selected = match
    const day = competitionScheduleClock(review.zone).day
    const duration = match?.duration ?? defaultLeagueMatchDuration(review.format)
    const venueId = match?.venueId || review.venues.find(venue =>
      match?.facility === venue.name || match?.facility === venue.name + ' — ' + venue.detail)?.id
    const defaultDay = review.startsOn > day ? review.startsOn : day
    fields = {
      a: match?.aId || '', b: match?.bId || '', date: match?.status === 'postponed' ? '' : match?.date || defaultDay,
      time: match?.time || review.defaultTime, venueId: venueId || (match ? '' : review.defaultVenueId),
      court: match?.court || '', duration, notify: true,
    }
    mode = 'edit'
    notice = ''
    render(true)
  }

  function preparePostponement(match: EditableMatch) {
    selected = match
    change = leaguePostponement({ action: 'postpone', leagueId, requestId: crypto.randomUUID(), matchId: match.id,
      version: match.version, fixture: leagueAttentionFixture(match) })
    mode = 'postpone'
    notice = ''
    render(true)
  }

  function upcoming(match: EditableMatch) {
    if (!review) return false
    const now = competitionScheduleClock(review.zone)
    return match.date > now.day || match.date === now.day && match.time > now.time
  }

  async function load() {
    if (!active() || busy) return
    busy = true
    notice = 'Loading the league schedule…'
    render()
    try {
      const { status, data } = await request()
      if (status !== 200) throw Error(data.message || 'The league schedule couldn’t load.')
      review = readLeagueScheduleReview(data, owner, leagueId)
      notice = ''
    } catch (error) {
      notice = error instanceof Error ? error.message : 'The league schedule couldn’t load.'
    } finally {
      if (active()) {
        busy = false
        if (review && !manage) {
          const match = matchId ? review.matches.find(match => match.id === matchId) : undefined
          if (matchId && (!match || (postpone && !match.canPostpone) ||
              (!postpone && match.status !== 'postponed' && !upcoming(match)))) {
            mode = 'list'
            notice = postpone ? 'This match can no longer be postponed. Check the schedule and any recorded scores.' :
              'This match can no longer be rescheduled.'
            render(true)
          }
          else if (postpone && match) preparePostponement(match)
          else edit(match)
        } else render(true)
      }
    }
  }

  async function save() {
    if (!active() || busy || !change) return
    busy = true
    const postponing = 'action' in change
    notice = postponing ? 'Postponing the match…' : 'Saving the match…'
    render()
    try {
      const { status, data } = await request(change)
      if (status !== 200 && status < 500) {
        uncertain = false
        mode = postponing ? 'list' : 'edit'
        if (postponing) review = null
        notice = data.message || 'Check the match details and try again.'
        if (status === 409 && /refresh/i.test(notice)) notice += ' Reopen the match to load the latest records.'
        return
      }
      if (status !== 200 || data.ok !== true || data.owner !== owner || data.leagueId !== leagueId || data.requestId !== change.requestId ||
          !Number.isSafeInteger(data.notified) || data.notified < 0 || ![0, 1, 2].includes(data.unreachable)) {
        throw Error('Match save could not be confirmed')
      }
      const match = readScheduledLeagueMatch(data.match)
      if ((change.matchId && match.id !== change.matchId) ||
          ('action' in change ? match.status !== 'postponed' : match.status !== 'coordinator_set' || match.date !== change.date ||
          match.time !== change.time || match.court !== change.court || match.duration !== change.duration)) throw Error('Match receipt changed')
      receipt = { match, notified: data.notified, unreachable: data.unreachable }
      uncertain = false
      mode = 'saved'
      notice = ''
    } catch {
      uncertain = true
      notice = 'The save couldn’t be confirmed. Retry the same change to check its status.'
    } finally {
      if (active()) { busy = false; render(true) }
    }
  }

  function reviewForm(form: HTMLFormElement) {
    if (!review || !fields) return
    const data = new FormData(form)
    const get = (name: string) => String(data.get(name) ?? '')
    fields = { a: selected?.aId || get('a'), b: selected?.bId || get('b'), date: get('date'), time: get('time'),
      venueId: get('venueId'), court: get('court'), duration: Number(get('duration')), notify: selected?.status === 'postponed' || data.has('notify') }
    try {
      change = leagueScheduleChange({ ...fields, leagueId, requestId: crypto.randomUUID(),
        matchId: selected?.id ?? null, version: selected?.version ?? '' })
      validateLeagueScheduleSlot(change, review)
      mode = 'review'
      notice = ''
      render(true)
    } catch (error) {
      notice = error instanceof Error ? error.message : 'Check the match details.'
      const status = dialog.querySelector<HTMLElement>('[data-schedule-status]')
      if (status) { status.textContent = notice; status.focus() }
    }
  }

  function render(focus = false) {
    if (!active()) return
    const noun = review?.format === 'team' ? 'team' : 'player'
    const recipient = review?.format === 'team' ? 'captains or team contacts' : 'players'
    const postponing = change && 'action' in change
    const title = mode === 'postpone' ? 'Postpone match' : mode === 'saved' ? postponing ? 'Match postponed' : selected ? 'Match rescheduled' : 'Match scheduled' :
      mode === 'review' ? 'Review match' : mode === 'list' ? 'Manage schedule' : selected ? 'Reschedule match' : 'Schedule match'
    const f = fields
    const option = (id: string, label: string, value: string) =>
      `<option value="${html(id)}"${id === value ? ' selected' : ''}>${html(label)}</option>`
    const choices = (name: 'a' | 'b', label: string, value: string) =>
      `<label>${label}<select name="${name}" required><option value="">Choose a ${noun}</option>${
        review?.entries.map(entry => option(entry.id, entry.name, value)).join('') ?? ''}</select></label>`
    const pair = (a: string, b: string) => `<strong>${html(a)} <span class="fixture-versus">vs</span> ${html(b)}</strong>`
    const summary = (a: string, b: string, date: string, time: string, location: string, duration: number) =>
      `<div class="lineup-court league-scheduler-summary">${pair(a, b)}<p>${html(formatCalendarDay(date, false))} · ${html(formatCaptainPracticeTime(time))} · ${duration} min</p>
      <p>${html(location)}</p></div>`
    let content = ''
    if (!review && !busy) content = '<button type="button" data-schedule-load>Try again</button>'
    if (review && mode === 'list') {
      content = `<button type="button" data-schedule-add>Schedule match</button>
        <h3>Match scheduling</h3>${review.matches.filter(match=>match.status==='postponed'||upcoming(match)).map(match =>
          `<article class="lineup-court league-scheduler-summary">${pair(match.a, match.b)}
          <p>${match.status==='postponed'?'New date pending':html(formatCalendarDay(match.date, false)+' · '+formatCaptainPracticeTime(match.time))}</p>
          ${match.status==='postponed'?'':`<p>${html(match.facility)}</p>`}
          <button type="button" class="secondary" data-schedule-edit="${html(match.id)}">
          Reschedule<span class="sr-only"> ${html(match.a)} vs ${html(match.b)}</span></button></article>`).join('') ||
          '<p>No matches ready to reschedule.</p>'}`
    }
    if (review && mode === 'edit' && f) {
      if (review.entries.length < 2) content = `<p>Approve at least two ${noun}s before scheduling a match.</p>`
      else content = `<form data-schedule-form>
        ${selected ? `<div class="lineup-court league-scheduler-summary">${pair(selected.a, selected.b)}<p>${selected.status==='postponed'?'New date pending':
          html('Currently '+formatCalendarDay(selected.date, false)+' · '+formatCaptainPracticeTime(selected.time)+' · '+selected.facility)}</p></div>` :
          `<div class="league-scheduler-fields">${choices('a','Side A',f.a)}${choices('b','Side B',f.b)}</div>`}
        <div class="league-scheduler-fields">
          <label>Date<input name="date" type="date" required value="${html(f.date)}" min="${html(review.startsOn || competitionScheduleClock(review.zone).day)}"${review.endsOn ? ` max="${html(review.endsOn)}"` : ''}></label>
          <label>Start time<input name="time" type="time" required value="${html(f.time)}"></label>
        </div>
        <p class="rating-context">Times use ${html(review.zone.replaceAll('_', ' '))}.</p>
        <label>Venue<select name="venueId" required><option value="">Choose a venue</option>
          ${review.venues.map(venue => option(venue.id, venue.name, f.venueId)).join('')}</select></label>
        <p class="rating-context" data-schedule-address${f.venueId ? '' : ' hidden'}>${html(review.venues.find(venue => venue.id === f.venueId)?.detail || '')}</p>
        <div class="league-scheduler-fields">
          <label>Court <span class="rating-context">Optional</span><input name="court" maxlength="20" value="${html(f.court)}" placeholder="e.g. Indoor 2"></label>
          <label>Match length<select name="duration">${[...new Set([...durations, f.duration])].sort((a,b) => a-b)
            .map(duration => option(String(duration), duration + ' min', String(f.duration))).join('')}</select></label>
        </div>
        ${selected?.status === 'postponed' ? '<p class="rating-context">Both teams’ captains with schedule alerts on will get the new date in Updates.</p>' :
          `<label class="entry-check"><input type="checkbox" name="notify"${f.notify ? ' checked' : ''}><span>Notify affected ${recipient} in Updates</span></label>`}
        <button type="submit">Review match</button>
      </form>`
    }
    if (mode === 'postpone' && selected) {
      const priorSlot = [formatCalendarDay(selected.date, false), formatCaptainPracticeTime(selected.time), selected.facility].filter(Boolean).join(' · ')
      content = `<div class="lineup-court league-scheduler-summary">${pair(selected.a, selected.b)}<p>${html(priorSlot)}</p></div>` +
        `<p>Use this if the match hasn’t been played. It will show as New date pending, and both teams’ captains with schedule alerts on will get an update.</p>
        <button type="button" data-schedule-save${busy ? ' disabled' : ''}>${busy ? 'Postponing…' : uncertain ? 'Retry same change' : 'Confirm postponement'}</button>`
    }
    if (review && mode === 'review' && change && !('action' in change)) {
      const venueId = change.venueId
      const venue = review.venues.find(venue => venue.id === venueId)
      const location = [venue?.name, change.court ? 'Court ' + change.court : '', venue?.id === 'league-venue' ? '' : venue?.detail].filter(Boolean).join(' · ')
      const name = (id: string) => review?.entries.find(entry => entry.id === id)?.name || ''
      content = summary(name(change.a), name(change.b), change.date, change.time, location, change.duration) +
        `<p>${change.notify ? `The affected ${recipient} with alerts on will get an in-app update.` : 'Save to the league schedule without sending an update.'}</p>
          <button type="button" data-schedule-save${busy ? ' disabled' : ''}>${busy ? 'Saving…' : uncertain ? 'Retry same save' : selected ? 'Save reschedule' : 'Publish match'}</button>
          ${!uncertain ? `<button type="button" class="secondary" data-schedule-back${busy ? ' disabled' : ''}>Edit details</button>` : ''}`
    }
    if (receipt && mode === 'saved') {
      const { match, notified, unreachable } = receipt
      content = postponing ? `<div class="lineup-court league-scheduler-summary">${pair(match.a,match.b)}<p>New date pending</p></div>` :
        summary(match.a, match.b, match.date, match.time, match.facility, match.duration ?? 0)
      if (change && ('action' in change || change.notify)) content += `<p>${notified ? `Sent to ${notified} ${notified === 1 ? 'account' : 'accounts'} in Updates.` : 'No in-app updates were sent.'}
        ${unreachable ? ` ${unreachable === 1 ? 'One side needs' : 'Both sides need'} a separate heads-up.` : ''}</p>`
    }
    dialog.innerHTML = `<header class="competition-header"><button type="button" class="secondary" data-schedule-close${busy && (mode === 'review' || mode === 'postpone') ? ' disabled' : ''}>${postpone && mode !== 'saved' ? 'Back to league' : 'Back to schedule'}</button></header>
      <div class="entry-hero"><h2 id="league-scheduler-title" tabindex="-1">${title}</h2>${review ? `<p>${html(review.name)}</p>` : ''}</div>
      ${content}<p role="status" tabindex="-1" data-schedule-status>${html(notice)}</p>`
    dialog.querySelector('[data-schedule-close]')?.addEventListener('click', exit)
    dialog.querySelector('[data-schedule-load]')?.addEventListener('click', () => { void load() })
    dialog.querySelector('[data-schedule-add]')?.addEventListener('click', () => edit())
    dialog.querySelectorAll<HTMLButtonElement>('[data-schedule-edit]').forEach(button => {
      button.onclick = () => edit(review?.matches.find(match => match.id === button.dataset.scheduleEdit))
    })
    dialog.querySelector<HTMLFormElement>('[data-schedule-form]')?.addEventListener('submit', event => {
      event.preventDefault()
      reviewForm(event.currentTarget as HTMLFormElement)
    })
    const venue = dialog.querySelector<HTMLSelectElement>('[name="venueId"]')
    const address = dialog.querySelector<HTMLElement>('[data-schedule-address]')
    if (venue && address) venue.onchange = () => {
      address.textContent = review?.venues.find(item => item.id === venue.value)?.detail || ''
      address.hidden = !address.textContent
    }
    dialog.querySelector('[data-schedule-save]')?.addEventListener('click', () => { void save() })
    dialog.querySelector('[data-schedule-back]')?.addEventListener('click', back)
    if (focus) {
      dialog.scrollTop = 0
      dialog.querySelector<HTMLElement>(notice ? '[data-schedule-status]' : 'h2')?.focus()
    }
  }

  dialog.oncancel = event => { event.preventDefault(); back() }
  document.body.append(dialog)
  dialog.showModal()
  void load()
  return { isOpen: () => !disposed, back, dispose }
}
