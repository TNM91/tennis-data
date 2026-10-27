import {savedImportOutcome} from './data-import-outcome'
import type {SupabaseClient} from '@supabase/supabase-js'
import {DATA_ASSIST_MAX_BULK_SCORECARDS} from '../../lib/data-assist-limits'
import {actOnImport,availableImportActions} from './data-import-actions'
import {loadImportBatch,loadImportDetail,type ImportBatch,type ImportDetail} from './data-imports-data'

type Snapshot={batch:ImportBatch;detail:ImportDetail|null}
export type ReadingOps={load:(id:string,current:()=>boolean)=>Promise<Snapshot>;read:(snapshot:Snapshot,current:()=>boolean)=>Promise<unknown>}
export type ReadingItem={id:string;state:'ready'|'checking'|'reading'|'imported'|'duplicate'|'review'|'blocked'|'uncertain';message:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function createScorecardReader(client:SupabaseClient,owner:string,ids:string[],injected?:ReadingOps,unconfirmed=new Set<string>()){
 if(!uuid.test(owner)||ids.length<2||ids.length>DATA_ASSIST_MAX_BULK_SCORECARDS||ids.some(id=>!uuid.test(id))||new Set(ids).size!==ids.length)throw Error('Choose the saved scorecards again.')
 const ops:ReadingOps=injected||{
  load:async(id,current)=>{const batch=await loadImportBatch(client,owner,id,current);const detail=await loadImportDetail(client,batch,current);return {batch,detail}},
  read:async(snapshot,current)=>{if(!snapshot.detail)throw Error('No saved draft.');return actOnImport(client,owner,current,snapshot.batch,snapshot.detail,'read')},
 }
 const items:ReadingItem[]=ids.map(id=>({id,state:'ready',message:'Saved · status not checked yet'}))
 let running=false
 const checked=(item:ReadingItem,snapshot:Snapshot,wasUncertain=false)=>{
  const {batch,detail}=snapshot
  if(batch.id!==item.id||batch.owner!==owner||batch.kind!=='scorecard'||batch.files!==1)throw Error('This saved file changed.')
  if(savedImportOutcome(batch,detail).state==='conflict'){item.state='blocked';item.message='Saved statuses disagree. Refresh the saved file or open Data Assist.';return}
  if(!detail){item.state='blocked';item.message='No saved draft. Open the file to check its status.';return}
  if(detail.ocr==='processed'||detail.ocr==='failed'||batch.status==='imported'||detail.status==='imported')unconfirmed.delete(item.id)
  const counts=detail.outcome.map(([label,value])=>label+': '+value).join(' · ')
  if(batch.status==='imported'||detail.status==='imported'){
   item.state=savedImportOutcome(batch,detail).state==='partial'?'review':savedImportOutcome(batch,detail).state==='duplicate'?'duplicate':'imported'
   item.message=(item.state==='review'?'Import recorded with rows to review.':item.state==='duplicate'?'Already imported. No result changes recorded.':'Import recorded.')+(counts?' '+counts:'');return
  }
  if(detail.status==='verified'||batch.status==='verified'){item.state='blocked';item.message='Confirmation recorded. Refresh later to check the import outcome.';return}
  if(detail.ocr==='processed'){
   item.state='review';item.message='Reading recorded. Open the file to review its saved details and import status.';return
  }
  // A missing/late response is not proof that another OCR request is safe.
  if(wasUncertain&&detail.ocr!=='failed'){
   item.state='uncertain';item.message='The previous read may still finish. Refresh later or open the saved file.';return
  }
  if(availableImportActions(batch,detail).includes('read')){item.state='ready';item.message=detail.ocr==='failed'?'Previous reading failed. Ready for an explicit retry.':'Ready to read.';return}
  item.state='blocked';item.message='Reading or import is not available yet. Open the file or refresh its status later.'
 }
 const load=async(item:ReadingItem,current:()=>boolean,changed:()=>void,wasUncertain=false)=>{
  item.state='checking';changed();const snapshot=await ops.load(item.id,current)
  if(!current())return null
  checked(item,snapshot,wasUncertain);changed();return snapshot
 }
 return {items,isRunning:()=>running,hasUnconfirmed:()=>items.some(i=>unconfirmed.has(i.id)),canRead:()=>!running&&!items.some(i=>unconfirmed.has(i.id)||i.state==='uncertain')&&items.some(i=>i.state==='ready'),
  async refresh(current:()=>boolean,changed:()=>void){
   if(running||!current())return;running=true
   try{for(const item of items){if(!current())break;const uncertain=item.state==='uncertain'||unconfirmed.has(item.id);try{await load(item,current,changed,uncertain)}catch{if(!current())break;item.state=uncertain?'uncertain':'blocked';item.message='Status could not be checked. Refresh later or open the saved file.';changed();break}}}finally{running=false}
  },
  async readRemaining(current:()=>boolean,changed:()=>void){
   if(running||!current()||items.some(i=>unconfirmed.has(i.id)||i.state==='uncertain'))return;running=true
   try{for(const item of items){
    if(!current())break;if(item.state!=='ready')continue
    let requested=false
    try{
     const snapshot=await load(item,current,changed);if(!snapshot||!current())break
     if(item.state!=='ready')continue
     requested=true;unconfirmed.add(item.id);item.state='reading';item.message='Reading saved scorecard…';changed()
     await ops.read(snapshot,current);if(!current())break
     await load(item,current,changed,true);if(!current())break
     if(items.some(i=>i===item&&i.state==='uncertain'))break
    }catch{if(!current())break;item.state=requested?'uncertain':'blocked';item.message=requested?'Result not confirmed. Refresh outcomes before another read.':'Status could not be checked. Refresh outcomes before reading.';changed();break}
   }}finally{running=false}
  },
 }
}
