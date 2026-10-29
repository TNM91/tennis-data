import {readImportCourtReviewIssue,type ImportCourtReviewIssue} from '../../lib/data-assist-court-review-issue'
import {readImportReviewImpact} from '../../lib/data-assist-review-impact'
import {importReviewProblem,type ImportReviewEdits,type ImportReviewAddedRows} from '../../lib/data-assist-review-corrections'
import {reviewedSchedule,type ScheduleDates,type ScheduleCorrections} from './data-import-schedule'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadImportDetail,type ImportBatch,type ImportDetail} from './data-imports-data'

export type ImportAction = 'read' | 'confirmed' | 'flagged'
export type ImportSend = (options:HttpOptions)=>Promise<HttpResponse>
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function availableImportActions(batch:ImportBatch,detail:ImportDetail):ImportAction[]{
 if(batch.status==='imported'||detail.status==='imported'||batch.status==='rejected'||batch.status==='verified')return []
 if(detail.ocr==='processed')return ['needs_review','ready_for_verification'].includes(detail.status)
  ? [...(detail.total>0&&detail.total<=100?['confirmed' as const]:[]),'flagged'] : []
 return ['needs_review','blocked'].includes(detail.status)&&['not_started','failed'].includes(detail.ocr)?['read']:[]
}
export async function actOnImport(client:SupabaseClient,owner:string,current:()=>boolean,batch:ImportBatch,detail:ImportDetail,action:ImportAction,send:ImportSend=o=>CapacitorHttp.post(o),dates:ScheduleDates={},corrections:ScheduleCorrections={},reviewEdits:ImportReviewEdits={},addedRows:ImportReviewAddedRows=[],expectedRevision?:string){
 const own=async()=>{if(!current()||owner!==batch.owner||!uuid.test(owner)||!uuid.test(batch.id)||!uuid.test(detail.draftId))throw Error('Close this upload and sign in again.');const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!data.session.access_token||!current())throw Error('Close this upload and sign in again.');return data.session.access_token}
 await own()
 // Recheck the saved source before any write; a changed draft needs a fresh review.
 const latest=await loadImportDetail(client,batch,current)
 if(!latest||JSON.stringify(latest)!==JSON.stringify(detail)||!availableImportActions(batch,latest).includes(action))throw Error('This saved draft changed. Refresh it and review the latest values before continuing.')
 let parsedDraft
 if(action==='confirmed'&&batch.kind==='schedule'){
  if(!latest.schedule)throw Error('Open this schedule in Data Assist to finish review.')
  parsedDraft=reviewedSchedule(latest.schedule,dates,corrections)
  if(parsedDraft.matches.some(m=>m.reviewNotes.length))throw Error('Finish the highlighted checks before importing this schedule.')
 }
 const reviewCorrection=action==='confirmed'&&latest.reviewSource?{base:latest.reviewSource,edits:reviewEdits,addedRows}:undefined
 if(reviewCorrection){const problem=importReviewProblem(reviewCorrection.base,reviewEdits,addedRows);if(problem)throw Error(problem)}
 const token=await own()
 let response:HttpResponse
 try{response=await send({url:'https://www.tenaceiq.com/api/data-assist/'+(action==='read'?'ocr':'review'),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},data:{batchId:batch.id,draftId:detail.draftId,...(action==='read'?{}:{decision:action}),...(parsedDraft?{parsedDraft}:{}),...(reviewCorrection?{reviewCorrection,...(expectedRevision?{expectedRevision}:{})}:{})},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:100000})}
 catch{throw Error('The result could not be confirmed. This action may still finish. Refresh the saved upload before trying again.')}
 await own()
 const issue=response.status===409&&response.data?.code==='preview_unavailable'?readImportCourtReviewIssue(response.data.reviewIssue):null
 if(issue&&latest.reviewSource?.kind==='scorecard')throw new ImportCourtReviewError(issue)
 if([409,503].includes(response.status)&&['preview_changed','preview_unavailable'].includes(response.data?.code))throw new ImportPreviewRefreshError('Current records changed or could not be compared. Preview again before confirming.')
 const data=response.data as {ok?:boolean;autoImport?:{ok?:boolean}}|null
 if(response.status!==200||!data||data.ok!==true)throw Error('The action did not return a confirmed result. Refresh the saved upload to check its status before trying again.')
 return action==='flagged'?'Your review was saved. Check the refreshed upload for its current status.':data.autoImport?.ok===true?'Import reported complete. Check the refreshed saved outcome below.':action==='read'?'Reading finished. Check the refreshed draft and import status below.':'Your confirmation was saved. Check the refreshed import status below.'
}

export class ImportPreviewRefreshError extends Error {}
export class ImportCourtReviewError extends ImportPreviewRefreshError{
 constructor(readonly issue:ImportCourtReviewIssue){super('Complete the saved courts before importing. Your corrections are still here.')}
}
export async function previewImportAction(client:SupabaseClient,owner:string,current:()=>boolean,batch:ImportBatch,detail:ImportDetail,edits:ImportReviewEdits,addedRows:ImportReviewAddedRows,send:ImportSend=o=>CapacitorHttp.post(o)){
 const session=async()=>{const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==owner||owner!==batch.owner||!uuid.test(batch.id)||!uuid.test(detail.draftId))throw Error('Close this screen and sign in again.');return data.session.access_token}
 await session()
 const latest=await loadImportDetail(client,batch,current)
 if(!latest?.reviewSource||JSON.stringify(latest)!==JSON.stringify(detail)||!availableImportActions(batch,latest).includes('confirmed'))throw Error('This saved draft changed. Refresh it before previewing.')
 const problem=importReviewProblem(latest.reviewSource,edits,addedRows);if(problem)throw Error(problem)
 const token=await session()
 const response=await send({url:'https://www.tenaceiq.com/api/data-assist/review',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},data:{batchId:batch.id,draftId:detail.draftId,decision:'preview',reviewCorrection:{base:latest.reviewSource,edits,addedRows}},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:45000})
 await session()
 const issue=response.status===409&&response.data?.code==='preview_unavailable'?readImportCourtReviewIssue(response.data.reviewIssue):null
 if(issue&&latest.reviewSource.kind==='scorecard')throw new ImportCourtReviewError(issue)
 if(response.status!==200||response.data?.ok!==true)throw Error('The preview could not be loaded. Check your connection and try previewing again.')
 const impact=readImportReviewImpact(response.data.impact)
 if(impact.kind!==latest.reviewSource.kind)throw Error('The preview type changed. Refresh this upload.')
 return impact
}
