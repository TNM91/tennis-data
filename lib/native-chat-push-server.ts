import 'server-only'
import {connect} from 'node:http2'
import {createHash,createPublicKey,createPrivateKey,sign,type KeyObject} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {buildTeamRoomScopeId,canManageTeamRoom,type TeamRoomScope} from './team-room'
import {chatNotificationRecipients} from './team-chat-safety'
type ApnsConfig={keyId:string;teamId:string;key:KeyObject}
export function nativePushConfiguration():ApnsConfig|null {
 if(process.env.VERCEL_ENV && process.env.VERCEL_ENV!=='production')return null
 if(process.env.APNS_ENABLED!=='true' || !/^[A-Z0-9]{10}$/.test(process.env.APNS_KEY_ID || '') || process.env.APNS_TEAM_ID!=='6C5MPYLRVQ' || !process.env.APNS_PRIVATE_KEY_BASE64)return null
 try{const key=createPrivateKey(Buffer.from(process.env.APNS_PRIVATE_KEY_BASE64,'base64').toString('utf8'));if(key.asymmetricKeyType!=='ec' || key.asymmetricKeyDetails?.namedCurve!=='prime256v1')return null;return {keyId:process.env.APNS_KEY_ID!,teamId:process.env.APNS_TEAM_ID,key}}catch{return null}
}
export const nativePushConfigured=()=>Boolean(nativePushConfiguration())
let cachedProvider:{fingerprint:string;issuedAt:number;token:string}|null=null
export function apnsAuthorization(config:ApnsConfig,now=Math.floor(Date.now()/1000)){
 const fingerprint=config.keyId+':'+config.teamId+':'+createHash('sha256').update(createPublicKey(config.key).export({type:'spki',format:'der'})).digest('hex')
 if(cachedProvider?.fingerprint===fingerprint && now>=cachedProvider.issuedAt && now-cachedProvider.issuedAt<2700)return cachedProvider.token
 const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url')
 const body=encode({alg:'ES256',kid:config.keyId})+'.'+encode({iss:config.teamId,iat:now})
 const token=body+'.'+sign('sha256',Buffer.from(body),{key:config.key,dsaEncoding:'ieee-p1363'}).toString('base64url')
 cachedProvider={fingerprint,issuedAt:now,token};return token
}
export function nativeChatPayload(recipient:string,href:string){
 const url=new URL(href,'https://www.tenaceiq.com')
 if(url.origin!=='https://www.tenaceiq.com' || url.pathname!=='/team-room')throw Error('Invalid team destination')
 return {aps:{alert:{title:'TenAceIQ',body:'You have a new team message.'},sound:'default'},recipient,href:url.pathname+url.search}
}
type Device={installation_id:string;profile_id:string;device_token:string;updated_at:string}
type Delivery={status:number;reason?:string}
export async function deliverAppleChat(devices:Device[],href:string,conversationId:string,configuration:ApnsConfig,sendOverride?:(device:Device,payload:ReturnType<typeof nativeChatPayload>)=>Promise<Delivery>){
 const session=sendOverride?null:connect('https://api.push.apple.com')
 session?.on('error',()=>{})
 const deadline=Date.now()+10000,timeout=session?setTimeout(()=>session.destroy(),10000):null
 const authorization=apnsAuthorization(configuration),expired:Device[]=[]
 let index=0,sent=0,failed=0
 const send=sendOverride || ((device:Device,payload:ReturnType<typeof nativeChatPayload>)=>new Promise<Delivery>(resolve=>{
  if(!session || session.destroyed){resolve({status:0});return}
  let settled=false,status=0,body=''
  const finish=(result:Delivery)=>{if(settled)return;settled=true;resolve(result)}
  try{
   const request=session.request({'content-type':'application/json',':method':'POST',':path':'/3/device/'+device.device_token,authorization:'bearer '+authorization,'apns-topic':'com.tenaceiq.app','apns-push-type':'alert','apns-priority':'10','apns-expiration':String(Math.floor(Date.now()/1000)+3600),'apns-collapse-id':conversationId})
   request.setTimeout(5000,()=>{request.close();finish({status:0})})
   request.on('response',headers=>{status=Number(headers[':status'])})
   request.on('data',chunk=>{if(body.length<1024)body+=chunk.toString()})
   request.on('error',()=>finish({status:0}))
   request.on('close',()=>finish({status:0}))
   request.on('end',()=>{let reason='';try{reason=JSON.parse(body).reason || ''}catch{}finish({status,reason})})
   request.end(JSON.stringify(payload))
  }catch{finish({status:0})}
 }))
 try{await Promise.all(Array.from({length:Math.min(4,devices.length)},async()=>{while(index<devices.length){if(Date.now()>deadline)break;const device=devices[index++];let result:Delivery;try{result=await send(device,nativeChatPayload(device.profile_id,href))}catch{result={status:0}}if(result.status===200)sent++;else{failed++;if(result.status===410 || result.status===400 && result.reason==='BadDeviceToken')expired.push(device)}}}))}
 finally{if(timeout)clearTimeout(timeout);session?.destroy()}
 return {sent,failed:failed+devices.length-index,expired}
}
/** Ordinary chat only; fail closed for membership, safety or device storage errors. */
export async function sendNativeTeamChatPush(service:SupabaseClient,input:{conversationId:string;actorId:string;recipients:string[];scope:TeamRoomScope;href:string}){
 const config=nativePushConfiguration()
 if(!config || !input.recipients.length)return {sent:0,failed:0}
 try{
  const devices=await loadNativeChatDevices(service,input)
  const result=await deliverAppleChat(devices,input.href,input.conversationId,config)
  for(const device of result.expired)await service.from('native_push_devices').update({enabled:false}).eq('installation_id',device.installation_id).eq('device_token',device.device_token).eq('updated_at',device.updated_at)
  if(result.failed)console.warn('Native team alert delivery incomplete',{failed:result.failed})
  return {sent:result.sent,failed:result.failed}
 }catch{console.warn('Native team alerts unavailable');return {sent:0,failed:input.recipients.length}}
}

