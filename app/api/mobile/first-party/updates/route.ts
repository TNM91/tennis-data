import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { supabaseKey } from '@/lib/supabase-public-config'
import { confirmUpdatesRead, UPDATE_PAGE_SIZE, updateCategories, updateCursorFilter, validUpdateIds, type UpdateFilter } from '@/lib/native-updates-contract'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status = 200) => accountResponse(
  { ...body, releaseScope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' },
)
const denied = (status: number) => json({ ok: false }, status)
const source = 'native_first_party_updates'

export async function GET(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return denied(401)
    const params = new URL(request.url).searchParams
    const op = params.get('op') ?? 'list'
    const allowed = op === 'count' ? ['op'] : ['op', 'unread', 'category', 'before', 'id']
    if (!['list', 'count'].includes(op) || [...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1)) return denied(400)

    const owner = account.user.id, client = accountClient(supabaseKey, account.token)
    if (op === 'count') {
      const { count, error } = await client.from(source).select('id', { head: true, count: 'exact' })
        .eq('recipient_profile_id', owner).is('read_at', null).retry(false)
      if (error || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return denied(503)
      return json({ ok: true, owner, count })
    }

    const unread = params.get('unread') ?? '0'
    const category = (params.get('category') ?? 'all') as UpdateFilter['category']
    if (!['0', '1'].includes(unread) || !updateCategories.includes(category) || params.has('before') !== params.has('id')) return denied(400)
    let cursor = ''
    if (params.has('before')) {
      try { cursor = updateCursorFilter({ createdAt: params.get('before')!, id: params.get('id')! }) }
      catch { return denied(400) }
    }
    let query = client.from(source)
      .select('id,recipient_profile_id,notification_type,title,body,href,conversation_id,schedule_event_id,read_at,created_at')
      .eq('recipient_profile_id', owner)
    if (unread === '1') query = query.is('read_at', null)
    if (category === 'other') query = query.in('notification_type', ['support', 'system'])
    else if (category !== 'all') query = query.eq('notification_type', category)
    if (cursor) query = query.or(cursor)
    const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(UPDATE_PAGE_SIZE + 1).retry(false)
    if (error || !Array.isArray(data) || data.length > UPDATE_PAGE_SIZE + 1 || data.some(row => row.recipient_profile_id !== owner)) return denied(503)
    return json({ ok: true, owner, rows: data })
  } catch {
    return denied(503)
  }
}

export async function POST(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return denied(401)
    if (new URL(request.url).search) return denied(400)
    const body = await readAccountJson(request, 4096)
    if (!body || Object.keys(body).length !== 1 || !validUpdateIds(body.ids)) return denied(400)
    const ids = body.ids.map(id => id.toLowerCase())
    const owner = account.user.id, client = accountClient(supabaseKey, account.token)
    const { data, error } = await client.rpc('native_first_party_mark_updates_read', { p_ids: ids }).retry(false)
    if (error) return denied(error.code === 'P0001' ? 409 : 503)
    return json({ ok: true, owner, rows: confirmUpdatesRead(data, owner, ids) })
  } catch {
    return denied(503)
  }
}
