import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MEMBERSHIP_TIERS } from '../../lib/product-story'
import { readSetupTracks, setupSteps, setupTracks, type SetupTrack } from '../../lib/setup-trophies'
import { matchesTeamReleaseScope } from './first-party-team-transport'

export type SetupAction = 'scorecard' | 'training' | 'coach-workspace' | 'chats'

const actionLabels: Record<SetupAction, string> = {
  scorecard: 'Open match log', training: 'Open Level Up', 'coach-workspace': 'Open Coach Hub', chats: 'Open Chats',
}

function trackHtml(track: SetupTrack) {
  const { award, steps } = setupTracks[track.tier]
  const next = steps.find(step => !track.done.includes(step))
  const nextStep = next ? setupSteps[next] : undefined
  const action = nextStep && 'action' in nextStep ? nextStep.action : undefined
  return `<article class="setup-trophy-card">
    <small>${MEMBERSHIP_TIERS[track.tier].name}</small><h3>${award}</h3>
    <p>${next ? `${track.done.length} of ${steps.length} complete` : 'Trophy unlocked'}</p>
    <progress value="${track.done.length}" max="${steps.length}" aria-label="${award} setup progress"></progress>
    <ol>${steps.map(step => `<li><strong>${setupSteps[step].title}</strong>
      <small>${track.done.includes(step) ? 'Complete' : setupSteps[step].detail}</small></li>`).join('')}</ol>
    ${action ? `<button type="button" class="secondary" data-setup-action="${action}">${actionLabels[action]}</button>` : ''}
  </article>`
}

export function mountSetupTrophyCase(
  host: HTMLElement, client: SupabaseClient, owner: string, current: () => boolean,
  openAction: (action: SetupAction, trigger: HTMLButtonElement) => void, reveal = false,
) {
  host.innerHTML = `<details class="lab-trophy-case" ${reveal ? 'open' : ''}>
    <summary><strong>Trophy Case</strong><span>Complete your setup and earn trophies</span></summary>
    <p role="status" data-setup-status></p><div data-setup-tracks></div>
    <button type="button" class="secondary" data-setup-refresh>Check setup progress</button>
  </details>`
  const disclosure = host.querySelector<HTMLDetailsElement>('details')!
  const status = host.querySelector<HTMLElement>('[data-setup-status]')!
  const list = host.querySelector<HTMLElement>('[data-setup-tracks]')!
  const refresh = host.querySelector<HTMLButtonElement>('[data-setup-refresh]')!
  const active = () => host.isConnected && current()
  let loaded = false

  async function load() {
    if (!active() || refresh.disabled) return
    refresh.disabled = true
    status.textContent = 'Checking your setup progress…'
    try {
      const session = await client.auth.getSession()
      if (!active()) return
      if (session.error || session.data.session?.user.id !== owner) throw Error('Account changed')
      const response = await CapacitorHttp.get({
        url: 'https://www.tenaceiq.com/api/mobile/first-party/setup',
        headers: { Authorization: `Bearer ${session.data.session.access_token}` },
        responseType: 'json', disableRedirects: true, connectTimeout: 12000, readTimeout: 30000,
      })
      if (!active()) return
      const data = response.data
      if (response.status !== 200 || data?.ok !== true || !matchesTeamReleaseScope(data, owner)) throw Error('Setup unavailable')
      const tracks = readSetupTracks(data.tracks)
      list.innerHTML = tracks.map(trackHtml).join('')
      for (const button of list.querySelectorAll<HTMLButtonElement>('[data-setup-action]')) {
        button.onclick = () => { if (active()) openAction(button.dataset.setupAction as SetupAction, button) }
      }
      loaded = true
      status.textContent = ''
      refresh.textContent = 'Refresh setup progress'
    } catch {
      if (active()) {
        list.replaceChildren()
        loaded = false
        status.textContent = 'Couldn’t check your setup progress. Try again.'
      }
    } finally {
      if (active()) refresh.disabled = false
    }
  }

  refresh.onclick = () => { void load() }
  disclosure.ontoggle = () => { if (disclosure.open && !loaded) void load() }
  if (reveal) {
    disclosure.querySelector<HTMLElement>('summary')?.focus()
    void load()
  }
}
