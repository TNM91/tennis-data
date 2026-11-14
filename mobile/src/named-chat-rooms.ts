import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {namedChatRoomId,namedChatRoomName} from '../../lib/named-team-chat-rooms'
import {html} from './match-details'
import {firstPartyBuild} from './build-scope'
import {firstPartyTeamRooms,matchesTeamReleaseScope} from './first-party-team-transport'
export type ChatRoomList={parentId:string;teamMuted:boolean;generalUnread:number;canCreate:boolean;rooms:{id:string;name:string;unread:number;muted:boolean}[]}
export class ChatRoomRequestError extends Error{constructor(message:string,readonly uncertain=false){super(message)}}
export function parseChatRoomList(value:unknown,parentId:string):ChatRoomList{
 const row=value as Partial<ChatRoomList>&{ok?:boolean;namedRooms?:number}
 if(!namedChatRoomId(parentId)||!row||row.ok!==true||row.namedRooms!==1||row.parentId!==parentId||typeof row.teamMuted!=='boolean'||!Number.isInteger(row.generalUnread)||Number(row.generalUnread)<0||Number(row.generalUnread)>100||typeof row.canCreate!=='boolean'||!Array.isArray(row.rooms)||row.rooms.length>12||row.rooms.some(item=>!item||!namedChatRoomId(item.id)||!namedChatRoomName(item.name)||!Number.isInteger(item.unread)||item.unread<0||item.unread>100||typeof item.muted!=='boolean')||new Set(row.rooms.map(item=>item.id)).size!==row.rooms.length)throw Error('Room list unavailable.')
 return {parentId,teamMuted:row.teamMuted,generalUnread:row.generalUnread!,canCreate:row.canCreate,rooms:row.rooms.map(item=>({id:item.id,name:item.name,unread:item.unread,muted:item.muted}))}
}
export async function requestChatRooms(client:SupabaseClient,owner:string,scope:TeamScope,parentId:string,current:()=>boolean,change?:{id:string;name:string;check:boolean},transport=CapacitorHttp){
 if(!namedChatRoomId(parentId)||change&&(!namedChatRoomId(change.id)||!namedChatRoomName(change.name)))throw new ChatRoomRequestError('Use a room name up to 48 characters. General is reserved.')
 const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==owner||!current())throw new ChatRoomRequestError('Sign in again to open rooms.')
 const data={teamName:scope.teamName,leagueName:scope.leagueName,flight:scope.flight}
 const url=new URL(firstPartyBuild?firstPartyTeamRooms:'https://www.tenaceiq.com/api/team-rooms')
 const options={headers:{Authorization:'Bearer '+session.data.session.access_token,'Content-Type':'application/json'},responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:12000}
 let response
 try{if(change)response=await transport.post({...options,url:url.href,data:{...data,action:change.check?'lookup_chat_room':'create_chat_room',clientRoomId:change.id,roomName:change.name}});else{for(const [key,value] of Object.entries({team:data.teamName,league:data.leagueName,flight:data.flight,...(firstPartyBuild?{op:'chats'}:{namedRooms:'1'})}))url.searchParams.set(key,value);response=await transport.get({...options,url:url.href})}}
 catch{throw new ChatRoomRequestError(change?'Room creation is not confirmed. Check this same room before retrying.':'Rooms unavailable. Try again when connected.',Boolean(change&&!change.check))}
 if(!current())throw new ChatRoomRequestError('This team is no longer open.',Boolean(change))
 if(response.status!==200||response.data?.ok!==true||!matchesTeamReleaseScope(response.data,owner)){throw new ChatRoomRequestError(response.status===409?'That name is already in use or the team has reached its chat limit.':response.status===403?'Your team access changed. Reopen Chats.':change&&change.check&&response.status===404?'This chat is not confirmed. You can retry creating it.':'Team chats couldn’t load. Try again when connected.',Boolean(change&&!change.check&&(response.status>=500||response.status===200)))}
 if(!change)return parseChatRoomList(response.data,parentId)
 const row=response.data
 if(row.namedRooms!==1||row.parentId!==parentId||row.id!==change.id||row.name!==change.name)throw new ChatRoomRequestError('Room creation could not be confirmed.',true)
 return {id:row.id as string,name:row.name as string}
}
export function openChatRooms(client:SupabaseClient,owner:string,scope:TeamScope,parentId:string,current:()=>boolean,onSelect:(id?:string)=>void,onClose:(uncertain:boolean)=>void){
 const origin=document.activeElement instanceof HTMLElement?document.activeElement:null
 const dialog=document.createElement('dialog')
 dialog.className='chat-post-dialog team-rooms-dialog'
 dialog.setAttribute('aria-labelledby','team-rooms-title')
 let disposed=false,busy=false,editing=false,list:ChatRoomList|null=null,fields='',draft:{id:string;name:string}|null=null,uncertain=false,notice=''
 const active=()=>!disposed&&current()&&dialog.isConnected
 const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus()
 const close=()=>{
  if(disposed)return
  disposed=true
  dialog.remove()
  onClose(uncertain)
  if(origin?.isConnected&&current())origin.focus({preventScroll:true})
 }
 const choose=(id?:string)=>{if(!busy&&active()){close();onSelect(id)}}
 async function load(){
  if(!active()||busy)return
  busy=true;notice='Loading team chats…';render()
  try{
   const result=await requestChatRooms(client,owner,scope,parentId,active)
   if(active()&&'rooms' in result){list=result;editing=false;notice=''}
  }catch(error){
   if(active())notice=error instanceof Error?error.message:'Team chats couldn’t load.'
  }finally{
   busy=false
   if(active()){render();focus()}
  }
 }
 async function save(check:boolean){
  if(!active()||busy||!draft)return
  busy=true
  const pending=draft
  notice=check?'Checking chat…':'Creating chat…';render()
  try{
   const result=await requestChatRooms(client,owner,scope,parentId,active,{...pending,check})
   if(!active()||!('id' in result))return
   uncertain=false;busy=false
   choose(result.id)
  }catch(error){
   if(!active())return
   uncertain=check?uncertain:error instanceof ChatRoomRequestError&&error.uncertain
   notice=error instanceof Error?error.message:'Team chat couldn’t be created.'
  }finally{
   busy=false
   if(active()){render();focus()}
  }
 }
 function render(){
  const disabled=busy?'disabled':''
  const title=firstPartyBuild?'Team chats':'Rooms'
  const entries=[{id:'',name:'General',unread:list?.generalUnread??0,muted:false},...(list?.rooms??[])]
  dialog.innerHTML=`<div class="team-rooms-heading"><div><p>${html(scope.teamName)}</p>
   <h1 id="team-rooms-title" tabindex="-1">${title}</h1></div><button type="button" class="secondary" data-close-rooms ${disabled}>Close</button></div>
   ${editing?`<form data-room-form><label>Chat name<input name="roomName" maxlength="96" value="${html(fields)}" autocomplete="off" required ${busy||uncertain?'readonly':''}></label>
    <p class="rating-context">Try Match Day, Practice, or Clubhouse. Everyone on this team can join.</p>
    <button type="submit" ${disabled}>${uncertain?'Retry same creation':'Create chat'}</button>
    ${uncertain?`<button type="button" class="secondary" data-check ${disabled}>Check this chat</button>`:''}
    <button type="button" class="secondary" data-back-rooms ${disabled}>Back to team chats</button></form>`
    :`<ul class="named-room-list">${entries.map(room=>`<li><button type="button" class="secondary" data-open-room="${html(room.id)}" ${disabled}
     aria-pressed="${(scope.chatRoomId??'')===room.id}"><strong>${html(room.name)}</strong>
     <span>${room.unread?`${room.unread===100?'99+':room.unread} unread`:room.id?'Team chat':'Team updates'}${room.muted?' · Muted':''}</span></button></li>`).join('')}</ul>
     ${list?.canCreate?`<button type="button" data-new-room ${disabled}>Create a chat</button>`:''}
     ${!list&&!busy?'<button type="button" class="secondary" data-reload>Reload team chats</button>':''}`}
   <p role="status">${html(notice)}</p>`
  dialog.querySelector('[data-close-rooms]')!.addEventListener('click',close)
  dialog.querySelector('[data-reload]')?.addEventListener('click',()=>{void load()})
  dialog.querySelector('[data-new-room]')?.addEventListener('click',()=>{
   editing=true;fields='';draft=null;uncertain=false;notice='';render()
   dialog.querySelector<HTMLInputElement>('input')?.focus()
  })
  dialog.querySelector('[data-back-rooms]')?.addEventListener('click',()=>{
   if(uncertain){close();return}
   editing=false;notice='';render();focus()
  })
  dialog.querySelector<HTMLFormElement>('[data-room-form]')?.addEventListener('submit',event=>{
   event.preventDefault()
   fields=dialog.querySelector<HTMLInputElement>('input')!.value.trim()
   if(!namedChatRoomName(fields)){
    notice='Use a name up to 48 characters. General is reserved.'
    dialog.querySelector('[role=status]')!.textContent=notice
    return
   }
   if(draft?.name!==fields)draft={id:crypto.randomUUID(),name:fields}
   void save(false)
  })
  dialog.querySelector('[data-check]')?.addEventListener('click',()=>{void save(true)})
  dialog.querySelectorAll<HTMLButtonElement>('[data-open-room]').forEach(button=>{
   button.onclick=()=>choose(button.dataset.openRoom||undefined)
  })
 }
 dialog.oncancel=event=>{event.preventDefault();if(!busy)close()};document.body.append(dialog);render();dialog.showModal();focus();void load()
 return {dispose:close,close,isOpen:()=>!disposed}
}
