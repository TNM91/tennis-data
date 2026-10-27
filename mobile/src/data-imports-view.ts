import {scheduleReady,type ScheduleDates} from './data-import-schedule'
import {createImportUploader} from './data-import-upload-view'
import {actOnImport,availableImportActions,type ImportAction} from './data-import-actions'
import {Browser} from '@capacitor/browser'
import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {DATA_ASSIST_URL,loadImportBatch,loadImportBatches,loadImportDetail,type ImportBatch,type ImportDetail} from './data-imports-data'

const labels:Record<string,string>={uploaded:'Uploaded',layout_detected:'File recognized',needs_review:'Needs review',ready_to_import:'Ready to import',rejected:'Not accepted',verified:'Confirmed',imported:'Imported',blocked:'Blocked',ready_for_verification:'Ready to review'}
const kindLabel={scorecard:'Scorecard',schedule:'Schedule',team_summary:'Team / player roster'}
const label=(s:string)=>labels[s]||s.replaceAll('_',' ')
const stamp=(s:string)=>new Date(s).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})
const values=(items:Array<[string,string]>)=>'<dl class="import-fields">'+items.map(([k,v])=>'<div><dt>'+html(k)+'</dt><dd>'+html(v||'Not recorded')+'</dd></div>').join('')+'</dl>'
export function importDetailHtml(batch:ImportBatch,detail:ImportDetail|null){
 return '<h2>'+html(kindLabel[batch.kind])+'</h2>'+values([['Upload status at last refresh',label(batch.status)],['Uploaded',stamp(batch.created)],['Source files',String(batch.files)]])+(!detail?(batch.note?'<p>'+html(batch.note)+'</p>':'')+'<p>No saved draft is available yet. Refresh uploads or open Data Assist to check this file.</p>':values([['Saved draft status',label(detail.status)],['Reading status',label(detail.ocr||'not_started')],...detail.context])+(detail.notes.length?'<h3>Review notes</h3><ul>'+detail.notes.map(n=>'<li>'+html(n)+'</li>').join('')+'</ul>':'<p>No review notes in this preview.</p>')+(detail.outcome.length?'<h3>Recorded import outcome</h3>'+values(detail.outcome):'')+'<h3>Saved extracted rows</h3><p>'+detail.total+' saved row'+(detail.total===1?'':'s')+(detail.total>100?' · showing the first 100':'')+'. These are extracted values; the saved import status shows whether they were imported.</p>'+(detail.rows.length?detail.rows.map(row=>'<details class="import-row"><summary>'+html(row.title)+'</summary>'+values(row.values)+'</details>').join(''):'<p>No extracted rows are saved yet.</p>'))
}
export function openDataImports(client:SupabaseClient,owner:string,current:()=>boolean){
 const dialog=document.createElement('dialog');dialog.className='data-imports-dialog';dialog.setAttribute('aria-label','Uploads and imports')
 const previous=document.activeElement as HTMLElement|null
 let disposed=false,busy=false,version=0,loaded=false,limited=false,batches:ImportBatch[]=[],selected:ImportBatch|null=null,detail:ImportDetail|null=null,notice='',failed=false,filter='all',returnId='',actionLocked=false,actionMessage=''
 let dates:ScheduleDates={}
 const active=()=>!disposed&&current()&&dialog.isConnected
 const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
 const dispose=()=>{if(disposed)return;disposed=true;uploader.dispose();version++;document.removeEventListener('visibilitychange',visibility);dialog.remove();batches=[];selected=null;detail=null;if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const back=()=>{if(!active())return false;if(busy)return true;if(selected){version++;busy=false;selected=null;detail=null;notice='';failed=false;actionMessage='';actionLocked=false;render();dialog.querySelector<HTMLElement>('[data-import-id="'+returnId+'"]')?.focus();return true}dispose();return true}
 const visibility=()=>{if(document.visibilityState==='hidden'&&!uploader.isPicking())dispose()}
 const read=async(batch?:ImportBatch,fresh=false)=>{
  if(!active()||busy)return;const visit=++version;busy=true;failed=false;notice=batch?'Loading saved draft…':'Loading your uploads…';selected=batch||null;detail=null;dates={};render();focus()
  const valid=()=>active()&&version===visit
  try{if(batch){if(fresh){batch=await loadImportBatch(client,owner,batch.id,valid);if(!valid())return;selected=batch}const result=await loadImportDetail(client,batch,valid);if(!valid())return;detail=result;actionLocked=false}else{const result=await loadImportBatches(client,owner,valid);if(!valid())return;batches=result.batches;limited=result.limited;loaded=true}notice=''}
  catch(cause){if(!valid())return;failed=true;notice=cause instanceof Error?cause.message:'Uploads are unavailable. Try again.'}
  finally{if(valid()){busy=false;render();focus()}}
 }
 const perform=async(action:ImportAction)=>{
  if(!active()||busy||actionLocked||!selected||!detail)return
  if(action!=='flagged'&&!dialog.querySelector<HTMLInputElement>('[data-import-consent]')?.checked)return
  const batch=selected,saved=detail,visit=++version;busy=true;actionLocked=true;actionMessage='';notice=action==='read'?'Reading saved file…':'Saving your review…';render();focus()
  const valid=()=>active()&&visit===version
  try{actionMessage=await actOnImport(client,owner,valid,batch,saved,action,undefined,dates);if(!valid())return;const refreshed=await loadImportBatch(client,owner,batch.id,valid);if(!valid())return;selected=refreshed;detail=await loadImportDetail(client,refreshed,valid);if(!valid())return;notice='';}
  catch(cause){if(valid())notice=cause instanceof Error?cause.message:'Refresh this upload to check its status.'}
  finally{if(valid()){busy=false;render();focus()}}
 }
 const uploader=createImportUploader(client,owner,active,value=>{busy=value;render()},async id=>{
  if(!active())return;const visit=++version;busy=true;notice='Opening saved upload…';render()
  const valid=()=>active()&&version===visit
  try{const batch=await loadImportBatch(client,owner,id,valid);if(!valid())return;busy=false;returnId=batch.id;await read(batch)}
  catch{if(valid()){notice='Export save reported complete. Load saved uploads to check its current status.';busy=false;render()}}
 })
 const render=()=>{
  if(!active())return
  const visible=batches.filter(b=>filter==='all'||filter==='imported'&&b.status==='imported'||filter==='review'&&['needs_review','rejected'].includes(b.status)||filter==='pending'&&!['imported','needs_review','rejected'].includes(b.status))
  dialog.innerHTML='<h1 tabindex="-1">Uploads & imports</h1><p>Review your saved tennis data and import status.</p>'+(selected?'<button type="button" class="secondary" data-import-back '+(busy?'disabled':'')+'>Back to uploads</button>':'')+'<p role="status">'+html(notice||actionMessage)+'</p>'+(selected?!busy&&!failed?importDetailHtml(selected,detail)+(detail?importActionHtml(selected,detail,actionLocked,dates):'')+'<button type="button" class="secondary" data-import-refresh-draft>Refresh saved draft</button>':'':(loaded?'<label>Show uploads<select data-import-filter><option value="all">All uploads</option><option value="review">Needs review / not accepted</option><option value="pending">Not yet imported</option><option value="imported">Imported</option></select></label><p>'+(limited?'Latest 40 uploads. Older uploads are available in Data Assist.':batches.length+' saved upload'+(batches.length===1?'':'s')+' loaded.')+'</p><ul class="import-history">'+visible.map(b=>'<li><h2>'+html(kindLabel[b.kind])+'</h2><p>'+html(label(b.status))+' · '+html(stamp(b.created))+'</p><button type="button" class="secondary" data-import-id="'+html(b.id)+'">View '+html(kindLabel[b.kind].toLowerCase())+' upload</button></li>').join('')+'</ul>'+(!visible.length?'<p>'+(batches.length?'No loaded uploads match this filter.':'No saved uploads were found for this account.')+'</p>':''):'')+'<button type="button" class="secondary" data-import-refresh '+(busy?'disabled':'')+'>'+(loaded?'Refresh uploads':'Load my uploads')+'</button>')+(failed&&selected?'<button type="button" class="secondary" data-import-retry>Retry saved draft</button>':'')+(!selected?'<section data-import-upload></section>':'')+'<section><h2>Upload or finish review</h2><p>Use Data Assist for scorecards, schedules, Team Summary and Player Roster exports. Some high-confidence files can import automatically after reading. Check the outcome in Saved uploads.</p><p>Other corrections open TenAceIQ in your browser. You may need to sign in there.</p><button type="button" class="secondary" data-import-web>Open Data Assist</button><p role="status" data-import-web-status></p></section><button type="button" class="secondary" data-import-close '+(busy?'disabled':'')+'>Close uploads</button>'
  const uploadHost=dialog.querySelector<HTMLElement>('[data-import-upload]');if(uploadHost)uploader.mount(uploadHost)
  dialog.querySelector<HTMLSelectElement>('[data-import-filter]')?.addEventListener('change',event=>{filter=(event.currentTarget as HTMLSelectElement).value;render();dialog.querySelector<HTMLSelectElement>('[data-import-filter]')?.focus()})
  const select=dialog.querySelector<HTMLSelectElement>('[data-import-filter]');if(select)select.value=filter
  dialog.querySelector('[data-import-refresh-draft]')?.addEventListener('click',()=>{if(selected)void read(selected,true)})
  dialog.querySelectorAll<HTMLInputElement>('[data-schedule-date]').forEach(input=>{
   input.value=dates[input.dataset.scheduleDate!]||''
   input.addEventListener('input',()=>{
    dates[input.dataset.scheduleDate!]=input.value
    const consent=dialog.querySelector<HTMLInputElement>('[data-import-consent]');if(consent)consent.checked=false
    dialog.querySelectorAll<HTMLButtonElement>('[data-import-action=confirmed]').forEach(button=>button.disabled=true)
    const status=dialog.querySelector('[data-schedule-status]');if(status&&detail?.schedule)status.textContent=scheduleReady(detail.schedule,dates)?'Dates are ready. Check every match, then confirm below.':'Finish highlighted dates. Other missing details need review in Data Assist.'
   })
  })
  dialog.querySelector('[data-import-consent]')?.addEventListener('change',event=>{const checked=(event.currentTarget as HTMLInputElement).checked;dialog.querySelectorAll<HTMLButtonElement>('[data-import-action]:not([data-import-action=flagged])').forEach(button=>button.disabled=!checked||(button.dataset.importAction==='confirmed'&&selected?.kind==='schedule'&&(!detail?.schedule||!scheduleReady(detail.schedule,dates))))})
  dialog.querySelectorAll<HTMLButtonElement>('[data-import-action]').forEach(button=>button.onclick=()=>{void perform(button.dataset.importAction as ImportAction)})
  dialog.querySelector('[data-import-back]')?.addEventListener('click',back)
  dialog.querySelector('[data-import-close]')?.addEventListener('click',()=>{if(!busy)dispose()})
  dialog.querySelector('[data-import-refresh]')?.addEventListener('click',()=>{void read()})
  dialog.querySelector('[data-import-retry]')?.addEventListener('click',()=>{if(selected)void read(selected,true)})
  dialog.querySelectorAll<HTMLButtonElement>('[data-import-id]').forEach(b=>b.onclick=()=>{const batch=batches.find(r=>r.id===b.dataset.importId);if(batch){returnId=batch.id;void read(batch)}})
  dialog.querySelector<HTMLButtonElement>('[data-import-web]')!.onclick=async event=>{
   const button=event.currentTarget as HTMLButtonElement;button.disabled=true
   try{if(!active())return;await Browser.open({url:DATA_ASSIST_URL})}catch{if(active())dialog.querySelector('[data-import-web-status]')!.textContent='Could not open Data Assist. Check your connection and try again.'}finally{if(active())button.disabled=false}
  }
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();back()});document.addEventListener('visibilitychange',visibility);document.body.append(dialog);render();dialog.showModal();focus()
 return {dispose,back,isOpen:()=>active()}
}

