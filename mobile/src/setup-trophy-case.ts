import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ACCOUNT_HELP_LINKS } from '../../lib/account-privacy'
import { competitionPlacements, readCompetitionTrophies, type CompetitionTrophy } from '../../lib/competition-trophies'
import { MEMBERSHIP_TIERS } from '../../lib/product-story'
import { tournamentDraftRevision } from '../../lib/native-tournament-draft-contract'
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
      </li>`).join('')}</ul>` : profileLinked === false ? `<p>Your account isn’t connected to a player profile. Trophies from app entries go to your TenAceIQ account. Support can help connect a player profile for other awards.</p>
        <button type="button" class="secondary" data-competition-help>Get help connecting your profile</button><p role="status" data-competition-help-status></p>` :
        `<p>No competition honors yet. If you expected an award, ask your organizer to check which account or player profile received it.</p>
        ${profileLinked === true ? '<button type="button" class="secondary" data-share-sample-honor>Try sharing a sample honor</button>' : ''}`}
    <div class="setup-trophy-card"><button type="button" class="secondary" data-open-trophy-claim
      aria-expanded="false" aria-controls="lab-trophy-claim">Claim doubles trophy</button>
      <form id="lab-trophy-claim" data-trophy-claim hidden>
        <p>Use the partner code from your tournament organizer.</p>
        <label>Partner code<input type="text" name="code" maxlength="36" required autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <button type="submit" class="secondary">Claim trophy</button>
        <p role="status" data-claim-status></p>
      </form>
    </div>
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

  async function claimTrophy(form: HTMLFormElement) {
    const claimStatus = form.querySelector<HTMLElement>('[data-claim-status]')!
    const button = form.querySelector<HTMLButtonElement>('button')!
    if (!active() || button.disabled || refresh.disabled) return
    const code = String(new FormData(form).get('code') ?? '').trim().toLowerCase()
    if (!tournamentDraftRevision(code)) {
      claimStatus.textContent = 'Check the partner code and try again.'
      return
    }
    button.disabled = true
    refresh.disabled = true
    claimStatus.textContent = 'Checking partner code…'
    try {
      const session = await client.auth.getSession()
      if (!active() || session.error || session.data.session?.user.id !== owner) throw Error('Account changed')
      const response = await CapacitorHttp.post({
        url: 'https://www.tenaceiq.com/api/mobile/first-party/tournaments/trophy/claim',
        headers: { Authorization: `Bearer ${session.data.session.access_token}`, 'Content-Type': 'application/json' },
        data: { code }, responseType: 'json', disableRedirects: true, connectTimeout: 12000, readTimeout: 15000,
      })
      const latest = await client.auth.getSession()
      if (!active() || latest.error || latest.data.session?.user.id !== owner) return
      if (response.status === 404 && response.data?.scope === 'first-party') {
        claimStatus.textContent = 'This code is unavailable. Ask your organizer to check it.'
        return
      }
      if (response.status !== 200 || response.data?.scope !== 'first-party' ||
          response.data.ok !== true || response.data.owner !== owner || typeof response.data.trophyId !== 'string') {
        throw Error('Claim unavailable')
      }
      refresh.disabled = false
      const trophies = await load()
      if (active()) status.textContent = trophies?.some(trophy => trophy.id === response.data.trophyId)
        ? 'Champion trophy added.' : 'Trophy claimed. Refresh to see it in your Trophy Case.'
    } catch {
      if (active() && form.isConnected) claimStatus.textContent = 'Couldn’t confirm the claim. Try the same partner code again.'
    } finally {
      if (active()) { button.disabled = false; refresh.disabled = false }
    }
  }

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
      const claim = list.querySelector<HTMLFormElement>('[data-trophy-claim]')
      const claimToggle = list.querySelector<HTMLButtonElement>('[data-open-trophy-claim]')
      if (claim && claimToggle) {
        claim.onsubmit = (event) => { event.preventDefault(); void claimTrophy(claim) }
        claimToggle.onclick = () => {
          claim.hidden = !claim.hidden
          claimToggle.setAttribute('aria-expanded', String(!claim.hidden))
          if (!claim.hidden) claim.querySelector('input')?.focus()
        }
      }
      for (const button of list.querySelectorAll<HTMLButtonElement>('[data-setup-action]')) {
        button.onclick = () => { if (active()) openAction(button.dataset.setupAction as SetupAction, button) }
      }
      for (const button of list.querySelectorAll<HTMLButtonElement>('[data-share-honor]')) {
        const trophy = trophies?.[Number(button.dataset.shareHonor)]
        if (trophy) button.onclick = () => openCompetitionTrophyShare(list, button, active, {
          kind: 'earned', trophy,
          read: async () => {
            const fresh = readCompetitionTrophies((await readTrophyCase()).competitionTrophies)
            return fresh.find(honor => honor.id === trophy.id)
          },
        })
      }
      const sample = list.querySelector<HTMLButtonElement>('[data-share-sample-honor]')
      if (sample) sample.onclick = () => openCompetitionTrophyShare(list, sample, active, { kind: 'sample' })
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
      return trophies
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
