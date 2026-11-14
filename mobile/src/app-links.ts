import {App} from '@capacitor/app'
import type {PluginListenerHandle} from '@capacitor/core'
import {coachInvitationToken} from '../../lib/native-coach-connection-contract'
import {nativeInviteToken} from '../../lib/native-team-invite-contract'
import {namedChatRoomId} from '../../lib/named-team-chat-rooms'
import {teamChatMessageId} from '../../lib/team-chat-cursor'
import type {TeamChatDestination} from './team-room-data'

export type AppLink = {kind:'coach-invite';href:string}|{kind:'team-invite';href:string}|{kind:'chat';scope:TeamChatDestination}|{kind:'league';id:string}|{kind:'tournament';id:string}|{kind:'match';id:string}
const key=/^[a-zA-Z0-9_-]{1,80}$/
// Only content routes owned by TenAceIQ. Auth callbacks, billing, arbitrary next
// parameters and API URLs must never become app navigation or auth operations.
export function readAppLink(value:unknown):AppLink|null {
 if(typeof value!=='string'||value.length>1800||/[\u0000-\u0020\\]/.test(value))return null
 try{
  const u=new URL(value)
  if(u.protocol!=='https:'||!['www.tenaceiq.com','tenaceiq.com'].includes(u.hostname)||u.port||u.username||u.password||u.hash)return null
  const only=(keys:string[])=>Array.from(u.searchParams.keys()).every(k=>keys.includes(k)&&u.searchParams.getAll(k).length===1)
  if(/^\/coach\/invite\/[^/]+\/?$/.test(u.pathname)&&only([])){coachInvitationToken(u.href);return {kind:'coach-invite',href:u.href}}
  if(u.pathname==='/team-room/join'&&only(['token'])&&nativeInviteToken(u.href))return {kind:'team-invite',href:u.href}
  if(u.pathname==='/team-room'&&only(['team','league','flight','chatRoom','message'])){
   const teamName=u.searchParams.get('team')||'',leagueName=u.searchParams.get('league')||'',flight=u.searchParams.get('flight')||'',chatRoomId=u.searchParams.get('chatRoom'),messageId=u.searchParams.get('message')
   if(!teamName.trim()||!leagueName.trim()||[teamName,leagueName,flight].some(s=>s.length>200||/[\u0000-\u001f\u007f]/.test(s))||chatRoomId!==null&&!namedChatRoomId(chatRoomId)||messageId!==null&&!teamChatMessageId(messageId))return null
   return {kind:'chat',scope:{teamName,leagueName,flight,...(chatRoomId?{chatRoomId}:{}),...(messageId?{messageId}:{})}}
  }
  const match=u.pathname.match(/^\/(explore\/leagues\/tiq|tournaments|matches)\/([a-zA-Z0-9_-]+)\/?$/)
  if(!match||!key.test(match[2])||!only(match[1]==='matches'?['via']:[])||u.searchParams.has('via')&&u.searchParams.get('via')!=='scorecard-share')return null
  return {kind:match[1]==='explore/leagues/tiq'?'league':match[1]==='tournaments'?'tournament':'match',id:match[2]}
 }catch{return null}
}
export const appLinkTitle=(link:AppLink)=>({'coach-invite':'Coach invitation','team-invite':'Team invitation',chat:'Team conversation',league:'TiQ league',tournament:'Tournament',match:'Match scorecard'})[link.kind]

// One short-lived, memory-only handoff. Invitation tokens never reach device
// storage, history, telemetry, or logs. A sign-out/account switch clears it.
export function createAppLinkHandoff(changed:(link:AppLink|null,cold:boolean)=>void,source:Pick<typeof App,'addListener'|'getLaunchUrl'>=App,now=()=>Date.now()){
 let owner:string|null=null,pending:{link:AppLink;owner:string|null;at:number}|null=null,handle:PluginListenerHandle|null=null,disposed=false,arrivals=0,last='',lastAt=0
 const clear=()=>{pending=null;changed(null,false)}
 const peek=()=>{if(pending&&now()-pending.at>10*60*1000)clear();return pending?.link||null}
 const receive=(value:unknown,cold=false)=>{
  if(disposed)return false
  const link=readAppLink(value);if(!link)return false
  const identity=JSON.stringify(link),at=now();if(identity===last&&at-lastAt<1500)return true
  last=identity;lastAt=at;pending={link,owner,at};changed(link,cold)
  return true
 }
 const ready=source.addListener('appUrlOpen',event=>{arrivals++;receive(event.url,arrivals===1)}).then(async listener=>{
  if(disposed){await listener.remove();return}handle=listener
  try{const launch=await source.getLaunchUrl();if(!disposed&&arrivals===0)receive(launch?.url,true)}catch{/* Links can still arrive through appUrlOpen. */}
 }).catch(()=>{})
 return {ready,receive,peek,clear,setOwner(next:string|null){if(owner&&owner!==next)clear();owner=next;if(pending&&pending.owner===null&&next)pending.owner=next},take(expectedOwner:string){const link=peek();if(!link||owner!==expectedOwner||pending?.owner!==expectedOwner)return null;clear();return link},dispose(){disposed=true;pending=null;void handle?.remove()}}
}
