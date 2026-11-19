import {openingPreferences, openingScreenChoices, type OpeningChoice} from './opening-screen'

export function mountOpeningScreenSettings(host: HTMLElement, owner: string, current: () => boolean) {
  let disposed = false, busy = true, saved: OpeningChoice | null = null
  const active = () => !disposed && host.isConnected && current()
  const preferences = openingPreferences(owner)
  const id = 'opening-screen-' + crypto.randomUUID()
  host.innerHTML = `<h2>Opening screen</h2><p>Choose where TenAceIQ opens on this device.</p>
    <label for="${id}">Open the app to</label><select id="${id}" data-opening-choice disabled>${openingScreenChoices.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>
    <p class="opening-screen-help">Applies when starting fresh. Notifications open their destination, and returning to the app keeps your current work.</p>
    <button type="button" data-opening-save disabled>Save opening screen</button><p class="opening-screen-status" role="status" aria-live="polite"></p>`
  const select = host.querySelector<HTMLSelectElement>('select')!, button = host.querySelector<HTMLButtonElement>('button')!
  const status = host.querySelector<HTMLElement>('[role=status]')!
  const controls = () => {select.disabled = busy; button.disabled = busy || select.value === saved}
  select.onchange = () => {if (active()) {status.textContent = 'Applies the next time you start the app.'; controls()}}
  button.onclick = async () => {
    if (!active() || busy) return
    busy = true; controls(); status.textContent = 'Saving opening screen…'
    const choice = select.value as OpeningChoice
    try {
      await preferences.save(choice)
      if (active()) {saved = choice; status.textContent = 'Opening screen saved on this device.'}
    } catch {if (active()) status.textContent = 'Couldn’t save the opening screen. Your selection is kept here; try saving again.'}
    finally {if (active()) {busy = false; controls()}}
  }
  void preferences.read().then(choice => {
    if (active()) {saved = choice; select.value = choice; status.textContent = ''}
  }).catch(() => {if (active()) status.textContent = 'The saved choice couldn’t load. Choose an opening screen and save it again.'})
    .finally(() => {if (active()) {busy = false; controls()}})
  return {dispose() {disposed = true; host.replaceChildren()}}
}
