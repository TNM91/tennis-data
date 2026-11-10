import { Clipboard } from '@capacitor/clipboard'
import { Share } from '@capacitor/share'
import { competitionPlacements, type CompetitionTrophy } from '../../lib/competition-trophies'
import { matchDate } from './recent-results'

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
  host: HTMLElement, trophy: CompetitionTrophy, trigger: HTMLButtonElement,
  read: () => Promise<CompetitionTrophy | undefined>, current: () => boolean,
) {
  if (!current() || document.querySelector('dialog[open]')) return

  const dialog = document.createElement('dialog')
  dialog.className = 'chat-post-dialog scorecard-share-dialog'
  dialog.setAttribute('aria-label', 'Share competition honor')
  dialog.innerHTML = `<h2 tabindex="-1">Share competition honor</h2>
    <p role="status" tabindex="-1"></p>
    <pre class="match-share-preview" aria-label="Honor message preview"></pre>
    <div class="scorecard-share-actions">
      <button type="button" data-share hidden>Choose where to share</button>
      <button type="button" class="secondary" data-copy>Copy honor</button>
      <button type="button" class="secondary" data-close>Back to Trophy Case</button>
    </div>`

  const preview = dialog.querySelector('pre')!
  const status = dialog.querySelector<HTMLElement>('[role="status"]')!
  const share = dialog.querySelector<HTMLButtonElement>('[data-share]')!
  const copy = dialog.querySelector<HTMLButtonElement>('[data-copy]')!
  const close = dialog.querySelector<HTMLButtonElement>('[data-close]')!
  const active = () => dialog.isConnected && dialog.open && current()
  let message = honorMessage(trophy)
  let busy = false
  let unavailable = false
  preview.textContent = message

  async function deliver(mode: 'share' | 'copy') {
    if (!active() || busy || unavailable) return
    busy = true
    share.disabled = copy.disabled = true
    status.textContent = 'Checking your honor…'
    try {
      const fresh = await read()
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
      if (mode === 'copy') await Clipboard.write({ string: message })
      else await Share.share({ title: 'TenAceIQ competition honor', text: message, dialogTitle: 'Share competition honor' })
      if (active()) status.textContent = mode === 'copy' ? 'Honor copied.' : 'Share sheet closed.'
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
