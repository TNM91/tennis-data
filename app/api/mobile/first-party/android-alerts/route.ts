import {accountClient,accountResponse,readAccountJson,verifiedAccount} from '@/lib/mobile-account-auth'
import {parsePushDevice} from '@/lib/mobile-push-device'
import {androidPushConfiguration} from '@/lib/android-push-server'
import {coachActivityHeader,coachActivityVersion} from '@/lib/coach-activity'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!await verifiedAccount(request)) return accountResponse({ok:false},401)
  return accountResponse({ok:true,available:!!androidPushConfiguration()})
}

export async function POST(request: Request) {
  const account = await verifiedAccount(request)
  if (!account) return accountResponse({ok:false},401)
  try {
    const device = parsePushDevice(await readAccountJson(request,8192),'fcm')
    if (!device) return accountResponse({ok:false},400)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key || device.enabled && !androidPushConfiguration()) return accountResponse({ok:false},503)
    const {data,error} = await accountClient(key).rpc('bind_native_android_activity_push',{
      p_installation:device.installationId,p_secret_hash:device.secretHash,p_profile:account.user.id,
      p_token:device.token,p_enabled:device.enabled,
      p_coach_activity:request.headers.get(coachActivityHeader) === coachActivityVersion,
    }).retry(false)
    return accountResponse({ok:data === true && !error},error ? 503 : data === true ? 200 : 409)
  } catch { return accountResponse({ok:false},503) }
}
