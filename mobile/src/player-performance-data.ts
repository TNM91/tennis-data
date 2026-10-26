import {loadOpponentHistory,type OpponentHistoryMatch} from './player-repeat-opponents'
import {playerRepeatOpponents} from '../../lib/player-repeat-opponents'
import type {RepeatOpponent} from '../../lib/player-repeat-opponents'
import type {SupabaseClient} from '@supabase/supabase-js'
import {canFollowPlayers,FollowAccessError} from './follows-data'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {matchupOutcome} from '../../lib/matchup-outcome'
import {playerSeasonPerformance,playerCareerHighs,longestPlayerWinStreak,type PerformanceMatch,playerBenchmark,playerOpponentBands,playerRecentForm,playerPublishedBaseline} from '../../lib/player-performance'
import type {RatingView,PlayerRatingShape} from '../../lib/player-rating-display'
import {loadPlayerFieldReference,type PlayerFieldReference} from '../../lib/player-field-reference'
type PerformancePlayer=PlayerRatingShape & {rating_source:string|null}
type Snapshot={id:string;matchId:string|null;date:string;view:RatingView;rating:number|null;delta:number|null;opponentRating:number|null}
export type PlayerPerformanceData={matches:Array<PerformanceMatch&{score?:string|null}>;snapshots:Snapshot[];matchesLimited:boolean;ratingsLimited:boolean;repeatOpponents?:RepeatOpponent[]|null;opponentHistory?:OpponentHistoryMatch[]|null;insight?:{player:PerformancePlayer|null;reference:PlayerFieldReference|null}}
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Performance unavailable.');return value as Record<string,unknown>}
const key=(value:unknown)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(value))throw Error('Performance unavailable.');return value}
function date(value:unknown){if(typeof value!=='string'||value.length>40||!isValidCalendarDate(value.slice(0,10))||!Number.isFinite(Date.parse(value)))throw Error('Performance unavailable.');return value}
export function parsePlayerPerformance(matchRows:unknown,snapshotRows:unknown,playerId:string,today:string):PlayerPerformanceData {
  if(!Array.isArray(matchRows)||matchRows.length>501||!Array.isArray(snapshotRows)||snapshotRows.length>501)throw Error('Performance unavailable.')
  const matches=matchRows.map(value=>{const r=record(value),id=key(r.id),day=date(r.match_date)
    if(day.slice(0,10)>today||r.public_history_eligible!==true||!['singles','doubles'].includes(String(r.match_type))||!Array.isArray(r.match_players)||r.match_players.length!==1)throw Error('Performance unavailable.')
    const score=r.score??null;if(score!==null&&(typeof score!=='string'||score.length>500))throw Error('Performance unavailable.')
    const participant=record(r.match_players[0]);if(participant.player_id!==playerId)throw Error('Performance unavailable.')
    const outcome=matchupOutcome(participant.side,r.winner_side);if(!outcome)throw Error('Performance unavailable.')
    return {id,score:score as string|null,date:day,matchType:r.match_type as 'singles'|'doubles',result:outcome==='A'?'W' as const:'L' as const}
  })
  const snapshots=snapshotRows.map(value=>{const r=record(value),id=key(r.id),day=date(r.snapshot_date),view=r.rating_type??'overall'
    if(r.player_id!==playerId||r.track!=='tiq'||!['overall','singles','doubles'].includes(String(view))||r.dynamic_rating!==null&&(typeof r.dynamic_rating!=='number'||!Number.isFinite(r.dynamic_rating)||r.dynamic_rating<1.5||r.dynamic_rating>7)||r.delta!==null&&(typeof r.delta!=='number'||!Number.isFinite(r.delta)||Math.abs(r.delta)>10))throw Error('Performance unavailable.')
    const opponentRating=r.opponent_rating??null;if(opponentRating!==null&&(typeof opponentRating!=='number'||!Number.isFinite(opponentRating)||opponentRating<1.5||opponentRating>7))throw Error('Performance unavailable.')
    return {opponentRating:opponentRating as number|null,id,matchId:r.match_id===null?null:key(r.match_id),date:day,view:view as RatingView,rating:r.dynamic_rating as number|null,delta:r.delta as number|null}
  })
  if(new Set(matches.map(m=>m.id)).size!==matches.length||new Set(snapshots.map(s=>s.id)).size!==snapshots.length)throw Error('Performance unavailable.')
  // Preserve source order for equal-date match streaks; the query orders time/id too.
  return {matches:matches.slice(0,500),snapshots:snapshots.slice(0,500).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id,undefined,{numeric:true})),matchesLimited:matches.length>500,ratingsLimited:snapshots.length>500}
}
export async function loadPlayerPerformance(client:SupabaseClient,playerId:string,current:()=>boolean):Promise<PlayerPerformanceData> {
  if(!playerId||!current())throw Error('Player visit closed.')
  const own=async(owner?:string)=>{const {data,error}=await client.auth.getSession();if(error||!data.session||!current()||owner&&owner!==data.session.user.id)throw Error('Player visit closed.');return data.session.user.id}
  const owner=await own();if(!await canFollowPlayers(client,current))throw new FollowAccessError('Player access is required.');await own(owner)
  const today=new Date().toISOString().slice(0,10)
  const [matches,snapshots,player,reference]=await Promise.all([
    client.from('matches').select('id,score,match_date,match_type,winner_side,public_history_eligible,match_players!inner(player_id,side)',{count:'exact'}).eq('match_players.player_id',playerId).eq('public_history_eligible',true).in('match_type',['singles','doubles']).in('winner_side',['A','B']).lte('match_date',today).order('match_date',{ascending:false}).order('match_time',{ascending:false}).order('id',{ascending:false}).limit(501).abortSignal(AbortSignal.timeout(12000)),
    client.from('rating_snapshots').select('id,player_id,match_id,snapshot_date,rating_type,dynamic_rating,delta,opponent_rating,track',{count:'exact'}).eq('player_id',playerId).eq('track','tiq').order('snapshot_date',{ascending:false}).order('id',{ascending:false}).limit(501).abortSignal(AbortSignal.timeout(12000)),
    loadPerformancePlayer(client,playerId),loadPlayerFieldReference(client)
  ])
  await own(owner);if(matches.error||snapshots.error)throw Error('Performance unavailable.')
  const result=parsePlayerPerformance(matches.data,snapshots.data,playerId,today)
  for(const response of [matches,snapshots])if(typeof response.count!=='number'||!Number.isSafeInteger(response.count)||response.count<(response.data?.length??0))throw Error('Performance coverage unavailable.')
  result.matchesLimited ||= matches.count!>500||matches.count!==matches.data!.length
  result.ratingsLimited ||= snapshots.count!>500||snapshots.count!==snapshots.data!.length
  result.opponentHistory=result.matchesLimited?null:await loadOpponentHistory(client,result.matches,playerId,current)
  result.repeatOpponents=result.opponentHistory===null?null:playerRepeatOpponents(result.opponentHistory)
  await own(owner)
  result.insight={player,reference}
  return result
}
export function playerPerformanceSummary(data:PlayerPerformanceData,view:RatingView) {
  if(data.matchesLimited)return null
  const byMatch=new Map(data.ratingsLimited?[]:data.snapshots.filter(s=>s.matchId!==null).map(s=>[`${s.matchId}:${s.view}`,{delta:s.delta}] as const))
  const seasons=playerSeasonPerformance(data.matches,byMatch)
  const points=data.ratingsLimited?[]:data.snapshots.filter(s=>s.view===view&&s.rating!==null).map(s=>({rating:s.rating!}))
  return {seasons,careerHighs:playerCareerHighs(points,seasons,longestPlayerWinStreak(data.matches))}
}

