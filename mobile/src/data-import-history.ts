import {isValidCalendarDate} from '../../lib/calendar-date'
import type {ImportBatch} from './data-imports-data'
export const IMPORT_HISTORY_LIMIT=200
export type ImportHistoryCursor={created:string;id:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function stamp(value:string){
 const parts=/^(20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
 if(!parts||!isValidCalendarDate(value.slice(0,10))||!Number.isFinite(Date.parse(value)))throw Error('Refresh upload history before loading older files.')
 return new Date(value).toISOString().slice(0,19)+'.'+(parts[2]||'').padEnd(6,'0')
}
export function importHistoryCursor(batch:ImportHistoryCursor){
 if(!uuid.test(batch.id))throw Error('Refresh upload history before loading older files.')
 stamp(batch.created);return {created:batch.created,id:batch.id}
}
export function importHistoryBefore(a:ImportHistoryCursor,b:ImportHistoryCursor){
 const x=stamp(a.created),y=stamp(b.created)
 return x<y||x===y&&a.id.toLowerCase()<b.id.toLowerCase()
}
export function checkOlderImportPage(batches:ImportBatch[],cursor:ImportHistoryCursor){
 importHistoryCursor(cursor)
 for(let i=0;i<batches.length;i++)if(!importHistoryBefore(batches[i],i?batches[i-1]:cursor))throw Error('Upload history changed. Refresh before loading older files.')
}
export function appendImportHistory(current:ImportBatch[],older:ImportBatch[]){
 if(!current.length||current.length+older.length>IMPORT_HISTORY_LIMIT||new Set([...current,...older].map(b=>b.id)).size!==current.length+older.length)throw Error('Refresh upload history before loading older files.')
 if(older.some(b=>b.owner!==current[0].owner))throw Error('Close uploads and sign in again.')
 checkOlderImportPage(older,importHistoryCursor(current[current.length-1]));return [...current,...older]
}
export function filterImportHistory(batches:ImportBatch[],status:string,kind:string,query:string){
 const words=query.trim().slice(0,80).toLowerCase().split(/\s+/).filter(Boolean)
 return batches.filter(b=>(status==='all'||status==='imported'&&b.status==='imported'||status==='review'&&['needs_review','rejected'].includes(b.status)||status==='pending'&&!['imported','needs_review','rejected'].includes(b.status))&&(kind==='all'||kind===b.kind)&&words.every(word=>[b.fileName||'',b.kind==='team_summary'?'team player roster':b.kind,b.status.replaceAll('_',' ')].join(' ').toLowerCase().includes(word)))
}
