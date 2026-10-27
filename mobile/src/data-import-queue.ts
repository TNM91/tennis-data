import {DATA_ASSIST_MAX_BULK_SCORECARDS} from '../../lib/data-assist-limits'
import {prepareNativeImport,type UploadIntent} from './data-import-upload'

export async function prepareBulkScorecards(files:File[],owner:string,current:()=>boolean){
 if(files.length<2||files.length>DATA_ASSIST_MAX_BULK_SCORECARDS)throw Error(`Choose 2–${DATA_ASSIST_MAX_BULK_SCORECARDS} scorecard exports. Choose schedules and rosters one at a time.`)
 const intents:UploadIntent[]=[]
 for(const file of files){
  if(!current())throw Error('This upload is no longer open.')
  let intent:UploadIntent
  try{intent=await prepareNativeImport(file,owner)}catch{throw Error('Could not check '+file.name+'. Choose a readable TennisLink scorecard export, up to 10 MB.')}
  if(!current())throw Error('This upload is no longer open.')
  if(intent.kind!=='scorecard')throw Error(file.name+' is not a scorecard export. Upload schedules and rosters one at a time.')
  intents.push(intent)
 }
 return intents
}
export type QueueItem={intent:UploadIntent;state:'ready'|'saving'|'saved'|'uncertain';batchId:string}
type Save=(intent:UploadIntent,current:()=>boolean)=>Promise<{batchId:string;duplicate:boolean}>
export function createScorecardQueue(intents:UploadIntent[]){
 const items:QueueItem[]=intents.map(intent=>({intent,state:'ready',batchId:''}))
 let running=false
 const attempt=async(item:QueueItem,save:Save,current:()=>boolean,changed:()=>void)=>{
  if(!current())return false
  item.state='saving';changed()
  try{const result=await save(item.intent,current);if(!current())return false;item.batchId=result.batchId;item.state='saved';changed();return true}
  catch{if(current()){item.state='uncertain';changed()}return false}
 }
 return {items,isRunning:()=>running,
  async saveReady(save:Save,current:()=>boolean,changed:()=>void){
   if(running||!current()||items.some(i=>i.state==='uncertain'))return
   running=true
   try{for(const item of items){if(!current())break;if(item.state==='ready'&&!await attempt(item,save,current,changed))break}}finally{running=false}
  },
  async resume(index:number,save:Save,current:()=>boolean,changed:()=>void){
   const item=items[index];if(running||!current()||!item||item.state!=='uncertain')return
   running=true;try{await attempt(item,save,current,changed)}finally{running=false}
  }
 }
}
