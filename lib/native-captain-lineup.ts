import type {SupabaseClient} from '@supabase/supabase-js'
import {authorizeNativeCaptainScope} from './native-captain-workspace'
import type {TeamRoomScope} from './team-room'
import {loadSeasonRoster,seasonToday} from './season-kickoff-server'
import {getCaptainLineupDraftScopeKey} from './captain-lineup-handoff'
import {buildTeamSeasonCalendars} from './team-season-calendar'
import {lineupRecord,readLineupPlan,type LineupEditorData,type LineupPlan,type LineupPlayer} from './native-captain-lineup-contract'
const fail=(status:number,message:string)=>({ok:false as const,status,message})
const fields='id,scope_key,competition_layer,selected_match_id,slots_json,notes,match_location,match_directions,arrival_time,captain_notes,updated_at,delivery_status'
const str=(v:unknown)=>typeof v==='string'?v:''
async function context(service:SupabaseClient,owner:string,scope:TeamRoomScope,matchId:string){
 const access=await authorizeNativeCaptainScope(service,owner,scope);if(!access.ok)return access
 if(!matchId||matchId.length>120)return fail(400,'Choose an upcoming fixture.')
 const result=await service.from('matches').select('id,home_team,away_team,match_date,league_name,flight,line_number,match_type,status').eq('id',matchId).eq('league_name',scope.leagueName).eq('flight',scope.flight).is('line_number',null).maybeSingle()
 if(result.error)return fail(503,'This fixture could not be checked.')
 const match=result.data,today=seasonToday(),end=new Date(today+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+120)
 if(!match||/^(completed?|final|played)$/i.test(match.status||'')||![match.home_team,match.away_team].includes(scope.teamName)||match.match_date<today||match.match_date>end.toISOString().slice(0,10)||!buildTeamSeasonCalendars(scope.teamName,[match],'').some(s=>s.matches.some(m=>m.id===match.id)))return fail(409,'Refresh the upcoming fixtures before planning this lineup.')
 const opponent=match.home_team===scope.teamName?match.away_team:match.home_team
 const roster=(await loadSeasonRoster(service,{team:scope.teamName,league:scope.leagueName,flight:scope.flight,seasonKey:''})).map(p=>({key:p.key,playerId:p.playerId||'',name:p.name}))
 const query=()=>service.from('captain_lineup_drafts').select(fields).eq('user_id',owner).eq('team_name',scope.teamName).eq('league_name',scope.leagueName).eq('flight',scope.flight).eq('match_date',match.match_date).eq('opponent_team',opponent).limit(2)
 const existing=await query();if(existing.error)return fail(503,'Your saved lineup could not be checked.')
 if((existing.data?.length||0)>1)return fail(409,'More than one saved lineup matches this fixture. Resolve the duplicate plans before editing here.')
 const row=existing.data?.[0] as Record<string,unknown>|undefined
 if(row?.selected_match_id&&row.selected_match_id!==matchId)return fail(409,'This saved lineup belongs to a different fixture.')
 if(!row?.selected_match_id){
  const sameDay=await service.from('matches').select('id,home_team,away_team,match_date,league_name,flight,line_number,match_type,status').eq('league_name',scope.leagueName).eq('flight',scope.flight).eq('match_date',match.match_date).is('line_number',null).in('home_team',[scope.teamName,opponent]).in('away_team',[scope.teamName,opponent]).limit(3)
  if(sameDay.error)return fail(503,'This fixture could not be confirmed.')
  const fixtures=buildTeamSeasonCalendars(scope.teamName,sameDay.data||[],'').flatMap(s=>s.matches).filter(m=>m.home_team!==m.away_team)
  if((sameDay.data?.length||0)>=3||fixtures.length!==1||fixtures[0].id!==matchId)return fail(409,'More than one fixture may match this plan. Open a fixture-linked lineup before editing here.')
 }
 return {ok:true as const,status:200,roster,row,query,match:{id:matchId,date:match.match_date as string,opponent:opponent as string}}
}
function rowPlan(row:Record<string,unknown>|undefined,roster:LineupPlayer[]):LineupPlan{
 const slots=Array.isArray(row?.slots_json)?row.slots_json:[]
 if(slots.length>30)throw Error('This lineup has too many courts.')
 return {notes:str(row?.notes),location:str(row?.match_location),directions:str(row?.match_directions),arrivalTime:str(row?.arrival_time),teamNotes:str(row?.captain_notes),courts:slots.length?slots.map((value,index)=>{
  const slot=lineupRecord(value),players=Array.isArray(slot.players)?slot.players:[],slotType=slot.slotType==='doubles'?'doubles' as const:'singles' as const
  return {id:str(slot.id)||`court-${index+1}`,label:str(slot.label)||`Court ${index+1}`,slotType,defaulted:slot.defaulted===true,...(typeof slot.ratingLevel==='number'?{ratingLevel:slot.ratingLevel}:{}),players:Array.from({length:slotType==='doubles'?2:1},(_,seat)=>{const player=lineupRecord(players[seat]);if(!player.playerId&&!player.playerName)return '';const matches=roster.filter(p=>player.playerId?p.playerId===player.playerId:p.name===player.playerName);return matches.length===1?matches[0].key:`unavailable-${index}-${seat}`})}
 }):[{id:'court-1',label:'Doubles 1',slotType:'doubles',defaulted:false,players:['','']}]}
}
export async function loadNativeLineup(service:SupabaseClient,owner:string,scope:TeamRoomScope,matchId:string){
 const ctx=await context(service,owner,scope,matchId);if(!ctx.ok)return ctx
 const data:LineupEditorData={ok:true,scope,match:ctx.match,version:str(ctx.row?.updated_at),sent:ctx.row?.delivery_status==='sent',roster:ctx.roster,plan:rowPlan(ctx.row,ctx.roster)}
 return {status:200,...data}
}
export async function saveNativeLineup(service:SupabaseClient,owner:string,scope:TeamRoomScope,body:Record<string,unknown>){
 const ctx=await context(service,owner,scope,str(body.matchId));if(!ctx.ok)return ctx
 if(body.matchDate!==ctx.match.date||body.opponent!==ctx.match.opponent)return fail(409,'The fixture changed. Reopen it before saving.')
 if(typeof body.version!=='string'||body.version.length>80)return fail(400,'Reopen this lineup before saving.')
 let plan:LineupPlan;try{plan=readLineupPlan(body.plan,ctx.roster)}catch(cause){return fail(400,cause instanceof Error?cause.message:'Check your lineup.')}
 const slots=plan.courts.map(c=>({id:c.id,label:c.label,slotType:c.slotType,defaulted:c.defaulted,...(c.ratingLevel!==undefined?{ratingLevel:c.ratingLevel}:{}),players:c.players.map(key=>{const p=ctx.roster.find(p=>p.key===key);return {playerId:p?.playerId||'',playerName:p?.name||''}})}))
 const patch={slots_json:slots,notes:plan.notes,match_location:plan.location,match_directions:plan.directions,arrival_time:plan.arrivalTime,captain_notes:plan.teamNotes}
 const matches=(row:Record<string,unknown>|undefined)=>{try{return !!row&&JSON.stringify(readLineupPlan(rowPlan(row,ctx.roster),ctx.roster))===JSON.stringify(plan)}catch{return false}}
 if(matches(ctx.row))return {ok:true as const,status:200,updatedAt:str(ctx.row?.updated_at),alreadySaved:true}
 if(str(ctx.row?.updated_at)!==body.version)return fail(409,'This lineup changed on another device. Keep your notes, then reopen the latest plan.')
 const updatedAt=new Date(Math.max(Date.now(),(Date.parse(body.version)||0)+1)).toISOString()
 const reset={status:'working',finalized_at:null,delivery_status:'not_sent',delivered_at:null,team_room_message_id:null,match_week_updated_at:updatedAt,updated_at:updatedAt}
 let error: {code?:string}|null,changed:unknown
 if(ctx.row){
  const result=await service.from('captain_lineup_drafts').update({...patch,...reset,selected_match_id:ctx.match.id}).eq('id',ctx.row.id).eq('user_id',owner).eq('updated_at',body.version).select('updated_at').maybeSingle();error=result.error;changed=result.data
 }else{
  const result=await service.from('captain_lineup_drafts').insert({...patch,...reset,user_id:owner,scope_key:getCaptainLineupDraftScopeKey({competitionLayer:'',...scope,matchDate:ctx.match.date,opponentTeam:ctx.match.opponent}),competition_layer:'',team_name:scope.teamName,league_name:scope.leagueName,flight:scope.flight,match_date:ctx.match.date,opponent_team:ctx.match.opponent,selected_match_id:ctx.match.id,match_format:'auto',slots_json:slots,opponent_slots_json:[],manual_roster_entries:[],scenario_name:''}).select('updated_at').maybeSingle();error=result.error;changed=result.data
 }
 if(error&&error.code!=='23505')return fail(503,'The save could not be confirmed. Retry the same lineup.')
 if(!changed){const latest=await ctx.query();if(latest.error)return fail(503,'The save could not be confirmed. Retry the same lineup.');if(latest.data?.length===1&&matches(latest.data[0]))return {ok:true as const,status:200,updatedAt:str(latest.data[0].updated_at),alreadySaved:true};return fail(409,'This lineup changed on another device. Keep your notes, then reopen the latest plan.')}
 return {ok:true as const,status:200,updatedAt,alreadySaved:false}
}
