import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {watchTeamChat} from './team-chat-live'
export type ChatUnread={owner:string;total:number;teams:(TeamScope&{unread:number})[]}
const count=(value:unknown):value is number=>Number.isInteger(value)&&Number(value)>=0&&Number(value)<=100
const key=(scope:TeamScope)=>JSON.stringify([scope.teamName,scope.leagueName,scope.flight])
export function parseChatUnread(value:unknown,owner:string):ChatUnread{
 const row=value as Partial<ChatUnread>&{ok?:boolean}
 if(!row||row.ok!==true||row.owner!==owner||!count(row.total)||!Array.isArray(row.teams)||row.teams.length>50)throw Error('Chat counts unavailable')
 const ids=new Set<string>()
 const teams=row.teams.map(team=>{
  if(!team||typeof team.teamName!=='string'||!team.teamName.trim()||team.teamName.length>160||typeof team.leagueName!=='string'||!team.leagueName.trim()||team.leagueName.length>160||typeof team.flight!=='string'||team.flight.length>120||!count(team.unread)||ids.has(key(team)))throw Error('Chat counts unavailable')
  ids.add(key(team));return {teamName:team.teamName,leagueName:team.leagueName,flight:team.flight,unread:team.unread}
 })
 if(row.total!==Math.min(100,teams.reduce((sum,team)=>sum+team.unread,0)))throw Error('Chat counts unavailable')
 return {owner,total:row.total,teams}
}
export async function loadChatUnread(client:SupabaseClient,owner:string,current:()=>boolean,send=CapacitorHttp.get){
 const {data,error}=await client.auth.getSession(),session=data.session
 if(error||session?.user.id!==owner||!current())throw Error('Chat account changed')
 const response=await send({url:'https://www.tenaceiq.com/api/mobile/chats/unread',headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000,webFetchExtra:{cache:'no-store'}})
 const latest=await client.auth.getSession()
 if(latest.error||latest.data.session?.user.id!==owner||!current()||response.status!==200)throw Error('Chat counts unavailable')
 return parseChatUnread(response.data,owner)
}
export function paintChatsBadge(button:HTMLElement,count:number|null){
 button.setAttribute('aria-label',count===null?'Chats':count===100?'Chats, 99+ unread messages':'Chats, '+count+' unread messages')
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
