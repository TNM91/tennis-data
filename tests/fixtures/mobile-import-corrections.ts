import type {ImportSend} from '../../mobile/src/data-import-actions'
import type {SupabaseClient} from '@supabase/supabase-js'
import {openDataImports} from '../../mobile/src/data-imports-view'
import {applyImportReviewCorrection} from '../../lib/data-assist-review-corrections'
import {reviewScorecard,reviewRoster} from './import-review-data'
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',draftId='33333333-3333-4333-8333-333333333333'
const mode=new URLSearchParams(location.search).get('view')||'scorecard',kind=mode==='roster'?'team_summary':'scorecard'
const state={active:true,posts:0,previews:0,reads:0,impactChanged:false,duplicate:false,last:undefined as unknown,lose:false,stale:false,invalidate:()=>{state.active=false}}
let payload=structuredClone(kind==='scorecard'?reviewScorecard:reviewRoster),status='needs_review',draftStatus='ready_for_verification',outcome={}
const batch=()=>({id,submitted_by_user_id:owner,requested_import_type:kind,status,screenshot_count:1,created_at:'2026-10-29T12:00:00Z',updated_at:'2026-10-29T12:00:00Z'})
const draft=()=>({id:draftId,batch_id:id,submitted_by_user_id:owner,draft_type:kind,status:draftStatus,ocr_status:'processed',parsed_payload:state.stale?{...payload,homeTeam:'Source changed'}:payload,validation_summary:outcome})
const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic-only'}}})},from(table:string){const filters:Record<string,unknown>={},q={select:()=>q,eq:(key:string,value:unknown)=>{filters[key]=value;return q},in:()=>q,like:()=>q,order:()=>q,limit:()=>q,abortSignal:()=>q,then:(resolve:(v:unknown)=>unknown)=>{state.reads++;return Promise.resolve({data:table==='matches'?[{id:'court-1',external_match_id:'1011650664::line:1:singles',match_type:'singles',line_number:1,score:'6-4 6-3',match_players:[{player_id:'player-1',side:'A',seat:1,players:{name:'Alex Lee'}},{player_id:'player-2',side:'B',seat:1,players:{name:'Drew Park'}}]}]:table==='players'?[{id:'player-1',name:filters.name,location:null,flight:null}]:table==='data_assist_batches'?[batch()]:table==='data_assist_drafts'?[draft()]:[{batch_id:id,submitted_by_user_id:owner,file_name:'TennisLink-user-export.xls'}],error:null}).then(resolve)}};return q}} as unknown as SupabaseClient
const send:ImportSend=async options=>{
 const data=options.data,revision=(state.impactChanged?'b':'a').repeat(64)
 if(data.decision==='preview'){
  state.previews++;const corrected=applyImportReviewCorrection(payload,data.reviewCorrection)
  return {status:200,data:{ok:true,impact:{kind,revision,newCount:state.duplicate?0:kind==='scorecard'?1:('players' in corrected?corrected.players.length:0),updateCount:0,duplicateCount:state.duplicate?1:0,courtCount:'lines' in corrected?corrected.lines.length:0,preservedPlayers:0,preservedDetails:0,playerMatches:[]}},headers:{},url:options.url}
 }
 if(data.expectedRevision!==revision)return {status:409,data:{ok:false,code:'preview_changed'},headers:{},url:options.url}
 state.posts++;state.last=data;if(state.lose)throw Error('lost response')
 payload=applyImportReviewCorrection(payload,data.reviewCorrection);status='imported';draftStatus='imported';outcome={importSummary:{...(state.duplicate?{duplicate:true}:{}),importResult:{result:{successCount:2,updatedCount:0,skippedCount:0,failedCount:0}}}}
 return {status:200,data:{ok:true,autoImport:{ok:true}},headers:{},url:options.url}
}
Object.assign(window,{importFixture:state})
document.querySelector('#app')!.innerHTML='<h1>Uploads & imports</h1><button id="open-imports" type="button">Review saved upload</button>'
document.querySelector('#open-imports')!.addEventListener('click',()=>{openDataImports(client,owner,()=>state.active,send)})
