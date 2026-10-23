import type { SupabaseClient } from '@supabase/supabase-js'
import { formatRatingValue, getRatingViewLabel, type PlayerRatingShape, type RatingView } from '../../lib/player-rating-display'

export type RecordedRatings = PlayerRatingShape & {rating_source:string|null}
export function ratingValues(player:RecordedRatings) {
  return (['overall','singles','doubles'] as RatingView[]).map(view=>{
    const specific=player[`${view}_dynamic_rating`]
    const value=specific ?? player.overall_dynamic_rating
    const recorded=typeof value==='number' && Number.isFinite(value) && value>=1.5 && value<=7
    return {label:getRatingViewLabel(view),value:recorded?formatRatingValue(value):null,fallback:recorded && view!=='overall' && specific==null}
  })
}
export async function loadPlayerRatings(client:SupabaseClient,playerId:string):Promise<RecordedRatings|null> {
  const {data,error}=await client.from('players').select('overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating,rating_source')
    .eq('id',playerId).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  if(error)throw Error('Ratings unavailable')
  return data as RecordedRatings|null
}