export function importActionHtml(batch:ImportBatch,detail:ImportDetail,locked=false,dates:ScheduleDates={}){
 if(locked)return '<p>Refresh the saved draft before taking another action.</p>'
 const actions=availableImportActions(batch,detail)
 if(!actions.length)return ''
 const reading=actions.includes('read')
 const editing=!reading&&batch.kind==='schedule'&&detail.schedule
 const dateFields=editing?'<div class="import-schedule-dates">'+detail.schedule!.matches.map((m,i)=>m.reviewNotes.includes('Check date')?'<label>Match '+(i+1)+' · '+html(m.homeTeam)+' vs '+html(m.awayTeam)+'<span>Confirm date</span><input type="date" min="2000-01-01" max="2099-12-31" data-schedule-date="'+i+'"></label>':'').join('')+'</div><p role="status" data-schedule-status>'+ (scheduleReady(detail.schedule!,dates)?'Dates are ready. Check every match, then confirm below.':'Finish highlighted dates. Other missing details need review in Data Assist.')+'</p>':''
 return '<section class="import-review"><h3>'+ (reading?'Read saved file':'Review extracted data')+'</h3><p>'+ (reading?'Reading uses the same rules as Data Assist. A high-confidence file may import automatically.':'Check the teams, dates, player names and scores above. Confirming can immediately import these records. '+(editing?'Correct highlighted dates below. Other corrections open Data Assist.':'Use Data Assist in your browser for corrections.'))+'</p>'+dateFields+ (actions.some(a=>a!=='flagged')?'<label class="import-consent"><input type="checkbox" data-import-consent> '+(reading?'I understand this may import the saved file.':'I checked all extracted rows and want to confirm this import.')+'</label>':'')+'<div class="import-review-actions">'+actions.map(a=>'<button type="button" class="secondary" data-import-action="'+a+'" '+(a==='flagged'?'':'disabled')+'>'+(a==='read'?'Read saved file':a==='confirmed'?'Confirm reviewed data':'Flag incorrect data')+'</button>').join('')+'</div></section>'
}
