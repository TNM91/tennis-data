import {it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {readImportCourtReviewIssue} from '../data-assist-court-review-issue'
import {importReviewSource,importReviewProblem} from '../data-assist-review-corrections'
import {reviewScorecard,reviewRoster} from '../../tests/fixtures/import-review-data'
import {missingCourtRows,importCourtIssueHtml} from '../../mobile/src/data-import-court-issue'
import {previewImportAction,actOnImport,ImportCourtReviewError,ImportPreviewRefreshError,type ImportSend} from '../../mobile/src/data-import-actions'
import {readImportBatches,readImportDetail} from '../../mobile/src/data-imports-data'
const issue={courts:[{number:3,type:'singles' as const,reason:'missing' as const}]}
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',draftId='33333333-3333-4333-8333-333333333333'
const batch=readImportBatches([{id,submitted_by_user_id:owner,requested_import_type:'scorecard',status:'needs_review',screenshot_count:1,created_at:'2026-10-29',updated_at:'2026-10-29'}],owner).batches[0]
const raw={id:draftId,batch_id:id,submitted_by_user_id:owner,draft_type:'scorecard',status:'ready_for_verification',ocr_status:'processed',parsed_payload:reviewScorecard,validation_summary:{}}
const detail=readImportDetail([raw],batch)!
function fixture(){let active=true;const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}}})},from(){const q={select:()=>q,eq:()=>q,limit:()=>q,abortSignal:()=>q,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:[raw]}).then(resolve)};return q}} as unknown as SupabaseClient;return {client,current:()=>active,close:()=>{active=false}}}
it('rejects malformed court reports and strips extra data from valid reports',()=>{
 expect(readImportCourtReviewIssue({courts:[{...issue.courts[0],private:'hidden'}],private:'hidden'})).toEqual(issue)
 for(const value of [null,{}, {courts:[]},{courts:Array(11).fill(issue.courts[0])},{courts:[...issue.courts,...issue.courts]},...[0,11,'3',NaN].map(number=>({courts:[{...issue.courts[0],number}]})),{courts:[{...issue.courts[0],type:'<img>'}]},{courts:[{...issue.courts[0],reason:'database error'}]}])expect(readImportCourtReviewIssue(value)).toBeNull()
})
it('prefills only absent court identities and still requires complete source-backed details',()=>{
 const base=importReviewSource(reviewScorecard)!,added=missingCourtRows(issue,base,{},[])
 expect(added).toEqual([{lineLabel:'3 Singles',homePlayers:'',awayPlayers:'',score:'',winner:''}]);expect(importReviewProblem(base,{},added)).toBeTruthy()
 expect(missingCourtRows(issue,base,{},added)).toEqual([]);expect(missingCourtRows(issue,importReviewSource(reviewRoster)!,{},[])).toEqual([])
 const changed={courts:[{number:1,type:'doubles' as const,reason:'type_changed' as const}]};expect(missingCourtRows(changed,base,{},[])).toEqual([]);expect(importCourtIssueHtml(changed,false)).toContain('Open Data Assist');expect(importCourtIssueHtml(changed,false)).not.toContain('data-import-missing-courts')
 expect(missingCourtRows(issue,base,{},Array.from({length:8},(_,i)=>({lineLabel:(i+4)+' Singles',homePlayers:'',awayPlayers:'',score:'',winner:''})))).toEqual([])
})
it('preserves corrections and returns a known no-write court error on both preview and confirm',async()=>{
 const f=fixture(),edits={'rows.1.winner':'away'},send=vi.fn<ImportSend>().mockResolvedValue({status:409,data:{ok:false,code:'preview_unavailable',reviewIssue:issue,message:'private server message'},headers:{},url:''})
 await expect(previewImportAction(f.client,owner,f.current,batch,detail,edits,[],send)).rejects.toMatchObject({issue,message:'Complete the saved courts before importing. Your corrections are still here.'})
 const confirmation=actOnImport(f.client,owner,f.current,batch,detail,'confirmed',send,{},{},edits,[],'a'.repeat(64));await expect(confirmation).rejects.toBeInstanceOf(ImportCourtReviewError);await expect(confirmation).rejects.toBeInstanceOf(ImportPreviewRefreshError)
 expect(edits).toEqual({'rows.1.winner':'away'});expect(send).toHaveBeenCalledTimes(2)
})
it('does not reflect unknown error text, accept invalid guidance or use changed-visit responses',async()=>{
 const f=fixture(),edits={'rows.1.winner':'away'}
 for(const response of [{status:503,data:{code:'preview_unavailable',reviewIssue:issue}},{status:409,data:{code:'preview_unavailable',reviewIssue:{courts:[{number:30,type:'singles',reason:'missing'}]}}}])await expect(previewImportAction(f.client,owner,f.current,batch,detail,edits,[],async()=>({...response,headers:{},url:''}))).rejects.toThrow('Check your connection')
 await expect(previewImportAction(f.client,owner,f.current,batch,detail,edits,[],async()=>{f.close();return {status:409,data:{code:'preview_unavailable',reviewIssue:issue},headers:{},url:''}})).rejects.toThrow('sign in again')
})
