import {verifiedAccount,accountClient,readAccountJson} from '@/lib/mobile-account-auth'
import {supabaseKey} from '@/lib/supabase-public-config'
import {nativePushConfigured} from '@/lib/native-chat-push-server'
export const runtime='nodejs'
export const maxDuration=20
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
async function handle(request:Request,write:boolean){
 const account=await verifiedAccount(request);if(!account)return json({ok:false},401)
 if(new URL(request.url).search)return json({ok:false},400)
 try{
  const owner=account.user.id,client=accountClient(supabaseKey,account.token),deadline=AbortSignal.timeout(8000)
  let enabled:boolean|undefined
  if(write){let body;try{body=await readAccountJson(request,300)}catch{return json({ok:false},400)}if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||typeof (body as {enabled?:unknown}).enabled!=='boolean')return json({ok:false},400);enabled=(body as {enabled:boolean}).enabled}
  const result=write?await client.from('internal_notification_preferences').upsert({profile_id:owner,native_coach_alerts_enabled:enabled},{onConflict:'profile_id'}).select('profile_id,native_coach_alerts_enabled').abortSignal(deadline).retry(false).single():await client.from('internal_notification_preferences').select('profile_id,native_coach_alerts_enabled').eq('profile_id',owner).abortSignal(deadline).retry(false).maybeSingle()
  if(result.error||result.data&&(result.data.profile_id!==owner||typeof result.data.native_coach_alerts_enabled!=='boolean')||write&&result.data?.native_coach_alerts_enabled!==enabled)throw Error()
  return json({ok:true,owner,enabled:result.data?.native_coach_alerts_enabled??false,available:nativePushConfigured()})
 }catch{console.warn('native_coach_alert_preference_unavailable');return json({ok:false},503)}
}
export const GET=(request:Request)=>handle(request,false)
export const POST=(request:Request)=>handle(request,true)
