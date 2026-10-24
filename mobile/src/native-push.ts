import {App} from '@capacitor/app'
import {Capacitor,CapacitorHttp,type PluginListenerHandle} from '@capacitor/core'
import {PushNotifications,type PushNotificationsPlugin} from '@capacitor/push-notifications'
import type {Session,SupabaseClient} from '@supabase/supabase-js'
import type {SupportedStorage} from '@supabase/auth-js'
import {getNativeAuthStorage} from '../../lib/native-auth-storage'
import type {TeamScope} from './team-room-data'
const storageKey='native-push-installation-v1'
type Installation={id:string;secret:string;owner:string}
type PushReply={ok:boolean;available?:boolean}
export function pushTeamDestination(data:unknown,userId:string):TeamScope|null {
 const row=data && typeof data==='object'?data as Record<string,unknown>:{}
 if(row.recipient!==userId || typeof row.href!=='string' || !row.href.startsWith('/team-room?') || row.href.length>1200)return null
 const url=new URL(row.href,'https://www.tenaceiq.com')
 if(url.origin!=='https://www.tenaceiq.com' || url.pathname!=='/team-room' || url.hash)return null
 const teamName=url.searchParams.get('team') || '',leagueName=url.searchParams.get('league') || '',flight=url.searchParams.get('flight') || ''
 if(!teamName || !leagueName || [teamName,leagueName,flight].some(value=>value.length>200))return null
 return {teamName,leagueName,flight}
}
export async function nativePushRequest(session:Session,data?:unknown,transport=CapacitorHttp):Promise<PushReply>{
 const options={url:'https://www.tenaceiq.com/api/mobile/push',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:12000}
 const response=data===undefined?await transport.get(options):await transport.post({...options,data})
 if(response.status!==200 || response.data?.ok!==true)throw Error('Team alert settings could not be saved.')
 return response.data
}
export function createNativePush(client:SupabaseClient,onOpen:(scope:TeamScope)=>void,deps:{platform?:string;plugin?:PushNotificationsPlugin;storage?:SupportedStorage;request?:(session:Session,data?:unknown)=>Promise<PushReply>}={}) {
 const supported=(deps.platform || Capacitor.getPlatform())==='ios'
 const plugin=deps.plugin || PushNotifications,storage=deps.storage || (supported?getNativeAuthStorage():undefined),request=deps.request || nativePushRequest
 let disposed=false,resumeHandle:PluginListenerHandle|null=null,initialized=false,current:Session|null=null,version=0,host:HTMLElement|null=null,installation:Installation|null=null,available=false,busy=false,notice='Checking team alerts…',actionHandle:PluginListenerHandle|null=null
 let pendingAction:unknown=null
 let chain:Promise<unknown>=Promise.resolve()
 const enqueue=<T>(task:()=>Promise<T>)=>{const result=chain.then(task,task);chain=result.catch(()=>{});return result}
 const valid=(user:string,epoch:number)=>current?.user.id===user && epoch===version
 const render=()=>{
  if(!host?.isConnected || !supported || !current)return
  host.replaceChildren()
  const title=document.createElement('h2');title.textContent='Team alerts'
  const text=document.createElement('p');text.textContent='Get a heads-up when your team posts. Message text stays off your lock screen.'
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent=notice
  const button=document.createElement('button');button.type='button';button.className='secondary';button.disabled=busy;button.textContent=installation?.owner===current.user.id?'Turn off team alerts':available?'Enable team alerts':'Check team alerts'
  button.onclick=()=>{void enqueue(async()=>{if(!current)return;busy=true;render();try{if(installation?.owner===current.user.id)await disable(current);else await enable(true)}catch{notice='Couldn’t save team alerts. Check your connection and try again.'}finally{busy=false;render()}})}
  host.append(title,text,status,button)
 }
 const load=async()=>{
  if(installation)return installation
  if(!storage)throw Error('Secure storage unavailable')
  const saved=await storage.getItem(storageKey)
  if(saved){const parsed=JSON.parse(saved) as Installation;if(!/^[a-f0-9-]{36}$/i.test(parsed.id) || !/^[a-f0-9]{64}$/.test(parsed.secret) || typeof parsed.owner!=='string')throw Error('Invalid secure installation');installation=parsed}
  else{installation={id:crypto.randomUUID(),secret:Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join(''),owner:''};await storage.setItem(storageKey,JSON.stringify(installation))}
  return installation
 }
 const save=async()=>{if(storage && installation)await storage.setItem(storageKey,JSON.stringify(installation))}
 const disable=async(session:Session)=>{
  const device=await load()
  await request(session,{installationId:device.id,secret:device.secret,enabled:false})
  await plugin.unregister()
  await plugin.removeAllDeliveredNotifications()
  device.owner='';await save();notice='Team alerts are off.'
 }
 const getToken=async()=>{
  let done=false,timer:ReturnType<typeof setTimeout>|undefined,resolveToken:(token:string)=>void=()=>{},rejectToken:()=>void=()=>{}
  const result=new Promise<string>((resolve,reject)=>{resolveToken=resolve;rejectToken=()=>reject(Error('Registration unavailable'))})
  const handles:PluginListenerHandle[]=[]
  try{
   handles.push(await plugin.addListener('registration',token=>{if(!done && /^[a-f0-9]{64,256}$/i.test(token.value)){done=true;resolveToken(token.value.toLowerCase())}}))
   handles.push(await plugin.addListener('registrationError',()=>{if(!done){done=true;rejectToken()}}))
   timer=setTimeout(()=>{if(!done){done=true;rejectToken()}},12000)
   // Attach rejection handling before a synchronous native registration callback.
   const registered=Promise.all([result,plugin.register()]).then(([token])=>token)
   return await registered
  }finally{done=true;if(timer)clearTimeout(timer);await Promise.all(handles.map(handle=>handle.remove()))}
 }
 const enable=async(prompt:boolean)=>{
  const session=current,epoch=version
  if(!session)return
  const device=await load(),capabilities=await request(session)
  if(!valid(session.user.id,epoch))return
  available=capabilities.available===true
  if(!available){notice='Team alerts are being prepared. Check again soon.';return}
  let permission=await plugin.checkPermissions()
  if(prompt && permission.receive==='prompt')permission=await plugin.requestPermissions()
  if(!valid(session.user.id,epoch))return
  if(permission.receive!=='granted'){
   if(device.owner===session.user.id)await disable(session)
   notice=permission.receive==='denied'?'Allow notifications for TenAceIQ in iPhone Settings, then try again.':'Choose Enable team alerts when you’re ready.';return
  }
  const token=await getToken()
  if(!valid(session.user.id,epoch)){await plugin.unregister();return}
  // No token, device secret or message text is logged or stored in browser storage.
  await request(session,{installationId:device.id,secret:device.secret,token,enabled:true})
  device.owner=session.user.id;await save()
  if(!valid(session.user.id,epoch)){await disable(session);return}
  notice='Team alerts are on. Team mute and block settings still apply.'
 }
 if(supported)void plugin.addListener('pushNotificationActionPerformed',event=>{if(disposed)return;if(!initialized){const data=event.notification.data;pendingAction={recipient:data?.recipient,href:data?.href};return}const session=current;if(!session)return;const scope=pushTeamDestination(event.notification.data,session.user.id);if(scope)onOpen(scope)}).then(handle=>{if(disposed)void handle.remove();else actionHandle=handle}).catch(()=>{})
 if(supported && !deps.platform)void App.addListener('appStateChange',state=>{if(!state.isActive || busy || !current || installation?.owner!==current.user.id || disposed)return;void enqueue(async()=>{busy=true;try{await enable(false)}catch{notice='Couldn’t refresh team alerts. Check your connection and try again.'}finally{busy=false;render()}})}).then(handle=>{if(disposed)void handle.remove();else resumeHandle=handle}).catch(()=>{})
 return {
  mount(element:HTMLElement){host=element;if(!supported)element.hidden=true;else render()},
  setSession(session:Session|null){
   if(disposed)return
   const previous=current;current=session
   if(initialized && previous?.user.id===session?.user.id)return
   initialized=true
   const pending=pendingAction;pendingAction=null
   if(session && pending){const scope=pushTeamDestination(pending,session.user.id);if(scope)onOpen(scope)}
   const epoch=++version
   if(!supported)return
   void enqueue(async()=>{
    try{
     const device=await load()
     if(previous && previous.user.id!==session?.user.id && device.owner===previous.user.id){try{await disable(previous)}catch{await plugin.unregister();await plugin.removeAllDeliveredNotifications()}}
     if(!session){await plugin.unregister();await plugin.removeAllDeliveredNotifications();return}
     if(!valid(session.user.id,epoch))return
     busy=true;render()
     if(device.owner===session.user.id)await enable(false)
     else{await plugin.unregister();await plugin.removeAllDeliveredNotifications();const result=await request(session);if(valid(session.user.id,epoch)){available=result.available===true;notice=available?'Choose Enable team alerts when you’re ready.':'Team alerts are being prepared. Check again soon.'}}
    }catch{notice='Can’t check team alerts. Try again when you’re connected.'}finally{busy=false;render()}
   })
  },
  beforeSignOut(){return enqueue(async()=>{if(!supported || !current)return;const {data,error}=await client.auth.getSession();if(error || data.session?.user.id!==current.user.id)throw Error('Sign in again before changing alerts');const device=await load();if(device.owner===current.user.id)await disable(data.session);else{await plugin.unregister();await plugin.removeAllDeliveredNotifications()}})},
  dispose(){disposed=true;version++;current=null;void actionHandle?.remove();void resumeHandle?.remove()},
 }
}
