import {Capacitor} from '@capacitor/core'
import {App} from '@capacitor/app'

/** Receipts invalidate counts only; never navigate, fetch a message body or acknowledge a read. */
export function createChatReceiptRefresh(refresh:(owner:string)=>Promise<unknown>|void,environment:{document:Pick<Document,'visibilityState'|'addEventListener'|'removeEventListener'>;nativeApp?:Pick<typeof App,'getState'>}={document,...(Capacitor.isNativePlatform()?{nativeApp:App}:{})}){
 let owner:string|null=null,epoch=0,disposed=false,dirty=false,running:number|null=null,timer:ReturnType<typeof setTimeout>|null=null,lastStarted=-Infinity,warned=false
 const clear=()=>{if(timer!==null){clearTimeout(timer);timer=null}}
 const visible=()=>environment.document.visibilityState==='visible'
 const current=(user:string,version:number)=>!disposed&&owner===user&&epoch===version
 const schedule=()=>{
  if(disposed||!owner||!dirty||!visible()||timer!==null||running!==null)return
  const user=owner,version=epoch
  timer=setTimeout(()=>{
   timer=null
   if(!current(user,version))return
   if(!visible()){dirty=false;return}
   running=version;dirty=false;lastStarted=Date.now()
   void (async()=>{
    try{
     const active=environment.nativeApp?(await environment.nativeApp.getState()).isActive:true
     if(!current(user,version))return
     if(!active||!visible()){dirty=false;return}
     await refresh(user)
     if(current(user,version))warned=false
    }catch{if(current(user,version)&&!warned){warned=true;console.warn('native_chat_receipt_refresh_unavailable')}}
    finally{if(current(user,version)){running=null;schedule()}}
   })()
  },Math.max(250,2000-(Date.now()-lastStarted)))
 }
 const visibility=()=>{if(!visible()){clear();dirty=false}}
 environment.document.addEventListener('visibilitychange',visibility)
 return {
  receive(user:string){if(!disposed&&owner===user&&visible()){dirty=true;schedule()}},
  setOwner(next:string|null){if(disposed||next===owner)return;epoch++;clear();owner=next;dirty=false;running=null;lastStarted=-Infinity;warned=false},
  dispose(){if(disposed)return;disposed=true;epoch++;clear();owner=null;dirty=false;running=null;environment.document.removeEventListener('visibilitychange',visibility)},
 }
}
