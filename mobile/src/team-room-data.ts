import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
export type TeamScope={teamName:string;leagueName:string;flight:string}
export type TeamMessage={id:string;senderUserId:string;senderName:string;body:string;kind:string;createdAt:string;deletedAt:string;isMine:boolean;replyToMessageId:string;hasAttachment:boolean;card:{matchDate:string;opponent:string;facility:string;matchTime:string;state:string;lineup:{label:string;players:string[];defaulted:boolean}[]}|null}
export type NativeTeamRoom=TeamScope & {id:string;subject:string;messages:TeamMessage[];members:{name:string;roles:string[]}[];nextMatch:{matchDate:string;matchTime:string;opponent:string;facility:string}|null;activeCardId:string;activeCard:TeamMessage|null;muted:boolean;chatReady:boolean;blockedMembers:{id:string;name:string}[]}
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
  return {id:str(item.id),senderUserId:str(item.senderUserId),senderName:str(item.senderName)||'Team member',body:str(item.deletedAt)?'Message removed.':str(item.body),kind:str(item.kind),createdAt:str(item.createdAt),deletedAt:str(item.deletedAt),isMine:item.isMine===true,replyToMessageId:str(item.replyToMessageId),hasAttachment:Boolean(item.attachment),card:item.card && !str(item.deletedAt)?{matchDate:str(card.matchDate),opponent:str(card.opponent),facility:str(card.facility),matchTime:str(card.matchTime),state:str(card.state),lineup:array(card.lineup).slice(0,12).map(value=>{const court=record(value);return {label:str(court.label),players:array(court.players).filter((name):name is string=>typeof name==='string').slice(0,8),defaulted:court.defaulted===true}})}:null}
 }).filter(message=>message.id)
 const next=record(row.nextScheduledMatch)
 return {teams,room:{...roomScope,id:str(row.id),chatReady:row.chatReady===true,blockedMembers:array(row.blockedMembers).slice(0,1000).map(value=>{const member=record(value);return {id:str(member.id),name:str(member.name)||'Team member'}}).filter(member=>member.id),subject:str(row.subject)||roomScope.teamName,activeCardId:str(row.activeCardId),muted:row.muted===true,activeCard:messages.find(message=>message.id===str(row.activeCardId)) || null,messages:messages.slice(-75),members:row.members.slice(0,100).map(value=>{const member=record(value);return {name:str(member.name)||'Team member',roles:array(member.roles).filter((role):role is string=>typeof role==='string')}}),nextMatch:row.nextScheduledMatch?{matchDate:str(next.matchDate),matchTime:str(next.matchTime),opponent:str(next.opponent),facility:str(next.facility)}:null}}
}
export async function loadTeamRoom(client:SupabaseClient,userId:string,isCurrent:()=>boolean,selected?:TeamScope,send:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options)) {
 const {data,error}=await client.auth.getSession()
 if(error || !data.session || data.session.user.id!==userId || !isCurrent())throw Error('Sign in again to open your team.')
 const url=new URL('https://www.tenaceiq.com/api/team-rooms')
 if(selected){url.searchParams.set('team',selected.teamName);url.searchParams.set('league',selected.leagueName);url.searchParams.set('flight',selected.flight)}
 const response=await send({url:url.toString(),headers:{Authorization:`Bearer ${data.session.access_token}`},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
 if(response.status!==200)throw Error(response.status===403?'Team access is unavailable.':'Team Room unavailable')
 const parsed=parseTeamData(response.data)
 if(selected && parsed.room && (parsed.room.teamName!==selected.teamName || parsed.room.leagueName!==selected.leagueName || parsed.room.flight!==selected.flight))throw Error('Team scope mismatch')
 return parsed
}
