import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {namedTeamChatRooms} from './named-team-chat-rooms'
import type {TeamRoomScope} from './team-room'

/** Reuses the installed room-access and read-position aggregate. Never creates rooms. */
export async function nativeChatUnread(service:SupabaseClient,owner:string){
 const {data,error}=await service.from('team_profile_links').select('team_name,league_name,flight').eq('profile_user_id',owner).eq('status','accepted').is('archived_at',null).limit(51)
 if(error||!Array.isArray(data)||data.length>50)throw Error('Chat counts unavailable')
 const scopes=new Map<string,TeamRoomScope>()
 for(const row of data){
  if(typeof row.team_name!=='string'||!row.team_name.trim()||row.team_name.length>160||typeof row.league_name!=='string'||!row.league_name.trim()||row.league_name.length>160||row.flight!=null&&typeof row.flight!=='string'||String(row.flight||'').length>120)throw Error('Chat counts unavailable')
  const scope={teamName:row.team_name,leagueName:row.league_name,flight:row.flight||''};scopes.set(JSON.stringify(scope),scope)
 }
 const teams=[...scopes.values()].map(scope=>({...scope,unread:0}));let index=0,unavailable=false
 await Promise.all(Array.from({length:Math.min(4,teams.length)},async()=>{
  while(index<teams.length&&!unavailable){
   const team=teams[index++],result=await namedTeamChatRooms(service,owner,team,'list')
   // A team without an initialized room, or with revoked membership, has no accessible unread posts.
   if(!result.ok){if(result.status===403)continue;unavailable=true;throw Error('Chat counts unavailable')}
   if(!('rooms' in result)){unavailable=true;throw Error('Chat counts unavailable')}
   team.unread=Math.min(100,result.generalUnread+result.rooms.reduce((sum,room)=>sum+room.unread,0))
  }
 }))
 return {owner,total:Math.min(100,teams.reduce((sum,team)=>sum+team.unread,0)),teams}
}
