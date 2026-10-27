import {DATA_ASSIST_MAX_BULK_SCORECARDS} from '../../lib/data-assist-limits'
import type {ImportBatch} from './data-imports-data'
export function canSelectSavedScorecard(batch:ImportBatch){return batch.kind==='scorecard'&&batch.files===1&&!['imported','rejected'].includes(batch.status)}
export function selectSavedScorecard(batches:ImportBatch[],ids:ReadonlySet<string>,id:string,checked:boolean){
 const next=new Set(ids)
 if(!checked){next.delete(id);return next}
 const batch=batches.find(b=>b.id===id)
 if(!batch||!canSelectSavedScorecard(batch)||next.size>=DATA_ASSIST_MAX_BULK_SCORECARDS&&!next.has(id))throw Error('Choose up to '+DATA_ASSIST_MAX_BULK_SCORECARDS+' single-file scorecard uploads.')
 next.add(id);return next
}
export function selectedSavedScorecards(batches:ImportBatch[],ids:ReadonlySet<string>){
 const selected=batches.filter(b=>ids.has(b.id)&&canSelectSavedScorecard(b))
 if(selected.length!==ids.size||selected.length<2||selected.length>DATA_ASSIST_MAX_BULK_SCORECARDS)throw Error('Choose 2–'+DATA_ASSIST_MAX_BULK_SCORECARDS+' single-file scorecard uploads from this history.')
 return selected.map(b=>b.id)
}
