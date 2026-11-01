import {afterEach,describe,it,expect,vi} from 'vitest'
import {generateKeyPairSync,verify} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
vi.mock('server-only',()=>({}))
import {loadNativeChatDevices,apnsAuthorization,deliverAppleChat,nativeChatPayload,nativePushConfiguration,sendNativeTeamChatPush} from '../native-chat-push-server'
import {bindPushDevice,parsePushDevice} from '../mobile-push-device'
const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),configuration={key:key.privateKey,keyId:'ABCDEFGHIJ',teamId:'6C5MPYLRVQ'}
const installationId='e9adacbd-f9ba-4da1-b99d-601cf5abc8bc',secret='a'.repeat(64),token='b'.repeat(64)
afterEach(()=>vi.unstubAllEnvs())
describe('Apple team alert boundaries',()=>{
 it('validates credentials without exposing secrets and signs a verifiable ES256 provider token',()=>{
  vi.stubEnv('APNS_ENABLED','false');expect(nativePushConfiguration()).toBeNull()
  vi.stubEnv('APNS_ENABLED','true');vi.stubEnv('APNS_KEY_ID',configuration.keyId);vi.stubEnv('APNS_TEAM_ID',configuration.teamId)
  vi.stubEnv('APNS_PRIVATE_KEY_BASE64','invalid')
  expect(nativePushConfiguration()).toBeNull()
  vi.stubEnv('APNS_PRIVATE_KEY_BASE64',Buffer.from(key.privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'))
  expect(nativePushConfiguration()).toMatchObject({keyId:configuration.keyId})
  const jwt=apnsAuthorization(configuration,123),[header,payload,signature]=jwt.split('.')
  expect(JSON.parse(Buffer.from(payload,'base64url').toString())).toEqual({iss:configuration.teamId,iat:123})
  expect(apnsAuthorization(configuration,124)).toBe(jwt)
  expect(apnsAuthorization(configuration,3000)).not.toBe(jwt)
  expect(verify('sha256',Buffer.from(header+'.'+payload),{key:key.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url'))).toBe(true)
 })
 it('uses generic lock-screen text and permits only the fixed team destination',()=>{
  expect(nativeChatPayload('owner','/team-room?team=Team&league=L').aps.alert).toEqual({title:'TenAceIQ',body:'You have a new team message.'})
  expect(()=>nativeChatPayload('owner','https://attacker.example/team-room')).toThrow()
 })
 it('limits concurrent delivery, counts failures, and only retires invalid device responses',async()=>{
  const devices=Array.from({length:11},(_,i)=>({installation_id:String(i),profile_id:'owner',device_token:token,updated_at:'time'}))
  let active=0,peak=0
  const result=await deliverAppleChat(devices,'/team-room?team=T&league=L','room',configuration,async device=>{
   active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--
   return device.installation_id==='0'?{status:410}:device.installation_id==='1'?{status:400,reason:'BadDeviceToken'}:device.installation_id==='2'?{status:403,reason:'InvalidProviderToken'}:{status:200}
  })
  expect(peak).toBe(4);expect(result.sent).toBe(8);expect(result.failed).toBe(3);expect(result.expired.map(device=>device.installation_id)).toEqual(['0','1'])
 })
 it('sends each recipient’s absolute badge to every device, including zero, and preserves unknown badges',async()=>{
  const ids=['one','one','two','unknown'],devices=ids.map((profile_id,i)=>({installation_id:String(i),profile_id,device_token:token,updated_at:'time'}))
  const sent:Record<string,unknown>[]=[]
  const send=vi.fn(async(_device:unknown,payload:unknown)=>{sent.push(payload as Record<string,unknown>);return {status:200}})
  const result=await deliverAppleChat(devices,'/team-room?team=T&league=L','room',configuration,send,undefined,new Map([['one',7],['two',0]]))
  expect(result.sent).toBe(4);expect(sent.map(p=>(p.aps as {badge?:number}).badge)).toEqual([7,7,0,undefined])
  expect(sent[3].aps).not.toHaveProperty('badge');expect(sent.every(p=>JSON.stringify(p).includes('You have a new team message.'))).toBe(true)
 })
 it('omits invalid badge values rather than sending an Apple payload that can suppress the alert',async()=>{
  for(const badge of [-1,101,1.5,NaN]){
   const send=vi.fn<(device:unknown,payload:unknown)=>Promise<{status:number}>>().mockResolvedValue({status:200}),device={installation_id:'one',profile_id:'owner',device_token:token,updated_at:'time'}
   await deliverAppleChat([device],'/team-room?team=T&league=L','room',configuration,send,undefined,new Map([['owner',badge]]))
   expect(send.mock.calls[0][1]).not.toHaveProperty('aps.badge')
  }
 })
 it('fails closed before accessing devices if membership lookup fails',async()=>{
  vi.stubEnv('APNS_ENABLED','true');vi.stubEnv('APNS_KEY_ID',configuration.keyId);vi.stubEnv('APNS_TEAM_ID',configuration.teamId);vi.stubEnv('APNS_PRIVATE_KEY_BASE64',Buffer.from(key.privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'))
  const from=vi.fn(()=>{const q:Record<string,unknown>={then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(resolve({error:{},data:null}))};for(const method of ['select','in','eq','limit'])q[method]=()=>q;return q})
  const warning=vi.spyOn(console,'warn').mockImplementation(()=>{})
  expect(await sendNativeTeamChatPush({from} as unknown as SupabaseClient,{actorId:'actor',conversationId:'room',recipients:['other'],scope:{teamName:'T',leagueName:'L',flight:'4'},href:'/team-room?team=T&league=L'})).toEqual({sent:0,failed:1})
  expect(from.mock.calls.flat()).not.toContain('native_push_devices');warning.mockRestore()
 })
 it('filters wrong scope, removed players, muted members, blocks and the sender before device lookup',async()=>{
  const ids=['allowed','removed','captain','muted','wrong-scope','blocked','actor']
  const results:Record<string,unknown>={
   team_profile_links:{data:ids.map(id=>({profile_user_id:id,team_name:'T',league_name:'L',flight:id==='wrong-scope'?'5':'4',team_roles:id==='captain'?['captain']:['player']}))},
   internal_conversation_participants:{data:ids.map(id=>({profile_id:id,muted:id==='muted'}))},
   team_room_member_removals:{data:[{profile_id:'removed'},{profile_id:'captain'}]},
   team_chat_blocks:{data:[{owner_user_id:'blocked'}]},
   native_push_devices:{data:[{profile_id:'allowed'}]},
  }
  const calls:{table:string;method:string;args:unknown[]}[]=[]
  const service={from:(table:string)=>{const q:Record<string,unknown>={then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(resolve(results[table]))};for(const method of ['select','in','eq','gt','limit'])q[method]=(...args:unknown[])=>{calls.push({table,method,args});return q};return q}} as unknown as SupabaseClient
  await loadNativeChatDevices(service,{actorId:'actor',conversationId:'room',recipients:ids,scope:{teamName:'T',leagueName:'L',flight:'4'}})
  expect(calls).toContainEqual({table:'native_push_devices',method:'in',args:['profile_id',['allowed','captain']]})
  expect(calls).toContainEqual({table:'native_push_devices',method:'eq',args:['enabled',true]})
  expect(calls).toContainEqual({table:'native_push_devices',method:'limit',args:[100]})
 })
 it('hashes installation secrets, ignores supplied owner IDs and requires atomic ownership binding',async()=>{
  const input={installationId,secret,token,enabled:true,userId:'attacker'}
  expect(parsePushDevice({...input,secret:'short'})).toBeNull();expect(parsePushDevice({...input,token:'not-token'})).toBeNull()
  const rpc=vi.fn().mockResolvedValue({data:true,error:null})
  expect(await bindPushDevice({rpc} as unknown as SupabaseClient,'verified-owner',input)).toEqual({ok:true,status:200})
  expect(rpc.mock.calls[0][1]).toMatchObject({p_profile:'verified-owner',p_installation:installationId,p_token:token,p_enabled:true})
  expect(rpc.mock.calls[0][1].p_secret_hash).toHaveLength(64);expect(rpc.mock.calls[0][1].p_secret_hash).not.toBe(secret)
  rpc.mockResolvedValue({data:false,error:null});expect((await bindPushDevice({rpc} as unknown as SupabaseClient,'owner',input)).status).toBe(409)
  rpc.mockResolvedValue({error:{}});expect((await bindPushDevice({rpc} as unknown as SupabaseClient,'owner',input)).status).toBe(503)
 })
 it('requires the parent mapping and respects both team and room mute without a captain removal bypass',async()=>{
  const candidates=['allowed','room-muted','team-muted','removed-captain','archived','actor'],calls:{table:string;method:string;args:unknown[]}[]=[]
  const service={from:(table:string)=>{let selected='';const data=()=>table==='team_chat_rooms'?{parent_conversation_id:'parent',team_name:'T',league_name:'L',flight:'4'}:table==='internal_conversations'?{related_entity_id:'t__l__4',metadata:{teamName:'T',leagueName:'L',flight:'4'}}:table==='team_profile_links'?candidates.map(id=>({profile_user_id:id,team_name:'T',league_name:'L',flight:'4',team_roles:id==='removed-captain'?['captain']:['player'],archived_at:id==='archived'?'time':null})):table==='internal_conversation_participants'?candidates.map(id=>({profile_id:id,muted:selected==='child'?id==='room-muted':id==='team-muted'})):table==='team_room_member_removals'?[{profile_id:'removed-captain'}]:[];const q:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve({data:data(),error:null})),maybeSingle:async()=>({data:data(),error:null})};for(const method of ['select','in','eq','gt','limit'])q[method]=(...args:unknown[])=>{calls.push({table,method,args});if(method==='eq'&&args[0]==='conversation_id')selected=String(args[1]);return q};return q}} as unknown as SupabaseClient
  await loadNativeChatDevices(service,{actorId:'actor',conversationId:'child',parentConversationId:'parent',recipients:candidates,scope:{teamName:'T',leagueName:'L',flight:'4'}})
  expect(calls).toContainEqual({table:'native_push_devices',method:'in',args:['profile_id',['allowed']]})
  expect(calls).toContainEqual({table:'team_chat_rooms',method:'eq',args:['parent_conversation_id','parent']})
 })

})
