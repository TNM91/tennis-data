import {Capacitor,type PluginListenerHandle} from '@capacitor/core'
import {App} from '@capacitor/app'
import type {SupabaseClient,RealtimeChannel} from '@supabase/supabase-js'
export type TeamLiveStatus='connecting'|'live'|'paused'|'offline'
/** One foreground, content-free subscription. No idle API polling or presence traffic. */
export function watchTeamChat(client:SupabaseClient,userId:string,roomId:string,isCurrent:()=>boolean,onRefresh:()=>Promise<void>,onStatus:(status:TeamLiveStatus)=>void,environment:{document:Pick<Document,'visibilityState'|'addEventListener'|'removeEventListener'>;window:Pick<Window,'addEventListener'|'removeEventListener'>;nativeApp?:Pick<typeof App,'addListener'|'getState'>}={document,window,...(Capacitor.isNativePlatform()?{nativeApp:App}:{})}) {
 let nativeActive=!environment.nativeApp,nativeHandle:PluginListenerHandle|null=null
 let disposed=false,version=0,channel:RealtimeChannel|null=null,timer:ReturnType<typeof setTimeout>|null=null,running=false,queued=false,lastRefresh=0
 const valid=()=>!disposed && isCurrent()
 const foreground=()=>nativeActive && environment.document.visibilityState==='visible'
 const clear=()=>{if(timer!==null){clearTimeout(timer);timer=null}}
 const reconcile=()=>{
  if(!valid() || !foreground())return
  if(running){queued=true;return}
  if(timer!==null)return
  timer=setTimeout(()=>{
   timer=null
   if(!valid() || !foreground())return
   running=true;lastRefresh=Date.now()
   void Promise.resolve().then(onRefresh).then(()=>{if(valid() && foreground() && channel)onStatus('live')}).catch(()=>{if(valid())onStatus('paused')}).finally(()=>{running=false;if(queued){queued=false;reconcile()}})
  },Math.max(250,2000-(Date.now()-lastRefresh)))
 }
 const stop=()=>{version++;clear();queued=false;const old=channel;channel=null;if(old)void client.removeChannel(old).catch(()=>{})}
 const start=async()=>{
  stop()
  if(!valid() || environment.document.visibilityState!=='visible'){if(valid())onStatus('paused');return}
  const current=version
  onStatus('connecting')
  try{
   if(environment.nativeApp){const state=await environment.nativeApp.getState();if(!valid() || version!==current)return;nativeActive=state.isActive;if(!foreground()){onStatus('paused');return}}
   const {data,error}=await client.auth.getSession()
   if(!valid() || version!==current || !foreground())return
   if(error || data.session?.user.id!==userId){onStatus('offline');return}
   const subscription=client.channel(`native-team-chat:${userId}:${roomId}`)
   channel=subscription
   subscription.on('postgres_changes',{event:'INSERT',schema:'public',table:'team_chat_signals',filter:`conversation_id=eq.${roomId}`},reconcile)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'team_chat_signals',filter:`conversation_id=eq.${roomId}`},reconcile)
    .subscribe(status=>{
     if(!valid() || version!==current)return
     if(status==='SUBSCRIBED'){onStatus('live');reconcile()}
     else if(status==='CHANNEL_ERROR' || status==='TIMED_OUT' || status==='CLOSED'){stop();if(valid())onStatus('offline')}
    })
  }catch{if(valid() && version===current){stop();onStatus('offline')}}
 }
 const onVisibility=()=>{if(foreground())void start();else{stop();if(valid())onStatus('paused')}}
 const onOnline=()=>{if(foreground())void start()}
 if(environment.nativeApp)void environment.nativeApp.addListener('appStateChange',state=>{nativeActive=state.isActive;onVisibility()}).then(handle=>{if(disposed)void handle.remove();else nativeHandle=handle}).catch(()=>{if(valid()){stop();onStatus('offline')}})
 environment.document.addEventListener('visibilitychange',onVisibility)
 environment.window.addEventListener('online',onOnline)
 void start()
 return {isForeground:foreground,retry:()=>{void start()},dispose:()=>{disposed=true;stop();void nativeHandle?.remove();environment.document.removeEventListener('visibilitychange',onVisibility);environment.window.removeEventListener('online',onOnline)}}
}
