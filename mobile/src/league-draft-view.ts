import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCalendarDay, isValidCalendarDate } from '../../lib/calendar-date'
import { competitionFeeLabel } from '../../lib/first-party-competition-prices'
import { nativeCompetitionTimeZones } from '../../lib/native-competition-time-zones'
import {
  leagueDraftFormats, leagueDraftMaxWeeks, readLeagueDraft, readSavedLeagueDraft,
  type LeagueDraft, type LeagueDraftWrite,
} from '../../lib/native-league-draft-contract'
import { calculateTiqLeagueEndsOn } from '../../lib/tiq-league-limits'
import { scenarioOwner } from './captain-scenarios-data'
import { mountCompetitionPublish } from './competition-publish'
import { html } from './match-details'

const zoneOptions: Record<string, string> = nativeCompetitionTimeZones
const weekLabel = (weeks: number) => weeks === 1 ? '1 week' : `${weeks} weeks`

function endDateLabel(startsOn: string, weeks: number) {
  if (!isValidCalendarDate(startsOn)) return ''
  const date = calculateTiqLeagueEndsOn(startsOn, weeks)
  return isValidCalendarDate(date) ? formatCalendarDay(date) : ''
}

export function openLeagueDraft(client: SupabaseClient, owner: string, current: () => boolean, trigger: HTMLElement, onPublished: (id:string)=>void) {
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog competitions-dialog league-entry-dialog tournament-entry-dialog'
  dialog.setAttribute('aria-labelledby', 'league-draft-title')

  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const empty: LeagueDraft = {
    name: '', location: '', format: 'team', startsOn: '', weeks: leagueDraftMaxWeeks,
    timeZone: Object.hasOwn(zoneOptions, localZone) ? localZone : '',
  }
  let draft = empty
  let revision: string | null = null
  let pending: LeagueDraftWrite | null = null
  let state: 'loading' | 'edit' | 'saved' | 'error' = 'loading'
  let busy = false
  let stale = false
  let notice = ''
  let disposed = false
  let disposeCheckout: ReturnType<typeof mountCompetitionPublish>
  const active = () => !disposed && current()

  function dispose() {
    disposed = true
    disposeCheckout?.()
    dialog.remove()
  }

  function back() {
    if (busy && pending) return true
    dispose()
    if (current() && trigger.isConnected) trigger.focus({ preventScroll: true })
    return true
  }

  async function request(write?: LeagueDraftWrite) {
    const session = await scenarioOwner(client, owner, active)
    const result = await CapacitorHttp.request({
      url: 'https://www.tenaceiq.com/api/mobile/first-party/leagues/draft',
      method: write ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + session.access_token, 'Cache-Control': 'no-store',
        ...(write ? { 'Content-Type': 'application/json' } : {}) },
      ...(write ? { data: write } : {}),
      webFetchExtra: { cache: 'no-store' }, disableRedirects: true, responseType: 'json',
      connectTimeout: 12000, readTimeout: 15000,
    })
    await scenarioOwner(client, owner, active)
    const data = result.data
    if (write && result.status === 409 && data?.scope === 'first-party' && data.code === 'stale') return null
    if (write && result.status === 409 && data?.scope === 'first-party' && data.code === 'checkout_pending') {
      throw Error('checkout_pending')
    }
    if (result.status !== 200 || data?.scope !== 'first-party' || data.ok !== true || data.owner !== owner) {
      throw Error('League draft unavailable.')
    }
    return data.saved === null ? { saved: null } : { saved: readSavedLeagueDraft(data.saved) }
  }

  async function load() {
    state = 'loading'
    notice = ''
    render()
    try {
      const result = await request()
      if (!active() || !result) return
      pending = null
      stale = false
      revision = result.saved?.revision ?? null
      if (result.saved) draft = result.saved.draft
      state = result.saved ? 'saved' : 'edit'
    } catch {
      state = 'error'
      notice = 'Couldn’t load your league draft.'
    } finally {
      if (active()) render(true)
    }
  }

  async function save(write: LeagueDraftWrite) {
    pending = write
    busy = true
    notice = ''
    render()
    try {
      const result = await request(write)
      if (!active()) return
      if (!result) {
        stale = true
        notice = 'Your draft changed on another device. Open the latest draft to continue.'
        return
      }
      if (result.saved?.revision !== write.revision) throw Error('League draft save not confirmed.')
      draft = result.saved.draft
      revision = result.saved.revision
      pending = null
      state = 'saved'
    } catch (error) {
      stale = error instanceof Error && error.message === 'checkout_pending'
      notice = stale ? 'Check your purchase before changing the saved draft.' :
        'Couldn’t confirm the save. Try again to save the same draft.'
    } finally {
      busy = false
      if (active()) render(true)
    }
  }

  function fields() {
    const lastDay = endDateLabel(draft.startsOn, draft.weeks)
    return `<form data-league-draft-form>
      <fieldset class="entry-fields"${pending ? ' disabled' : ''}><legend>Season details</legend>
        <label>League name<input name="name" required maxlength="100" value="${html(draft.name)}"></label>
        <label>Format<select name="format">${Object.entries(leagueDraftFormats).map(([value, label]) =>
          `<option value="${value}"${draft.format === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>City or club (optional)<input name="location" maxlength="120" value="${html(draft.location)}"></label>
        <label>Time zone<select name="timeZone" required>
          <option value="">Choose a time zone</option>
          ${Object.entries(zoneOptions).map(([value, label]) =>
            `<option value="${value}"${draft.timeZone === value ? ' selected' : ''}>${label}</option>`).join('')}
        </select></label>
        <label>First day<input name="startsOn" type="date" required max="9999-12-31" value="${html(draft.startsOn)}"></label>
        <label>Season length<select name="weeks" aria-describedby="league-draft-end-date">
          ${Array.from({ length: leagueDraftMaxWeeks }, (_, index) => index + 1).map(weeks =>
            `<option value="${weeks}"${weeks === draft.weeks ? ' selected' : ''}>${weekLabel(weeks)}</option>`).join('')}
        </select></label>
        <p id="league-draft-end-date" aria-live="polite">${lastDay ? 'Last day: ' + html(lastDay) : 'Choose the first day to see when your season ends.'}</p>
      </fieldset>
      ${pending ? '' : '<button type="submit">Save private draft</button>'}
    </form>`
  }

  function render(focus = false) {
    disposeCheckout?.()
    disposeCheckout = undefined
    const title = state === 'saved' ? 'League draft saved' : 'Set up a league'
    dialog.innerHTML = `<header class="competition-header">
        <button type="button" class="secondary" data-league-draft-close${busy ? ' disabled' : ''}>Back to Compete</button>
      </header>
      <div class="competition-hero entry-hero">
        <h2 tabindex="-1" id="league-draft-title">${title}</h2>
        <p>Drafts are free. Publishing will cost ${competitionFeeLabel('league')} per season (up to ${leagueDraftMaxWeeks} weeks).</p>
      </div>
      ${state === 'loading' ? '<p role="status">Loading league draft…</p>' : ''}
      ${state === 'edit' ? fields() : ''}
      ${state === 'saved' ? `<section class="entry-receipts" aria-label="Private season">
        <article>
          <small data-league-status>Private draft</small><strong>${html(draft.name)}</strong>
          <p>${leagueDraftFormats[draft.format]}${draft.location ? ' · ' + html(draft.location) : ''}</p>
          <p>${weekLabel(draft.weeks)} · ${html(zoneOptions[draft.timeZone])} time<br>
            ${html(formatCalendarDay(draft.startsOn))} – ${html(endDateLabel(draft.startsOn, draft.weeks))}</p>
          <button type="button" class="secondary" data-league-draft-edit>Edit draft</button>
          <button type="button" class="secondary" data-league-draft-new hidden>Set up another season</button>
        </article></section><div data-league-checkout></div>` : ''}
      ${busy ? '<p role="status">Saving your draft…</p>' : ''}
      <p role="alert" tabindex="-1" data-league-draft-error${notice ? '' : ' hidden'}>${html(notice)}</p>
      ${state === 'error' || stale ? `<button type="button" data-league-draft-reload>${stale ? 'Open latest draft' : 'Try again'}</button>` : ''}
      ${pending && !busy && !stale && state === 'edit' ? '<button type="button" data-league-draft-retry>Retry save</button>' : ''}`

    dialog.querySelector('[data-league-draft-close]')?.addEventListener('click', back)
    dialog.querySelector('[data-league-draft-reload]')?.addEventListener('click', () => { void load() })
    dialog.querySelector('[data-league-draft-retry]')?.addEventListener('click', () => {
      if (pending && !busy && active()) void save(pending)
    })
    const edit = dialog.querySelector<HTMLButtonElement>('[data-league-draft-edit]')
    edit?.addEventListener('click', () => {
      state = 'edit'
      render(true)
    })
    const checkoutHost = dialog.querySelector<HTMLElement>('[data-league-checkout]')
    const newSeason = dialog.querySelector<HTMLButtonElement>('[data-league-draft-new]')
    newSeason?.addEventListener('click', () => {
      draft = empty
      state = 'edit'
      render(true)
    })
    if (checkoutHost && revision) {
      disposeCheckout = mountCompetitionPublish('league', checkoutHost, client, owner, revision, revision,
        active, options => CapacitorHttp.request(options), id => {
          dispose()
          if (current()) onPublished(id)
        }, (locked, published, canStartAnother) => {
          if (edit) { edit.disabled = locked; edit.hidden = published || canStartAnother }
          if (newSeason) newSeason.hidden = !canStartAnother
          const label = dialog.querySelector('[data-league-status]')
          const heading = dialog.querySelector('#league-draft-title')
          if (label) label.textContent = published ? 'Published season' : canStartAnother ? 'Closed season' : 'Private draft'
          if (heading && published) heading.textContent = 'League published'
          dialog.querySelector('section.entry-receipts')?.setAttribute('aria-label', published ? 'Published season' : 'Private season')
        })
    }
    const form = dialog.querySelector<HTMLFormElement>('[data-league-draft-form]')
    form?.addEventListener('input', (event) => {
      const name = (event.target as HTMLInputElement).name
      if (name !== 'startsOn' && name !== 'weeks') return
      const values = new FormData(form)
      const lastDay = endDateLabel(String(values.get('startsOn')), Number(values.get('weeks')))
      const endDate = form.querySelector('#league-draft-end-date')
      if (endDate) endDate.textContent = lastDay ? 'Last day: ' + lastDay : 'Choose the first day to see when your season ends.'
    })
    form?.addEventListener('submit', (event) => {
      event.preventDefault()
      if (!active() || pending) return
      const values = Object.fromEntries(new FormData(form))
      try {
        draft = readLeagueDraft({ ...values, weeks: Number(values.weeks) })
        void save({ draft, expected: revision, revision: crypto.randomUUID() })
      } catch (error) {
        const feedback = dialog.querySelector<HTMLElement>('[data-league-draft-error]')
        if (feedback) {
          feedback.hidden = false
          feedback.textContent = error instanceof Error ? error.message : 'Check your season details.'
          feedback.focus()
        }
      }
    })
    if (focus) dialog.querySelector<HTMLElement>(notice ? '[data-league-draft-error]' : '#league-draft-title')?.focus()
  }

  dialog.addEventListener('cancel', (event) => { event.preventDefault(); back() })
  document.body.append(dialog)
  void load()
  dialog.showModal()
  dialog.querySelector<HTMLElement>('#league-draft-title')?.focus()
  return { dispose, back, isOpen: () => dialog.open && !disposed }
}
