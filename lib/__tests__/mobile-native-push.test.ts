import {describe,it,expect,vi} from 'vitest'
import type {Session,SupabaseClient} from '@supabase/supabase-js'
import type {PushNotificationsPlugin} from '@capacitor/push-notifications'
import {createNativePush,nativePushRequest,pushTeamDestination} from '../../mobile/src/native-push'
const session=(id='owner')=>({access_token:'test-bearer',user:{id}} as Session)
const installation={id:'e9adacbd-f9ba-4da1-b99d-601cf5abc8bc',secret:'a'.repeat(64),owner:'owner'}
function fixture(permission='granted'){
 let saved=JSON.stringify(installation)
 const handlers:Record<string,(value:never)=>void>={},removes:ReturnType<typeof vi.fn>[]=[]
 const plugin={addListener:vi.fn(async(name:string,handler:(value:never)=>void)=>{handlers[name]=handler;const remove=vi.fn();removes.push(remove);return {remove}}),register:vi.fn(async()=>{handlers.registration?.({value:'b'.repeat(64)} as never)}),checkPermissions:vi.fn(async()=>({receive:permission})),requestPermissions:vi.fn(),unregister:vi.fn().mockResolvedValue(undefined),removeAllDeliveredNotifications:vi.fn().mockResolvedValue(undefined)}
 const request=vi.fn(async(_session:Session,data?:unknown)=>data?{ok:true}:{ok:true,available:true})
 const storage={getItem:vi.fn(async()=>saved),setItem:vi.fn(async(_key:string,value:string)=>{saved=value}),removeItem:vi.fn()}
 const client={auth:{getSession:vi.fn(async()=>({data:{session:session()},error:null}))}} as unknown as SupabaseClient
 const onOpen=vi.fn(),controller=createNativePush(client,onOpen,{platform:'ios',plugin:plugin as unknown as PushNotificationsPlugin,storage,request})
 return {plugin,request,storage,handlers,removes,onOpen,controller,saved:()=>JSON.parse(saved)}
}
describe('native team alert lifecycle',()=>{
 it('only opens an owned, fixed-origin team destination',()=>{
  expect(pushTeamDestination({recipient:'owner',href:'/team-room?team=T&league=L&flight=4'},'owner')).toEqual({teamName:'T',leagueName:'L',flight:'4'})
  for(const data of [{recipient:'other',href:'/team-room?team=T&league=L'},{recipient:'owner',href:'https://evil.example/team-room?team=T&league=L'},{recipient:'owner',href:'/team-room?team=T'}])expect(pushTeamDestination(data,'owner')).toBeNull()
 })
 it('uses fixed HTTPS, bearer credentials, no redirects and bounded native timeouts',async()=>{
  const transport={get:vi.fn().mockResolvedValue({status:200,data:{ok:true,available:true}}),post:vi.fn().mockResolvedValue({status:200,data:{ok:true}})}
  await nativePushRequest(session(),undefined,transport as never)
  expect(transport.get.mock.calls[0][0]).toMatchObject({url:'https://www.tenaceiq.com/api/mobile/push',headers:{Authorization:'Bearer test-bearer'},disableRedirects:true,connectTimeout:12000,readTimeout:12000})
  transport.post.mockResolvedValue({status:302,data:{ok:true}});await expect(nativePushRequest(session(),{enabled:true},transport as never)).rejects.toThrow()
 })
 it('restores prior opt-in without prompting and revokes before sign-out',async()=>{
  const f=fixture();f.controller.setSession(session())
  await vi.waitFor(()=>expect(f.request.mock.calls.some(call=>(call[1] as {enabled?:boolean})?.enabled===true)).toBe(true))
  expect(f.plugin.requestPermissions).not.toHaveBeenCalled()
  await f.controller.beforeSignOut()
  expect(f.request.mock.calls.at(-1)?.[1]).toMatchObject({enabled:false,installationId:installation.id,secret:installation.secret})
  expect(f.saved().owner).toBe('');expect(f.plugin.unregister).toHaveBeenCalled();expect(f.removes.every(remove=>remove.mock.calls.length===1)).toBe(false) // action listener lives across screens
  f.controller.dispose()
 })
 it('does not report successful sign-out cleanup when server revocation fails',async()=>{
  const f=fixture();f.controller.setSession(session());await vi.waitFor(()=>expect(f.plugin.register).toHaveBeenCalled())
  await vi.waitFor(()=>expect(f.request.mock.calls.some(call=>(call[1] as {enabled?:boolean})?.enabled===true)).toBe(true))
  f.request.mockRejectedValueOnce(Error('offline'));await expect(f.controller.beforeSignOut()).rejects.toThrow();expect(f.saved().owner).toBe('owner');f.controller.dispose()
 })
 it('revokes existing registration after OS denial and rejects old-account notification taps',async()=>{
  const f=fixture('denied');f.controller.setSession(session())
  await vi.waitFor(()=>expect(f.saved().owner).toBe(''))
  expect(f.plugin.register).not.toHaveBeenCalled()
  f.handlers.pushNotificationActionPerformed({notification:{data:{recipient:'other',href:'/team-room?team=T&league=L'}}} as never)
  expect(f.onOpen).not.toHaveBeenCalled()
  f.handlers.pushNotificationActionPerformed({notification:{data:{recipient:'owner',href:'/team-room?team=T&league=L'}}} as never)
  expect(f.onOpen).toHaveBeenCalledWith({teamName:'T',leagueName:'L',flight:''});f.controller.dispose()
 })
 it('suppresses late registration and old-account taps after switching accounts',async()=>{
  const f=fixture();f.plugin.register.mockImplementation(async()=>{})
  f.controller.setSession(session());await vi.waitFor(()=>expect(f.plugin.register).toHaveBeenCalled())
  f.controller.setSession(session('second-owner'))
  f.handlers.registration({value:'b'.repeat(64)} as never)
  await vi.waitFor(()=>expect(f.plugin.unregister).toHaveBeenCalled())
  await f.controller.beforeSignOut().catch(()=>{})
  expect(f.request.mock.calls.some(call=>(call[1] as {enabled?:boolean})?.enabled===true)).toBe(false)
  f.handlers.pushNotificationActionPerformed({notification:{data:{recipient:'owner',href:'/team-room?team=T&league=L'}}} as never)
  expect(f.onOpen).not.toHaveBeenCalled();f.controller.dispose()
 })
 it('holds a cold-start alert until initial session restoration, but discards signed-out taps',async()=>{
  const f=fixture()
  f.handlers.pushNotificationActionPerformed({notification:{data:{recipient:'owner',href:'/team-room?team=T&league=L'}}} as never)
  expect(f.onOpen).not.toHaveBeenCalled()
  f.controller.setSession(session());expect(f.onOpen).toHaveBeenCalledWith({teamName:'T',leagueName:'L',flight:''})
  await f.controller.beforeSignOut();f.controller.setSession(null);f.onOpen.mockClear()
  f.handlers.pushNotificationActionPerformed({notification:{data:{recipient:'owner',href:'/team-room?team=T&league=L'}}} as never)
  expect(f.onOpen).not.toHaveBeenCalled();f.controller.dispose()
 })
 it('does not register on Android or web',async()=>{
  const f=fixture();const controller=createNativePush({} as SupabaseClient,vi.fn(),{platform:'android',plugin:f.plugin as unknown as PushNotificationsPlugin,storage:f.storage,request:f.request})
  controller.setSession(session());await controller.beforeSignOut();expect(f.plugin.register).not.toHaveBeenCalled();controller.dispose();f.controller.dispose()
 })
})
