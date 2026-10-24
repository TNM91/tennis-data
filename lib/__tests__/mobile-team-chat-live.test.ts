import {afterEach,describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {watchTeamChat} from '../../mobile/src/team-chat-live'
function fixture(){
 const doc=Object.assign(new EventTarget(),{visibilityState:'visible' as DocumentVisibilityState}),win=new EventTarget()
 const subscriptions:{on:ReturnType<typeof vi.fn>;subscribe:ReturnType<typeof vi.fn>;status?:(status:string)=>void;callbacks:(()=>void)[]}[]=[]
 const client={auth:{getSession:vi.fn().mockResolvedValue({data:{session:{user:{id:'owner'}}},error:null})},removeChannel:vi.fn().mockResolvedValue('ok'),channel:vi.fn(()=>{
  const channel={callbacks:[] as (()=>void)[],on:vi.fn(),subscribe:vi.fn(),status:undefined as ((status:string)=>void)|undefined}
  channel.on.mockImplementation((_type,_filter,callback)=>{channel.callbacks.push(callback);return channel})
  channel.subscribe.mockImplementation(callback=>{channel.status=callback;return channel});subscriptions.push(channel);return channel
 })}
 return {client:client as unknown as SupabaseClient,mocks:client,doc,win,subscriptions,environment:{document:doc,window:win}}
}
afterEach(()=>vi.useRealTimers())
describe('foreground-only chat live reconciliation',()=>{
 it('subscribes only to content-free insert/update signals and never polls while idle',async()=>{
  vi.useFakeTimers();const f=fixture(),refresh=vi.fn().mockResolvedValue(undefined),status=vi.fn()
  const live=watchTeamChat(f.client,'owner','allowed-room',()=>true,refresh,status,f.environment)
  await Promise.resolve();await Promise.resolve()
  const channel=f.subscriptions[0];expect(channel.on.mock.calls.map(call=>call[1])).toEqual([
   {event:'INSERT',schema:'public',table:'team_chat_signals',filter:'conversation_id=eq.allowed-room'},
   {event:'UPDATE',schema:'public',table:'team_chat_signals',filter:'conversation_id=eq.allowed-room'},
  ])
  channel.status!('SUBSCRIBED');await vi.advanceTimersByTimeAsync(250);expect(refresh).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(60000);expect(refresh).toHaveBeenCalledTimes(1)
  live.dispose();expect(f.mocks.removeChannel).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0)
 })
 it('coalesces bursts and queues only one reconciliation while a request is in flight',async()=>{
  vi.useFakeTimers();const f=fixture();let complete!:()=>void
  const refresh=vi.fn().mockImplementationOnce(()=>new Promise<void>(resolve=>{complete=resolve})).mockResolvedValue(undefined)
  const live=watchTeamChat(f.client,'owner','room',()=>true,refresh,()=>{},f.environment)
  await Promise.resolve();await Promise.resolve();const channel=f.subscriptions[0]
  channel.status!('SUBSCRIBED');await vi.advanceTimersByTimeAsync(250)
  for(let i=0;i<30;i++)channel.callbacks[0]()
  expect(refresh).toHaveBeenCalledTimes(1);complete();await vi.advanceTimersByTimeAsync(2000);expect(refresh).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(60000);expect(refresh).toHaveBeenCalledTimes(2);live.dispose()
 })
 it('removes background subscriptions and reconciles once after returning',async()=>{
  vi.useFakeTimers();const f=fixture(),refresh=vi.fn().mockResolvedValue(undefined),status=vi.fn()
  const live=watchTeamChat(f.client,'owner','room',()=>true,refresh,status,f.environment)
  await Promise.resolve();await Promise.resolve();f.subscriptions[0].status!('SUBSCRIBED')
  f.doc.visibilityState='hidden';f.doc.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(10000)
  expect(refresh).not.toHaveBeenCalled();expect(f.mocks.removeChannel).toHaveBeenCalledTimes(1)
  f.doc.visibilityState='visible';f.doc.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();await Promise.resolve();f.subscriptions[1].status!('SUBSCRIBED');await vi.advanceTimersByTimeAsync(250)
  expect(refresh).toHaveBeenCalledTimes(1);live.dispose()
 })
 it('does not subscribe under another account or after a late session lookup',async()=>{
  const f=fixture();const live=watchTeamChat(f.client,'other','room',()=>true,async()=>{},()=>{},f.environment)
  await Promise.resolve();await Promise.resolve();expect(f.mocks.channel).not.toHaveBeenCalled();live.dispose()
  let resolve!: (value:unknown)=>void
  f.mocks.auth.getSession.mockReturnValue(new Promise(done=>{resolve=done}))
  const late=watchTeamChat(f.client,'owner','room',()=>true,async()=>{},()=>{},f.environment)
  late.dispose();resolve({data:{session:{user:{id:'owner'}}}});await Promise.resolve();await Promise.resolve();expect(f.mocks.channel).not.toHaveBeenCalled()
 })
 it('stops failed channels instead of looping and ignores late callbacks after disposal',async()=>{
  vi.useFakeTimers();const f=fixture(),refresh=vi.fn(),status=vi.fn(),live=watchTeamChat(f.client,'owner','room',()=>true,refresh,status,f.environment)
  await Promise.resolve();await Promise.resolve();const channel=f.subscriptions[0];channel.status!('CHANNEL_ERROR')
  expect(status).toHaveBeenLastCalledWith('offline');await vi.advanceTimersByTimeAsync(60000);expect(f.mocks.channel).toHaveBeenCalledTimes(1)
  live.dispose();channel.status!('SUBSCRIBED');channel.callbacks[0]();await vi.advanceTimersByTimeAsync(60000);expect(refresh).not.toHaveBeenCalled()
 })
 it('uses native app state as well as document visibility and removes the native listener',async()=>{
  vi.useFakeTimers();const f=fixture(),refresh=vi.fn().mockResolvedValue(undefined),remove=vi.fn().mockResolvedValue(undefined)
  let changed!: (state:{isActive:boolean})=>void
  const native={getState:vi.fn().mockResolvedValue({isActive:false}),addListener:vi.fn((_event:string,callback:(state:{isActive:boolean})=>void)=>{changed=callback;return Promise.resolve({remove})})}
  const live=watchTeamChat(f.client,'owner','room',()=>true,refresh,()=>{},{...f.environment,nativeApp:native as unknown as NonNullable<Parameters<typeof watchTeamChat>[6]>['nativeApp']})
  await Promise.resolve();await Promise.resolve();expect(f.mocks.channel).not.toHaveBeenCalled();expect(live.isForeground()).toBe(false)
  native.getState.mockResolvedValue({isActive:true});changed({isActive:true});await Promise.resolve();await Promise.resolve();await Promise.resolve()
  f.subscriptions[0].status!('SUBSCRIBED');await vi.advanceTimersByTimeAsync(250);expect(refresh).toHaveBeenCalledTimes(1)
  changed({isActive:false});expect(live.isForeground()).toBe(false);expect(f.mocks.removeChannel).toHaveBeenCalledTimes(1)
  live.dispose();expect(remove).toHaveBeenCalledTimes(1)
 })
 it('removes a native listener that finishes registering after the view is disposed',async()=>{
  const f=fixture(),remove=vi.fn().mockResolvedValue(undefined);let registered!: (value:{remove:typeof remove})=>void
  const native={getState:vi.fn().mockResolvedValue({isActive:false}),addListener:vi.fn(()=>new Promise<{remove:typeof remove}>(resolve=>{registered=resolve}))}
  const live=watchTeamChat(f.client,'owner','room',()=>true,async()=>{},()=>{},{...f.environment,nativeApp:native as unknown as NonNullable<Parameters<typeof watchTeamChat>[6]>['nativeApp']})
  live.dispose();registered({remove});await Promise.resolve();expect(remove).toHaveBeenCalledTimes(1)
 })

})

