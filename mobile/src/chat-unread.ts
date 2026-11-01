import {coachId} from '../../lib/native-coach-contract'
import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {watchTeamChat} from './team-chat-live'
import {namedChatRoomId,namedChatRoomName} from '../../lib/named-team-chat-rooms'
export type ChatUnreadTeam=TeamScope&{unread:number;generalUnread?:number;rooms?:{id:string;name:string;unread:number}[]}
export type CoachChatUnread={available:boolean;total:number;connections:{id:string;unread:number;latest?:string|null}[]}
/** total remains the legacy team total for installed builds. */
export type ChatUnread={owner:string;total:number;teams:ChatUnreadTeam[];coach?:CoachChatUnread}
export const combinedChatUnread=(value:ChatUnread|null)=>value?Math.min(100,value.total+(value.coach?.total||0)):null
const count=(value:unknown):value is number=>Number.isInteger(value)&&Number(value)>=0&&Number(value)<=100
const key=(scope:TeamScope)=>JSON.stringify([scope.teamName,scope.leagueName,scope.flight])
export function parseChatUnread(value:unknown,owner:string):ChatUnread{
 const row=value as Partial<ChatUnread>&{ok?:boolean}
 if(!row||row.ok!==true||row.owner!==owner||!count(row.total)||!Array.isArray(row.teams)||row.teams.length>50)throw Error('Chat counts unavailable')
 const ids=new Set<string>()
 const teams=row.teams.map(team=>{
  if(!team||typeof team.teamName!=='string'||!team.teamName.trim()||team.teamName.length>160||typeof team.leagueName!=='string'||!team.leagueName.trim()||team.leagueName.length>160||typeof team.flight!=='string'||team.flight.length>120||!count(team.unread)||ids.has(key(team)))throw Error('Chat counts unavailable')
  const hasRooms=team.generalUnread!==undefined||team.rooms!==undefined
  if(hasRooms&&(!count(team.generalUnread)||!Array.isArray(team.rooms)||team.rooms.length>12||team.rooms.some(room=>!room||!namedChatRoomId(room.id)||!namedChatRoomName(room.name)||!count(room.unread))||new Set(team.rooms.map(room=>room.id)).size!==team.rooms.length||team.unread!==Math.min(100,team.generalUnread+team.rooms.reduce((sum,room)=>sum+room.unread,0))))throw Error('Chat counts unavailable')
  ids.add(key(team));return {teamName:team.teamName,leagueName:team.leagueName,flight:team.flight,unread:team.unread,...(hasRooms?{generalUnread:team.generalUnread,rooms:team.rooms!.map(({id,name,unread})=>({id,name,unread}))}:{})}
 })
 if(row.total!==Math.min(100,teams.reduce((sum,team)=>sum+team.unread,0)))throw Error('Chat counts unavailable')
 let coach:CoachChatUnread|undefined
 if(row.coach!==undefined){
  const input=row.coach
  if(!input||typeof input.available!=='boolean'||!count(input.total)||!Array.isArray(input.connections)||input.connections.length>100)throw Error('Coach counts unavailable')
  const ids=new Set<string>(),connections=input.connections.map(c=>{const id=coachId(c?.id);if(ids.has(id)||!count(c.unread)||c.latest!==undefined&&c.latest!==null&&(typeof c.latest!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.latest)))throw Error('Coach counts unavailable');ids.add(id);return {id,unread:c.unread,...(c.latest!==undefined?{latest:c.latest}:{})}})
  if(input.total!==Math.min(100,connections.reduce((sum,c)=>sum+c.unread,0))||!input.available&&(input.total!==0||connections.length!==0))throw Error('Coach counts unavailable')
  coach={available:input.available,total:input.total,connections}
 }
 return {owner,total:row.total,teams,...(coach?{coach}:{})}
}
export async function loadChatUnread(client:SupabaseClient,owner:string,current:()=>boolean,send=CapacitorHttp.get){
 const {data,error}=await client.auth.getSession(),session=data.session
 if(error||session?.user.id!==owner||!current())throw Error('Chat account changed')
 const response=await send({url:'https://www.tenaceiq.com/api/mobile/chats/unread',headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000,webFetchExtra:{cache:'no-store'}})
 const latest=await client.auth.getSession()
 if(latest.error||latest.data.session?.user.id!==owner||!current()||response.status!==200)throw Error('Chat counts unavailable')
 return parseChatUnread(response.data,owner)
}
export function paintChatsBadge(button:HTMLElement,count:number|null,partial=false){
 button.setAttribute('aria-label',partial?(count?'Chats, at least '+(count===100?'99+':count)+' unread messages. Some counts unavailable.':'Chats, unread counts unavailable.'):count===null?'Chats':count===100?'Chats, 99+ unread messages':'Chats, '+count+' unread messages')
 const badge=button.querySelector<HTMLElement>('[data-chat-badge]');if(!badge)return
 badge.hidden=count===null||count===0;badge.textContent=count===null?'':count===100?'99+':String(count)
}
export function paintTeamUnread(host:HTMLElement,summary:ChatUnread|null,teams:TeamScope[]){
 for(const button of host.querySelectorAll<HTMLElement>('[data-open-team-chat]')){
  const team=teams[Number(button.dataset.openTeamChat)],unread=team&&summary?.teams.find(item=>key(item)===key(team))?.unread
  const badge=button.querySelector<HTMLElement>('[data-team-unread]');if(badge){badge.hidden=!unread;badge.textContent=unread===100?'99+':String(unread||'')}
  if(team)button.setAttribute('aria-label',[team.teamName,team.leagueName,team.flight].filter(Boolean).join(' · ')+(unread?', '+(unread===100?'99+':unread)+' unread messages':''))
 }
}
/** One content-free foreground subscription, burst coalescing, no polling or stored counts. */
export function createChatUnreadCounter(client:SupabaseClient,changed:(value:ChatUnread|null)=>void,load=loadChatUnread,watch=watchTeamChat){
 let owner:string|null=null,epoch=0,summary:ChatUnread|null=null,live:ReturnType<typeof watch>|null=null,pending:Promise<void>|null=null,queued=false
 const refresh=():Promise<void>=>{
  if(!owner)return Promise.resolve()
  if(pending){queued=true;return pending}
  const who=owner,version=epoch,current=()=>owner===who&&epoch===version
  pending=load(client,who,current).then(value=>{if(current()){summary=value;changed(value)}}).catch(()=>{if(current()){summary=null;changed(null)}}).finally(()=>{if(!current())return;pending=null;if(queued){queued=false;void refresh()}})
  return pending
 }
 return {refresh,snapshot:()=>summary,setOwner(next:string|null){
  if(next===owner)return
  live?.dispose();live=null;owner=next;epoch++;pending=null;queued=false;summary=null;changed(null)
  if(next){void refresh();live=watch(client,next,null,()=>owner===next,refresh,()=>{})}
 },clear(){this.setOwner(null)}}
}
