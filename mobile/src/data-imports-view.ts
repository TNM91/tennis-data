import {importOutcomeHtml} from './data-import-outcome'
import {loadImportSources,loadImportSourcePhoto,importSourcesHtml,type ImportSource} from './data-import-sources'
import {IMPORT_HISTORY_LIMIT,appendImportHistory,filterImportHistory,importHistoryCursor} from './data-import-history'
import {createScheduleCalendar,scheduleCalendarHtml} from './data-import-calendar'
import {createScorecardReader} from './data-import-reading'
import {readingControlsHtml} from './data-import-reading-view'
import {canSelectSavedScorecard,selectSavedScorecard,selectedSavedScorecards} from './data-import-history-selection'
import {DATA_ASSIST_MAX_BULK_SCORECARDS} from '../../lib/data-assist-limits'
import {scheduleReady,scheduleCorrectionFields,canCorrectScheduleField,type ScheduleDates,type ScheduleCorrections,type ScheduleCorrectionField} from './data-import-schedule'
import {createImportUploader} from './data-import-upload-view'
import {actOnImport,availableImportActions,type ImportAction} from './data-import-actions'
import {Browser} from './native-browser'
import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {DATA_ASSIST_URL,loadImportBatch,loadImportBatches,loadImportDetail,type ImportBatch,type ImportDetail} from './data-imports-data'

