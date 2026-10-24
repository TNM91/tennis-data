import {describe,it,expect,vi,beforeEach} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
const {roster}=vi.hoisted(()=>({roster:vi.fn()}))
vi.mock('@/lib/season-kickoff-server',()=>({loadSeasonRoster:roster,seasonToday:()=> '2026-10-24'}))
import {loadNativeCaptainWorkspace} from '../native-captain-workspace'
const scope={teamName:'Aces',leagueName:'City',flight:'4.0'}
function database(overrides:Record<string,unknown>={}){
 const rows:Record<string,unknown>={team_profile_links:{data:[{team_role:'captain'}]},internal_conversations:{data:{id:'room'}},internal_conversation_participants:{data:{last_read_at:''}},matches:{data:[{id:'match',home_team:'Aces',away_team:'Rallies',league_name:'City',flight:'4.0',match_date:'2026-10-30',match_time:'18:00',private_token:'secret'}]},captain_lineup_drafts:{data:[{match_date:'2026-10-30',opponent_team:'Rallies',status:'final',delivery_status:'sent',notes:'Captain note',slots_json:[{label:'D1',players:[{playerName:'Alex'},{playerName:''}]}],private_token:'secret'}]},...overrides}
 const calls:{table:string;method:string;args:unknown[]}[]=[]
 const service={from:(table:string)=>{const q:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve(rows[table])),maybeSingle:async()=>rows[table]};for(const method of ['select','eq','is','or','gte','lte','order','limit'])q[method]=(...args:unknown[])=>{calls.push({table,method,args});return q};return q}} as unknown as SupabaseClient
 return {service,calls}
}
beforeEach(()=>roster.mockReset().mockResolvedValue([{key:'player',playerId:'player',name:'Alex',response_token:'secret'}]))
describe('native Captain workspace boundary',()=>{
 it('requires one exact accepted captain link and current participation before private reads',async()=>{
  const db=database(),result=await loadNativeCaptainWorkspace(db.service,'owner',scope)
  expect(result.ok).toBe(true);if(!result.ok)return
  expect(result.roster).toEqual([{id:'player',name:'Alex'}]);expect(result.drafts[0]).toMatchObject({status:'working',sent:false});expect(JSON.stringify(result)).not.toContain('secret')
  for(const args of [['profile_user_id','owner'],['league_name','City'],['flight','4.0'],['status','accepted']])expect(db.calls).toContainEqual({table:'team_profile_links',method:'eq',args})
  expect(db.calls).toContainEqual({table:'team_profile_links',method:'is',args:['archived_at',null]})
  expect(roster).toHaveBeenCalledWith(db.service,{team:'Aces',league:'City',flight:'4.0',seasonKey:''})
  for(const args of [['user_id','owner'],['team_name','Aces'],['league_name','City'],['flight','4.0']])expect(db.calls).toContainEqual({table:'captain_lineup_drafts',method:'eq',args})
  expect(db.calls).toContainEqual({table:'matches',method:'limit',args:[41]});expect(db.calls).toContainEqual({table:'captain_lineup_drafts',method:'limit',args:[21]})
 })
 it('does not load roster, schedule or drafts for missing, player-only, duplicate or unavailable links',async()=>{
  for(const link of [{data:[]},{data:[{team_role:'player'}]},{data:[{team_role:'captain'},{team_role:'captain'}]},{error:{}}]){
   const db=database({team_profile_links:link});expect((await loadNativeCaptainWorkspace(db.service,'owner',scope)).ok).toBe(false);expect(db.calls.some(c=>['matches','captain_lineup_drafts'].includes(c.table))).toBe(false)
  }
  expect(roster).not.toHaveBeenCalled()
 })
 it('fails closed if the room or current participant disappears or a private lookup fails',async()=>{
  for(const patch of [{internal_conversations:{data:null}},{internal_conversation_participants:{data:null}},{internal_conversation_participants:{error:{}}}]){
   const db=database(patch);expect((await loadNativeCaptainWorkspace(db.service,'owner',scope)).ok).toBe(false);expect(db.calls.some(c=>c.table==='matches')).toBe(false)
  }
  expect((await loadNativeCaptainWorkspace(database({matches:{error:{}}}).service,'owner',scope)).ok).toBe(false)
 })
 it('excludes cancelled/court records and caps saved court/player detail',async()=>{
  const match={id:'m',home_team:'Aces',away_team:'Rallies',match_date:'2026-10-30',league_name:'City',flight:'4.0'}
  const db=database({matches:{data:[match,{...match,id:'cancelled',status:'cancelled'},{...match,id:'court',match_type:'Singles'}]},captain_lineup_drafts:{data:[{match_date:'2026-10-30',slots_json:Array.from({length:40},()=>({players:[{playerName:'Alex'},{playerName:'Jordan'},{playerName:'Extra'}]}))}]}})
  const result=await loadNativeCaptainWorkspace(db.service,'owner',scope);expect(result.ok).toBe(true);if(!result.ok)return
  expect(result.matches.map(m=>m.id)).toEqual(['m']);expect(result.drafts[0].courts).toHaveLength(30);expect(result.drafts[0].courts[0].players).toHaveLength(2)
 })
})
