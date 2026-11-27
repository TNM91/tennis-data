import {beforeEach,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({apple:vi.fn(),android:vi.fn()}))
vi.mock('../native-chat-push-server',()=>({nativePushConfiguration:()=>null,deliverAppleNotifications:mocks.apple}))
vi.mock('../android-push-server',()=>({androidPushConfiguration:()=>null,deliverAndroidNotification:mocks.android}))
import {deliverActivityNotifications} from '../native-activity-push-server'
const id='11111111-1111-4111-8111-111111111111'
const device=(token:string)=>({installation_id:id,profile_id:id,device_token:token,updated_at:'2026-11-27T00:00:00Z'})
const request=(token:string)=>({device:device(token),href:'/coach?notice='+id,collapseId:id,expiresAt:0})
const payload=(recipient:string,href:string)=>({recipient,href,aps:{alert:{title:'TenAceIQ',body:'You have a coaching update.'},sound:'default'}})
beforeEach(()=>{vi.clearAllMocks();mocks.android.mockResolvedValue({status:200});mocks.apple.mockImplementation(async rows=>rows.map((r:{device:unknown})=>({device:r.device,result:{status:200},expired:false})))})
it('routes mixed provider tokens without leaking FCM tokens to APNs or altering delivery order',async()=>{
  const rows=[request('a'.repeat(64)),request('fcm:CaseSensitive_Token_1234567890')]
  const result=await deliverActivityNotifications(rows,{apple:{} as never,android:{} as never},payload)
  expect(mocks.apple.mock.calls[0][0]).toEqual([rows[0]])
  expect(mocks.android.mock.calls[0][1].token).toBe('CaseSensitive_Token_1234567890')
  expect(result.map(r=>r.device)).toEqual(rows.map(r=>r.device));expect(result.map(r=>r.result.status)).toEqual([200,200])
})
it('keeps missing-provider attempts retryable and expires only explicit unregistration',async()=>{
  const rows=[request('a'.repeat(64)),request('fcm:CaseSensitive_Token_1234567890')]
  mocks.android.mockResolvedValue({status:410})
  const result=await deliverActivityNotifications(rows,{apple:null,android:{} as never},payload)
  expect(result[0]).toMatchObject({result:{status:503},expired:false});expect(result[1].expired).toBe(true)
  expect(mocks.apple).not.toHaveBeenCalled()
})
it('refuses oversized batches and untyped tokens before provider access',async()=>{
  await expect(deliverActivityNotifications([request('untrusted')],{apple:null,android:null},payload)).rejects.toThrow()
  await expect(deliverActivityNotifications(Array.from({length:13},()=>request('a'.repeat(64))),{apple:null,android:null},payload)).rejects.toThrow()
  expect(mocks.apple).not.toHaveBeenCalled();expect(mocks.android).not.toHaveBeenCalled()
})
