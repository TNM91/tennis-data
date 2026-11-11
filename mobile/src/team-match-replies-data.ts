import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {readTeamMatchReplies,type TeamMatchReplies,type TeamMatchReplyChange} from '../../lib/team-match-replies-contract'
import {readSavedTeamLineup,type TeamLineupChange} from '../../lib/team-match-lineup-contract'
import {firstPartyTeamRooms,matchesTeamReleaseScope} from './first-party-team-transport'
import {TeamNextMatchError,type NativeTeamRoom} from './team-room-data'

async function matchRequest(client:SupabaseClient,owner:string,current:()=>boolean,room:NativeTeamRoom,revision:string,
 unavailable:()=>TeamNextMatchError,conflict:string,body?:Record<string,unknown>){
 const {data,error}=await client.auth.getSession()
 if(!room.manualFixture||error||data.session?.user.id!==owner||!current())throw new TeamNextMatchError('Your team access could not be confirmed.')
 const {teamName,leagueName,flight}=room
 const headers={Authorization:'Bearer '+data.session.access_token}
 const options={responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:15000}
 const query=new URLSearchParams({op:'match-replies',team:teamName,league:leagueName,flight,revision})
 let response
 try{
  response=body
   ?await CapacitorHttp.post({...options,url:firstPartyTeamRooms,headers:{...headers,'Content-Type':'application/json'},
    data:{teamName,leagueName,flight,roomId:room.id,...body}})
   :await CapacitorHttp.get({...options,url:firstPartyTeamRooms+'?'+query,headers})
 }catch{throw unavailable()}
 if(!current())throw unavailable()
 if(response.status===409)throw new TeamNextMatchError(conflict,false,409)
 if(response.status===401||response.status===403)throw new TeamNextMatchError('Your team access could not be confirmed.',false,403)
 const reply=response.data
 if(response.status!==200||reply?.ok!==true||reply.roomId!==room.id||reply.revision!==revision||
    !matchesTeamReleaseScope(reply,owner))throw unavailable()
 return reply
}

export async function teamMatchRepliesRequest(client:SupabaseClient,owner:string,current:()=>boolean,
 room:NativeTeamRoom,revision:string,change?:TeamMatchReplyChange):Promise<TeamMatchReplies>{
 const unavailable=()=>new TeamNextMatchError(change?'Your reply could not be confirmed. Retry the same reply.':'Availability couldn’t load. Reload the match.',Boolean(change))
 const reply=await matchRequest(client,owner,current,room,revision,unavailable,'The match or your reply changed. Reload the match.',
  change?{action:'reply_next_match',...change}:undefined)
 try{
  if(!change)return readTeamMatchReplies(reply.replies)
  const result=readTeamMatchReplies({own:reply.reply})
  if(result.own?.id!==change.id||result.own.choice!==change.choice)throw Error()
  return result
 }catch{throw unavailable()}
}

export async function saveTeamMatchLineupRequest(client:SupabaseClient,owner:string,current:()=>boolean,room:NativeTeamRoom,change:TeamLineupChange){
 const unavailable=()=>new TeamNextMatchError('The lineup save could not be confirmed. Retry the same lineup.',true)
 const reply=await matchRequest(client,owner,current,room,change.revision,unavailable,
  'The match, saved lineup, or availability changed. Reload the match before editing again.',{action:'save_match_lineup',...change})
 try{
  const saved=readSavedTeamLineup(reply.lineup)
  if(saved?.version!==change.version||JSON.stringify(saved.courts)!==JSON.stringify(change.courts))throw Error()
  return saved
 }catch{throw unavailable()}
}
