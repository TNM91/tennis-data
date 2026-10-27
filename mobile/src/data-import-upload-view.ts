import {prepareBulkScorecards,createScorecardQueue} from './data-import-queue'
import {DATA_ASSIST_MAX_BULK_SCORECARDS} from '../../lib/data-assist-limits'
import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {prepareNativeImport,saveNativeImport,type UploadIntent} from './data-import-upload'
import {requireScorecardPhotos,pickScorecardPhoto,prepareScorecardPhoto} from './data-import-photos'
const kinds={scorecard:'Scorecard',schedule:'Schedule',team_summary:'Team / player roster'}
export function createImportUploader(client:SupabaseClient,owner:string,current:()=>boolean,setBusy:(value:boolean)=>void,onSaved:(id:string)=>Promise<void>){
 let host:HTMLElement|null=null,intent:UploadIntent|null=null,busy=false,picking=false,attempted=false,disposed=false,message='',consent=false,preview=''
 let queue:ReturnType<typeof createScorecardQueue>|null=null
 const active=()=>!disposed&&current()
 const clear=()=>{if(preview)URL.revokeObjectURL(preview);preview='';intent=null;queue=null;consent=false}
 const render=()=>{
  if(!host||!active())return
  host.innerHTML='<h2>Add tennis data</h2><p>Choose up to '+DATA_ASSIST_MAX_BULK_SCORECARDS+' scorecard exports together, or one schedule or roster export (.xls/.html). Each file can be up to 10 MB. Or add a clear photo of a complete scorecard.</p>'+(queue?bulkHtml():busy?'<p role="status">'+(attempted?'Saving your file…':'Checking your file…')+'</p>':intent?(preview?'<img class="import-photo-preview" src="'+html(preview)+'" alt="Selected scorecard photo"><p>Include the match ID, teams, player names and every court score. Make sure the whole scorecard is readable.</p>':'')+'<dl class="import-fields"><div><dt>File</dt><dd>'+html(intent.file.name)+'</dd></div><div><dt>'+(intent.photo?'Selected type':'Detected type')+'</dt><dd>'+kinds[intent.kind]+(intent.photo?' photo':'')+'</dd></div><div><dt>Size</dt><dd>'+Math.ceil(intent.file.size/1024)+' KB'+(intent.photo?' · '+intent.photo.width+' × '+intent.photo.height:'')+'</dd></div></dl><p>Saving stores your file privately. Nothing is read or imported until you choose Read saved file.</p>'+(!attempted?'<label class="import-consent"><input type="checkbox" data-upload-consent '+(consent?'checked':'')+'> This is the correct '+(intent.photo?'complete scorecard photo':'export')+' to save to my account.</label>':'<p>Resume checks the same upload’s saved steps. It does not start another upload record.</p>')+'<button type="button" class="secondary" data-upload-save '+(!attempted&&!consent?'disabled':'')+'>'+(attempted?'Resume this upload':intent.photo?'Save scorecard photo':'Save export')+'</button>'+(!attempted?'<button type="button" class="secondary" data-upload-clear>Choose a different file</button>':''):'<label class="import-file-label">Choose export<input type="file" multiple accept=".xls,.html,application/vnd.ms-excel,text/html" data-upload-file></label><div class="import-review-actions"><button type="button" class="secondary" data-upload-library>Choose scorecard photo</button><button type="button" class="secondary" data-upload-camera>Take scorecard photo</button></div>')+'<p role="status">'+html(message)+'</p>'
  const picker=host.querySelector<HTMLInputElement>('[data-upload-file]')
  picker?.addEventListener('click',()=>{picking=true})
  picker?.addEventListener('cancel',()=>{picking=false})
  picker?.addEventListener('change',()=>{picking=false;const files=Array.from(picker.files||[]);if(!files.length)return;void choose(files)})
  host.querySelector('[data-bulk-consent]')?.addEventListener('change',event=>{consent=(event.currentTarget as HTMLInputElement).checked;const button=host?.querySelector<HTMLButtonElement>('[data-bulk-save]');if(button)button.disabled=!consent})
  host.querySelector('[data-bulk-save]')?.addEventListener('click',()=>{void saveBulk()})
  host.querySelectorAll<HTMLButtonElement>('[data-bulk-resume]').forEach(b=>b.onclick=()=>{void saveBulk(Number(b.dataset.bulkResume))})
  host.querySelectorAll<HTMLButtonElement>('[data-bulk-open]').forEach(b=>b.onclick=()=>{const row=queue?.items[Number(b.dataset.bulkOpen)];if(!busy&&row?.state==='saved')void onSaved(row.batchId)})
  host.querySelector('[data-bulk-clear]')?.addEventListener('click',()=>{if(!busy){clear();message='';render()}})
  host.querySelector('[data-upload-library]')?.addEventListener('click',()=>{void photo('library')})
  host.querySelector('[data-upload-camera]')?.addEventListener('click',()=>{void photo('camera')})
  host.querySelector('[data-upload-consent]')?.addEventListener('change',event=>{consent=(event.currentTarget as HTMLInputElement).checked;const button=host?.querySelector<HTMLButtonElement>('[data-upload-save]');if(button)button.disabled=!consent})
  host.querySelector('[data-upload-clear]')?.addEventListener('click',()=>{clear();message='';render()})
  host.querySelector('[data-upload-save]')?.addEventListener('click',()=>{void save()})
 }
 const bulkHtml=()=>{
  if(!queue)return ''
  const items=queue.items,saved=items.filter(i=>i.state==='saved').length,uncertain=items.some(i=>i.state==='uncertain'),pending=items.some(i=>i.state==='ready')
  return '<section class="import-bulk"><h3>Selected scorecards</h3><p role="status">'+saved+' of '+items.length+' files saved'+(busy?' · Saving…':'')+'</p><p>Saving stores files privately. Open each saved upload to choose Read saved file and check its import outcome. Keep this screen open; closing it clears this queue.</p><ol>'+items.map((row,i)=>'<li><strong>'+html(row.intent.file.name)+'</strong><span>'+Math.ceil(row.intent.file.size/1024)+' KB · '+({ready:'Ready to save',saving:'Saving…',saved:'Saved · open for current status',uncertain:'Save not confirmed'}[row.state])+'</span>'+(row.state==='saved'?'<button type="button" class="secondary" data-bulk-open="'+i+'" '+(busy?'disabled':'')+'>Review file '+(i+1)+'</button>':row.state==='uncertain'?'<p>Resume checks this file’s saved steps using the same upload record.</p><button type="button" class="secondary" data-bulk-resume="'+i+'" '+(busy?'disabled':'')+'>Resume file '+(i+1)+'</button>':'')+'</li>').join('')+'</ol>'+(uncertain?'<p>Resume the unconfirmed file before saving the remaining files. Saved files will not be sent again.</p>':'')+(pending&&!uncertain?'<label class="import-consent"><input type="checkbox" data-bulk-consent '+(consent?'checked':'')+' '+(busy?'disabled':'')+'> These are the correct scorecard exports to save to my account.</label><button type="button" class="secondary" data-bulk-save '+(busy||!consent?'disabled':'')+'>Save remaining scorecards</button>':'')+(!uncertain&&!busy?'<button type="button" class="secondary" data-bulk-clear>Choose other files</button>':'')+'</section>'
 }
 const saveBulk=async(index?:number)=>{
  if(!queue||!active()||busy||index===undefined&&!consent)return
  const selected=queue;busy=true;message='';setBusy(true);render()
  const valid=()=>active()&&document.visibilityState==='visible'
  try{const save=(item:UploadIntent,current:()=>boolean)=>saveNativeImport(client,item,current);if(index===undefined)await selected.saveReady(save,valid,render);else await selected.resume(index,save,valid,render)}
  finally{if(active()){message=selected.items.some(i=>i.state==='uncertain')?'Saving paused. Resume the unconfirmed file to check its saved steps.':selected.items.every(i=>i.state==='saved')?'All selected files are saved. Open each upload to read it and check the result.':'Review the remaining files before saving.';finish()}}
 }
 const finish=()=>{if(active()){busy=false;setBusy(false);render();host?.querySelector<HTMLElement>('h2')?.setAttribute('tabindex','-1');host?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})}}
 const choose=async(files:File[])=>{
  if(!active()||busy)return;busy=true;message='';consent=false;setBusy(true);render()
  try{if(files.length>1){const prepared=await prepareBulkScorecards(files,owner,active);if(active()){clear();queue=createScorecardQueue(prepared)}}else{const prepared=await prepareNativeImport(files[0],owner);if(active()){clear();intent=prepared}}}
  catch(cause){if(active())message=cause instanceof Error?cause.message:'This file could not be checked.'}
  finally{finish()}
 }
 const photo=async(source:'camera'|'library')=>{
  if(!active()||busy)return;busy=true;message='';consent=false;setBusy(true);render()
  try{
   await requireScorecardPhotos(client,owner,()=>active()&&document.visibilityState==='visible')
   if(!active())return;picking=true
   const file=await pickScorecardPhoto(source,active);picking=false
   if(!active())return;const prepared=await prepareScorecardPhoto(file,owner)
   if(active()){clear();intent=prepared;preview=URL.createObjectURL(prepared.file)}
  }catch(cause){if(active())message=cause instanceof Error?cause.message:'Photo selection stopped. Check photo access and try again.'}
  finally{picking=false;finish()}
 }
 const save=async()=>{
  if(!active()||busy||!intent||!attempted&&!consent)return
  busy=true;attempted=true;message='';setBusy(true);render()
  try{const result=await saveNativeImport(client,intent,()=>active()&&document.visibilityState==='visible');if(!active())return;message=result.duplicate?'This export was already imported. Opening its saved record.':'File saved. Opening its saved record; reading has not started.';busy=false;clear();attempted=false;setBusy(false);render();await onSaved(result.batchId)}
  catch{if(active())message='The save is not fully confirmed. Resume this same upload to check saved steps, or check Saved uploads after reopening. Do not select a new copy to retry. If saving stays unavailable, open Data Assist for help.'}
  finally{if(active()&&busy){busy=false;setBusy(false);render()}}
 }
 return {mount(element:HTMLElement){host=element;render()},isPicking:()=>picking,dispose(){disposed=true;host=null;clear()}}
}
