import type {Session,SupabaseClient} from '@supabase/supabase-js'
import type {PushNotificationsPlugin} from '@capacitor/push-notifications'
import {createNativePush} from '../../mobile/src/native-push'
import {createCoachAlerts} from '../../mobile/src/coach-alerts'
import {createCoachAlertHandoff} from '../../mobile/src/coach-alert-handoff'
import {currentNavigationOwner} from './mobile-navigation-client'
const thread='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',student='student-one'
const state={enabled:false,registered:true,available:true,failSave:false,failRead:false,hold:false,resolveFail:false,blocked:false,autoOpen:false,revision:0,reads:0,writes:[] as boolean[],opens:[] as string[],resolveOwners:[] as string[],events:[] as string[],release:()=>{},clear:()=>{},resume:()=>{},tap:(recipient=currentNavigationOwner(),href='/messages?thread='+thread)=>{void recipient;void href},mount:()=>{}}
export const coachAlertFixture=state
state.mount=()=>{
 state.clear();let initialOwner=currentNavigationOwner(),saved=JSON.stringify({id:'55555555-5555-4555-8555-555555555555',secret:'a'.repeat(64),owner:state.registered?initialOwner:''})
 const host=document.createElement('section');host.className='chat-notification-settings';host.dataset.coachAlertPreview='';document.querySelector('#app')!.append(host)
 const incoming=document.createElement('aside');incoming.hidden=true;host.before(incoming)
 const session=()=>({user:{id:currentNavigationOwner()},access_token:'synthetic-token'}) as Session,client={auth:{getSession:async()=>({data:{session:session()},error:null})}} as SupabaseClient
 const handoff=createCoachAlertHandoff(incoming,client,currentNavigationOwner,()=>state.revision,()=>state.blocked||Boolean(document.querySelector('dialog[open]')),open=>open(),(id,user)=>{state.opens.push(id);const note=document.createElement('p');note.dataset.coachAlertOpened=id;note.textContent='Opened verified Coach connection';host.append(note);state.events.push('opened:'+user)},async(_client,user,current)=>{state.resolveOwners.push(user);if(state.hold)await new Promise<void>(resolve=>{state.release=resolve});if(!current()||state.resolveFail)throw Error('Synthetic unavailable');return {kind:'coach-message',student,label:'Open Coach messages'}},undefined,()=>state.autoOpen)
 state.resume=handoff.resume
 const alerts=createCoachAlerts(client,()=>push.isEnabled(),async(method,options)=>{
  if(method==='GET'){state.reads++;if(state.failRead)return {status:503,data:{ok:false},headers:{},url:''}}
  else{const choice=(options.data as {enabled:boolean}).enabled;state.writes.push(choice);state.enabled=choice;if(state.hold)await new Promise<void>(resolve=>{state.release=resolve});if(state.failSave)return {status:503,data:{ok:false},headers:{},url:''}}
  return {status:200,data:{ok:true,owner:initialOwner,enabled:state.enabled,available:state.available},headers:{},url:''}
 })
 let action:(event:{notification:{data:unknown}})=>void=()=>{},registeredToken:(event:{value:string})=>void=()=>{}
 const plugin={addListener:async(name:string,fn:never)=>{if(name==='pushNotificationActionPerformed')action=fn;else if(name==='registration')registeredToken=fn;return {remove:async()=>{}}},register:async()=>{registeredToken({value:'b'.repeat(64)})},unregister:async()=>{},checkPermissions:async()=>({receive:'granted'}),requestPermissions:async()=>({receive:'granted'})} as unknown as PushNotificationsPlugin
 const push=createNativePush(client,()=>state.events.push('team-open'),{platform:'ios',plugin,storage:{getItem:async()=>saved,setItem:async(_key,value)=>{saved=value},removeItem:async()=>{}},clearDelivered:async()=>{},request:async(_session,body)=>{if(body)state.registered=(body as {enabled:boolean}).enabled;return {ok:true,available:true}},onCoachOpen:(id,user)=>handoff.receive(id,user),mountCoachAlerts:target=>alerts.mount(target)})
 push.mount(host);push.setSession(session());alerts.setOwner(initialOwner)
 state.tap=(recipient=currentNavigationOwner(),href='/messages?thread='+thread)=>{action({notification:{data:{recipient,href}}})}
 state.clear=()=>{alerts.dispose();push.dispose();handoff.dispose();host.remove();incoming.remove()}
 // The fixture owns no real native registration, storage, socket or APNs request.
 initialOwner=currentNavigationOwner()
}
