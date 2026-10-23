import { Browser } from '@capacitor/browser'
import type { SupabaseClient } from '@supabase/supabase-js'

const ACCOUNT_LINKS = {
  privacy: 'https://www.tenaceiq.com/legal/privacy',
  terms: 'https://www.tenaceiq.com/legal/terms',
  support: 'https://www.tenaceiq.com/contact',
} as const
export const PASSWORD_RESET_URL = 'https://www.tenaceiq.com/reset-password'
export function accountLink(key: string): string | null {
  return Object.hasOwn(ACCOUNT_LINKS, key) ? ACCOUNT_LINKS[key as keyof typeof ACCOUNT_LINKS] : null
}

export function bindAccountLinks(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>('[data-account-link]').forEach(button => {
    button.onclick = async () => {
      const url = accountLink(button.dataset.accountLink || '')
      if (!url) return
      button.disabled = true
      const notice = container.querySelector('[data-account-notice]')
      if (notice) notice.textContent = ''
      try { await Browser.open({url}) }
      catch { if (notice) notice.textContent = 'Could not open the page. Check your connection and try again.' }
      finally { button.disabled = false }
    }
  })
}

export const accountLinksHtml = `<nav aria-label="Account help" class="account-links"><button type="button" data-account-link="privacy">Privacy</button><button type="button" data-account-link="terms">Terms</button><button type="button" data-account-link="support">Support</button></nav><p role="alert" data-account-notice></p>`

export function showPasswordRecovery(app: HTMLElement, client: SupabaseClient, back: () => void) {
  let disposed = false
  let timer: ReturnType<typeof setInterval> | undefined
  app.dataset.state = 'recovery'
  app.innerHTML = `<h1 tabindex="-1">Reset your password</h1><p>Enter your account email. Open the reset link in your browser, choose a new password, then return here to sign in.</p><form id="recovery-form"><label>Email<input type="email" name="email" autocomplete="email" required></label><p role="alert" id="recovery-error"></p><p role="status" id="recovery-status"></p><button id="send-reset">Send reset link</button></form><button class="secondary" id="back-login">Back to sign in</button>${accountLinksHtml}`
  bindAccountLinks(app)
  app.querySelector<HTMLElement>('h1')!.focus()
  app.querySelector<HTMLButtonElement>('#back-login')!.onclick = back
  const form = app.querySelector<HTMLFormElement>('#recovery-form')!
  const button = app.querySelector<HTMLButtonElement>('#send-reset')!
  const error = app.querySelector<HTMLElement>('#recovery-error')!
  const status = app.querySelector<HTMLElement>('#recovery-status')!
  let pending = false
  let allowedAt = 0
  form.onsubmit = async event => {
    event.preventDefault()
    if (pending || Date.now() < allowedAt) return
    const email = String(new FormData(form).get('email') || '').trim()
    if (!email || !form.reportValidity()) return
    pending = true
    button.disabled = true
    button.textContent = 'Sending…'
    error.textContent = ''
    status.textContent = ''
    try {
      const result = await client.auth.resetPasswordForEmail(email, {redirectTo: PASSWORD_RESET_URL})
      if (disposed || !form.isConnected) return
      if (result.error) {
        if (result.error.status === 429) {
          error.textContent = 'Please wait a minute before requesting another reset link.'
          allowedAt = Date.now() + 60000
        } else error.textContent = 'Could not request a reset link. Check your connection and try again.'
      } else {
        // Same message whether or not an account exists for this email.
        status.textContent = 'If an account uses that email, you’ll receive a reset link. Check your inbox and spam folder, then return here to sign in.'
        allowedAt = Date.now() + 60000
        form.reset()
      }
    } catch {
      if (!disposed && form.isConnected) error.textContent = 'Could not request a reset link. Check your connection and try again.'
    } finally {
      pending = false
      if (!disposed && form.isConnected) {
        const update = () => {
          const seconds = Math.max(0, Math.ceil((allowedAt - Date.now()) / 1000))
          button.disabled = seconds > 0
          button.textContent = seconds ? `Send again in ${seconds}s` : 'Send reset link'
          if (!seconds && timer) { clearInterval(timer); timer = undefined }
        }
        update()
        if (allowedAt > Date.now()) timer = setInterval(update, 1000)
      }
    }
  }
  return { dispose() { disposed = true; if (timer) clearInterval(timer) } }
}
