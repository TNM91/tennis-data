import {accountClient, accountResponse, readAccountJson, verifiedAccount} from '@/lib/mobile-account-auth'
import {growthSnapshotWire, readGrowthSnapshot, readGrowthWrite} from '@/lib/tiq-growth'
import {tiqUuid} from '@/lib/tiq-self-assessment'

export const runtime = 'nodejs'
export const maxDuration = 30
const json = (body: unknown, status = 200) => accountResponse(body, status, {'Referrer-Policy': 'no-referrer'})
export async function GET(request: Request) {
  const auth = await verifiedAccount(request)
  if (!auth) return json({ok: false}, 401)
  let id: string | null = null
  try {
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some(key => key !== 'id') || params.getAll('id').length > 1) throw Error()
    if (params.has('id')) id = tiqUuid(params.get('id'))
  } catch {return json({ok: false}, 400)}
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return json({ok: false}, 503)
  try {
    const {data, error} = await accountClient(key).rpc('native_tiq_growth_read', {p_owner: auth.user.id, p_id: id})
    if (error || data?.ok !== true) return json({ok: false}, data?.status === 403 ? 403 : 503)
    return json({...growthSnapshotWire(readGrowthSnapshot(data, auth.user.id)), releaseScope: 'first-party'})
  } catch {return json({ok: false}, 503)}
}
export async function POST(request: Request) {
  const auth = await verifiedAccount(request)
  if (!auth) return json({ok: false}, 401)
  if (new URL(request.url).search) return json({ok: false}, 400)
  let write
  try {write = readGrowthWrite(await readAccountJson(request, 4096))}
  catch {return json({ok: false, message: 'Review your practice target, dates and notes.'}, 400)}
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return json({ok: false}, 503)
  try {
    const {data, error} = await accountClient(key).rpc('write_native_tiq_growth', {p_owner: auth.user.id, p_write: write})
    if (error) return json({ok: false}, 503)
    if (data !== 200) return json({ok: false}, [400,403,404,409,413].includes(data) ? data : 503)
    return json({ok: true, owner: auth.user.id, id: write.id, operation: write.operation, releaseScope: 'first-party'})
  } catch {return json({ok: false}, 503)}
}
