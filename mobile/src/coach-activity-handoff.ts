import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner} from './captain-scenarios-data'
import {coachActivityHref, readCoachActivityHref, type CoachActivity} from '../../lib/coach-activity'
import {updateId} from '../../lib/native-updates-contract'
import {markUpdatesRead} from './updates-data'

export class CoachActivityUnavailableError extends Error {
  constructor() {super('Coaching update unavailable'); this.name = 'CoachActivityUnavailableError'}
}

export async function resolveCoachActivity(client: SupabaseClient, owner: string, current: () => boolean, notice: string) {
  if (!updateId(notice)) throw new CoachActivityUnavailableError()
  const session = await scenarioOwner(client, owner, current)
  const response = await CapacitorHttp.get({url: 'https://www.tenaceiq.com/api/mobile/coach/activity?' + new URLSearchParams({notice}),
    headers: {Authorization: 'Bearer ' + session.access_token, 'Cache-Control': 'no-store'}, responseType: 'json', disableRedirects: true,
    connectTimeout: 12000, readTimeout: 12000, webFetchExtra: {cache: 'no-store'}})
  await scenarioOwner(client, owner, current)
  const data = response.data
  if ([400,403,404].includes(response.status)) throw new CoachActivityUnavailableError()
  if (response.status !== 200) throw Error('Coaching update could not load')
  if (data?.ok !== true || data.owner !== owner || data.notice !== notice || !data.activity) throw new CoachActivityUnavailableError()
  let activity: CoachActivity | null
  try {activity = readCoachActivityHref(coachActivityHref(data.activity))} catch {throw new CoachActivityUnavailableError()}
  if (!activity) throw new CoachActivityUnavailableError()
  await markUpdatesRead(client, owner, current, [notice])
  return activity
}
/** A push carries only a notice ID. Resolve current access before opening work. */
export function createCoachActivityHandoff(host: HTMLElement, client: SupabaseClient, owner: () => string | null, revision: () => number,
  blocked: () => boolean, guard: (open: () => void) => void, open: (activity: CoachActivity, owner: string) => void,
  resolve = resolveCoachActivity, now = () => Date.now(), autoOpen = () => false) {
  const lifetime = 600000
  let pending: {id: string; owner: string; at: number} | null = null, epoch = 0, busy = false, notice = '', disposed = false, failed = false, retryable = false, attempted = false
  let expiry: ReturnType<typeof setTimeout> | undefined
  const clear = () => {clearTimeout(expiry); expiry = undefined; epoch++; pending = null; busy = false; failed = false; retryable = false; attempted = false; notice = ''; host.hidden = true; host.replaceChildren()}
  const valid = (version: number, user: string) => {
    if (disposed || epoch !== version || pending?.owner !== user) return false
    if (owner() !== user || now() - pending.at >= lifetime) {clear(); return false}
    return true
  }
  const render = () => {
    if (!pending || disposed) return
    const item = pending, version = epoch
    host.hidden = false; host.replaceChildren(); host.className = 'app-link-handoff'; host.setAttribute('aria-label', 'Coaching update')
    const status = document.createElement('p'); status.setAttribute('role','status'); status.textContent = notice || 'A coaching update is ready.'
    const button = document.createElement('button'); button.type = 'button'; button.textContent = failed ? retryable ? 'Retry coaching update' : 'Check coaching update' : 'Open coaching update'; button.disabled = busy
    button.onclick = () => {
      if (!button.isConnected || !valid(version,item.owner) || busy) return
      if (blocked()) {notice = 'Close your current form to open this update.'; render(); return}
      const visit = revision(), current = () => valid(version,item.owner) && revision() === visit
      attempted = true
      guard(() => {
        if (!current() || busy) return
        if (blocked()) {notice = 'Close your current form to open this update.'; render(); return}
        busy = true; failed = false; retryable = false; notice = 'Checking your coaching update…'; render()
        void resolve(client,item.owner,current,item.id).then(activity => {
          if (!current()) return
          if (blocked()) {notice = 'Close your current form to open this update.'; return}
          clear(); open(activity,item.owner)
        }).catch(error => {if (current()) {
          failed = true; retryable = !(error instanceof CoachActivityUnavailableError)
          notice = retryable ? 'Couldn’t load this coaching update. Check your connection and sign-in, then retry.'
            : 'This coaching update is unavailable. Check your current work in Coach & training.'
        }})
          .finally(() => {if (valid(version,item.owner)) {if (revision() !== visit) notice = 'Ready to open your coaching update.'; busy = false; render()}})
      })
    }
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'secondary'; dismiss.textContent = '×'; dismiss.setAttribute('aria-label','Dismiss coaching update'); dismiss.onclick = () => {if (dismiss.isConnected && valid(version,item.owner)) clear()}
    host.append(status,button,dismiss)
  }
  const resume = () => {if (pending && valid(epoch,pending.owner) && !busy && !attempted && autoOpen() && !blocked()) host.querySelector<HTMLButtonElement>('button')?.click()}
  return {receive(id: string, recipient: string) {if (disposed || !updateId(id) || recipient !== owner()) return; clearTimeout(expiry); epoch++; pending = {id,owner:recipient,at:now()}; busy = false; failed = false; retryable = false; attempted = false; notice = ''; expiry = setTimeout(clear,lifetime); render(); resume()},
    resume, syncOwner() {if (pending && pending.owner !== owner()) clear()}, clear, dispose() {clear(); disposed = true}}
}
