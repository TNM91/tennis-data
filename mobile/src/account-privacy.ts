import { Browser } from '@capacitor/browser'
import { ACCOUNT_BACKUP_RETENTION, ACCOUNT_DELETION_DETAILS, ACCOUNT_HELP_LINKS, ACCOUNT_PRIVACY_SECTIONS } from '../../lib/account-privacy'
import { html } from './match-details'

/** Public, account-neutral help. Removing the owning view removes its sheet too. */
export function openAccountPrivacy(container: HTMLElement) {
  if (!container.isConnected) return
  const existing = document.querySelector<HTMLDialogElement>('dialog[data-account-privacy]')
  if (existing) { existing.querySelector<HTMLElement>('h1')?.focus(); return }
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const dialog = document.createElement('dialog')
  dialog.className = 'account-settings-dialog account-privacy-dialog'
  dialog.dataset.accountPrivacy = ''
  dialog.setAttribute('aria-labelledby', 'account-privacy-title')
  dialog.innerHTML = `<button type="button" class="secondary account-dialog-close" data-privacy-close>Close privacy information</button><small>Your account</small><h1 id="account-privacy-title" tabindex="-1">Your data, your choices.</h1><p class="privacy-intro">Know what you share and how to manage it.</p>${ACCOUNT_PRIVACY_SECTIONS.map(section => `<section><h2>${html(section.title)}</h2><p>${html(section.body)}</p></section>`).join('')}<details><summary>What remains after deletion?</summary>${[...ACCOUNT_DELETION_DETAILS, ACCOUNT_BACKUP_RETENTION].map(text => `<p>${html(text)}</p>`).join('')}</details><div class="account-action-list"><button type="button" class="secondary" data-privacy-policy>Read full Privacy policy</button><button type="button" class="secondary" data-privacy-support>Get privacy or account help</button></div><p class="privacy-contact">You can also contact support@tenaceiq.com.</p><p role="alert" data-privacy-error></p>`
  const dispose = () => {
    dialog.remove()
    if (previous?.isConnected) previous.focus({preventScroll: true})
  }
  dialog.querySelector<HTMLButtonElement>('[data-privacy-close]')!.onclick = dispose
  dialog.oncancel = event => { event.preventDefault(); dispose() }
  for (const [selector, url] of [['[data-privacy-policy]', ACCOUNT_HELP_LINKS.privacy], ['[data-privacy-support]', ACCOUNT_HELP_LINKS.support]] as const) {
    const button = dialog.querySelector<HTMLButtonElement>(selector)!
    button.onclick = async () => {
      if (!dialog.isConnected || button.disabled) return
      button.disabled = true
      const error = dialog.querySelector<HTMLElement>('[data-privacy-error]')!
      error.textContent = ''
      try { await Browser.open({url}) }
      catch { if (dialog.isConnected) error.textContent = 'Could not open the page. Check your connection and try again.' }
      finally { if (dialog.isConnected) button.disabled = false }
    }
  }
  container.append(dialog)
  dialog.showModal()
  dialog.querySelector<HTMLElement>('h1')!.focus()
  return {dispose}
}
