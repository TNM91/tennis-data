import {it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
vi.mock('@capacitor/core',()=>({CapacitorHttp:{},Capacitor:{getPlatform:()=> 'web',isPluginAvailable:()=>false},registerPlugin:()=>({})}))
vi.mock('@capacitor/app',()=>({App:{addListener:vi.fn()}}))
import {createGooglePlayPurchases,type GooglePlayFulfillment,type GooglePlayStore} from '../../mobile/src/google-play-purchases'
import {createGoogleMembershipService,parseGoogleMembershipContext} from '../../mobile/src/google-membership-service'
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const context={ok:true,googlePurchases:1,ownerId:owner,enabled:true,environment:'Test',accountId:'a'.repeat(64),canPurchase:true,active:false,otherAccess:false,manageRequired:false,products:[{id:'com.tenaceiq.app.pro.monthly'}]}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0))
function fixture(){
 let sessionOwner=owner,resume:((event:{isActive:boolean})=>void)|undefined
 const client={auth:{getSession:async()=>({data:{session:{user:{id:sessionOwner},access_token:'synthetic'}},error:null})}} as unknown as SupabaseClient
 const fulfillment={context:vi.fn(async()=>context as unknown),prepare:vi.fn(),reconcile:vi.fn()} satisfies GooglePlayFulfillment
 const store={products:vi.fn(),purchase:vi.fn(),pending:vi.fn(async()=>({transactions:[]})),manage:vi.fn(async()=>{}),addListener:vi.fn(async()=>({remove:vi.fn(async()=>{})}))} satisfies GooglePlayStore
 const controller=createGooglePlayPurchases(client,fulfillment,{store,platform:'android',available:true,autoRecover:false}),remove=vi.fn(async()=>{})
 const app={addListener:vi.fn(async(_event:string,listener:typeof resume)=>{resume=listener;return {remove}})}
 const service=createGoogleMembershipService(client,{controller,fulfillment,app:app as never});service.setOwner(owner)
 return {service,fulfillment,store,remove,app,resume:(isActive=true)=>resume?.({isActive}),switchOwner(next:string|null){sessionOwner=next??'';service.setOwner(next)}}
}
it('accepts only the authenticated Pro test catalog and rejects contradictory or malformed readiness',()=>{
 expect(parseGoogleMembershipContext(context,owner)).toMatchObject({enabled:true,canPurchase:true})
 expect(parseGoogleMembershipContext({ok:true,googlePurchases:1,ownerId:owner,enabled:false},owner)).toEqual({enabled:false})
 for(const patch of [{ownerId:other},{googlePurchases:2},{environment:'Production'},{active:true},{otherAccess:true},{manageRequired:true},{products:[]},{products:[{id:'com.tenaceiq.app.league.publish'}]},{accountId:'bad'},{active:false,canPurchase:false,manageRequired:'yes'}])expect(()=>parseGoogleMembershipContext({...context,...patch},owner)).toThrow()
})
it('discards readiness after an account switches away and back, or the service is disposed',async()=>{
 const f=fixture()
 try{
  let resolve!:(value:unknown)=>void;f.fulfillment.context.mockImplementationOnce(()=>new Promise(done=>{resolve=done}))
  const pending=f.service.context(owner);f.switchOwner(other);f.switchOwner(owner);resolve(context);await expect(pending).rejects.toThrow('owner_changed')
  f.fulfillment.context.mockImplementationOnce(()=>new Promise(done=>{resolve=done}));const disposed=f.service.context(owner);f.service.dispose();resolve(context);await expect(disposed).rejects.toThrow('owner_changed')
 }finally{f.service.dispose()}
})
it('restores on foreground only for the current owner and removes the app listener on disposal',async()=>{
 const f=fixture();await flush()
 f.resume(false);expect(f.store.pending).not.toHaveBeenCalled()
 f.resume();await flush();expect(f.store.pending).toHaveBeenCalledOnce()
 f.switchOwner(null);f.resume();await flush();expect(f.store.pending).toHaveBeenCalledOnce()
 f.service.dispose();expect(f.remove).toHaveBeenCalledOnce();f.resume();await flush();expect(f.store.pending).toHaveBeenCalledOnce()
})
it('keeps busy observers informed without letting UI callbacks interrupt a payment or outlive disposal',async()=>{
 const f=fixture(),changes:boolean[]=[];const unsubscribe=f.service.subscribeBusy(()=>{changes.push(f.service.isBusy())})
 f.service.subscribeBusy(()=>{throw Error('synthetic UI callback')})
 await f.service.manage(owner);expect(changes).toEqual([true,false]);expect(f.store.manage).toHaveBeenCalledOnce()
 unsubscribe();await f.service.manage(owner);expect(changes).toEqual([true,false]);f.service.dispose()
})
it('does not call Google billing when foreground recovery finds checkout inactive',async()=>{
 const f=fixture();f.fulfillment.context.mockResolvedValue({ok:true,googlePurchases:1,ownerId:owner,enabled:false});await flush();f.resume();await flush()
 expect(f.store.pending).not.toHaveBeenCalled();expect(f.store.products).not.toHaveBeenCalled();expect(f.store.purchase).not.toHaveBeenCalled();f.service.dispose()
})
