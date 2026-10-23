import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadPlayerRatings,ratingValues,type RecordedRatings} from '../../mobile/src/player-ratings-data'
import {ratingsHtml} from '../../mobile/src/player-ratings-view'
const ratings:RecordedRatings={overall_dynamic_rating:4.499,singles_dynamic_rating:null,doubles_dynamic_rating:4.6,rating_source:'self'}
describe('native recorded player ratings',()=>{
  it('uses recorded discipline values and clearly identifies the shared overall fallback',()=>{
    expect(ratingValues(ratings)).toEqual([{label:'Overall',value:'4.49',fallback:false},{label:'Singles',value:'4.49',fallback:true},{label:'Doubles',value:'4.60',fallback:false}])
  })
  it('does not manufacture ratings from missing, invalid, or out-of-range values',()=>{
    expect(ratingValues({overall_dynamic_rating:null,singles_dynamic_rating:NaN,doubles_dynamic_rating:8,rating_source:null}).every(row=>row.value===null)).toBe(true)
    expect(ratingValues({...ratings,singles_dynamic_rating:0})[1].value).toBeNull()
  })
  it('labels missing records, self-rated context and estimates without rendering source text',()=>{
    expect(ratingsHtml(null)).toContain('No player rating record')
    const markup=ratingsHtml(ratings)
    expect(markup).toContain('Self-rated player record.')
    expect(markup).toContain('Overall used')
    expect(markup).toContain('not official USTA ratings')
    expect(ratingsHtml({...ratings,rating_source:'<script>'})).not.toContain('<script>')
    expect(ratingsHtml({...ratings,overall_dynamic_rating:null})).toContain('Not recorded')
  })
  it('reads only rating fields for the exact selected player with a timeout',async()=>{
    const query={select:vi.fn(),eq:vi.fn(),abortSignal:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:ratings,error:null})}
    query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.abortSignal.mockReturnValue(query)
    const client={from:vi.fn().mockReturnValue(query)} as unknown as SupabaseClient
    expect(await loadPlayerRatings(client,'selected-player')).toEqual(ratings)
    expect(client.from).toHaveBeenCalledWith('players')
    expect(query.select).toHaveBeenCalledWith('overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating,rating_source')
    expect(query.eq).toHaveBeenCalledWith('id','selected-player')
    expect(query.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
    query.maybeSingle.mockResolvedValue({data:null,error:{message:'denied'}})
    await expect(loadPlayerRatings(client,'selected-player')).rejects.toThrow('Ratings unavailable')
  })
})
