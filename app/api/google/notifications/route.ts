import {accountClient,accountResponse} from '@/lib/mobile-account-auth'
import {googleNotificationConfiguration} from '@/lib/google-notification-auth'
import {googlePlayConfiguration} from '@/lib/google-play-server'
import {handleGoogleNotification} from '@/lib/google-notifications'

export const runtime='nodejs'
export const maxDuration=60
export async function POST(request:Request){
 const configuration=googleNotificationConfiguration(),play=googlePlayConfiguration(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
 if(!configuration||!play||play.mode!=='test'||!key)return accountResponse({ok:false,code:'google_notification_unavailable'},503,{'Retry-After':'60'})
 return handleGoogleNotification(request,{configuration,play,service:()=>accountClient(key)})
}