export function parsePerformancePlayer(value:unknown,playerId:string):PerformancePlayer|null {
  try{const r=record(value);if(r.id!==playerId||r.rating_source!==null&&r.rating_source!==undefined&&(typeof r.rating_source!=='string'||r.rating_source.length>100))return null
    const fields:Record<string,number|string|null>={rating_source:typeof r.rating_source==='string'?r.rating_source:null}
    for(const view of ['overall','singles','doubles'])for(const suffix of ['rating','dynamic_rating']){const field=`${view}_${suffix}`,value=r[field]??null;if(value!==null&&(suffix==='dynamic_rating'&&typeof value!=='number'||!['string','number'].includes(typeof value)||typeof value==='string'&&value.length>20||!Number.isFinite(Number(value))||Number(value)<1.5||Number(value)>7))return null;fields[field]=value as number|string|null}
    return fields as PerformancePlayer
  }catch{return null}
}
async function loadPerformancePlayer(client:SupabaseClient,playerId:string):Promise<PerformancePlayer|null> {
  try{const {data,error}=await client.from('players').select('id,overall_rating,singles_rating,doubles_rating,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating,rating_source').eq('id',playerId).limit(1).abortSignal(AbortSignal.timeout(12000)).maybeSingle();return error?null:parsePerformancePlayer(data,playerId)}catch{return null}
}
export function playerInsightSummary(data:PlayerPerformanceData,view:RatingView) {
  if(data.matchesLimited||!data.insight)return null
  const {player,reference}=data.insight,selected=data.matches.filter(m=>view==='overall'||m.matchType===view)
  const raw=player?.[`${view}_dynamic_rating`]??player?.overall_dynamic_rating??null,tiq=typeof raw==='number'?raw:null
  const baseline=playerPublishedBaseline(player,view)
  const snapshots=data.ratingsLimited?[]:data.snapshots.filter(s=>s.view===view)
  const form=data.ratingsLimited?null:playerRecentForm(snapshots)
  const byMatch=new Map(data.ratingsLimited?[]:data.snapshots.filter(s=>s.matchId!==null).map(s=>[`${s.matchId}:${s.view}`,{opponent_rating:s.opponentRating}] as const))
  const bands=playerOpponentBands(selected,byMatch,baseline)
  return {reference,baseline,bands,matchCount:selected.length,benchmark:playerBenchmark(reference?.average??null,tiq,selected.filter(m=>m.result==='W').length,selected.length,form),usedOverall:view!=='overall'&&player?.[`${view}_dynamic_rating`]==null&&tiq!==null}
}
