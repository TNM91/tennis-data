import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {getNativeAuthStorage} from '../../lib/native-auth-storage'
import {readTiqHistory, readTiqWrite, type TiqCursor, type TiqWrite} from '../../lib/tiq-self-assessment'
import {scenarioOwner} from './captain-scenarios-data'
import type {CoachSend} from './coach-workspace-data'

const transport: CoachSend = (method, options) => method === 'GET' ? CapacitorHttp.get(options) : CapacitorHttp.post(options)
export class TiqAccountError extends Error {
  constructor(public status: number) {
    super(status === 409 ? 'Your rating or coach connection changed. Refresh to review the latest information.'
      : status === 403 ? 'This coach connection is no longer available.'
        : status === 401 ? 'Sign in again to open your account rating.'
          : 'Your account rating couldn’t be confirmed. Check your connection and try again.')
  }
}
async function request(client: SupabaseClient, owner: string, current: () => boolean, options: {cursor?: TiqCursor | null; student?: string | null; write?: TiqWrite}, send: CoachSend) {
  const session = await scenarioOwner(client, owner, current)
  const query = new URLSearchParams()
  if (options.cursor) query.set('cursor', JSON.stringify(options.cursor))
  if (options.student) query.set('student', options.student)
  const response = await send(options.write ? 'POST' : 'GET', {
    url: 'https://www.tenaceiq.com/api/mobile/first-party/tiq' + (query.size ? '?' + query : ''),
    headers: {Authorization: 'Bearer ' + session.access_token, 'Cache-Control': 'no-store', 'Content-Type': 'application/json'},
    webFetchExtra: {cache: 'no-store'}, disableRedirects: true, responseType: 'json', connectTimeout: 12000, readTimeout: 20000,
    ...(options.write ? {data: options.write} : {}),
  })
  await scenarioOwner(client, owner, current)
  if (response.status !== 200) throw new TiqAccountError(response.status)
  const data = response.data
  if (!data || data.ok !== true || data.owner !== owner || data.releaseScope !== 'first-party'
    || (options.write && data.id !== options.write.id)) throw new TiqAccountError(503)
  return data
}
export async function loadTiqAccount(client: SupabaseClient, owner: string, current: () => boolean,
  options: {cursor?: TiqCursor | null; student?: string | null} = {}, send = transport) {
  return readTiqHistory(await request(client, owner, current, options, send), owner, options.student ?? null)
}
export async function writeTiqAccount(client: SupabaseClient, owner: string, current: () => boolean, write: TiqWrite, send = transport) {
  await request(client, owner, current, {write: readTiqWrite(write)}, send)
}
const pendingKey = (owner: string) => 'tiq-account-pending:v1:' + owner
const storage = () => getNativeAuthStorage() ?? localStorage
export async function readPendingTiq(owner: string): Promise<Extract<TiqWrite, {kind: 'save'}> | null> {
  const raw = await storage().getItem(pendingKey(owner))
  if (!raw) return null
  try {const write = readTiqWrite(JSON.parse(raw)); if (write.kind === 'save') return write} catch {throw new TiqAccountError(503)}
  throw new TiqAccountError(503)
}
export async function rememberPendingTiq(owner: string, write: Extract<TiqWrite, {kind: 'save'}>) {
  await storage().setItem(pendingKey(owner), JSON.stringify(readTiqWrite(write)))
}
export async function clearPendingTiq(owner: string) {await storage().removeItem(pendingKey(owner))}
export async function deviceTiqId(owner: string, date: string, answers: unknown) {
  const validated = readTiqWrite({kind: 'save', id: '00000000-0000-4000-8000-000000000000', date, answers, version: 1, expectedHead: null})
  const source = JSON.stringify([owner, date, Object.entries(validated.kind === 'save' ? validated.answers : {}).sort(([a], [b]) => a.localeCompare(b))])
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))).slice(0, 16)
  bytes[6] = (bytes[6] & 15) | 128; bytes[8] = (bytes[8] & 63) | 128
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
  return [hex.slice(0,8), hex.slice(8,12), hex.slice(12,16), hex.slice(16,20), hex.slice(20)].join('-')
}
