import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ACCOUNT_HELP_LINKS } from '../../lib/account-privacy'
import { competitionPlacements, readCompetitionTrophies, type CompetitionTrophy } from '../../lib/competition-trophies'
import { MEMBERSHIP_TIERS } from '../../lib/product-story'
import { readSetupTracks, setupSteps, setupTracks, type SetupTrack } from '../../lib/setup-trophies'
import { openCompetitionTrophyShare } from './competition-trophy-share'
import { matchesTeamReleaseScope } from './first-party-team-transport'
import { html } from './match-details'
import { Browser } from './native-browser'
import { matchDate } from './recent-results'

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

function readHonors(value: unknown) {
  try { return readCompetitionTrophies(value) } catch { return null }
}

function competitionHtml(trophies: CompetitionTrophy[] | null, profileLinked: unknown) {
  return `<section aria-labelledby="lab-competition-trophies">
    <h3 id="lab-competition-trophies">Competition honors</h3>
    ${trophies === null ? '<p>Couldn’t check competition honors. Refresh to try again.</p>' :
      trophies.length ? `<ul class="lab-competition-trophies">${trophies.map((trophy, index) => `<li class="setup-trophy-card">
        <small>${trophy.kind === 'league' ? 'League' : 'Tournament'} · ${competitionPlacements[trophy.placement]}</small>
        <strong>${html(trophy.name)}</strong>
        <small>${[trophy.division, matchDate(trophy.awardedOn)].filter(Boolean).map(html).join(' · ')}</small>
        <button type="button" class="secondary" data-share-honor="${index}" aria-label="Share honor for ${html(trophy.name)}">Share honor</button>
      </li>`).join('')}</ul>` : profileLinked === false ? `<p>Your account isn’t connected to a player profile. If you’ve earned an award, ask your organizer which TenAceIQ player profile received it. Support can help you connect that profile.</p>
        <button type="button" class="secondary" data-competition-help>Get help connecting your profile</button><p role="status" data-competition-help-status></p>` :
        '<p>No competition honors yet. If you expected an award, ask your organizer to check that it was published to your linked player profile.</p>'}
  </section>`
}

export function mountSetupTrophyCase(
  host: HTMLElement, client: SupabaseClient, owner: string, current: () => boolean,
  openAction: (action: SetupAction, trigger: HTMLButtonElement) => void, reveal = false,
) {
  host.innerHTML = `<details class="lab-trophy-case" ${reveal ? 'open' : ''}>
    <summary><strong>Trophy Case</strong><span>Competition honors and setup trophies</span></summary>
    <p role="status" data-setup-status></p><div data-setup-tracks></div>
    <button type="button" class="secondary" data-setup-refresh>Check Trophy Case</button>
  </details>`
  const disclosure = host.querySelector<HTMLDetailsElement>('details')!
  const status = host.querySelector<HTMLElement>('[data-setup-status]')!
  const list = host.querySelector<HTMLElement>('[data-setup-tracks]')!
  const refresh = host.querySelector<HTMLButtonElement>('[data-setup-refresh]')!
  const active = () => host.isConnected && current()
  let loaded = false

  async function readTrophyCase() {
    const session = await client.auth.getSession()
    if (!active() || session.error || session.data.session?.user.id !== owner) throw Error('Account changed')
    const response = await CapacitorHttp.get({
      url: 'https://www.tenaceiq.com/api/mobile/first-party/setup',
      headers: { Authorization: `Bearer ${session.data.session.access_token}` },
      responseType: 'json', disableRedirects: true, connectTimeout: 12000, readTimeout: 30000,
    })
    const data = response.data
    if (!active() || response.status !== 200 || data?.ok !== true || !matchesTeamReleaseScope(data, owner)) throw Error('Trophy Case unavailable')
    return data
  }

  async function load() {
    if (!active() || refresh.disabled) return
    refresh.disabled = true
    status.textContent = 'Checking your Trophy Case…'
    try {
      const data = await readTrophyCase()
      if (!active()) return
      const tracks = readSetupTracks(data.tracks)
      const trophies = readHonors(data.competitionTrophies)
      list.innerHTML = competitionHtml(trophies, data.competitionProfileLinked) +
        '<h3>Setup trophies</h3>' + tracks.map(trackHtml).join('')
      for (const button of list.querySelectorAll<HTMLButtonElement>('[data-setup-action]')) {
        button.onclick = () => { if (active()) openAction(button.dataset.setupAction as SetupAction, button) }
      }
      for (const button of list.querySelectorAll<HTMLButtonElement>('[data-share-honor]')) {
        const trophy = trophies?.[Number(button.dataset.shareHonor)]
        if (trophy) button.onclick = () => openCompetitionTrophyShare(list, trophy, button, async () => {
          const fresh = readCompetitionTrophies((await readTrophyCase()).competitionTrophies)
          return fresh.find(honor => honor.id === trophy.id)
        }, active)
      }
      const help = list.querySelector<HTMLButtonElement>('[data-competition-help]')
      const helpStatus = list.querySelector<HTMLElement>('[data-competition-help-status]')
      if (help && helpStatus) help.onclick = async () => {
        if (!active() || help.disabled) return
        help.disabled = true
        helpStatus.textContent = ''
        try { await Browser.open({ url: ACCOUNT_HELP_LINKS.support }) }
        catch { if (active()) helpStatus.textContent = 'Couldn’t open support. Email support@tenaceiq.com for help.' }
        finally { if (active()) help.disabled = false }
      }
      loaded = true
      status.textContent = ''
      refresh.textContent = 'Refresh Trophy Case'
    } catch {
      if (active()) {
        list.replaceChildren()
        loaded = false
        status.textContent = 'Couldn’t check your Trophy Case. Try again.'
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
