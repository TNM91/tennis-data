import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {prepareNativeImport,saveNativeImport,type UploadIntent} from './data-import-upload'
const kinds={scorecard:'Scorecard',schedule:'Schedule',team_summary:'Team / player roster'}
export function createImportUploader(client:SupabaseClient,owner:string,current:()=>boolean,setBusy:(value:boolean)=>void,onSaved:(id:string)=>Promise<void>){
 let host:HTMLElement|null=null,intent:UploadIntent|null=null,busy=false,picking=false,attempted=false,disposed=false,message='',consent=false
 const active=()=>!disposed&&current()
 const render=()=>{
  if(!host||!active())return
  host.innerHTML='<h2>Add a TennisLink export</h2><p>Choose one scorecard, schedule, Team Summary or Player Roster export from Files. Use Send To Excel (.xls) or the .html export, up to 10 MB.</p>'+(busy?'<p role="status">'+(attempted?'Saving your export…':'Checking your file…')+'</p>':intent?'<dl class="import-fields"><div><dt>File</dt><dd>'+html(intent.file.name)+'</dd></div><div><dt>Detected type</dt><dd>'+kinds[intent.kind]+'</dd></div><div><dt>Size</dt><dd>'+Math.ceil(intent.file.size/1024)+' KB</dd></div></dl><p>Saving stores your export privately. Nothing is read or imported until you choose Read saved file.</p>'+(!attempted?'<label class="import-consent"><input type="checkbox" data-upload-consent '+(consent?'checked':'')+'> This is the correct export to save to my account.</label>':'<p>Resume checks the same upload’s saved steps. It does not start another upload record.</p>')+'<button type="button" class="secondary" data-upload-save '+(!attempted&&!consent?'disabled':'')+'>'+(attempted?'Resume this upload':'Save export')+'</button>'+(!attempted?'<button type="button" class="secondary" data-upload-clear>Choose a different export</button>':''):'<label class="import-file-label">Choose export<input type="file" accept=".xls,.html,application/vnd.ms-excel,text/html" data-upload-file></label>')+'<p role="status">'+html(message)+'</p>'
  const picker=host.querySelector<HTMLInputElement>('[data-upload-file]')
  picker?.addEventListener('click',()=>{picking=true})
  picker?.addEventListener('cancel',()=>{picking=false})
  picker?.addEventListener('change',()=>{picking=false;const files=Array.from(picker.files||[]);if(files.length!==1)return;void choose(files[0])})
  host.querySelector('[data-upload-consent]')?.addEventListener('change',event=>{consent=(event.currentTarget as HTMLInputElement).checked;const button=host?.querySelector<HTMLButtonElement>('[data-upload-save]');if(button)button.disabled=!consent})
  host.querySelector('[data-upload-clear]')?.addEventListener('click',()=>{intent=null;message='';consent=false;render()})
  host.querySelector('[data-upload-save]')?.addEventListener('click',()=>{void save()})
 }
 const choose=async(file:File)=>{
  if(!active()||busy)return;busy=true;message='';consent=false;setBusy(true);render()
  try{const prepared=await prepareNativeImport(file,owner);if(active())intent=prepared}
  catch(cause){if(active())message=cause instanceof Error?cause.message:'This file could not be checked.'}
  finally{if(active()){busy=false;setBusy(false);render();host?.querySelector<HTMLElement>('h2')?.setAttribute('tabindex','-1');host?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})}}
 }
 const save=async()=>{
  if(!active()||busy||!intent||!attempted&&!consent)return
  busy=true;attempted=true;message='';setBusy(true);render()
  try{const result=await saveNativeImport(client,intent,()=>active()&&document.visibilityState==='visible');if(!active())return;message=result.duplicate?'This export was already imported. Opening its saved record.':'Export saved. Opening its saved record; reading has not started.';busy=false;intent=null;attempted=false;consent=false;setBusy(false);render();await onSaved(result.batchId)}
  catch{if(active())message='The save is not fully confirmed. Resume this same upload to check saved steps, or check Saved uploads after reopening. Do not select a new copy to retry.'}
  finally{if(active()&&busy){busy=false;setBusy(false);render()}}
 }
 return {mount(element:HTMLElement){host=element;render()},isPicking:()=>picking,dispose(){disposed=true;host=null;intent=null;consent=false}}
}
