import { Clipboard } from '@capacitor/clipboard'
import { Share } from '@capacitor/share'
import { competitionPlacements, type CompetitionTrophy } from '../../lib/competition-trophies'
import { matchDate } from './recent-results'

const sampleHonorMessage = [
  'Sample honor · TenAceIQ demo',
  'Champion · Sample tournament',
  'Tournament · Singles',
  'Example only',
].join('\n')

type HonorShareSource =
  | { kind: 'sample' }
  | { kind: 'earned'; trophy: CompetitionTrophy; read: () => Promise<CompetitionTrophy | undefined> }

function honorMessage(trophy: CompetitionTrophy) {
  const kind = trophy.kind === 'league' ? 'League' : 'Tournament'
  return [
    `${competitionPlacements[trophy.placement]} · ${trophy.name}`,
    [kind, trophy.division].filter(Boolean).join(' · '),
    `Awarded ${matchDate(trophy.awardedOn)}`,
    'TenAceIQ',
  ].join('\n')
}

export function openCompetitionTrophyShare(
  host: HTMLElement, trigger: HTMLButtonElement, current: () => boolean, source: HonorShareSource,
) {
  if (!current() || document.querySelector('dialog[open]')) return

  const dialog = document.createElement('dialog')
  const sample = source.kind === 'sample'
  const heading = sample ? 'Share sample honor' : 'Share competition honor'
  dialog.className = 'chat-post-dialog scorecard-share-dialog'
  dialog.setAttribute('aria-label', heading)
  dialog.innerHTML = `<h2 tabindex="-1">${heading}</h2>
    ${sample ? '<p>Try sharing an example. This sample is separate from your earned honors.</p>' : ''}
    <p role="status" tabindex="-1"></p>
    <pre class="match-share-preview" aria-label="Honor message preview"></pre>
    <div class="scorecard-share-actions">
      <button type="button" data-share hidden>Choose where to share</button>
      <button type="button" class="secondary" data-copy>${sample ? 'Copy sample' : 'Copy honor'}</button>
      <button type="button" class="secondary" data-close>Back to Trophy Case</button>
    </div>`

  const preview = dialog.querySelector('pre')!
  const status = dialog.querySelector<HTMLElement>('[role="status"]')!
  const share = dialog.querySelector<HTMLButtonElement>('[data-share]')!
  const copy = dialog.querySelector<HTMLButtonElement>('[data-copy]')!
  const close = dialog.querySelector<HTMLButtonElement>('[data-close]')!
  const active = () => dialog.isConnected && dialog.open && current()
  let message = source.kind === 'earned' ? honorMessage(source.trophy) : sampleHonorMessage
  let busy = false
  let unavailable = false
  preview.textContent = message

  async function deliver(mode: 'share' | 'copy') {
    if (!active() || busy || unavailable) return
    busy = true
    share.disabled = copy.disabled = true
    try {
      if (source.kind === 'earned') {
        status.textContent = 'Checking your honor…'
        const fresh = await source.read()
        if (!active()) return
        if (!fresh) {
          unavailable = true
          preview.textContent = ''
          preview.hidden = true
          status.textContent = 'This honor is no longer available. Refresh your Trophy Case.'
          return
        }
        const updated = honorMessage(fresh)
        if (updated !== message) {
          message = updated
          preview.textContent = message
          status.textContent = 'This honor changed. Review the updated message before sharing.'
          return
        }
      }
      if (mode === 'copy') await Clipboard.write({ string: message })
      else await Share.share({ title: sample ? 'TenAceIQ sample honor' : 'TenAceIQ competition honor', text: message, dialogTitle: heading })
      if (active()) status.textContent = mode === 'share' ? 'Share sheet closed.' : sample ? 'Sample copied.' : 'Honor copied.'
    } catch {
      if (active()) status.textContent = 'Couldn’t complete this action. Try again.'
    } finally {
      if (active()) {
        busy = false
        share.disabled = copy.disabled = unavailable
        status.focus({ preventScroll: true })
      }
    }
  }

  function dispose() {
    dialog.remove()
    if (current() && trigger.isConnected) trigger.focus({ preventScroll: true })
  }
  share.onclick = () => { void deliver('share') }
  copy.onclick = () => { void deliver('copy') }
  close.onclick = dispose
  dialog.oncancel = event => { event.preventDefault(); dispose() }
  host.append(dialog)
  dialog.showModal()
  dialog.querySelector('h2')?.focus()
  void Share.canShare().then(({ value }) => { if (active()) share.hidden = !value }).catch(() => {})
}
