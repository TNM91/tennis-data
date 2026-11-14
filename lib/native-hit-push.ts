import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {deliverAppleNotifications,nativePushConfiguration} from './native-chat-push-server'
import {teamChatMessageId} from './team-chat-cursor'

export {nativePushConfigured as nativeHitPushConfigured} from './native-chat-push-server'

type Claim={
  reminder_id:string;attempt_id:string;installation_id:string;profile_id:string;device_token:string;
  updated_at:string;room_id:string;hit_id:string;starts_at:string;
}
function nativeHitPayload(recipient:string,href:string) {
  return {aps:{alert:{title:'TenAceIQ',body:'Your hitting plan is coming up.'},sound:'default'},recipient,href}
}

export async function sendDueNativeHitPush(service:SupabaseClient,hit?:string) {
  const config=nativePushConfiguration()
  if (!config) return {attempted:0,failed:0}
  const claim=await service.rpc('claim_native_hit_push',hit?{p_hit:hit}:{}).abortSignal(AbortSignal.timeout(5000)).retry(false)
  if (claim.error || !Array.isArray(claim.data) || claim.data.length>12) throw Error('Hit reminder claim unavailable')
  const rows=claim.data as Claim[]
  if (rows.some(row=>!row||![row.reminder_id,row.attempt_id,row.installation_id,row.profile_id,row.room_id,row.hit_id].every(teamChatMessageId)
      || !/^[a-f0-9]{64,256}$/.test(row.device_token) || !Number.isFinite(Date.parse(row.starts_at))
      || !Number.isFinite(Date.parse(row.updated_at)))) throw Error('Invalid hit reminder claim')
  if (!rows.length) return {attempted:0,failed:0}
  const current=await service.rpc('native_hit_push_current',{
    p_reminders:rows.map(row=>row.reminder_id),p_attempts:rows.map(row=>row.attempt_id),
    p_device_versions:rows.map(row=>row.updated_at),
  }).abortSignal(AbortSignal.timeout(4000)).retry(false)
  if (current.error || !Array.isArray(current.data) || current.data.length>rows.length) throw Error('Hit reminder eligibility unavailable')
  const eligible=new Set(current.data.map(row=>row.attempt_id))
  const outcomes=await deliverAppleNotifications(rows.filter(row=>eligible.has(row.attempt_id)&&Date.parse(row.starts_at)>Date.now()).map(row=>({
    device:row,href:'/chats?room='+row.room_id+'&hit='+row.hit_id,collapseId:row.room_id,
    expiresAt:0,
  })),config,nativeHitPayload)
  const finished=await Promise.allSettled(outcomes.flatMap(({device,result,expired})=>{
    const code=result.status
    const retry=code===0||code===429||code>=500||code===403
    return retry?[]:[service.rpc('finish_native_hit_push',{p_reminder:device.reminder_id,p_installation:device.installation_id,
      p_attempt:device.attempt_id,p_expired_at:expired?device.updated_at:null}).abortSignal(AbortSignal.timeout(4000)).retry(false)]
  }))
  if (finished.some(result=>result.status==='rejected'||result.value.error)) throw Error('Hit reminder receipt unavailable')
  return {attempted:outcomes.length,failed:outcomes.filter(x=>x.result.status!==200).length}
}
