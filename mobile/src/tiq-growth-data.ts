import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {getNativeAuthStorage} from '../../lib/native-auth-storage'
import {readGrowthSnapshot, readGrowthWrite, type GrowthWrite} from '../../lib/tiq-growth'
import {scenarioOwner} from './captain-scenarios-data'
import type {CoachSend} from './coach-workspace-data'
const transport: CoachSend = (method, options) => method === 'GET' ? CapacitorHttp.get(options) : CapacitorHttp.post(options)
export class GrowthError extends Error {
  constructor(public status: number) {super(status === 409 ? 'This plan changed. Refresh before editing it.' : status === 403 ? 'This account or coach connection is unavailable.' : status === 401 ? 'Sign in again to open your plan.' : 'Your plan couldn’t be confirmed. Check your connection and try again.')}
}
async function request(client: SupabaseClient, owner: string, current: () => boolean, id: string | null, write: GrowthWrite | null, send: CoachSend) {
  const session = await scenarioOwner(client, owner, current)
  const response = await send(write ? 'POST' : 'GET', {url: 'https://www.tenaceiq.com/api/mobile/first-party/tiq/plans'+(!write && id ? '?id='+encodeURIComponent(id) : ''),
    headers: {Authorization: 'Bearer '+session.access_token, 'Cache-Control':'no-store', 'Content-Type':'application/json'}, webFetchExtra:{cache:'no-store'}, disableRedirects:true, responseType:'json', connectTimeout:12000, readTimeout:20000, ...(write ? {data:write} : {})})
  await scenarioOwner(client, owner, current)
  if (response.status !== 200) throw new GrowthError(response.status)
  const data = response.data
  if (!data || data.ok !== true || data.owner !== owner || data.releaseScope !== 'first-party' || write && (data.id !== write.id || data.operation !== write.operation)) throw new GrowthError(503)
  return data
}
export async function loadGrowth(client: SupabaseClient, owner: string, current: () => boolean, id: string | null = null, send = transport) {
  return readGrowthSnapshot(await request(client, owner, current, id, null, send), owner)
}
export async function writeGrowth(client: SupabaseClient, owner: string, current: () => boolean, write: GrowthWrite, send = transport) {
  await request(client, owner, current, null, readGrowthWrite(write), send)
}
const key = (owner: string) => 'tiq-growth-pending:v1:'+owner
const storage = () => getNativeAuthStorage() ?? localStorage
export async function pendingGrowth(owner: string): Promise<GrowthWrite | null> {
  const raw = await storage().getItem(key(owner)); return raw ? readGrowthWrite(JSON.parse(raw)) : null
}
export async function rememberGrowth(owner: string, write: GrowthWrite) {await storage().setItem(key(owner), JSON.stringify(readGrowthWrite(write)))}
export async function clearGrowth(owner: string) {await storage().removeItem(key(owner))}
