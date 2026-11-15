import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatCalendarDay} from '../../lib/calendar-date'
import {competitionFeeLabel} from '../../lib/first-party-competition-prices'
import {getNativeAuthStorage} from '../../lib/native-auth-storage'
import {
  readSavedTournamentDraft, readTournamentDraft, tournamentDraftFormats, tournamentDraftRevision,
  type SavedTournamentDraft, type TournamentDraft,
} from '../../lib/native-tournament-draft-contract'
import {
  initialTournamentSettings, maxTournamentDivisions, readNativeTournamentSetup, readTournamentSettings,
  type NativeTournamentSetup, type TournamentSettings, type TournamentSettingsWrite,
} from '../../lib/native-tournament-setup-contract'
import {scenarioOwner, type ScenarioSend} from './captain-scenarios-data'
import {html} from './match-details'
import {openTournamentPlan} from './tournament-plan'
import {createTournamentPractice} from './tournament-practice'
import {mountCompetitionPublish} from './competition-publish'
import {readTournamentSetupFields, tournamentSetupFields, tournamentSetupSummary} from './tournament-setup-fields'

const storageKey = (owner: string) => 'tournament-draft:v1:' + owner
const empty: TournamentDraft = { name: '', date: '', venue: '', division: '', discipline: 'singles', format: 'single_elimination' }
type DraftWrite = { draft: TournamentDraft; expected: string | null; revision: string }

const browserStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  removeItem: (key: string) => localStorage.removeItem(key),
}

export async function clearTournamentDraft(owner: string) {
  await (getNativeAuthStorage() ?? browserStorage).removeItem(storageKey(owner))
}

