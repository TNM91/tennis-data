import {competitionOwner} from './competitions-data'
import {updatesQuery} from './mobile-updates-client'
import {personalMatchQuery} from './mobile-personal-matches'
export const navigationOwner=competitionOwner
export const labDataReads={linkedProfile:0,players:0,matches:0,goalScopes:[] as string[]}
let user={id:navigationOwner,email:'preview@example.test'},signedIn=!new URL(location.href).searchParams.has('signedOut')
let linked=!new URL(location.href).searchParams.has('unlinked')
let listener:((event:string,session:unknown)=>void)|null=null
const session=()=>signedIn?{user,access_token:'synthetic-local-token'}:null
const player={overall_rating:4,overall_dynamic_rating:4.42,singles_dynamic_rating:4.37,doubles_dynamic_rating:4.49,rating_source:'verified'}
const exploreReturn=new URL(location.href).searchParams.has('explore-return')
const exploreEmpty=new URL(location.href).searchParams.has('explore-empty')
const replaceGuestResult=new URL(location.href).searchParams.has('replace-guest-result')
const repeatOpponents=new URL(location.href).searchParams.has('repeat-opponents')
const longMatchHistory=new URL(location.href).searchParams.has('long-match-history')
const labSearchHistory=new URL(location.href).searchParams.has('lab-search-history')
const explorePlayers=Array.from({length:6},(_,index)=>({...player,id:'explore-player-'+index,name:'Jordan Lee '+(index+1),location:'Northside',flight:'4.0'}))
const exploreParticipants=[
 {player_id:'explore-player-0',side:'B',seat:1,players:{name:'Jordan Lee 1'}},
 {player_id:'explore-player-1',side:'A',seat:1,players:{name:'Jordan Lee 2'}},
]
const followingReview=new URL(location.href).searchParams.has('following-review')
const savedFollows=[
 {entity_type:'player',entity_id:navigationOwner,entity_name:'Jordan Lee',subtitle:'Northside · 4.0'},
 {entity_type:'player',entity_id:'long-name',entity_name:'Alexandria Montgomery '+('Returner'.repeat(14)),subtitle:'City League'},
 {entity_type:'player',entity_id:'unavailable/legacy',entity_name:'Saved <Aces>',subtitle:null},
]
let pendingLabProfile:Promise<void>|null=null
let releaseLabProfile:(()=>void)|null=null
let pendingLabRatings:Promise<void>|null=null
let releaseLabRatings:(()=>void)|null=null
let pendingLabMatches:Promise<void>|null=null
let releaseLabMatches:(()=>void)|null=null
let labMatchState:'ready'|'empty'|'unavailable'='ready'
export const labProfileFixture={
 defer(){pendingLabProfile=new Promise<void>(resolve=>{releaseLabProfile=resolve})},
 release(){releaseLabProfile?.();releaseLabProfile=null;pendingLabProfile=null},
 deferRatings(){pendingLabRatings=new Promise<void>(resolve=>{releaseLabRatings=resolve})},
 releaseRatings(){releaseLabRatings?.();releaseLabRatings=null;pendingLabRatings=null},
 deferMatches(){pendingLabMatches=new Promise<void>(resolve=>{releaseLabMatches=resolve})},
 releaseMatches(){releaseLabMatches?.();releaseLabMatches=null;pendingLabMatches=null},
 setMatches(state:typeof labMatchState){labMatchState=state},
}
function matchRows(length:number,singlesOnly=false){
 return Array.from({length},(_,i)=>({
  id:'court-'+i,
  match_date:new Date(Date.UTC(2026,9,28-i)).toISOString().slice(0,10),
  public_history_eligible:true,
  match_type:singlesOnly||i%3===0?'singles':'doubles',
  league_name:'City Tennis League',
  score:i%3===2?'4-6, 3-6':'6-4, 6-3',
  winner_side:i%3===2?'A':'B',
  match_players:[{player_id:navigationOwner,side:'B'}],
 }))
}
function labSearchMatches(){
 return matchRows(14).map((row,index)=>{
  const id='55555555-5555-4555-8555-'+String(100-index).padStart(12,'0')
  if(index!==12)return {...row,id}
  const own={player_id:navigationOwner,side:'B',seat:1,players:{name:'Jordan Lee'}}
  const opponent={player_id:'alex',side:'A',seat:1,players:{name:'Álex Rowan'}}
  return {...row,id,participants:[own,opponent]}
 })
}
function data(table:string){
 if(table==='profiles'&&!linked)return {linked_player_id:null,linked_player_name:null,linked_team_name:null,linked_league_name:null}
 if(table==='profiles')return {linked_player_id:navigationOwner,linked_player_name:'Jordan Lee',linked_team_name:'Baseline Aces',linked_league_name:'City Tennis League'}
 if(table==='players'&&!linked)return [{id:navigationOwner,name:'Jordan Lee',location:'Northside',flight:'4.0'}]
 if(table==='players')return player
 if(followingReview&&table==='user_follows')return savedFollows
 if(table==='matches'){
  const rows=matchRows(10)
  return repeatOpponents?rows.filter(row=>row.match_type==='singles'):rows
 }
 if(exploreReturn&&table==='match_players')return exploreParticipants
 if(exploreReturn&&table==='team_match_results')return [
  {id:'record-one',home_team:'Baseline Aces',away_team:'River Returners',league_name:'City Tennis League',flight:'4.0',match_date:'2026-10-28',score:'3–2',status:'Complete',source:'tiq'},
  {id:'record-two',home_team:'Westside Rally Club',away_team:'Baseline Aces',league_name:'City Tennis League',flight:'4.0',match_date:'2026-11-12',score:null,status:'Scheduled',source:'tiq'},
 ]
 return []
}
export function createClient(){return {
 channel:()=>{const callbacks:(()=>void)[]=[];const channel={on:(_type:string,_filter:unknown,callback:()=>void)=>{callbacks.push(callback);return channel},subscribe:(status:(value:string)=>void)=>{queueMicrotask(()=>status('SUBSCRIBED'));chatSignals.add(callbacks);return channel}};return channel},removeChannel:async()=> 'ok',
 auth:{signInWithPassword:async({password}:{password:string})=>{if(password==='synthetic-wrong')return {error:{code:'invalid_credentials'}};signedIn=true;listener?.('SIGNED_IN',session());return {error:null}},getSession:async()=>({data:{session:session()},error:null}),onAuthStateChange:(fn:typeof listener)=>{listener=fn;queueMicrotask(()=>listener?.('INITIAL_SESSION',session()));return {data:{subscription:{unsubscribe(){}}}}},startAutoRefresh(){},stopAutoRefresh(){},signOut:async()=>{signedIn=false;listener?.('SIGNED_OUT',null);return {error:null}}},
 from:(table:string)=>{if(table==='native_personal_matches')return personalMatchQuery();if(['internal_notifications','internal_conversations'].includes(table))return updatesQuery(table);const result:{data:unknown;error:{message:string}|null;count?:number}={data:data(table),error:null};let select='',emptySearch=false,counted=false;const chain:Record<string,unknown>={then:async(resolve:(value:unknown)=>void)=>{
  if(table==='profiles'&&select.includes('linked_league_name'))await pendingLabProfile
  if(table==='players'&&select.endsWith('doubles_dynamic_rating,rating_source'))await pendingLabRatings
  if(table==='matches'){
   await pendingLabMatches
   if(select.includes('participants:match_players')){
    if(labMatchState==='empty')result.data=[]
    if(labMatchState==='unavailable'){result.data=null;result.error={message:'Synthetic matches unavailable'}}
   }
  }
  if(counted&&Array.isArray(result.data))result.count=result.data.length
  return resolve(result)
 }};for(const method of ['eq','in','order','limit','abortSignal','maybeSingle','single','ilike','or','is','not','range','gte','lte','lt','neq'])chain[method]=()=>chain;chain.select=(fields:string,options?:{count?:string})=>{
  select=fields
  if(table==='profiles'&&fields.includes('linked_player'))labDataReads.linkedProfile++
  if(table==='players')labDataReads.players++
  if(table==='matches')labDataReads.matches++
  counted=repeatOpponents&&options?.count==='exact'
  if(table==='matches'&&labSearchHistory&&fields.includes('participants:match_players'))result.data=labSearchMatches()
  if(table==='matches'&&fields.includes('participants:match_players')&&new URL(location.href).searchParams.has('lab-opponents')){
   result.data=matchRows(10).map(row=>{
    if(row.id!=='court-0'&&row.id!=='court-2')return row
    const own={player_id:navigationOwner,side:'B',seat:1,players:{name:'Jordan Lee'}}
    const first={player_id:'casey',side:'A',seat:1,players:{name:'Casey Rivera'}}
    const second={player_id:'morgan',side:'A',seat:2,players:{name:'Morgan Wells'}}
    return {...row,participants:row.match_type==='singles'?[own,first]:[own,second,first]}
   })
  }
  if(longMatchHistory&&counted&&table==='matches')result.data=matchRows(41,true)
  return chain
 }
 chain.limit=(size:number)=>{
  if(table==='matches'&&labSearchHistory&&Array.isArray(result.data))result.data=result.data.slice(0,size)
  return chain
 }
 chain.range=(start:number,end:number)=>{
  if(table==='matches'&&labSearchHistory&&Array.isArray(result.data))result.data=result.data.slice(start,end+1)
  return chain
 }
 chain.in=(field:string,ids:string[])=>{
  if(repeatOpponents&&table==='match_players'&&field==='match_id'){
   result.data=ids.flatMap(match_id=>exploreParticipants.map(row=>({...row,match_id,players:{...row.players,id:row.player_id}})))
  }
  return chain
 };chain.ilike=(_field:string,value:string)=>{if(exploreEmpty&&value==='%Missingville%'){emptySearch=true;result.data=[]}return chain};chain.order=()=>{
  if(exploreReturn&&table==='players'&&select.startsWith('id,name,location,flight')){
   result.data=emptySearch?[]:replaceGuestResult&&signedIn?explorePlayers.map((row,index)=>index===1?{...row,id:'replacement-player'}:row):explorePlayers
  }
  return chain
 };chain.eq=(field:string,value:string)=>{
  if(table==='my_lab_goals'&&field==='player_id')labDataReads.goalScopes.push(value)
  if(exploreReturn&&table==='players'&&field==='id'&&select.includes('tiq_rating_status')){
   const choice=explorePlayers.find(row=>row.id===value)
   if(choice)result.data={...choice,tiq_rating_status:'current',tiq_rating_model:'fixture',tiq_rating_season:new Date().getUTCFullYear(),tiq_singles_matches:4,tiq_doubles_matches:6}
  }
  if(exploreReturn&&table==='matches'&&field==='match_players.player_id'&&Array.isArray(result.data))result.data=result.data.map(row=>({...row,match_players:[{player_id:value,side:value==='explore-player-1'?'A':'B'}]}))
  if(followingReview&&table==='user_follows'&&Array.isArray(result.data)&&(field==='entity_type'||field==='entity_id'))result.data=result.data.filter(row=>row[field]===value);if(table==='matches'&&field==='id'&&Array.isArray(result.data))result.data=result.data.find((row:{id:string})=>row.id===value)||null;return chain};return chain},
 rpc:async()=>({data:[],error:null}),
 }}
const chatSignals=new Set<(()=>void)[]>()
export function emitChatSignal(){for(const callbacks of chatSignals)callbacks[0]?.()}
export function refreshNavigationSession(){listener?.('TOKEN_REFRESHED',session())}
export function switchNavigationOwner(restore=false){user=restore?{id:navigationOwner,email:'captain@example.test'}:{id:'22222222-2222-4222-8222-222222222222',email:'another-preview@example.test'};listener?.('SIGNED_IN',session())}

export function connectNavigationPlayer(){linked=true}

export const currentNavigationOwner=()=>user.id
