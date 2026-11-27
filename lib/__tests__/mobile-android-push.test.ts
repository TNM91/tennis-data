import {expect,it,vi} from 'vitest'
import type {Session,SupabaseClient} from '@supabase/supabase-js'
import type {PushNotificationsPlugin} from '@capacitor/push-notifications'
vi.mock('../../mobile/src/build-scope',()=>({firstPartyBuild:true}))
import {createNativePush,nativePushRequest} from '../../mobile/src/native-push'
import {Capacitor} from '@capacitor/core'
import {coachAlertRequest} from '../../mobile/src/coach-alerts'
import {nativePushPlatformHeader} from '../native-activity-push-token'
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const session=(id=owner)=>({access_token:'synthetic-bearer',user:{id}} as Session)
const token='CaseSensitive_Firebase_Token:1234567890'
function fixture(permission='granted') {
  let saved=JSON.stringify({id:'33333333-3333-4333-8333-333333333333',secret:'a'.repeat(64),owner})
  const handlers:Record<string,(value:never)=>void>={}
  const plugin={addListener:vi.fn(async(name:string,fn:(value:never)=>void)=>{handlers[name]=fn;return {remove:vi.fn()}}),
    createChannel:vi.fn(async()=>{}),checkPermissions:vi.fn(async()=>({receive:permission})),requestPermissions:vi.fn(),
    register:vi.fn(async()=>{handlers.registration({value:token} as never)}),unregister:vi.fn(async()=>{}),removeAllDeliveredNotifications:vi.fn(async()=>{})}
  const request=vi.fn(async(_session:Session,data?:unknown)=>data?{ok:true}:{ok:true,available:true})
  const storage={getItem:vi.fn(async()=>saved),setItem:vi.fn(async(_key:string,value:string)=>{saved=value}),removeItem:vi.fn()}
  const client={auth:{getSession:vi.fn(async()=>({data:{session:session()},error:null}))}} as unknown as SupabaseClient
  const onCoachActivityOpen=vi.fn(),onHitOpen=vi.fn(),onReceive=vi.fn()
  const controller=createNativePush(client,vi.fn(),{platform:'android',plugin:plugin as unknown as PushNotificationsPlugin,storage,request,onCoachActivityOpen,onHitOpen,onReceive})
  return {controller,plugin,request,storage,handlers,onCoachActivityOpen,onHitOpen,onReceive,saved:()=>JSON.parse(saved)}
}
it('uses a separate Android registration endpoint with the same bounded bearer transport',async()=>{
  const transport={get:vi.fn<(options:unknown)=>Promise<{status:number;data:{ok:boolean;available:boolean}}>>().mockResolvedValue({status:200,data:{ok:true,available:true}})}
  await nativePushRequest(session(),undefined,transport as never,true,'android')
  expect(transport.get.mock.calls[0][0]).toMatchObject({url:'https://www.tenaceiq.com/api/mobile/first-party/android-alerts',
    headers:{Authorization:'Bearer synthetic-bearer'},disableRedirects:true,connectTimeout:12000,readTimeout:12000})
})
it('restores Android opt-in with case-sensitive FCM tokens and a private channel, then revokes before logout',async()=>{
  const f=fixture();f.controller.setSession(session())
  await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true))
  expect(f.storage.getItem).toHaveBeenCalledWith('native-android-hit-push-installation-v1')
  expect(f.request.mock.calls.some(([,data])=>(data as {token?:string})?.token===token)).toBe(true)
  expect(f.plugin.createChannel).toHaveBeenCalledWith(expect.objectContaining({id:'tenaceiq_activity',importance:4,visibility:0}))
  expect(f.plugin.requestPermissions).not.toHaveBeenCalled()
  await f.controller.beforeSignOut(owner)
  expect(f.request.mock.calls.at(-1)?.[1]).toMatchObject({enabled:false});expect(f.saved().owner).toBe('')
  expect(f.plugin.removeAllDeliveredNotifications).toHaveBeenCalled();f.controller.dispose()
})
it('honors Android denial without registering and routes only the signed-in recipient’s coaching tap',async()=>{
  const f=fixture('denied');f.controller.setSession(session())
  await vi.waitFor(()=>expect(f.saved().owner).toBe(''))
  expect(f.plugin.register).not.toHaveBeenCalled()
  const notice='44444444-4444-4444-8444-444444444444',href='/mylab?coachActivityNotice='+notice
  f.handlers.pushNotificationActionPerformed({notification:{data:{recipient:other,href}}} as never)
  expect(f.onCoachActivityOpen).not.toHaveBeenCalled()
  f.handlers.pushNotificationActionPerformed({notification:{data:{recipient:owner,href}}} as never)
  expect(f.onCoachActivityOpen).toHaveBeenCalledExactlyOnceWith(notice,owner);f.controller.dispose()
})
it('keeps sign-out blocked when registration revocation cannot be confirmed',async()=>{
  const f=fixture();f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true))
  f.request.mockRejectedValueOnce(Error('offline'))
  await expect(f.controller.beforeSignOut(owner)).rejects.toThrow('offline')
  expect(f.saved().owner).toBe(owner);f.controller.dispose()
})
it('checks the Android provider when reading the shared coaching alert preference',async()=>{
  const platform=vi.spyOn(Capacitor,'getPlatform').mockReturnValue('android')
  try {
    const client={auth:{getSession:async()=>({data:{session:session()},error:null})}} as unknown as SupabaseClient
    const send=vi.fn(async()=>({status:200,data:{ok:true,owner,enabled:false,available:true}}))
    expect(await coachAlertRequest(client,owner,()=>true,undefined,send as never)).toEqual({enabled:false,available:true})
    expect(send.mock.calls[0]).toBeDefined()
    const options=(send.mock.calls as unknown as [string,{headers:Record<string,string>}][])[0][1]
    expect(options.headers[nativePushPlatformHeader]).toBe('android')
  } finally { platform.mockRestore() }
})
