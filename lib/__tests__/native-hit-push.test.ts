import {afterEach,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {sendDueNativeHitPush} from '../native-hit-push'
import {deliverAppleNotifications,nativePushConfiguration} from '../native-chat-push-server'

vi.mock('server-only',()=>({}))
vi.mock('../native-chat-push-server',()=>({
  deliverAppleNotifications:vi.fn(),nativePushConfiguration:vi.fn(),
}))
const id=(n:number)=>'92ed28bf-1641-4bcf-a03c-'+String(n).padStart(12,'0')
const device=(n:number)=>({
  reminder_id:id(n),attempt_id:id(n+10),installation_id:id(n+20),profile_id:id(n+30),
  room_id:id(41),hit_id:id(42),device_token:'a'.repeat(64),updated_at:new Date().toISOString(),
  starts_at:new Date(Date.now()+60000).toISOString(),
})
function mockDatabase(claimed:ReturnType<typeof device>[],eligible:string[]) {
  const rpc=vi.fn((name:string)=>{
    const data=name==='claim_native_hit_push'?claimed:name==='native_hit_push_current'?eligible.map(attempt_id=>({attempt_id})):null
    return {abortSignal:()=>({retry:()=>Promise.resolve({data,error:null})})}
  })
  return {rpc,service:{rpc} as unknown as SupabaseClient}
}
afterEach(()=>vi.resetAllMocks())

it('sends only current claims, expires them at the provider immediately, and receipts each device independently',async()=>{
  const rows=Array.from({length:4},(_,i)=>device(i+1))
  const [sent,revoked,expired,unavailable]=rows
  const {rpc,service}=mockDatabase(rows,[sent.attempt_id,expired.attempt_id,unavailable.attempt_id])
  vi.mocked(nativePushConfiguration).mockReturnValue({} as NonNullable<ReturnType<typeof nativePushConfiguration>>)
  vi.mocked(deliverAppleNotifications).mockImplementation(async(requests,_config,payloadFor)=>{
    expect(requests.map(x=>x.device)).toEqual([sent,expired,unavailable])
    expect(requests.some(x=>x.device===revoked)).toBe(false)
    for(const {device,href,expiresAt,collapseId} of requests){
      expect(expiresAt).toBe(0)
      expect(collapseId).toBe(sent.room_id)
      expect(payloadFor(device.profile_id,href)).toEqual({
        aps:{alert:{title:'TenAceIQ',body:'Your hitting plan is coming up.'},sound:'default'},
        recipient:device.profile_id,href:'/chats?room='+sent.room_id+'&hit='+sent.hit_id,
      })
    }
    return [
      {device:sent,result:{status:200},expired:false},
      {device:expired,result:{status:410},expired:true},
      {device:unavailable,result:{status:503},expired:false},
    ]
  })
  expect(await sendDueNativeHitPush(service,sent.hit_id)).toEqual({attempted:3,failed:2})
  expect(rpc.mock.calls[0]).toEqual(['claim_native_hit_push',{p_hit:sent.hit_id}])
  expect(rpc.mock.calls.filter(([name])=>name==='finish_native_hit_push')).toEqual([
    ['finish_native_hit_push',{p_reminder:sent.reminder_id,p_installation:sent.installation_id,p_attempt:sent.attempt_id,p_expired_at:null}],
    ['finish_native_hit_push',{p_reminder:expired.reminder_id,p_installation:expired.installation_id,p_attempt:expired.attempt_id,p_expired_at:expired.updated_at}],
  ])
})

it('returns after one bounded claim lookup when no push is due',async()=>{
  const {rpc,service}=mockDatabase([],[])
  vi.mocked(nativePushConfiguration).mockReturnValue({} as NonNullable<ReturnType<typeof nativePushConfiguration>>)
  expect(await sendDueNativeHitPush(service)).toEqual({attempted:0,failed:0})
  expect(rpc).toHaveBeenCalledExactlyOnceWith('claim_native_hit_push',{})
  expect(deliverAppleNotifications).not.toHaveBeenCalled()
})
