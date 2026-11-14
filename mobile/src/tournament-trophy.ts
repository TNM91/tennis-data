import { Clipboard } from '@capacitor/clipboard'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readTournamentTrophy, readTournamentTrophyPreview, type TournamentTrophyPreview, type TournamentTrophyWrite } from '../../lib/native-tournament-trophy-contract'
import { scenarioOwner, type ScenarioSend } from './captain-scenarios-data'
import { html } from './match-details'

const errors: Record<string, string> = {
  stale: 'The results or trophy changed. Refresh before continuing.',
  not_ready: 'Refresh the results and confirm the champion before awarding.',
  recipient: 'This champion needs an approved app entry tied to their TenAceIQ account.',
}

export function openTournamentTrophy(
  client: SupabaseClient, owner: string, event: string, division: string, current: () => boolean,
  send: ScenarioSend, trigger: HTMLElement, close: () => void,
) {
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog competitions-dialog league-entry-dialog tournament-entry-dialog'
  dialog.setAttribute('aria-labelledby', 'tournament-trophy-title')
  let preview: TournamentTrophyPreview | null = null
  let choice = ''
  let notice = ''
  let error = false
  let busy = false
  let disposed = false
  let withdraw = false
  let refreshRequired = false
  const active = () => !disposed && current()
  const focus = (selector: string) => dialog.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
  const endpoint = 'https://www.tenaceiq.com/api/mobile/first-party/tournaments/trophy?' + new URLSearchParams({ event, division })

  function dispose() {
    if (disposed) return
    disposed = true
    dialog.remove()
    close()
    if (current() && trigger.isConnected) trigger.focus({ preventScroll: true })
  }

  function back() {
    if (busy) return true
    if (withdraw) {
      withdraw = false
      render()
      focus('[data-trophy-withdraw]')
    } else dispose()
    return true
  }

  async function run(write?: TournamentTrophyWrite) {
    if (!active() || busy || (write && (!preview || refreshRequired))) return
    busy = true
    error = false
    notice = write ? 'Saving trophy…' : 'Checking the division…'
    render()
    try {
      const session = await scenarioOwner(client, owner, active)
      const response = await send({
        url: endpoint, method: write ? 'POST' : 'GET',
        headers: { Authorization: 'Bearer ' + session.access_token, 'Cache-Control': 'no-store',
          ...(write ? { 'Content-Type': 'application/json' } : {}) },
        ...(write ? { data: write } : {}),
        webFetchExtra: { cache: 'no-store' }, disableRedirects: true, responseType: 'json',
        connectTimeout: 12000, readTimeout: 15000,
      })
      await scenarioOwner(client, owner, active)
      const data = response.data
      if (data?.scope === 'first-party' && data.ok === false && Object.hasOwn(errors, data.code)) throw Error(data.code)
      if (response.status !== 200 || data?.scope !== 'first-party' || data.ok !== true ||
          data.owner !== owner || data.event !== event || data.division !== division) throw Error('unavailable')
      if (write && preview) {
        const award = readTournamentTrophy(data.award)
        if (write.action === 'award' ? award?.champion !== write.champion : award !== null) throw Error('unavailable')
        preview = { ...preview, award }
        notice = award ? 'Champion trophy added to the winner’s Trophy Case.' : 'Champion trophy withdrawn.'
      } else {
        const latest = readTournamentTrophyPreview(data.preview)
        if (latest.division !== division) throw Error('unavailable')
        preview = latest
        notice = ''
      }
      choice = preview.contenders.length === 1 ? preview.contenders[0] : ''
      withdraw = false
      refreshRequired = false
    } catch (failure) {
      if (!active()) return
      const code = failure instanceof Error ? failure.message : ''
      error = true
      refreshRequired = true
      notice = errors[code] ?? (write ? 'Couldn’t confirm the change. Refresh to check the trophy.' : 'Couldn’t load the trophy. Refresh to try again.')
    } finally {
      busy = false
      if (active()) {
        render()
        focus(notice ? '[data-trophy-status]' : 'h2')
      }
    }
  }

  function render() {
    const award = preview?.award
    const locked = busy || refreshRequired
    const disabled = locked ? ' disabled' : ''
    dialog.innerHTML = `<header class="competition-header">
      <button type="button" class="secondary" data-trophy-back${busy ? ' disabled' : ''}>${withdraw ? 'Back to trophy' : 'Back to draw'}</button>
      <button type="button" class="secondary" data-trophy-refresh${busy ? ' disabled' : ''}>Refresh</button>
    </header>
    <div class="competition-hero entry-hero"><h2 id="tournament-trophy-title" tabindex="-1">Champion trophy</h2>
      ${preview ? `<p>${html(preview.eventName)} · ${html(preview.divisionName)}</p>` : ''}
    </div>
    <p role="${error ? 'alert' : 'status'}" data-trophy-status tabindex="-1"${notice ? '' : ' hidden'}>${html(notice)}</p>
    ${award && withdraw ? `<section class="entry-receipts" aria-label="Withdraw trophy"><article>
      <strong>Withdraw ${html(award.champion)}’s trophy?</strong>
      <p>This removes the trophy from each winner’s Trophy Case and disables any partner code.</p>
      <button type="button" data-trophy-confirm-withdraw${disabled}>Confirm withdrawal</button>
    </article></section>` : award ? `<section class="entry-receipts" aria-label="Awarded trophy"><article>
      <small>Champion · Awarded</small><strong>${html(award.champion)}</strong>
      ${award.paired ? award.partnerClaimed ? '<p>The doubles partner claimed their trophy.</p>' :
        '<p>Share the one-time code with the doubles partner. They can claim their trophy in My Lab.</p><button type="button" class="secondary" data-trophy-copy>Copy partner code</button>' : ''}
      <button type="button" class="secondary" data-trophy-withdraw${disabled}>Withdraw trophy</button>
    </article></section>` : preview?.contenders.length ? `<form data-trophy-award>
      <fieldset class="entry-fields"${disabled}><legend>Champion</legend>
        ${preview.tied ? `<p>These players are tied on match wins. Choose the champion using your event’s tiebreak rules.</p>
          <label>Choose champion<select name="champion" required><option value="">Choose the champion</option>
          ${preview.contenders.map((contender, index) => `<option value="${index}"${contender === choice ? ' selected' : ''}>${html(contender)}</option>`).join('')}
          </select></label>` : `<strong>${html(preview.contenders[0])}</strong>`}
        <p>The trophy goes to the winner’s TenAceIQ account.</p>
      </fieldset>
      <button type="submit"${disabled}>Award champion trophy</button>
    </form>` : preview ? '<p>Complete the division’s results to award the trophy.</p>' : ''}`
    dialog.querySelector('[data-trophy-back]')?.addEventListener('click', back)
    dialog.querySelector('[data-trophy-refresh]')?.addEventListener('click', () => { void run() })
    dialog.querySelector('[data-trophy-withdraw]')?.addEventListener('click', () => {
      withdraw = true
      notice = ''
      render()
      focus('[data-trophy-confirm-withdraw]')
    })
    dialog.querySelector('[data-trophy-confirm-withdraw]')?.addEventListener('click', () => {
      if (award) void run({ action: 'withdraw', awardId: award.id })
    })
    const copy = dialog.querySelector<HTMLButtonElement>('[data-trophy-copy]')
    if (copy && award?.partnerCode) copy.onclick = async () => {
      if (!active() || busy || !award.partnerCode) return
      copy.disabled = true
      try { await Clipboard.write({ string: award.partnerCode }); notice = 'Partner code copied.'; error = false }
      catch { notice = 'Couldn’t copy the partner code. Try again.'; error = true }
      if (active() && copy.isConnected) { render(); focus('[data-trophy-status]') }
    }
    const form = dialog.querySelector<HTMLFormElement>('[data-trophy-award]')
    if (form && preview) form.onsubmit = (event) => {
      event.preventDefault()
      if (!preview || locked) return
      const selected = new FormData(form).get('champion')
      choice = preview.tied ? preview.contenders[Number(selected)] ?? '' : preview.contenders[0]
      if (choice && (!preview.tied || selected !== '')) void run({ action: 'award', revision: preview.revision, champion: choice })
    }
  }

  dialog.oncancel = (event) => { event.preventDefault(); back() }
  document.body.append(dialog)
  dialog.showModal()
  void run()
  return { dispose, back, isOpen: () => !disposed }
}
