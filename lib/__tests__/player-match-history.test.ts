import {describe, expect, it} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {PLAYER_RECENT_MATCH_LIMIT, playerMatchHistoryQuery, type PlayerMatchHistoryRow} from '../player-match-history'
import {playerRecentRecord} from '../player-recent-record'
import {loadRecentResults, matchResult} from '../../mobile/src/recent-results'
import {loadOlderResults} from '../../mobile/src/recent-results-history'
import {recentForm, recentPulseHtml} from '../../mobile/src/results-view'

const player = '11111111-1111-4111-8111-111111111111'
const other = '11111111-1111-4111-8111-222222222222'
type Stored = PlayerMatchHistoryRow & {public_history_eligible: boolean; line_number: string | null; source: string}
const id = (n: number) => '30000000-0000-4000-8000-' + String(n).padStart(12, '0')
function court(n: number): Stored {
  return {id: id(1000-n), match_date: new Date(Date.UTC(2026,9,25-n)).toISOString().slice(0,10), match_type: n%2?'singles':'doubles', league_name:'Synthetic league', score:'6-4;6-3', winner_side: n<10?([0,1,2,3,4,6].includes(n)?'A':'B'):(n%2?'A':'B'), match_players:[{player_id:player,side:'A'}], public_history_eligible:true, line_number:'1', source:'captain_scorecard'}
}
function seed() {
  const courts = Array.from({length:35},(_,i)=>court(i))
  const teams = courts.map((c,i)=>({...c,id:id(3000-i),match_type:null,line_number:null,score:'3-2',winner_side:'A'}))
  const obsolete = {...court(0),id:id(5000),match_date:'2026-10-27',public_history_eligible:false,source:'tennisrecord'}
  const unrelated = {...court(0),id:id(6000),match_date:'2026-10-28',match_players:[{player_id:other,side:'A'}]}
  return {courts,rows:[...teams,...courts,obsolete,unrelated]}
}
// A small relational fixture executes filters before pagination, like PostgREST.
// This checks returned records and derived stats rather than just method calls.
function database(rows: Stored[]): SupabaseClient {
  return {from:()=>{
    let matches=[...rows],owner:string|undefined,start=0,end:number|undefined
    const orders:Array<{field:keyof Stored;ascending:boolean;nullsFirst?:boolean}>=[]
    const q={
      select:()=>q,
      eq:(field:string,value:unknown)=>{if(field==='match_players.player_id'){owner=String(value);matches=matches.filter(r=>r.match_players.some(p=>p.player_id===value))}else matches=matches.filter(r=>r[field as keyof Stored]===value);return q},
      in:(field:keyof Stored,values:readonly unknown[])=>{matches=matches.filter(r=>values.includes(r[field]));return q},
      order:(field:keyof Stored,options:{ascending:boolean;nullsFirst?:boolean})=>{orders.push({field,...options});return q},
      limit:(n:number)=>{end=n;return q},
      range:(from:number,to:number)=>{start=from;end=to+1;return q},
      abortSignal:async()=>({data:matches.sort((a,b)=>{for(const o of orders){const x=a[o.field],y=b[o.field];if(x===y)continue;if(x===null)return o.nullsFirst?-1:1;if(y===null)return o.nullsFirst?1:-1;return String(x).localeCompare(String(y))*(o.ascending?1:-1)}return 0}).slice(start,end).map(r=>({...r,match_players:r.match_players.filter(p=>p.player_id===owner)})),error:null}),
    };return q
  }} as unknown as SupabaseClient
}

describe('personal match history excludes team totals and superseded imports',()=>{
  it('returns ten individual courts, with six wins and four losses instead of the team wins',async()=>{
    const {courts,rows}=seed()
    const result=await loadRecentResults(database(rows),player)
    expect(result.error).toBeNull()
    expect(result.data?.map(r=>r.id)).toEqual(courts.slice(0,10).map(r=>r.id))
    expect(recentForm(result.data!,player)).toEqual({wins:6,losses:4,pending:0})
    expect(recentPulseHtml(result.data!,player)).toContain('6 wins · 4 losses')
    expect(recentPulseHtml(result.data!,player)).toContain('value="60"')
  })
  it('uses the same eligible, newest-first sample for website My Lab',async()=>{
    const {courts,rows}=seed()
    const result=await playerMatchHistoryQuery(database(rows),player).limit(PLAYER_RECENT_MATCH_LIMIT).abortSignal(AbortSignal.timeout(1000))
    expect(result.data?.map(r=>r.id)).toEqual(courts.slice(0,10).map(r=>r.id))
    const record=playerRecentRecord(result.data!.map(row=>({date:row.match_date,result:matchResult(row,player)==='Won'?'W':'L'})))
    expect(record).toMatchObject({wins:6,losses:4,winRate:60,currentWinStreak:5})
  })
  it('paginates the filtered court history without gaps or duplicate entries',async()=>{
    const {courts,rows}=seed(),client=database(rows)
    const first=(await loadRecentResults(client,player)).data!
    const second=await loadOlderResults(client,player,first)
    expect(second.rows.map(r=>r.id)).toEqual(courts.slice(0,30).map(r=>r.id))
    expect(second.hasMore).toBe(true)
    const last=await loadOlderResults(client,player,second.rows)
    expect(last.rows.map(r=>r.id)).toEqual(courts.map(r=>r.id))
    expect(last.hasMore).toBe(false)
    expect(new Set(last.rows.map(r=>r.id)).size).toBe(35)
  })
  it('keeps legitimate unnumbered imported courts and pending personal matches',async()=>{
    const oldCourt={...court(0),line_number:null,source:'tennisrecord'},pending={...court(1),winner_side:null}
    const result=await loadRecentResults(database([oldCourt,pending]),player)
    expect(result.data?.map(r=>r.id)).toEqual([oldCourt.id,pending.id])
    expect(recentForm(result.data!,player)).toEqual({wins:1,losses:0,pending:1})
  })
  it('preserves a personal loss when the team won and a personal win when the team lost',async()=>{
    const loss={...court(0),winner_side:'B'},win={...court(1),winner_side:'A'}
    const totals=[{...loss,id:id(2000),match_type:null,score:'3-2',winner_side:'A'},{...win,id:id(2001),match_type:null,score:'2-3',winner_side:'B'}]
    const result=await loadRecentResults(database([loss,win,...totals]),player)
    expect(result.data?.map(r=>matchResult(r,player))).toEqual(['Lost','Won'])
    expect(recentForm(result.data!,player)).toEqual({wins:1,losses:1,pending:0})
  })
  it('does not invent personal results from roster-only team associations',async()=>{
    const team={...court(0),match_type:null,line_number:null,score:'3-2'}
    expect((await loadRecentResults(database([team]),player)).data).toEqual([])
  })
})
