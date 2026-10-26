import {Browser} from '@capacitor/browser'
import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {DATA_ASSIST_URL,loadImportBatches,loadImportDetail,type ImportBatch,type ImportDetail} from './data-imports-data'

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
 let disposed=false,busy=false,version=0,loaded=false,limited=false,batches:ImportBatch[]=[],selected:ImportBatch|null=null,detail:ImportDetail|null=null,notice='',failed=false,filter='all',returnId=''
 const active=()=>!disposed&&current()&&dialog.isConnected
 const focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus({preventScroll:true})
 const dispose=()=>{if(disposed)return;disposed=true;version++;document.removeEventListener('visibilitychange',visibility);dialog.remove();batches=[];selected=null;detail=null;if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const back=()=>{if(!active())return false;if(selected){version++;busy=false;selected=null;detail=null;notice='';failed=false;render();dialog.querySelector<HTMLElement>('[data-import-id="'+returnId+'"]')?.focus();return true}dispose();return true}
 const visibility=()=>{if(document.visibilityState==='hidden')dispose()}
 const read=async(batch?:ImportBatch)=>{
  if(!active()||busy)return;const visit=++version;busy=true;failed=false;notice=batch?'Loading saved draft…':'Loading your uploads…';selected=batch||null;detail=null;render();focus()
  const valid=()=>active()&&version===visit
  try{if(batch){const result=await loadImportDetail(client,batch,valid);if(!valid())return;detail=result}else{const result=await loadImportBatches(client,owner,valid);if(!valid())return;batches=result.batches;limited=result.limited;loaded=true}notice=''}
  catch(cause){if(!valid())return;failed=true;notice=cause instanceof Error?cause.message:'Uploads are unavailable. Try again.'}
  finally{if(valid()){busy=false;render();focus()}}
 }
 const render=()=>{
  if(!active())return
  const visible=batches.filter(b=>filter==='all'||filter==='imported'&&b.status==='imported'||filter==='review'&&['needs_review','rejected'].includes(b.status)||filter==='pending'&&!['imported','needs_review','rejected'].includes(b.status))
  dialog.innerHTML='<h1 tabindex="-1">Uploads & imports</h1><p>Review your saved tennis data and import status.</p>'+(selected?'<button type="button" class="secondary" data-import-back>Back to uploads</button>':'')+'<p role="status">'+html(notice)+'</p>'+(selected?!busy&&!failed?importDetailHtml(selected,detail):'':(loaded?'<label>Show uploads<select data-import-filter><option value="all">All uploads</option><option value="review">Needs review / not accepted</option><option value="pending">Not yet imported</option><option value="imported">Imported</option></select></label><p>'+(limited?'Latest 40 uploads. Older uploads are available in Data Assist.':batches.length+' saved upload'+(batches.length===1?'':'s')+' loaded.')+'</p><ul class="import-history">'+visible.map(b=>'<li><h2>'+html(kindLabel[b.kind])+'</h2><p>'+html(label(b.status))+' · '+html(stamp(b.created))+'</p><button type="button" class="secondary" data-import-id="'+html(b.id)+'">View '+html(kindLabel[b.kind].toLowerCase())+' upload</button></li>').join('')+'</ul>'+(!visible.length?'<p>'+(batches.length?'No loaded uploads match this filter.':'No saved uploads were found for this account.')+'</p>':''):'')+'<button type="button" class="secondary" data-import-refresh '+(busy?'disabled':'')+'>'+(loaded?'Refresh uploads':'Load my uploads')+'</button>')+(failed&&selected?'<button type="button" class="secondary" data-import-retry>Retry saved draft</button>':'')+'<section><h2>Upload or finish review</h2><p>Use Data Assist for scorecards, schedules, Team Summary and Player Roster exports. Some high-confidence files can import automatically after reading. Check the outcome in Saved uploads.</p><p>This opens TenAceIQ in your browser. You may need to sign in there.</p><button type="button" class="secondary" data-import-web>Open Data Assist</button><p role="status" data-import-web-status></p></section><button type="button" class="secondary" data-import-close>Close uploads</button>'
  dialog.querySelector<HTMLSelectElement>('[data-import-filter]')?.addEventListener('change',event=>{filter=(event.currentTarget as HTMLSelectElement).value;render();dialog.querySelector<HTMLSelectElement>('[data-import-filter]')?.focus()})
  const select=dialog.querySelector<HTMLSelectElement>('[data-import-filter]');if(select)select.value=filter
  dialog.querySelector('[data-import-back]')?.addEventListener('click',back)
  dialog.querySelector('[data-import-close]')?.addEventListener('click',dispose)
  dialog.querySelector('[data-import-refresh]')?.addEventListener('click',()=>{void read()})
  dialog.querySelector('[data-import-retry]')?.addEventListener('click',()=>{if(selected)void read(selected)})
  dialog.querySelectorAll<HTMLButtonElement>('[data-import-id]').forEach(b=>b.onclick=()=>{const batch=batches.find(r=>r.id===b.dataset.importId);if(batch){returnId=batch.id;void read(batch)}})
  dialog.querySelector<HTMLButtonElement>('[data-import-web]')!.onclick=async event=>{
   const button=event.currentTarget as HTMLButtonElement;button.disabled=true
   try{if(!active())return;await Browser.open({url:DATA_ASSIST_URL})}catch{if(active())dialog.querySelector('[data-import-web-status]')!.textContent='Could not open Data Assist. Check your connection and try again.'}finally{if(active())button.disabled=false}
  }
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();back()});document.addEventListener('visibilitychange',visibility);document.body.append(dialog);render();dialog.showModal();focus()
 return {dispose,back,isOpen:()=>active()}
}
