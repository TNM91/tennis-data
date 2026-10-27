import type {SupabaseClient} from '@supabase/supabase-js'
import {detectImportTypeFromFile} from '../../lib/data-assist-export-detection'
import {buildFileFingerprint} from '../../lib/data-assist-file-fingerprint'
import type {ImportKind} from './data-imports-data'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const bucket='data-assist-screenshots'
async function uploadWithinDeadline<T>(work:Promise<T>):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined
 try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Upload result not confirmed. Resume the same upload.')),45000)})])}finally{clearTimeout(timer)}
}
export type UploadIntent={owner:string;batchId:string;draftId:string;screenshotId:string;file:File;kind:ImportKind;fingerprint:string;extension:string;mime:string}
export async function prepareNativeImport(file:File,owner:string):Promise<UploadIntent>{
 if(!uuid.test(owner))throw Error('Sign in again before choosing a file.')
 if(!file.size||file.size>10*1024*1024)throw Error('Choose a non-empty TennisLink export, 10 MB or smaller.')
 const extension=file.name.split('.').pop()?.toLowerCase()||''
 if(!['xls','html'].includes(extension))throw Error('Choose the TennisLink Send To Excel .xls export or its .html export. Use Data Assist in your browser for photos or help with other formats.')
 const kind=await detectImportTypeFromFile(file)
 if(!kind)throw Error('This export was not recognized. Use a TennisLink scorecard, schedule, Team Summary or Player Roster export.')
 return {owner,batchId:crypto.randomUUID(),draftId:crypto.randomUUID(),screenshotId:crypto.randomUUID(),file,kind,fingerprint:await buildFileFingerprint(file),extension,mime:['application/vnd.ms-excel','application/octet-stream','text/html'].includes(file.type)?file.type:extension==='xls'?'application/vnd.ms-excel':'text/html'}
}
export async function saveNativeImport(client:SupabaseClient,intent:UploadIntent,current:()=>boolean):Promise<{batchId:string;duplicate:boolean}>{
 const {owner,batchId,draftId,screenshotId,file,kind,fingerprint,mime,extension}=intent
 if(![owner,batchId,draftId,screenshotId].every(v=>uuid.test(v))||!['scorecard','schedule','team_summary'].includes(kind)||!['xls','html'].includes(extension)||!file.size||file.size>10*1024*1024||!/^[a-f0-9]{24}-\d+$/.test(fingerprint))throw Error('Choose the export again.')
 const own=async()=>{if(!current())throw Error('This upload is no longer open.');const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw Error('Close this upload and sign in again.')}
 const check=(error:unknown)=>{if(error)throw Error('The save could not be confirmed. Resume this same upload to check the saved steps; no import was started.')}
 const one=async(table:string,filters:Record<string,string>,columns:string)=>{await own();let q=client.from(table).select(columns).eq('submitted_by_user_id',owner);for(const [key,value] of Object.entries(filters))q=q.eq(key,value);const r=await q.limit(2).abortSignal(AbortSignal.timeout(12000));await own();check(r.error);if(!Array.isArray(r.data)||r.data.length>1)throw Error('This upload needs review in Data Assist.');const row:unknown=r.data[0];if(row!=null&&(typeof row!=='object'||Array.isArray(row)))throw Error('This saved upload needs review.');return row as Record<string,unknown>|undefined}
 const insert=async(table:string,row:Record<string,unknown>)=>{await own();const r=await client.from(table).insert(row).abortSignal(AbortSignal.timeout(20000));await own();check(r.error)}
 await own()
 // Match the website's bounded imported-file reuse for schedules and rosters.
 if(kind!=='scorecard'){
  const r=await client.from('data_assist_screenshots').select('batch_id').eq('submitted_by_user_id',owner).eq('client_fingerprint',fingerprint).eq('file_size_bytes',file.size).eq('mime_type',mime).order('created_at',{ascending:false}).limit(20).abortSignal(AbortSignal.timeout(12000));await own();check(r.error)
  const ids=Array.from(new Set((r.data||[]).map((v:{batch_id:string})=>v.batch_id))).filter(v=>uuid.test(v))
  if(ids.length){const b=await client.from('data_assist_batches').select('id').in('id',ids).eq('submitted_by_user_id',owner).eq('requested_import_type',kind).eq('status','imported').limit(20).abortSignal(AbortSignal.timeout(12000));await own();check(b.error);const found=ids.find(id=>(b.data||[]).some((v:{id:string})=>v.id===id));if(found){const d=await one('data_assist_drafts',{batch_id:found},'id,parsed_payload,validation_summary');const parsed=d?.parsed_payload as {rosterSource?:string}|undefined,validation=d?.validation_summary as {importSummary?:{contactOnly?:boolean}}|undefined;if(d&&!(kind==='team_summary'&&parsed?.rosterSource==='player_roster'&&validation?.importSummary?.contactOnly===true))return {batchId:found,duplicate:true}}}
 }
 const layout='tennislink_'+kind
 const batch=await one('data_assist_batches',{id:batchId},'id,requested_import_type,screenshot_count')
 if(batch&&(batch.requested_import_type!==kind||batch.screenshot_count!==1))throw Error('This saved upload does not match the selected file.')
 if(!batch)await insert('data_assist_batches',{id:batchId,submitted_by_user_id:owner,source_system:'tennislink',requested_import_type:kind,detected_layout:layout,status:'layout_detected',screenshot_count:1,confidence_score:0.98,rejection_reason:'',contribution_value:'TennisLink export saved for reading and review.'})
 const path=owner+'/'+batchId+'/01-'+fingerprint+'.'+extension
 const screenshot=await one('data_assist_screenshots',{id:screenshotId,batch_id:batchId},'id,storage_path,client_fingerprint,file_size_bytes')
 if(screenshot&&(screenshot.storage_path!==path||screenshot.client_fingerprint!==fingerprint||screenshot.file_size_bytes!==file.size))throw Error('The saved source file changed. Open Data Assist for review.')
 if(!screenshot){
  await own();const stored=await client.storage.from(bucket).list(owner+'/'+batchId,{limit:2,search:'01-'+fingerprint+'.'+extension});await own();check(stored.error)
  const existing=stored.data?.find(v=>v.name==='01-'+fingerprint+'.'+extension)
  if(existing&&Number(existing.metadata?.size)!==file.size)throw Error('The saved source file needs review in Data Assist.')
  if(!existing){await own();const upload=await uploadWithinDeadline(client.storage.from(bucket).upload(path,file,{upsert:false,cacheControl:'3600',contentType:mime}));await own();check(upload.error)}
  await insert('data_assist_screenshots',{id:screenshotId,batch_id:batchId,submitted_by_user_id:owner,upload_order:1,file_name:file.name,mime_type:mime,file_size_bytes:file.size,image_width:null,image_height:null,client_fingerprint:fingerprint,detection_status:'supported',detected_layout:layout,confidence_score:0.98,visual_signals:['TennisLink Excel export','HTML table export'],rejection_reason:'',storage_bucket:bucket,storage_path:path,storage_uploaded_at:new Date().toISOString()})
 }
 const draft=await one('data_assist_drafts',{batch_id:batchId},'id,draft_type')
 if(draft&&(draft.id!==draftId||draft.draft_type!==kind))throw Error('This saved draft needs review in Data Assist.')
 if(!draft)await insert('data_assist_drafts',{id:draftId,batch_id:batchId,submitted_by_user_id:owner,draft_type:kind,status:'needs_review',confidence_score:0.98,validation_summary:{message:'Supported TennisLink export saved. Reading has not started.',screenshotCount:1,visualSignals:['TennisLink Excel export','HTML table export']},parsed_payload:{},impact_summary:{value:'Saved for reading and review.'},ocr_status:'not_started',external_match_id:'',home_team:'',away_team:'',match_date:'',line_count:0,parser_warnings:[]})
 await own();return {batchId,duplicate:false}
}
