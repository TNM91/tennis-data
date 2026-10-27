import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {prepareNativeImport,saveNativeImport,type UploadIntent} from './data-import-upload'
import {requireScorecardPhotos,pickScorecardPhoto,prepareScorecardPhoto} from './data-import-photos'
const kinds={scorecard:'Scorecard',schedule:'Schedule',team_summary:'Team / player roster'}
export function createImportUploader(client:SupabaseClient,owner:string,current:()=>boolean,setBusy:(value:boolean)=>void,onSaved:(id:string)=>Promise<void>){
 let host:HTMLElement|null=null,intent:UploadIntent|null=null,busy=false,picking=false,attempted=false,disposed=false,message='',consent=false,preview=''
 const active=()=>!disposed&&current()
 const clear=()=>{if(preview)URL.revokeObjectURL(preview);preview='';intent=null;consent=false}
 const render=()=>{
  if(!host||!active())return
  host.innerHTML='<h2>Add tennis data</h2><p>Choose one TennisLink scorecard, schedule or roster export (.xls/.html), up to 10 MB. Or add a clear photo of a complete scorecard.</p>'+(busy?'<p role="status">'+(attempted?'Saving your file…':'Checking your file…')+'</p>':intent?(preview?'<img class="import-photo-preview" src="'+html(preview)+'" alt="Selected scorecard photo"><p>Include the match ID, teams, player names and every court score. Make sure the whole scorecard is readable.</p>':'')+'<dl class="import-fields"><div><dt>File</dt><dd>'+html(intent.file.name)+'</dd></div><div><dt>'+(intent.photo?'Selected type':'Detected type')+'</dt><dd>'+kinds[intent.kind]+(intent.photo?' photo':'')+'</dd></div><div><dt>Size</dt><dd>'+Math.ceil(intent.file.size/1024)+' KB'+(intent.photo?' · '+intent.photo.width+' × '+intent.photo.height:'')+'</dd></div></dl><p>Saving stores your file privately. Nothing is read or imported until you choose Read saved file.</p>'+(!attempted?'<label class="import-consent"><input type="checkbox" data-upload-consent '+(consent?'checked':'')+'> This is the correct '+(intent.photo?'complete scorecard photo':'export')+' to save to my account.</label>':'<p>Resume checks the same upload’s saved steps. It does not start another upload record.</p>')+'<button type="button" class="secondary" data-upload-save '+(!attempted&&!consent?'disabled':'')+'>'+(attempted?'Resume this upload':intent.photo?'Save scorecard photo':'Save export')+'</button>'+(!attempted?'<button type="button" class="secondary" data-upload-clear>Choose a different file</button>':''):'<label class="import-file-label">Choose export<input type="file" accept=".xls,.html,application/vnd.ms-excel,text/html" data-upload-file></label><div class="import-review-actions"><button type="button" class="secondary" data-upload-library>Choose scorecard photo</button><button type="button" class="secondary" data-upload-camera>Take scorecard photo</button></div>')+'<p role="status">'+html(message)+'</p>'
  const picker=host.querySelector<HTMLInputElement>('[data-upload-file]')
  picker?.addEventListener('click',()=>{picking=true})
  picker?.addEventListener('cancel',()=>{picking=false})
  picker?.addEventListener('change',()=>{picking=false;const files=Array.from(picker.files||[]);if(files.length!==1)return;void choose(files[0])})
  host.querySelector('[data-upload-library]')?.addEventListener('click',()=>{void photo('library')})
  host.querySelector('[data-upload-camera]')?.addEventListener('click',()=>{void photo('camera')})
  host.querySelector('[data-upload-consent]')?.addEventListener('change',event=>{consent=(event.currentTarget as HTMLInputElement).checked;const button=host?.querySelector<HTMLButtonElement>('[data-upload-save]');if(button)button.disabled=!consent})
  host.querySelector('[data-upload-clear]')?.addEventListener('click',()=>{clear();message='';render()})
  host.querySelector('[data-upload-save]')?.addEventListener('click',()=>{void save()})
 }
 const finish=()=>{if(active()){busy=false;setBusy(false);render();host?.querySelector<HTMLElement>('h2')?.setAttribute('tabindex','-1');host?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})}}
 const choose=async(file:File)=>{
  if(!active()||busy)return;busy=true;message='';consent=false;setBusy(true);render()
  try{const prepared=await prepareNativeImport(file,owner);if(active())intent=prepared}
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
