import {describe,it,expect,vi} from 'vitest'
import type {Session,SupabaseClient} from '@supabase/supabase-js'
import type {PushNotificationsPlugin} from '@capacitor/push-notifications'
import {createNativePush,nativePushRequest,pushTeamDestination} from '../../mobile/src/native-push'
import {createNativeSignOut} from '../../mobile/src/native-sign-out'
const session=(id='owner')=>({access_token:'test-bearer',user:{id}} as Session)
const installation={id:'e9adacbd-f9ba-4da1-b99d-601cf5abc8bc',secret:'a'.repeat(64),owner:'owner'}
function fixture(permission='granted'){
 let saved=JSON.stringify(installation)
 const handlers:Record<string,(value:never)=>void>={},removes:ReturnType<typeof vi.fn>[]=[]
 const plugin={addListener:vi.fn(async(name:string,handler:(value:never)=>void)=>{handlers[name]=handler;const remove=vi.fn();removes.push(remove);return {remove}}),register:vi.fn(async()=>{handlers.registration?.({value:'b'.repeat(64)} as never)}),checkPermissions:vi.fn(async()=>({receive:permission})),requestPermissions:vi.fn(),unregister:vi.fn().mockResolvedValue(undefined),removeAllDeliveredNotifications:vi.fn().mockResolvedValue(undefined)}
 const request=vi.fn(async(_session:Session,data?:unknown)=>data?{ok:true}:{ok:true,available:true})
 const storage={getItem:vi.fn(async()=>saved),setItem:vi.fn(async(_key:string,value:string)=>{saved=value}),removeItem:vi.fn()}
 const client={auth:{getSession:vi.fn(async()=>({data:{session:session()},error:null})),signOut:vi.fn(async()=>({error:null}))}} as unknown as SupabaseClient
 const setBadge=vi.fn<(count:number)=>Promise<{applied:boolean}>>().mockResolvedValue({applied:true}),clearDelivered=vi.fn(async()=>{}),onOpen=vi.fn(),onCoachOpen=vi.fn(),onReceive=vi.fn(),controller=createNativePush(client,onOpen,{platform:'ios',plugin:plugin as unknown as PushNotificationsPlugin,storage,request,clearDelivered,setBadge,onCoachOpen,onReceive})
 return {client,plugin,request,storage,handlers,removes,onOpen,onCoachOpen,onReceive,clearDelivered,setBadge,controller,saved:()=>JSON.parse(saved)}
}
const unread=(team=3,coach=2,owner='owner')=>({owner,total:team,teams:[],coach:{available:true,total:coach,connections:[]}})
describe('native team alert lifecycle',()=>{
 it('uses confirmed combined counts, coalesces bursts, caps at 100 and clears after reading without prompting',async()=>{
  const f=fixture();f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));const requests=f.request.mock.calls.length
  f.controller.syncBadge(unread());f.controller.syncBadge(unread(4,2));f.controller.syncBadge(unread(5,2));await vi.waitFor(()=>expect(f.setBadge).toHaveBeenCalledExactlyOnceWith(7))
  f.controller.syncBadge(unread(5,2));await Promise.resolve();expect(f.setBadge).toHaveBeenCalledTimes(1)
  f.controller.syncBadge(unread(100,99));await vi.waitFor(()=>expect(f.setBadge).toHaveBeenLastCalledWith(100))
  f.controller.syncBadge(unread(0,0));await vi.waitFor(()=>expect(f.setBadge).toHaveBeenLastCalledWith(0))
  expect(f.request).toHaveBeenCalledTimes(requests);expect(f.plugin.requestPermissions).not.toHaveBeenCalled();expect(f.onOpen).not.toHaveBeenCalled();expect(f.onCoachOpen).not.toHaveBeenCalled();f.controller.dispose()
 })
 it('retains the icon count through incomplete, unknown, invalid and other-account responses',async()=>{
  const f=fixture();f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));f.controller.syncBadge(unread());await vi.waitFor(()=>expect(f.setBadge).toHaveBeenCalledWith(5))
  for(const value of [null,{...unread(0,0),coach:{available:false,total:0,connections:[]}},{owner:'owner',total:0,teams:[]},unread(0,0,'other'),unread(-1,0),unread(1.5,0),unread(101,0)])f.controller.syncBadge(value)
  await Promise.resolve();expect(f.setBadge).toHaveBeenCalledTimes(1);f.controller.dispose()
 })
 it('waits for an older native badge write before logout cleanup and never reapplies a count afterward',async()=>{
  const f=fixture(),order:string[]=[];let finish!:(value:{applied:boolean})=>void
  f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));f.clearDelivered.mockImplementation(async()=>{order.push('clear')})
  f.setBadge.mockImplementation(async count=>{order.push('badge:'+count);return new Promise(resolve=>{finish=resolve})})
  f.controller.syncBadge(unread());await vi.waitFor(()=>expect(f.setBadge).toHaveBeenCalledWith(5));const logout=f.controller.beforeSignOut('owner');f.controller.syncBadge(unread(8,2));await Promise.resolve();expect(order).toEqual(['badge:5'])
  finish({applied:true});await logout;await Promise.resolve();expect(order).toEqual(['badge:5','clear']);expect(f.setBadge).toHaveBeenCalledTimes(1);expect(f.saved().owner).toBe('');f.controller.dispose()
 })
 it('applies only the latest queued count after a slow native write completes',async()=>{
  const f=fixture();let finish!:(value:{applied:boolean})=>void;f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));f.setBadge.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));f.controller.syncBadge(unread());await vi.waitFor(()=>expect(f.setBadge).toHaveBeenCalledWith(5))
  f.controller.syncBadge(unread(6,2));f.controller.syncBadge(unread(7,2));finish({applied:true});await vi.waitFor(()=>expect(f.setBadge.mock.calls).toEqual([[5],[9]]));f.controller.dispose()
 })
 it('does not publish old-account counts or leak queued badge updates into another login',async()=>{
  const f=fixture();f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));f.controller.syncBadge(unread());f.controller.setSession(session('other'));f.controller.syncBadge(unread(0,0,'other'));f.controller.syncBadge(unread(50,20))
  await vi.waitFor(()=>expect(f.saved().owner).toBe(''));await f.controller.beforeSignOut('other').catch(()=>{});expect(f.setBadge).not.toHaveBeenCalled();expect(f.clearDelivered).toHaveBeenCalled();f.controller.dispose()
 })
 it('holds a count while existing opt-in is restored, without opting a new installation in',async()=>{
  const f=fixture();f.controller.setSession(session());f.controller.syncBadge(unread());await vi.waitFor(()=>expect(f.setBadge).toHaveBeenCalledWith(5));f.controller.dispose()
  const off=fixture();await off.storage.setItem('native-push-installation-v1',JSON.stringify({...installation,owner:''}));off.controller.setSession(session());off.controller.syncBadge(unread());await vi.waitFor(()=>expect(off.request).toHaveBeenCalled());await Promise.resolve();expect(off.setBadge).not.toHaveBeenCalled();expect(off.plugin.register).not.toHaveBeenCalled();expect(off.plugin.requestPermissions).not.toHaveBeenCalled();off.controller.dispose()
 })
 it('treats badge failures as optional, retries only with fresh counts and still allows logout',async()=>{
  const f=fixture(),warn=vi.spyOn(console,'warn').mockImplementation(()=>{});try{f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));f.setBadge.mockRejectedValueOnce(Error('Badge unavailable'));f.controller.syncBadge(unread());await vi.waitFor(()=>expect(warn).toHaveBeenCalledWith('native_chat_badge_unavailable'));await Promise.resolve();expect(f.setBadge).toHaveBeenCalledTimes(1)
  f.controller.syncBadge(unread());await vi.waitFor(()=>expect(f.setBadge).toHaveBeenCalledTimes(2));await f.controller.beforeSignOut();expect(f.clearDelivered).toHaveBeenCalled();f.controller.dispose()}finally{warn.mockRestore()}
 })
 it.each([5,0])('does not confirm an iPhone-refused badge count of %i or retry it without a fresh snapshot',async count=>{
  const f=fixture(),warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
  try{
   f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));const requests=f.request.mock.calls.length
   f.setBadge.mockResolvedValueOnce({applied:false});f.controller.syncBadge(unread(count,0))
   await vi.waitFor(()=>expect(f.setBadge).toHaveBeenCalledExactlyOnceWith(count));await Promise.resolve();expect(f.setBadge).toHaveBeenCalledTimes(1)
   f.controller.syncBadge(unread(count,0));await vi.waitFor(()=>expect(f.setBadge.mock.calls).toEqual([[count],[count]]))
   f.controller.syncBadge(unread(count,0));await Promise.resolve();expect(f.setBadge).toHaveBeenCalledTimes(2)
   expect(f.request).toHaveBeenCalledTimes(requests);expect(f.plugin.requestPermissions).not.toHaveBeenCalled();expect(warn).not.toHaveBeenCalled();expect(f.controller.isEnabled()).toBe(true)
  }finally{f.controller.dispose();warn.mockRestore()}
 })
 it('requires fresh native confirmation after an uncertain write even when the next snapshot matches an older confirmed count',async()=>{
  const f=fixture(),warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
  try{
   f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));f.controller.syncBadge(unread(5,0));await vi.waitFor(()=>expect(f.setBadge).toHaveBeenCalledExactlyOnceWith(5))
   f.setBadge.mockRejectedValueOnce(Error('Native result unavailable'));f.controller.syncBadge(unread(8,0));await vi.waitFor(()=>expect(warn).toHaveBeenCalledWith('native_chat_badge_unavailable'))
   await Promise.resolve();expect(f.setBadge).toHaveBeenCalledTimes(2);f.controller.syncBadge(unread(5,0));await vi.waitFor(()=>expect(f.setBadge.mock.calls).toEqual([[5],[8],[5]]))
   await f.controller.beforeSignOut();expect(f.clearDelivered).toHaveBeenCalled();expect(f.saved().owner).toBe('')
  }finally{f.controller.dispose();warn.mockRestore()}
 })
 it('invalidates counts for owned team and Coach receipts without opening either conversation',async()=>{const f=fixture();f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));const calls=f.request.mock.calls.length;for(const href of ['/team-room?team=T&league=L','/messages?thread=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'])f.handlers.pushNotificationReceived({data:{recipient:'owner',href}} as never);expect(f.onReceive.mock.calls).toEqual([['owner'],['owner']]);expect(f.onOpen).not.toHaveBeenCalled();expect(f.onCoachOpen).not.toHaveBeenCalled();expect(f.request.mock.calls).toHaveLength(calls);expect(f.plugin.requestPermissions).not.toHaveBeenCalled();f.controller.dispose()})
 it('ignores early, malformed, foreign-account, disabled-device and disposed receipts',async()=>{const f=fixture(),own={data:{recipient:'owner',href:'/messages?thread=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}};f.handlers.pushNotificationReceived(own as never);f.controller.setSession(session());await vi.waitFor(()=>expect(f.controller.isEnabled()).toBe(true));for(const data of [null,{recipient:'other',href:'/team-room?team=T&league=L'},{recipient:'owner',href:'/messages?thread=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&owner=other'},{recipient:'owner',href:'https://outside.invalid/team-room?team=T&league=L'}])f.handlers.pushNotificationReceived({data} as never);expect(f.onReceive).not.toHaveBeenCalled();await f.controller.beforeSignOut();f.handlers.pushNotificationReceived(own as never);expect(f.onReceive).not.toHaveBeenCalled();f.controller.setSession(null);f.handlers.pushNotificationReceived(own as never);f.controller.dispose();f.handlers.pushNotificationReceived(own as never);expect(f.onReceive).not.toHaveBeenCalled();expect(f.removes.every(remove=>remove.mock.calls.length===1)).toBe(true)})
 it('removes late action and receipt listeners after disposal',async()=>{const removes=[vi.fn(async()=>{}),vi.fn(async()=>{})],complete:((handle:{remove:()=>Promise<void>})=>void)[]=[];const plugin={addListener:vi.fn(()=>new Promise(resolve=>complete.push(resolve)))} as unknown as PushNotificationsPlugin;const controller=createNativePush({} as SupabaseClient,vi.fn(),{platform:'ios',plugin});controller.dispose();complete.forEach((resolve,index)=>resolve({remove:removes[index]}));await vi.waitFor(()=>expect(removes.every(remove=>remove.mock.calls.length===1)).toBe(true))})
 it('logs out a cold-start account without APNs opt-in despite the Capacitor cleanup registration guard',async()=>{
  const f=fixture();await f.storage.setItem('native-push-installation-v1',JSON.stringify({...installation,owner:''}))
  f.plugin.removeAllDeliveredNotifications.mockRejectedValue(Error('event capacitorDidRegisterForRemoteNotifications not called'))
  f.controller.setSession(session())
  const logout=createNativeSignOut(f.client,owner=>f.controller.beforeSignOut(owner),()=> 'owner')
  await logout('owner')
  expect(f.plugin.register).not.toHaveBeenCalled();expect(f.plugin.requestPermissions).not.toHaveBeenCalled()
  expect(f.plugin.removeAllDeliveredNotifications).not.toHaveBeenCalled();expect(f.clearDelivered).toHaveBeenCalled()
  expect(f.client.auth.signOut).toHaveBeenCalledExactlyOnceWith({scope:'local'});f.controller.dispose()
 })
 it('clears delivered alerts through the native helper when APNs registration fails on a returning opted-in account',async()=>{
  const f=fixture();f.plugin.register.mockRejectedValue(Error('APNs temporarily unavailable'))
  f.plugin.removeAllDeliveredNotifications.mockRejectedValue(Error('event capacitorDidRegisterForRemoteNotifications not called'))
  f.controller.setSession(session());await f.controller.beforeSignOut('owner')
  expect(f.request.mock.calls.at(-1)?.[1]).toMatchObject({enabled:false})
  expect(f.clearDelivered).toHaveBeenCalled();expect(f.saved().owner).toBe('')
  expect(f.plugin.removeAllDeliveredNotifications).not.toHaveBeenCalled();f.controller.dispose()
 })
 it('does not clear account login if the independent native notification cleanup fails',async()=>{
  const f=fixture();await f.storage.setItem('native-push-installation-v1',JSON.stringify({...installation,owner:''}))
  f.controller.setSession(session());await f.controller.beforeSignOut('owner')
  f.clearDelivered.mockRejectedValueOnce(Error('Native cleanup unavailable'))
  const logout=createNativeSignOut(f.client,owner=>f.controller.beforeSignOut(owner),()=> 'owner')
  await expect(logout('owner')).rejects.toThrow('Native cleanup unavailable')
  expect(f.client.auth.signOut).not.toHaveBeenCalled();f.controller.dispose()
 })
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
 it('rejects queued logout cleanup after the expected owner changes',async()=>{const f=fixture();vi.mocked(f.client.auth.getSession).mockResolvedValue({data:{session:session('second-owner')},error:null});f.controller.setSession(session());const task=f.controller.beforeSignOut('owner');f.controller.setSession(session('second-owner'));await expect(task).rejects.toThrow('Account changed');expect(f.client.auth.getSession).not.toHaveBeenCalled();f.controller.dispose()})
 it('does not register on Android or web',async()=>{
  const f=fixture();const controller=createNativePush({} as SupabaseClient,vi.fn(),{platform:'android',plugin:f.plugin as unknown as PushNotificationsPlugin,storage:f.storage,request:f.request})
  controller.setSession(session());await controller.beforeSignOut();expect(f.plugin.register).not.toHaveBeenCalled();controller.dispose();f.controller.dispose()
 })
 it('holds a cold Coach alert until restoration and routes only its current-owner conversation',()=>{const f=fixture(),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';f.handlers.pushNotificationActionPerformed({notification:{data:{recipient:'owner',href:'/messages?thread='+id}}} as never);expect(f.onCoachOpen).not.toHaveBeenCalled();f.controller.setSession(session());expect(f.onCoachOpen).toHaveBeenCalledExactlyOnceWith(id,'owner');expect(f.onOpen).not.toHaveBeenCalled();f.controller.dispose()})
 it('rejects old-owner, injected and signed-out Coach alert taps',()=>{const f=fixture(),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';f.controller.setSession(session());for(const data of [{recipient:'other',href:'/messages?thread='+id},{recipient:'owner',href:'/messages?thread='+id+'&owner=other'},{recipient:'owner',href:'https://evil.example/messages?thread='+id}])f.handlers.pushNotificationActionPerformed({notification:{data}} as never);expect(f.onCoachOpen).not.toHaveBeenCalled();f.controller.setSession(null);f.handlers.pushNotificationActionPerformed({notification:{data:{recipient:'owner',href:'/messages?thread='+id}}} as never);expect(f.onCoachOpen).not.toHaveBeenCalled();f.controller.dispose()})
})
