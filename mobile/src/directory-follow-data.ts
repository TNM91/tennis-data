import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp} from '@capacitor/core'
import type {LeagueCard} from '../../lib/league-summary'
import {buildScopedTeamEntityId} from '../../lib/entity-ids'
import type {TeamChoice} from './directory-data'
import {followSession,canFollowPlayers,FollowAccessError} from './follows-data'
import {parseFollowedEntities,type FollowedEntity} from './followed-entities'
export type DirectoryFollow=FollowedEntity & {entity_type:'team'|'league'}
export function directoryFollowItem(value:TeamChoice|LeagueCard):DirectoryFollow|null{
 let item:DirectoryFollow
 if('name' in value){
  if(value.followLayer!=='usta'||!value.league?.trim()||!value.flight?.trim()||[value.name,value.league,value.flight].some(part=>typeof part!=='string'||part.includes('__')))return null
  item={entity_type:'team',entity_id:buildScopedTeamEntityId({competitionLayer:value.followLayer,teamName:value.name,leagueName:value.league,flight:value.flight}),entity_name:value.name,subtitle:[value.league,value.flight].join(' - ')}
 }else{
  if(!['usta','tiq'].includes(value.competitionLayer))return null
  const parts=[value.leagueName,value.flight,value.ustaSection,value.districtArea]
  if(parts.some(part=>typeof part!=='string'||part.includes('__')))return null
  const key=[value.competitionLayer,...parts.map(part=>part.trim().toLowerCase())].join('__')
  if(value.key!==key)return null
  item={entity_type:'league',entity_id:value.key,entity_name:value.leagueName,subtitle:[value.flight,value.ustaSection,value.districtArea].filter(Boolean).join(' - ')||null}
 }
 try{parseFollowedEntities([item],item.entity_type);return item}catch{return null}
}
export async function directoryFollowStatus(client:SupabaseClient,item:DirectoryFollow,current:()=>boolean,access:typeof canFollowPlayers=canFollowPlayers){
 if(!['team','league'].includes(item.entity_type))throw Error('Follow unavailable')
 parseFollowedEntities([item],item.entity_type)
 const session=await followSession(client,current)
 const {data,error}=await client.from('user_follows').select('id').eq('user_id',session.user.id).eq('entity_type',item.entity_type).eq('entity_id',item.entity_id).limit(1).abortSignal(AbortSignal.timeout(12000))
 if(error||!Array.isArray(data)||data.length>1||data.some(row=>!row||typeof row.id!=='string'||!row.id.trim()))throw Error('Follow status unavailable')
 const following=data.length===1
 const canAdd=following||await access(client,current)
 const next=await followSession(client,current)
 if(next.user.id!==session.user.id)throw Error('Follow status unavailable')
 return {ownerId:session.user.id,following,canAdd}
}
export async function saveDirectoryFollow(client:SupabaseClient,item:DirectoryFollow,following:boolean,ownerId:string,current:()=>boolean,send:typeof CapacitorHttp.request=options=>CapacitorHttp.request(options)){
 if(!['team','league'].includes(item.entity_type))throw Error('Follow unavailable')
 const [saved]=parseFollowedEntities([item],item.entity_type)
 const session=await followSession(client,current)
 if(session.user.id!==ownerId)throw Error('Account changed. Check follow status again.')
 const response=await send({url:'https://www.tenaceiq.com/api/follows',method:following?'POST':'DELETE',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},data:saved,responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
 const next=await followSession(client,current)
 if(next.user.id!==ownerId)throw Error('Account changed. Check follow status again.')
 if(response.status===403)throw new FollowAccessError('Player access is required to add follows.')
 if(response.status<200||response.status>=300||response.data?.ok!==true||response.data.following!==following)throw Error('Could not confirm follow change')
}
