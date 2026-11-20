import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {readCoachGrowthOverview, type CoachGrowthOverview} from '../../lib/coach-growth-overview'
import {scenarioOwner} from './captain-scenarios-data'
import type {CoachSend} from './coach-workspace-data'
import {html} from './match-details'
export const growthDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
export async function loadCoachGrowthOverview(client: SupabaseClient, owner: string, current: () => boolean, send: CoachSend = (_, o) => CapacitorHttp.get(o)) {
  const session = await scenarioOwner(client, owner, current), day = growthDay()
  const response = await send('GET', {url: 'https://www.tenaceiq.com/api/mobile/coach/overview?day='+day,
    headers: {Authorization: 'Bearer '+session.access_token, 'Cache-Control': 'no-store'}, webFetchExtra: {cache:'no-store'}, disableRedirects:true, responseType:'json', connectTimeout:12000, readTimeout:20000})
  await scenarioOwner(client, owner, current)
  if (response.status !== 200) throw Error('Coach attention couldn’t load. Refresh to try again.')
  return readCoachGrowthOverview(response.data, owner, day)
}
export function coachGrowthOverviewHtml(data: CoachGrowthOverview | null, error: string) {
  const labels = {feedback:'Review check-in', plan:'Plan practice', reassess:'Review progress'}
  return `<section class="tiq-growth-attention" aria-label="Coaching attention"><h3>Up next for your players</h3>${data ? `
    <p>${data.counts.feedback} awaiting feedback · ${data.counts.plan} need a plan · ${data.counts.reassess} progress reviews due</p>
    <div class="coach-record-list">${data.rows.map((row, i) => `<button type="button" class="secondary coach-record" data-growth-attention="${i}"><span><strong>${html(row.name)}</strong><small>${labels[row.kind]} · ${html(new Date(row.since).toLocaleDateString())}</small><small>${html(row.title)}</small></span><span aria-hidden="true">›</span></button>`).join('') || '<p>No outstanding coaching tasks in the records checked.</p>'}</div>
    ${data.more ? '<p>Showing the oldest 25 tasks. Open a player for their full history.</p>' : ''}${data.limited ? '<p>Counts cover the latest 500 players and 2,000 assignments. Search your roster for older records.</p>' : ''}` : `<p role="status">${html(error || 'Loading coaching attention…')}</p>`}</section>`
}