export function openTournamentDraft(
  client: SupabaseClient, owner: string, current: () => boolean, onClose: () => void, trigger: HTMLElement,
  send: ScenarioSend = options => CapacitorHttp.request(options),
  onPublished: (id: string) => void = () => {},
) {
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog competitions-dialog league-entry-dialog tournament-entry-dialog'
  dialog.setAttribute('aria-labelledby', 'tournament-draft-title')
  let draft = empty
  let revision: string | null = null
  let pending: DraftWrite | null = null
  let stale = false
  let notice = ''
  let state: 'loading' | 'edit' | 'saved' | 'error' | 'desk' | 'event' | 'settings' = 'desk'
  let events: SavedTournamentDraft[] = []
  let nextPage: string | null = null
  let selected: NativeTournamentSetup | null = null
  let opening: SavedTournamentDraft | null = null
  let settings: TournamentSettings | null = null
  let settingsWrite: TournamentSettingsWrite | null = null
  let settingsStale = false
  let settingsSaved = false
  let planner: ReturnType<typeof openTournamentPlan> | null = null
  let disposePublish: ReturnType<typeof mountCompetitionPublish>
  let busy = false
  let disposed = false
  const active = () => !disposed && current()
  const dispose = () => {
    if (disposed) return
    disposed = true
    disposePublish?.()
    planner?.dispose()
    dialog.remove()
  }
  const back = () => {
    if (planner?.isOpen()) return planner.back()
    if (busy) return true
    if (state === 'settings' && selected) {
      void openSetup(selected)
      return true
    }
    if (state !== 'desk') {
      void loadDesk()
      return true
    }
    dispose()
    onClose()
    if (current() && trigger.isConnected) trigger.focus({preventScroll: true})
    return true
  }

  async function request(path: string, write?: DraftWrite | { revision: string } | TournamentSettingsWrite,
    method = write ? 'POST' : 'GET'): Promise<Record<string, unknown> | null> {
    const session = await scenarioOwner(client, owner, active)
    const result = await send({
      url: 'https://www.tenaceiq.com/api/mobile/first-party/tournaments/' + path,
      method,
      headers: { Authorization: 'Bearer ' + session.access_token, 'Cache-Control': 'no-store',
        ...(write ? { 'Content-Type': 'application/json' } : {}) },
      ...(write ? { data: write } : {}),
      webFetchExtra: { cache: 'no-store' }, disableRedirects: true, responseType: 'json',
      connectTimeout: 12000, readTimeout: 15000,
    })
    await scenarioOwner(client, owner, active)
    const data = result.data
    if (data?.scope !== 'first-party') throw Error('Tournament draft unavailable')
    if (write && result.status === 409 && data.code === 'stale') return null
    if (result.status !== 200 || data.ok !== true || data.owner !== owner) throw Error('Tournament draft unavailable')
    return data
  }

  async function loadDesk(after?: string) {
    if (!active() || busy) return
    state = 'desk'
    notice = ''
    selected = null
    busy = true
    if (!after) { events = []; nextPage = null }
    render()
    try {
      const data = await request(after ? 'desk?' + new URLSearchParams({ after }) : 'desk')
      if (!active()) return
      if (!Array.isArray(data?.events) || data.events.length > 20) throw Error('Tournament Desk unavailable')
      const page = data.events.map(readSavedTournamentDraft)
      const cursor = data.next
      if (cursor !== null && (!tournamentDraftRevision(cursor) || cursor !== page.at(-1)?.revision)) {
        throw Error('Invalid tournament page')
      }
      events = after ? [...events, ...page] : page
      nextPage = cursor
    } catch {
      if (active()) notice = 'Couldn’t load Tournament Desk. Try again.'
    } finally {
      busy = false
      if (active()) render(!after)
    }
  }

  async function prepare() {
    if (!active() || busy || !revision || state !== 'saved') return
    const source = revision
    busy = true
    notice = ''
    render()
    try {
      const data = await request('desk', { revision: source })
      if (!active()) return
      if (!data) {
        stale = true
        notice = 'This draft changed on another device. Open the latest draft to continue.'
        return
      }
      const event = readSavedTournamentDraft(data.event)
      if (event.revision !== source) throw Error('Tournament setup not confirmed')
      revision = null
      await openSetup(event)
    } catch {
      if (active()) notice = 'Couldn’t confirm the tournament setup. Try again to check the same draft.'
    } finally {
      busy = false
      if (active()) render(true)
    }
  }

  async function openSetup(event: SavedTournamentDraft) {
    opening = event
    state = 'event'
    selected = null
    settingsSaved = false
    notice = ''
    busy = true
    render()
    try {
      const data = await request('desk?' + new URLSearchParams({ event: event.revision }))
      if (!active()) return
      const setup = readNativeTournamentSetup(data?.setup)
      if (setup.revision !== event.revision) throw Error('Tournament changed')
      selected = setup
    } catch {
      if (active()) notice = 'Couldn’t load the tournament setup. Try again.'
    } finally {
      busy = false
      if (active()) render(true)
    }
  }

  async function saveSettings(write: TournamentSettingsWrite) {
    if (!active() || busy || state !== 'settings') return
    settings = write.settings
    settingsWrite = write
    busy = true
    notice = ''
    render()
    try {
      const data = await request('desk', write, 'PATCH')
      if (!active()) return
      if (!data) {
        settingsStale = true
        settingsWrite = null
        notice = 'Tournament settings changed on another device. Reload the saved settings before editing again.'
        return
      }
      const setup = readNativeTournamentSetup(data.setup)
      if (setup.revision !== write.event || setup.settingsRevision !== write.revision ||
          JSON.stringify(setup.settings) !== JSON.stringify(write.settings)) throw Error('Save not confirmed')
      selected = setup
      settingsWrite = null
      state = 'event'
      settingsSaved = true
    } catch {
      if (active()) notice = 'Couldn’t confirm the settings save. Retry to check the same changes.'
    } finally {
      busy = false
      if (active()) render(true)
    }
  }

  async function load() {
    if (!active() || busy) return
    busy = true
    notice = ''
    state = 'loading'
    render()
    try {
      const result = await request('draft')
      if (!active()) return
      const saved = result?.saved === null ? null : readSavedTournamentDraft(result?.saved)
      if (saved) {
        draft = saved.draft
        revision = saved.revision
        state = 'saved'
      } else {
        const expected = result?.expected
        if (tournamentDraftRevision(expected)) {
          draft = empty
          revision = expected
        } else {
          const stored = await (getNativeAuthStorage() ?? browserStorage).getItem(storageKey(owner))
          if (!active()) return
          draft = stored ? readTournamentDraft(JSON.parse(stored)) ?? empty : empty
          revision = null
        }
        state = 'edit'
      }
      stale = false
      pending = null
    } catch {
      if (active()) state = 'error'
    } finally {
      busy = false
      if (active()) render(true)
    }
  }

  async function save(write: DraftWrite) {
    draft = write.draft
    pending = write
    busy = true
    notice = ''
    render()
    try {
      const result = await request('draft', write)
      if (!active()) return
      if (!result) {
        stale = true
        pending = null
        notice = 'This draft changed on another device. Open the saved version before editing again.'
        return
      }
      const saved = readSavedTournamentDraft(result.saved)
      if (saved.revision !== write.revision ||
          JSON.stringify(saved.draft) !== JSON.stringify(write.draft)) throw Error('Save not confirmed')
      revision = saved.revision
      pending = null
      state = 'saved'
      void clearTournamentDraft(owner).catch(() => {})
    } catch {
      if (active()) notice = 'Couldn’t confirm the save. Retry to check the same draft.'
    } finally {
      busy = false
      if (active()) render(true)
    }
  }

  function render(focus = false) {
    disposePublish?.()
    disposePublish = undefined
    // This ID namespace is reserved for private, expiring TestFlight events.
    const rehearsal = selected?.publicId?.startsWith('tiq-native-event-74697166-6c74-4e10-8f11-')
    const title = state === 'desk' ? 'Tournament Desk' : state === 'settings' ? 'Divisions and registration' :
      state === 'event' ? opening?.draft.name :
      state === 'saved' ? 'Tournament draft' : 'Set up a tournament'
    const options = Object.entries(tournamentDraftFormats).map(([value, label]) =>
      `<option value="${value}"${draft.format === value ? ' selected' : ''}>${label}</option>`).join('')
    const readOnly = busy || pending !== null || stale
    dialog.innerHTML = `<header class="competition-header"><button type="button" class="secondary" data-draft-back${busy ? ' disabled' : ''}>${state === 'desk' ? 'Back to tournaments' : state === 'settings' ? 'Back to tournament' : 'Back to Tournament Desk'}</button></header>
      <div class="competition-hero entry-hero"><h2 tabindex="-1" id="tournament-draft-title">${html(title ?? '')}</h2>
        <p data-draft-subtitle>${state === 'event' ? rehearsal ? 'Private TestFlight event' : selected?.publicId ? 'Published tournament' : 'Private tournament' : state === 'settings' ? html(selected?.draft.name ?? '') :
          `Save a draft for free. Publishing a tournament costs ${competitionFeeLabel('tournament')} per event.`}</p></div>
      ${state === 'desk' ? `<button type="button" data-draft-start${busy ? ' disabled' : ''}>Set up a tournament</button>
        ${typeof TIQ_TOURNAMENT_PRACTICE !== 'undefined' && TIQ_TOURNAMENT_PRACTICE ?
          `<button type="button" class="secondary" data-desk-practice${busy ? ' disabled' : ''}>Practice a tournament</button>` : ''}
        ${events.length ? `<section class="entry-receipts" aria-label="Your tournaments">${events.map((event, index) => `<article>
          <strong>${html(event.draft.name)}</strong><p>${html(formatCalendarDay(event.draft.date))} · ${html(event.draft.venue)}</p>
          <button type="button" class="secondary" data-draft-event="${index}"${busy ? ' disabled' : ''}>Open tournament<span class="sr-only"> ${html(event.draft.name)}</span></button>
        </article>`).join('')}</section>` : busy || notice ? '' : '<p>Your tournaments will appear here.</p>'}
        ${busy ? '<p role="status">Loading tournaments…</p>' : ''}
        ${nextPage ? `<button type="button" class="secondary" data-desk-more${busy ? ' disabled' : ''}>Show more</button>` : ''}
        ${notice && !nextPage ? '<button type="button" class="secondary" data-desk-retry>Try again</button>' : ''}
      ` : ''}
      ${state === 'event' ? selected ? `${settingsSaved ? '<p role="status">Tournament settings saved.</p>' : ''}
        <button type="button" data-tournament-plan${selected.publicId ? '' : ' hidden'}>Draw &amp; courts</button>
        ${tournamentSetupSummary(selected)}<div data-tournament-publish></div>` :
        busy ? '<p role="status">Loading tournament setup…</p>' : '<button type="button" data-setup-reload>Try again</button>' : ''}
      ${state === 'settings' && settings && selected ? `<form data-setup-settings>
        ${tournamentSetupFields(settings, selected.draft.date, busy || settingsWrite !== null || settingsStale)}
        ${busy ? '<p role="status">Saving tournament settings…</p>' : ''}
        ${settingsStale ? '<button type="button" data-setup-reload>Reload saved settings</button>' :
          settingsWrite && !busy ? '<button type="button" data-setup-resend>Retry settings save</button>' : ''}
      </form>` : ''}
      ${state === 'loading' ? '<p role="status">Checking for a draft…</p>' : ''}
      ${state === 'error' ? '<p role="alert">Couldn’t open the saved draft.</p><button type="button" data-draft-retry>Try again</button>' : ''}
      ${state === 'saved' ? `<section class="entry-receipts" aria-label="Saved tournament"><article>
        <small>Saved to your account</small><strong>${html(draft.name)}</strong>
        <p>${html(formatCalendarDay(draft.date))} · ${html(draft.venue)}</p>
        <p>${html(draft.division)} · ${draft.discipline === 'singles' ? 'Singles' : 'Doubles'} · ${tournamentDraftFormats[draft.format]}</p>
        ${stale ? '<button type="button" class="secondary" data-draft-retry>Open latest draft</button>' :
          `<button type="button" data-draft-prepare${busy ? ' disabled' : ''}>Create private tournament</button>
          <button type="button" class="secondary" data-draft-edit${busy ? ' disabled' : ''}>Edit draft</button>`}
      </article></section>` : ''}
      ${state === 'saved' && busy ? '<p role="status">Creating tournament…</p>' : ''}
      ${state !== 'edit' && notice ? `<p role="alert" tabindex="-1" data-draft-error>${html(notice)}</p>` : ''}
      ${state === 'edit' ? `<form data-tournament-draft>
        <fieldset class="entry-fields"${readOnly ? ' disabled' : ''}><legend>Event details</legend>
          <label>Tournament name<input name="name" required maxlength="100" value="${html(draft.name)}"></label>
          <label>Date<input type="date" name="date" required value="${draft.date}"></label>
          <label>Club or venue<input name="venue" required maxlength="120" value="${html(draft.venue)}"></label>
        </fieldset>
        <fieldset class="entry-fields"${readOnly ? ' disabled' : ''}><legend>First division</legend>
          <label>Division name<input name="division" required maxlength="80" value="${html(draft.division)}"></label>
          <label>Entry type<select name="discipline"><option value="singles">Singles</option><option value="doubles"${draft.discipline === 'doubles' ? ' selected' : ''}>Doubles</option></select></label>
          <label>Draw format<select name="format">${options}</select></label>
        </fieldset>
        ${readOnly ? '' : '<button type="submit">Save draft</button>'}
        <p role="alert" tabindex="-1" data-draft-error>${html(notice)}</p>
        ${busy ? '<p role="status">Saving draft…</p>' : stale ? '<button type="button" data-draft-retry>Open saved draft</button>' :
          pending ? '<button type="button" data-draft-resend>Retry save</button>' : ''}
      </form>` : ''}`
    dialog.querySelector('[data-draft-back]')?.addEventListener('click', back)
    dialog.querySelector('[data-draft-start]')?.addEventListener('click', () => { void load() })
    if (typeof TIQ_TOURNAMENT_PRACTICE !== 'undefined' && TIQ_TOURNAMENT_PRACTICE) {
      const button = dialog.querySelector<HTMLButtonElement>('[data-desk-practice]')
      if (button) button.onclick = () => {
        if (!active() || planner?.isOpen()) return
        const practice = createTournamentPractice()
        planner = openTournamentPlan(client, owner, practice.event, active, send, button, () => { planner = null }, practice)
      }
    }
    dialog.querySelector('[data-draft-prepare]')?.addEventListener('click', () => { void prepare() })
    dialog.querySelector('[data-desk-retry]')?.addEventListener('click', () => { void loadDesk() })
    dialog.querySelector('[data-desk-more]')?.addEventListener('click', () => { if (nextPage) void loadDesk(nextPage) })
    dialog.querySelectorAll<HTMLButtonElement>('[data-draft-event]').forEach(button => {
      button.onclick = () => {
        const event = events[Number(button.dataset.draftEvent)]
        if (event && !busy) void openSetup(event)
      }
    })
    dialog.querySelector('[data-setup-edit]')?.addEventListener('click', () => {
      if (!selected) return
      settings = selected.settings ?? initialTournamentSettings(selected)
      settingsStale = false
      settingsWrite = null
      notice = ''
      state = 'settings'
      render(true)
    })
    const publish = dialog.querySelector<HTMLElement>('[data-tournament-publish]')
    if (publish && selected) {
      const edit = dialog.querySelector<HTMLButtonElement>('[data-setup-edit]')
      const subtitle = dialog.querySelector<HTMLElement>('[data-draft-subtitle]')
      const planButton = dialog.querySelector<HTMLButtonElement>('[data-tournament-plan]')
      if (edit && selected.publicId) edit.hidden = true
      if (planButton) planButton.onclick = () => {
        if (!selected || !active() || planner?.isOpen()) return
        planner = openTournamentPlan(client, owner, selected.revision, active, send, planButton, () => { planner = null })
      }
      if (!rehearsal) disposePublish = mountCompetitionPublish('tournament', publish, client, owner, selected.revision, selected.settingsRevision, active, send, id => {
        dispose()
        onClose()
        onPublished(id)
      }, (locked, published) => {
        if (edit) { edit.disabled = locked; edit.hidden = published || !!selected?.publicId }
        if (subtitle && published) subtitle.textContent = 'Published tournament'
        if (planButton && published) planButton.hidden = false
      })
    }
    dialog.querySelector('[data-setup-reload]')?.addEventListener('click', () => {
      if (opening && !busy) void openSetup(opening)
    })
    dialog.querySelector('[data-setup-resend]')?.addEventListener('click', () => {
      if (settingsWrite) void saveSettings(settingsWrite)
    })
    const setupForm = dialog.querySelector<HTMLFormElement>('[data-setup-settings]')
    if (setupForm) bindSetupForm(setupForm)
    dialog.querySelector('[data-draft-retry]')?.addEventListener('click', () => { void load() })
    dialog.querySelector('[data-draft-resend]')?.addEventListener('click', () => {
      if (pending && !busy) void save(pending)
    })
    dialog.querySelector('[data-draft-edit]')?.addEventListener('click', () => {
      state = 'edit'
      render(true)
    })
    const form = dialog.querySelector<HTMLFormElement>('[data-tournament-draft]')
    if (form) form.onsubmit = event => {
      event.preventDefault()
      if (!active() || readOnly) return
      const error = form.querySelector<HTMLElement>('[data-draft-error]')!
      const next = readTournamentDraft(Object.fromEntries(new FormData(form)))
      if (!next) { error.textContent = 'Enter a name, valid date, venue and division.'; error.focus(); return }
      void save({ draft: next, expected: revision, revision: crypto.randomUUID() })
    }
    if (focus) {
      dialog.scrollTop = 0
      dialog.querySelector<HTMLElement>(notice ? '[data-draft-error]' : 'h2')?.focus({preventScroll: !notice})
    }
  }

  function bindSetupForm(form: HTMLFormElement) {
    form.querySelector('[data-add-division]')?.addEventListener('click', () => {
      if (!settings || settings.divisions.length >= maxTournamentDivisions) return
      settings = readTournamentSetupFields(form, settings)
      const index = settings.divisions.length
      settings.divisions.push({ id: crypto.randomUUID(), name: '', discipline: 'singles', format: 'single_elimination' })
      notice = ''
      render()
      dialog.querySelector<HTMLElement>(`input[name="name-${index}"]`)?.focus()
    })
    form.querySelectorAll<HTMLButtonElement>('[data-remove-division]').forEach(button => {
      button.onclick = () => {
        if (!settings || settings.divisions.length < 2) return
        settings = readTournamentSetupFields(form, settings)
        const index = Number(button.dataset.removeDivision)
        settings.divisions.splice(index, 1)
        notice = ''
        render()
        dialog.querySelector<HTMLElement>(`input[name="name-${Math.min(index, settings.divisions.length - 1)}"]`)?.focus()
      }
    })
    form.onsubmit = event => {
      event.preventDefault()
      if (!active() || busy || settingsWrite || settingsStale || !settings || !selected) return
      settings = readTournamentSetupFields(form, settings)
      try {
        const validated = readTournamentSettings(settings)
        if (validated.registrationClosesOn > selected.draft.date) throw Error('Registration must close by the tournament date.')
        void saveSettings({ event: selected.revision, expected: selected.settingsRevision, revision: crypto.randomUUID(), settings: validated })
      } catch (error) {
        notice = error instanceof Error ? error.message : 'Check the tournament settings.'
        render(true)
      }
    }
  }

  dialog.oncancel = event => { event.preventDefault(); back() }
  document.body.append(dialog)
  dialog.showModal()
  void loadDesk()
  return {dispose, isOpen: () => !disposed, back}
}
