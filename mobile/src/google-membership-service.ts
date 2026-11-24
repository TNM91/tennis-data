import {App} from '@capacitor/app'
import type {PluginListenerHandle} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {GOOGLE_PLAY_PRODUCTS,googleBinding} from '../../lib/google-play-products'
import {createGooglePlayPurchases,GooglePlayPurchaseError,type GooglePlayFulfillment} from './google-play-purchases'
import {googlePlayFulfillment} from './google-play-fulfillment'

export type GoogleMembershipContext={enabled:false}|{enabled:true;environment:'Test';canPurchase:boolean;active:boolean;otherAccess:boolean;manageRequired:boolean}
export function parseGoogleMembershipContext(value:unknown,owner:string):GoogleMembershipContext{
 if(!value||typeof value!=='object')throw new GooglePlayPurchaseError('google_unavailable')
 const data=value as Record<string,unknown>
 if(data.ok!==true||data.googlePurchases!==1||data.ownerId!==owner||typeof data.enabled!=='boolean')throw new GooglePlayPurchaseError('google_unavailable')
 if(!data.enabled)return {enabled:false}
 if(data.environment!=='Test'||!googleBinding(data.accountId)||!['canPurchase','active','otherAccess','manageRequired'].every(key=>typeof data[key]==='boolean')||!Array.isArray(data.products)||data.products.length!==1||(data.products[0] as {id?:unknown})?.id!==GOOGLE_PLAY_PRODUCTS[0].id||data.canPurchase&&(data.active||data.otherAccess||data.manageRequired)||data.active&&data.manageRequired)throw new GooglePlayPurchaseError('google_unavailable')
 return {enabled:true,environment:'Test',canPurchase:data.canPurchase as boolean,active:data.active as boolean,otherAccess:data.otherAccess as boolean,manageRequired:data.manageRequired as boolean}
}
type Controller=ReturnType<typeof createGooglePlayPurchases>
type AppEvents=Pick<typeof App,'addListener'>
export function createGoogleMembershipService(client:SupabaseClient,options:{fulfillment?:GooglePlayFulfillment;controller?:Controller;app?:AppEvents}={}){
 const fulfillment=options.fulfillment??googlePlayFulfillment(client),controller=options.controller??createGooglePlayPurchases(client,fulfillment),events=options.app??App
 let owner:string|null=null,epoch=0,disposed=false,handle:PluginListenerHandle|undefined
 if(controller.available)void events.addListener('appStateChange',({isActive})=>{if(isActive&&owner&&!disposed&&!controller.isBusy())void controller.recover(owner).catch(()=>{})}).then(listener=>{if(disposed)void listener.remove();else handle=listener}).catch(()=>{})
 return {...controller,
  setOwner(next:string|null){if(disposed||next===owner)return;owner=next;epoch++;controller.setOwner(next)},
  async context(expected:string){
   if(disposed||owner!==expected)throw new GooglePlayPurchaseError('owner_changed')
   const visit=epoch,value=await fulfillment.context(expected)
   if(disposed||owner!==expected||epoch!==visit)throw new GooglePlayPurchaseError('owner_changed')
   return parseGoogleMembershipContext(value,expected)
  },
  dispose(){if(disposed)return;disposed=true;owner=null;epoch++;void handle?.remove();controller.dispose()},
 }
}
export type GoogleMembershipService=ReturnType<typeof createGoogleMembershipService>
const services=new WeakMap<SupabaseClient,GoogleMembershipService>()
export function googleMembershipService(client:SupabaseClient){let service=services.get(client);if(!service){service=createGoogleMembershipService(client);services.set(client,service)}return service}
