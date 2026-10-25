export type PracticeEditFields = {date:string;time:string;endTime:string;facility:string;focus:string;recurrence:string}
export type PracticeEditReceipt = {requestId:string;expectedUpdatedAt:string}
export function validPracticeEditFields(value:unknown):value is PracticeEditFields {
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const f=value as PracticeEditFields
 if(typeof f.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(f.date)||!Number.isFinite(Date.parse(f.date))||new Date(f.date).toISOString().slice(0,10)!==f.date)return false
 const time=(v:unknown)=>typeof v==='string'&&(v===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
 return time(f.time)&&time(f.endTime)&&(!f.endTime||Boolean(f.time)&&f.endTime>f.time)&&typeof f.facility==='string'&&f.facility.length<=300&&typeof f.focus==='string'&&f.focus.length<=3000&&['','weekly','biweekly'].includes(f.recurrence)
}
export function samePracticeEditFields(a:PracticeEditFields,b:PracticeEditFields){return (['date','time','endTime','facility','focus','recurrence'] as const).every(k=>a[k]===b[k])}
export const validPracticeEditId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