const labels:Record<string,string>={uploaded:'Uploaded',layout_detected:'File recognized',needs_review:'Needs review',ready_to_import:'Ready to import',rejected:'Not accepted',verified:'Confirmed',imported:'Imported',blocked:'Blocked',ready_for_verification:'Ready to review'}
const kindLabel={scorecard:'Scorecard',schedule:'Schedule',team_summary:'Team / player roster'}
const label=(s:string)=>labels[s]||s.replaceAll('_',' ')
const stamp=(s:string)=>new Date(s).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})
const values=(items:Array<[string,string]>)=>'<dl class="import-fields">'+items.map(([k,v])=>'<div><dt>'+html(k)+'</dt><dd>'+html(v||'Not recorded')+'</dd></div>').join('')+'</dl>'
export function importDetailHtml(batch:ImportBatch,detail:ImportDetail|null){
 return '<h2>'+html(kindLabel[batch.kind])+'</h2>'+importOutcomeHtml(batch,detail)+values([['Upload status at last refresh',label(batch.status)],['Uploaded',stamp(batch.created)],['Source files',String(batch.files)]])+(!detail?(batch.note?'<p>'+html(batch.note)+'</p>':'')+'<p>No saved draft is available yet. Refresh uploads or open Data Assist to check this file.</p>':values([['Saved draft status',label(detail.status)],['Reading status',label(detail.ocr||'not_started')],...detail.context])+(detail.notes.length?'<h3>Review notes</h3><ul>'+detail.notes.map(n=>'<li>'+html(n)+'</li>').join('')+'</ul>':'<p>No review notes in this preview.</p>')+'<h3>Saved extracted rows</h3><p>'+detail.total+' saved row'+(detail.total===1?'':'s')+(detail.total>100?' · showing the first 100':'')+'. These are extracted values; the saved import status shows whether they were imported.</p>'+(detail.rows.length?detail.rows.map(row=>'<details class="import-row"><summary>'+html(row.title)+'</summary>'+values(row.values)+'</details>').join(''):'<p>No extracted rows are saved yet.</p>'))
}
export function openDataImports(client:SupabaseClient,owner:string,current:()=>boolean){
 const dialog=document.createElement('dialog');dialog.className='data-imports-dialog';dialog.setAttribute('aria-label','Uploads and imports')
 const previous=document.activeElement as HTMLElement|null
 let disposed=false,busy=false,version=0,loaded=false,limited=false,batches:ImportBatch[]=[],selected:ImportBatch|null=null,detail:ImportDetail|null=null,notice='',failed=false,filter='all',returnId='',actionLocked=false,actionMessage=''
 let dates:ScheduleDates={},corrections:ScheduleCorrections={},checkedUploads=new Set<string>(),historyReader:ReturnType<typeof createScorecardReader>|null=null,historyConsent=false,namesUnavailable=false
 let calendar:ReturnType<typeof createScheduleCalendar>|null=null
 const calendarRuns=new Map<string,ReturnType<typeof createScheduleCalendar>>()
 let historyQuery='',historyKind='all',historyBatchMetadata:ImportBatch[]=[]
 let sourceAbort:AbortController|null=null
 let sources:ImportSource[]|null=null,sourcePhoto:{id:string;url:string;zoom?:boolean}|null=null
 const clearSourcePhoto=()=>{if(sourcePhoto)URL.revokeObjectURL(sourcePhoto.url);sourcePhoto=null}
 const clearSources=()=>{sourceAbort?.abort();sourceAbort=null;clearSourcePhoto();sources=null}
 const unconfirmedReads=new Set<string>()
 const active=()=>!disposed&&current()&&dialog.isConnected
 const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
 const dispose=()=>{if(disposed)return;disposed=true;uploader.dispose();clearSources();calendarRuns.clear();calendar=null;unconfirmedReads.clear();checkedUploads.clear();historyBatchMetadata=[];historyReader=null;version++;document.removeEventListener('visibilitychange',visibility);dialog.remove();batches=[];selected=null;detail=null;if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const back=()=>{if(!active())return false;if(busy)return true;if(selected){clearSources();version++;busy=false;selected=null;detail=null;notice='';failed=false;actionMessage='';actionLocked=false;render();dialog.querySelector<HTMLElement>('[data-history-open="'+returnId+'"]')?.focus();dialog.querySelector<HTMLElement>('[data-import-id="'+returnId+'"]')?.focus();return true}dispose();return true}
 const visibility=()=>{if(document.visibilityState==='hidden'&&!uploader.isPicking())dispose()}
 const read=async(batch?:ImportBatch,fresh=false)=>{
  if(!active()||busy)return;clearSources();const visit=++version;busy=true;failed=false;notice=batch?'Loading saved draft…':'Loading your uploads…';selected=batch||null;detail=null;calendar=null;dates={};corrections={};render();focus()
  const valid=()=>active()&&version===visit
  try{if(batch){if(fresh){batch=await loadImportBatch(client,owner,batch.id,valid);if(!valid())return;selected=batch}const result=await loadImportDetail(client,batch,valid);if(!valid())return;detail=result;calendar=calendarRuns.get(batch.id)||null;actionLocked=false}else{const result=await loadImportBatches(client,owner,valid);if(!valid())return;batches=result.batches;limited=result.limited;namesUnavailable=result.namesUnavailable;loaded=true;if(!historyReader)checkedUploads=new Set(batches.filter(b=>checkedUploads.has(b.id)&&canSelectSavedScorecard(b)).map(b=>b.id))}notice=''}
  catch(cause){if(!valid())return;failed=true;notice=cause instanceof Error?cause.message:'Uploads are unavailable. Try again.'}
  finally{if(valid()){busy=false;render();focus()}}
 }
 const perform=async(action:ImportAction)=>{
  if(!active()||busy||actionLocked||!selected||!detail)return
  if(action!=='flagged'&&!dialog.querySelector<HTMLInputElement>('[data-import-consent]')?.checked)return
  const batch=selected,saved=detail,visit=++version;busy=true;actionLocked=true;actionMessage='';notice=action==='read'?'Reading saved file…':'Saving your review…';render();focus()
  const valid=()=>active()&&visit===version
  try{actionMessage=await actOnImport(client,owner,valid,batch,saved,action,undefined,dates,corrections);if(!valid())return;const refreshed=await loadImportBatch(client,owner,batch.id,valid);if(!valid())return;selected=refreshed;detail=await loadImportDetail(client,refreshed,valid);if(!valid())return;notice='';}
  catch(cause){if(valid())notice=cause instanceof Error?cause.message:'Refresh this upload to check its status.'}
  finally{if(valid()){busy=false;render();focus()}}
 }
 const sourceAction=async(id?:string)=>{
  if(!selected||busy||!active())return
  const batch=selected,source=sources?.find(s=>s.id===id),visit=++version;busy=true;clearSourcePhoto();notice=id?'Opening private source photo…':'Loading saved source files…';render()
  const valid=()=>active()&&version===visit
  try{if(id){if(!source)throw Error('Reload source files before opening this photo.');sourceAbort=new AbortController();const file=await loadImportSourcePhoto(client,batch,source,valid,undefined,sourceAbort.signal);if(!valid())return;sourcePhoto={id:source.id,url:URL.createObjectURL(file)}}else{sources=await loadImportSources(client,batch,valid)}if(valid())notice=''}
  catch(cause){if(valid())notice=cause instanceof Error?cause.message:'Source preview unavailable.'}
  finally{sourceAbort=null;if(valid()){busy=false;render();dialog.querySelector<HTMLElement>('[data-import-sources-heading]')?.focus({preventScroll:true})}}
 }
 const older=async()=>{
  if(!active()||busy||!limited||!batches.length||batches.length>=IMPORT_HISTORY_LIMIT)return
  const visit=++version;busy=true;notice='Loading older uploads…';render()
  const valid=()=>active()&&version===visit
  try{const cursor=importHistoryCursor(batches[batches.length-1]);const result=await loadImportBatches(client,owner,valid,cursor);if(!valid())return;batches=appendImportHistory(batches,result.batches);limited=result.limited;namesUnavailable=namesUnavailable||result.namesUnavailable;notice='Older uploads loaded.'}
  catch(cause){if(valid())notice=cause instanceof Error?cause.message:'Older uploads are unavailable. Try again.'}
  finally{if(valid()){busy=false;render();const button=dialog.querySelector<HTMLButtonElement>('[data-import-older]');(button&&!button.disabled?button:dialog.querySelector<HTMLElement>('[data-import-refresh]'))?.focus({preventScroll:true})}}
 }
 const calendarAction=async(check:boolean)=>{
  if(!calendar||busy||!active()||!check&&!dialog.querySelector<HTMLInputElement>('[data-import-calendar-consent]')?.checked)return
  const controller=calendar,visit=++version;busy=true;notice=check?'Checking your saved calendar dates…':'Saving personal calendar dates…';render()
  const valid=()=>active()&&version===visit
  try{if(check){const found=await controller.check();if(valid())notice=found?'Matching personal dates are saved.':'Matching dates could not be confirmed. No new save was sent.'}else{await controller.save();if(valid())notice='Personal calendar dates saved. Team availability and schedule import status are unchanged.'}}
  catch(cause){if(valid())notice=cause instanceof Error?cause.message:'Calendar unavailable. Check saved dates before trying again.'}
  finally{if(valid()){busy=false;render();dialog.querySelector<HTMLElement>('[data-import-calendar-heading]')?.focus({preventScroll:true})}}
 }
 const openSaved=async(id:string)=>{
  if(!active()||busy)return;const visit=++version;busy=true;notice='Opening saved upload…';render()
  const valid=()=>active()&&version===visit
  try{const batch=await loadImportBatch(client,owner,id,valid);if(!valid())return;busy=false;returnId=batch.id;await read(batch)}
  catch{if(valid()){notice='Could not open this saved upload. Refresh uploads to check its current status.';busy=false;render()}}
 }
 const uploader=createImportUploader(client,owner,active,value=>{busy=value;render()},openSaved,unconfirmedReads,()=>!busy)
 const runHistory=async(refresh:boolean)=>{
  if(!historyReader||!active()||busy||!refresh&&(!historyConsent||!historyReader.canRead()))return
  const reader=historyReader,visit=++version;busy=true;historyConsent=false;notice=refresh?'Checking selected outcomes…':'Reading selected scorecards…';render()
  const valid=()=>active()&&version===visit&&document.visibilityState==='visible'
  try{if(refresh)await reader.refresh(valid,render);else await reader.readRemaining(valid,render)}
  finally{if(valid()){busy=false;notice='Check the saved outcome for each selected file. Open any file that needs review.';render();focus()}}
 }
 const render=()=>{
  if(!active())return
  const visible=filterImportHistory(batches,filter,historyKind,historyQuery)
  dialog.innerHTML='<h1 tabindex="-1">Uploads & imports</h1><p>Review your saved tennis data and import status.</p>'+(selected?'<button type="button" class="secondary" data-import-back '+(busy?'disabled':'')+'>Back to uploads</button>':'')+'<p role="status">'+html(notice||actionMessage)+'</p>'+(selected?!busy&&!failed?importDetailHtml(selected,detail)+importSourcesHtml(sources,sourcePhoto)+(detail?importActionHtml(selected,detail,actionLocked,dates,corrections):'')+scheduleCalendarHtml(calendar,selected.kind==='schedule'&&detail?.ocr==='processed'&&Boolean(detail.schedule)&&selected.status!=='rejected',busy)+'<button type="button" class="secondary" data-import-refresh-draft>Refresh saved draft</button>':'':(loaded?'<label>Show uploads<select data-import-filter '+(busy?'disabled':'')+'><option value="all">All uploads</option><option value="review">Needs review / not accepted</option><option value="pending">Not yet imported</option><option value="imported">Imported</option></select></label><p>'+batches.length+' uploads loaded'+(limited?' &middot; Older uploads available.':'.')+' Showing '+visible.length+' matching upload'+(visible.length===1?'':'s')+' in loaded history.'+'</p>'+'<label>File type<select data-import-kind '+(busy?'disabled':'')+'><option value="all">All file types</option><option value="scorecard">Scorecards</option><option value="schedule">Schedules</option><option value="team_summary">Team / player rosters</option></select></label><label>Search loaded uploads<input type="search" maxlength="80" data-import-search placeholder="Filename or upload status" '+(busy?'disabled':'')+'></label>'+(namesUnavailable?'<p>Source names are unavailable. Open an upload to check its saved details.</p>':'')+importHistoryBatchHtml(historyReader?historyBatchMetadata:batches,checkedUploads,historyReader,historyConsent,busy)+'<ul class="import-history">'+visible.map(b=>importHistoryRowHtml(b,batches.indexOf(b)+1,checkedUploads,busy||Boolean(historyReader),checkedUploads.size>=DATA_ASSIST_MAX_BULK_SCORECARDS)).join('')+'</ul>'+(!visible.length?'<p>'+(batches.length?'No loaded uploads match this filter.':'No saved uploads were found for this account.')+'</p>':''):'')+(loaded&&limited?'<button type="button" class="secondary" data-import-older '+(busy||batches.length>=IMPORT_HISTORY_LIMIT?'disabled':'')+'>Load older uploads</button>'+(batches.length>=IMPORT_HISTORY_LIMIT?'<p>200 uploads loaded. Open Data Assist for earlier records.</p>':''):'')+'<button type="button" class="secondary" data-import-refresh '+(busy?'disabled':'')+'>'+(loaded?'Refresh uploads':'Load my uploads')+'</button>')+(failed&&selected?'<button type="button" class="secondary" data-import-retry>Retry saved draft</button>':'')+(!selected?'<section data-import-upload></section>':'')+'<section><h2>Upload or finish review</h2><p>Use Data Assist for scorecards, schedules, Team Summary and Player Roster exports. Some high-confidence files can import automatically after reading. Check the outcome in Saved uploads.</p><p>Other corrections open TenAceIQ in your browser. You may need to sign in there.</p><button type="button" class="secondary" data-import-web '+(busy?'disabled':'')+'>Open Data Assist</button><p role="status" data-import-web-status></p></section><button type="button" class="secondary" data-import-close '+(busy?'disabled':'')+'>Close uploads</button>'
  const uploadHost=dialog.querySelector<HTMLElement>('[data-import-upload]');if(uploadHost)uploader.mount(uploadHost)
  dialog.querySelector('[data-import-sources-load]')?.addEventListener('click',()=>{void sourceAction()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-import-source-photo]').forEach(button=>button.onclick=()=>{void sourceAction(button.dataset.importSourcePhoto)})
  dialog.querySelector('[data-import-source-zoom]')?.addEventListener('click',()=>{if(busy||!sourcePhoto)return;sourcePhoto.zoom=!sourcePhoto.zoom;render();dialog.querySelector<HTMLElement>('[data-import-source-zoom]')?.focus({preventScroll:true})})
  dialog.querySelector('[data-import-source-hide]')?.addEventListener('click',()=>{if(busy)return;clearSourcePhoto();render();dialog.querySelector<HTMLElement>('[data-import-sources-heading]')?.focus({preventScroll:true})})
  dialog.querySelector('[data-import-calendar-preview]')?.addEventListener('click',()=>{
   if(!selected||!detail||busy||!active()||calendar?.getPhase()==='uncertain')return
   try{calendar=createScheduleCalendar(client,owner,selected,detail,active);calendarRuns.set(selected.id,calendar);notice=''}catch(cause){notice=cause instanceof Error?cause.message:'Calendar dates unavailable.'}
   render();dialog.querySelector<HTMLElement>('[data-import-calendar-heading]')?.focus({preventScroll:true})
  })
  dialog.querySelector('[data-import-calendar-consent]')?.addEventListener('change',event=>{const button=dialog.querySelector<HTMLButtonElement>('[data-import-calendar-save]');if(button)button.disabled=!(event.currentTarget as HTMLInputElement).checked||calendar?.getPhase()!=='review'})
  dialog.querySelector('[data-import-calendar-save]')?.addEventListener('click',()=>{void calendarAction(false)})
  dialog.querySelector('[data-import-calendar-check]')?.addEventListener('click',()=>{void calendarAction(true)})
  dialog.querySelectorAll<HTMLInputElement>('[data-history-select]').forEach(input=>input.onchange=()=>{
   if(busy||historyReader)return
   try{checkedUploads=selectSavedScorecard(batches,checkedUploads,input.dataset.historySelect!,input.checked);notice=''}catch(cause){notice=cause instanceof Error?cause.message:'Choose the saved scorecards again.'}
   render();dialog.querySelector<HTMLElement>('[data-history-select="'+input.dataset.historySelect+'"]')?.focus()
  })
  dialog.querySelector('[data-history-start]')?.addEventListener('click',()=>{
   if(busy||historyReader)return
   try{historyReader=createScorecardReader(client,owner,selectedSavedScorecards(batches,checkedUploads),undefined,unconfirmedReads);historyBatchMetadata=batches.filter(b=>checkedUploads.has(b.id));historyConsent=false;notice=''}catch(cause){notice=cause instanceof Error?cause.message:'Choose the saved scorecards again.'}
   render();dialog.querySelector<HTMLElement>('[data-history-heading]')?.focus({preventScroll:true})
  })
  dialog.querySelector('[data-history-clear]')?.addEventListener('click',()=>{if(busy||historyReader?.hasUnconfirmed())return;historyReader=null;historyBatchMetadata=[];checkedUploads.clear();historyConsent=false;notice='';render();focus()})
  dialog.querySelector('[data-history-read-consent]')?.addEventListener('change',event=>{historyConsent=(event.currentTarget as HTMLInputElement).checked;const button=dialog.querySelector<HTMLButtonElement>('[data-history-read]');if(button)button.disabled=!historyConsent||!historyReader?.canRead()})
  dialog.querySelector('[data-history-read]')?.addEventListener('click',()=>{void runHistory(false)})
  dialog.querySelector('[data-history-refresh]')?.addEventListener('click',()=>{void runHistory(true)})
  dialog.querySelectorAll<HTMLButtonElement>('[data-history-open]').forEach(button=>button.onclick=()=>{void openSaved(button.dataset.historyOpen!)})

  const search=dialog.querySelector<HTMLInputElement>('[data-import-search]');if(search){search.value=historyQuery;search.oninput=()=>{const position=search.selectionStart;historyQuery=search.value.slice(0,80);render();const input=dialog.querySelector<HTMLInputElement>('[data-import-search]');input?.focus({preventScroll:true});if(position!==null)input?.setSelectionRange(position,position)}}
  const kind=dialog.querySelector<HTMLSelectElement>('[data-import-kind]');if(kind){kind.value=historyKind;kind.onchange=()=>{historyKind=kind.value;render();dialog.querySelector<HTMLSelectElement>('[data-import-kind]')?.focus()}}
  dialog.querySelector('[data-import-older]')?.addEventListener('click',()=>{void older()})
  dialog.querySelector<HTMLSelectElement>('[data-import-filter]')?.addEventListener('change',event=>{filter=(event.currentTarget as HTMLSelectElement).value;render();dialog.querySelector<HTMLSelectElement>('[data-import-filter]')?.focus()})
  const select=dialog.querySelector<HTMLSelectElement>('[data-import-filter]');if(select)select.value=filter
  dialog.querySelector('[data-import-refresh-draft]')?.addEventListener('click',()=>{if(selected)void read(selected,true)})
  dialog.querySelectorAll<HTMLInputElement>('[data-schedule-date]').forEach(input=>{
   input.value=dates[input.dataset.scheduleDate!]||''
   input.addEventListener('input',()=>{
    dates[input.dataset.scheduleDate!]=input.value
    const consent=dialog.querySelector<HTMLInputElement>('[data-import-consent]');if(consent)consent.checked=false
    dialog.querySelectorAll<HTMLButtonElement>('[data-import-action=confirmed]').forEach(button=>button.disabled=true)
    const status=dialog.querySelector('[data-schedule-status]');if(status&&detail?.schedule)status.textContent=scheduleReady(detail.schedule,dates,corrections)?'Schedule details are ready. Check every match, then confirm below.':'Finish the highlighted schedule details before confirming.'
   })
  })
  dialog.querySelectorAll<HTMLInputElement>('[data-schedule-field]').forEach(input=>{
   const index=input.dataset.scheduleIndex!,field=input.dataset.scheduleField! as ScheduleCorrectionField
   input.value=corrections[index]?.[field]||''
   input.addEventListener('input',()=>{
    corrections[index]={...corrections[index],[field]:input.value}
    const consent=dialog.querySelector<HTMLInputElement>('[data-import-consent]');if(consent)consent.checked=false
    dialog.querySelectorAll<HTMLButtonElement>('[data-import-action=confirmed]').forEach(button=>button.disabled=true)
    const status=dialog.querySelector('[data-schedule-status]');if(status&&detail?.schedule)status.textContent=scheduleReady(detail.schedule,dates,corrections)?'Schedule details are ready. Check every match, then confirm below.':'Finish the highlighted schedule details before confirming.'
   })
  })
  dialog.querySelector('[data-schedule-reset]')?.addEventListener('click',()=>{if(busy)return;dates={};corrections={};render();dialog.querySelector<HTMLElement>('[data-schedule-review-heading]')?.focus({preventScroll:true})})
  dialog.querySelector('[data-import-consent]')?.addEventListener('change',event=>{const checked=(event.currentTarget as HTMLInputElement).checked;dialog.querySelectorAll<HTMLButtonElement>('[data-import-action]:not([data-import-action=flagged])').forEach(button=>button.disabled=!checked||(button.dataset.importAction==='confirmed'&&selected?.kind==='schedule'&&(!detail?.schedule||!scheduleReady(detail.schedule,dates,corrections))))})
  dialog.querySelectorAll<HTMLButtonElement>('[data-import-action]').forEach(button=>button.onclick=()=>{void perform(button.dataset.importAction as ImportAction)})
  dialog.querySelector('[data-import-back]')?.addEventListener('click',back)
  dialog.querySelector('[data-import-close]')?.addEventListener('click',()=>{if(!busy)dispose()})
  dialog.querySelector('[data-import-refresh]')?.addEventListener('click',()=>{void read()})
  dialog.querySelector('[data-import-retry]')?.addEventListener('click',()=>{if(selected)void read(selected,true)})
  dialog.querySelectorAll<HTMLButtonElement>('[data-import-id]').forEach(b=>b.onclick=()=>{const batch=batches.find(r=>r.id===b.dataset.importId);if(batch&&!busy){returnId=batch.id;void read(batch)}})
  dialog.querySelector<HTMLButtonElement>('[data-import-web]')!.onclick=async event=>{
   if(busy||!active())return
   const button=event.currentTarget as HTMLButtonElement;button.disabled=true
   try{if(!active())return;await Browser.open({url:DATA_ASSIST_URL})}catch{if(active())dialog.querySelector('[data-import-web-status]')!.textContent='Could not open Data Assist. Check your connection and try again.'}finally{if(active())button.disabled=false}
  }
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();back()});document.addEventListener('visibilitychange',visibility);document.body.append(dialog);render();dialog.showModal();focus()
 return {dispose,back,isOpen:()=>active()}
}

export function importActionHtml(batch:ImportBatch,detail:ImportDetail,locked=false,dates:ScheduleDates={},corrections:ScheduleCorrections={}){
 if(locked)return '<p>Refresh the saved draft before taking another action.</p>'
 const actions=availableImportActions(batch,detail)
 if(!actions.length)return ''
 const reading=actions.includes('read')
 const editing=!reading&&batch.kind==='schedule'&&detail.schedule
 const dateFields=editing?'<h3 tabindex="-1" data-schedule-review-heading>Complete schedule details</h3><p>Fill only the highlighted details from your original schedule. Changes stay here until you confirm the import. Refreshing discards these edits.</p><div class="import-schedule-dates">'+detail.schedule!.matches.map((m,i)=>m.reviewNotes.length?'<fieldset><legend>Match '+(i+1)+'</legend><p>'+html(m.homeTeam||'Home team missing')+' vs '+html(m.awayTeam||'Visiting team missing')+'</p>'+(m.reviewNotes.includes('Check date')?'<label>Confirm date<input type="date" min="2000-01-01" max="2099-12-31" data-schedule-date="'+i+'"></label>':'')+scheduleCorrectionFields.filter(f=>canCorrectScheduleField(m,f.key)).map(f=>'<label>'+html(f.label)+'<input type="'+f.type+'" '+(f.key==='externalMatchId'?'inputmode="numeric" pattern="[0-9]{10}" maxlength="10"':f.type==='text'?'maxlength="500"':'step="60"')+' data-schedule-index="'+i+'" data-schedule-field="'+f.key+'"></label>').join('')+'</fieldset>':'').join('')+'</div><p role="status" data-schedule-status>'+ (scheduleReady(detail.schedule!,dates,corrections)?'Schedule details are ready. Check every match, then confirm below.':'Finish the highlighted schedule details before confirming.')+'</p><button type="button" class="secondary" data-schedule-reset>Reset schedule corrections</button>':''
 return '<section class="import-review"><h3>'+ (reading?'Read saved file':'Review extracted data')+'</h3><p>'+ (reading?'Reading uses the same rules as Data Assist. A high-confidence file may import automatically.':'Check the teams, dates, player names and scores above. Confirming can immediately import these records. '+(editing?'Complete the highlighted schedule details below. Other corrections open Data Assist.':'Use Data Assist in your browser for corrections.'))+'</p>'+dateFields+ (actions.some(a=>a!=='flagged')?'<label class="import-consent"><input type="checkbox" data-import-consent> '+(reading?'I understand this may import the saved file.':'I checked all extracted rows and want to confirm this import.')+'</label>':'')+'<div class="import-review-actions">'+actions.map(a=>'<button type="button" class="secondary" data-import-action="'+a+'" '+(a==='flagged'?'':'disabled')+'>'+(a==='read'?'Read saved file':a==='confirmed'?'Confirm reviewed data':'Flag incorrect data')+'</button>').join('')+'</div></section>'
}

export function importHistoryRowHtml(batch:ImportBatch,index:number,checked:ReadonlySet<string>,locked=false,atLimit=false){
 const name=batch.fileName||'Saved '+kindLabel[batch.kind].toLowerCase()+' '+index
 return '<li><h2>'+html(kindLabel[batch.kind])+'</h2><p><strong>'+html(name)+'</strong></p><p>'+html(label(batch.status))+' · '+html(stamp(batch.created))+' · '+batch.files+' source file'+(batch.files===1?'':'s')+'</p>'+(canSelectSavedScorecard(batch)?'<label class="import-consent"><input type="checkbox" data-history-select="'+html(batch.id)+'" aria-label="Select scorecard '+index+': '+html(name)+'" '+(checked.has(batch.id)?'checked':'')+' '+(locked||atLimit&&!checked.has(batch.id)?'disabled':'')+'> Select for batch reading</label>':'')+'<button type="button" class="secondary" data-import-id="'+html(batch.id)+'" '+(locked?'disabled':'')+'>View '+html(kindLabel[batch.kind].toLowerCase())+' upload</button></li>'
}
export function importHistoryBatchHtml(batches:ImportBatch[],ids:ReadonlySet<string>,reader:ReturnType<typeof createScorecardReader>|null,consent=false,busy=false){
 if(!reader)return '<div class="import-history-selection"><p>'+ids.size+' of '+DATA_ASSIST_MAX_BULK_SCORECARDS+' selected. Choose at least two single-file scorecards. Imported and multi-file uploads can be opened individually.</p><button type="button" class="secondary" data-history-start '+(busy||ids.size<2?'disabled':'')+'>Review selected scorecards</button><button type="button" class="secondary" data-history-clear '+(busy||!ids.size?'disabled':'')+'>Clear selection</button></div>'
 return '<section class="import-bulk"><h2 tabindex="-1" data-history-heading>Selected saved scorecards</h2><p>These files are already saved. Reading may import their results. Closing this screen clears this selection.</p><ol>'+reader.items.map((item,index)=>'<li><strong>'+html(batches.find(b=>b.id===item.id)?.fileName||'Saved scorecard '+(index+1))+'</strong><p>'+html(item.message)+'</p><button type="button" class="secondary" data-history-open="'+html(item.id)+'" '+(busy?'disabled':'')+'>Review selected file '+(index+1)+'</button></li>').join('')+'</ol>'+readingControlsHtml(reader,consent,busy,'history')+'<button type="button" class="secondary" data-history-clear '+(busy||reader.hasUnconfirmed()?'disabled':'')+'>Choose other saved files</button></section>'
}
