import {Browser} from './native-browser'

export const chatMediaRights = 'Only share photos, GIFs, or logos you own or have permission to use.'

export const chatIconSupportHtml = `<div class="chat-icon-support">
 <button type="button" class="secondary" data-chat-icon-support>Contact support about this icon</button>
 <p class="chat-media-rights">Include the team or chat name in your report.</p>
 <p role="status" data-chat-icon-support-status hidden></p>
</div>`

export function bindChatIconSupport(host: HTMLElement, current: () => boolean) {
 const button = host.querySelector<HTMLButtonElement>('[data-chat-icon-support]')
 const status = host.querySelector<HTMLElement>('[data-chat-icon-support-status]')
 if (!button || !status) return
 button.onclick = async () => {
  if (button.disabled || !current()) return
  button.disabled = true
  status.hidden = true
  try {
   await Browser.open({url: 'https://www.tenaceiq.com/contact'})
  } catch {
   if (current() && status.isConnected) {
    status.textContent = 'Couldn’t open support. Try again or go to tenaceiq.com/contact.'
    status.hidden = false
   }
  } finally {
   if (button.isConnected) button.disabled = false
  }
 }
}
