import {createNativePush as actual} from '../../mobile/src/native-push'
import type {PushNotificationsPlugin} from '@capacitor/push-notifications'
import {currentNavigationOwner,refreshNavigationSession} from './mobile-navigation-client'
import {updateCoachThread} from './mobile-updates-client'
export const nativeCoachAlertFixture={enabled:false,writes:[] as boolean[],tap:(owner=currentNavigationOwner())=>{void owner},receive:(owner=currentNavigationOwner(),kind='coach')=>{void owner;void kind}}
export function createNativePush(...[client,onOpen,deps={}]:Parameters<typeof actual>){
 if(!new URL(location.href).searchParams.has('coachAlerts'))return actual(client,onOpen,deps)
 let registration:(event:{value:string})=>void=()=>{},saved=JSON.stringify({id:'55555555-5555-4555-8555-555555555555',secret:'a'.repeat(64),owner:currentNavigationOwner()})
 const payload=(recipient=currentNavigationOwner())=>({notification:{data:{recipient,href:'/messages?thread='+updateCoachThread}}})
 const plugin={addListener:async(name:string,fn:never)=>{if(name==='registration')registration=fn;if(name==='pushNotificationReceived')nativeCoachAlertFixture.receive=(user=currentNavigationOwner(),kind='coach')=>(fn as (event:unknown)=>void)({data:{recipient:user,href:kind==='team'?'/team-room?team=Baseline%20Aces&league=City%20League&flight=4.0':kind==='invalid'?'/messages?thread='+updateCoachThread+'&owner=other':'/messages?thread='+updateCoachThread}});if(name==='pushNotificationActionPerformed'){nativeCoachAlertFixture.tap=user=>(fn as (event:unknown)=>void)(payload(user));if(new URL(location.href).searchParams.has('coldCoach'))queueMicrotask(()=>{(fn as (event:unknown)=>void)(payload());if(new URL(location.href).searchParams.has('duplicateAuth'))refreshNavigationSession()})}return {remove:async()=>{}}},register:async()=>registration({value:'b'.repeat(64)}),unregister:async()=>{},checkPermissions:async()=>({receive:'granted'}),requestPermissions:async()=>({receive:'granted'})} as unknown as PushNotificationsPlugin
 return actual(client,onOpen,{...deps,platform:'ios',plugin,clearDelivered:async()=>{},setBadge:async()=>({applied:true}),storage:{getItem:async()=>saved,setItem:async(_key,value)=>{saved=value},removeItem:async()=>{}},request:async()=>({ok:true,available:true})})
}
