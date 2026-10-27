import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {publicScorecardShare,readPublicScorecardShare} from '../../mobile/src/match-scorecard-share-data'
import {shareReviewedScorecard} from '../../mobile/src/match-scorecard-share'
const owner='11111111-1111-4111-8111-111111111111',player='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',today='2026-10-27'
const raw={id,match_date:'2026-10-25',match_type:'Doubles',league_name:'City League',score:'6-4 6-3',winner_side:'A',public_history_eligible:true,match_players:[{player_id:player,side:'A'}]}
const parse=(r:unknown=raw)=>publicScorecardShare(r,id,player,owner,today)
function fixture(){let account=owner,active=true;const q={select:vi.fn(),eq:vi.fn(),lte:vi.fn(),limit:vi.fn(),abortSignal:vi.fn().mockResolvedValue({data:[raw],count:1,error:null})};for(const fn of [q.select,q.eq,q.lte,q.limit])fn.mockReturnValue(q);const client={auth:{getSession:vi.fn(async()=>({data:{session:{user:{id:account}}},error:null}))},from:vi.fn(()=>q)} as unknown as SupabaseClient;return {client,q,current:()=>active,close:()=>{active=false},switch:()=>{account=player}}}
describe('reviewed public scorecard sharing',()=>{
 it('builds only the public fixed-origin link and recorded fields, without contact/private fields',()=>{
  const result=parse({...raw,contacts:['private@example.com'],review_notes:'secret',league_name:'City\n League'})
  expect(result.url).toBe('https://www.tenaceiq.com/matches/'+id+'?via=scorecard-share')
  expect(result.text).toContain('League: City League');expect(result.text).toContain('Recorded score: 6-4 6-3');expect(result.text).not.toContain('secret');expect(result.text).not.toContain('@');expect(result.text+result.url).not.toContain(owner);expect(Object.isFrozen(result)).toBe(true)
 })
 it('withholds private, future, invalid-date, cross-linked and ambiguous scorecards',()=>{
  for(const r of [{...raw,public_history_eligible:false},{...raw,public_history_eligible:'true'},{...raw,match_date:'2026-10-28'},{...raw,match_date:'2026-02-30'},{...raw,id:owner},{...raw,match_players:[{player_id:owner,side:'A'}]},{...raw,match_players:[...raw.match_players,...raw.match_players]},{...raw,league_name:'x'.repeat(201)},{...raw,winner_side:'other'}])expect(()=>parse(r)).toThrow()
 })
 it('does not invent a result or source score for incomplete public records',()=>{const result=parse({...raw,score:null,winner_side:null});expect(result.text).toContain('Score unavailable');expect(result.text).not.toContain('Won');expect(result.text).not.toContain('Lost')})
 it('queries exact selected public match participation with count, cutoff, limit and timeout',async()=>{
  const f=fixture();expect(await readPublicScorecardShare(f.client,id,player,f.current)).toMatchObject({url:parse().url});expect(f.q.eq).toHaveBeenCalledWith('id',id);expect(f.q.eq).toHaveBeenCalledWith('match_players.player_id',player);expect(f.q.eq).toHaveBeenCalledWith('public_history_eligible',true);expect(f.q.lte).toHaveBeenCalledWith('match_date',expect.any(String));expect(f.q.limit).toHaveBeenCalledWith(2);expect(f.q.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));expect(f.q.select.mock.calls[0][0]).not.toContain('notes')
 })
 it('discards closed/account-changed reads and withholds conflicting counts',async()=>{
  const f=fixture();f.close();await expect(readPublicScorecardShare(f.client,id,player,f.current)).rejects.toThrow();expect(f.client.from).not.toHaveBeenCalled()
  const g=fixture();g.q.abortSignal.mockImplementation(async()=>{g.switch();return {data:[raw],count:1,error:null}});await expect(readPublicScorecardShare(g.client,id,player,g.current)).rejects.toThrow()
  const h=fixture();h.q.abortSignal.mockResolvedValue({data:[raw],count:2,error:null});await expect(readPublicScorecardShare(h.client,id,player,h.current)).rejects.toThrow()
 })
 it('requires review again when the current public score changes',async()=>{
  const write=vi.fn(),share=vi.fn(),fresh=parse({...raw,score:'6-0 6-0'})
  expect(await shareReviewedScorecard(parse(),async()=>fresh,()=>true,'copy',write,share)).toEqual({done:false,review:fresh});expect(write).not.toHaveBeenCalled();expect(share).not.toHaveBeenCalled()
 })
 it('copies or opens the native share sheet only after a matching fresh check',async()=>{
  const review=parse(),write=vi.fn().mockResolvedValue(undefined),share=vi.fn().mockResolvedValue({activityType:''})
  await shareReviewedScorecard(review,async()=>review,()=>true,'copy',write,share);expect(write).toHaveBeenCalledWith({string:review.text+'\n'+review.url});expect(share).not.toHaveBeenCalled()
  await shareReviewedScorecard(review,async()=>review,()=>true,'share',write,share);expect(share).toHaveBeenCalledWith({title:review.title,text:review.text,url:review.url,dialogTitle:'Share tennis scorecard'})
 })
 it('never falls back to clipboard on cancellation/failure or transmits after a closed visit',async()=>{
  const review=parse(),write=vi.fn(),share=vi.fn().mockRejectedValue(Error('Cancelled'))
  await expect(shareReviewedScorecard(review,async()=>review,()=>true,'share',write,share)).rejects.toThrow();expect(write).not.toHaveBeenCalled()
  await expect(shareReviewedScorecard(review,async()=>review,()=>false,'copy',write,share)).rejects.toThrow();expect(write).not.toHaveBeenCalled()
 })
})
