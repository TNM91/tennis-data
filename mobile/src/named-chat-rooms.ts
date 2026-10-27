import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {namedChatRoomId,namedChatRoomName} from '../../lib/named-team-chat-rooms'
import {html} from './match-details'
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
 const data={teamName:scope.teamName,leagueName:scope.leagueName,flight:scope.flight},url=new URL('https://www.tenaceiq.com/api/team-rooms')
 const options={headers:{Authorization:'Bearer '+session.data.session.access_token,'Content-Type':'application/json'},responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:12000}
 let response
 try{if(change)response=await transport.post({...options,url:url.href,data:{...data,action:change.check?'lookup_chat_room':'create_chat_room',clientRoomId:change.id,roomName:change.name}});else{for(const [key,value] of Object.entries({team:data.teamName,league:data.leagueName,flight:data.flight,namedRooms:'1'}))url.searchParams.set(key,value);response=await transport.get({...options,url:url.href})}}
 catch{throw new ChatRoomRequestError(change?'Room creation is not confirmed. Check this same room before retrying.':'Rooms unavailable. Try again when connected.',Boolean(change&&!change.check))}
 if(!current())throw new ChatRoomRequestError('This team is no longer open.',Boolean(change))
 if(response.status!==200||response.data?.ok!==true){throw new ChatRoomRequestError(response.status===409?'That room name or creation request is already in use. Reload rooms before changing it.':response.status===403?'Your team access changed. Reopen Chats.':change&&change.check&&response.status===404?'This exact room is not confirmed. You can retry the same creation.':'Rooms unavailable. Try again when connected.',Boolean(change&&!change.check&&response.status>=500))}
 if(!change)return parseChatRoomList(response.data,parentId)
 const row=response.data
 if(row.namedRooms!==1||row.parentId!==parentId||row.id!==change.id||row.name!==change.name)throw new ChatRoomRequestError('Room creation could not be confirmed.',true)
 return {id:row.id as string,name:row.name as string}
}
export function openChatRooms(client:SupabaseClient,owner:string,scope:TeamScope,parentId:string,current:()=>boolean,onSelect:(id?:string)=>void,onClose:(uncertain:boolean)=>void){
 const origin=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=document.createElement('dialog');dialog.className='chat-post-dialog team-rooms-dialog';dialog.setAttribute('aria-labelledby','team-rooms-title')
 let disposed=false,busy=false,mode:'list'|'edit'|'review'='list',list:ChatRoomList|null=null,fields='',draft:{id:string;name:string}|null=null,attempted=false,confirmed=false,notice=''
 const active=()=>!disposed&&current()&&dialog.isConnected
 const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus()
 const close=()=>{if(disposed)return;disposed=true;dialog.remove();onClose(attempted&&!confirmed);if(origin?.isConnected&&current())origin.focus({preventScroll:true})}
 const load=async()=>{if(!active()||busy)return;busy=true;notice='Loading rooms...';render();try{const result=await requestChatRooms(client,owner,scope,parentId,active);if(!active())return;list=result as ChatRoomList;mode='list';notice=''}catch(error){if(active())notice=error instanceof Error?error.message:'Rooms unavailable.'}finally{if(active()){busy=false;render();focus()}}}
 const save=async(check:boolean)=>{if(!active()||busy||!draft)return;busy=true;if(!check)attempted=true;notice=check?'Checking this room...':'Creating room...';render();try{const result=await requestChatRooms(client,owner,scope,parentId,active,{...draft,check});if(!active())return;confirmed=true;notice='Room ready. Everyone on this team can read and post here.';fields=(result as {name:string}).name}catch(error){if(active())notice=error instanceof Error?error.message:'Room unavailable.'}finally{if(active()){busy=false;render();focus()}}}
 const render=()=>{
  dialog.innerHTML=`<h1 id="team-rooms-title" tabindex="-1">Rooms</h1><p>${html(scope.teamName)}</p>${mode==='list'?`<p>Everyone on this team can read and post in these rooms.</p><ul class="named-room-list"><li><button type="button" class="secondary" data-open-general ${busy?'disabled':''} aria-pressed="${!scope.chatRoomId}"><strong>General</strong><span>Team updates and match day${list?.generalUnread?` · ${list.generalUnread===100?'99+':list.generalUnread} unread`: ''}</span></button></li>${(list?.rooms||[]).map(room=>`<li><button type="button" class="secondary" data-open-room="${html(room.id)}" ${busy?'disabled':''} aria-pressed="${scope.chatRoomId===room.id}"><strong>${html(room.name)}</strong><span>${room.unread?`${room.unread===100?'99+':room.unread} unread`:'Team conversation'}${room.muted?' · Muted':''}</span></button></li>`).join('')}</ul>${list?.canCreate?`<button type="button" data-new-room ${busy?'disabled':''}>Create a room</button>`:''}<button type="button" class="secondary" data-reload ${busy?'disabled':''}>Reload rooms</button>`:mode==='edit'?`<p>Create a space for your team's tennis. Everyone on the team has access.</p><form data-room-form><label>Room name<input name="roomName" maxlength="96" value="${html(fields)}" autocomplete="off" required></label><p class="rating-context">Up to 48 characters. Try Match week, Practice or Clubhouse.</p><button type="submit">Review room</button></form><button type="button" class="secondary" data-back-rooms>Back to rooms</button>`:`<h2>${html(draft?.name||'')}</h2><p>Everyone on this team can read and post here. General and its messages stay in place.</p>${confirmed?'<button type="button" data-open-created>Open room</button>':`<button type="button" data-create ${busy?'disabled':''}>${attempted?'Retry same creation':'Create room'}</button>${attempted?`<button type="button" class="secondary" data-check ${busy?'disabled':''}>Check this room</button>`:'<button type="button" class="secondary" data-edit-room>Edit name</button>'}`}` }<p role="status">${html(notice)}</p><button type="button" class="secondary" data-close-rooms>Close rooms</button>`
  dialog.querySelector('[data-close-rooms]')!.addEventListener('click',close)
  dialog.querySelector('[data-reload]')?.addEventListener('click',()=>{void load()})
  dialog.querySelector('[data-new-room]')?.addEventListener('click',()=>{mode='edit';fields='';notice='';render();dialog.querySelector<HTMLInputElement>('input')?.focus()})
  dialog.querySelector('[data-back-rooms]')?.addEventListener('click',()=>{mode='list';notice='';render();focus()})
  dialog.querySelector<HTMLFormElement>('[data-room-form]')?.addEventListener('submit',event=>{event.preventDefault();fields=dialog.querySelector<HTMLInputElement>('input')!.value.trim();if(!namedChatRoomName(fields)){notice='Use a name up to 48 characters. General is reserved.';dialog.querySelector('[role=status]')!.textContent=notice;return}draft={id:crypto.randomUUID(),name:fields};attempted=false;confirmed=false;mode='review';notice='';render();focus()})
  dialog.querySelector('[data-edit-room]')?.addEventListener('click',()=>{if(attempted||busy)return;mode='edit';render();dialog.querySelector<HTMLInputElement>('input')?.focus()})
  dialog.querySelector('[data-create]')?.addEventListener('click',()=>{void save(false)})
  dialog.querySelector('[data-check]')?.addEventListener('click',()=>{void save(true)})
  const choose=(id?:string)=>{if(busy)return;close();onSelect(id)}
  dialog.querySelector('[data-open-general]')?.addEventListener('click',()=>choose())
  dialog.querySelectorAll<HTMLButtonElement>('[data-open-room]').forEach(button=>{button.onclick=()=>choose(button.dataset.openRoom)})
  dialog.querySelector('[data-open-created]')?.addEventListener('click',()=>choose(draft?.id))
 }
 dialog.oncancel=event=>{event.preventDefault();close()};document.body.append(dialog);render();dialog.showModal();focus();void load()
 return {dispose:close,close,isOpen:()=>!disposed}
}
