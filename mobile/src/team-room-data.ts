import {readTeamChatCursor} from '../../lib/team-chat-cursor'
import {parseChatReactions,type ChatReaction} from './chat-reactions'
import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
export class TeamRoomAccessError extends Error {}
export type TeamScope={teamName:string;leagueName:string;flight:string}
export type ReplacementRequest={courtLabel:string;outgoingPlayerName:string;replacementPlayerName:string;afterPlayers:string[];response:'accepted'|'declined'|'';deadlineAt:string;token:string;canRespond:boolean}
export function parseReplacement(value:unknown):ReplacementRequest|null{const row=record(value);if(!str(row.courtLabel)||!str(row.replacementPlayerName)||!Array.isArray(row.afterPlayers)||!/^[a-f0-9]{64}$/.test(str(row.token)))return null;const response=row.response==='accepted'||row.response==='declined'?row.response:'';return {courtLabel:str(row.courtLabel).slice(0,80),outgoingPlayerName:str(row.outgoingPlayerName).slice(0,120),replacementPlayerName:str(row.replacementPlayerName).slice(0,120),afterPlayers:row.afterPlayers.filter((v):v is string=>typeof v==='string').slice(0,4).map(v=>v.slice(0,120)),response,deadlineAt:str(row.deadlineAt).slice(0,40),token:str(row.token),canRespond:row.canRespond===true&&!response}}
export type TeamMessage={editedAt?:string;canManageOwn?:boolean;response?:string;hasPhoto?:boolean;reactions?:ChatReaction[];id:string;senderUserId:string;senderName:string;body:string;kind:string;createdAt:string;deletedAt:string;isMine:boolean;replyToMessageId:string;hasAttachment:boolean;card:{replacement?:ReplacementRequest|null;cardType?:string;lineupVersion?:number;acknowledged?:boolean;completed?:boolean;published?:boolean;arrivals?:{profileId:string;status:string;playerName:string;courtLabel:string}[];matchDate:string;opponent:string;facility:string;matchTime:string;state:string;lineup:{label:string;players:string[];defaulted:boolean}[]}|null}
export type NativeTeamRoom=TeamScope & {canManage?:boolean;id:string;subject:string;messages:TeamMessage[];members:{id?:string;playerName?:string;name:string;roles:string[]}[];finalLineupReview?:{announcementMessageId:string;currentUserRequired:boolean;currentUserSeen:boolean}|null;nextMatch:{matchDate:string;matchTime:string;opponent:string;facility:string}|null;activeCardId:string;activeCard:TeamMessage|null;muted:boolean;chatReady:boolean;lastReadAt:string;blockedMembers:{id:string;name:string}[]}
export type NativeTeamData={teams:TeamScope[];room:NativeTeamRoom|null}
const record=(value:unknown):Record<string,unknown>=>value && typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const str=(value:unknown)=>typeof value==='string'?value:''
const array=(value:unknown)=>Array.isArray(value)?value:[]
const scope=(value:unknown):TeamScope=>{const row=record(value);return {teamName:str(row.teamName),leagueName:str(row.leagueName),flight:str(row.flight)}}
export function parseTeamData(value:unknown):NativeTeamData {
 const root=record(value)
 if(root.ok!==true || !Array.isArray(root.teams) || (root.room!==null && !root.room))throw Error('Invalid team response')
 const teams=root.teams.map(scope).filter(team=>team.teamName && team.leagueName).slice(0,50)
 if(root.room===null)return {teams,room:null}
 const row=record(root.room),roomScope=scope(row)
 if(!str(row.id) || !roomScope.teamName || !roomScope.leagueName || !Array.isArray(row.messages) || !Array.isArray(row.members))throw Error('Invalid team room')
 const messages:TeamMessage[]=row.messages.slice(-300).map(value=>{
  const item=record(value),card=record(item.card)
  return {editedAt:str(item.editedAt),canManageOwn:item.canManageOwn===true && item.isMine===true && !str(item.deletedAt),response:['yes','maybe','no'].includes(str(item.response))?str(item.response):'',hasPhoto:!str(item.deletedAt) && Number(record(item.attachment).size)>0 && Number(record(item.attachment).size)<=2097152 && ['image/jpeg','image/png','image/webp'].includes(str(record(item.attachment).mimeType)),reactions:str(item.deletedAt)?[]:parseChatReactions(item.reactions),id:str(item.id),senderUserId:str(item.senderUserId),senderName:str(item.senderName)||'Team member',body:str(item.deletedAt)?'Message removed.':str(item.body),kind:str(item.kind),createdAt:str(item.createdAt),deletedAt:str(item.deletedAt),isMine:item.isMine===true,replyToMessageId:str(item.replyToMessageId),hasAttachment:Boolean(item.attachment),card:item.card && !str(item.deletedAt)?{replacement:parseReplacement(card.nativeReplacement),cardType:str(card.cardType),lineupVersion:Math.max(0,Math.floor(Number(card.lineupVersion)||0)),acknowledged:card.acknowledged===true,completed:Boolean(str(card.matchCompletedAt)),published:Boolean(card.finalLineup),arrivals:array(card.arrivalCheckIns).slice(0,100).map(value=>{const arrival=record(value);return {profileId:str(arrival.profileId),status:str(arrival.status),playerName:str(arrival.playerName),courtLabel:str(arrival.courtLabel)}}),matchDate:str(card.matchDate),opponent:str(card.opponent),facility:str(card.facility),matchTime:str(card.matchTime),state:str(card.state),lineup:array(card.lineup).slice(0,12).map(value=>{const court=record(value);return {label:str(court.label),players:array(court.players).filter((name):name is string=>typeof name==='string').slice(0,8),defaulted:court.defaulted===true}})}:null}
 }).filter(message=>message.id)
 const next=record(row.nextScheduledMatch)
 return {teams,room:{canManage:row.canManage===true,finalLineupReview:row.finalLineupReview?{announcementMessageId:str(record(row.finalLineupReview).announcementMessageId),currentUserRequired:record(row.finalLineupReview).currentUserRequired===true,currentUserSeen:record(row.finalLineupReview).currentUserSeen===true}:null,...roomScope,id:str(row.id),chatReady:row.chatReady===true,lastReadAt:str(row.lastReadAt),blockedMembers:array(row.blockedMembers).slice(0,1000).map(value=>{const member=record(value);return {id:str(member.id),name:str(member.name)||'Team member'}}).filter(member=>member.id),subject:str(row.subject)||roomScope.teamName,activeCardId:str(row.activeCardId),muted:row.muted===true,activeCard:messages.find(message=>message.id===str(row.activeCardId)) || null,messages:messages.slice(-75),members:row.members.slice(0,100).map(value=>{const member=record(value);return {id:str(member.id),playerName:str(member.playerName),name:str(member.name)||'Team member',roles:array(member.roles).filter((role):role is string=>typeof role==='string')}}),nextMatch:row.nextScheduledMatch?{matchDate:str(next.matchDate),matchTime:str(next.matchTime),opponent:str(next.opponent),facility:str(next.facility)}:null}}
}
export async function loadTeamRoom(client:SupabaseClient,userId:string,isCurrent:()=>boolean,selected?:TeamScope,send:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options)) {
 const {data,error}=await client.auth.getSession()
 if(error || !data.session || data.session.user.id!==userId || !isCurrent())throw Error('Sign in again to open your team.')
 const url=new URL('https://www.tenaceiq.com/api/team-rooms')
 url.searchParams.set('read','0')
 if(selected){url.searchParams.set('team',selected.teamName);url.searchParams.set('league',selected.leagueName);url.searchParams.set('flight',selected.flight)}
 const response=await send({url:url.toString(),headers:{Authorization:`Bearer ${data.session.access_token}`},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
 if(response.status===401 || response.status===403)throw new TeamRoomAccessError('Team access is unavailable.')
 if(response.status!==200)throw Error('Team Room unavailable')
 const parsed=parseTeamData(response.data)
 if(selected && parsed.room && (parsed.room.teamName!==selected.teamName || parsed.room.leagueName!==selected.leagueName || parsed.room.flight!==selected.flight))throw Error('Team scope mismatch')
 return parsed
}
export async function loadTeamChatUpdate(client:SupabaseClient,userId:string,isCurrent:()=>boolean,selected:TeamScope,roomId:string,send:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options),before='') {
 if(before && !readTeamChatCursor(before))throw Error('Invalid conversation page')
 const {data,error}=await client.auth.getSession()
 if(error || data.session?.user.id!==userId || !isCurrent())throw Error('Sign in again to open your team.')
 const url=new URL('https://www.tenaceiq.com/api/team-rooms/chat')
 for(const [key,value] of [['team',selected.teamName],['league',selected.leagueName],['flight',selected.flight],['chatUpdates','1']])url.searchParams.set(key,value)
 if(before)url.searchParams.set('before',before)
 const response=await send({url:url.toString(),headers:{Authorization:`Bearer ${data.session.access_token}`},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
 if(response.status===401 || response.status===403)throw new TeamRoomAccessError('Team access is unavailable.')
 const root=record(response.data),room=record(root.room)
 if(response.status!==200 || root.ok!==true || root.chatUpdate!==true || !Array.isArray(room.blockedUserIds) || room.id!==roomId)throw Error('Conversation updates are unavailable.')
 if((before || root.beforeCursor!==undefined) && root.beforeCursor!==before)throw Error('Conversation page mismatch')
 const nextCursor=typeof root.nextCursor==='string'?root.nextCursor:''
 if(nextCursor && !readTeamChatCursor(nextCursor))throw Error('Invalid conversation page')
 const parsed=parseTeamData({ok:true,teams:[selected],room:{...selected,...room,members:[]}}).room!
 return {beforeCursor:before,nextCursor,messages:parsed.messages,lastReadAt:parsed.lastReadAt,blockedUserIds:array(room.blockedUserIds).filter((id):id is string=>typeof id==='string').slice(0,1000)}
}
