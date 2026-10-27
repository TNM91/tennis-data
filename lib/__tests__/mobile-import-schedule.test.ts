import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {readReviewSchedule,reviewedSchedule,scheduleReady,scheduleDate,scheduleTime,canCorrectScheduleField} from '../../mobile/src/data-import-schedule'
import {readImportDetail,type ImportBatch} from '../../mobile/src/data-imports-data'
import {actOnImport,type ImportSend} from '../../mobile/src/data-import-actions'
import {importActionHtml} from '../../mobile/src/data-imports-view'
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',draftId='33333333-3333-4333-8333-333333333333'
const batch:ImportBatch={id,owner,kind:'schedule',status:'needs_review',created:'2026-10-26',updated:'2026-10-26',files:1,note:''}
const match={externalMatchId:'1234567890',matchDate:'',matchTime:'5:30 PM',homeTeam:'<Aces>',awayTeam:'Rallies',facility:'Court 1',confidenceScore:.9,reviewNotes:['Check date']}
const payload={draftKind:'schedule',teamName:'Aces',leagueName:'League',flight:'4.0',ustaSection:'Section',districtArea:'Area',matches:[match,{...match,externalMatchId:'1234567891',matchDate:'10/30/2026',reviewNotes:[]}],matchCount:2,parserWarnings:[],rawTextPreview:'Synthetic export',sourceScreenshotCount:1,provider:'tennislink_export',confidenceScore:.9}
const raw={id:draftId,batch_id:id,submitted_by_user_id:owner,draft_type:'schedule',status:'ready_for_verification',ocr_status:'processed',parsed_payload:payload,validation_summary:{}}
function fixture(){let source=raw;const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}}})},from(){const q={select:()=>q,eq:()=>q,limit:()=>q,abortSignal:()=>q,then:(r:(v:unknown)=>unknown)=>Promise.resolve({data:[source]}).then(r)};return q}} as unknown as SupabaseClient;return {client,change:()=>{source={...raw,parsed_payload:{...payload,matches:[{...match,facility:'New court'},payload.matches[1]]}}}}}
describe('native schedule date review',()=>{
 it('permits only flagged date corrections, preserving every other schedule field',()=>{const s=readReviewSchedule(payload)!;expect(scheduleReady(s,{})).toBe(false);const edited=reviewedSchedule(s,{'0':'2026-10-29'});expect(edited.matches[0]).toEqual({...match,matchDate:'10/29/2026',reviewNotes:[]});expect(edited.matches[1]).toEqual(payload.matches[1]);expect(s.matches[0].matchDate).toBe('');expect(scheduleReady(s,{'0':'2026-10-29'})).toBe(true);for(const key of ['1','2','01'])expect(()=>reviewedSchedule(s,{[key]:'2026-10-29'})).toThrow()})
 it('checks real calendar dates, leap days and the supported year range',()=>{expect(scheduleDate('2028-02-29')).toBe('2/29/2028');for(const v of ['2026-02-29','2026-04-31','2026-00-01','1999-12-31','2100-01-01','10/29/2026',''])expect(()=>scheduleDate(v)).toThrow()})
 it('keeps other missing-field checks blocking confirmation and rejects incomplete edit payloads',()=>{const s=readReviewSchedule({...payload,matches:[{...match,facility:''}],matchCount:1})!;expect(scheduleReady(s,{'0':'2026-10-29'})).toBe(false);for(const p of [{...payload,matches:Array(101).fill(match),matchCount:101},{...payload,matchCount:3},{...payload,provider:'unknown'},{...payload,teamName:undefined}])expect(readReviewSchedule(p)).toBeUndefined();expect(JSON.stringify(readReviewSchedule({...payload,email:'hidden@example.com',matches:[{...match,phone:'private'},payload.matches[1]]}))).not.toContain('private');expect(importActionHtml(batch,readImportDetail([raw],batch)!)).toContain('&lt;Aces&gt;');expect(importActionHtml(batch,readImportDetail([raw],batch)!)).toContain('data-schedule-date="0"');expect(importActionHtml(batch,readImportDetail([raw],batch)!)).not.toContain('data-schedule-date="1"')})
 it('rechecks the saved schedule and sends corrected dates to the same review endpoint only after all checks pass',async()=>{const f=fixture(),d=readImportDetail([raw],batch)!,send=vi.fn<ImportSend>().mockResolvedValue({status:200,data:{ok:true},headers:{},url:''});await expect(actOnImport(f.client,owner,()=>true,batch,d,'confirmed',send)).rejects.toThrow('highlighted');expect(send).not.toHaveBeenCalled();await actOnImport(f.client,owner,()=>true,batch,d,'confirmed',send,{'0':'2026-10-29'});expect(send.mock.calls[0][0].data).toEqual({batchId:id,draftId,decision:'confirmed',parsedDraft:reviewedSchedule(d.schedule!,{'0':'2026-10-29'})});f.change();send.mockClear();await expect(actOnImport(f.client,owner,()=>true,batch,d,'confirmed',send,{'0':'2026-10-29'})).rejects.toThrow('changed');expect(send).not.toHaveBeenCalled()})
})

