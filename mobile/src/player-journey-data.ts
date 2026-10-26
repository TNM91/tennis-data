import type { SupabaseClient } from '@supabase/supabase-js'
import { canFollowPlayers, FollowAccessError } from './follows-data'
import { parseRatingSnapshots, type RatingSnapshot } from './comparison-rating-context'
import type { RatingView } from '../../lib/player-rating-display'
export const journeyViews = ['overall','singles','doubles'] as const
export type JourneyHistory = Record<RatingView,{rows:Array<RatingSnapshot&{match_id?:string|null}>;more:boolean}>
export async function loadPlayerJourney(client:SupabaseClient,playerId:string,current:()=>boolean):Promise<JourneyHistory> {
  if(!playerId || !current())throw Error('Player visit closed.')
  const own=async(owner?:string)=>{const {data,error}=await client.auth.getSession();if(error||!data.session||!current()||owner&&data.session.user.id!==owner)throw Error('Player visit closed.');return data.session.user.id}
  const owner=await own()
  if(!await canFollowPlayers(client,current))throw new FollowAccessError('Player access is required for detailed rating history.')
  await own(owner)
  const entries=await Promise.all(journeyViews.map(async view=>{
    const {data,error}=await client.from('rating_snapshots').select('id,match_id,player_id,rating_type,snapshot_date,dynamic_rating,delta,track').eq('player_id',playerId).eq('track','tiq').eq('rating_type',view).order('snapshot_date',{ascending:false}).order('id',{ascending:false}).limit(61).abortSignal(AbortSignal.timeout(12000))
    if(error)throw Error('Rating history unavailable.')
    return [view,parseJourneySnapshots(data,playerId,view)] as const
  }))
  await own(owner)
  return Object.fromEntries(entries) as JourneyHistory
}
export function parseJourneySnapshots(value:unknown,playerId:string,view:RatingView) {
 const parsed=parseRatingSnapshots(value,playerId,view,60),source=new Map((value as Array<Record<string,unknown>>).map(r=>[String(r.id),r.match_id??null]))
 return {...parsed,rows:parsed.rows.map(row=>{const id=source.get(row.id);if(id!==null&&(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)))throw Error('Rating match reference unavailable.');return {...row,match_id:id as string|null}})}
}
export type JourneyWindow='all'|'90d'|'30d'
export function journeyPoints(history:JourneyHistory,view:RatingView,window:JourneyWindow,now=Date.now()) {
  const cutoff=window==='all'?-Infinity:now-(window==='90d'?90:30)*86400000
  return [...history[view].rows].reverse().filter(row=>row.dynamic_rating!==null&&Date.parse(row.snapshot_date)>=cutoff).map(row=>({id:row.id,matchId:row.match_id??null,date:row.snapshot_date,rating:row.dynamic_rating!,delta:row.delta}))
}
