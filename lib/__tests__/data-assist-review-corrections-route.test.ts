import {beforeEach,it,expect,vi} from 'vitest'
import {reviewScorecard,reviewRoster} from '../../tests/fixtures/import-review-data'
import {importReviewSource} from '../data-assist-review-corrections'
const s=vi.hoisted(()=>({user:'owner',owner:'owner',status:'needs_review',kind:'scorecard',writes:[] as unknown[],score:vi.fn(),roster:vi.fn(),refresh:vi.fn(),preview:vi.fn(),coverage:vi.fn()}))
vi.mock('@/lib/data-assist-scorecard-coverage',()=>({assertScorecardCourtCoverage:s.coverage}))
vi.mock('@/lib/data-assist-review-preview',()=>({previewImportReview:s.preview,createImportPreviewReader:(client:unknown)=>({client})}))
vi.mock('@/lib/supabase',()=>({supabaseUrl:'https://synthetic.invalid',supabaseKey:'public'}))
vi.mock('@/lib/data-assist-rating-refresh',()=>({scheduleDataAssistRatingRefresh:s.refresh}))
vi.mock('@/lib/data-assist-import-runner',()=>({runDataAssistScorecardImportAction:s.score,runDataAssistTeamSummaryImportAction:s.roster,runDataAssistScheduleImportAction:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:s.user?{id:s.user}:null}})},from:(table:string)=>{let update=false;const q={select:()=>q,eq:()=>q,update:(v:unknown)=>{update=true;s.writes.push(v);return q},upsert:(v:unknown)=>{s.writes.push(v);return q},maybeSingle:async()=>({data:table==='data_assist_batches'?{submitted_by_user_id:s.owner,status:s.status,requested_import_type:s.kind}:{submitted_by_user_id:s.owner,status:'ready_for_verification',ocr_status:'processed',parsed_payload:s.kind==='team_summary'?reviewRoster:reviewScorecard,validation_summary:{}}}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:update?null:[],error:null}).then(resolve)};return q}})}))
import {POST} from '../../app/api/data-assist/review/route'
const body=()=>({batchId:'batch',draftId:'draft',decision:'confirmed',reviewCorrection:{base:importReviewSource(reviewScorecard),edits:{'rows.1.winner':'away'}}})
const request=(data:unknown)=>new Request('https://synthetic.invalid/api/data-assist/review',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify(data)})
beforeEach(()=>{s.user='owner';s.owner='owner';s.status='needs_review';s.kind='scorecard';s.writes=[];vi.clearAllMocks();vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service');s.score.mockResolvedValue({ok:true,action:'commit'});s.preview.mockResolvedValue({kind:'scorecard',revision:'a'.repeat(64)});s.coverage.mockResolvedValue(undefined)})
it('passes corrected source through the existing import runner and rating-refresh boundary',async()=>{const response=await POST(request(body()));expect(response.status).toBe(200);expect(s.score).toHaveBeenCalledOnce();expect(s.score.mock.calls[0][0].parsedDraft.lines[1].winner).toBe('away');expect(s.score.mock.calls[0][0].deferRatingRecalculation).toBe(true);expect(s.refresh).toHaveBeenCalledOnce()})
it('refuses unauthenticated and other-owner corrections before writes or imports',async()=>{s.user='';expect((await POST(request(body()))).status).toBe(401);s.user='someone-else';expect((await POST(request(body()))).status).toBe(403);expect(s.writes).toHaveLength(0);expect(s.score).not.toHaveBeenCalled()})
it('refuses stale sources, mixed payloads, imported uploads and source-type changes before writes',async()=>{const stale=body();stale.reviewCorrection.base!.fields.homeTeam='Wrong';expect((await POST(request(stale))).status).toBe(400);expect((await POST(request({...body(),parsedDraft:{}}))).status).toBe(400);s.status='imported';expect((await POST(request(body()))).status).toBe(409);s.status='needs_review';s.kind='schedule';expect((await POST(request(body()))).status).toBe(409);expect(s.writes).toHaveLength(0);expect(s.score).not.toHaveBeenCalled()})

it('routes corrected rosters through the existing roster import without rating recalculation',async()=>{s.kind='team_summary';s.roster.mockResolvedValue({ok:true,action:'commit'});const response=await POST(request({...body(),reviewCorrection:{base:importReviewSource(reviewRoster),edits:{'rows.1.ntrp':'4.5'}}}));expect(response.status).toBe(200);expect(s.roster).toHaveBeenCalledOnce();expect(s.roster.mock.calls[0][0].parsedDraft.players[1]).toMatchObject({ntrp:4.5,ratingSource:'self'});expect(s.score).not.toHaveBeenCalled();expect(s.refresh).not.toHaveBeenCalled()})

it('previews the corrected and added rows without writes, imports, or rating jobs',async()=>{
 const response=await POST(request({...body(),decision:'preview',reviewCorrection:{...body().reviewCorrection,addedRows:[{lineLabel:'3 Singles',homePlayers:'New Home',awayPlayers:'New Away',score:'6-1 6-2',winner:'home'}]}}))
 expect(response.status).toBe(200);expect(s.preview.mock.calls[0][0].parsedDraft.lines).toHaveLength(3);expect(s.writes).toHaveLength(0);expect(s.score).not.toHaveBeenCalled();expect(s.refresh).not.toHaveBeenCalled()
})
it('rejects changed or unavailable preview evidence before all mutations',async()=>{
 const changed=await POST(request({...body(),expectedRevision:'b'.repeat(64)}));expect(changed.status).toBe(409);expect(await changed.json()).toMatchObject({code:'preview_changed'});expect(s.writes).toHaveLength(0)
 s.preview.mockRejectedValue(Error('database unavailable'));expect((await POST(request({...body(),expectedRevision:'a'.repeat(64)}))).status).toBe(503);expect(s.writes).toHaveLength(0);expect(s.score).not.toHaveBeenCalled()
})
it('accepts a current preview but refuses malformed or unsupported receipts',async()=>{
 expect((await POST(request({...body(),expectedRevision:'not-a-hash'}))).status).toBe(400);expect((await POST(request({...body(),decision:'preview',reviewCorrection:undefined}))).status).toBe(400);expect(s.writes).toHaveLength(0)
 expect((await POST(request({...body(),expectedRevision:'a'.repeat(64)}))).status).toBe(200);expect(s.score).toHaveBeenCalledOnce()
})

it('blocks older native confirmations before all writes when an extracted court set omits saved courts',async()=>{
 s.coverage.mockRejectedValue(Error('Missing saved court'))
 const response=await POST(request(body()));expect(response.status).toBe(503);expect(await response.json()).toMatchObject({code:'preview_unavailable'});expect(s.writes).toHaveLength(0);expect(s.score).not.toHaveBeenCalled();expect(s.refresh).not.toHaveBeenCalled()
})
