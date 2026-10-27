import type {SupabaseClient} from '@supabase/supabase-js'
import {followSession} from './follows-data'
import {CapacitorHttp} from '@capacitor/core'
import type {PlayerChoice} from './player-connection'
import type {TeamChoice} from './directory-data'
import type {LeagueCard} from '../../lib/league-summary'
import {isPublicTeamDirectoryName} from '../../lib/team-directory-rules'
export type FollowKind='player'|'team'|'league'
export type FollowedEntity={entity_type:FollowKind;entity_id:string;entity_name:string;subtitle:string|null}
export type FollowedLeagueScope={layer:''|'usta'|'tiq';name:string;flight:string;section:string;district:string}
export type FollowedTarget={kind:'player';player:PlayerChoice}|{kind:'team';team:TeamChoice}|{kind:'league';scope:FollowedLeagueScope}
export function parseFollowedEntities(value:unknown,kind:FollowKind){
 if(!Array.isArray(value)||value.length>25)throw Error('Following unavailable.')
 const ids=new Set<string>()
 return value.map(raw=>{
  const row=raw as FollowedEntity
  if(!row||row.entity_type!==kind||typeof row.entity_id!=='string'||!row.entity_id.trim()||row.entity_id.length>160||typeof row.entity_name!=='string'||!row.entity_name.trim()||row.entity_name.length>200||row.subtitle!==null&&(typeof row.subtitle!=='string'||row.subtitle.length>300)||ids.has(row.entity_id))throw Error('Following unavailable.')
  ids.add(row.entity_id);return {entity_type:kind,entity_id:row.entity_id,entity_name:row.entity_name,subtitle:row.subtitle}
 })
}
export async function loadFollowedEntities(client:SupabaseClient,kind:FollowKind,current:()=>boolean){
 if(!['player','team','league'].includes(kind))throw Error('Following unavailable.')
 const session=await followSession(client,current)
 const {data,error}=await client.from('user_follows').select('entity_type,entity_id,entity_name,subtitle').eq('user_id',session.user.id).eq('entity_type',kind).order('entity_name',{ascending:true}).order('entity_id',{ascending:true}).limit(25).abortSignal(AbortSignal.timeout(12000))
 const next=await followSession(client,current);if(next.user.id!==session.user.id||error)throw Error('Following unavailable.')
 const rows=parseFollowedEntities(data,kind);return {rows:rows.slice(0,24),limited:rows.length>24}
}
export function followedTarget(item:FollowedEntity):FollowedTarget|null {
 if(item.entity_type==='player')return /^[a-zA-Z0-9_-]{1,100}$/.test(item.entity_id)?{kind:'player',player:{id:item.entity_id,name:item.entity_name,location:null,flight:null}}:null
 const parts=item.entity_id.split('__');if(parts.some(part=>part!==part.trim()||part.length>200))return null
 if(item.entity_type==='team'){
  const scoped=parts.length===4;if(!scoped&&parts.length!==3)return null
  const [layer,name,league,flight]=scoped?parts:['',...parts]
  // The public roster/fixture view currently supports USTA/source teams only.
  if(layer!=='usta'||!name||!league||!flight||/\btiq\b/i.test(league)||!isPublicTeamDirectoryName(name,league))return null
  return {kind:'team',team:{name,league,flight,source:'recorded'}}
 }
 const scoped=parts.length===5;if(!scoped&&parts.length!==4)return null
 const [layer,name,flight,section,district]=scoped?parts:['',...parts]
 if(!['','usta','tiq'].includes(layer)||!name)return null
 return {kind:'league',scope:{layer:layer as FollowedLeagueScope['layer'],name,flight,section,district}}
}
export function followedLeagueRows(rows:LeagueCard[],scope:FollowedLeagueScope){
 const savedParts=[scope.name,scope.flight,scope.section,scope.district]
 const matching=rows.filter(row=>{
  if(scope.layer&&row.competitionLayer!==scope.layer)return false
  const parts=[row.leagueName,row.flight,row.ustaSection,row.districtArea]
  // Website league-directory keys lowercase every dimension; detail-page keys retain display case.
  return parts.every((part,index)=>part===savedParts[index])||Boolean(scope.layer&&parts.every((part,index)=>typeof part==='string'&&part.trim().toLowerCase()===savedParts[index]))
 })
 if(!scope.layer&&new Set(matching.map(row=>row.competitionLayer)).size>1)throw Error('Saved league context is ambiguous.')
 return matching
}

/** Remove the exact saved identity; legacy identifiers must not be rebuilt. */
export async function removeFollowedEntity(client:SupabaseClient,item:FollowedEntity,current:()=>boolean,send:typeof CapacitorHttp.request=options=>CapacitorHttp.request(options)){
 if(!item||!['player','team','league'].includes(item.entity_type))throw Error('Following unavailable.')
 const [saved]=parseFollowedEntities([item],item.entity_type)
 const session=await followSession(client,current)
 const response=await send({url:'https://www.tenaceiq.com/api/follows',method:'DELETE',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},data:saved,responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
 const next=await followSession(client,current)
 if(next.user.id!==session.user.id||response.status<200||response.status>=300||response.data?.ok!==true||response.data.following!==false)throw Error('Could not confirm removal. Refresh following before trying again.')
}