export async function loadNativeChatDevices(service:SupabaseClient,input:{conversationId:string;actorId:string;recipients:string[];scope:TeamRoomScope}){
 const candidates=Array.from(new Set(input.recipients.filter(id=>id!==input.actorId))).slice(0,100)
 if(!candidates.length)return []
 const [links,participants,removals]=await Promise.all([
   service.from('team_profile_links').select('profile_user_id,team_name,league_name,flight,team_role,team_roles').in('profile_user_id',candidates).eq('status','accepted').limit(1000),
   service.from('internal_conversation_participants').select('profile_id,muted').eq('conversation_id',input.conversationId).in('profile_id',candidates),
   service.from('team_room_member_removals').select('profile_id').eq('conversation_id',input.conversationId).in('profile_id',candidates),
  ])
 if(links.error || participants.error || removals.error || !links.data || links.data.length>=1000)throw Error('membership')
 const removed=new Set((removals.data || []).map(row=>row.profile_id)),scopeId=buildTeamRoomScopeId(input.scope)
 const accepted=new Set(links.data.filter(row=>buildTeamRoomScopeId({teamName:row.team_name,leagueName:row.league_name,flight:row.flight})===scopeId && (!removed.has(row.profile_user_id) || canManageTeamRoom(row.team_roles?.length?row.team_roles:[row.team_role]))).map(row=>row.profile_user_id))
 const members=(participants.data || []).filter(row=>candidates.includes(row.profile_id) && !row.muted && accepted.has(row.profile_id)).map(row=>String(row.profile_id))
 const recipients=await chatNotificationRecipients(service,input.actorId,members)
 if(!recipients.length)return []
 const devices=await service.from('native_push_devices').select('installation_id,profile_id,device_token,updated_at').in('profile_id',recipients).eq('enabled',true).gt('expires_at',new Date().toISOString()).limit(100)
 if(devices.error)throw Error('devices')
  return (devices.data || []) as Device[]
}
