import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner} from './captain-scenarios-data'
import {coachActivityHref, readCoachActivityHref, type CoachActivity} from '../../lib/coach-activity'
import {updateId} from '../../lib/native-updates-contract'
import {markUpdatesRead} from './updates-data'

export async function resolveCoachActivity(client: SupabaseClient, owner: string, current: () => boolean, notice: string) {
  if (!updateId(notice)) throw Error('Invalid coaching update')
  const session = await scenarioOwner(client, owner, current)
  const response = await CapacitorHttp.get({url: 'https://www.tenaceiq.com/api/mobile/coach/activity?' + new URLSearchParams({notice}),
    headers: {Authorization: 'Bearer ' + session.access_token, 'Cache-Control': 'no-store'}, responseType: 'json', disableRedirects: true,
    connectTimeout: 12000, readTimeout: 12000, webFetchExtra: {cache: 'no-store'}})
  await scenarioOwner(client, owner, current)
  const data = response.data
  if (response.status !== 200 || data?.ok !== true || data.owner !== owner || data.notice !== notice || !data.activity) throw Error('Coaching update unavailable')
  const activity = readCoachActivityHref(coachActivityHref(data.activity))
  if (!activity) throw Error('Coaching update unavailable')
  await markUpdatesRead(client, owner, current, [notice])
  return activity
}
/** A push carries only a notice ID. Resolve current access before opening work. */
export function createCoachActivityHandoff(host: HTMLElement, client: SupabaseClient, owner: () => string | null, revision: () => number,
  blocked: () => boolean, guard: (open: () => void) => void, open: (activity: CoachActivity, owner: string) => void,
  resolve = resolveCoachActivity, now = () => Date.now(), autoOpen = () => false) {
  let pending: {id: string; owner: string; at: number} | null = null, epoch = 0, busy = false, notice = '', disposed = false
  const clear = () => {epoch++; pending = null; busy = false; notice = ''; host.hidden = true; host.replaceChildren()}
  const valid = (version: number, user: string) => !disposed && epoch === version && pending?.owner === user && owner() === user
  const render = () => {
    if (!pending || disposed) return
    host.hidden = false; host.replaceChildren(); host.className = 'app-link-handoff'; host.setAttribute('aria-label', 'Coaching update')
    const status = document.createElement('p'); status.setAttribute('role','status'); status.textContent = notice || 'A coaching update is ready.'
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Open coaching update'; button.disabled = busy
    button.onclick = () => {
      const item = pending
      if (!item || owner() !== item.owner || now() - item.at > 600000) {clear(); return}
      if (blocked()) {notice = 'Close your current form to open this update.'; render(); return}
      guard(() => {
        const version = epoch, visit = revision(), current = () => valid(version,item.owner) && revision() === visit
        if (!current() || busy) return
        busy = true; notice = 'Checking your coaching update…'; render()
        void resolve(client,item.owner,current,item.id).then(activity => {
          if (!current()) return
          if (blocked()) {notice = 'Close your current form to open this update.'; return}
          clear(); open(activity,item.owner)
        }).catch(() => {if (valid(version,item.owner)) notice = 'This coaching update is unavailable. Check your current work in Coach & training.'})
          .finally(() => {if (valid(version,item.owner)) {if (revision() !== visit) notice = 'Ready to open your coaching update.'; busy = false; render()}})
      })
    }
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'secondary'; dismiss.textContent = '×'; dismiss.setAttribute('aria-label','Dismiss coaching update'); dismiss.onclick = clear
    host.append(status,button,dismiss)
  }
  const resume = () => {if (pending && !busy && autoOpen() && !blocked()) host.querySelector<HTMLButtonElement>('button')?.click()}
  return {receive(id: string, recipient: string) {if (disposed || !updateId(id) || recipient !== owner()) return; epoch++; pending = {id,owner:recipient,at:now()}; busy = false; notice = ''; render(); resume()},
    resume, syncOwner() {if (pending && pending.owner !== owner()) clear()}, clear, dispose() {clear(); disposed = true}}
}
