import {accountClient, accountResponse, verifiedAccount} from '@/lib/mobile-account-auth'
import {supabaseKey} from '@/lib/supabase-public-config'
import {readCoachActivityHref} from '@/lib/coach-activity'
import {updateId} from '@/lib/native-updates-contract'

export const runtime = 'nodejs'
export const maxDuration = 20
export async function GET(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return accountResponse({ok: false}, 401)
    const params = new URL(request.url).searchParams, notice = params.get('notice')
    if (!updateId(notice) || [...params.keys()].some(k => k !== 'notice') || params.getAll('notice').length !== 1) return accountResponse({ok: false}, 400)
    const owner = account.user.id, client = accountClient(supabaseKey, account.token)
    const {data, error} = await client.from('native_first_party_updates').select('id,recipient_profile_id,href')
      .eq('recipient_profile_id', owner).eq('id', notice).abortSignal(AbortSignal.timeout(8000)).retry(false).maybeSingle()
    if (error) return accountResponse({ok: false}, 503)
    const activity = data?.id === notice && data.recipient_profile_id === owner ? readCoachActivityHref(data.href) : null
    return activity ? accountResponse({ok: true, owner, notice, activity}) : accountResponse({ok: false}, 404)
  } catch { return accountResponse({ok: false}, 503) }
}
