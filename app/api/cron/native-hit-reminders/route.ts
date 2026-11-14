import {accountClient,accountResponse} from '@/lib/mobile-account-auth'
import {nativeHitPushConfigured,sendDueNativeHitPush} from '@/lib/native-hit-push'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: Request) {
  const secret=process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get('authorization')!=='Bearer '+secret) return accountResponse({ok:false},401)
  if (!nativeHitPushConfigured()) return accountResponse({ok:true,state:'disabled'})
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return accountResponse({ok:false},503)
  try {
    const result=await sendDueNativeHitPush(accountClient(key))
    if (result.failed) console.warn('Hit reminder delivery incomplete',{failed:result.failed})
    return accountResponse({ok:true,...result})
  } catch {
    console.error('Hit reminder delivery unavailable')
    return accountResponse({ok:false},503)
  }
}
