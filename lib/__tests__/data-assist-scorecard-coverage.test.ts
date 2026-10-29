import {it,expect} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {assertScorecardCourtCoverage,ImportCourtCoverageError} from '../data-assist-scorecard-coverage'
import {createImportPreviewReader} from '../data-assist-review-preview'
import {reviewScorecard} from '../../tests/fixtures/import-review-data'
import {vi} from 'vitest'
vi.mock('../team-room-result-announcement-server',()=>({announceTeamRoomScorecardResult:vi.fn()}))
vi.mock('../team-import-notifications-server',()=>({notifyLinkedPlayersOfImportedTeam:vi.fn()}))
const saved=[{id:'court-1',external_match_id:'1011650664::line:1',line_number:'1',match_type:'singles'},{id:'court-2',external_match_id:'1011650664::line:2',line_number:'2',match_type:'doubles'}]
function client(rows:unknown[],error:unknown=null){const q={select:()=>q,like:()=>q,limit:()=>q,abortSignal:()=>q,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:rows,error}).then(resolve)};return createImportPreviewReader({from:()=>q} as unknown as SupabaseClient).client}
it('allows a new scorecard, full corrections, and source-backed additions without mutating saved courts',async()=>{
 await expect(assertScorecardCourtCoverage(client([]),reviewScorecard)).resolves.toBeUndefined();await expect(assertScorecardCourtCoverage(client(saved),reviewScorecard)).resolves.toBeUndefined()
 await expect(assertScorecardCourtCoverage(client(saved),{...reviewScorecard,lineCount:3,lines:[...reviewScorecard.lines,{...reviewScorecard.lines[0],lineLabel:'3 Singles'}]})).resolves.toBeUndefined()
})
it('blocks omitted, renumbered or changed-type courts, including a saved court outside the source read',async()=>{
 for(const rows of [[...saved,{...saved[0],external_match_id:'1011650664::line:3',line_number:'3'}],[{...saved[0],match_type:'doubles'}],[{...saved[0],external_match_id:'foreign::line:1'}],Array(2).fill(saved[0])])await expect(assertScorecardCourtCoverage(client(rows),reviewScorecard)).rejects.toThrow()
 await expect(assertScorecardCourtCoverage(client(saved),{...reviewScorecard,lineCount:1,lines:reviewScorecard.lines.slice(0,1)})).rejects.toThrow('Complete the saved courts')
})
it('fails closed on read errors, oversized court sets, and malformed saved identity',async()=>{
 await expect(assertScorecardCourtCoverage(client([],Error('unavailable')),reviewScorecard)).rejects.toThrow();await expect(assertScorecardCourtCoverage(client(Array(11).fill(saved[0])),reviewScorecard)).rejects.toThrow();await expect(assertScorecardCourtCoverage(client([{...saved[0],line_number:null}]),reviewScorecard)).rejects.toThrow()
})

it('reports missing courts and conflicting types using court identities only',async()=>{
 const rows=[{...saved[0],external_match_id:'1011650664::line:3',line_number:3,private:'never send'}, {...saved[0],match_type:'doubles'}]
 try{await assertScorecardCourtCoverage(client(rows),reviewScorecard);throw Error('Should block')}catch(cause){expect(cause).toBeInstanceOf(ImportCourtCoverageError);expect((cause as ImportCourtCoverageError).issue).toEqual({courts:[{number:1,type:'doubles',reason:'type_changed'},{number:3,type:'singles',reason:'missing'}]})}
 // Validate every saved record before returning any useful guidance.
 await expect(assertScorecardCourtCoverage(client([...rows,null]),reviewScorecard)).rejects.not.toBeInstanceOf(ImportCourtCoverageError)
})
