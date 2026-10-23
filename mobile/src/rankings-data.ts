import type { SupabaseClient } from '@supabase/supabase-js'
import { getTiqRating, formatRatingValue, type PlayerRatingShape, type RatingView } from '../../lib/player-rating-display'
import { playerSearchTerm, type PlayerChoice } from './player-connection'

export type RankingPlayer = PlayerChoice & PlayerRatingShape & {rating_source:string|null}
export type RankingRow = {player:RankingPlayer;rating:number;display:string;fallback:boolean}
export function rankRows(players:RankingPlayer[],view:RatingView):RankingRow[] {
  const unique=new Map(players.map(player=>[player.id,player]))
  return [...unique.values()].flatMap(player=>{
    const selected=view==='overall'?player.overall_dynamic_rating:player[`${view}_dynamic_rating`] ?? player.overall_dynamic_rating
    if(typeof selected!=='number' || !Number.isFinite(selected) || selected<1.5 || selected>7)return []
    const rating=getTiqRating(player,view)
    return [{player,rating,display:formatRatingValue(rating),fallback:view!=='overall' && player[`${view}_dynamic_rating`]==null}]
  }).sort((a,b)=>b.rating-a.rating||a.player.id.localeCompare(b.player.id)).slice(0,24)
}
export function createRankingLoader(client:SupabaseClient) {
  const cache=new Map<string,{rows:RankingRow[];at:number}>()
  const pending=new Map<string,Promise<RankingRow[]>>()
  return async function loadRankings(view:RatingView,location:string):Promise<RankingRow[]> {
  const area=location.trim().replace(/\s+/g,' ')
  const term=area?playerSearchTerm(area):''
  const key=JSON.stringify([view,area.toLowerCase()]),saved=cache.get(key)
  if(saved && Date.now()-saved.at<300000)return saved.rows
  const waiting=pending.get(key)
  if(waiting)return waiting
  const load=(async()=>{
    const column=`${view}_dynamic_rating`
    const query=(fallback:boolean)=>{
      const sort=fallback?'overall_dynamic_rating':column
      let request=client.from('players').select('id,name,location,flight,rating_source,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating')
        .gte(sort,1.5).lte(sort,7)
      if(fallback)request=request.is(column,null)
      if(term)request=request.ilike('location',`%${term}%`)
      return request.order(sort,{ascending:false}).order('id',{ascending:true}).limit(24).abortSignal(AbortSignal.timeout(12000))
    }
    const results=await Promise.all(view==='overall'?[query(false)]:[query(false),query(true)])
    if(results.some(result=>result.error))throw Error('Rankings unavailable')
    const rows=rankRows(results.flatMap(result=>(result.data || []) as RankingPlayer[]),view)
    if(cache.size>=6)cache.delete(cache.keys().next().value!)
    cache.set(key,{rows,at:Date.now()})
    return rows
  })()
  pending.set(key,load)
  try{return await load}finally{pending.delete(key)}
}
}
