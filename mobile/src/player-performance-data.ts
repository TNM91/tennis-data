import type {SupabaseClient} from '@supabase/supabase-js'
import {canFollowPlayers,FollowAccessError} from './follows-data'
import {isValidCalendarDate} from '../../lib/calendar-date'
import {matchupOutcome} from '../../lib/matchup-outcome'
import {playerSeasonPerformance,playerCareerHighs,longestPlayerWinStreak,type PerformanceMatch} from '../../lib/player-performance'
import type {RatingView} from '../../lib/player-rating-display'
type Snapshot={id:string;matchId:string|null;date:string;view:RatingView;rating:number|null;delta:number|null}
export type PlayerPerformanceData={matches:PerformanceMatch[];snapshots:Snapshot[];matchesLimited:boolean;ratingsLimited:boolean}
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Performance unavailable.');return value as Record<string,unknown>}
const key=(value:unknown)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(value))throw Error('Performance unavailable.');return value}
function date(value:unknown){if(typeof value!=='string'||value.length>40||!isValidCalendarDate(value.slice(0,10))||!Number.isFinite(Date.parse(value)))throw Error('Performance unavailable.');return value}
export function parsePlayerPerformance(matchRows:unknown,snapshotRows:unknown,playerId:string,today:string):PlayerPerformanceData {
  if(!Array.isArray(matchRows)||matchRows.length>501||!Array.isArray(snapshotRows)||snapshotRows.length>501)throw Error('Performance unavailable.')
  const matches=matchRows.map(value=>{const r=record(value),id=key(r.id),day=date(r.match_date)
    if(day.slice(0,10)>today||r.public_history_eligible!==true||!['singles','doubles'].includes(String(r.match_type))||!Array.isArray(r.match_players)||r.match_players.length!==1)throw Error('Performance unavailable.')
    const participant=record(r.match_players[0]);if(participant.player_id!==playerId)throw Error('Performance unavailable.')
    const outcome=matchupOutcome(participant.side,r.winner_side);if(!outcome)throw Error('Performance unavailable.')
    return {id,date:day,matchType:r.match_type as 'singles'|'doubles',result:outcome==='A'?'W' as const:'L' as const}
  })
  const snapshots=snapshotRows.map(value=>{const r=record(value),id=key(r.id),day=date(r.snapshot_date),view=r.rating_type??'overall'
    if(r.player_id!==playerId||r.track!=='tiq'||!['overall','singles','doubles'].includes(String(view))||r.dynamic_rating!==null&&(typeof r.dynamic_rating!=='number'||!Number.isFinite(r.dynamic_rating)||r.dynamic_rating<1.5||r.dynamic_rating>7)||r.delta!==null&&(typeof r.delta!=='number'||!Number.isFinite(r.delta)||Math.abs(r.delta)>10))throw Error('Performance unavailable.')
    return {id,matchId:r.match_id===null?null:key(r.match_id),date:day,view:view as RatingView,rating:r.dynamic_rating as number|null,delta:r.delta as number|null}
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
  const [matches,snapshots]=await Promise.all([
    client.from('matches').select('id,match_date,match_type,winner_side,public_history_eligible,match_players!inner(player_id,side)',{count:'exact'}).eq('match_players.player_id',playerId).eq('public_history_eligible',true).in('match_type',['singles','doubles']).in('winner_side',['A','B']).lte('match_date',today).order('match_date',{ascending:false}).order('match_time',{ascending:false}).order('id',{ascending:false}).limit(501).abortSignal(AbortSignal.timeout(12000)),
    client.from('rating_snapshots').select('id,player_id,match_id,snapshot_date,rating_type,dynamic_rating,delta,track',{count:'exact'}).eq('player_id',playerId).eq('track','tiq').order('snapshot_date',{ascending:false}).order('id',{ascending:false}).limit(501).abortSignal(AbortSignal.timeout(12000))
  ])
  await own(owner);if(matches.error||snapshots.error)throw Error('Performance unavailable.')
  const result=parsePlayerPerformance(matches.data,snapshots.data,playerId,today)
  for(const response of [matches,snapshots])if(typeof response.count!=='number'||!Number.isSafeInteger(response.count)||response.count<(response.data?.length??0))throw Error('Performance coverage unavailable.')
  result.matchesLimited ||= matches.count!>500||matches.count!==matches.data!.length
  result.ratingsLimited ||= snapshots.count!>500||snapshots.count!==snapshots.data!.length
  return result
}
export function playerPerformanceSummary(data:PlayerPerformanceData,view:RatingView) {
  if(data.matchesLimited)return null
  const byMatch=new Map(data.ratingsLimited?[]:data.snapshots.filter(s=>s.matchId!==null).map(s=>[`${s.matchId}:${s.view}`,{delta:s.delta}] as const))
  const seasons=playerSeasonPerformance(data.matches,byMatch)
  const points=data.ratingsLimited?[]:data.snapshots.filter(s=>s.view===view&&s.rating!==null).map(s=>({rating:s.rating!}))
  return {seasons,careerHighs:playerCareerHighs(points,seasons,longestPlayerWinStreak(data.matches))}
}
