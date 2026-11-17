import {chatIconFromValue, chatIconPresets, readChatIconPreset, type ChatIconPreset} from '../../lib/chat-icon-presets'
import websiteUi from '../generated/website-ui.json'
import {html} from './html'

export function chatIconArtwork(preset: ChatIconPreset) {
 const icon = chatIconPresets.find(entry => entry.id === preset)!
 return `<span class="chat-preset-art" data-chat-preset="${preset}" aria-hidden="true">${websiteUi.icons[icon.glyph]}</span>`
}

export function openPresetChatIcon(
 subject: {name: string; logo?: string; kind: 'Team' | 'Group' | 'Channel'},
 current: () => boolean, save: (preset: ChatIconPreset | null) => Promise<void>, onClose: (changed: boolean) => void,
) {
 const {name, logo, kind} = subject
 const previous = chatIconFromValue(logo) ?? 'initials'
 const initial = html(Array.from(name.trim())[0]?.toUpperCase() || '?')
 const label = kind.toLowerCase()
 const dialog = document.createElement('dialog')
 dialog.className = 'captain-lineup-dialog team-chat-icon-dialog chat-preset-dialog'
 dialog.setAttribute('aria-labelledby', 'chat-preset-title')
 dialog.innerHTML = `<div class="team-chat-icon-heading">
  <h2 id="chat-preset-title" tabindex="-1">${kind === 'Channel' ? 'Chat icon' : kind + ' chat icon'}</h2>
  <button class="secondary" type="button" data-close aria-label="Close ${label} icon editor">Close</button>
 </div>
 <form>
  <fieldset class="chat-preset-options"><legend>Choose an icon</legend>
   ${chatIconPresets.map(icon => `<label><input name="preset" type="radio" value="${icon.id}" ${previous === icon.id ? 'checked' : ''}>
    ${chatIconArtwork(icon.id)}<span>${icon.label}</span></label>`).join('')}
   <label><input name="preset" type="radio" value="initials" ${previous === 'initials' ? 'checked' : ''}>
    <span class="chat-preset-art" aria-hidden="true">${initial}</span><span>Initials</span></label>
  </fieldset>
  <p role="status"></p>
  <div class="team-chat-icon-actions"><button type="submit" aria-label="Save ${label} icon" disabled>Save</button></div>
 </form>`
 const form = dialog.querySelector('form')!
 const options = form.querySelector('fieldset')!
 const button = form.querySelector<HTMLButtonElement>('button')!
 const dismiss = dialog.querySelector<HTMLButtonElement>('[data-close]')!
 const status = form.querySelector<HTMLElement>('[role="status"]')!
 let busy = false, disposed = false
 const dispose = () => { disposed = true; dialog.remove() }
 const close = (changed = false) => { if (!disposed) { dispose(); onClose(changed) } }
 const selection = () => new FormData(form).get('preset')
 form.onchange = () => { button.disabled = busy || selection() === previous }
 form.onsubmit = async event => {
  event.preventDefault()
  const value = selection()
  const preset = value === 'initials' ? null : readChatIconPreset(value)
  if (busy || disposed || !current() || value === previous || preset === undefined) return
  busy = true; options.disabled = true; button.disabled = true; dismiss.disabled = true
  status.textContent = 'Saving icon…'
  try {
   await save(preset)
   if (current()) close(true)
  } catch (error) {
   if (current() && !disposed) status.textContent = error instanceof Error ? error.message : 'Couldn’t save the icon. Try again.'
  } finally {
   busy = false
   if (current() && !disposed) { options.disabled = false; button.disabled = false; dismiss.disabled = false }
  }
 }
 dismiss.onclick = () => { if (!busy) close() }
 dialog.oncancel = event => { event.preventDefault(); if (!busy) close() }
 document.body.append(dialog); dialog.showModal(); dialog.querySelector('h2')!.focus({preventScroll: true})
 return {isOpen: () => !disposed, close: () => { if (!busy) close() }, dispose, keepWhileHidden: true}
}
