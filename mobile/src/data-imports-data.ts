import {readReviewSchedule} from './data-import-schedule'
import type {DataAssistScheduleParsedDraft} from '../../lib/data-assist-schedule-parser'
import type {SupabaseClient} from '@supabase/supabase-js'

export const DATA_ASSIST_URL = 'https://www.tenaceiq.com/data-assist'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const kinds = ['scorecard','schedule','team_summary'] as const
const statuses = ['uploaded','layout_detected','needs_review','ready_to_import','rejected','verified','imported'] as const
export type ImportKind = typeof kinds[number]
export type ImportBatch = {id:string;owner:string;kind:ImportKind;status:string;created:string;updated:string;files:number;note:string}
export type ImportRow = {title:string;values:Array<[string,string]>}
export type ImportDetail = {draftId:string;status:string;ocr:string;notes:string[];context:Array<[string,string]>;rows:ImportRow[];total:number;outcome:Array<[string,string]>;schedule?:DataAssistScheduleParsedDraft}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('This saved upload needs review on TenAceIQ.');return value as Record<string,unknown>}
function text(value:unknown,max=500):string{if(value==null)return '';if(typeof value!=='string'||value.length>max)throw Error('This saved upload needs review on TenAceIQ.');return value.trim()}
function date(value:unknown){const s=text(value,80);if(!s||!Number.isFinite(Date.parse(s)))throw Error('Upload dates are unavailable.');return s}
function strings(value:unknown):string[]{if(value==null)return [];if(!Array.isArray(value)||value.length>100)throw Error('This saved upload needs review on TenAceIQ.');return value.map(v=>text(v,2000)).filter(Boolean)}
function rows(value:unknown):Record<string,unknown>[]{if(value==null)return [];if(!Array.isArray(value)||value.length>1000)throw Error('Open this larger upload on TenAceIQ.');return value.map(object)}
export function readImportBatches(value:unknown,owner:string){
 if(!uuid.test(owner)||!Array.isArray(value)||value.length>41)throw Error('Upload history is unavailable.')
 const seen=new Set<string>()
 const batches=value.map(v=>{const r=object(v),id=text(r.id),kind=text(r.requested_import_type),status=text(r.status)
  if(!uuid.test(id)||seen.has(id)||r.submitted_by_user_id!==owner||!kinds.includes(kind as ImportKind)||!statuses.includes(status as typeof statuses[number])||!Number.isInteger(r.screenshot_count)||Number(r.screenshot_count)<0||Number(r.screenshot_count)>80)throw Error('Upload history needs review on TenAceIQ.')
  seen.add(id);return {id,owner,kind:kind as ImportKind,status,created:date(r.created_at),updated:date(r.updated_at),files:Number(r.screenshot_count),note:text(r.review_note,4000)||text(r.rejection_reason,4000)}
 })
 return {batches:batches.slice(0,40),limited:batches.length>40}
}
export function readImportDetail(value:unknown,batch:ImportBatch):ImportDetail|null{
 if(!Array.isArray(value)||value.length>1)throw Error('This upload has conflicting saved drafts. Open it on TenAceIQ.')
 if(!value.length)return null
 const r=object(value[0]);if(!uuid.test(text(r.id))||r.batch_id!==batch.id||r.submitted_by_user_id!==batch.owner||r.draft_type!==batch.kind)throw Error('This saved draft does not match the selected upload.')
 const status=text(r.status),ocr=text(r.ocr_status);if(!['needs_review','blocked','ready_for_verification','verified','imported'].includes(status))throw Error('Open this draft on TenAceIQ.')
 const p=object(r.parsed_payload||{}),validation=object(r.validation_summary||{})
 if(JSON.stringify(p).length>256000||JSON.stringify(validation).length>256000)throw Error('Open this larger upload on TenAceIQ.')
 const notes=[batch.note,text(r.review_note,4000),...strings(p.parserWarnings)]
 const context:Array<[string,string]>=[]
 for(const [label,key] of [['Team','teamName'],['Roster team','rosterTeamName'],['Home','homeTeam'],['Away','awayTeam'],['Match date','matchDate'],['League','leagueName'],['Flight','flight']] as const){const v=text(p[key]);if(v)context.push([label,v])}
 let source:Record<string,unknown>[]=[],records:ImportRow[]=[]
 if(batch.kind==='schedule'){
  if(p.draftKind&&p.draftKind!=='schedule')throw Error('The parsed type changed. Open this upload on TenAceIQ.')
  source=rows(p.matches);records=source.slice(0,100).map((m,i)=>{notes.push(...strings(m.reviewNotes));return {title:'Match '+(i+1),values:[['Date',text(m.matchDate)],['Time',text(m.matchTime)],['Home',text(m.homeTeam)],['Away',text(m.awayTeam)],['Facility',text(m.facility)]]}})
 }else if(batch.kind==='team_summary'){
  if(p.draftKind&&p.draftKind!=='team_summary')throw Error('The parsed type changed. Open this upload on TenAceIQ.')
  source=rows(p.players);records=source.slice(0,100).map((m,i)=>{const n=m.ntrp;if(n!=null&&(typeof n!=='number'||!Number.isFinite(n)||n<1||n>7))throw Error('A saved roster rating needs review.');return {title:text(m.name)||'Player '+(i+1),values:[['Team',text(m.teamName)],['Recorded NTRP',n==null?'Not recorded':String(n)]]}})
 }else{
  if(p.matches||p.players||p.draftKind&&p.draftKind!=='scorecard')throw Error('The parsed type changed. Open this upload on TenAceIQ.')
  source=rows(p.lines);records=source.slice(0,100).map((m,i)=>{notes.push(...strings(m.parseNotes));return {title:text(m.lineLabel)||'Court '+(i+1),values:[['Home players',strings(m.homePlayers).join(' / ')],['Away players',strings(m.awayPlayers).join(' / ')],['Score',text(m.score)],['Winner as saved',text(m.winner)]]}})
 }
 const summary=validation.importSummary?object(validation.importSummary):null,result=summary?.importResult?object(summary.importResult):null,counts=result?.result?object(result.result):null,outcome:Array<[string,string]>=[]
 if(counts)for(const [label,key] of [['Saved','successCount'],['Updated','updatedCount'],['Skipped','skippedCount'],['Failed','failedCount']] as const){const n=counts[key];if(n!=null){if(!Number.isSafeInteger(n)||Number(n)<0)throw Error('Import counts need review.');outcome.push([label,String(n)])}}
 return {draftId:text(r.id),status,ocr,notes:Array.from(new Set(notes.filter(Boolean))).slice(0,100),context,rows:records,total:source.length,outcome,...(batch.kind==='schedule'?{schedule:readReviewSchedule(p)}:{})}
}
async function ownerSession(client:SupabaseClient,owner:string,current:()=>boolean){
 if(!uuid.test(owner)||!current())throw Error('Close this screen and sign in again.')
 const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw Error('Close this screen and sign in again.')
}
export async function loadImportBatches(client:SupabaseClient,owner:string,current:()=>boolean){
 await ownerSession(client,owner,current)
 const r=await client.from('data_assist_batches').select('id,submitted_by_user_id,requested_import_type,status,screenshot_count,review_note,rejection_reason,created_at,updated_at').eq('submitted_by_user_id',owner).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(41).abortSignal(AbortSignal.timeout(12000))
 await ownerSession(client,owner,current);if(r.error)throw Error('Could not load your uploads. Check your connection and try again.')
 return readImportBatches(r.data,owner)
}
export async function loadImportDetail(client:SupabaseClient,batch:ImportBatch,current:()=>boolean){
 if(!uuid.test(batch.id))throw Error('Choose a saved upload again.')
 await ownerSession(client,batch.owner,current)
 const r=await client.from('data_assist_drafts').select('id,batch_id,submitted_by_user_id,draft_type,status,ocr_status,review_note,parsed_payload,validation_summary').eq('submitted_by_user_id',batch.owner).eq('batch_id',batch.id).limit(2).abortSignal(AbortSignal.timeout(12000))
 await ownerSession(client,batch.owner,current);if(r.error)throw Error('Could not load this draft. Try again when connected.')
 return readImportDetail(r.data,batch)
}

export async function loadImportBatch(client:SupabaseClient,owner:string,id:string,current:()=>boolean){
 if(!uuid.test(id))throw Error('Choose a saved upload again.')
 await ownerSession(client,owner,current)
 const r=await client.from('data_assist_batches').select('id,submitted_by_user_id,requested_import_type,status,screenshot_count,review_note,rejection_reason,created_at,updated_at').eq('submitted_by_user_id',owner).eq('id',id).limit(2).abortSignal(AbortSignal.timeout(12000))
 await ownerSession(client,owner,current);if(r.error||!Array.isArray(r.data)||r.data.length!==1)throw Error('Refresh saved uploads to find this file.')
 const batch=readImportBatches(r.data,owner).batches[0];if(batch.id!==id)throw Error('Choose the saved upload again.');return batch
}
