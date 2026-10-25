import {describe,it,expect,vi,beforeEach} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {ComparedPlayer} from '../../mobile/src/comparison-data'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
import {canFollowPlayers} from '../../mobile/src/follows-data'
import {opposingMeetings,loadOpponentMeetings,opponentHistoryHtml} from '../../mobile/src/opponent-meetings'
vi.mock('../../mobile/src/follows-data',()=>({canFollowPlayers:vi.fn()}))
const players=(ids=['a','b'])=>ids.map(id=>({player:{id,name:id==='a'?'<Alex>':id,location:null,flight:null},ratings:null,matches:[]})) as ComparedPlayer[]
const row=(id='m',ids=['a','b'],winner:string|null='A'):RecentMatchRow=>({id,match_date:'2026-10-24',match_type:ids.length===4?'doubles':'singles',league_name:'City',score:'6-4 6-3',winner_side:winner,match_players:ids.map((player_id,i)=>({player_id,side:i<ids.length/2?'A':'B'}))})
function fake(candidates:unknown[]=[{id:'m'}],rows:unknown[]=[row()]){
 const calls:{table:string;select?:string;filters:Record<string,unknown>;limit?:number}[]=[],owners=['owner','owner','owner','owner'];let error=false
 const client={auth:{getSession:async()=>({data:{session:{user:{id:owners.shift()||'owner'}}},error:null})},from:(table:string)=>{
  const call={table,filters:{}} as typeof calls[number];calls.push(call)
  const q={select:(s:string)=>{call.select=s;return q},eq:(k:string,v:unknown)=>{call.filters[k]=v;return q},in:(k:string,v:unknown)=>{call.filters[k]=v;return q},order:()=>q,limit:(n:number)=>{call.limit=n;return q},abortSignal:async()=>({data:calls.length===1?candidates:rows,error:error?Error():null})};return q
 }} as unknown as SupabaseClient
 return {client,calls,owners,fail:()=>{error=true}}
}
beforeEach(()=>vi.mocked(canFollowPlayers).mockResolvedValue(true))
describe('deeper opposing meeting search',()=>{
 it('excludes partners, changed pairs, incomplete sides and duplicate participation',()=>{
  const exact=row('exact',['a','b','c','d']),sub=row('sub',['a','x','c','d']),same=row('same',['a','c','b','d']),short={...exact,id:'short',match_players:exact.match_players.slice(0,3)},dup={...exact,id:'dup',match_players:[...exact.match_players.slice(0,3),exact.match_players[0]]}
  expect(opposingMeetings([exact,sub,same,short,dup],['a','b','c','d'],'overall').map(r=>r.id)).toEqual(['exact'])
  expect(opposingMeetings([exact],['a','b'],'overall')).toEqual([])
  expect(opposingMeetings([exact],['a','c'],'doubles')).toEqual([exact])
  expect(opposingMeetings([exact],['a','c'],'singles')).toEqual([])
 })
 it('recognizes reversed source sides without changing selected pair order',()=>{
  const r=row('m',['c','d','a','b'],'A');expect(opposingMeetings([r],['a','b','c','d'],'doubles')).toEqual([r]);const h=opponentHistoryHtml(players(['a','b','c','d']),{rows:[r],limited:false},'doubles');expect(h).toContain('c / d won');expect(h).toContain('0 - 1');expect(h).toContain('&lt;Alex&gt; / b 0%')
 })
 it('keeps missing winners pending, escapes source text and states bounded coverage',()=>{
  const r={...row('m',['a','b'],null),score:'<script>'};const h=opponentHistoryHtml(players(),{rows:[r],limited:true},'overall');expect(h).toMatch(/data-meeting-metric="Pending"[^>]*>.*?>Pending<.*?>1</);expect(h).toContain('Result pending');expect(h).toContain('&lt;script&gt;');expect(h).toContain('200-match limit');expect(h).toContain('not a complete career record')
 })
 it('makes exactly two bounded reads and hydrates every participant without an inner filter',async()=>{
  const f=fake();const h=await loadOpponentMeetings(f.client,players(),()=>true);expect(h.rows).toEqual([row()]);expect(f.calls).toHaveLength(2);expect(f.calls[0].limit).toBe(201);expect(f.calls[0].filters).toEqual({'match_players.player_id':'a'});expect(f.calls[1].limit).toBe(200);expect(f.calls[1].filters).toEqual({id:['m']});expect(f.calls[1].select).toContain('match_players(player_id,side)');expect(f.calls[1].select).not.toContain('!inner')
 })
 it('uses the sentinel only for coverage and does not hydrate a 201st match',async()=>{
  const refs=Array.from({length:201},(_,i)=>({id:String(i)})),rows=refs.slice(0,200).map(r=>row(r.id));const f=fake(refs,rows);expect((await loadOpponentMeetings(f.client,players(),()=>true)).limited).toBe(true);expect(f.calls[1].filters.id).toHaveLength(200)
 })
 it('distinguishes empty from failed or incomplete hydration',async()=>{
  const empty=fake([],[]);expect(await loadOpponentMeetings(empty.client,players(),()=>true)).toEqual({rows:[],limited:false});expect(empty.calls).toHaveLength(1)
  const missing=fake([{id:'m'}],[]);await expect(loadOpponentMeetings(missing.client,players(),()=>true)).rejects.toThrow();const failed=fake();failed.fail();await expect(loadOpponentMeetings(failed.client,players(),()=>true)).rejects.toThrow()
 })
 it('rejects denied access, stale selection and changed account',async()=>{
  const denied=fake();vi.mocked(canFollowPlayers).mockResolvedValue(false);await expect(loadOpponentMeetings(denied.client,players(),()=>true)).rejects.toThrow();expect(denied.calls).toHaveLength(0);vi.mocked(canFollowPlayers).mockResolvedValue(true)
  const stale=fake();await expect(loadOpponentMeetings(stale.client,players(),()=>false)).rejects.toThrow();expect(stale.calls).toHaveLength(0)
  const changed=fake();changed.owners[2]='other';await expect(loadOpponentMeetings(changed.client,players(),()=>true)).rejects.toThrow();expect(changed.calls).toHaveLength(1)
 })
})
