import {it,expect,vi} from 'vitest'
vi.mock('../team-room-result-announcement-server',()=>({announceTeamRoomScorecardResult:vi.fn()}))
vi.mock('../team-import-notifications-server',()=>({notifyLinkedPlayersOfImportedTeam:vi.fn()}))
import type {SupabaseClient} from '@supabase/supabase-js'
import {createImportPreviewReader,previewImportReview} from '../data-assist-review-preview'
import {applyImportReviewCorrection,importReviewSource} from '../data-assist-review-corrections'
import {reviewScorecard,reviewRoster} from '../../tests/fixtures/import-review-data'
function database(rows:Record<string,unknown[]>,error:unknown=null){
 const calls:string[]=[]
 const client={from(table:string){calls.push(table);let single=false;const filters:Array<(r:Record<string,unknown>)=>boolean>=[];const q={select:()=>q,eq:(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return q},in:(k:string,v:unknown[])=>{filters.push(r=>v.includes(r[k]));return q},like:(k:string,v:string)=>{filters.push(r=>String(r[k]).startsWith(v.replace(/%$/,'')));return q},order:()=>q,limit:()=>q,maybeSingle:()=>{single=true;return q},abortSignal:()=>q,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:single?((rows[table]||[]).filter(r=>filters.every(f=>f(r as Record<string,unknown>)))[0]??null):(rows[table]||[]).filter(r=>filters.every(f=>f(r as Record<string,unknown>))),error}).then(resolve)};return q}} as unknown as SupabaseClient
 return {client,calls}
}
it('blocks mutations, unsupported tables, read failures and oversized reads',async()=>{
 const db=database({matches:Array(11).fill({id:'x'})}),reader=createImportPreviewReader(db.client)
 expect(()=>reader.client.from('players').insert({name:'x'})).toThrow('read-only');expect(()=>reader.client.rpc('write')).toThrow();expect(()=>reader.client.from('private_keys').select('*')).toThrow()
 await expect(reader.client.from('matches').select('id')).rejects.toThrow('too large')
 await expect(createImportPreviewReader(database({},Error('private database details')).client).client.from('players').select('id')).rejects.toThrow('could not be compared')
})
it('uses the real scorecard preview with no writes and a stable revision, including unsaved additions',async()=>{
 const source=structuredClone(reviewScorecard),parsedDraft=applyImportReviewCorrection(source,{base:importReviewSource(source),edits:{'rows.1.winner':'away'},addedRows:[{lineLabel:'3 Singles',homePlayers:'New Home',awayPlayers:'New Away',score:'6-1 6-2',winner:'home'}]}) as typeof source
 const input={supabase:database({}).client,parsedDraft,batchId:'batch',draftId:'draft',reviewedBy:'owner'}
 const a=await previewImportReview(input),b=await previewImportReview({...input,supabase:database({}).client})
 expect(a).toMatchObject({kind:'scorecard',newCount:1,updateCount:0,duplicateCount:0,courtCount:3});expect(a.revision).toBe(b.revision)
 expect((await previewImportReview({...input,parsedDraft:{...parsedDraft,homeTeam:'Changed'}})).revision).not.toBe(a.revision)
})
it('uses the real roster preview with preservation and keeps private contacts out of the receipt',async()=>{
 const source=structuredClone(reviewRoster),parsedDraft=applyImportReviewCorrection(source,{base:importReviewSource(source),edits:{'rows.1.ntrp':'4.5'}}) as typeof source
 const rows={team_roster_members:[{player_name:'Preserved Player',ntrp:4,normalized_team_name:'northside aces',league_name:source.leagueName,flight:source.flight}],captain_roster_contacts:[{full_name:'Preserved Player',captain_user_id:'owner',normalized_team_name:'northside aces',league_name:source.leagueName,flight:source.flight,email:'never-return@example.invalid',phone:'5550101'}]}
 const receipt=await previewImportReview({supabase:database(rows).client,parsedDraft,batchId:'batch',draftId:'draft',reviewedBy:'owner'})
 expect(receipt).toMatchObject({newCount:2,updateCount:0,preservedPlayers:1,preservedDetails:2});expect(JSON.stringify(receipt)).not.toMatch(/never-return|5550101|private@example/)
 const changed=await previewImportReview({supabase:database({...rows,team_roster_members:[]}).client,parsedDraft,batchId:'batch',draftId:'draft',reviewedBy:'owner'});expect(changed.revision).not.toBe(receipt.revision)
})

it('reports an exact saved duplicate, and detects a changed saved court before confirmation',async()=>{
 const source=structuredClone(reviewScorecard),parsedDraft=applyImportReviewCorrection(source,{base:importReviewSource(source),edits:{'rows.1.winner':'away'}}) as typeof source
 const playerNames=parsedDraft.lines.flatMap(l=>[...l.homePlayers,...l.awayPlayers]),players=playerNames.map((name,i)=>({id:'p'+i,name,normalized_name:name.toLowerCase()})),lines=parsedDraft.lines.map((l,i)=>({id:'c'+i,external_match_id:parsedDraft.externalMatchId+'::line:'+(i+1),line_number:String(i+1),match_type:i?'doubles':'singles',winner_side:i?'B':'A',score:l.score,status:'completed'})),members=parsedDraft.lines.flatMap((l,i)=>[...l.homePlayers.map((name,seat)=>({match_id:'c'+i,player_id:players.find(p=>p.name===name)!.id,side:'A',seat})),...l.awayPlayers.map((name,seat)=>({match_id:'c'+i,player_id:players.find(p=>p.name===name)!.id,side:'B',seat}))])
 const rows={players,matches:[{id:'parent',external_match_id:parsedDraft.externalMatchId,status:'completed',match_date:'2026-10-28',home_team:parsedDraft.homeTeam,away_team:parsedDraft.awayTeam,line_number:null},...lines],match_players:members}
 const input={parsedDraft,batchId:'batch',draftId:'draft',reviewedBy:'owner'},a=await previewImportReview({...input,supabase:database(rows).client})
 expect(a).toMatchObject({newCount:0,updateCount:0,duplicateCount:1,courtCount:2})
 const changed={...rows,matches:rows.matches.map(row=>row.id==='c0'?{...row,score:'6-1 6-2'}:row)},b=await previewImportReview({...input,supabase:database(changed).client})
 expect(b).toMatchObject({newCount:0,updateCount:1,duplicateCount:0});expect(b.revision).not.toBe(a.revision)
})
