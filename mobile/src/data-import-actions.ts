import {importReviewProblem,type ImportReviewEdits} from '../../lib/data-assist-review-corrections'
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
export async function actOnImport(client:SupabaseClient,owner:string,current:()=>boolean,batch:ImportBatch,detail:ImportDetail,action:ImportAction,send:ImportSend=o=>CapacitorHttp.post(o),dates:ScheduleDates={},corrections:ScheduleCorrections={},reviewEdits:ImportReviewEdits={}){
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
 const reviewCorrection=action==='confirmed'&&latest.reviewSource?{base:latest.reviewSource,edits:reviewEdits}:undefined
 if(reviewCorrection){const problem=importReviewProblem(reviewCorrection.base,reviewEdits);if(problem)throw Error(problem)}
 const token=await own()
 let response:HttpResponse
 try{response=await send({url:'https://www.tenaceiq.com/api/data-assist/'+(action==='read'?'ocr':'review'),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},data:{batchId:batch.id,draftId:detail.draftId,...(action==='read'?{}:{decision:action}),...(parsedDraft?{parsedDraft}:{}),...(reviewCorrection?{reviewCorrection}:{})},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:100000})}
 catch{throw Error('The result could not be confirmed. This action may still finish. Refresh the saved upload before trying again.')}
 await own()
 const data=response.data as {ok?:boolean;autoImport?:{ok?:boolean}}|null
 if(response.status!==200||!data||data.ok!==true)throw Error('The action did not return a confirmed result. Refresh the saved upload to check its status before trying again.')
 return action==='flagged'?'Your review was saved. Check the refreshed upload for its current status.':data.autoImport?.ok===true?'Import reported complete. Check the refreshed saved outcome below.':action==='read'?'Reading finished. Check the refreshed draft and import status below.':'Your confirmation was saved. Check the refreshed import status below.'
}
