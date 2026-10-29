import type {ImportSend} from '../../mobile/src/data-import-actions'
import type {SupabaseClient} from '@supabase/supabase-js'
import {openDataImports} from '../../mobile/src/data-imports-view'
import {applyImportReviewCorrection} from '../../lib/data-assist-review-corrections'
import {reviewScorecard,reviewRoster} from './import-review-data'
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',draftId='33333333-3333-4333-8333-333333333333'
const mode=new URLSearchParams(location.search).get('view')||'scorecard',kind=mode==='roster'?'team_summary':'scorecard'
const state={active:true,posts:0,reads:0,last:undefined as unknown,lose:false,stale:false,invalidate:()=>{state.active=false}}
let payload=structuredClone(kind==='scorecard'?reviewScorecard:reviewRoster),status='needs_review',draftStatus='ready_for_verification',outcome={}
const batch=()=>({id,submitted_by_user_id:owner,requested_import_type:kind,status,screenshot_count:1,created_at:'2026-10-29T12:00:00Z',updated_at:'2026-10-29T12:00:00Z'})
const draft=()=>({id:draftId,batch_id:id,submitted_by_user_id:owner,draft_type:kind,status:draftStatus,ocr_status:'processed',parsed_payload:state.stale?{...payload,homeTeam:'Source changed'}:payload,validation_summary:outcome})
const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic-only'}}})},from(table:string){const filters:Record<string,unknown>={},q={select:()=>q,eq:(key:string,value:unknown)=>{filters[key]=value;return q},in:()=>q,order:()=>q,limit:()=>q,abortSignal:()=>q,then:(resolve:(v:unknown)=>unknown)=>{state.reads++;return Promise.resolve({data:table==='data_assist_batches'?[batch()]:table==='data_assist_drafts'?[draft()]:[{batch_id:id,submitted_by_user_id:owner,file_name:'TennisLink-user-export.xls'}],error:null}).then(resolve)}};return q}} as unknown as SupabaseClient
const send:ImportSend=async options=>{state.posts++;state.last=options.data;if(state.lose)throw Error('lost response');const data=options.data;payload=applyImportReviewCorrection(payload,data.reviewCorrection);status='imported';draftStatus='imported';outcome={importSummary:{importResult:{result:{successCount:kind==='scorecard'?2:2,updatedCount:0,skippedCount:0,failedCount:0}}}};return {status:200,data:{ok:true,autoImport:{ok:true}},headers:{},url:options.url}}
Object.assign(window,{importFixture:state})
document.querySelector('#app')!.innerHTML='<h1>Uploads & imports</h1><button id="open-imports" type="button">Review saved upload</button>'
document.querySelector('#open-imports')!.addEventListener('click',()=>{openDataImports(client,owner,()=>state.active,send)})