describe('native missing schedule detail corrections',()=>{
 const incomplete=()=>readReviewSchedule({...payload,matches:[{...match,externalMatchId:'',matchDate:'',matchTime:'',homeTeam:'',awayTeam:'',facility:'',reviewNotes:['Check match ID','Check date','Check time','Check teams','Check site']}],matchCount:1})!
 const fixes={'0':{externalMatchId:'1234567890',matchTime:'17:30',homeTeam:' Northside Aces ',awayTeam:'City Rallies',facility:'Court 2'}}
 it('corrects each highlighted detail while preserving provenance and source immutability',()=>{
  const source=incomplete(),result=reviewedSchedule(source,{'0':'2026-10-29'},fixes)
  expect(result.matches[0]).toEqual({...source.matches[0],externalMatchId:'1234567890',matchDate:'10/29/2026',matchTime:'5:30 PM',homeTeam:'Northside Aces',awayTeam:'City Rallies',facility:'Court 2',reviewNotes:[]})
  expect(result.provider).toBe(source.provider);expect(result.confidenceScore).toBe(source.confidenceScore);expect(result.rawTextPreview).toBe(source.rawTextPreview);expect(source.matches[0].facility).toBe('');expect(scheduleReady(source,{'0':'2026-10-29'},fixes)).toBe(true)
 })
 it('keeps missing or blank details blocked and rejects invalid IDs, times, oversized text and unknown fields',()=>{
  const source=incomplete(),dates={'0':'2026-10-29'}
  expect(scheduleReady(source,dates,{})).toBe(false)
  for(const patch of [{externalMatchId:'abcdefghij'},{externalMatchId:'123'},{matchTime:'24:00'},{matchTime:'12:60'},{matchTime:'5:30 PM'},{facility:'x'.repeat(501)},{facility:'Court\n2'},{facility:''},{homeTeam:'   '},{provider:'mock_review'}])expect(scheduleReady(source,dates,{'0':{...fixes['0'],...patch}})).toBe(false)
  for(const key of ['1','01','-1'])expect(()=>reviewedSchedule(source,dates,{[key]:fixes['0']})).toThrow()
 })
 it('never edits complete saved fields or an already recognized team',()=>{
  const source=readReviewSchedule(payload)!
  expect(()=>reviewedSchedule(source,{'0':'2026-10-29'}, {'0':{facility:'Other court'}})).toThrow()
  const partial={...match,awayTeam:'',reviewNotes:['Check teams']}
  expect(canCorrectScheduleField(partial,'homeTeam')).toBe(false);expect(canCorrectScheduleField(partial,'awayTeam')).toBe(true)
  expect(()=>reviewedSchedule({...source,matches:[partial],matchCount:1},{},{'0':{homeTeam:'Other team'}})).toThrow()
 })
 it('normalizes midnight and noon without timezone conversion',()=>{expect(scheduleTime('00:00')).toBe('12:00 AM');expect(scheduleTime('12:00')).toBe('12:00 PM');expect(scheduleTime('23:59')).toBe('11:59 PM');for(const x of ['1:00','-1:00','12:00:00',''])expect(()=>scheduleTime(x)).toThrow()})
 it('renders escaped, labeled controls only for missing details and gates confirmation on reviewed values',()=>{
  const detail=readImportDetail([{...raw,parsed_payload:incomplete()}],batch)!,markup=importActionHtml(batch,detail,false,{}, {})
  for(const field of Object.keys(fixes['0']))expect(markup).toContain('data-schedule-field="'+field+'"')
  expect(markup).toContain('Reset schedule corrections');expect(markup).toContain('data-import-action="confirmed" disabled')
  const partial=readImportDetail([{...raw,parsed_payload:{...payload,matches:[{...match,awayTeam:'',reviewNotes:['Check teams']}],matchCount:1}}],batch)!
  const html=importActionHtml(batch,partial);expect(html).toContain('&lt;Aces&gt;');expect(html).not.toContain('data-schedule-field="homeTeam"');expect(html).toContain('data-schedule-field="awayTeam"')
 })
 it('sends the corrected schema once through the owner-checked review endpoint and blocks a changed saved source',async()=>{
  const source=incomplete(),draft={...raw,parsed_payload:source},f=fixture()
  const client={...f.client,from(){const q={select:()=>q,eq:()=>q,limit:()=>q,abortSignal:()=>q,then:(r:(v:unknown)=>unknown)=>Promise.resolve({data:[draft]}).then(r)};return q}} as unknown as SupabaseClient
  const detail=readImportDetail([draft],batch)!,send=vi.fn<ImportSend>().mockResolvedValue({status:200,data:{ok:true},headers:{},url:''})
  await actOnImport(client,owner,()=>true,batch,detail,'confirmed',send,{'0':'2026-10-29'},fixes)
  expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][0].data.parsedDraft).toEqual(reviewedSchedule(source,{'0':'2026-10-29'},fixes))
  draft.parsed_payload={...source,teamName:'Changed team'};send.mockClear()
  await expect(actOnImport(client,owner,()=>true,batch,detail,'confirmed',send,{'0':'2026-10-29'},fixes)).rejects.toThrow('changed');expect(send).not.toHaveBeenCalled()
 })
})
