import type {SupabaseClient} from '@supabase/supabase-js'
import {resolveUpdateAction} from './updates-data'
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
export function pushCoachDestination(data:unknown,owner:string):string|null{
 const row=data&&typeof data==='object'?data as Record<string,unknown>:{}
 if(row.recipient!==owner||typeof row.href!=='string'||row.href.length>200||!row.href.startsWith('/messages?')||/[\u0000-\u0020\\]/.test(row.href))return null
 try{const url=new URL(row.href,'https://www.tenaceiq.com'),id=url.searchParams.get('thread');return url.origin==='https://www.tenaceiq.com'&&url.pathname==='/messages'&&!url.hash&&[...url.searchParams.keys()].every(k=>k==='thread')&&url.searchParams.getAll('thread').length===1&&uuid(id)?id:null}catch{return null}
}
/** Memory-only handoff; never closes another form or follows a supplied URL. */
export function createCoachAlertHandoff(host:HTMLElement,client:SupabaseClient,owner:()=>string|null,revision:()=>number,blocked:()=>boolean,guard:(open:()=>void)=>void,open:(student:string,owner:string)=>void,resolve=resolveUpdateAction,now=()=>Date.now(),autoOpen=()=>false){
 let pending:{id:string;owner:string;at:number}|null=null,epoch=0,busy=false,notice='',disposed=false
 const valid=(version:number,user:string)=>!disposed&&epoch===version&&pending?.owner===user&&owner()===user
 const clear=()=>{epoch++;pending=null;busy=false;notice='';host.hidden=true;host.replaceChildren()}
 const render=()=>{
  if(disposed||!pending)return
  host.hidden=false;host.replaceChildren();host.className='app-link-handoff';host.setAttribute('aria-label','Coach message alert')
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent=notice||'New Coach message. Open your private conversation.'
  const button=document.createElement('button');button.type='button';button.textContent='Open conversation';button.disabled=busy
  button.onclick=()=>{
   const item=pending;if(!item||owner()!==item.owner||now()-item.at>600000){clear();return}
   if(blocked()){notice='Close your current form to open this conversation.';render();return}
   guard(()=>{
    const version=epoch,visit=revision(),current=()=>valid(version,item.owner)&&revision()===visit
    if(!current()||busy)return
    busy=true;notice='Checking conversation…';render()
    void resolve(client,item.owner,current,{kind:'conversation',id:item.id,label:'Open Coach messages'}).then(action=>{
     if(!current())return
     if(blocked()){notice='Close your current form, then open this conversation.';return}
     if(action.kind!=='coach-message')throw Error('Conversation unavailable')
     clear();open(action.student,item.owner)
    }).catch(()=>{if(valid(version,item.owner))notice='This conversation couldn’t open. Check your current connections in Chats.'}).finally(()=>{if(valid(version,item.owner)){if(revision()!==visit)notice='Ready to open your private conversation.';busy=false;render()}})
   })
  }
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='secondary';dismiss.textContent='×';dismiss.setAttribute('aria-label','Dismiss Coach alert');dismiss.onclick=clear
  host.append(status,button,dismiss)
 }
 const resume=()=>{if(!disposed&&pending&&!busy&&autoOpen()&&!blocked())host.querySelector<HTMLButtonElement>('button')?.click()}
 return {receive(id:string,recipient:string){if(disposed||!uuid(id)||recipient!==owner())return;epoch++;pending={id,owner:recipient,at:now()};busy=false;notice='';render();resume()},resume,syncOwner(){if(pending&&pending.owner!==owner())clear()},clear,dispose(){clear();disposed=true}}
}
